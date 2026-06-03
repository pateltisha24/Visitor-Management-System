"""FaceSense real-time visitor analytics pipeline.

Detects faces every frame (cheap) and tracks them with a centroid tracker, but
runs the heavier age/gender/emotion analysis only every Nth frame and only until
each track has enough samples — so the live frame rate stays high (25+ FPS on
typical hardware) while each visitor still gets analysed. Each unique visitor is
written exactly once (the modal prediction), giving a real footfall count.

Usage:
  python pipeline.py                       # webcam
  python pipeline.py --source file --file clip.mp4
  python pipeline.py --source rtsp --rtsp-url rtsp://user:pass@ip:554/stream
  python pipeline.py --no-db               # display only, don't persist
  python pipeline.py --engine opencv       # use the lightweight legacy engine
"""
import argparse
import threading
import time
from collections import Counter

import cv2
import numpy as np

import config
from tracker import CentroidTracker
from face_analyzer import FaceAnalyzer
import storage


class VideoStream:
    """Frame source. Threaded (always-latest frame) for live cameras/RTSP to
    avoid latency build-up; sequential for files so no frames are skipped."""
    def __init__(self, src, threaded):
        self.cap = cv2.VideoCapture(src)
        if not self.cap.isOpened():
            raise SystemExit(f"Could not open video source: {src}")
        self.threaded = threaded
        self.frame = None
        self.running = True
        self.lock = threading.Lock()
        if threaded:
            threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        while self.running:
            ok, frame = self.cap.read()
            if ok:
                with self.lock:
                    self.frame = frame
            else:
                self.running = False

    def read(self):
        if self.threaded:
            with self.lock:
                return self.frame if self.frame is not None else None, True
        ok, frame = self.cap.read()
        return frame, ok

    def release(self):
        self.running = False
        self.cap.release()


def detect_faces(net, frame, conf_threshold=0.7):
    """Return face boxes [(x1,y1,x2,y2), ...] using the OpenCV SSD detector."""
    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(frame, 1.0, (300, 300), [104, 117, 123], True, False)
    net.setInput(blob)
    detections = net.forward()
    boxes = []
    for i in range(detections.shape[2]):
        if detections[0, 0, i, 2] > conf_threshold:
            x1 = max(0, int(detections[0, 0, i, 3] * w))
            y1 = max(0, int(detections[0, 0, i, 4] * h))
            x2 = min(w - 1, int(detections[0, 0, i, 5] * w))
            y2 = min(h - 1, int(detections[0, 0, i, 6] * h))
            if x2 > x1 and y2 > y1:
                boxes.append((x1, y1, x2, y2))
    return boxes


def crop(frame, box, pad=20):
    x1, y1, x2, y2 = box
    h, w = frame.shape[:2]
    return frame[max(0, y1 - pad):min(y2 + pad, h - 1), max(0, x1 - pad):min(x2 + pad, w - 1)]


def mode(values):
    return Counter(values).most_common(1)[0][0] if values else None


def main():
    ap = argparse.ArgumentParser(description="FaceSense visitor analytics pipeline")
    ap.add_argument("--source", choices=["webcam", "file", "rtsp"], default="webcam")
    ap.add_argument("--file", help="Path to a video file (with --source file)")
    ap.add_argument("--rtsp-url", default=config.RTSP_URL, help="RTSP URL (with --source rtsp)")
    ap.add_argument("--device", type=int, default=0, help="Webcam index")
    ap.add_argument("--engine", choices=["deepface", "opencv"], default=config.ENGINE)
    ap.add_argument("--no-db", action="store_true", help="Don't persist readings")
    ap.add_argument("--no-show", action="store_true", help="Run headless (no window)")
    args = ap.parse_args()

    # Resolve source.
    if args.source == "file":
        if not args.file:
            raise SystemExit("--source file requires --file <path>")
        src, threaded = args.file, False
    elif args.source == "rtsp":
        if not args.rtsp_url:
            raise SystemExit("--source rtsp requires --rtsp-url (or RTSP_URL in .env)")
        src, threaded = args.rtsp_url, True
    else:
        src, threaded = args.device, True

    face_net = cv2.dnn.readNet(config.FACE_MODEL, config.FACE_PROTO)
    analyzer = FaceAnalyzer(engine=args.engine)
    tracker = CentroidTracker(config.TRACK_MAX_DISAPPEARED, config.TRACK_MAX_DISTANCE)
    store = None if args.no_db else storage.get_store()
    stream = VideoStream(src, threaded)

    counted = set()          # track ids already persisted (dedup)
    last_label = {}          # track id -> "gender, age, emotion" for overlay
    frame_idx = 0
    fps_t0, fps_n, fps = time.time(), 0, 0.0

    def persist(track):
        age = mode(track.samples["age"]); gender = mode(track.samples["gender"]); emo = mode(track.samples["emotion"])
        if not age or store is None:
            return
        reading = storage.build_reading(age, gender, emo, track.max_concurrent)
        try:
            store.save(reading)
            print(f"saved: {reading['Gender']}, {reading['Age']}, {reading['Emotion']} ({reading['Gi']})")
        except Exception as e:
            print(f"save failed: {e}")

    print("Pipeline running. Press 'q' to quit.")
    try:
        while True:
            frame, ok = stream.read()
            if frame is None:
                if not ok:
                    break
                time.sleep(0.005)
                continue
            frame_idx += 1

            # Optionally downscale for faster detection, then scale boxes back.
            scale = 1.0
            det_frame = frame
            if config.DETECT_WIDTH and frame.shape[1] > config.DETECT_WIDTH:
                scale = config.DETECT_WIDTH / frame.shape[1]
                det_frame = cv2.resize(frame, (config.DETECT_WIDTH, int(frame.shape[0] * scale)))
            boxes = [tuple(int(v / scale) for v in b) for b in detect_faces(face_net, det_frame)]

            tracks = tracker.update(boxes)

            # Amortised analysis: only some frames, only tracks still gathering samples.
            if frame_idx % config.ANALYZE_EVERY_N_FRAMES == 0:
                for t in tracks.values():
                    if t.sample_count < config.MAX_SAMPLES_PER_TRACK:
                        result = analyzer.analyze(crop(frame, t.bbox))
                        if result:
                            t.add_sample(*result)
                            last_label[t.id] = f"{result[1]}, {result[0]}, {result[2]}"

            # Persist a visitor once they have enough samples (prompt, deduped).
            for t in tracks.values():
                if t.id not in counted and t.sample_count >= config.MAX_SAMPLES_PER_TRACK:
                    persist(t)
                    counted.add(t.id)

            # Persist anyone who left without reaching the sample target.
            for t in tracker.drain_finalised():
                if t.id not in counted and t.sample_count > 0:
                    persist(t)
                    counted.add(t.id)

            # ---- Overlay ----
            if not args.no_show:
                for t in tracks.values():
                    x1, y1, x2, y2 = t.bbox
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (60, 200, 80), 2)
                    label = last_label.get(t.id, "analysing…")
                    cv2.putText(frame, label, (x1, max(20, y1 - 8)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (40, 220, 255), 2, cv2.LINE_AA)

                fps_n += 1
                if time.time() - fps_t0 >= 1.0:
                    fps = fps_n / (time.time() - fps_t0)
                    fps_t0, fps_n = time.time(), 0
                cv2.putText(frame, f"FPS: {fps:.1f}  visitors: {len(counted)}", (10, 28),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
                cv2.imshow("FaceSense", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    finally:
        # Flush any still-tracked visitors.
        for t in tracker.flush_all():
            if t.id not in counted and t.sample_count > 0:
                persist(t)
                counted.add(t.id)
        stream.release()
        cv2.destroyAllWindows()
        print(f"Done. Total unique visitors counted: {len(counted)}")


if __name__ == "__main__":
    main()

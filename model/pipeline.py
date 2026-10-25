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

Live demo (see docs/DEMO.md): one process per camera, tagged and previewable:
  python pipeline.py --profile demo --camera-id front-desk --camera-name "Front desk" --allow-preview --reid
  python pipeline.py --profile demo --camera-id entrance --camera-name "Store entrance" \
      --source file --file entrance.mp4 --realtime --allow-preview
"""
import argparse
import re
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
    avoid latency build-up; sequential for files so no frames are skipped.

    A file can also be played *as if it were a live camera* (paced=True: read at
    the clip's own frame rate, threaded, frames dropped if analysis falls behind),
    and optionally looped, which is what the recorded demo camera uses."""
    def __init__(self, src, threaded, paced=False, loop=False):
        self.cap = cv2.VideoCapture(src)
        if not self.cap.isOpened():
            raise SystemExit(f"Could not open video source: {src}")
        self.threaded = threaded or paced
        self.loop = loop
        self.frame_interval = 0.0
        if paced:
            fps = self.cap.get(cv2.CAP_PROP_FPS)
            self.frame_interval = 1.0 / (fps if fps and fps > 1 else 25.0)
        self.frame = None
        self.seq = 0            # bumps on every new frame from the reader thread
        self._read_seq = 0
        self.running = True
        self.lock = threading.Lock()
        if self.threaded:
            threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        next_t = time.monotonic()
        while self.running:
            ok, frame = self.cap.read()
            if not ok and self.loop:
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ok, frame = self.cap.read()
            if ok:
                with self.lock:
                    self.frame = frame
                    self.seq += 1
                if self.frame_interval:
                    next_t += self.frame_interval
                    time.sleep(max(0.0, next_t - time.monotonic()))
            else:
                self.running = False

    def read(self):
        if self.threaded:
            # Only hand out each frame once, so a fast loop doesn't re-process
            # (and re-count FPS for) a frame the camera hasn't replaced yet.
            with self.lock:
                if self.seq == self._read_seq:
                    return None, self.running
                self._read_seq = self.seq
                return self.frame, True
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


def draw_overlay(frame, tracks, last_label, fps, visitors, camera_name):
    """Draw face boxes, labels and the status line onto `frame` (in place)."""
    for t in tracks.values():
        x1, y1, x2, y2 = t.bbox
        cv2.rectangle(frame, (x1, y1), (x2, y2), (60, 200, 80), 2)
        label = last_label.get(t.id, "analysing...")
        cv2.putText(frame, label, (x1, max(20, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (40, 220, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, f"{camera_name}  |  FPS: {fps:.1f}  visitors: {visitors}", (10, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)


def list_devices(max_index=6):
    """Probe local camera indices (webcam, iPhone Continuity Camera, USB cameras).
    OpenCV can't read device names on macOS, so this prints index + resolution."""
    found = 0
    for i in range(max_index):
        cap = cv2.VideoCapture(i)
        ok, frame = cap.read() if cap.isOpened() else (False, None)
        if ok:
            found += 1
            print(f"  --device {i}: {frame.shape[1]}x{frame.shape[0]}")
        cap.release()
    if not found:
        print("  No cameras found. On macOS, allow camera access for your terminal app "
              "(System Settings > Privacy & Security > Camera).")


def main():
    ap = argparse.ArgumentParser(description="FaceSense visitor analytics pipeline")
    ap.add_argument("--source", choices=["webcam", "file", "rtsp"], default="webcam")
    ap.add_argument("--file", help="Path to a video file (with --source file)")
    ap.add_argument("--rtsp-url", default=config.RTSP_URL, help="RTSP URL (with --source rtsp)")
    ap.add_argument("--device", type=int, default=0, help="Webcam index")
    ap.add_argument("--engine", choices=["deepface", "opencv"], default=config.ENGINE)
    ap.add_argument("--no-db", action="store_true", help="Don't persist readings")
    ap.add_argument("--no-show", action="store_true", help="Run headless (no window)")
    ap.add_argument("--reid", action="store_true",
                    help="Enable same-day face re-identification (needs the DeepFace engine)")
    ap.add_argument("--profile", choices=sorted(config.PROFILES), default=config.PROFILE,
                    help="Tuning profile: 'default' (accuracy) or 'demo' (responsiveness)")
    ap.add_argument("--camera-id", default=config.CAMERA_ID,
                    help="Short id for this camera, e.g. front-desk (letters, digits, dashes)")
    ap.add_argument("--camera-name", default=config.CAMERA_NAME, help="Display name for this camera")
    ap.add_argument("--allow-preview", action="store_true", default=config.PREVIEW_ALLOWED,
                    help="Let the dashboard watch this camera's annotated feed (live only, never stored)")
    ap.add_argument("--no-live", action="store_true",
                    help="Don't connect the live link (camera status, events, preview)")
    ap.add_argument("--realtime", action="store_true",
                    help="With --source file: play at the clip's real speed, like a live camera")
    ap.add_argument("--loop", action="store_true", help="With --source file: restart the clip when it ends")
    ap.add_argument("--list-devices", action="store_true", help="List local camera indices and exit")
    args = ap.parse_args()

    if args.list_devices:
        print("Local cameras:")
        list_devices()
        return

    # Two cameras must not share an id; derive one from --camera-name if only that was given.
    if args.camera_id == config.CAMERA_ID and args.camera_name != config.CAMERA_NAME:
        args.camera_id = re.sub(r"[^a-z0-9]+", "-", args.camera_name.lower()).strip("-") or config.CAMERA_ID
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", args.camera_id, re.I):
        raise SystemExit("--camera-id must be letters, digits or dashes, e.g. front-desk")

    config.apply_profile(args.profile)
    if config.PROFILE != "default":
        print(f"Profile '{config.PROFILE}': analyse every {config.ANALYZE_EVERY_N_FRAMES} frames, "
              f"{config.MAX_SAMPLES_PER_TRACK} samples/face, leave after {config.TRACK_MAX_DISAPPEARED} frames.")

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

    # Optional same-day face re-identification (opt-in). Stops the same person
    # being counted twice if they leave and return the same day. Embeddings are
    # held in memory only and cleared at date rollover — nothing biometric is
    # written to disk.
    reid = None
    if args.reid or config.REID_ENABLED:
        if analyzer.engine != "deepface":
            print("Re-ID requested but it needs the DeepFace engine; continuing without re-ID.")
        else:
            from reid import ReIDGallery
            reid = ReIDGallery(config.REID_THRESHOLD)
            print(f"Re-ID on (model={config.REID_MODEL}, cosine threshold={config.REID_THRESHOLD}). "
                  "Same-day returning visitors won't be double-counted.")

    print("Loading models...")
    analyzer.warm_up(with_embedding=reid is not None)

    live = None
    if not args.no_live:
        if config.LIVE_URL and config.INGEST_API_KEY:
            from live import LiveLink
            live = LiveLink(config.LIVE_URL, config.INGEST_API_KEY, args.camera_id, args.camera_name,
                            preview_allowed=args.allow_preview, preview_fps=config.PREVIEW_FPS,
                            preview_width=config.PREVIEW_WIDTH)
        elif args.allow_preview:
            print("Preview requested, but the live link needs VMS_INGEST_URL (or VMS_LIVE_URL) "
                  "and VMS_INGEST_API_KEY; continuing without it.")

    is_file = args.source == "file"
    stream = VideoStream(src, threaded, paced=is_file and args.realtime, loop=is_file and args.loop)

    counted = set()          # track ids already finalised (dedup)
    visitors = 0             # unique people counted (re-ID returns excluded)
    last_label = {}          # track id -> "gender, age, emotion" for overlay
    frame_idx = 0
    fps_t0, fps_n, fps = time.time(), 0, 0.0

    def persist(track):
        nonlocal visitors
        age = mode(track.samples["age"]); gender = mode(track.samples["gender"]); emo = mode(track.samples["emotion"])
        if not age:
            return
        # Same-day re-ID: if this face matches someone already counted today,
        # it's a return visit — don't write a second reading.
        if reid is not None and track.embedding is not None:
            person_id, is_new = reid.identify(track.embedding)
            if not is_new:
                print(f"returning visitor (person #{person_id}) — not double-counting")
                if live:
                    live.send_event("returning_visitor")
                return
        visitors += 1
        if store is None:
            return
        reading = storage.build_reading(age, gender, emo, track.max_concurrent,
                                        args.camera_id, args.camera_name)
        try:
            store.save(reading)
            print(f"saved: {reading['Gender']}, {reading['Age']}, {reading['Emotion']} ({reading['Gi']})")
            # Lets dashboards refresh instantly when writing straight to Mongo
            # (with HTTP storage the server already announces the new reading).
            if live and not isinstance(store, storage.HttpStore):
                live.send_event("visitor_counted", age=age, gender=gender, emotion=emo)
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
                        face_crop = crop(frame, t.bbox)
                        result = analyzer.analyze(face_crop)
                        if result:
                            t.add_sample(*result)
                            last_label[t.id] = f"{result[1]}, {result[0]}, {result[2]}"
                        # Compute the face embedding once per track (for same-day re-ID).
                        if reid is not None and t.embedding is None:
                            t.embedding = analyzer.embed(face_crop)

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

            fps_n += 1
            if time.time() - fps_t0 >= 1.0:
                fps = fps_n / (time.time() - fps_t0)
                fps_t0, fps_n = time.time(), 0
                if live:
                    live.update_status(fps, visitors)

            # ---- Overlay (local window and/or dashboard preview) ----
            preview = live is not None and live.wants_frames
            if not args.no_show or preview:
                # Draw on a copy: a threaded stream may hand us this same frame again.
                view = frame.copy()
                draw_overlay(view, tracks, last_label, fps, visitors, args.camera_name)
                if preview:
                    live.offer_frame(view)
                if not args.no_show:
                    cv2.imshow("FaceSense", view)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
    finally:
        # Flush any still-tracked visitors.
        for t in tracker.flush_all():
            if t.id not in counted and t.sample_count > 0:
                persist(t)
                counted.add(t.id)
        stream.release()
        if live:
            live.close()
        cv2.destroyAllWindows()
        print(f"Done. Total unique visitors counted: {visitors}")


if __name__ == "__main__":
    main()

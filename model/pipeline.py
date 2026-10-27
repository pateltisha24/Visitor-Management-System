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
import queue
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


class AnalysisWorker:
    """Runs face analysis on a background thread.

    The models take ~100-250 ms per face; doing that inside the frame loop would
    freeze detection, tracking and the dashboard preview each time. Instead the
    loop hands crops over (at most one in flight per track) and picks up the
    results on a later frame. pending()/submit()/collect() are main-thread only.
    """

    def __init__(self, analyzer, embed, max_pending=4):
        self._analyzer, self._embed = analyzer, embed
        self._jobs, self._done = queue.Queue(), queue.Queue()
        self._pending = set()
        self._max_pending = max_pending
        threading.Thread(target=self._run, name="analysis", daemon=True).start()

    def pending(self, track_id):
        return track_id in self._pending

    def submit(self, track_id, face, frame, box, landmarks, want_embedding):
        if track_id in self._pending or len(self._pending) >= self._max_pending:
            return False
        self._pending.add(track_id)
        self._jobs.put((track_id, face, frame, box, landmarks, want_embedding))
        return True

    def _run(self):
        while True:
            job = self._jobs.get()
            if job is None:
                return
            track_id, face, frame, box, landmarks, want_embedding = job
            try:
                result = self._analyzer.analyze(face)
                embedding = self._embed(frame, box, landmarks, face) if want_embedding else None
            except Exception as e:
                print(f"analysis failed: {e}")
                result = embedding = None
            self._done.put((track_id, result, embedding))

    def collect(self):
        """Finished (track_id, result, embedding) tuples since the last call."""
        out = []
        while True:
            try:
                item = self._done.get_nowait()
            except queue.Empty:
                return out
            self._pending.discard(item[0])
            out.append(item)

    def wait_idle(self, timeout=10.0):
        """Collect until nothing is in flight (used on shutdown)."""
        out, deadline = [], time.time() + timeout
        while self._pending and time.time() < deadline:
            out.extend(self.collect())
            time.sleep(0.01)
        return out + self.collect()

    def close(self):
        self._jobs.put(None)


def make_detector(name):
    """Return detect(frame) -> [(box, landmarks or None), ...] for the chosen detector.

    "yunet" (default) is the modern OpenCV detector and also returns 5 facial
    landmarks, used to rotate faces upright before analysis. "ssd" is the
    original OpenCV ResNet-SSD (no landmarks), kept as a fallback.
    """
    if name == "yunet":
        from face_models import YuNetDetector
        yunet = YuNetDetector()
        return lambda frame: [(f["box"], f["landmarks"]) for f in yunet.detect(frame)]
    net = cv2.dnn.readNet(config.FACE_MODEL, config.FACE_PROTO)
    return lambda frame: [(b, None) for b in detect_faces(net, frame)]


def face_crop_for_analysis(frame, box, landmarks):
    """The crop the attribute models see: upright (aligned) when landmarks are known."""
    if landmarks is not None and config.ALIGN_FACES:
        from face_models import align_face
        face = align_face(frame, box, landmarks)
        if face.size:
            return face
    return crop(frame, box)


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
    ap.add_argument("--engine", choices=["mivolo", "deepface", "opencv"], default=config.ENGINE,
                    help="Age/gender engine")
    ap.add_argument("--emotion", choices=["hsemotion", "engine"], default=config.EMOTION_BACKEND,
                    help="Emotion model: hsemotion (default) or the engine's own")
    ap.add_argument("--detector", choices=["yunet", "ssd"], default=config.DETECTOR,
                    help="Face detector: yunet (default, with landmarks for alignment) or the original ssd")
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

    detect = make_detector(args.detector)
    analyzer = FaceAnalyzer(engine=args.engine, emotion=args.emotion)
    tracker = CentroidTracker(config.TRACK_MAX_DISAPPEARED, config.TRACK_MAX_DISTANCE)
    store = None if args.no_db else storage.get_store()

    # Optional same-day face re-identification (opt-in). Stops the same person
    # being counted twice if they leave and return the same day. Embeddings are
    # held in memory only and cleared at date rollover — nothing biometric is
    # written to disk.
    reid = embed = None
    if args.reid or config.REID_ENABLED:
        if config.REID_MODEL.lower() == "sface":
            if args.detector != "yunet":
                print("Re-ID with SFace needs the YuNet detector (its landmarks); continuing without re-ID.")
            else:
                from face_models import SFaceEmbedder
                sface = SFaceEmbedder()
                embed = lambda frame, box, landmarks, face: (  # noqa: E731
                    sface.embed(frame, box, landmarks) if landmarks is not None else None)
        elif analyzer.engine != "deepface":
            print(f"Re-ID with {config.REID_MODEL} needs the DeepFace engine; continuing without re-ID.")
        else:
            embed = lambda frame, box, landmarks, face: analyzer.embed(face)  # noqa: E731
        if embed is not None:
            from reid import ReIDGallery
            reid = ReIDGallery(config.REID_THRESHOLD)
            print(f"Re-ID on (model={config.REID_MODEL}, cosine threshold={config.REID_THRESHOLD}). "
                  "Same-day returning visitors won't be double-counted.")

    print("Loading models...")
    analyzer.warm_up(with_embedding=reid is not None and config.REID_MODEL.lower() != "sface")

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

    analysis = AnalysisWorker(analyzer, embed)
    leaving = {}             # tracks that left the frame, waiting on an in-flight analysis
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

    def apply_result(track, result, embedding):
        if result:
            track.add_sample(*result)
            # Gender/age shown as the running majority (stable), emotion as it is now.
            last_label[track.id] = f"{mode(track.samples['gender'])}, {mode(track.samples['age'])}, {result[2]}"
        if embedding is not None:
            track.embeddings.append(embedding)

    def finish(track):
        if track.id not in counted and track.sample_count > 0:
            persist(track)
            counted.add(track.id)

    print("Pipeline running. Press 'q' to quit.")
    started = time.time()
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
            detections = [(tuple(int(v / scale) for v in box), None if lm is None else lm / scale)
                          for box, lm in detect(det_frame)]
            boxes = [box for box, _ in detections]
            landmarks_by_box = dict(detections)

            tracks = tracker.update(boxes)

            # Results of background analyses go back to their tracks.
            for track_id, result, embedding in analysis.collect():
                t = tracks.get(track_id) or leaving.get(track_id)
                if t is not None:
                    apply_result(t, result, embedding)

            # Amortised analysis: only some frames, only tracks still gathering samples.
            if frame_idx % config.ANALYZE_EVERY_N_FRAMES == 0:
                for t in tracks.values():
                    # Skip tracks not seen this frame: their box is where the face *was*.
                    if t.disappeared == 0 and t.sample_count < config.MAX_SAMPLES_PER_TRACK \
                            and not analysis.pending(t.id):
                        lm = landmarks_by_box.get(t.bbox)
                        # Every sample also gets a re-ID embedding; the track averages them.
                        analysis.submit(t.id, face_crop_for_analysis(frame, t.bbox, lm), frame, t.bbox, lm,
                                        want_embedding=reid is not None)

            # Persist a visitor once they have enough samples (prompt, deduped).
            for t in tracks.values():
                if t.id not in counted and t.sample_count >= config.MAX_SAMPLES_PER_TRACK:
                    persist(t)
                    counted.add(t.id)

            # Persist anyone who left without reaching the sample target, once any
            # analysis still running for them has come back.
            for t in tracker.drain_finalised():
                leaving[t.id] = t
            for track_id, t in list(leaving.items()):
                if not analysis.pending(track_id):
                    del leaving[track_id]
                    finish(t)

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
        # Flush any still-tracked visitors, after in-flight analyses finish.
        remaining = {t.id: t for t in tracker.flush_all()}
        remaining.update(leaving)
        for track_id, result, embedding in analysis.wait_idle():
            if track_id in remaining:
                apply_result(remaining[track_id], result, embedding)
        for t in remaining.values():
            finish(t)
        analysis.close()
        stream.release()
        if live:
            live.close()
        cv2.destroyAllWindows()
        elapsed = max(time.time() - started, 1e-6)
        print(f"Done. Total unique visitors counted: {visitors} "
              f"({frame_idx} frames in {elapsed:.0f}s, {frame_idx / elapsed:.1f} fps)")


if __name__ == "__main__":
    main()

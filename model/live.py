"""Live link from a camera's pipeline to the FaceSense server.

Keeps a WebSocket open to the server's /ws/agent endpoint (authenticated with the
same API key as /api/ingest) and uses it to:
  - announce the camera, so the dashboard can show it as online with its FPS;
  - send events, e.g. "returning_visitor" when same-day re-ID suppresses a count;
  - stream the annotated preview, only if this camera allows it AND someone on
    the dashboard is watching. Frames are JPEG-encoded, relayed live by the
    server and never stored.

Everything runs on a background thread and reconnects with backoff, so a flaky
network (or a server without WebSocket support) never slows the pipeline down:
readings still go through storage.py as before.
"""
import json
import queue
import threading
import time

import cv2

STATUS_EVERY_SEC = 5.0
JPEG_QUALITY = 70


class LiveLink:
    def __init__(self, url, api_key, camera_id, camera_name,
                 preview_allowed=False, preview_fps=8.0, preview_width=640):
        self.url = url
        self.api_key = api_key
        self.camera_id = camera_id
        self.camera_name = camera_name
        self.preview_allowed = preview_allowed
        self.preview_interval = 1.0 / max(preview_fps, 0.5)
        self.preview_width = preview_width

        self._frame = None                     # latest annotated frame (preview)
        self._frame_seq = 0
        self._frame_lock = threading.Lock()
        self._preview_on = threading.Event()   # server says someone is watching
        self._outbox = queue.Queue(maxsize=200)
        self._status = {"fps": 0.0, "visitors": 0}
        self._stop = threading.Event()
        threading.Thread(target=self._run, name="live-link", daemon=True).start()

    # ---- Called from the pipeline loop (cheap, never blocks) ----
    @property
    def wants_frames(self):
        return self._preview_on.is_set()

    def offer_frame(self, frame):
        """Hand over the latest annotated frame; only kept while previewing."""
        if not self._preview_on.is_set():
            return
        with self._frame_lock:
            self._frame = frame
            self._frame_seq += 1

    def send_event(self, kind, **fields):
        try:
            self._outbox.put_nowait({"type": "event", "kind": kind, **fields})
        except queue.Full:
            pass  # disconnected for a while; stale events aren't worth keeping

    def update_status(self, fps, visitors):
        self._status = {"fps": round(float(fps), 1), "visitors": int(visitors)}

    def close(self):
        self._stop.set()

    # ---- Background thread ----
    def _run(self):
        from websockets.sync.client import connect

        backoff, announced_failure = 1, False
        while not self._stop.is_set():
            try:
                with connect(self.url, additional_headers={"x-api-key": self.api_key},
                             open_timeout=10, max_size=2 ** 20) as ws:
                    print(f"live: connected to {self.url} as '{self.camera_name}'"
                          f"{' (preview allowed)' if self.preview_allowed else ''}")
                    backoff, announced_failure = 1, False
                    self._session(ws)
                    print("live: disconnected")
            except Exception as e:
                if not announced_failure:
                    print(f"live: can't reach {self.url} ({e}); will keep retrying in the background")
                    announced_failure = True
            self._preview_on.clear()
            self._stop.wait(backoff)
            backoff = min(backoff * 2, 30)

    def _session(self, ws):
        send_lock = threading.Lock()
        alive = threading.Event()
        alive.set()

        def send(payload):
            with send_lock:
                ws.send(payload)

        def sender():
            next_status, sent_seq = 0.0, 0
            try:
                while alive.is_set() and not self._stop.is_set():
                    while True:
                        try:
                            send(json.dumps(self._outbox.get_nowait()))
                        except queue.Empty:
                            break
                    now = time.monotonic()
                    if now >= next_status:
                        send(json.dumps({"type": "status", **self._status}))
                        next_status = now + STATUS_EVERY_SEC
                    if self._preview_on.is_set():
                        with self._frame_lock:
                            frame, seq = self._frame, self._frame_seq
                        if frame is not None and seq != sent_seq:
                            jpeg = self._encode(frame)
                            if jpeg is not None:
                                send(jpeg)
                            sent_seq = seq
                        time.sleep(self.preview_interval)
                    else:
                        time.sleep(0.1)
            except Exception:
                pass  # connection dropped; the receive loop sees it too
            finally:
                alive.clear()

        send(json.dumps({"type": "hello", "cameraId": self.camera_id,
                         "cameraName": self.camera_name, "previewAllowed": self.preview_allowed}))
        threading.Thread(target=sender, name="live-sender", daemon=True).start()
        try:
            for message in ws:
                if self._stop.is_set():
                    break
                if isinstance(message, bytes):
                    continue
                try:
                    msg = json.loads(message)
                except ValueError:
                    continue
                if msg.get("type") == "preview":
                    if msg.get("on") and self.preview_allowed:
                        self._preview_on.set()
                        print("live: preview started (someone is watching)")
                    else:
                        self._preview_on.clear()
                        with self._frame_lock:
                            self._frame = None
                        print("live: preview stopped")
        finally:
            alive.clear()

    def _encode(self, frame):
        h, w = frame.shape[:2]
        if self.preview_width and w > self.preview_width:
            frame = cv2.resize(frame, (self.preview_width, int(h * self.preview_width / w)),
                               interpolation=cv2.INTER_AREA)
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        return buf.tobytes() if ok else None

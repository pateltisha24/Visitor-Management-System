import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL } from "../api";

// WebSocket URL for a server path, derived from the API base URL
// (http://host:5050 -> ws://host:5050/ws/dashboard; "" -> same origin).
export function wsUrl(path) {
  const base = API_URL || window.location.origin;
  return base.replace(/^http/, "ws") + path;
}

const MAX_ATTEMPTS_BEFORE_UNAVAILABLE = 3;

// Live connection to the server's realtime gateway (server/utils/realtime.js).
//
// status: "off" | "connecting" | "live" | "unavailable". "unavailable" means the
// server has no realtime support (e.g. deployed on Vercel) or rejected the token;
// the dashboard then keeps polling as before, and we keep retrying slowly.
//
// subscribe(fn)       -> fn(msg) for every JSON message ("reading", "event", ...)
// subscribeFrames(fn) -> fn(blob) for every JPEG preview frame
// setPreview(id|null) -> start/stop watching a camera's annotated feed
export function useRealtime(enabled) {
  const [status, setStatus] = useState("off");
  const [cameras, setCameras] = useState([]);
  const wsRef = useRef(null);
  const previewCam = useRef(null);
  const listeners = useRef(new Set());
  const frameListeners = useRef(new Set());

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const subscribeFrames = useCallback((fn) => {
    frameListeners.current.add(fn);
    return () => frameListeners.current.delete(fn);
  }, []);

  const setPreview = useCallback((cameraId) => {
    previewCam.current = cameraId || null;
    send({ type: "preview", cameraId: previewCam.current });
  }, [send]);

  useEffect(() => {
    if (!enabled) { setStatus("off"); setCameras([]); return undefined; }
    let ws, retry, attempts = 0, disposed = false;

    const connect = () => {
      setStatus((s) => (s === "unavailable" ? s : "connecting"));
      ws = new WebSocket(wsUrl("/ws/dashboard"));
      ws.binaryType = "blob";
      wsRef.current = ws;

      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token: localStorage.getItem("token") }));
      ws.onmessage = (e) => {
        if (typeof e.data !== "string") {
          frameListeners.current.forEach((fn) => fn(e.data));
          return;
        }
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type === "ready") {
          attempts = 0;
          setStatus("live");
          if (previewCam.current) ws.send(JSON.stringify({ type: "preview", cameraId: previewCam.current }));
        } else if (msg.type === "cameras") {
          setCameras(msg.cameras || []);
        }
        listeners.current.forEach((fn) => fn(msg));
      };
      ws.onclose = () => {
        if (disposed) return;
        setCameras([]);
        attempts += 1;
        if (attempts >= MAX_ATTEMPTS_BEFORE_UNAVAILABLE) setStatus("unavailable");
        retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** attempts));
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      ws?.close();
      wsRef.current = null;
    };
  }, [enabled]);

  return { status, cameras, subscribe, subscribeFrames, setPreview };
}

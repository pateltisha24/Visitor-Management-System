// Realtime gateway: pushes new readings to open dashboards the moment they're
// ingested, and relays the opt-in live camera preview from the CV pipeline.
//
// Two WebSocket endpoints share the HTTP server:
//   /ws/agent      the Python pipeline (one connection per camera), authenticated
//                  by the same x-api-key header as /api/ingest.
//   /ws/dashboard  browsers. The first message must be {type:"auth", token} with
//                  the user's JWT (browsers can't set headers on a WebSocket, and a
//                  token in the URL would end up in proxy logs).
//
// Protocol (JSON text frames unless noted):
//   agent -> server      {type:"hello", cameraId, cameraName, previewAllowed}
//                        {type:"status", fps, visitors}
//                        {type:"event", kind, ...}           e.g. kind "returning_visitor"
//                        <binary JPEG>                        one annotated preview frame
//   server -> agent      {type:"preview", on}                 start/stop sending frames
//   dashboard -> server  {type:"auth", token} | {type:"preview", cameraId|null}
//   server -> dashboard  {type:"ready"} | {type:"cameras", cameras} | {type:"reading", reading}
//                        {type:"event", ...} | <binary JPEG of the camera being previewed>
//
// Preview frames are relayed in memory only and never stored. An agent only sends
// them while at least one dashboard is watching that camera.
//
// On serverless hosts (Vercel) there is no long-lived server, attach() is never
// called and publish() is a no-op; the dashboard falls back to polling.
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const User = require("../models/user-model");

const AUTH_TIMEOUT_MS = 5000;
const PING_INTERVAL_MS = 25000;
// Skip preview frames for a viewer whose socket is this backed up (slow network)
// rather than queueing them; the next frame will be fresher anyway.
const MAX_VIEWER_BUFFER = 1024 * 1024;

const agents = new Map();      // cameraId -> agent ws (with .camera metadata)
const dashboards = new Set();  // authenticated dashboard sockets

function send(ws, msg) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function cameraList() {
    return [...agents.values()].map(({ camera }) => ({ ...camera, online: true }));
}

function broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const ws of dashboards) if (ws.readyState === ws.OPEN) ws.send(data);
}

function viewersOf(cameraId) {
    let n = 0;
    for (const ws of dashboards) if (ws.previewCam === cameraId) n++;
    return n;
}

// Tell an agent whether anyone is watching, but only when that changes.
function syncPreview(cameraId) {
    const agent = agents.get(cameraId);
    if (!agent) return;
    const on = agent.camera.previewAllowed && viewersOf(cameraId) > 0;
    if (on !== agent.previewOn) {
        agent.previewOn = on;
        send(agent, { type: "preview", on });
    }
}

// Called by the ingest controller (and anything else that writes readings).
function publish(msg) {
    broadcast(msg);
}

function handleAgent(ws) {
    ws.on("message", (data, isBinary) => {
        if (isBinary) {
            const cameraId = ws.camera?.cameraId;
            if (!cameraId) return;
            for (const viewer of dashboards) {
                if (viewer.previewCam === cameraId && viewer.readyState === viewer.OPEN
                    && viewer.bufferedAmount < MAX_VIEWER_BUFFER) {
                    viewer.send(data, { binary: true });
                }
            }
            return;
        }
        let msg;
        try { msg = JSON.parse(data.toString()); } catch { return; }

        if (msg.type === "hello" && typeof msg.cameraId === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(msg.cameraId)) {
            // A reconnecting camera replaces its stale connection.
            const existing = agents.get(msg.cameraId);
            if (existing && existing !== ws) existing.terminate();
            ws.camera = {
                cameraId: msg.cameraId,
                cameraName: String(msg.cameraName || msg.cameraId).slice(0, 80),
                previewAllowed: msg.previewAllowed === true,
                fps: null,
                visitors: 0,
                connectedAt: new Date().toISOString(),
            };
            ws.previewOn = false;
            agents.set(msg.cameraId, ws);
            broadcast({ type: "cameras", cameras: cameraList() });
            syncPreview(msg.cameraId);
        } else if (!ws.camera) {
            return; // ignore everything until the agent has said hello
        } else if (msg.type === "status") {
            if (Number.isFinite(msg.fps)) ws.camera.fps = Math.round(msg.fps * 10) / 10;
            if (Number.isFinite(msg.visitors)) ws.camera.visitors = msg.visitors;
            broadcast({ type: "cameras", cameras: cameraList() });
        } else if (msg.type === "event" && typeof msg.kind === "string") {
            const event = {
                type: "event",
                kind: msg.kind.slice(0, 40),
                cameraId: ws.camera.cameraId,
                cameraName: ws.camera.cameraName,
                at: new Date().toISOString(),
            };
            // Optional visitor attributes (on "visitor_counted").
            for (const key of ["age", "gender", "emotion"]) {
                if (typeof msg[key] === "string") event[key] = msg[key].slice(0, 20);
            }
            broadcast(event);
        }
    });

    ws.on("close", () => {
        const id = ws.camera?.cameraId;
        if (id && agents.get(id) === ws) {
            agents.delete(id);
            broadcast({ type: "cameras", cameras: cameraList() });
        }
    });
}

async function verifyDashboardToken(token) {
    if (typeof token !== "string" || !token) return null;
    try {
        const { email } = jwt.verify(token, process.env.JWT_SECRET_KEY);
        return await User.exists({ email });
    } catch {
        return null;
    }
}

function handleDashboard(ws) {
    const authTimer = setTimeout(() => ws.close(4001, "auth timeout"), AUTH_TIMEOUT_MS);

    ws.on("message", async (data, isBinary) => {
        if (isBinary) return;
        let msg;
        try { msg = JSON.parse(data.toString()); } catch { return; }

        if (!ws.authed) {
            if (msg.type !== "auth") return;
            const ok = await verifyDashboardToken(msg.token);
            clearTimeout(authTimer);
            if (!ok) return ws.close(4003, "unauthorized");
            ws.authed = true;
            ws.previewCam = null;
            dashboards.add(ws);
            send(ws, { type: "ready" });
            send(ws, { type: "cameras", cameras: cameraList() });
            return;
        }

        if (msg.type === "preview") {
            const prev = ws.previewCam;
            ws.previewCam = typeof msg.cameraId === "string" ? msg.cameraId : null;
            if (prev && prev !== ws.previewCam) syncPreview(prev);
            if (ws.previewCam) syncPreview(ws.previewCam);
        }
    });

    ws.on("close", () => {
        clearTimeout(authTimer);
        dashboards.delete(ws);
        if (ws.previewCam) syncPreview(ws.previewCam);
    });
}

function attach(server) {
    // maxPayload bounds a single preview frame (a 640px JPEG is ~30-60 KB).
    const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });

    server.on("upgrade", (req, socket, head) => {
        const { pathname } = new URL(req.url, "http://localhost");
        if (pathname === "/ws/agent") {
            const expected = process.env.INGEST_API_KEY;
            if (!expected || req.headers["x-api-key"] !== expected) {
                socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
                return socket.destroy();
            }
            wss.handleUpgrade(req, socket, head, (ws) => { wss.emit("connection", ws, req); handleAgent(ws); });
        } else if (pathname === "/ws/dashboard") {
            wss.handleUpgrade(req, socket, head, (ws) => { wss.emit("connection", ws, req); handleDashboard(ws); });
        } else {
            socket.destroy();
        }
    });

    // Heartbeat: drop dead connections, and keep idle ones alive through proxies
    // that close quiet sockets after ~60s.
    wss.on("connection", (ws) => {
        ws.isAlive = true;
        ws.on("pong", () => { ws.isAlive = true; });
        ws.on("error", () => {});
    });
    const timer = setInterval(() => {
        for (const ws of wss.clients) {
            if (!ws.isAlive) { ws.terminate(); continue; }
            ws.isAlive = false;
            ws.ping();
        }
    }, PING_INTERVAL_MS);
    timer.unref();
    wss.on("close", () => clearInterval(timer));

    return wss;
}

module.exports = { attach, publish, cameraList };

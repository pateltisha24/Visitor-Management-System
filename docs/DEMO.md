# FaceSense — Live demo runbook

How to run the end-to-end demo described in [PRODUCT_PLAN.md §4](PRODUCT_PLAN.md#4-phase-1--live-demo-see-it-work-end-to-end):
a live camera feed with face labels **inside the dashboard**, visitor counts that
update within a couple of seconds, a "returning visitor" moment, and a second
camera that fills the charts, all screen-shared from a browser on a laptop
that has nothing installed.

```
  Phone (camera) ──► Personal Mac ──HTTPS/WSS──► API (always-on host) ──► Dashboard in a browser ──► screen-share
                     runs the pipeline                                    (company laptop)
                     × 2 cameras
```

---

## 1. One-time: deploy the API somewhere always-on

The live parts (instant updates, camera status, video preview) use WebSockets,
which Vercel's serverless functions can't hold open. Run the API as a normal
long-running process instead. The dashboard can stay on Vercel.

**Railway** (simplest): New project → *Deploy from GitHub repo* → set the service's
**root directory** to `server` (it builds `server/Dockerfile`) → add the variables below
→ *Settings → Networking → Generate domain*.
**Render** works the same way (Web Service, root directory `server`, Docker). Use a
paid instance: free instances sleep, and a 30-second cold start mid-demo is worse
than no realtime at all.

| Variable | Value |
|---|---|
| `MONGODB_URI` | your Atlas connection string (Atlas → Network Access must allow the host) |
| `JWT_SECRET_KEY` | same value as today, so existing logins keep working |
| `INGEST_API_KEY` | a long random string, e.g. `openssl rand -hex 32`; the pipeline uses the same one |
| `CLIENT_URL` | the dashboard's URL, e.g. `https://facesense.vercel.app` |
| `GROQ_API_KEY`, `AI_ENC_SECRET` | as in `SETUP.md` (AI summary) |
| `DEMO_SEED_REFRESH` | `true` keeps the demo account's sample data relative to today |

Then point the dashboard at it: in the **client** Vercel project set
`VITE_API_URL=https://<your-api-domain>` and redeploy.

✅ Check: log in to the dashboard. The subtitle under "Visitor analytics" ends in
**"· realtime"**. If it says "polling every 10s", the browser can't reach
`wss://<api>/ws/dashboard`; see Troubleshooting.

> Phase 1 is still single-tenant: every account sees every reading. For the demo,
> register a fresh account with a store-like organisation name (sample mode is
> off by default for non-demo accounts).

## 2. One-time: set up the Mac

```bash
cd model
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Create `model/.env`:

```bash
VMS_STORAGE=http
VMS_INGEST_URL=https://<your-api-domain>/api/ingest
VMS_INGEST_API_KEY=<same INGEST_API_KEY as the server>
VMS_ENGINE=deepface
```

**Download the models at home, not on demo day.** The first DeepFace run downloads
about 1.2 GB of weights. This fetches everything (including the re-ID model) while it
prints "Loading models..."; once the camera window opens, press `q`:

```bash
python pipeline.py --reid --no-db --no-live
```

The pipeline warms the models up at every start, so the first visitor isn't delayed.
On demo day, wait for **"Pipeline running"** before you start presenting.

macOS will ask for camera access for your terminal app the first time; allow it
(System Settings → Privacy & Security → Camera).

## 3. The live camera (phone)

- **iPhone + Mac (easiest):** Continuity Camera makes the iPhone a normal webcam
  (same Apple ID, Wi-Fi and Bluetooth on, phone locked in landscape on a stand).
  Find its index:
  ```bash
  python pipeline.py --list-devices
  ```
  then use `--device <index>`.
- **Android:** install an IP-camera app, start its server, and use the stream URL it
  shows: `--source rtsp --rtsp-url <url>` (OpenCV opens `rtsp://` and `http://` MJPEG
  URLs). The phone and Mac must be on the same network. Library Wi-Fi often blocks
  device-to-device traffic, so put the Mac on the phone's hotspot.
- **Fallback:** the Mac's own camera, `--device 0`.

Lighting matters more than anything else: light in front of you, camera at eye level,
face filling about a third of the frame.

## 4. The recorded "Store entrance" camera

A 1–3 minute clip of people walking toward a camera, with faces mostly frontal and
reasonably large (the current detector misses small, overhead faces). Use footage you
recorded with people who agreed, or a stock clip whose license allows it.

Play it at real speed so it behaves like a live camera (`--realtime`). Avoid `--loop`
for the demo: a looped clip counts the same people again.

## 5. Demo-day commands

Two terminals on the Mac, both from `model/` with the venv active:

```bash
python pipeline.py --profile demo --reid --device 1 --camera-name "Front desk" --allow-preview --no-show
```

```bash
python pipeline.py --profile demo --source file --file entrance.mp4 --realtime --camera-name "Store entrance" --allow-preview --no-show
```

Each prints `live: connected ... (preview allowed)`. When the dashboard opens a camera,
that camera prints `live: preview started`.

- `--profile demo` makes a visitor land in about 1–2 s (fewer samples per face).
- `--reid` gives the "returning visitor, not double-counted" moment. Keep it on the
  Front desk only.
- If the Mac struggles running two DeepFace processes, add `--engine opencv` to the
  Store entrance command (lighter, slightly less accurate).

## 6. Run sheet

**T-60 min:** set up in the room. Join the room's Wi-Fi (or the phone hotspot). Start
both pipelines. On the company laptop, open the dashboard, log in, confirm
"· realtime" and both cameras online. Do one full run-through.

**T-10 min:** notifications off on all devices; phone plugged in; close other apps on the
Mac. Open the dashboard tab you'll share, set **Today**, click **Start fresh** (counts
only visitors from now on; nothing is deleted).

**On screen:** live view on **Front desk**, cameras chips visible.

**Script** (about 6 min, see the plan §4.2 for talking points):

1. Empty dashboard, "Counting since …".
2. Look at the phone: box and label appear, smile and the label changes; **Total visitors 1**.
3. Step out of frame for ~3 s, come back: Activity shows **Returning visitor, not double-counted**.
4. Click the **Store entrance** chip: counts climb, charts fill. Use the **camera filter** to
   compare cameras.
5. **AI summary → Generate.**
6. Privacy slide, then what's next (Phases 2–3).

## 7. Fallbacks

| If… | Do this |
|---|---|
| The phone camera fails | Switch to the Store entrance camera; the story still works |
| Realtime is down ("polling every 10s") | Everything still updates, just every 10 s; carry on |
| The Mac or network dies | Click **Sample data** for the full dashboard, then play your screen recording of a rehearsal |
| Screen-share is choppy | That's the call; the preview is deliberately light (≈8 fps, 640 px) |

Record one complete rehearsal (QuickTime → New Screen Recording) as the last-resort backup.

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Subtitle says "polling every 10s" | The API isn't long-running (still on Vercel?), or `VITE_API_URL` points elsewhere. Open the browser console; a failed `wss://…/ws/dashboard` names the host it tried |
| "No cameras online" | Pipeline not running, or it printed `live: can't reach …`: check `VMS_INGEST_URL` and that `VMS_INGEST_API_KEY` matches the server |
| Camera online but "Preview is off" | Start that pipeline with `--allow-preview` |
| `save failed: 401` | API key mismatch between `model/.env` and the server |
| Faces boxed but never counted | Too few samples: hold still a moment, improve lighting, or move closer |
| Everyone counted twice after stepping out | Add `--reid` (DeepFace engine only) |
| "Could not open video source" | Wrong `--device` index (`--list-devices`), or the IP-camera URL isn't reachable from the Mac |

## 9. Rehearse entirely on the Mac (no cloud)

```bash
cd server && npm install && npm run dev
```

```bash
cd client && npm install && npm run dev
```

With `VMS_INGEST_URL=http://localhost:5050/api/ingest` (and the server's `.env` using
`PORT=5050`), everything runs locally: the client defaults to `http://localhost:5050`
in development.

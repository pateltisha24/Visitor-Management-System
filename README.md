# FaceSense — Visitor Intelligence

**Real-time, privacy-first visitor analytics for physical spaces.** FaceSense turns any
camera (a webcam or an existing CCTV/RTSP stream) into a stream of **anonymous** insight —
**age band, gender and emotion** — plus whether visitors arrive alone or in groups. Those
readings are aggregated and streamed to a live web dashboard so retail stores, events and
venues can understand *who* is visiting, *when*, and *how they feel* — without ever
identifying or storing a single face.

> It performs **anonymous demographic + sentiment analysis** from video. It does **not**
> recognise, match, or remember individuals, and it stores **no images**.

---

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Deployment (Render)](#deployment-render)
- [Scaling & production notes](#scaling--production-notes)
- [Privacy](#privacy)
- [Testing](#testing)
- [Goals & scope](#goals--scope)
- [Roadmap](#roadmap)

---

## What it does

**Marketing site**

- A polished, responsive landing experience (Home / About / Contact / Privacy) with a
light editorial design system, dark-mode support, and a one-click **Live demo**.

**Live analytics dashboard**

- KPI cards — total visitors, individuals-vs-groups, gender split, top age group — with
**period-over-period deltas** (▲/▼ vs the previous equal-length window).
- **Highlight tiles** — peak hour, happiest hour, and a sentiment **mood index**.
- **Auto-insights** — plain-English, rule-based takeaways from the current view.
- **AI summary (BYOK)** — a natural-language read of the data via the **Vercel AI SDK**,
defaulting to **Groq** (free tier) and supporting **OpenAI, Anthropic and OpenRouter**
with the user's own key.
- **Anomaly flagging** — z-score / doubling detection on footfall and negative sentiment.
- **Charts** — gender × age bar, emotion mix, individuals-vs-groups, emotions-over-time
area, and an age × emotion heatmap (all themed, all server-aggregated).
- **Live updates** via client-side polling, **date-range presets**, **cross-filtering**
(gender / group type), **CSV export**, and a **sample-data** mode for instant exploration.
- **Settings** — profile, timezone, password change, and BYOK AI configuration.

**Computer-vision pipeline**

- Detects and tracks faces in real time and estimates age / gender / emotion, writing one
aggregated reading per unique visitor to MongoDB (a true footfall count).

## Architecture

Three independent layers integrated **only through a shared MongoDB Atlas database** — the
CV layer never calls the web server directly (though it *can* push over HTTP; see ingestion).

```
  Camera / video file                 MongoDB Atlas                   Browser
 ┌────────────────────┐  inserts   ┌────────────────┐    reads     ┌──────────────┐
 │ Python CV pipeline │ ─────────▶  │  client1       │ ◀─────────── │ React        │
 │ (model/*.py)       │            │  collection    │   via API    │ dashboard    │
 └────────────────────┘            └────────────────┘              └──────────────┘
        │  (optional)                      ▲                              │
        │  POST /api/ingest                │ Mongoose          GET /api/… │
        └──────────────────────────▶ Express API ◀────────────────────────┘
```

- `**model/**` — Python CV pipeline: **YuNet** face detection + a centroid tracker,
**MiVOLO v2** age/gender, **HSEmotion** expressions and **SFace** same-day re-ID, all run with
OpenCV and ONNX Runtime (no TensorFlow). Chosen by measured accuracy: see
[docs/MODEL_AUDIT.md](docs/MODEL_AUDIT.md). The older DeepFace and OpenCV/Keras engines remain
as options. **Runs on the machine attached to the camera**, not on the server.
- `**server/`** — Node/Express + Mongoose API: JWT/bcrypt auth, analytics aggregation,
BYOK AI, contact form, machine-to-machine ingestion, a realtime WebSocket gateway and an
in-process daily rollup.
- `**client/**` — React + Vite dashboard (Recharts), Tailwind + a shadcn-style token
theme, Framer Motion. Built into the server's Docker image and served on the same URL.

**Data flow:** the CV pipeline writes aggregated readings to the `client1` collection (directly,
or via the authenticated `POST /api/ingest`). The server pushes new readings to open dashboards
over WebSockets (polling is the fallback) and runs MongoDB aggregation pipelines for the summaries.

## Tech stack


| Layer    | Technologies                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CV       | Python, OpenCV (YuNet, SFace), ONNX Runtime (MiVOLO, HSEmotion), NumPy, PyMongo; optional DeepFace/TensorFlow                                                                                                     |
| Backend  | Node.js, Express, Mongoose, JWT, bcryptjs, Zod, Helmet, express-rate-limit, Vercel AI SDK (`ai`, `@ai-sdk/groq` · `openai` · `anthropic`, `@openrouter/ai-sdk-provider`) |
| Frontend | React 18, Vite, React Router, Recharts, Tailwind CSS, Framer Motion, react-icons, react-toastify                                                                         |
| Data     | MongoDB Atlas                                                                                                                                                            |
| Hosting  | Render (one Docker service: dashboard + API + WebSockets), on-prem/edge machine for the CV pipeline |


## Repository layout

```
model/          Python CV pipeline
  config.py         shared config (model paths, env, tuning)
  pipeline.py       main configurable pipeline (webcam / file / RTSP)
  detect.py         minimal single-file reference (legacy engine)
  face_models.py    YuNet, MiVOLO, HSEmotion, SFace (ONNX / OpenCV)
  face_analyzer.py  age/gender/emotion engines (mivolo, deepface, opencv)
  tracker.py        centroid tracker (dedup + group detection)
  reid.py           in-memory same-day re-identification gallery
  live.py           live link to the server (status, events, preview)
  storage.py        Mongo / HTTP storage backends
  benchmark.py      accuracy benchmark on labelled datasets (docs/MODEL_AUDIT.md)
  selftest.py       offline self-check
  tools/            one-time MiVOLO -> ONNX export
  tests/            unit tests (python -m unittest discover -s tests)
  requirements.txt  (+ requirements-deepface.txt, requirements-dev.txt)

server/     Express API
  controllers/  auth, analytics, ingest, insights (AI), cron, contact
  router/        route definitions
  middlewares/   auth (JWT), api-key, validate (zod), error
  models/        user, client1 (readings), daily-rollup, contact
  validators/    zod schemas
  utils/         db, crypto (encrypts BYOK keys)

client/     React + Vite dashboard
  src/pages/        Home, About, Contact, Privacy, Login, Register, Logout,
                    Service (dashboard), Settings, Connect, Error
  src/components/   Navbar, Footer, ui/ (button, card, input, badge, theme-toggle),
                    dashboard/ (DashboardView, sampleData, theme), auth/, marketing/
  src/lib/          utils (cn), format (ranges, CSV, insights, anomalies)
  src/store/        auth context (JWT + demo session)
  src/api.js        axios/fetch client with auto-attached JWT
```

## Getting started

### 1. MongoDB

Create a free **MongoDB Atlas** cluster and a database user. The same connection string is
used by both the Python pipeline and the web server (they share one database).

### 2. Python CV pipeline (`model/`)

```bash
cd model
python3 -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                     # set MONGODB_URI (+ RTSP_URL for CCTV)
python pipeline.py                                       # webcam → analyse + write to MongoDB
```

YuNet, HSEmotion and SFace download on first run (checksum-verified, into
`~/.facesense/models`). MiVOLO is exported once to ONNX: follow the steps in
[`tools/export_mivolo.py`](model/tools/export_mivolo.py) (a throwaway environment with
PyTorch; the pipeline itself never needs it). Check everything with `python selftest.py`.

Other modes:

```bash
python pipeline.py --source file --file clip.mp4         # a video file
python pipeline.py --source rtsp --rtsp-url rtsp://user:pass@ip:554/stream
python pipeline.py --no-db                               # display only, don't persist
python pipeline.py --engine deepface                     # older engine (pip install -r requirements-deepface.txt)
```

**How it's fast.** Faces are detected and tracked every frame (cheap), but the heavier
age/gender/emotion analysis runs on a background thread, only every Nth frame and only until
each tracked face has enough samples — so video, tracking and the live preview stay at camera
speed (25 FPS in testing) while every visitor still gets analysed. Each unique visitor is written **once** (the modal prediction).

### 3. Backend (`server/`)

```bash
cd server
npm install
cp .env.example .env          # set MONGODB_URI, JWT_SECRET_KEY (+ GROQ_API_KEY for AI)
npm run dev                   # http://localhost:5050  (5000 clashes with macOS AirPlay)
```

### 4. Frontend (`client/`)

```bash
cd client
npm install
cp .env.example .env.development   # set VITE_API_URL=http://localhost:5050
npm run dev                        # http://localhost:5173
```

See **[SETUP.md](SETUP.md)** for creating a Groq key and wiring Google OAuth.

## Environment variables

**Server (`server/.env`)**


| Var              | Purpose                                                   |
| ---------------- | --------------------------------------------------------- |
| `MONGODB_URI`    | Atlas connection string (shared with the CV pipeline)     |
| `JWT_SECRET_KEY` | Secret for signing/verifying JWTs                         |
| `PORT`           | Local dev port (default 5000; use 5050 on macOS)          |
| `CLIENT_URL`     | Comma-separated allowed CORS origins in production        |
| `GROQ_API_KEY`   | Default AI provider key (Groq free tier)                  |
| `AI_ENC_SECRET`  | Encrypts users' stored BYOK keys at rest                  |
| `INGEST_API_KEY` | Shared secret for `POST /api/ingest`                      |
| `RETENTION_DAYS` | If set, raw readings auto-expire after N days (TTL index) |


**Client (`client/.env.`*)** — `VITE_API_URL`, only for local dev (production serves the
dashboard from the API's own origin).

**CV pipeline (`model/.env`)** — `MONGODB_URI`, `RTSP_URL`, and optional tuning
(`VMS_ENGINE`, `VMS_ANALYZE_EVERY`, `VMS_STORAGE`, `VMS_INGEST_URL`, `VMS_INGEST_API_KEY`).

Real secrets live only in local `.env` files (git-ignored); `*.env.example` document the keys.

## Deployment (Render)

Production is a single Render web service built from the root [`Dockerfile`](Dockerfile): it
builds the dashboard and serves it from the API, so one URL carries the dashboard, the REST
API and the realtime WebSockets, and the same process runs the daily rollup. Render rebuilds
on every push to `main`. Step-by-step settings and environment variables are in
[docs/DEMO.md](docs/DEMO.md).

## Scaling & production notes

- **Indexes** — `client1.Date` (range filtering) and `Timestamp`; `org_users.email` unique.
- **Retention / rollups** — optional TTL index (`RETENTION_DAYS`) bounds raw-row storage on
the free tier; a daily pre-aggregation (`daily_rollups`) keeps history cheap to query.
- **Security** — Helmet headers, rate limiting (stricter on auth), Zod validation on all
external input, bcrypt password hashing, and encrypted-at-rest BYOK keys. *Trade-off:*
JWT-in-localStorage is simple but XSS-exposed; now that the dashboard and API share an origin,
an httpOnly cookie would be the safer next step.
- **Single instance** — the realtime gateway and rate-limit counters live in process memory,
which is right for one instance; running several would need a shared pub/sub and store (e.g. Redis).

## Privacy

FaceSense is **private by design**: no recognition, **on-edge inference** (video stays on the
camera machine, except a camera's optional live preview, which is relayed to signed-in viewers
while they watch and never recorded), **anonymous readings only**, and **no images or biometric
templates stored** (same-day re-ID, on by default and switchable off, keeps face embeddings in memory and wipes them daily; a return is stored only as a time and camera). Because no personal data is collected, it helps stay aligned with regulations such
as GDPR. See the in-app `/privacy` page.

## Testing

```bash
cd client && npm test     # vitest — analytics helpers (ranges, deltas, insights, anomalies)
cd server && npm test     # node:test — validators, crypto, api-key middleware, realtime gateway
cd model && python -m unittest discover -s tests   # tracker, re-ID, background analysis, preprocessing
cd model && python benchmark.py ...                # model accuracy on labelled datasets (docs/MODEL_AUDIT.md)
```

## Goals & scope

**Goal** — take a working internship proof-of-concept to a near-production, demoable product:
correct and secure auth, a genuinely useful and beautiful analytics dashboard, a robust and
explainable CV pipeline, and the "senior" cross-cutting concerns (indexing, retention,
security, tests, code-splitting) — all deployable on a free tier.

**In scope** — single shared workspace, anonymous analytics, BYOK AI insights, one camera
per workspace, multiple cameras, a single-container deployment.

**Intentionally out of scope** — multi-tenant data isolation, billing, horizontal scaling,
and on-device mobile inference.

## Roadmap

- Google OAuth sign-in (see [SETUP.md](SETUP.md) for the outline).
- Richer tracking (re-ID across cameras) and multi-camera support.
- Scheduled email/Slack digests built on the rollup data.
- Configurable alert thresholds for the anomaly detector.

---

*Built as an applied computer-vision + full-stack project. Anonymous analytics — no faces stored.*
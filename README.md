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
- [API reference](#api-reference)
- [The data model](#the-data-model)
- [Deployment (Vercel)](#deployment-vercel)
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

- `**model/**` — Python CV pipeline. OpenCV SSD face detector + a centroid tracker, with
age/gender/emotion analysis via **DeepFace** (modern pretrained models) or a lightweight
legacy OpenCV/Keras engine. **Runs on the machine attached to the camera** — not on Vercel.
- `**server/`** — Node/Express + Mongoose API: JWT/bcrypt auth, analytics aggregation,
BYOK AI, contact form, machine-to-machine ingestion, and a scheduled rollup endpoint.
- `**client/**` — React + Vite dashboard (Recharts), Tailwind + a shadcn-style token
theme, Framer Motion. Deployable to Vercel.

**Data flow:** the CV pipeline writes aggregated readings to the `client1` collection (directly,
or via the authenticated `POST /api/ingest`). The dashboard polls the Express API, which runs
MongoDB aggregation pipelines and returns ready-to-render summaries.

## Tech stack


| Layer    | Technologies                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CV       | Python, OpenCV (DNN/SSD), DeepFace, TensorFlow/Keras, NumPy, PyMongo                                                                                                     |
| Backend  | Node.js, Express, Mongoose, JWT, bcryptjs, Zod, Helmet, express-rate-limit, Vercel AI SDK (`ai`, `@ai-sdk/groq` · `openai` · `anthropic`, `@openrouter/ai-sdk-provider`) |
| Frontend | React 18, Vite, React Router, Recharts, Tailwind CSS, Framer Motion, react-icons, react-toastify                                                                         |
| Data     | MongoDB Atlas                                                                                                                                                            |
| Hosting  | Vercel (client + server), on-prem/edge machine for the CV pipeline                                                                                                       |


## Repository layout

```
model/          Python CV pipeline
  config.py         shared config (model paths, env, tuning)
  pipeline.py       main configurable pipeline (webcam / file / RTSP)
  detect.py         minimal single-file reference (legacy engine)
  face_analyzer.py  DeepFace + legacy OpenCV analysis engines
  tracker.py        centroid tracker (dedup + group detection)
  storage.py        Mongo / HTTP storage backends
  selftest.py       offline self-check
  requirements.txt

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

Other modes:

```bash
python pipeline.py --source file --file clip.mp4         # a video file
python pipeline.py --source rtsp --rtsp-url rtsp://user:pass@ip:554/stream
python pipeline.py --no-db                               # display only, don't persist
python pipeline.py --engine opencv                       # lightweight legacy engine
```

**How it's fast.** Faces are detected and tracked every frame (cheap), but the heavier
age/gender/emotion analysis runs only every Nth frame and only until each tracked face has
enough samples — keeping the live frame rate high (25+ FPS on typical hardware) while every
visitor still gets analysed. Each unique visitor is written **once** (the modal prediction).

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
| `CRON_SECRET`    | Auth for the Vercel Cron rollup endpoint                  |


**Client (`client/.env.`*)** — `VITE_API_URL` (backend base URL).

**CV pipeline (`model/.env`)** — `MONGODB_URI`, `RTSP_URL`, and optional tuning
(`VMS_ENGINE`, `VMS_ANALYZE_EVERY`, `VMS_STORAGE`, `VMS_INGEST_URL`, `VMS_INGEST_API_KEY`).

Real secrets live only in local `.env` files (git-ignored); `*.env.example` document the keys.

## Scaling & production notes

- **Indexes** — `client1.Date` (range filtering) and `Timestamp`; `org_users.email` unique.
- **Retention / rollups** — optional TTL index (`RETENTION_DAYS`) bounds raw-row storage on
the free tier; a daily pre-aggregation (`daily_rollups`) keeps history cheap to query.
- **Security** — Helmet headers, rate limiting (stricter on auth), Zod validation on all
external input, bcrypt password hashing, and encrypted-at-rest BYOK keys. *Trade-off:*
JWT-in-localStorage is simple and CORS-friendly but XSS-exposed; an httpOnly cookie is safer
but trickier cross-origin on Vercel.
- **Serverless realities** — no WebSockets/Redis/long-lived workers; cold starts; function
time limits (so aggregation is kept fast). Rate-limit counters are per-instance in memory.

## Privacy

FaceSense is **private by design**: no recognition, **on-edge inference** (frames never leave
the camera machine), **anonymous aggregates only**, and **no images or biometric templates
stored**. Because no personal data is collected, it helps stay aligned with regulations such
as GDPR. See the in-app `/privacy` page.

## Testing

```bash
cd client && npm test     # vitest — analytics helpers (ranges, deltas, insights, anomalies)
cd server && npm test     # node:test — validators, crypto, api-key middleware
```

## Goals & scope

**Goal** — take a working internship proof-of-concept to a near-production, demoable product:
correct and secure auth, a genuinely useful and beautiful analytics dashboard, a robust and
explainable CV pipeline, and the "senior" cross-cutting concerns (indexing, retention,
security, tests, code-splitting) — all deployable on a free tier.

**In scope** — single shared workspace, anonymous analytics, BYOK AI insights, one camera
per deployment, Vercel-friendly architecture.

**Intentionally out of scope** — multi-tenant data isolation, billing, horizontal scaling,
and on-device mobile inference.

## Roadmap

- Google OAuth sign-in (see [SETUP.md](SETUP.md) for the outline).
- Richer tracking (re-ID across cameras) and multi-camera support.
- Scheduled email/Slack digests built on the rollup data.
- Configurable alert thresholds for the anomaly detector.

---

*Built as an applied computer-vision + full-stack project. Anonymous analytics — no faces stored.*
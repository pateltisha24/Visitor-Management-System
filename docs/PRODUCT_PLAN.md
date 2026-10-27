# FaceSense — Product Plan

Status: **draft for review** · Owner: Tisha Patel · Last updated: 2026-10-25

This plan turns FaceSense from a working personal project into a product a
business could actually install. The work is split into three phases. Phase 1 is
scoped to make a **live, end-to-end demo** possible for a remote company
presentation, and each piece it adds is designed to carry over into later phases
rather than be thrown away.

---

## 1. What FaceSense is (the product pitch)

**FaceSense turns cameras a business already has into anonymous visitor
analytics:** footfall, age and gender mix, group vs. individual visits, and
overall mood, by hour, by day, by camera, with a plain-English AI summary on top.

- **Who it's for:** small and mid-size physical spaces, such as retail stores, malls,
  cafés, museums, libraries, and event venues. Places that know their sales numbers
  but not who walks in or when.
- **Why it's different:** privacy-first by design. Video is processed **on site**,
  no images or face data leave the building, and only anonymous attribute counts are
  stored.
- **What "done" looks like for the customer:** plug in a small box (or run the agent
  on an existing PC), it finds the cameras, they confirm, and the dashboard fills in.

## 2. Where the project is today

| Area | Today | Gap to "product" |
|---|---|---|
| CV pipeline (`model/pipeline.py`) | Solid: detection every frame, centroid tracking, amortised analysis, one reading per person, optional same-day re-ID | Single camera per process, configured by CLI flags; no health reporting; readings are lost if the network drops (`HttpStore.save` raises, nothing retries) |
| Camera setup | Manual: user types an RTSP URL or webcam index | No discovery, no confirmation step, no pairing with an account |
| API (`server/`) | Auth, ingest with API key, aggregation endpoints, AI insights, daily rollup cron | **No organisations:** every reading lives in one global `client1` collection, so every logged-in user sees everyone's data. One shared ingest key. Runs on Vercel serverless, which can't hold the long-lived connections real-time needs |
| Dashboard (`client/`) | Good charts, filters, CSV export, 10-second polling "Live" mode, sample-data toggle | No cameras/sites concept, no live feed, updates lag up to 10 s |
| Data correctness | Works | Time zones are mixed: the pipeline writes the camera machine's local date/time, while `/api/ingest`'s defaults use UTC for `Date` but server-local for `Time`. Hourly charts can shift by hours |
| Repo hygiene | Reasonable | Legacy `detect.py`, unused dlib model, `client1` naming, untracked `model/.env 2` not covered by `.gitignore` |
| Sample data | `npm run seed` | Seed is relative to the day it ran (June). The dashboard defaults to "Last 7 days", so it now looks empty |

## 3. Target architecture

```
 ┌───────────── Customer site ─────────────┐            ┌──────────── Cloud ────────────┐
 │                                          │            │                               │
 │  IP cameras ──RTSP──┐                    │   HTTPS    │  API (Node/Express)           │
 │  USB/webcam ────────┤                    │  readings  │   • auth, orgs, roles         │
 │  Video file ────────┤   FaceSense        │ ─────────► │   • device pairing            │
 │                     └─► Edge Agent ──────┼────────────┤   • ingest (device tokens)    │
 │                         (Python)         │   WSS      │   • realtime gateway ◄──┐     │
 │                          • discovery     │  control + │   • analytics / insights │     │
 │                          • camera mgr    │  preview   │            │             │     │
 │                          • CV pipeline   │            │            ▼             │     │
 │                          • local buffer  │            │   MongoDB Atlas          │     │
 │                                          │            │                          │     │
 └──────────────────────────────────────────┘            └──────────────────────────┼─────┘
                                                                                    │ SSE/WSS
                                                           Dashboard (React) ───────┘
                                                           (any browser)
```

**Key principles**

1. **Video never leaves the site.** The edge agent sends only readings (JSON), plus
   an *opt-in, on-demand* low-frame-rate preview that is never stored.
2. **The agent dials out; nothing dials in.** The agent opens outbound HTTPS/WSS
   connections to the cloud, so customers never open firewall ports. The cloud sends
   commands ("discover cameras", "start preview") back down that same connection.
3. **Camera credentials stay on the edge.** The cloud stores camera *metadata*
   (name, site, status), never RTSP passwords.
4. **One reading schema, many producers.** The Python agent, the seed script, and
   any future producer (e.g. a browser camera) all emit the same `Reading` shape,
   defined once and validated on both sides.

**Hosting (decided 2026-10-27):** everything runs as one Render service (dashboard, API,
WebSockets, scheduler) and the Vercel deployment is retired. *Original note:* keep the dashboard on Vercel, move the API
to an always-on host that supports WebSockets (Railway, Render paid tier, or
Fly.io — a few dollars a month). Avoid free tiers that sleep: a 30-second cold start
in the middle of a demo is worse than polling. *(Alternative: stay on Vercel and use
a managed realtime service such as Ably or Pusher. Fewer moving parts to host, but
another vendor, and the live video preview gets awkward. Recommended: move the API.)*

### Target data model

```
Organization  { name, timezone, plan }
User          { orgId, email, role: owner | admin | viewer }
Site          { orgId, name, timezone, openingHours }
Device        { orgId, siteId, name, tokenHash, version, lastSeenAt, status }      ← an edge agent
Camera        { orgId, siteId, deviceId, name, sourceType: rtsp|usb|file,
                status: online|degraded|offline, fps, lastReadingAt, previewAllowed }
Reading       { _id (uuid from producer), orgId, siteId, cameraId, ts (UTC),
                age, gender, emotion, group, groupSize, returning?, sample? }
DailyRollup   { orgId, siteId, cameraId, date (site-local), …aggregates }
```

`Reading._id` becomes a UUID generated by the producer, which makes ingest
**idempotent**: a retried upload can't create a duplicate visitor. Hourly and daily
buckets are computed from `ts` in the **site's** time zone, which fixes the
time-zone bug at the root.

---

## 4. Phase 1 — Live demo ("see it work, end to end")

**Goal:** during a remote presentation, the audience watches a camera feed with live
face labels *inside the dashboard*, sees visitor counts and charts update within
about 2 seconds, and gets an AI summary, all from a browser on the company laptop.

### 4.1 Demo-day setup (given the constraints)

Constraints: presenting **remotely** (video call), from a **company laptop** (assume
nothing can be installed on it), in a **library study room**. The room camera mostly
sees the presenter, and the presenter has a phone and a personal Mac.

```
  Phone (camera) ──► Personal Mac ──HTTPS/WSS──► API (cloud) ──► Dashboard in browser ──► screen-share
                     runs Edge Agent                              on company laptop        to the call
                     + "Store entrance" clip
```

- **Company laptop:** only a browser. Open the deployed dashboard, logged in to a demo
  org, and screen-share it. Nothing to install and no company-policy questions.
- **Personal Mac:** runs the edge agent with two cameras:
  1. **"Front desk (live)"**: the phone pointed at the presenter. On an iPhone, macOS
     *Continuity Camera* shows up as a normal webcam with no app needed. On Android,
     use an IP-camera app (RTSP) or USB webcam mode. If the library Wi-Fi isolates
     devices, put the Mac on the phone's hotspot.
  2. **"Store entrance (recorded)"**: a short, properly licensed (or consented,
     self-recorded) clip of people walking toward a camera, played as a video source.
     This is what shows **counts climbing and charts filling**, which one person in a
     study room can't show alone.
- **Room camera:** leave it to the video call, so the audience still sees the presenter.

This turns the "only one person" limitation into a feature of the demo: two
cameras, two sites' worth of data, and a per-camera filter.

### 4.2 Demo script (about 6 minutes)

1. **Empty dashboard (0:00).** Demo org, "Today", 0 visitors. *"This is a store that
   just installed FaceSense."*
2. **Live camera (0:30).** Open the *Front desk* live preview. The presenter appears
   with a box and the label "Female, 20–30, Neutral". Smile, and the label changes to
   Happy. Visitors: **1**. The recent-visitors feed animates in.
3. **Re-identification (1:30).** Step out of frame and come back. The feed shows
   *"Returning visitor, not double-counted"* and the count stays at 1. This shows the
   system counts **people, not detections**.
4. **Scale (2:30).** Switch to *Store entrance*. Counts climb, and the gender/age,
   hourly, and mood charts fill in live.
5. **Insight (4:00).** Click **AI summary** for a plain-English narrative of what just
   happened.
6. **Privacy and architecture (4:30).** One slide: video stays on site, no images
   stored, only anonymous counts; edge → cloud → dashboard.
7. **What's next (5:30).** Phases 2 and 3: plug-and-play camera discovery and
   multi-tenant SaaS.

### 4.3 Work items

Sizes: **S** ≈ under half a day · **M** ≈ 1–2 days · **L** ≈ 3+ days (rough).

| # | Item | Size | Notes |
|---|---|---|---|
| 1.1 | **Fix sample data:** re-seed; add a "regenerate demo data" option so it never goes stale | S | Sample data becomes the fallback, not the show |
| 1.2 | **Move API to an always-on host**, with the daily rollup running as an in-process scheduled job | M | Prerequisite for 1.4 and 1.5. Keep Vercel for the client |
| 1.3 | **Camera identity on readings:** agent gets `--camera-id/--camera-name`; readings carry `cameraId`; dashboard gets a camera filter | S–M | Forward-compatible subset of the Phase 3 data model |
| 1.4 | **Real-time readings:** API pushes new readings and events to the dashboard (SSE or WebSocket); polling remains as a fallback | M | "New visitor" animation in the recent feed; "updated just now" |
| 1.5 | **Live annotated preview in the dashboard:** agent sends annotated JPEG frames (~6–8 fps, ~640 px) over WSS *only while someone is watching*; API relays to viewers in the same org | L | Never stored. Off by default per camera; switched on for the demo camera |
| 1.6 | **Re-ID visible:** when re-ID matches, the agent sends a `returning_visitor` event instead of silently dropping it | S | Today it only `print`s |
| 1.7 | **Demo tuning profile:** `VMS_PROFILE=demo` (analyse every 2nd frame, 3 samples per face, shorter disappear timeout) so a reading lands in about 1–2 s | S | Default profile unchanged for accuracy |
| 1.8 | **Demo org and "start fresh":** a demo organisation flag and a button that clears *today's demo readings only* | S | Lets you rehearse repeatedly and start the real run at 0 |
| 1.9 | **Two cameras on one machine:** run two agent processes (live and clip) | S | True multi-camera support comes in Phase 2 |
| 1.10 | **Rehearsal kit:** checklist below, plus a screen recording of a full successful run | S | The recording is the last-resort fallback |

**Status (2026-10-25):** 1.1–1.10 are implemented and tested end to end on a local
stack (in-memory DB, API, dashboard, and the pipeline on a test clip with both engines,
including re-ID). Differences from the table: 1.8 "start fresh" is a non-destructive
"count from now on" filter instead of deleting readings; the pipeline also warms its
models up at start (the first DeepFace run downloads ~1.2 GB, which would otherwise
freeze a live demo). **Still to do by hand:** deploy the API to an always-on host
(1.2) and rehearse in the real room. Both are covered in [DEMO.md](DEMO.md).

**Phase 1 exit criteria**
- From a browser on any machine: preview visible, a new person appears in the counts
  in ≤ 3 s, charts update without refreshing.
- A full run-through on the actual library Wi-Fi (or phone hotspot), screen-shared on
  a test call, with nothing installed on the presenting laptop.

### 4.4 Rehearsal checklist and fallbacks

- [ ] Test **in that study room** on the library Wi-Fi; if devices can't talk to each
      other, use the phone hotspot.
- [ ] Open the dashboard on the company laptop beforehand to check the company network
      or proxy doesn't block the domain and the browser can play the preview.
- [ ] Lighting: light in front of your face, not behind; phone at about eye level.
- [ ] Warm up the API a few minutes before (no cold starts) and press "start fresh".
- [ ] Turn off notifications on all three devices; keep the phone plugged in (camera drains battery).
- [ ] Choose a clip with faces reasonably large and mostly frontal; the current
      detector struggles with small, overhead faces (see Phase 3).
- **If the live camera fails** → switch to the recorded camera; the story still works.
- **If the agent or network fails** → toggle sample data, then play the screen recording.
- **If screen-share is laggy** → that's the call, not the product; the preview at 6–8 fps is
  deliberately light.

---

## 5. Phase 2 — Plug-and-play cameras ("it finds the camera for you")

**Goal:** a non-technical customer can install the agent, link it to their account,
and add cameras by **confirming** what was found, without typing URLs.

### 5.1 Edge agent as a service

Refactor `pipeline.py` into an agent:
- **Camera manager:** runs N cameras in one process (a worker per camera), started,
  stopped, and reconfigured from the cloud rather than CLI flags.
- **Config from cloud:** camera list and settings come from the API; local file only
  for the device token.
- **Health:** heartbeat every ~15 s with per-camera status, FPS, and last reading;
  the dashboard shows online / degraded / offline, and the API flags cameras that go quiet.
- **Offline buffer:** readings go into a local SQLite queue first and upload with
  retry and backoff. With UUID reading IDs, retries can't double-count.
- **Packaging:** Docker image (amd64 + arm64) as the primary install; a simple
  installer for Mac/Windows later. Publish a short hardware guide (which
  mini-PCs handle how many cameras on each engine).

### 5.2 Pairing (linking an agent to an account)

```
Agent starts, no token ──► POST /api/devices/pair/start ──► { code: "K7M-4QX" }
Agent shows the code (terminal / local status page)
User: Dashboard → Devices → "Add device" → types K7M-4QX → picks a site
API binds the device to the org, issues a device token
Agent (polling) receives the token, stores it locally (file mode 0600)
```

Replaces the single shared ingest API key with **one revocable token per device**.

### 5.3 Camera discovery and confirmation

```
Dashboard "Add camera" ──► API ──(WSS command)──► Agent: discover
Agent:  • ONVIF WS-Discovery on the LAN (finds most IP cameras / NVRs)
        • local devices (USB webcams, Continuity Camera)
        • manual RTSP URL as an always-available fallback
      ──► list: "Hikvision DS-2CD… at 192.168.1.40", "FaceTime HD Camera", …
User picks one, enters the camera's username/password
Agent: ONVIF GetProfiles → GetStreamUri → opens the stream → grabs a snapshot
Dashboard shows the snapshot: "Is this the right camera?"  [Confirm]  [Back]
Confirm ──► camera saved (metadata in cloud, credentials on the agent) ──► pipeline starts
```

Notes:
- Discovery relies on multicast, which corporate and guest networks often block. The
  manual RTSP path and a "scan this IP range" option cover that.
- The snapshot is shown once for confirmation and not stored.
- The preview from Phase 1 is reused for "check the camera angle".

### 5.4 Optional: browser camera (zero-install)

Any device with a browser becomes a camera by opening a link: the camera is read in
the browser and faces are analysed **in the browser** (TensorFlow.js-based face
models), so only readings are sent. Useful for free trials and quick pilots, and as
a demo fallback that needs no personal laptop. Trade-off: lower accuracy than the
Python engine, and a second model stack to maintain. **Decision needed** on whether
it's worth it.

**Phase 2 exit criteria**
- Fresh machine → agent running → paired → camera discovered and confirmed → readings
  on the dashboard, with no terminal commands after the install.
- Unplugging the network for 10 minutes loses no readings.

---

## 6. Phase 3 — Multi-tenant product and production hardening

**Goal:** many customers on one deployment, safely isolated, with the engineering
practices that make it maintainable.

### 6.1 Multi-tenancy (highest priority in this phase)
- Organisations, sites, roles (owner / admin / viewer), invitations.
- **Every query is scoped by `orgId` from the JWT,** enforced in one middleware or
  repository layer rather than per controller, with automated tests proving one org
  can never read another's data.
- Migration: `client1` → `readings` with `orgId/siteId/cameraId`, existing data
  assigned to a default org, sample data to the demo org.
- Analytics per site and camera; site opening hours and time zones drive "today" and
  the hourly charts.

### 6.2 Privacy, compliance, and responsible use
- Defaults: no images stored, embeddings in memory only (already true), configurable
  per-org retention (the TTL exists today, but globally), data export and deletion,
  audit log of who opened live previews.
- Customer kit: signage template, privacy-notice text, and a short data-protection
  summary customers can hand to their lawyers. *(This is guidance to build, not legal
  advice. Requirements differ by region, e.g. GDPR in the EU and biometric-privacy laws
  such as Illinois's BIPA.)*
- **Acceptable use:** the EU AI Act restricts emotion recognition in workplaces and
  schools, so FaceSense should be positioned for **customer** analytics, not
  employee monitoring, and the terms of service should say so.
- Be candid about model limits: age, gender, and especially emotion inference are
  imperfect and can be biased across demographics. Publishing measured accuracy
  builds more trust than hiding it.

### 6.3 Model quality

**Status (2026-10-27):** benchmark built and first audit done; detector, age/gender,
emotion and re-ID models replaced based on the results. See [MODEL_AUDIT.md](MODEL_AUDIT.md).
Remaining items below: CCTV-style footage, and person-level (body) counting.
- Build a small benchmark set of CCTV-style footage (overhead angles, small faces,
  varied lighting) and measure detection rate, count accuracy, and attribute accuracy.
- Upgrade the detector (e.g. SCRFD / RetinaFace / YOLO-face) and the tracker (e.g.
  ByteTrack-style association) based on the benchmark, not guesses.
- Report counts with the confidence the benchmark supports.

### 6.4 Engineering
- **Repo layout:** `apps/edge` (Python), `apps/api` (Node), `apps/web` (React),
  `packages/schema` (the `Reading` and event schemas in JSON Schema, generating zod
  for Node and pydantic for Python).
- **One-command local stack:** Docker Compose (Mongo, API, web, and an agent reading a
  sample clip).
- **CI (GitHub Actions):** lint, unit tests, build for all three apps, plus an
  **end-to-end test** that runs the agent on a short known clip and asserts the expected
  readings reach the API.
- Versioned API (`/api/v1`) with OpenAPI docs; structured logging; error tracking
  (e.g. Sentry); per-device rate limits.
- Cleanup: remove `detect.py` and the unused dlib model, rename `client1`, tighten
  `.gitignore` (cover `.env*` variants like `model/.env 2`), rotate any secret that
  was ever committed.

**Phase 3 exit criteria**
- Two test organisations with their own devices and cameras; automated tests prove
  isolation.
- CI is green on every PR, including the end-to-end clip test.
- Documented accuracy numbers on the benchmark set.

---

## 7. Later (deliberately out of scope)

Billing and per-camera pricing · mobile app · POS integration (visitors vs.
transactions → conversion rate) · heatmaps / dwell time / zones · alerts ("footfall
40% below normal") · NVR integrations · SSO.

## 8. Decisions and open questions

| # | Question | Why it matters | Recommendation |
|---|---|---|---|
| D1 | **When is the presentation?** | Decides how much of Phase 1 is built vs. faked with fallbacks | Build 1.1–1.8 if there's about 1–2 weeks; if less, prioritise 1.1, 1.3, 1.4, 1.6, 1.7 |
| D2 | iPhone or Android? | Continuity Camera (iPhone + Mac) is the simplest live source | Test whichever on the actual library network |
| D3 | Will the personal Mac be with you on presentation day? | It runs the agent; without it, 5.4 (browser camera) becomes the demo path | Bring it |
| D4 | API hosting: move off Vercel, or add a realtime vendor? | Real-time and preview need long-lived connections | Move the API (Railway/Render/Fly) |
| D5 | Build the browser camera (5.4)? | Second model stack to maintain | Defer unless D3 is "no" |
| D6 | Where does the recorded "store entrance" clip come from? | Must be licensed or consented footage | Record friends who agree, or use a clearly licensed stock clip |

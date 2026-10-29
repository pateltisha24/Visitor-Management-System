const { test, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const WebSocket = require("ws");

process.env.JWT_SECRET_KEY = "test-jwt";
process.env.INGEST_API_KEY = "test-ingest";

// The gateway checks the dashboard user exists; no database in unit tests.
const User = require("../models/user-model");
User.exists = async ({ email }) => (email === "a@b.com" ? { _id: 1 } : null);

const realtime = require("../utils/realtime");
const { buildFilter } = require("../controllers/analytics-controller");
const { ingestSchema } = require("../validators/ingest-validator");

let server, base;
before(async () => {
    server = http.createServer();
    realtime.attach(server);
    await new Promise((r) => server.listen(0, r));
    base = `ws://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// Collects messages so tests can await the next one matching a predicate.
function client(path, headers) {
    const ws = new WebSocket(base + path, { headers });
    const inbox = [];
    const waiters = [];
    ws.on("message", (data, isBinary) => {
        const msg = isBinary ? { binary: data } : JSON.parse(data.toString());
        const i = waiters.findIndex((w) => w.pred(msg));
        if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
        else inbox.push(msg);
    });
    ws.next = (pred, ms = 2000) => {
        const i = inbox.findIndex(pred);
        if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
        return new Promise((resolve, reject) => {
            const w = { pred, resolve };
            waiters.push(w);
            setTimeout(() => reject(new Error("timed out waiting for message")), ms);
        });
    };
    ws.opened = new Promise((resolve, reject) => { ws.on("open", resolve); ws.on("error", reject); });
    return ws;
}

async function dashboard() {
    const ws = client("/ws/dashboard");
    await ws.opened;
    ws.send(JSON.stringify({ type: "auth", token: jwt.sign({ email: "a@b.com" }, process.env.JWT_SECRET_KEY) }));
    await ws.next((m) => m.type === "ready");
    return ws;
}

test("realtime: agent without the API key is rejected", async () => {
    const ws = client("/ws/agent", { "x-api-key": "wrong" });
    await assert.rejects(ws.opened);
});

test("realtime: dashboard with a bad token is closed", async () => {
    const ws = client("/ws/dashboard");
    await ws.opened;
    ws.send(JSON.stringify({ type: "auth", token: "nope" }));
    const code = await new Promise((r) => ws.on("close", r));
    assert.strictEqual(code, 4003);
});

test("realtime: camera presence, preview on demand, frame relay, events, readings", async () => {
    const dash = await dashboard();
    const agent = client("/ws/agent", { "x-api-key": "test-ingest" });
    await agent.opened;
    agent.send(JSON.stringify({ type: "hello", cameraId: "front-desk", cameraName: "Front desk", previewAllowed: true }));

    const cams = await dash.next((m) => m.type === "cameras" && m.cameras.length === 1);
    assert.strictEqual(cams.cameras[0].cameraName, "Front desk");
    assert.strictEqual(cams.cameras[0].online, true);

    // Watching the camera asks the agent to start sending frames...
    dash.send(JSON.stringify({ type: "preview", cameraId: "front-desk" }));
    assert.deepStrictEqual(await agent.next((m) => m.type === "preview"), { type: "preview", on: true });

    // ...which are relayed to the viewer as-is.
    agent.send(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { binary: true });
    const frame = await dash.next((m) => m.binary);
    assert.deepStrictEqual([...frame.binary], [0xff, 0xd8, 0xff, 0xd9]);

    // Events are tagged with the camera; readings published by ingest arrive too.
    agent.send(JSON.stringify({ type: "event", kind: "returning_visitor" }));
    const ev = await dash.next((m) => m.type === "event");
    assert.strictEqual(ev.kind, "returning_visitor");
    assert.strictEqual(ev.cameraId, "front-desk");
    realtime.publish({ type: "reading", reading: { Gender: "Female", cameraId: "front-desk" } });
    assert.strictEqual((await dash.next((m) => m.type === "reading")).reading.Gender, "Female");

    // Last viewer leaves -> preview stops; agent disconnects -> camera goes offline.
    dash.close();
    assert.deepStrictEqual(await agent.next((m) => m.type === "preview"), { type: "preview", on: false });
    const dash2 = await dashboard();
    agent.close();
    await dash2.next((m) => m.type === "cameras" && m.cameras.length === 0);
    dash2.close();
});

test("realtime: preview is never requested from a camera that doesn't allow it", async () => {
    const dash = await dashboard();
    const agent = client("/ws/agent", { "x-api-key": "test-ingest" });
    await agent.opened;
    agent.send(JSON.stringify({ type: "hello", cameraId: "private-cam", previewAllowed: false }));
    await dash.next((m) => m.type === "cameras" && m.cameras.some((c) => c.cameraId === "private-cam"));
    dash.send(JSON.stringify({ type: "preview", cameraId: "private-cam" }));
    await assert.rejects(agent.next((m) => m.type === "preview", 300));
    agent.close();
    dash.close();
});

test("buildFilter: camera and since", () => {
    assert.strictEqual(buildFilter({ camera: "entrance" }).cameraId, "entrance");
    assert.strictEqual(buildFilter({ camera: "unassigned" }).cameraId, null);
    const f = buildFilter({ since: "2026-10-25T14:00:00Z" });
    assert.strictEqual(f.Timestamp.$gte.toISOString(), "2026-10-25T14:00:00.000Z");
    assert.strictEqual(buildFilter({ since: "garbage" }).Timestamp, undefined);
});

test("ingestSchema: cameraId must be a slug", () => {
    const base = { Age: "(20-30)", Gender: "Female", Emotion: "Happy" };
    assert.strictEqual(ingestSchema.safeParse({ ...base, cameraId: "front-desk", cameraName: "Front desk" }).success, true);
    assert.strictEqual(ingestSchema.safeParse({ ...base, cameraId: "front desk!" }).success, false);
});

test("weeklyGrid: averages per weekday x hour over the days that had visitors", () => {
    const { weeklyGrid } = require("../controllers/analytics-controller");
    // 2026-10-24 and 2026-10-31 are Saturdays; 2026-10-26 is a Monday.
    const { cells, days } = weeklyGrid([
        { date: "2026-10-24", hour: "12", count: 10 },
        { date: "2026-10-31", hour: "12", count: 20 },
        { date: "2026-10-31", hour: "18", count: 6 },
        { date: "2026-10-26", hour: "09", count: 3 },
        { date: "", hour: "10", count: 99 },          // malformed rows are ignored
    ]);
    const cell = (dow, hour) => cells.find((c) => c.dow === dow && c.hour === hour)?.avg;
    assert.strictEqual(cell(6, "12"), 15);             // (10 + 20) / 2 Saturdays
    assert.strictEqual(cell(6, "18"), 3);              // 6 over the same 2 Saturdays
    assert.strictEqual(cell(1, "09"), 3);              // one Monday
    assert.deepStrictEqual(days, { 1: 1, 6: 2 });
    assert.strictEqual(cell(0, "10"), undefined);
});

test("returns: validator accepts time + camera only; attribute filters don't apply", () => {
    const { returnSchema } = require("../validators/ingest-validator");
    const { returnFilter } = require("../controllers/analytics-controller");
    assert.strictEqual(returnSchema.safeParse({ cameraId: "front-desk", cameraName: "Front desk" }).success, true);
    assert.strictEqual(returnSchema.safeParse({ cameraId: "front desk!" }).success, false);
    const f = returnFilter({ from: "2026-10-01", to: "2026-10-07", gender: "Female", emotion: "Happy", camera: "entrance" });
    assert.deepStrictEqual(f.Date, { $gte: "2026-10-01", $lte: "2026-10-07" });
    assert.strictEqual(f.cameraId, "entrance");
    assert.strictEqual(f.Gender, undefined);
    assert.strictEqual(f.Emotion, undefined);
});

test("AI facts: plain clock times and quietest *open* hour", () => {
    const { summaryFacts } = require("../controllers/insights-controller");
    const facts = summaryFacts({
        total: 300, gender: { Female: 160, Male: 140 }, age: [{ age: "(20-30)", count: 120 }],
        emotion: { Happy: 100, Neutral: 200 }, gi: { individual: 250, group: 50 },
        byHour: [{ hour: "00", Neutral: 2 }, { hour: "09", Neutral: 20 }, { hour: "12", Happy: 100 }, { hour: "15", Neutral: 60 }, { hour: "18", Neutral: 118 }],
    });
    assert.strictEqual(facts.busiestTimes[0], "6–7 pm (118 visitors)");
    assert.strictEqual(facts.quietestOpenTime, "9–10 am (20 visitors)");   // not the 2 stray readings after midnight
    assert.strictEqual(facts.lookedHappyOrSurprised, "33%");
});

test("sample data: six whole months, nothing in the future", () => {
    const { generate, firstSampleDay } = require("../utils/demo-seed");
    const now = new Date(2026, 9, 29, 14, 30);
    assert.strictEqual(firstSampleDay(now).toDateString(), new Date(2026, 4, 1).toDateString());
    const docs = generate(now);
    const months = new Set(docs.map((d) => d.Date.slice(0, 7)));
    assert.deepStrictEqual([...months].sort(), ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    assert.ok(docs.every((d) => d.Timestamp <= now));
});

test("Ask: questions are checked and the facts are worked out in advance", () => {
    const { askSchema } = require("../validators/insights-validator");
    const { askFacts } = require("../controllers/insights-controller");
    const summary = { total: 40, byHour: [{ hour: "12", Happy: 30, Neutral: 10 }], age: [], gender: {}, emotion: { Happy: 30, Neutral: 10 } };
    assert.strictEqual(askSchema.safeParse({ question: "hi", summary }).success, false);           // too short
    assert.strictEqual(askSchema.safeParse({ question: "x".repeat(301), summary }).success, false);
    assert.strictEqual(askSchema.safeParse({ question: "When is it busy?", summary }).success, true);

    const facts = askFacts({
        summary, change: -18,
        daily: [{ date: "2026-10-29", count: 40, isToday: true }],
        monthly: [{ month: "2026-09", count: 9000, days: 30 }, { month: "2026-10", count: 8000, isCurrent: true }],
        hourly: [{ hour: "11", current: 0, compare: 0 }, { hour: "12", current: 40, compare: 52 }, { hour: "13", current: 3, compare: 48 }, { hour: "14", current: 0, compare: 45 }],
        now: { date: "2026-10-29", weekday: "Thursday", time: "13:10" },
        weekly: { hours: ["09", "12"], rows: [{ day: "Mon", values: [4, 20] }, { day: "Sat", values: [10, 50.4] }] },
    });
    assert.strictEqual(facts.todaySoFarVsSameTimeLastWeek, "-18%");
    assert.deepStrictEqual(facts.visitorsPerDayLast30Days, ["Thu 29 Oct (today, so far): 40"]);
    assert.deepStrictEqual(facts.visitorsPerMonth, ["Sep 2026: 9,000 over 30 days, about 300 a day", "Oct 2026 (so far): 8,000"]);
    assert.deepStrictEqual(facts.todayByHourVsSameDayLastWeek, [                // 2 pm hasn't happened yet
        "12–1 pm: 40 today, 52 last Thursday", "1–2 pm (in progress): 3 today, 48 last Thursday",
    ]);
    assert.deepStrictEqual(facts.typicalWeekLast4Weeks.averageVisitorsByWeekday, ["Mon: about 24", "Sat: about 60"]);
    assert.strictEqual(facts.typicalWeekLast4Weeks.busiestTimesOfTheWeek[0], "Sat 12–1 pm (about 50)");
});

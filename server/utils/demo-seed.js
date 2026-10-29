// Realistic sample visitor data for the demo account, shared by `npm run seed`
// and the scheduler's daily refresh (so the sample dashboard never goes stale).
//
// Sample readings are flagged `sample: true`. Only those are ever deleted or
// replaced here: real readings from the CV pipeline are never touched, and ids
// are reserved from the shared counter so the two can't collide.
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Client1 = require("../models/client1");
const ReturnVisit = require("../models/return-visit");
const User = require("../models/user-model");

const DEMO_EMAIL = "demo@facesense.app";
const DEMO_PASSWORD = "demo1234";
// About six months of history, starting on the 1st so every month but the
// current one is complete (the dashboard's "By month" view).
const MONTHS = 6;
const OPEN_HOUR = 9;
const CLOSE_HOUR = 20;
// Reseed when the newest sample reading is older than this.
const STALE_AFTER_MS = 20 * 60 * 60 * 1000;

// Weighted random picker: [[value, weight], ...]
function pick(weights) {
  const total = weights.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of weights) if ((r -= w) < 0) return v;
  return weights[0][0];
}
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pad = (n) => String(n).padStart(2, "0");
// Local calendar date, matching how the CV pipeline writes `Date`.
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const AGES = [["(0-10)", 3], ["(10-20)", 10], ["(20-30)", 32], ["(30-50)", 30], ["(50-60)", 15], ["(60-80)", 10]];
const GENDERS = [["Female", 55], ["Male", 45]];
const EMO_NORMAL = [["Happy", 38], ["Neutral", 30], ["Surprise", 12], ["Sad", 9], ["Fear", 5], ["Angry", 4], ["Disgust", 2]];
const EMO_NEGATIVE = [["Sad", 30], ["Angry", 25], ["Fear", 20], ["Disgust", 10], ["Neutral", 10], ["Happy", 5]];
const CAMERAS = [[{ cameraId: "entrance", cameraName: "Store entrance" }, 65], [{ cameraId: "checkout", cameraName: "Checkout" }, 35]];

// Footfall shape across the day (two peaks: lunch + evening).
const HOUR_WEIGHT = { 9: 0.4, 10: 0.7, 11: 0.9, 12: 1.3, 13: 1.2, 14: 0.8, 15: 0.7, 16: 0.8, 17: 1.0, 18: 1.3, 19: 1.1, 20: 0.6 };

function setTime(doc, ts) {
  doc.Timestamp = ts;
  doc.Date = localDate(ts);
  doc.Time = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`;
}

function reading(day, hour, minute, second, opts = {}) {
  const ts = new Date(day);
  ts.setHours(hour, minute, second, 0);
  const gi = Math.random() < 0.72 ? "individual" : "group";
  const doc = {
    Age: pick(AGES),
    Gender: pick(GENDERS),
    Emotion: pick(opts.negative ? EMO_NEGATIVE : EMO_NORMAL),
    Gi: gi,
    Gi_count: gi === "group" ? randInt(2, 5) : 1,
    ...pick(CAMERAS),
    sample: true, // seeded demo data — hidden from real users unless opted in
  };
  setTime(doc, ts);
  return doc;
}

const firstSampleDay = (now = new Date()) => new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1);

function generate(now = new Date()) {
  const todayHour = now.getHours();
  const today = localDate(now);
  const start = firstSampleDay(now);
  const docs = [];

  for (let day = new Date(start); localDate(day) <= today; day.setDate(day.getDate() + 1)) {
    const isToday = localDate(day) === today;
    const dow = day.getDay();
    const weekendBoost = dow === 0 || dow === 6 ? 1.4 : 1.0;
    // A store that's slowly growing: the first month is ~80% of the latest.
    const monthIndex = (day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth();
    const growth = 0.8 + 0.2 * (monthIndex / (MONTHS - 1));
    const dailyBase = randInt(22, 38) * weekendBoost * growth;

    // One off-peak hour today is anomalous: a footfall spike with sour sentiment.
    const anomalyHour = 15;

    for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) {
      if (isToday && h > todayHour) break; // don't seed the future
      const isAnomaly = isToday && h === anomalyHour;
      let count = Math.round(dailyBase * (HOUR_WEIGHT[h] || 0.6) * (0.8 + Math.random() * 0.4));
      if (isAnomaly) count = Math.round(count * 3) + 18;
      // The current hour is only partly over: fewer readings, none after now.
      const lastMinute = isToday && h === todayHour ? now.getMinutes() : 59;
      count = Math.round(count * (lastMinute + 1) / 60);
      for (let i = 0; i < count; i++) {
        const minute = randInt(0, lastMinute);
        const second = minute === now.getMinutes() && lastMinute < 59 ? randInt(0, now.getSeconds()) : randInt(0, 59);
        docs.push(reading(day, h, minute, second, { negative: isAnomaly && Math.random() < 0.6 }));
      }
    }
  }

  // Make the most recent ~12 readings land within the last 25 minutes so the
  // "recent visitors" feed looks live.
  docs.slice(-12).forEach((doc, idx) => {
    setTime(doc, new Date(now.getTime() - idx * 2 * 60 * 1000 - randInt(0, 90) * 1000));
  });
  return docs;
}

// Same-day returns: ~8-12% of each day's visitors come back 20 min to 3 h later
// (never past closing, never in the future).
function generateReturns(docs, now = new Date()) {
  const byDate = {};
  for (const d of docs) (byDate[d.Date] = byDate[d.Date] || []).push(d);
  const out = [];
  for (const visits of Object.values(byDate)) {
    const n = Math.round(visits.length * (0.08 + Math.random() * 0.04));
    for (let i = 0; i < n; i++) {
      const v = visits[randInt(0, visits.length - 1)];
      const ts = new Date(v.Timestamp.getTime() + randInt(20, 180) * 60 * 1000);
      if (ts > now || ts.getHours() > CLOSE_HOUR || localDate(ts) !== v.Date) continue;
      const r = { cameraId: v.cameraId, cameraName: v.cameraName, sample: true };
      setTime(r, ts);
      out.push(r);
    }
  }
  return out;
}

// Reserve a block of ids from the counter the pipeline and /api/ingest share.
async function reserveIds(count) {
  const counters = mongoose.connection.collection("counters");
  const doc = await counters.findOneAndUpdate(
    { _id: "client1_id" },
    { $inc: { sequence_value: count } },
    { upsert: true, returnDocument: "after" }
  );
  const last = doc?.value?.sequence_value ?? doc?.sequence_value;
  return last - count + 1;
}

async function ensureDemoUser() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await User.updateOne(
    { email: DEMO_EMAIL },
    { $set: { organisation: "Demo Retail", email: DEMO_EMAIL, password: hash, timezone: "UTC" } },
    { upsert: true }
  );
}

// Replace (or with keep=true, add to) the sample readings. Returns the count.
async function seedSampleData({ keep = false } = {}) {
  await ensureDemoUser();
  if (!keep) await Promise.all([Client1.deleteMany({ sample: true }), ReturnVisit.deleteMany({ sample: true })]);
  const docs = generate();
  const firstId = await reserveIds(docs.length);
  docs.forEach((doc, i) => { doc._id = firstId + i; });
  await Client1.insertMany(docs);
  await ReturnVisit.insertMany(generateReturns(docs));
  return docs.length;
}

// Stale when the newest reading is old, or the history is shorter than it
// should be (e.g. sample data seeded before it covered six months).
async function sampleIsStale() {
  const [latest, oldest] = await Promise.all([
    Client1.findOne({ sample: true }).sort({ Timestamp: -1 }).select({ Timestamp: 1 }).lean(),
    Client1.findOne({ sample: true }).sort({ Date: 1 }).select({ Date: 1 }).lean(),
  ]);
  if (!latest || Date.now() - new Date(latest.Timestamp).getTime() > STALE_AFTER_MS) return true;
  return oldest.Date > localDate(firstSampleDay());
}

module.exports = { seedSampleData, sampleIsStale, generate, firstSampleDay, DEMO_EMAIL, DEMO_PASSWORD, MONTHS };

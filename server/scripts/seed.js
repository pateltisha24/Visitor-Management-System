/**
 * Seed realistic visitor analytics into MongoDB so the dashboard's features
 * (date ranges, filters, recent feed, period comparison, anomalies, AI summary)
 * all work against real data — plus a demo account the "Live demo" logs into.
 *
 *   node scripts/seed.js            # seed (clears existing readings first)
 *   node scripts/seed.js --keep     # add without clearing
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Client1 = require("../models/client1");
const User = require("../models/user-model");

const DEMO_EMAIL = "demo@facesense.app";
const DEMO_PASSWORD = "demo1234";
const DAYS = 30;
const OPEN_HOUR = 9;
const CLOSE_HOUR = 20;

// Weighted random picker: [[value, weight], ...]
function pick(weights) {
  const total = weights.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of weights) if ((r -= w) < 0) return v;
  return weights[0][0];
}
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pad = (n) => String(n).padStart(2, "0");

const AGES = [["(0-10)", 3], ["(10-20)", 10], ["(20-30)", 32], ["(30-50)", 30], ["(50-60)", 15], ["(60-80)", 10]];
const GENDERS = [["Female", 55], ["Male", 45]];
const EMO_NORMAL = [["Happy", 38], ["Neutral", 30], ["Surprise", 12], ["Sad", 9], ["Fear", 5], ["Angry", 4], ["Disgust", 2]];
const EMO_NEGATIVE = [["Sad", 30], ["Angry", 25], ["Fear", 20], ["Disgust", 10], ["Neutral", 10], ["Happy", 5]];

// Footfall shape across the day (two peaks: lunch + evening).
const HOUR_WEIGHT = { 9: 0.4, 10: 0.7, 11: 0.9, 12: 1.3, 13: 1.2, 14: 0.8, 15: 0.7, 16: 0.8, 17: 1.0, 18: 1.3, 19: 1.1, 20: 0.6 };

function reading(id, day, hour, minute, second, opts = {}) {
  const ts = new Date(day);
  ts.setHours(hour, minute, second, 0);
  const gi = Math.random() < 0.72 ? "individual" : "group";
  return {
    _id: id,
    Timestamp: ts,
    Date: ts.toISOString().slice(0, 10),
    Time: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
    Age: pick(AGES),
    Gender: pick(GENDERS),
    Emotion: pick(opts.negative ? EMO_NEGATIVE : EMO_NORMAL),
    Gi: gi,
    Gi_count: gi === "group" ? randInt(2, 5) : 1,
    sample: true, // seeded demo data — hidden from real users unless opted in
  };
}

async function run() {
  const keep = process.argv.includes("--keep");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected. Seeding…");

  // Demo account (idempotent).
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await User.updateOne(
    { email: DEMO_EMAIL },
    { $set: { organisation: "Demo Retail", email: DEMO_EMAIL, password: hash, timezone: "UTC" } },
    { upsert: true }
  );
  console.log(`Demo user ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  if (!keep) await Client1.deleteMany({});

  const now = new Date();
  const todayHour = now.getHours();
  const docs = [];
  let id = 1;

  for (let d = DAYS - 1; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const isToday = d === 0;
    const dow = day.getDay();
    const weekendBoost = dow === 0 || dow === 6 ? 1.4 : 1.0;
    const dailyBase = randInt(22, 38) * weekendBoost;

    // One off-peak hour today is anomalous: a footfall spike with sour sentiment.
    const anomalyHour = 15;

    for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) {
      if (isToday && h > Math.max(todayHour, OPEN_HOUR + 1)) break; // don't seed the future
      const isAnomaly = isToday && h === anomalyHour;
      let count = Math.round(dailyBase * (HOUR_WEIGHT[h] || 0.6) * (0.8 + Math.random() * 0.4));
      if (isAnomaly) count = Math.round(count * 3) + 18;
      for (let i = 0; i < count; i++) {
        docs.push(reading(id++, day, h, randInt(0, 59), randInt(0, 59), { negative: isAnomaly && Math.random() < 0.6 }));
      }
    }
  }

  // Make the most recent ~12 readings land within the last 25 minutes so the
  // "recent visitors" feed looks live.
  const tail = docs.slice(-12);
  tail.forEach((doc, idx) => {
    const ts = new Date(now.getTime() - idx * 2 * 60 * 1000 - randInt(0, 90) * 1000);
    doc.Timestamp = ts;
    doc.Date = ts.toISOString().slice(0, 10);
    doc.Time = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`;
  });

  await Client1.insertMany(docs);
  await mongoose.connection.collection("counters").updateOne(
    { _id: "client1_id" },
    { $set: { sequence_value: id } },
    { upsert: true }
  );

  console.log(`Seeded ${docs.length} readings across ${DAYS} days (ids 1..${id - 1}).`);
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });

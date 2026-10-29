/**
 * Seed realistic visitor analytics into MongoDB so the dashboard's features
 * (date ranges, filters, recent feed, period comparison, anomalies, AI summary)
 * all work against real data — plus a demo account the "Live demo" logs into.
 *
 *   node scripts/seed.js            # replace the sample readings (real readings are kept)
 *   node scripts/seed.js --keep     # add more sample readings without clearing
 *
 * The data is relative to today, so re-run it (or set DEMO_SEED_REFRESH=true on an
 * always-on server) to keep the sample dashboard current.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { seedSampleData, DEMO_EMAIL, DEMO_PASSWORD, MONTHS } = require("../utils/demo-seed");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected. Seeding…");
  const count = await seedSampleData({ keep: process.argv.includes("--keep") });
  console.log(`Demo user ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Seeded ${count} sample readings across ${MONTHS} months.`);
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });

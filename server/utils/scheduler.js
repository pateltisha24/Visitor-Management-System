// In-process scheduled jobs for always-on hosts (Railway, Render, Fly, a VM).
// On Vercel the same rollup runs via Vercel Cron (vercel.json) instead, and this
// module is never started.
const { runRollup } = require("../controllers/cron-controller");
const { seedSampleData, sampleIsStale } = require("./demo-seed");

const HOUR_MS = 60 * 60 * 1000;

let lastRollupDate = null;

async function tick() {
    // Daily rollup of yesterday, once per day after 01:00 UTC (matches vercel.json).
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (now.getUTCHours() >= 1 && lastRollupDate !== today) {
        try {
            const { date, total } = await runRollup();
            lastRollupDate = today;
            console.log(`scheduler: rolled up ${date} (${total} readings)`);
        } catch (e) {
            console.error(`scheduler: rollup failed: ${e.message}`);
        }
    }

    // Keep the demo account's sample data relative to today (opt-in).
    if (process.env.DEMO_SEED_REFRESH === "true") {
        try {
            if (await sampleIsStale()) {
                const count = await seedSampleData();
                console.log(`scheduler: refreshed ${count} sample readings`);
            }
        } catch (e) {
            console.error(`scheduler: sample refresh failed: ${e.message}`);
        }
    }
}

function start() {
    tick();
    const timer = setInterval(tick, HOUR_MS);
    timer.unref();
}

module.exports = { start };

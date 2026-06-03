const Client1 = require("../models/client1");
const DailyRollup = require("../models/daily-rollup");

function yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

const toMap = (arr) => arr.reduce((acc, { _id, count }) => {
    acc[_id ?? "Unknown"] = count;
    return acc;
}, {});

// GET /api/cron/rollup — pre-aggregate a day's readings into one rollup doc.
// Secured by CRON_SECRET (Vercel Cron sends "Authorization: Bearer <CRON_SECRET>").
const rollup = async (req, res) => {
    const secret = process.env.CRON_SECRET;
    const provided = (req.header("authorization") || "").replace("Bearer ", "") || req.query.secret;
    if (!secret || provided !== secret) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        const date = req.query.date || yesterday();
        const match = { Date: date, sample: { $ne: true } };
        const [total, genderAgg, emotionAgg, giAgg, ageAgg] = await Promise.all([
            Client1.countDocuments(match),
            Client1.aggregate([{ $match: match }, { $group: { _id: "$Gender", count: { $sum: 1 } } }]),
            Client1.aggregate([{ $match: match }, { $group: { _id: "$Emotion", count: { $sum: 1 } } }]),
            Client1.aggregate([{ $match: match }, { $group: { _id: "$Gi", count: { $sum: 1 } } }]),
            Client1.aggregate([{ $match: match }, { $group: { _id: "$Age", count: { $sum: 1 } } }]),
        ]);
        const doc = {
            total,
            gender: toMap(genderAgg),
            emotion: toMap(emotionAgg),
            gi: toMap(giAgg),
            age: toMap(ageAgg),
            generatedAt: new Date(),
        };
        await DailyRollup.findByIdAndUpdate(date, doc, { upsert: true });
        res.json({ ok: true, date, total });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

module.exports = { rollup };

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

// Pre-aggregate one day's readings into a single rollup doc. Run daily by the
// in-process scheduler (utils/scheduler.js).
async function runRollup(date = yesterday()) {
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
    return { date, total };
}

module.exports = { runRollup };

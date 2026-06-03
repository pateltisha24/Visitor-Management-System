const Client1 = require("../models/client1");

// Build a Mongo filter from query params.
//   ?date=YYYY-MM-DD                 -> single day
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   -> inclusive range
//   ?gender=&emotion=&gi=&age=       -> optional cross-filters
// Dates are stored as ISO strings, which sort correctly lexicographically.
function buildFilter(query) {
    const { date, from, to, gender, emotion, gi, age } = query;
    const filter = {};
    if (date) filter.Date = date;
    else if (from || to) {
        filter.Date = {};
        if (from) filter.Date.$gte = from;
        if (to) filter.Date.$lte = to;
    }
    if (gender) filter.Gender = gender;
    if (emotion) filter.Emotion = emotion;
    if (gi) filter.Gi = gi;
    if (age) filter.Age = age;
    // Seeded demo data is hidden unless explicitly requested via ?sample=true.
    filter.sample = query.sample === "true" ? true : { $ne: true };
    return filter;
}

// Raw rows (kept for backward compatibility, and used for CSV export).
const getData = async (req, res) => {
    try {
        const data = await Client1.find(buildFilter(req.query));
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Most recent readings (for the live "recent visitors" feed).
const getRecent = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
        const data = await Client1.find(buildFilter(req.query)).sort({ _id: -1 }).limit(limit);
        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Distinct dates that have data, for populating the date picker.
const getDates = async (req, res) => {
    try {
        const sampleFilter = { sample: req.query.sample === "true" ? true : { $ne: true } };
        const dates = await Client1.distinct("Date", sampleFilter);
        res.json(dates.filter(Boolean).sort());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Pre-aggregated summary computed server-side via aggregation pipelines.
const getSummary = async (req, res) => {
    try {
        const match = buildFilter(req.query);

        const [
            totalAgg,
            genderAgg,
            ageAgg,
            genderAgeAgg,
            emotionAgg,
            giAgg,
            hourAgg,
            ageEmotionAgg,
        ] = await Promise.all([
            Client1.countDocuments(match),
            Client1.aggregate([{ $match: match }, { $group: { _id: "$Gender", count: { $sum: 1 } } }]),
            Client1.aggregate([{ $match: match }, { $group: { _id: "$Age", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
            Client1.aggregate([{ $match: match }, { $group: { _id: { age: "$Age", gender: "$Gender" }, count: { $sum: 1 } } }, { $sort: { "_id.age": 1 } }]),
            Client1.aggregate([{ $match: match }, { $group: { _id: "$Emotion", count: { $sum: 1 } } }]),
            Client1.aggregate([{ $match: match }, { $group: { _id: "$Gi", count: { $sum: 1 } } }]),
            // Emotions over time: group by the hour prefix of the Time string.
            Client1.aggregate([
                { $match: match },
                { $group: { _id: { hour: { $substrCP: ["$Time", 0, 2] }, emotion: "$Emotion" }, count: { $sum: 1 } } },
                { $sort: { "_id.hour": 1 } },
            ]),
            // Age x Emotion matrix.
            Client1.aggregate([
                { $match: match },
                { $group: { _id: { age: "$Age", emotion: "$Emotion" }, count: { $sum: 1 } } },
            ]),
        ]);

        const toMap = (arr) => arr.reduce((acc, { _id, count }) => {
            acc[_id ?? "Unknown"] = count;
            return acc;
        }, {});

        // Reshape "emotions over time" into [{ hour, <emotion>: count, ... }].
        const byHourMap = {};
        for (const { _id, count } of hourAgg) {
            const hour = _id.hour || "00";
            byHourMap[hour] = byHourMap[hour] || { hour };
            byHourMap[hour][_id.emotion || "Unknown"] = count;
        }
        const byHour = Object.values(byHourMap).sort((a, b) => a.hour.localeCompare(b.hour));

        const ageEmotionMatrix = ageEmotionAgg.map(({ _id, count }) => ({
            age: _id.age, emotion: _id.emotion, count,
        }));

        // Reshape gender x age into [{ age, Male, Female }] for a grouped bar.
        const genderAgeMap = {};
        for (const { _id, count } of genderAgeAgg) {
            const age = _id.age || "Unknown";
            genderAgeMap[age] = genderAgeMap[age] || { age, Male: 0, Female: 0 };
            genderAgeMap[age][_id.gender || "Unknown"] = count;
        }
        const genderAge = Object.values(genderAgeMap);

        res.json({
            total: totalAgg,
            gender: toMap(genderAgg),
            age: ageAgg.map(({ _id, count }) => ({ age: _id, count })),
            genderAge,
            emotion: toMap(emotionAgg),
            gi: toMap(giAgg),
            byHour,
            ageEmotionMatrix,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getData, getRecent, getDates, getSummary };

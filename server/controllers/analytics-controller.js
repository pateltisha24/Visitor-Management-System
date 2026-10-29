const Client1 = require("../models/client1");
const ReturnVisit = require("../models/return-visit");

// Build a Mongo filter from query params.
//   ?date=YYYY-MM-DD                 -> single day
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   -> inclusive range
//   ?gender=&emotion=&gi=&age=       -> optional cross-filters
//   ?camera=<cameraId>               -> one camera ("unassigned" = readings without one)
//   ?since=<ISO timestamp>           -> only readings at/after this instant (demo "start fresh")
// Dates are stored as ISO strings, which sort correctly lexicographically.
function buildFilter(query) {
    const { date, from, to, gender, emotion, gi, age, camera, since } = query;
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
    if (camera) filter.cameraId = camera === "unassigned" ? null : String(camera);
    if (since) {
        const t = new Date(since);
        if (!Number.isNaN(t.getTime())) filter.Timestamp = { $gte: t };
    }
    // Seeded demo data is hidden unless explicitly requested via ?sample=true.
    filter.sample = query.sample === "true" ? true : { $ne: true };
    return filter;
}

// Return visits carry no attributes, so only the date, camera, "since" and
// sample filters apply to them.
function returnFilter(query) {
    const { gender, emotion, gi, age, ...rest } = query;   // eslint-disable-line no-unused-vars
    return buildFilter(rest);
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
            dates,
            returning,
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
            Client1.distinct("Date", match),
            ReturnVisit.countDocuments(returnFilter(req.query)),
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
            days: dates.filter(Boolean).length,   // distinct days with visitors (for per-day figures)
            returning,                            // same-day return visits (not in `total`)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/analytics/hourly — visitors per hour of day (local time), plus how
// many distinct days that covers, so the chart can show an average per day.
const getHourly = async (req, res) => {
    try {
        const match = buildFilter(req.query);
        const [hours, dates] = await Promise.all([
            Client1.aggregate([
                { $match: match },
                { $group: { _id: { $substrCP: ["$Time", 0, 2] }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]),
            Client1.distinct("Date", match),
        ]);
        res.json({
            hours: hours.filter((h) => h._id).map(({ _id, count }) => ({ hour: _id, count })),
            days: dates.filter(Boolean).length,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/analytics/daily — visitors per calendar day.
const getDaily = async (req, res) => {
    try {
        const rows = await Client1.aggregate([
            { $match: buildFilter(req.query) },
            { $group: { _id: "$Date", count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]);
        res.json(rows.filter((r) => r._id).map(({ _id, count }) => ({ date: _id, count })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/analytics/monthly — visitors per calendar month ("YYYY-MM"), and on
// how many days of it there were visitors (for a fair average per day).
const getMonthly = async (req, res) => {
    try {
        const rows = await Client1.aggregate([
            { $match: buildFilter(req.query) },
            { $group: { _id: { $substrCP: ["$Date", 0, 7] }, count: { $sum: 1 }, dates: { $addToSet: "$Date" } } },
            { $sort: { _id: 1 } },
        ]);
        res.json(rows.filter((r) => r._id).map(({ _id, count, dates }) => ({ month: _id, count, days: dates.length })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Reduce per-(date, hour) counts into an average-visitors grid by weekday x hour.
// Averages divide by the number of that weekday's dates that had any visitors,
// so days the place was closed don't drag the average down.
function weeklyGrid(rows) {
    const totals = {};                 // "dow|hour" -> visitors
    const datesByDow = {};             // dow -> Set of dates
    for (const { date, hour, count } of rows) {
        if (!date || !hour) continue;
        const dow = new Date(`${date}T00:00:00Z`).getUTCDay();   // 0 = Sunday
        if (Number.isNaN(dow)) continue;
        totals[`${dow}|${hour}`] = (totals[`${dow}|${hour}`] || 0) + count;
        (datesByDow[dow] = datesByDow[dow] || new Set()).add(date);
    }
    const cells = Object.entries(totals).map(([key, total]) => {
        const [dow, hour] = key.split("|");
        return { dow: Number(dow), hour, avg: Math.round((total / datesByDow[dow].size) * 10) / 10 };
    });
    const days = Object.fromEntries(Object.entries(datesByDow).map(([dow, set]) => [dow, set.size]));
    return { cells, days };
}

// GET /api/analytics/weekly — average visitors by weekday x hour ("busy times").
const getWeekly = async (req, res) => {
    try {
        const rows = await Client1.aggregate([
            { $match: buildFilter(req.query) },
            { $group: { _id: { date: "$Date", hour: { $substrCP: ["$Time", 0, 2] } }, count: { $sum: 1 } } },
        ]);
        res.json(weeklyGrid(rows.map(({ _id, count }) => ({ date: _id.date, hour: _id.hour, count }))));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getData, getRecent, getDates, getSummary, getHourly, getDaily, getMonthly, getWeekly, buildFilter, returnFilter, weeklyGrid };

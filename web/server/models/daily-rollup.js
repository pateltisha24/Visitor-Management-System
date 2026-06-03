const mongoose = require("mongoose");

// One small document per day — a pre-aggregated rollup of that day's readings.
// Lets dashboards query bounded history cheaply even if raw readings are pruned.
const dailyRollupSchema = new mongoose.Schema({
    _id: String,            // the Date, "YYYY-MM-DD"
    total: Number,
    gender: Object,
    emotion: Object,
    gi: Object,
    age: Object,
    generatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("DailyRollup", dailyRollupSchema);

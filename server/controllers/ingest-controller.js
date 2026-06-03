const mongoose = require("mongoose");
const Client1 = require("../models/client1");

// Atomically get the next numeric _id from the shared "counters" collection
// (same scheme the Python pipeline uses for direct Mongo writes).
async function nextId() {
    const counters = mongoose.connection.collection("counters");
    const doc = await counters.findOneAndUpdate(
        { _id: "client1_id" },
        { $inc: { sequence_value: 1 } },
        { upsert: true, returnDocument: "after" }
    );
    const value = doc?.value?.sequence_value ?? doc?.sequence_value;
    return value || Date.now();
}

// POST /api/ingest  — machine-to-machine; authenticated by x-api-key header.
const ingest = async (req, res) => {
    try {
        const { Age, Gender, Emotion, Gi, Gi_count, Date: date, Time, Timestamp } = req.body;
        if (!Age || !Gender || !Emotion) {
            return res.status(400).json({ message: "Age, Gender and Emotion are required" });
        }
        const now = new Date();
        const reading = {
            _id: await nextId(),
            Timestamp: Timestamp ? new Date(Timestamp) : now,
            Date: date || now.toISOString().slice(0, 10),
            Time: Time || now.toTimeString().slice(0, 8),
            Age, Gender, Emotion,
            Gi: Gi || (Gi_count > 1 ? "group" : "individual"),
            Gi_count: Gi_count || 1,
        };
        await Client1.create(reading);
        res.status(201).json({ message: "stored", id: reading._id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { ingest };

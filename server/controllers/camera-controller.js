const Client1 = require("../models/client1");
const realtime = require("../utils/realtime");

// GET /api/cameras — every camera that has produced readings, merged with the
// ones connected right now (live status, FPS, whether preview is allowed).
const getCameras = async (req, res) => {
    try {
        const sampleFilter = { sample: req.query.sample === "true" ? true : { $ne: true } };
        const seen = await Client1.aggregate([
            { $match: { ...sampleFilter, cameraId: { $exists: true, $ne: null } } },
            { $group: { _id: "$cameraId", cameraName: { $last: "$cameraName" }, lastReadingAt: { $max: "$Timestamp" } } },
        ]);

        const byId = new Map(seen.map((c) => [c._id, {
            cameraId: c._id, cameraName: c.cameraName || c._id, lastReadingAt: c.lastReadingAt, online: false,
        }]));
        for (const live of realtime.cameraList()) {
            byId.set(live.cameraId, { ...byId.get(live.cameraId), ...live });
        }
        res.json([...byId.values()].sort((a, b) => a.cameraName.localeCompare(b.cameraName)));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getCameras };

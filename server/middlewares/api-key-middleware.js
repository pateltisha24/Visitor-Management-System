// Guards machine-to-machine endpoints (the CV pipeline's ingestion) with a
// shared secret sent in the "x-api-key" header. Set INGEST_API_KEY in the env.
const apiKeyMiddleware = (req, res, next) => {
    const expected = process.env.INGEST_API_KEY;
    if (!expected) {
        return res.status(503).json({ message: "Ingestion is not configured (INGEST_API_KEY unset)" });
    }
    if (req.header("x-api-key") !== expected) {
        return res.status(401).json({ message: "Invalid API key" });
    }
    next();
};

module.exports = apiKeyMiddleware;

const { isDemoEmail } = require("../utils/demo-account");

// Runs after authMiddleware: whatever the demo account asks for, it's answered
// from the sample readings (the dashboard's Sample switch can't turn them off).
const sampleOnlyForDemo = (req, res, next) => {
    if (isDemoEmail(req.user?.email)) req.query.sample = "true";
    next();
};

module.exports = sampleOnlyForDemo;

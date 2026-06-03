const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth-middleware');
const { getData, getRecent, getDates, getSummary } = require('../controllers/analytics-controller');

// All analytics endpoints require a valid JWT (dashboard data is protected).
router.get('/data', authMiddleware, getData);
router.get('/analytics/recent', authMiddleware, getRecent);
router.get('/analytics/dates', authMiddleware, getDates);
router.get('/analytics/summary', authMiddleware, getSummary);

module.exports = router;

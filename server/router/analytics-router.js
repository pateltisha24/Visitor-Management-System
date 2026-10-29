const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth-middleware');
const { getData, getRecent, getDates, getSummary, getHourly, getDaily, getWeekly } = require('../controllers/analytics-controller');

// All analytics endpoints require a valid JWT (dashboard data is protected).
router.get('/data', authMiddleware, getData);
router.get('/analytics/recent', authMiddleware, getRecent);
router.get('/analytics/dates', authMiddleware, getDates);
router.get('/analytics/summary', authMiddleware, getSummary);
router.get('/analytics/hourly', authMiddleware, getHourly);
router.get('/analytics/daily', authMiddleware, getDaily);
router.get('/analytics/weekly', authMiddleware, getWeekly);

module.exports = router;

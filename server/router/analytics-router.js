const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth-middleware');
const sampleOnlyForDemo = require('../middlewares/demo-middleware');
const { getData, getRecent, getDates, getSummary, getHourly, getDaily, getMonthly, getWeekly } = require('../controllers/analytics-controller');

// All analytics endpoints require a valid JWT (dashboard data is protected);
// the demo account is only ever answered from sample data.
router.get('/data', authMiddleware, sampleOnlyForDemo, getData);
router.get('/analytics/recent', authMiddleware, sampleOnlyForDemo, getRecent);
router.get('/analytics/dates', authMiddleware, sampleOnlyForDemo, getDates);
router.get('/analytics/summary', authMiddleware, sampleOnlyForDemo, getSummary);
router.get('/analytics/hourly', authMiddleware, sampleOnlyForDemo, getHourly);
router.get('/analytics/daily', authMiddleware, sampleOnlyForDemo, getDaily);
router.get('/analytics/monthly', authMiddleware, sampleOnlyForDemo, getMonthly);
router.get('/analytics/weekly', authMiddleware, sampleOnlyForDemo, getWeekly);

module.exports = router;

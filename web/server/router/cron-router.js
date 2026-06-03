const express = require('express');
const router = express.Router();
const { rollup } = require('../controllers/cron-controller');

// Scheduled pre-aggregation (Vercel Cron). Secured by CRON_SECRET inside the handler.
router.get('/cron/rollup', rollup);

module.exports = router;

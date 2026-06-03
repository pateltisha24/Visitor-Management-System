const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth-middleware');
const { getAiConfig, updateAiConfig, generateInsight } = require('../controllers/insights-controller');

// BYOK AI endpoints (all require auth).
router.get('/ai/config', authMiddleware, getAiConfig);
router.patch('/ai/config', authMiddleware, updateAiConfig);
router.post('/ai/insights', authMiddleware, generateInsight);

module.exports = router;

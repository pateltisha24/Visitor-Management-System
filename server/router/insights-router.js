const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth-middleware');
const validate = require('../middlewares/validate-middleware');
const { askSchema } = require('../validators/insights-validator');
const { getAiConfig, updateAiConfig, askQuestion } = require('../controllers/insights-controller');

// BYOK AI endpoints (all require auth).
router.get('/ai/config', authMiddleware, getAiConfig);
router.patch('/ai/config', authMiddleware, updateAiConfig);
router.post('/ai/ask', authMiddleware, validate(askSchema), askQuestion);

module.exports = router;

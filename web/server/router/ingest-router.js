const express = require('express');
const router = express.Router();
const apiKeyMiddleware = require('../middlewares/api-key-middleware');
const validate = require('../middlewares/validate-middleware');
const { ingestSchema } = require('../validators/ingest-validator');
const { ingest } = require('../controllers/ingest-controller');

// POST /api/ingest — used by the CV pipeline to push readings over HTTP.
router.post('/ingest', apiKeyMiddleware, validate(ingestSchema), ingest);

module.exports = router;

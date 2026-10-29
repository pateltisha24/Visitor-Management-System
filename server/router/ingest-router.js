const express = require('express');
const router = express.Router();
const apiKeyMiddleware = require('../middlewares/api-key-middleware');
const validate = require('../middlewares/validate-middleware');
const { ingestSchema, returnSchema } = require('../validators/ingest-validator');
const { ingest, ingestReturn } = require('../controllers/ingest-controller');

// POST /api/ingest — used by the CV pipeline to push readings over HTTP.
router.post('/ingest', apiKeyMiddleware, validate(ingestSchema), ingest);
router.post('/ingest/return', apiKeyMiddleware, validate(returnSchema), ingestReturn);

module.exports = router;

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth-middleware');
const sampleOnlyForDemo = require('../middlewares/demo-middleware');
const { getCameras } = require('../controllers/camera-controller');

router.get('/cameras', authMiddleware, sampleOnlyForDemo, getCameras);

module.exports = router;

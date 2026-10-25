const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth-middleware');
const { getCameras } = require('../controllers/camera-controller');

router.get('/cameras', authMiddleware, getCameras);

module.exports = router;

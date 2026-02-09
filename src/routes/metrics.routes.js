const express = require('express');
const router = express.Router();
const metricsController = require('../controllers/metrics.controller');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, metricsController.getMetrics);
router.post('/assign', authMiddleware, metricsController.assignLeadRoundRobin);

module.exports = router;

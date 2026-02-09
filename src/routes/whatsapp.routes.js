const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');
const authMiddleware = require('../middleware/auth');
const { requirePro } = require('../middleware/subscription-gate');

router.post('/webhook/:instance?', whatsappController.handleWebhook);
router.get('/webhook/health', whatsappController.getWebhookHealth);
router.get('/test-flow', whatsappController.testFlow);

// Dealer Protected Routes
router.post('/connect', authMiddleware, requirePro, whatsappController.connectInstance);
router.get('/status', authMiddleware, whatsappController.getStatus);
router.post('/instances/cleanup', authMiddleware, whatsappController.cleanupInstances);
router.get('/metrics', authMiddleware, whatsappController.getMetrics);
router.get('/:instance/health', whatsappController.getInstanceHealth);

module.exports = router;

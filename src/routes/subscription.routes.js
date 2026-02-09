const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const authMiddleware = require('../middleware/auth');

// Public Webhooks (No Auth)
router.post('/webhook/razorpay', subscriptionController.handleRazorpayWebhook);
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), subscriptionController.handleStripeWebhook);

// Protected Routes
router.get('/plans', subscriptionController.listPlans);
router.get('/status', authMiddleware, subscriptionController.getStatus);
router.get('/invoices', authMiddleware, subscriptionController.getInvoices);
router.post('/create-checkout', authMiddleware, subscriptionController.createCheckout);

module.exports = router;

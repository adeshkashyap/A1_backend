const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const propertyRoutes = require('./properties.routes');
const leadRoutes = require('./leads.routes');
const dealerRoutes = require('./dealer.routes');
const whatsappRoutes = require('./whatsapp.routes');
const miscRoutes = require('./misc.routes');
const metricsRoutes = require('./metrics.routes');
const subscriptionRoutes = require('./subscription.routes');

router.use('/auth', authRoutes);
router.use('/inventory', propertyRoutes);
router.use('/orders', leadRoutes);
router.use('/company', dealerRoutes);
router.use('/sales-reps', dealerRoutes);
router.use('/metrics', metricsRoutes);
router.use('/leads', metricsRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/', whatsappRoutes);
router.use('/', miscRoutes);

module.exports = router;

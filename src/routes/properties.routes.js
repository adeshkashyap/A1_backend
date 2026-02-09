const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/property.controller');
const authMiddleware = require('../middleware/auth');
const { checkSubscription } = require('../middleware/subscription-gate');

router.get('/', authMiddleware, propertyController.listProperties);
router.post('/', authMiddleware, checkSubscription, propertyController.createProperty);
router.put('/:id', authMiddleware, checkSubscription, propertyController.updateProperty);
router.delete('/:id', authMiddleware, checkSubscription, propertyController.deleteProperty);

module.exports = router;

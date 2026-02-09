const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead.controller');
const authMiddleware = require('../middleware/auth');
const { limitLeads } = require('../middleware/subscription-gate');

router.get('/', authMiddleware, leadController.listLeads);
router.post('/', authMiddleware, limitLeads, leadController.createLead);
router.put('/:id', authMiddleware, leadController.updateLead);

module.exports = router;

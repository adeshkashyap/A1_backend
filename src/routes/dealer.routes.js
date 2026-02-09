const express = require('express');
const router = express.Router();
const dealerController = require('../controllers/dealer.controller');
const authMiddleware = require('../middleware/auth');
const { limitTeam } = require('../middleware/subscription-gate');

// Profile
router.put('/profile', authMiddleware, dealerController.updateProfile);

// Team / Sales Reps
router.get('/sales-reps', authMiddleware, dealerController.listSalesReps);
router.post('/sales-reps', authMiddleware, limitTeam, dealerController.createSalesRep);
router.put('/sales-reps/:id', authMiddleware, dealerController.updateSalesRep);
router.delete('/sales-reps/:id', authMiddleware, dealerController.deleteSalesRep);

// Referral Codes (Coupons)
router.get('/coupons', dealerController.listReferralCodes);
router.post('/coupons', dealerController.createReferralCode);
router.put('/coupons/:id', dealerController.updateReferralCode);
router.delete('/coupons/:id', dealerController.deleteReferralCode);

module.exports = router;

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../../lib/auth-middleware');

// Legacy & Standard Auth
router.post('/login', authController.login);
router.post('/signup', authController.signupLegacy);
router.get('/me', authMiddleware, authController.getMe);

// OTP-based Auth
router.post('/signup/request-otp', authController.signupRequestOtp);
router.post('/signup/verify-otp', authController.signupVerifyOtp);
router.post('/login/request-otp', authController.loginRequestOtp);
router.post('/login/verify-otp', authController.loginVerifyOtp);
router.post('/password-reset/request-otp', authController.passwordResetRequestOtp);
router.post('/password-reset/verify-otp', authController.passwordResetVerifyOtp);
router.post('/validate-otp', authController.validateOtp);
router.post('/verify-phone-email', authController.verifyPhoneEmail);
router.post('/resend-otp', authController.resendOtp);

// SMS OTP-based Auth
router.post('/signup/request-otp-sms', authController.signupRequestOtpSMS);
router.post('/signup/verify-otp-sms', authController.signupVerifyOtpSMS);

// Refresh & Logout
router.post('/refresh', authController.refresh);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;

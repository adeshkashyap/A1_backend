const twilio = require('twilio');
const logger = require('./logger');

/**
 * Twilio SMS Service for OTP and notifications
 */
class TwilioService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.from = process.env.TWILIO_PHONE_NUMBER;
    this.verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    this.useMockSms = process.env.USE_MOCK_SMS === 'true';

    if (this.useMockSms) {
      logger.info('[Twilio] Running in MOCK mode (SMS will be logged instead of sent)');
    }

    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
      logger.info('[Twilio] SMS service initialized');
      if (this.verifyServiceSid) {
        logger.info('[Twilio] Verify service enabled');
      }
    } else {
      logger.warn('[Twilio] Credentials missing - SMS service disabled');
    }
  }

  /**
   * Send SMS via Twilio
   * @param {string} to - Recipient phone number
   * @param {string} body - Message content
   */
  async sendSMS(to, body) {
    try {
      if (!this.client || this.useMockSms) {
        logger.warn(`[MOCK SMS] To: ${to} | Body: ${body}`);
        return { sid: 'dev-mock-sid' };
      }

      const message = await this.client.messages.create({
        body,
        from: this.from,
        to
      });

      logger.info(`[Twilio] SMS sent to ${to}`, { sid: message.sid });
      return message;
    } catch (error) {
      logger.error(`[Twilio] Error sending SMS to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Send verification code via Twilio Verify
   */
  async sendVerification(to) {
    try {
      if (!this.client || !this.verifyServiceSid || this.useMockSms) {
        logger.warn(`[MOCK VERIFY] Enrollment for ${to}. OTP: 123456 (Mocked)`);
        return { sid: 'dev-verify-sid', status: 'pending' };
      }

      const verification = await this.client.verify.v2.services(this.verifyServiceSid)
        .verifications
        .create({ to, channel: 'sms' });

      logger.info(`[Twilio] Verification sent to ${to}`, { sid: verification.sid });
      return verification;
    } catch (error) {
      logger.error(`[Twilio] Error sending verification to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Check verification code via Twilio Verify
   */
  async checkVerification(to, code) {
    try {
      if (!this.client || !this.verifyServiceSid || this.useMockSms) {
        logger.warn(`[MOCK VERIFY CHECK] For: ${to} | Code: ${code}`);
        return { status: code === '123456' ? 'approved' : 'pending' };
      }

      const check = await this.client.verify.v2.services(this.verifyServiceSid)
        .verificationChecks
        .create({ to, code });

      logger.info(`[Twilio] Verification check for ${to}: ${check.status}`);
      return check;
    } catch (error) {
      logger.error(`[Twilio] Error checking verification for ${to}:`, code);
      throw error;
    }
  }

  /**
   * Generate 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

module.exports = new TwilioService();

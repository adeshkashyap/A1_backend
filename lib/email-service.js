const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Email Service for OTP-based Authentication
 * Supports SendGrid, Gmail SMTP, and GCP-native email
 */
class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp'; // 'smtp', 'sendgrid', 'gmail'
    this.from = process.env.EMAIL_FROM || 'noreply@apnacodex.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'ApnaCodex Property';
    
    this.transporter = this.createTransporter();
    logger.info(`[EmailService] Initialized with provider: ${this.provider}`);
  }

  createTransporter() {
    if (this.provider === 'sendgrid') {
      // SendGrid SMTP
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
    } else if (this.provider === 'gmail') {
      // Gmail SMTP (requires App Password)
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });
    } else {
      // Generic SMTP
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });
    }
  }

  /**
   * Generate 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP Email
   */
  async sendOTP(email, otp, purpose = 'verification') {
    const templates = {
      verification: {
        subject: '🔐 Verify Your Email - ApnaCodex',
        html: this.getVerificationTemplate(otp)
      },
      login: {
        subject: '🔑 Your Login OTP - ApnaCodex',
        html: this.getLoginTemplate(otp)
      },
      reset: {
        subject: '🔄 Reset Your Password - ApnaCodex',
        html: this.getResetTemplate(otp)
      }
    };

    const template = templates[purpose] || templates.verification;

    try {
      // In development mode without SMTP configured, just log the OTP
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        logger.warn(`[DEV MODE] Email OTP for ${email}: ${otp}`);
        logger.warn(`[DEV MODE] Email service not configured. OTP: ${otp}`);
        return { success: true, messageId: 'dev-mock-id', otp }; // Include OTP in dev mode
      }

      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.from}>`,
        to: email,
        subject: template.subject,
        html: template.html
      });

      logger.info(`[EmailService] OTP sent to ${email} for ${purpose}`, { messageId: info.messageId });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      // Fallback to dev mode if email fails
      logger.warn(`[DEV MODE] Email failed, logging OTP for ${email}: ${otp}`);
      return { success: true, messageId: 'dev-mock-id' };
    }
  }

  /**
   * Send Welcome Email
   */
  async sendWelcomeEmail(email, name) {
    try {
      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.from}>`,
        to: email,
        subject: '🎉 Welcome to ApnaCodex!',
        html: this.getWelcomeTemplate(name)
      });

      logger.info(`[EmailService] Welcome email sent to ${email}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`[EmailService] Failed to send welcome email:`, error);
      // Don't throw - welcome email is not critical
      return { success: false };
    }
  }

  /**
   * Email Templates
   */
  getVerificationTemplate(otp) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .otp-box { background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
          .otp { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 ApnaCodex</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email</h2>
            <p>Thank you for signing up! Please use the OTP below to verify your email address:</p>
            <div class="otp-box">
              <div class="otp">${otp}</div>
            </div>
            <p><strong>This OTP is valid for 10 minutes.</strong></p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2026 ApnaCodex. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getLoginTemplate(otp) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .otp-box { background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
          .otp { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔑 Login Request</h1>
          </div>
          <div class="content">
            <h2>Your Login OTP</h2>
            <p>Someone is trying to log in to your ApnaCodex account. Use this OTP to continue:</p>
            <div class="otp-box">
              <div class="otp">${otp}</div>
            </div>
            <p><strong>This OTP is valid for 10 minutes.</strong></p>
            <div class="warning">
              <strong>⚠️ Security Alert:</strong> If you didn't attempt to log in, please ignore this email and consider changing your password.
            </div>
          </div>
          <div class="footer">
            <p>© 2026 ApnaCodex. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getResetTemplate(otp) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .otp-box { background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
          .otp { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Password Reset</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password. Use this OTP to continue:</p>
            <div class="otp-box">
              <div class="otp">${otp}</div>
            </div>
            <p><strong>This OTP is valid for 10 minutes.</strong></p>
            <div class="warning">
              <strong>⚠️ Security Alert:</strong> If you didn't request a password reset, please ignore this email and ensure your account is secure.
            </div>
          </div>
          <div class="footer">
            <p>© 2026 ApnaCodex. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getWelcomeTemplate(name) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .feature { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to ApnaCodex!</h1>
          </div>
          <div class="content">
            <h2>Hi ${name}! 👋</h2>
            <p>Welcome to ApnaCodex - Your trusted property management platform!</p>
            <p>You can now:</p>
            <div class="feature">📊 Manage your property listings</div>
            <div class="feature">💬 Connect with customers via WhatsApp</div>
            <div class="feature">📈 Track leads and sales</div>
            <div class="feature">🤖 Use AI-powered property assistant</div>
            <p>Get started by logging into your dashboard!</p>
          </div>
          <div class="footer">
            <p>© 2026 ApnaCodex. All rights reserved.</p>
            <p>Need help? Contact us at support@apnacodex.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();

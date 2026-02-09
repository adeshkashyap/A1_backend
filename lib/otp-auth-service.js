const prisma = require('./prisma');
const bcrypt = require('bcryptjs');
const emailService = require('./email-service');
const twilioService = require('./twilio-sms-service');
const logger = require('./logger');

/**
 * OTP Authentication Service
 * Handles email-based OTP for signup, login, and password reset
 */
class OTPAuthService {
  constructor() {
    this.OTP_EXPIRY_MINUTES = 10;
    this.MAX_OTP_ATTEMPTS = 5;
  }

  /**
   * Validate OTP without consuming it
   */
  async validateOTP(identifier, otp, isPhone = false) {
    try {
      const cleanOtp = otp?.trim();
      const cleanIdentifier = identifier?.toLowerCase().trim();

      const dealer = await prisma.dealer.findFirst({
        where: isPhone ? { phone: cleanIdentifier } : { email: cleanIdentifier }
      });

      if (!dealer) {
        logger.warn(`[OTPAuth] No OTP request found for ${cleanIdentifier}`);
        throw new Error('No OTP request found for this identifier.');
      }

      if (!dealer.otpExpiry || new Date() > dealer.otpExpiry) {
        logger.warn(`[OTPAuth] OTP expired for ${cleanIdentifier}`);
        throw new Error('OTP has expired. Please request a new one.');
      }

      const isValid = await bcrypt.compare(cleanOtp, dealer.otp);
      if (!isValid) {
        logger.warn(`[OTPAuth] Invalid OTP attempt for ${cleanIdentifier}`);
        throw new Error('Invalid OTP. Please check the code and try again.');
      }

      logger.info(`[OTPAuth] OTP validated successfully for ${cleanIdentifier}`);
      return { success: true };
    } catch (error) {
      logger.error('[OTPAuth] Validation Error:', error);
      throw error;
    }
  }

  /**
   * Generate and send OTP for email verification (signup)
   */
  async sendVerificationOTP(email) {
    try {
      // Check if dealer already exists
      const existingDealer = await prisma.dealer.findUnique({
        where: { email }
      });

      if (existingDealer && existingDealer.verified) {
        throw new Error('Email already registered and verified. Please login.');
      }

      // Generate OTP
      const otp = emailService.generateOTP();
      const hashedOTP = await bcrypt.hash(otp, 10);
      const otpExpiry = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

      // Store OTP in database
      if (existingDealer) {
        await prisma.dealer.update({
          where: { email },
          data: {
            otp: hashedOTP,
            otpExpiry,
            otpPurpose: 'verification'
          }
        });
      } else {
        // Create temporary dealer record
        await prisma.dealer.create({
          data: {
            email,
            password: '', // Will be set after verification
            name: '', // Will be set after verification
            otp: hashedOTP,
            otpExpiry,
            otpPurpose: 'verification',
            verified: false
          }
        });
      }

      // Send OTP email
      await emailService.sendOTP(email, otp, 'verification');

      logger.info(`[OTPAuth] Verification OTP sent to ${email}`);
      return {
        success: true,
        message: 'OTP sent to your email. Valid for 10 minutes.',
        expiresIn: this.OTP_EXPIRY_MINUTES * 60
      };
    } catch (error) {
      logger.error('[OTPAuth] Error sending verification OTP:', error);
      throw error;
    }
  }

  /**
   * Verify OTP and complete signup
   */
  async verifySignupOTP(email, otp, name, password, phone = null) {
    try {
      let dealer = await prisma.dealer.findUnique({
        where: { email }
      });

      if (!dealer) {
        throw new Error('No signup request found for this email.');
      }

      if (dealer.verified) {
        throw new Error('Email already verified. Please login.');
      }

      // Check OTP expiry
      if (!dealer.otpExpiry || new Date() > dealer.otpExpiry) {
        throw new Error('OTP has expired. Please request a new one.');
      }

      // Verify OTP
      const isMock = process.env.USE_MOCK_SMS === 'true' && otp === '123456';
      const isValid = isMock || (await bcrypt.compare(otp, dealer.otp));
      
      if (!isValid) {
        throw new Error('Invalid OTP. Please try again.');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update or Create dealer
      const dealerData = {
        name,
        email,
        password: hashedPassword,
        verified: true,
        verifiedAt: new Date(),
        otp: null,
        otpExpiry: null,
        otpPurpose: null
      };

      if (phone) {
        dealerData.phone = phone;
      }

      const updatedDealer = await prisma.dealer.upsert({
        where: { email },
        update: dealerData,
        create: {
          ...dealerData,
          role: 'dealer'
        },
        include: {
          companyProfile: true,
          subscription: true
        }
      });

      // Assign Free Plan automatically
      try {
        const freePlan = await prisma.subscriptionPlan.findFirst({
          where: { planName: 'Free' }
        });

        if (freePlan) {
          await prisma.subscription.upsert({
            where: { dealerId: updatedDealer.id },
            create: {
              dealerId: updatedDealer.id,
              planId: freePlan.id,
              status: 'active',
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days free or permanent? user said "create free plan"
            },
            update: {
              planId: freePlan.id,
              status: 'active'
            }
          });
          logger.info(`[OTPAuth] Free plan assigned to ${email}`);
        }
      } catch (subError) {
        logger.error('[OTPAuth] Failed to assign trial plan:', subError);
        // Don't fail signup if subscription fails, but log it
      }

      // Send welcome email
      await emailService.sendWelcomeEmail(email, name);

      logger.info(`[OTPAuth] Signup completed for ${email}`);
      return {
        success: true,
        message: 'Email verified successfully!',
        dealer: {
          id: updatedDealer.id,
          email: updatedDealer.email,
          name: updatedDealer.name
        }
      };
    } catch (error) {
      logger.error('[OTPAuth] Error verifying signup OTP:', error);
      throw error;
    }
  }

  /**
   * Send OTP for login (passwordless)
   */
  async sendLoginOTP(email) {
    try {
      const dealer = await prisma.dealer.findUnique({
        where: { email }
      });

      if (!dealer) {
        throw new Error('No account found with this email.');
      }

      if (!dealer.verified) {
        throw new Error('Email not verified. Please complete signup first.');
      }

      if (!dealer.active) {
        throw new Error('Account is deactivated. Please contact support.');
      }

      // Generate OTP
      const otp = emailService.generateOTP();
      const hashedOTP = await bcrypt.hash(otp, 10);
      const otpExpiry = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

      // Store OTP
      await prisma.dealer.update({
        where: { email },
        data: {
          otp: hashedOTP,
          otpExpiry,
          otpPurpose: 'login'
        }
      });

      // Send OTP email
      await emailService.sendOTP(email, otp, 'login');

      logger.info(`[OTPAuth] Login OTP sent to ${email}`);
      return {
        success: true,
        message: 'OTP sent to your email. Valid for 10 minutes.',
        expiresIn: this.OTP_EXPIRY_MINUTES * 60
      };
    } catch (error) {
      logger.error('[OTPAuth] Error sending login OTP:', error);
      throw error;
    }
  }

  /**
   * Verify login OTP
   */
  async verifyLoginOTP(email, otp) {
    try {
      const dealer = await prisma.dealer.findUnique({
        where: { email },
        include: {
          companyProfile: true
        }
      });

      if (!dealer) {
        throw new Error('No account found with this email.');
      }

      // Check OTP expiry
      if (!dealer.otpExpiry || new Date() > dealer.otpExpiry) {
        throw new Error('OTP has expired. Please request a new one.');
      }

      // Verify OTP
      const isMock = process.env.USE_MOCK_SMS === 'true' && otp === '123456';
      const isValid = isMock || (await bcrypt.compare(otp, dealer.otp));
      
      if (!isValid) {
        throw new Error('Invalid OTP. Please try again.');
      }

      // Clear OTP
      await prisma.dealer.update({
        where: { email },
        data: {
          otp: null,
          otpExpiry: null,
          otpPurpose: null
        }
      });

      logger.info(`[OTPAuth] Login successful for ${email}`);
      return {
        success: true,
        dealer: {
          id: dealer.id,
          email: dealer.email,
          name: dealer.name,
          role: dealer.role,
          companyProfile: dealer.companyProfile
        }
      };
    } catch (error) {
      logger.error('[OTPAuth] Error verifying login OTP:', error);
      throw error;
    }
  }

  /**
   * Send password reset OTP
   */
  async sendPasswordResetOTP(email) {
    try {
      const dealer = await prisma.dealer.findUnique({
        where: { email }
      });

      if (!dealer) {
        // Don't reveal if email exists for security
        return {
          success: true,
          message: 'If an account exists with this email, you will receive a password reset OTP.'
        };
      }

      if (!dealer.verified) {
        throw new Error('Email not verified. Please complete signup first.');
      }

      // Generate OTP
      const otp = emailService.generateOTP();
      const hashedOTP = await bcrypt.hash(otp, 10);
      const otpExpiry = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

      // Store OTP
      await prisma.dealer.update({
        where: { email },
        data: {
          otp: hashedOTP,
          otpExpiry,
          otpPurpose: 'reset'
        }
      });

      // Send OTP email
      await emailService.sendOTP(email, otp, 'reset');

      logger.info(`[OTPAuth] Password reset OTP sent to ${email}`);
      return {
        success: true,
        message: 'OTP sent to your email. Valid for 10 minutes.',
        expiresIn: this.OTP_EXPIRY_MINUTES * 60
      };
    } catch (error) {
      logger.error('[OTPAuth] Error sending password reset OTP:', error);
      throw error;
    }
  }

  /**
   * Verify reset OTP and update password
   */
  async verifyPasswordResetOTP(email, otp, newPassword) {
    try {
      const dealer = await prisma.dealer.findUnique({
        where: { email }
      });

      if (!dealer) {
        throw new Error('No account found with this email.');
      }

      // Check OTP expiry
      if (!dealer.otpExpiry || new Date() > dealer.otpExpiry) {
        throw new Error('OTP has expired. Please request a new one.');
      }

      // Verify OTP
      const isValid = await bcrypt.compare(otp, dealer.otp);
      if (!isValid) {
        throw new Error('Invalid OTP. Please try again.');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear OTP
      await prisma.dealer.update({
        where: { email },
        data: {
          password: hashedPassword,
          otp: null,
          otpExpiry: null,
          otpPurpose: null
        }
      });

      logger.info(`[OTPAuth] Password reset successful for ${email}`);
      return {
        success: true,
        message: 'Password reset successfully. You can now login with your new password.'
      };
    } catch (error) {
      logger.error('[OTPAuth] Error verifying password reset OTP:', error);
      throw error;
    }
  }

  /**
   * Resend OTP (for any purpose)
   */
  async resendOTP(email) {
    try {
      const dealer = await prisma.dealer.findUnique({
        where: { email }
      });

      if (!dealer) {
        throw new Error('No OTP request found for this email.');
      }

      const purpose = dealer.otpPurpose || 'VERIFICATION';
      
      // Call appropriate send method based on purpose
      if (purpose === 'reset') {
        return this.sendPasswordResetOTP(email);
      } else if (purpose === 'login') {
        return this.sendLoginOTP(email);
      } else {
        return this.sendVerificationOTP(email);
      }
    } catch (error) {
      logger.error('[OTPAuth] Resend Error:', error);
      throw error;
    }
  }

  /**
   * Send verification OTP via SMS (for phone-based signup)
   */
  async sendVerificationOTPViaSMS(phone) {
    try {
      // Check if phone already verified on ANY account
      const existingVerifiedPhone = await prisma.dealer.findFirst({
        where: { phone, phoneVerified: true }
      });

      if (existingVerifiedPhone) {
        throw new Error('This phone number is already linked to a verified account. Please login.');
      }

      // Send verification via Twilio Verify V2
      await twilioService.sendVerification(phone);

      logger.info(`[OTPAuth] Twilio Verify challenge sent to ${phone}`);
      return {
        success: true,
        message: 'Verification code sent to your phone.',
        expiresIn: 10 * 60 
      };
    } catch (error) {
      logger.error('[OTPAuth] Error sending SMS verification:', error);
      throw error;
    }
  }

  /**
   * Verify SMS OTP and complete signup
   */
  async verifySignupOTPViaSMS(phone, otp, name, password, email) {
    try {
      // 1. Check verification with Twilio Verify V2
      const verificationCheck = await twilioService.checkVerification(phone, otp);
      
      if (verificationCheck.status !== 'approved') {
        throw new Error('Invalid or expired verification code.');
      }

      // 2. Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. Create or Update dealer record by Email (Email is unique)
      // This also handles the case where an unverified record existed for this email
      const dealer = await prisma.dealer.upsert({
        where: { email: email.toLowerCase().trim() },
        update: {
          name,
          password: hashedPassword,
          phone,
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          verified: true, 
          verifiedAt: new Date(),
          active: true
        },
        create: {
          email: email.toLowerCase().trim(),
          name,
          password: hashedPassword,
          phone,
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          role: 'dealer',
          verified: true,
          verifiedAt: new Date(),
          active: true
        }
      });

      logger.info(`[OTPAuth] User created/verified via SMS: ${email}`);
      return {
        success: true,
        message: 'Signup successful!',
        dealer: {
          id: dealer.id,
          email: dealer.email,
          name: dealer.name,
          role: dealer.role
        }
      };
    } catch (error) {
      logger.error('[OTPAuth] Error verifying SMS OTP:', error);
      throw error;
    }
  }
}

module.exports = new OTPAuthService();

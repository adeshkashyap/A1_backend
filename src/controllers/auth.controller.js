const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const otpAuthService = require('../../lib/otp-auth-service');
const evolutionAPI = require('../../lib/evolution-api-client');
const { client: redis } = require('../utils/redis');

const JWT_ACCESS_SECRET = process.env.JWT_SECRET || 'local_dev_secret_12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-2026';
const ACCESS_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
};

const login = async (req, res) => {
  const { email, password } = req.body;
  logger.info(`[Auth] Login attempt for: ${email}`);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const dealer = await prisma.dealer.findUnique({
      where: { email },
      include: { 
        companyProfile: true,
        subscription: {
          include: { plan: true }
        }
      }
    });

    if (!dealer) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, dealer.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = { dealerId: dealer.id, email: dealer.email, role: dealer.role };
    const { accessToken, refreshToken } = generateTokens(payload);

    // Store refresh token in Redis for rotation
    await redis.set(`refresh_token:${dealer.id}`, refreshToken, {
      EX: REFRESH_TOKEN_EXPIRY_SECONDS
    });

    res.json({
      accessToken,
      refreshToken,
      dealer: {
        id: dealer.id,
        email: dealer.email,
        name: dealer.name,
        role: dealer.role,
        companyProfile: dealer.companyProfile,
        subscription: dealer.subscription
      }
    });
  } catch (error) {
    logger.error('Login Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const signupRequestOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await otpAuthService.sendVerificationOTP(email);
    res.json(result);
  } catch (error) {
    logger.error('[Auth] Signup OTP Error:', error);
    res.status(400).json({ error: error.message });
  }
};

const signupVerifyOtp = async (req, res) => {
  const { email, otp, name, password, phone } = req.body;
  if (!email || !otp || !name || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const result = await otpAuthService.verifySignupOTP(email, otp, name, password, phone);
    const payload = { dealerId: result.dealer.id, email: result.dealer.email, role: 'dealer' };
    const { accessToken, refreshToken } = generateTokens(payload);
    
    await redis.set(`refresh_token:${result.dealer.id}`, refreshToken, {
      EX: REFRESH_TOKEN_EXPIRY_SECONDS
    });

    res.json({ ...result, accessToken, refreshToken });
  } catch (error) {
    logger.error('[Auth] Signup Verify Error:', error);
    res.status(400).json({ error: error.message });
  }
};

const validateOtp = async (req, res) => {
  const { identifier, otp, isPhone } = req.body;
  if (!identifier || !otp) {
    return res.status(400).json({ error: 'Identifier and OTP are required' });
  }

  try {
    await otpAuthService.validateOTP(identifier, otp, isPhone);
    res.json({ success: true, message: 'OTP is valid' });
  } catch (error) {
    logger.error('[Auth] OTP Validation Error:', error);
    res.status(400).json({ error: error.message });
  }
};

const verifyPhoneEmail = async (req, res) => {
  const { user_json_url } = req.body;
  if (!user_json_url) {
    return res.status(400).json({ error: 'user_json_url is required' });
  }

  try {
    const axios = require('axios');
    const response = await axios.get(user_json_url);
    const data = response.data;

    // data contains: user_country_code, user_phone_number, user_first_name, user_last_name
    res.json({
      success: true,
      data: {
        phone: `${data.user_country_code}${data.user_phone_number}`,
        name: `${data.user_first_name} ${data.user_last_name}`.trim(),
        countryCode: data.user_country_code
      }
    });
  } catch (error) {
    logger.error('[Auth] Phone.Email Verification Error:', error);
    res.status(400).json({ error: 'Failed to verify phone from URL' });
  }
};

const loginRequestOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await otpAuthService.sendLoginOTP(email);
    res.json(result);
  } catch (error) {
    logger.error('[Auth] Login OTP Error:', error);
    res.status(400).json({ error: error.message });
  }
};

const loginVerifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  try {
    const result = await otpAuthService.verifyLoginOTP(email, otp);
    const payload = { dealerId: result.dealer.id, email: result.dealer.email, role: result.dealer.role };
    const { accessToken, refreshToken } = generateTokens(payload);

    await redis.set(`refresh_token:${result.dealer.id}`, refreshToken, {
      EX: REFRESH_TOKEN_EXPIRY_SECONDS
    });

    res.json({ accessToken, refreshToken, dealer: result.dealer });
  } catch (error) {
    logger.error('[Auth] Login Verify Error:', error);
    res.status(400).json({ error: error.message });
  }
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required' });

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const savedToken = await redis.get(`refresh_token:${decoded.dealerId}`);

    if (refreshToken !== savedToken) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const payload = { dealerId: decoded.dealerId, email: decoded.email, role: decoded.role };
    const tokens = generateTokens(payload);

    // Rotate refresh token
    await redis.set(`refresh_token:${decoded.dealerId}`, tokens.refreshToken, {
      EX: REFRESH_TOKEN_EXPIRY_SECONDS
    });

    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

const logout = async (req, res) => {
  const { refreshToken } = req.body;
  const token = req.headers.authorization?.split(' ')[1];

  try {
    if (token) {
      const decoded = jwt.decode(token);
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redis.set(`blacklist:${token}`, 'true', { EX: ttl });
      }
    }
    
    if (req.dealer?.id) {
      await redis.del(`refresh_token:${req.dealer.id}`);
    } else if (refreshToken) {
      const decoded = jwt.decode(refreshToken);
      if (decoded?.dealerId) await redis.del(`refresh_token:${decoded.dealerId}`);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout Error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
};

const passwordResetRequestOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await otpAuthService.sendPasswordResetOTP(email);
    res.json(result);
  } catch (error) {
    logger.error('[Auth] Password Reset OTP Error:', error);
    res.status(400).json({ error: error.message });
  }
};

const passwordResetVerifyOtp = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const result = await otpAuthService.verifyPasswordResetOTP(email, otp, newPassword);
    res.json(result);
  } catch (error) {
    logger.error('[Auth] Password Reset Verify Error:', error);
    res.status(400).json({ error: error.message });
  }
};

const resendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const result = await otpAuthService.resendOTP(email);
    res.json(result);
  } catch (error) {
    logger.error('[Auth] Resend OTP Error:', error);
    res.status(400).json({ error: error.message });
  }
};

const signupLegacy = async (req, res) => {
  const { email, password, name, phone } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Required fields missing' });

  try {
    const existingDealer = await prisma.dealer.findUnique({ where: { email } });
    if (existingDealer) return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await prisma.$transaction(async (tx) => {
      const newDealer = await tx.dealer.create({
        data: { email, password: hashedPassword, name, phone, role: 'dealer' }
      });
      const profile = await tx.companyProfile.create({
        data: {
          dealerId: newDealer.id,
          companyName: `${name}'s Agency`,
          phone: phone || '',
          email: email,
          address: '',
          botName: 'Property Assistant'
        }
      });
      return { dealer: newDealer, profile };
    });

    const payload = { dealerId: result.dealer.id, email: result.dealer.email };
    const { accessToken, refreshToken } = generateTokens(payload);
    
    await redis.set(`refresh_token:${result.dealer.id}`, refreshToken, {
      EX: REFRESH_TOKEN_EXPIRY_SECONDS
    });

    res.json({
      accessToken,
      refreshToken,
      dealer: { ...result.dealer, companyProfile: result.profile, subscription: null }
    });
  } catch (error) {
    logger.error('Signup Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getMe = async (req, res) => {
  res.json({ dealer: req.dealer });
};

const signupRequestOtpSMS = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  try {
    const result = await otpAuthService.sendVerificationOTPViaSMS(phone);
    res.json(result);
  } catch (error) {
    logger.error('[Auth] SMS Signup OTP Error:', error);
    res.status(400).json({ error: error.message });
  }
};

const signupVerifyOtpSMS = async (req, res) => {
  const { phone, otp, name, password, email } = req.body;
  if (!phone || !otp || !name || !password) {
    return res.status(400).json({ error: 'Phone, OTP, name, and password are required' });
  }

  try {
    const result = await otpAuthService.verifySignupOTPViaSMS(phone, otp, name, password, email);
    const payload = { dealerId: result.dealer.id, email: result.dealer.email, role: 'dealer' };
    const { accessToken, refreshToken } = generateTokens(payload);
    
    await redis.set(`refresh_token:${result.dealer.id}`, refreshToken, {
      EX: REFRESH_TOKEN_EXPIRY_SECONDS
    });

    res.json({ ...result, accessToken, refreshToken });
  } catch (error) {
    logger.error('[Auth] SMS Signup Verify Error:', error);
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  login,
  refresh,
  logout,
  signupRequestOtp,
  signupVerifyOtp,
  loginRequestOtp,
  loginVerifyOtp,
  passwordResetRequestOtp,
  passwordResetVerifyOtp,
  resendOtp,
  signupLegacy,
  getMe,
  signupRequestOtpSMS,
  signupVerifyOtpSMS,
  validateOtp,
  verifyPhoneEmail
};

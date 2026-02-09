const { client: redis } = require('../utils/redis');
const logger = require('../../lib/logger');

const REDIS_PREFIX = 'rate_limit:';
const LIMIT = 100;
const WINDOW_SECONDS = 60;

const rateLimitMiddleware = async (req, res, next) => {
  // Use dealerId from auth middleware, or fallback to IP for public routes
  const identifier = req.dealer?.id || req.ip;
  const key = `${REDIS_PREFIX}${identifier}`;

  try {
    if (!redis.isOpen) {
      return next(); // Fail open if Redis is down
    }

    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (current > LIMIT) {
      logger.warn(`Rate limit exceeded for identifier: ${identifier}`);
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: WINDOW_SECONDS
      });
    }

    next();
  } catch (error) {
    logger.error('Rate Limit Middleware Error:', error);
    next();
  }
};

module.exports = rateLimitMiddleware;

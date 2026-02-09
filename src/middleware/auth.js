const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const { client: redis } = require('../utils/redis');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted in Redis
    if (redis.isOpen) {
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({ error: 'Token is revoked' });
      }
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'local_dev_secret_12345');

    const dealer = await prisma.dealer.findUnique({
      where: { id: decoded.dealerId },
      include: { 
        companyProfile: true,
        subscription: {
          include: { plan: true }
        }
      }
    });

    if (!dealer) {
      return res.status(401).json({ error: 'Dealer not found' });
    }

    // Attach dealer to request
    req.dealer = dealer;
    next();
  } catch (error) {
    logger.error('Authentication Error:', { error: error.message });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;

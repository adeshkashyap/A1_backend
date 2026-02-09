const jwt = require('jsonwebtoken');
const prisma = require('./prisma');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'local_dev_secret_12345');

    const dealer = await prisma.dealer.findUnique({
      where: { id: decoded.dealerId },
      include: { companyProfile: true }
    });

    if (!dealer) {
      return res.status(401).json({ error: 'Dealer not found' });
    }

    // Attach dealer to request
    req.dealer = dealer;
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]:', error.message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;

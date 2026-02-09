const logger = require('../../lib/logger');
const prisma = require('../../lib/prisma');

const checkSubscription = (req, res, next) => {
  const { subscription } = req.dealer;

  if (!subscription || subscription.status !== 'active') {
    return res.status(403).json({
      error: 'Active subscription required',
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'Please upgrade your plan to access this feature.'
    });
  }

  next();
};

const limitLeads = async (req, res, next) => {
  const { subscription, id: dealerId } = req.dealer;
  const plan = subscription?.plan;

  if (!plan) return checkSubscription(req, res, next);

  if (plan.planName === 'Basic') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const leadCount = await prisma.lead.count({
      where: {
        dealerId,
        createdAt: { gte: startOfMonth }
      }
    });

    if (leadCount >= 100) {
      return res.status(403).json({
        error: 'Monthly lead limit reached',
        code: 'LIMIT_REACHED',
        message: 'Your Basic plan allows only 100 leads per month. Please upgrade to Pro for unlimited leads.'
      });
    }
  }

  next();
};

const limitTeam = async (req, res, next) => {
  const { subscription, id: dealerId } = req.dealer;
  const plan = subscription?.plan;

  if (!plan) return checkSubscription(req, res, next);

  const limits = { 'Basic': 1, 'Pro': 5, 'Enterprise': 20 };
  const maxMembers = limits[plan.planName] || 1;

  const teamCount = await prisma.salesRep.count({ where: { dealerId } });

  if (teamCount >= maxMembers) {
    return res.status(403).json({
      error: 'Team size limit reached',
      code: 'LIMIT_REACHED',
      message: `Your ${plan.planName} plan allows only ${maxMembers} team members.`
    });
  }

  next();
};

const requirePro = (req, res, next) => {
  const { subscription } = req.dealer;
  const plan = subscription?.plan;

  if (!plan || (plan.planName !== 'Pro' && plan.planName !== 'Enterprise')) {
    return res.status(403).json({
      error: 'Pro feature required',
      code: 'UPGRADE_REQUIRED',
      message: 'This feature (WhatsApp Multi-instance / Lead Export) requires a Pro or Enterprise plan.'
    });
  }

  next();
};

module.exports = {
  checkSubscription,
  limitLeads,
  limitTeam,
  requirePro
};

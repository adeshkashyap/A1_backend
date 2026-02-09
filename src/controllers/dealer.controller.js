const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');

const updateProfile = async (req, res) => {
  try {
    const updatedProfile = await prisma.companyProfile.upsert({
      where: { dealerId: req.dealer.id },
      update: req.body,
      create: {
        ...req.body,
        dealerId: req.dealer.id,
        companyName: req.body.companyName || 'My Agency',
        phone: req.dealer.phone || '',
        email: req.dealer.email || '',
        address: req.body.address || 'Not provided'
      }
    });
    res.json(updatedProfile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listSalesReps = async (req, res) => {
  try {
    const dealerId = req.dealer.id;
    logger.info(`[API] Fetching sales reps for dealer: ${dealerId}`);
    const salesReps = await prisma.salesRep.findMany({
      where: { dealerId: dealerId },
      orderBy: { createdAt: 'desc' }
    });
    logger.info(`[API] Found ${salesReps.length} sales reps.`);
    res.json(salesReps);
  } catch (error) {
    logger.error('[API] Error fetching sales reps:', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const createSalesRep = async (req, res) => {
  try {
    const dealerId = req.dealer.id;
    logger.info('[API] Creating sales rep:', req.body);
    const salesRep = await prisma.salesRep.create({
      data: {
        ...req.body,
        dealerId: dealerId
      }
    });
    logger.info('[API] Sales rep created successfully');
    res.json(salesRep);
  } catch (error) {
    logger.error('[API] Error creating sales rep:', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const updateSalesRep = async (req, res) => {
  try {
    const { id } = req.params;
    const dealerId = req.dealer.id;
    const salesRep = await prisma.salesRep.updateMany({
      where: { id, dealerId },
      data: req.body
    });
    res.json(salesRep);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteSalesRep = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.salesRep.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listReferralCodes = async (req, res) => {
  try {
    const referralCodes = await prisma.referralCode.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(referralCodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createReferralCode = async (req, res) => {
  try {
    const referralCode = await prisma.referralCode.create({
      data: req.body
    });
    res.json(referralCode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateReferralCode = async (req, res) => {
  try {
    const { id } = req.params;
    const referralCode = await prisma.referralCode.update({
      where: { id },
      data: req.body
    });
    res.json(referralCode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteReferralCode = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.referralCode.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  updateProfile,
  listSalesReps,
  createSalesRep,
  updateSalesRep,
  deleteSalesRep,
  listReferralCodes,
  createReferralCode,
  updateReferralCode,
  deleteReferralCode
};

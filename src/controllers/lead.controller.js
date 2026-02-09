const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const { emitToDealer } = require('../../lib/socket');

const listLeads = async (req, res) => {
  try {
    const dealerId = req.dealer.id;
    const leads = await prisma.lead.findMany({
      where: { dealerId: dealerId },
      include: { assignedRep: true },
      orderBy: { createdAt: 'desc' }
    });
    
    const orders = leads.map(lead => ({
      ...lead,
      shortId: lead.pdId,
      customerName: lead.buyerName,
      customerPhone: lead.buyerPhone,
      items: lead.requirements,
      amount: lead.budget,
      assignedBoyId: lead.assignedRepId,
      assignedBoy: lead.assignedRep
    }));
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createLead = async (req, res) => {
  try {
    const dealerId = req.dealer.id;
    const leadData = {
      pdId: req.body.shortId || `PD-${Date.now()}`,
      buyerName: req.body.customerName,
      buyerPhone: req.body.customerPhone,
      buyerEmail: req.body.customerEmail || null,
      requirements: req.body.items,
      budget: parseFloat(req.body.amount),
      status: req.body.status || 'NEW',
      location: req.body.address,
      assignedRepId: req.body.assignedBoyId || null,
      source: 'WhatsApp',
      dealerId: dealerId
    };
    
    const lead = await prisma.lead.create({
      data: leadData,
      include: { assignedRep: true }
    });
    
    const order = {
      ...lead,
      shortId: lead.pdId,
      customerName: lead.buyerName,
      customerPhone: lead.buyerPhone,
      items: lead.requirements,
      amount: lead.budget,
      assignedBoyId: lead.assignedRepId,
      assignedBoy: lead.assignedRep
    };
    
    res.json(order);
    emitToDealer(dealerId, 'lead:created', order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const dealerId = req.dealer.id;
    const oldLead = await prisma.lead.findFirst({ 
      where: { id, dealerId }, 
      include: { assignedRep: true } 
    });
    if (!oldLead) return res.status(404).json({ error: 'Lead not found' });
    
    logger.info(`[Lead Update] ID: ${id} | Status: ${oldLead.status} -> ${req.body.status || oldLead.status}`);

    const updateData = {};
    if (req.body.status) updateData.status = req.body.status;
    if (req.body.customerName) updateData.buyerName = req.body.customerName;
    if (req.body.customerPhone) updateData.buyerPhone = req.body.customerPhone;
    if (req.body.items) updateData.requirements = req.body.items;
    if (req.body.amount) updateData.budget = parseFloat(req.body.amount);
    if (req.body.address) updateData.location = req.body.address;
    if (req.body.assignedBoyId) updateData.assignedRepId = req.body.assignedBoyId;

    const lead = await prisma.lead.update({
      where: { id, dealerId },
      data: updateData,
      include: { assignedRep: true }
    });

    const order = {
      ...lead,
      shortId: lead.pdId,
      customerName: lead.buyerName,
      customerPhone: lead.buyerPhone,
      items: lead.requirements,
      amount: lead.budget,
      address: lead.location,
      assignedBoyId: lead.assignedRepId,
      assignedBoy: lead.assignedRep
    };

    res.json(order);
    emitToDealer(dealerId, 'lead:updated', order);
  } catch (error) {
    logger.error('[API] Error updating lead:', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listLeads,
  createLead,
  updateLead
};

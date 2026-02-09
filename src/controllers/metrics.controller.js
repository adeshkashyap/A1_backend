const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');

const getMetrics = async (req, res) => {
  try {
    const dealerId = req.dealer.id;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Leads Today
    const leadsToday = await prisma.lead.count({
      where: {
        dealerId: dealerId,
        createdAt: { gte: startOfToday }
      }
    });

    // 2. WhatsApp Messages (Mocked for now as we need message logging)
    const whatsappMessages = await prisma.lead.count({
      where: {
        dealerId: dealerId,
        source: 'WhatsApp'
      }
    });

    // 3. API Latency (Placeholder - would usually come from middleware or prometheus)
    const apiLatency = '124ms';

    res.json({
      leadsToday,
      whatsappMessages,
      apiLatency,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Metrics Error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};

const assignLeadRoundRobin = async (req, res) => {
  try {
    const { leadId } = req.body;
    const dealerId = req.dealer.id;

    if (!leadId) return res.status(400).json({ error: 'leadId is required' });

    // 1. Get all active sales reps
    const salesReps = await prisma.salesRep.findMany({
      where: { dealerId, active: true },
      orderBy: { id: 'asc' }
    });

    if (salesReps.length === 0) {
      return res.status(404).json({ error: 'No active sales reps found' });
    }

    // 2. Get the lead
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // 3. Simple Round-Robin: Find the rep who was assigned the oldest (or least) lead recently
    // For now, we'll just use a simple modulo or check last assigned lead
    const lastAssignedLead = await prisma.lead.findFirst({
      where: { 
        dealerId, 
        assignedRepId: { not: null } 
      },
      orderBy: { updatedAt: 'desc' }
    });

    let nextRep;
    if (!lastAssignedLead) {
      nextRep = salesReps[0];
    } else {
      const currentIndex = salesReps.findIndex(r => r.id === lastAssignedLead.assignedRepId);
      nextRep = salesReps[(currentIndex + 1) % salesReps.length];
    }

    // 4. Update lead
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: { assignedRepId: nextRep.id },
      include: { assignedRep: true }
    });

    logger.info(`[Assign] Lead ${leadId} assigned to ${nextRep.name} (Round-robin)`);
    res.json(updatedLead);
  } catch (error) {
    logger.error('Assignment Error:', error);
    res.status(500).json({ error: 'Failed to assign lead' });
  }
};

module.exports = {
  getMetrics,
  assignLeadRoundRobin
};

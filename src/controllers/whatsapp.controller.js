const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const { addWebhookToQueue } = require('../utils/webhook-queue');
const whatsappFlow = require('../../lib/apnacodex-whatsapp-flow');
const { client: redis } = require('../utils/redis');
const evolution = require('../../lib/evolution');

const RATE_LIMIT_WEBHOOK = 100;
const RATE_LIMIT_WINDOW = 60;

const handleWebhook = async (req, res) => {
  try {
    const instanceName = req.params.instance || process.env.EVOLUTION_INSTANCE || 'apnacodex';
    const webhookData = req.body;
    
    // 1. Signature Validation (Mock/Placeholder)
    if (process.env.EVOLUTION_WEBHOOK_SECRET) {
      const signature = req.headers['evolution-signature'];
      // Perform validation logic here
      // if (!validate(webhookData, signature)) return res.status(401).send('Invalid signature');
    }

    // 2. Rate Limiting (100 req/min per instance)
    if (redis.isOpen) {
      const key = `webhook_rate_limit:${instanceName}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW);
      
      if (count > RATE_LIMIT_WEBHOOK) {
        logger.warn(`[Webhook] Rate limit exceeded for instance: ${instanceName}`);
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
    }

    logger.info(`[Evolution Webhook] Enqueuing event for instance: ${instanceName} | Event: ${webhookData.event}`);
    
    // 3. Offload to Queue for Retries & Async Processing
    await addWebhookToQueue(webhookData, instanceName);
    
    res.status(200).json({ success: true, message: 'Webhook enqueued' });
  } catch (error) {
    logger.error('[Webhook Endpoint Error]', error);
    res.status(500).json({ error: error.message });
  }
};

const testFlow = async (req, res) => {
  try {
    const testNumber = req.query.number || '910000000000';
    const testText = req.query.text || 'hi';
    logger.info(`[Diagnostic] Triggered flow for ${testNumber} with "${testText}"`);
    await whatsappFlow.handleWhatsAppMessage(testNumber, testText, 'text');
    res.json({ success: true, message: `Logic triggered for ${testNumber}` });
  } catch (error) {
    logger.error('[Diagnostic Error]:', error);
    res.status(500).json({ error: error.message });
  }
};



const connectInstance = async (req, res) => {
  try {
    const dealerId = req.dealer.id;
    const instanceName = req.dealer.companyProfile?.whatsappInstance || `apnacodex_${dealerId.substring(0, 8)}`;

    logger.info(`[WhatsApp] Connecting instance for dealer ${dealerId}: ${instanceName}`);

    // 1. Create instance if not exists
    await evolution.createInstance(instanceName).catch(e => logger.warn('Instance might already exist'));

    // 2. Get QR Code
    const qrData = await evolution.getQrCode(instanceName);

    // 3. Update dealer profile with instance name
    await prisma.companyProfile.update({
      where: { dealerId },
      data: { 
        whatsappInstance: instanceName,
        instanceStatus: 'pairing'
      }
    });

    res.json(qrData);
  } catch (error) {
    logger.error('[WhatsApp Connect Error]:', error);
    res.status(500).json({ error: 'Failed to connect WhatsApp instance' });
  }
};

const getStatus = async (req, res) => {
  try {
    const dealerId = req.dealer.id;
    const instanceName = req.dealer.companyProfile?.whatsappInstance;

    if (!instanceName) {
      return res.json({ status: 'NOT_CONFIGURED' });
    }

    const state = await evolution.getInstanceStatus(instanceName);
    
    // Update status in DB
    await prisma.companyProfile.update({
      where: { dealerId },
      data: { instanceStatus: state.toLowerCase() }
    });

    res.json({ status: state });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getWebhookHealth = (req, res) => {
  res.json({ status: 'ok', message: 'Webhook endpoint is ready' });
};

const { triggerManualCleanup } = require('../utils/instance-cleanup');

const cleanupInstances = async (req, res) => {
  try {
    const job = await triggerManualCleanup();
    res.json({ message: 'Cleanup job scheduled', jobId: job.id });
  } catch (error) {
    logger.error('[Cleanup Trigger Error]:', error);
    res.status(500).json({ error: 'Failed' });
  }
};

const { webhookQueue } = require('../utils/webhook-queue');

const getMetrics = async (req, res) => {
  try {
    const totalInstances = await prisma.companyProfile.count({
      where: { whatsappInstance: { not: null } }
    });

    const activeInstances = await prisma.companyProfile.count({
      where: { instanceStatus: 'open' }
    });

    const waitingJobs = await webhookQueue.getWaitingCount();
    const activeJobs = await webhookQueue.getActiveCount();
    const completedJobs = await webhookQueue.getCompletedCount();
    const failedJobs = await webhookQueue.getFailedCount();

    res.json({
      instances: {
        total: totalInstances,
        active: activeInstances,
        inactive: totalInstances - activeInstances
      },
      queue: {
        waiting: waitingJobs,
        active: activeJobs,
        completed: completedJobs,
        failed: failedJobs
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[Metrics Error]:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};

const getInstanceHealth = async (req, res) => {
  try {
    const { instance } = req.params;
    const status = await evolution.getInstanceStatus(instance);
    
    if (status.state === 'open' || status.state === 'CONNECTED') {
      return res.json({ status: 'UP', instance, state: status.state });
    }
    
    res.status(503).json({ status: 'DOWN', instance, state: status.state });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
};

module.exports = {
  handleWebhook,
  testFlow,
  getWebhookHealth,
  connectInstance,
  getStatus,
  cleanupInstances,
  getMetrics,
  getInstanceHealth
};

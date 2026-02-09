const { Queue, Worker } = require('bullmq');
const prisma = require('../../lib/prisma');
const evolution = require('../../lib/evolution');
const logger = require('../../lib/logger');

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
};

// 1. Define the Cleanup Queue
const cleanupQueue = new Queue('instance-cleanup', { 
  connection: redisOptions 
});

// 2. Define the Worker
const cleanupWorker = new Worker('instance-cleanup', async (job) => {
  logger.info(`[Cleanup] Starting instance cleanup job: ${job.id}`);
  
  const days = parseInt(process.env.INSTANCE_CLEANUP_DAYS || '30');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  try {
    // Find instances that haven't been seen for X days
    const inactiveProfiles = await prisma.companyProfile.findMany({
      where: {
        whatsappInstance: { not: null },
        OR: [
          { lastSeen: { lt: cutoffDate } },
          { lastSeen: null, createdAt: { lt: cutoffDate } }
        ]
      }
    });

    logger.info(`[Cleanup] Found ${inactiveProfiles.length} inactive instances to cleanup.`);

    for (const profile of inactiveProfiles) {
      const instanceName = profile.whatsappInstance;
      logger.info(`[Cleanup] Deleting inactive instance: ${instanceName} (Dealer: ${profile.dealerId})`);

      // Delete from Evolution API
      await evolution.deleteInstance(instanceName).catch(err => {
        logger.error(`[Cleanup] Failed to delete instance ${instanceName} from Evolution: ${err.message}`);
      });

      // Clear from database
      await prisma.companyProfile.update({
        where: { id: profile.id },
        data: {
          whatsappInstance: null,
          whatsappConnected: false,
          instanceStatus: 'disconnected'
        }
      });
      
      logger.info(`[Cleanup] Successfully cleaned up dealer ${profile.dealerId}`);
    }

    return { cleaned: inactiveProfiles.length };
  } catch (error) {
    logger.error('[Cleanup] Error during instance cleanup:', error);
    throw error;
  }
}, { connection: redisOptions });

// 3. Schedule the CRON job (Runs every day at midnight)
const scheduleCleanup = async () => {
  const jobs = await cleanupQueue.getRepeatableJobs();
  const alreadyScheduled = jobs.some(job => job.name === 'daily-cleanup');

  if (!alreadyScheduled) {
    await cleanupQueue.add('daily-cleanup', {}, {
      repeat: {
        pattern: '0 0 * * *' // Midnight every day
      }
    });
    logger.info('[Cleanup] Daily cleanup job scheduled.');
  }
};

// 4. Manual trigger function
const triggerManualCleanup = async () => {
  return await cleanupQueue.add('manual-cleanup', { manual: true });
};

module.exports = {
  scheduleCleanup,
  triggerManualCleanup
};

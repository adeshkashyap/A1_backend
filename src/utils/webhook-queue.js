const { Queue, Worker, QueueEvents } = require('bullmq');
const logger = require('../../lib/logger');
const { handleEvolutionWebhook } = require('../../lib/evolution-webhook-handler');

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
};

const webhookQueue = new Queue('webhook-processing', { 
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false // Keep failed jobs in the queue for DLQ analysis
  }
});

const worker = new Worker('webhook-processing', async (job) => {
  const { webhookData, instanceName } = job.data;
  
  try {
    // 4. Parallel processing: This callback runs up to 'concurrency' times in parallel
    await handleEvolutionWebhook(webhookData, instanceName);
  } catch (error) {
    logger.error(`[Queue] Error processing job ${job.id}: ${error.message}`);
    throw error;
  }
}, { 
  connection: redisOptions,
  concurrency: 10, // Process 10 webhooks in parallel per node
  limiter: {
    max: 1000,
    duration: 60000 // Max 1000 jobs per minute per node
  }
});

const dlqQueue = new Queue('webhook-dlq', { connection: redisOptions });

worker.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    logger.error(`[DLQ] Webhook job ${job.id} failed after ${job.opts.attempts} attempts: ${err.message}`);
    
    // Move to DLQ queue for persistence and manual retry later
    await dlqQueue.add('failed-webhook', {
      originalJobId: job.id,
      data: job.data,
      error: err.message,
      failedAt: new Date().toISOString()
    });
    
    logger.info(`[DLQ] Job ${job.id} successfully moved to webhook-dlq`);
  }
});

const addWebhookToQueue = async (webhookData, instanceName) => {
  await webhookQueue.add('process-webhook', { webhookData, instanceName });
};

module.exports = {
  addWebhookToQueue,
  webhookQueue
};

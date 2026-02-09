const redis = require('redis');
const logger = require('../../lib/logger');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => logger.error('Redis Client Error', err));
client.on('connect', () => logger.info('✅ Redis Client Connected'));

const connectRedis = async () => {
  if (!client.isOpen) {
    await client.connect();
  }
};

module.exports = {
  client,
  connectRedis
};

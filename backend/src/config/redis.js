'use strict';

const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient = null;

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times) => {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
};

const connectRedis = async () => {
  redisClient = new Redis(REDIS_CONFIG);

  redisClient.on('connect', () => logger.info('✅ Redis connected'));
  redisClient.on('ready', () => logger.info('✅ Redis ready'));
  redisClient.on('error', (err) => logger.error('Redis error:', err));
  redisClient.on('close', () => logger.warn('Redis connection closed'));
  redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  await redisClient.connect();
  await redisClient.ping();
  return redisClient;
};

const getRedisClient = () => {
  if (!redisClient) throw new Error('Redis not initialized. Call connectRedis() first.');
  return redisClient;
};

const QUEUE_NAME = process.env.REDIS_QUEUE_NAME || 'task_queue';

const pushToQueue = async (job) => {
  const client = getRedisClient();
  const payload = JSON.stringify(job);
  await client.rpush(QUEUE_NAME, payload);
  logger.info(`Job pushed to queue: ${job.taskId}`);
};

module.exports = { connectRedis, getRedisClient, pushToQueue, QUEUE_NAME };

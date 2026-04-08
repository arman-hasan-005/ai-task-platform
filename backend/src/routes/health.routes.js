'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { getRedisClient } = require('../config/redis');

const router = express.Router();

router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

router.get('/ready', async (req, res) => {
  const checks = {
    mongodb: 'disconnected',
    redis: 'disconnected',
  };

  try {
    if (mongoose.connection.readyState === 1) checks.mongodb = 'connected';
    const redis = getRedisClient();
    await redis.ping();
    checks.redis = 'connected';
  } catch (_) {}

  const allReady = Object.values(checks).every(v => v === 'connected');
  res.status(allReady ? 200 : 503).json({
    status: allReady ? 'ready' : 'not ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

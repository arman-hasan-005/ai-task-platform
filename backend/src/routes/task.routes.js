'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const { createTask, getTasks, getTask, deleteTask, retryTask, getStats } = require('../controllers/task.controller');
const { protect } = require('../middleware/auth.middleware');
const { taskRateLimiter } = require('../middleware/rate-limit.middleware');
const { TASK_OPERATIONS } = require('../models/task.model');

const router = express.Router();

router.use(protect);

router.get('/stats', getStats);

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('status').optional().isIn(['pending', 'running', 'success', 'failed']),
    query('operation').optional().isIn(Object.values(TASK_OPERATIONS)),
  ],
  getTasks
);

router.post(
  '/',
  taskRateLimiter,
  [
    body('title').trim().notEmpty().withMessage('Title required').isLength({ max: 100 }),
    body('inputText').trim().notEmpty().withMessage('Input text required').isLength({ max: 10000 }),
    body('operation').isIn(Object.values(TASK_OPERATIONS))
      .withMessage(`Operation must be one of: ${Object.values(TASK_OPERATIONS).join(', ')}`),
  ],
  createTask
);

router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid task ID')],
  getTask
);

router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid task ID')],
  deleteTask
);

router.post(
  '/:id/retry',
  [param('id').isMongoId().withMessage('Invalid task ID')],
  retryTask
);

module.exports = router;

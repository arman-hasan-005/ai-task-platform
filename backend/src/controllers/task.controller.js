'use strict';

const { validationResult } = require('express-validator');
const { Task, TASK_STATUS, TASK_OPERATIONS } = require('../models/task.model');
const { pushToQueue } = require('../config/redis');
const logger = require('../utils/logger');

// POST /api/tasks
const createTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { title, inputText, operation } = req.body;

    const task = await Task.create({
      title,
      inputText,
      operation,
      owner: req.user.id,
      status: TASK_STATUS.PENDING,
      logs: [{ level: 'info', message: 'Task created and queued for processing' }],
    });

    // Push to Redis queue
    await pushToQueue({
      taskId: task._id.toString(),
      operation: task.operation,
      inputText: task.inputText,
    });

    logger.info(`Task created: ${task._id} by user: ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Task created and queued',
      data: { task },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks
const getTasks = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const { status, operation, search } = req.query;

    const query = { owner: req.user.id };
    if (status && Object.values(TASK_STATUS).includes(status)) query.status = status;
    if (operation && Object.values(TASK_OPERATIONS).includes(operation)) query.operation = operation;
    if (search) query.title = { $regex: search, $options: 'i' };

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-logs -inputText')
        .lean(),
      Task.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        tasks,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks/:id
const getTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, owner: req.user.id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.status(200).json({ success: true, data: { task } });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/tasks/:id
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    logger.info(`Task deleted: ${req.params.id}`);
    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
};

// POST /api/tasks/:id/retry
const retryTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, owner: req.user.id });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (task.status !== TASK_STATUS.FAILED) {
      return res.status(400).json({ success: false, message: 'Only failed tasks can be retried' });
    }

    task.status = TASK_STATUS.PENDING;
    task.result = null;
    task.errorMessage = null;
    task.startedAt = null;
    task.completedAt = null;
    task.retryCount += 1;
    task.logs.push({ level: 'info', message: `Task queued for retry (attempt ${task.retryCount + 1})` });
    await task.save();

    await pushToQueue({ taskId: task._id.toString(), operation: task.operation, inputText: task.inputText });

    res.status(200).json({ success: true, message: 'Task queued for retry', data: { task } });
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks/stats
const getStats = async (req, res, next) => {
  try {
    const stats = await Task.aggregate([
      { $match: { owner: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = { pending: 0, running: 0, success: 0, failed: 0, total: 0 };
    stats.forEach(s => {
      result[s._id] = s.count;
      result.total += s.count;
    });

    const operationStats = await Task.aggregate([
      { $match: { owner: req.user._id } },
      { $group: { _id: '$operation', count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: { statusStats: result, operationStats },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createTask, getTasks, getTask, deleteTask, retryTask, getStats };

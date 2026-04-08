'use strict';

const mongoose = require('mongoose');

const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
};

const TASK_OPERATIONS = {
  UPPERCASE: 'uppercase',
  LOWERCASE: 'lowercase',
  REVERSE: 'reverse',
  WORD_COUNT: 'word_count',
};

const logEntrySchema = new mongoose.Schema(
  {
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    inputText: {
      type: String,
      required: [true, 'Input text is required'],
      maxlength: [10000, 'Input text cannot exceed 10,000 characters'],
    },
    operation: {
      type: String,
      required: [true, 'Operation is required'],
      enum: {
        values: Object.values(TASK_OPERATIONS),
        message: 'Operation must be one of: uppercase, lowercase, reverse, word_count',
      },
    },
    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.PENDING,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    logs: {
      type: [logEntrySchema],
      default: [],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    processingDurationMs: {
      type: Number,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    workerId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes for performance ───────────────────────────────────────────────────
taskSchema.index({ owner: 1, createdAt: -1 });       // User's tasks sorted by date
taskSchema.index({ status: 1, createdAt: 1 });        // Queue monitoring
taskSchema.index({ owner: 1, status: 1 });            // Filter by owner + status
taskSchema.index({ createdAt: -1 });                  // Global recency sort
taskSchema.index({ operation: 1, status: 1 });        // Operation analytics

// ─── Virtual ──────────────────────────────────────────────────────────────────
taskSchema.virtual('duration').get(function () {
  if (this.startedAt && this.completedAt) {
    return this.completedAt - this.startedAt;
  }
  return null;
});

module.exports = {
  Task: mongoose.model('Task', taskSchema),
  TASK_STATUS,
  TASK_OPERATIONS,
};

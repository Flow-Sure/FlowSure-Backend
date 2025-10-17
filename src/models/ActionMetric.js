const mongoose = require('mongoose');

const actionMetricSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    index: true
  },
  actionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  actionType: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'RETRYING', 'SUCCESS', 'FAILED', 'COMPENSATED'],
    default: 'PENDING',
    index: true
  },
  retries: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  amount: {
    type: Number,
    required: true
  },
  txHash: {
    type: String,
    index: true
  },
  lastAttemptAt: {
    type: Date
  }
}, {
  timestamps: true
});

actionMetricSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('ActionMetric', actionMetricSchema);

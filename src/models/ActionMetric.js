const mongoose = require('mongoose');

const actionMetricSchema = new mongoose.Schema({
  actionType: {
    type: String,
    required: true,
    index: true
  },
  success: {
    type: Boolean,
    required: true
  },
  retryCount: {
    type: Number,
    default: 0
  },
  executedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ActionMetric', actionMetricSchema);

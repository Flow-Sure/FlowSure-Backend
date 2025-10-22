const mongoose = require('mongoose');

const scheduledTransferSchema = new mongoose.Schema({
  userAddress: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  recipient: {
    type: String,
    required: function() {
      return !this.recipients || this.recipients.length === 0;
    }
  },
  recipients: [{
    address: {
      type: String,
      required: true
    },
    name: String
  }],
  recipientListId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecipientList'
  },
  amount: {
    type: Number,
    required: true
  },
  amountPerRecipient: {
    type: Boolean,
    default: true
  },
  scheduledDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'executing', 'completed', 'failed', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  retryLimit: {
    type: Number,
    default: 3
  },
  retryCount: {
    type: Number,
    default: 0
  },
  executedAt: {
    type: Date
  },
  transactionId: {
    type: String
  },
  transactionIds: [{
    recipient: String,
    transactionId: String,
    status: String,
    error: String
  }],
  errorMessage: {
    type: String
  },
  executionMethod: {
    type: String,
    enum: ['backend', 'flow_native'],
    default: 'backend'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: function() {
      return this.isRecurring;
    }
  },
  recurringEndDate: {
    type: Date
  },
  parentRecurringId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledTransfer'
  },
  nextScheduledDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
scheduledTransferSchema.index({ userAddress: 1, scheduledDate: -1 });
scheduledTransferSchema.index({ status: 1, scheduledDate: 1 });
scheduledTransferSchema.index({ userAddress: 1, status: 1 });

module.exports = mongoose.model('ScheduledTransfer', scheduledTransferSchema);

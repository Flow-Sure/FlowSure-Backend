const mongoose = require('mongoose');

const recipientListSchema = new mongoose.Schema({
  userAddress: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  recipients: [{
    address: {
      type: String,
      required: true
    },
    name: {
      type: String
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

recipientListSchema.index({ userAddress: 1, name: 1 });
recipientListSchema.index({ userAddress: 1, isActive: 1 });

module.exports = mongoose.model('RecipientList', recipientListSchema);

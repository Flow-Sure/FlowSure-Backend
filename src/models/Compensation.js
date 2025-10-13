const mongoose = require('mongoose');

const compensationSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    index: true
  },
  assetType: {
    type: String,
    required: true
  },
  assetId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  txId: {
    type: String,
    required: true,
    unique: true
  },
  paidAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Compensation', compensationSchema);

const mongoose = require('mongoose');

const stakerSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  stakedAmount: {
    type: Number,
    default: 0,
    index: true
  },
  discount: {
    type: Number,
    default: 0
  },
  lastStakedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Staker', stakerSchema);

const mongoose = require('mongoose');

const protectedAssetSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    index: true
  },
  assetType: {
    type: String,
    required: true,
    enum: ['NBA_TOP_SHOT', 'NFL_ALL_DAY', 'DISNEY_PINNACLE']
  },
  assetId: {
    type: String,
    required: true,
    index: true
  },
  actionId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    default: 'PROTECTED',
    enum: ['PROTECTED', 'SUCCESS', 'FAILED', 'COMPENSATED']
  },
  protectedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ProtectedAsset', protectedAssetSchema);

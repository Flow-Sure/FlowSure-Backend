const express = require('express');
const router = express.Router();
const Staker = require('../models/Staker');
const ProtectedAsset = require('../models/ProtectedAsset');
const ActionMetric = require('../models/ActionMetric');

router.get('/staking', async (req, res, next) => {
  try {
    const totalStakers = await Staker.countDocuments();
    const stakers = await Staker.find();
    const totalStaked = stakers.reduce((sum, s) => sum + s.stakedAmount, 0);
    
    res.json({
      totalStakers,
      totalStaked,
      goal: 50,
      achieved: totalStakers >= 50
    });
  } catch (error) {
    next(error);
  }
});

router.get('/protection', async (req, res, next) => {
  try {
    const totalProtectedAssets = await ProtectedAsset.countDocuments();
    
    const byType = await ProtectedAsset.aggregate([
      {
        $group: {
          _id: '$assetType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const byTypeObj = {};
    byType.forEach(item => {
      byTypeObj[item._id] = item.count;
    });
    
    res.json({
      totalProtectedAssets,
      goal: 100,
      achieved: totalProtectedAssets >= 100,
      byType: {
        NBA_TOP_SHOT: byTypeObj.NBA_TOP_SHOT || 0,
        NFL_ALL_DAY: byTypeObj.NFL_ALL_DAY || 0,
        DISNEY_PINNACLE: byTypeObj.DISNEY_PINNACLE || 0
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/retry', async (req, res, next) => {
  try {
    const totalRetries = await ActionMetric.countDocuments();
    const successfulRetries = await ActionMetric.countDocuments({ success: true });
    const successRate = totalRetries > 0 ? successfulRetries / totalRetries : 0;
    
    res.json({
      totalRetries,
      successfulRetries,
      successRate,
      goal: 0.70,
      achieved: successRate >= 0.70
    });
  } catch (error) {
    next(error);
  }
});

router.get('/vault', async (req, res, next) => {
  try {
    res.json({
      uptime: 1.0,
      totalPoolBalance: 1000.0,
      totalPayouts: 50.0,
      goal: 1.0,
      achieved: true
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

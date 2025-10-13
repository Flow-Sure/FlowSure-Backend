const express = require('express');
const router = express.Router();
const { fetchFrothPrice } = require('../services/dapperService');
const { queryStakerInfo, stakeTokens, unstakeTokens } = require('../services/flowService');
const { validateAddress, validateStakeAmount } = require('../middleware/validation');
const Staker = require('../models/Staker');

router.get('/price', async (req, res, next) => {
  try {
    const priceData = await fetchFrothPrice();
    res.json(priceData);
  } catch (error) {
    next(error);
  }
});

router.post('/stake', validateStakeAmount, async (req, res, next) => {
  try {
    const { user, amount } = req.body;
    
    const { txId, sealed } = await stakeTokens(user, amount);
    const stakerInfo = await queryStakerInfo(user);
    
    await Staker.findOneAndUpdate(
      { address: user },
      {
        stakedAmount: stakerInfo.stakedAmount,
        discount: stakerInfo.discount,
        lastStakedAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    res.json({
      txId,
      status: 'sealed',
      stakedAmount: amount,
      totalStaked: stakerInfo.stakedAmount,
      discount: stakerInfo.discount,
      discountPercentage: stakerInfo.discountPercentage
    });
  } catch (error) {
    next(error);
  }
});

router.post('/unstake', validateStakeAmount, async (req, res, next) => {
  try {
    const { user, amount } = req.body;
    
    const { txId, sealed } = await unstakeTokens(user, amount);
    const stakerInfo = await queryStakerInfo(user);
    
    await Staker.findOneAndUpdate(
      { address: user },
      {
        stakedAmount: stakerInfo.stakedAmount,
        discount: stakerInfo.discount,
        lastStakedAt: new Date()
      }
    );
    
    res.json({
      txId,
      status: 'sealed',
      remainingStaked: stakerInfo.stakedAmount,
      discount: stakerInfo.discount,
      discountPercentage: stakerInfo.discountPercentage
    });
  } catch (error) {
    next(error);
  }
});

router.get('/staker/:address', validateAddress, async (req, res, next) => {
  try {
    const { address } = req.params;
    const stakerInfo = await queryStakerInfo(address);
    res.json(stakerInfo);
  } catch (error) {
    next(error);
  }
});

router.get('/leaderboard', async (req, res, next) => {
  try {
    const stakers = await Staker.find()
      .sort({ stakedAmount: -1 })
      .limit(10);
    
    const totalStaked = stakers.reduce((sum, s) => sum + s.stakedAmount, 0);
    const totalStakers = await Staker.countDocuments();
    
    const topStakers = stakers.map((staker, index) => ({
      address: staker.address,
      stakedAmount: staker.stakedAmount,
      discount: staker.discount,
      rank: index + 1
    }));
    
    res.json({
      totalStaked,
      totalStakers,
      topStakers
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

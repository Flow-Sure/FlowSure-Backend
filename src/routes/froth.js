const express = require('express');
const router = express.Router();
const { fetchFrothPrice } = require('../services/dapperService');
const { queryStakerInfo, stakeTokens, unstakeTokens } = require('../services/flowService');
const { validateAddress, validateStakeAmount } = require('../middleware/validation');
const Staker = require('../models/Staker');
const autoCompoundService = require('../services/autoCompoundService');

/**
 * @swagger
 * /api/froth/price:
 *   get:
 *     summary: Get current FROTH token price
 *     tags: [FROTH]
 *     responses:
 *       200:
 *         description: Current FROTH price
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 price:
 *                   type: number
 *                   example: 0.15
 *                 currency:
 *                   type: string
 *                   example: USD
 *                 timestamp:
 *                   type: number
 *                 source:
 *                   type: string
 */
router.get('/price', async (req, res, next) => {
  try {
    const priceData = await fetchFrothPrice();
    res.json(priceData);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/froth/stake:
 *   post:
 *     summary: Stake FROTH tokens
 *     tags: [FROTH]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *               - amount
 *             properties:
 *               user:
 *                 type: string
 *                 example: "0x8401ed4fc6788c8a"
 *               amount:
 *                 type: number
 *                 example: 100.0
 *     responses:
 *       200:
 *         description: Staking successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 txId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 stakedAmount:
 *                   type: number
 *                 totalStaked:
 *                   type: number
 *                 discount:
 *                   type: number
 *                 discountPercentage:
 *                   type: number
 */
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

/**
 * @swagger
 * /api/froth/unstake:
 *   post:
 *     summary: Unstake FROTH tokens
 *     tags: [FROTH]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *               - amount
 *             properties:
 *               user:
 *                 type: string
 *                 example: "0x8401ed4fc6788c8a"
 *               amount:
 *                 type: number
 *                 example: 25.0
 *     responses:
 *       200:
 *         description: Unstaking successful
 */
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

/**
 * @swagger
 * /api/froth/staker/{address}:
 *   get:
 *     summary: Get staker information
 *     tags: [FROTH]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         example: "0x8401ed4fc6788c8a"
 *     responses:
 *       200:
 *         description: Staker information
 */
router.get('/staker/:address', validateAddress, async (req, res, next) => {
  try {
    const { address } = req.params;
    const stakerInfo = await queryStakerInfo(address);
    res.json(stakerInfo);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/froth/leaderboard:
 *   get:
 *     summary: Get staking leaderboard
 *     tags: [FROTH]
 *     responses:
 *       200:
 *         description: Top stakers leaderboard
 */
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

router.get('/auto-compound/config/:address', validateAddress, async (req, res, next) => {
  try {
    const { address } = req.params;
    const config = await autoCompoundService.getCompoundConfig(address);
    res.json(config);
  } catch (error) {
    next(error);
  }
});

router.get('/auto-compound/rewards/:address', validateAddress, async (req, res, next) => {
  try {
    const { address } = req.params;
    const amount = await autoCompoundService.getPendingRewards(address);
    res.json({ amount });
  } catch (error) {
    next(error);
  }
});

router.post('/auto-compound/enable', async (req, res, next) => {
  try {
    const { address, frequency } = req.body;
    const result = await autoCompoundService.enableAutoCompound(address, frequency);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/auto-compound/disable', async (req, res, next) => {
  try {
    const { address } = req.body;
    const result = await autoCompoundService.disableAutoCompound(address);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/auto-compound/execute', async (req, res, next) => {
  try {
    const { address } = req.body;
    const result = await autoCompoundService.executeCompound(address);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/auto-compound/stats', async (req, res, next) => {
  try {
    const stats = await autoCompoundService.getGlobalStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

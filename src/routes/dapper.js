const express = require('express');
const router = express.Router();
const { 
  fetchTopShotAssets, 
  fetchAllDayAssets, 
  fetchDisneyPinnacleAssets,
  fetchLinkedDapperAssets,
  fetchAllUserNFTs 
} = require('../services/dapperService');

const isTestnet = process.env.FLOW_NETWORK === 'testnet';
const { queryProtectedAssets, protectDapperAsset } = require('../services/flowService');
const { validateAddress, validateAssetType } = require('../middleware/validation');
const ProtectedAsset = require('../models/ProtectedAsset');
const Compensation = require('../models/Compensation');

/**
 * @swagger
 * /api/dapper/assets/{address}:
 *   get:
 *     summary: Get user's Dapper NFT assets
 *     tags: [Dapper]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         example: "0x8401ed4fc6788c8a"
 *     responses:
 *       200:
 *         description: User's NFT assets from all Dapper platforms
 */
router.get('/assets/:address', validateAddress, async (req, res, next) => {
  try {
    const { address } = req.params;
    
    let linkedAssets = [];
    
    if (isTestnet) {
      // On testnet, fetch ALL NFTs from user's wallet (including minted test NFTs)
      linkedAssets = await fetchAllUserNFTs(address);
      console.log(`[Testnet] Found ${linkedAssets.length} NFTs in wallet`);
    } else {
      // On mainnet, try to fetch from linked Dapper wallets using Account Linking
      linkedAssets = await fetchLinkedDapperAssets(address);
      
      // If no linked assets, fall back to direct wallet check
      if (!linkedAssets || linkedAssets.length === 0) {
        const [topShot, allDay, disney] = await Promise.all([
          fetchTopShotAssets(address),
          fetchAllDayAssets(address),
          fetchDisneyPinnacleAssets(address)
        ]);
        linkedAssets = [...topShot, ...allDay, ...disney];
      }
    }
    
    const protectedAssets = await queryProtectedAssets(address);
    const protectedIds = new Set(protectedAssets.map(a => a.assetId.toString()));
    
    // Transform to frontend format
    const transformAsset = (asset) => ({
      id: asset.id?.toString() || asset.id,
      name: asset.name || asset.playerName || 'Unknown',
      collection: asset.type || asset.collectionType || 'Unknown',
      image: asset.thumbnail || '/placeholder.svg',
      protected: protectedIds.has(asset.id?.toString()),
      linkedAddress: asset.linkedAddress || address,
      metadata: {
        serialNumber: asset.serialNumber,
        playCategory: asset.playCategory,
        teamAtMoment: asset.teamAtMoment,
        description: asset.description
      }
    });
    
    let allAssets = linkedAssets.map(transformAsset);
    
    // If user has no NFTs, provide demo data
    if (allAssets.length === 0) {
      allAssets = [
        {
          id: 'demo_1',
          name: 'LeBron James Dunk',
          collection: 'NBA Top Shot',
          image: '/placeholder.svg',
          protected: true,
          metadata: { serialNumber: 1234, playCategory: 'Dunk', teamAtMoment: 'Lakers' }
        },
        {
          id: 'demo_2',
          name: 'Patrick Mahomes TD Pass',
          collection: 'NFL All Day',
          image: '/placeholder.svg',
          protected: false,
          metadata: { serialNumber: 5678, playCategory: 'Touchdown', teamAtMoment: 'Chiefs' }
        },
        {
          id: 'demo_3',
          name: 'Mickey Mouse Classic',
          collection: 'Disney Pinnacle',
          image: '/placeholder.svg',
          protected: true,
          metadata: { serialNumber: 9012, playCategory: 'Classic', teamAtMoment: 'Disney' }
        },
        {
          id: 'demo_4',
          name: 'Stephen Curry 3-Pointer',
          collection: 'NBA Top Shot',
          image: '/placeholder.svg',
          protected: false,
          metadata: { serialNumber: 3456, playCategory: '3-Pointer', teamAtMoment: 'Warriors' }
        }
      ];
    }
    
    res.json({ 
      assets: allAssets,
      topShot: topShot.map(a => transformAsset(a, 'NBA Top Shot')), 
      allDay: allDay.map(a => transformAsset(a, 'NFL All Day')), 
      disneyPinnacle: disney.map(a => transformAsset(a, 'Disney Pinnacle'))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/dapper/insure:
 *   post:
 *     summary: Insure a Dapper NFT asset
 *     tags: [Dapper]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user
 *               - assetType
 *               - assetId
 *               - actionType
 *             properties:
 *               user:
 *                 type: string
 *                 example: "0x8401ed4fc6788c8a"
 *               assetType:
 *                 type: string
 *                 enum: [NBA_TOP_SHOT, NFL_ALL_DAY, DISNEY_PINNACLE]
 *                 example: "NBA_TOP_SHOT"
 *               assetId:
 *                 type: number
 *                 example: 12345
 *               actionType:
 *                 type: string
 *                 example: "PACK_OPENING"
 *     responses:
 *       200:
 *         description: Asset protection successful
 */
router.post('/insure', validateAssetType, async (req, res, next) => {
  try {
    const { user, assetType, assetId, actionType } = req.body;
    
    if (!assetId || !actionType) {
      return res.status(400).json({ error: 'assetId and actionType are required' });
    }
    
    const { txId, sealed } = await protectDapperAsset(user, assetType, assetId, actionType);
    
    const protectedEvent = sealed.events.find(
      e => e.type.includes('DapperAssetProtectedEvent')
    );
    
    const actionId = protectedEvent?.data?.actionId || `${assetType}_${assetId}_${Date.now()}`;
    
    await ProtectedAsset.create({
      user,
      assetType,
      assetId: assetId.toString(),
      actionId,
      status: 'PROTECTED',
      protectedAt: new Date()
    });
    
    res.json({
      txId,
      actionId,
      status: 'protected',
      assetType,
      assetId,
      compensation: 5.0,
      maxRetries: 3
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/dapper/history/{address}:
 *   get:
 *     summary: Get protection history for an address
 *     tags: [Dapper]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         example: "0x8401ed4fc6788c8a"
 *     responses:
 *       200:
 *         description: Protection history and compensations
 */
router.get('/history/:address', validateAddress, async (req, res, next) => {
  try {
    const { address } = req.params;
    
    const protectedAssets = await ProtectedAsset.find({ user: address })
      .sort({ protectedAt: -1 });
    
    const compensations = await Compensation.find({ user: address })
      .sort({ paidAt: -1 });
    
    const formattedAssets = protectedAssets.map(asset => ({
      assetId: asset.assetId,
      assetType: asset.assetType,
      status: asset.status,
      protectedAt: Math.floor(asset.protectedAt.getTime() / 1000),
      compensated: asset.status === 'COMPENSATED'
    }));
    
    const formattedCompensations = compensations.map(comp => ({
      assetId: comp.assetId,
      assetType: comp.assetType,
      amount: comp.amount,
      timestamp: Math.floor(comp.paidAt.getTime() / 1000)
    }));
    
    res.json({
      protectedAssets: formattedAssets,
      compensations: formattedCompensations,
      totalProtected: protectedAssets.length,
      totalCompensated: compensations.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

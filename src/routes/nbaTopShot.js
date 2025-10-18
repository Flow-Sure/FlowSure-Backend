const express = require('express');
const router = express.Router();
const nbaTopShotService = require('../services/nbaTopShotService');

/**
 * @swagger
 * /api/nba-topshot/moments/{address}:
 *   get:
 *     summary: Get user's NBA Top Shot moments
 *     tags: [NBA Top Shot]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: User's Flow address
 *     responses:
 *       200:
 *         description: List of moments
 *       500:
 *         description: Server error
 */
router.get('/moments/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const moments = await nbaTopShotService.getUserMoments(address);
    
    res.json({
      success: true,
      count: moments.length,
      data: moments
    });
  } catch (error) {
    console.error('Error fetching moments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/nba-topshot/moment/{momentId}:
 *   get:
 *     summary: Get moment details
 *     tags: [NBA Top Shot]
 *     parameters:
 *       - in: path
 *         name: momentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Moment ID
 *     responses:
 *       200:
 *         description: Moment details
 *       404:
 *         description: Moment not found
 *       500:
 *         description: Server error
 */
router.get('/moment/:momentId', async (req, res) => {
  try {
    const { momentId } = req.params;
    const moment = await nbaTopShotService.getMomentDetails(momentId);
    
    if (!moment) {
      return res.status(404).json({
        success: false,
        error: 'Moment not found'
      });
    }
    
    res.json({
      success: true,
      data: moment
    });
  } catch (error) {
    console.error('Error fetching moment details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/nba-topshot/protected/{address}:
 *   get:
 *     summary: Get user's protected moments
 *     tags: [NBA Top Shot]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: User's Flow address
 *     responses:
 *       200:
 *         description: Protected moments with recommendations
 *       500:
 *         description: Server error
 */
router.get('/protected/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const protectedMoments = await nbaTopShotService.getProtectedMoments(address);
    
    res.json({
      success: true,
      count: protectedMoments.length,
      data: protectedMoments
    });
  } catch (error) {
    console.error('Error fetching protected moments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/nba-topshot/marketplace:
 *   get:
 *     summary: Get marketplace listings
 *     tags: [NBA Top Shot]
 *     parameters:
 *       - in: query
 *         name: playerName
 *         schema:
 *           type: string
 *       - in: query
 *         name: setName
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Marketplace listings
 *       500:
 *         description: Server error
 */
router.get('/marketplace', async (req, res) => {
  try {
    const filters = {
      playerName: req.query.playerName,
      setName: req.query.setName,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : null,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : null,
      limit: req.query.limit ? parseInt(req.query.limit) : 20
    };
    
    const listings = await nbaTopShotService.getMarketplaceListings(filters);
    
    res.json({
      success: true,
      count: listings.length,
      data: listings
    });
  } catch (error) {
    console.error('Error fetching marketplace listings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/nba-topshot/value/{momentId}:
 *   get:
 *     summary: Calculate moment value
 *     tags: [NBA Top Shot]
 *     parameters:
 *       - in: path
 *         name: momentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Moment value and protection recommendation
 *       404:
 *         description: Moment not found
 *       500:
 *         description: Server error
 */
router.get('/value/:momentId', async (req, res) => {
  try {
    const { momentId } = req.params;
    const moment = await nbaTopShotService.getMomentDetails(momentId);
    
    if (!moment) {
      return res.status(404).json({
        success: false,
        error: 'Moment not found'
      });
    }
    
    const value = nbaTopShotService.calculateMomentValue(moment);
    const protection = nbaTopShotService.getProtectionRecommendation(moment);
    
    res.json({
      success: true,
      data: {
        momentId,
        value,
        protection
      }
    });
  } catch (error) {
    console.error('Error calculating moment value:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

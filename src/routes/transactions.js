const express = require('express');
const router = express.Router();
const { executeInsuredAction, getActionStatus, getUserActions } = require('../services/transactionService');
const { validateAddress } = require('../middleware/validation');

router.post('/execute', async (req, res, next) => {
  try {
    const { user, actionType, amount, recipient, retryLimit, txHash, status } = req.body;
    
    if (!user || !actionType || !amount) {
      return res.status(400).json({ error: 'user, actionType, and amount are required' });
    }
    
    const result = await executeInsuredAction(user, actionType, amount, recipient, retryLimit || 3, txHash, status);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/action/:actionId', async (req, res, next) => {
  try {
    const { actionId } = req.params;
    const status = await getActionStatus(actionId);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

router.get('/user/:address', validateAddress, async (req, res, next) => {
  try {
    const { address } = req.params;
    const actions = await getUserActions(address);
    res.json(actions);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

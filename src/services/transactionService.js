const fcl = require('../config/flow');
const ActionMetric = require('../models/ActionMetric');

const executeInsuredAction = async (user, actionType, amount, recipient, retryLimit, txHash, status) => {
  const actionId = `${actionType}_${user}_${Date.now()}`;
  
  await ActionMetric.create({
    user,
    actionId,
    actionType,
    status: status || 'SUCCESS',
    retries: 0,
    maxRetries: retryLimit,
    amount: parseFloat(amount),
    txHash: txHash || null,
    createdAt: new Date()
  });
  
  return {
    actionId,
    status: status || 'success',
    actionType,
    amount,
    retryLimit,
    txHash,
    estimatedCompletion: Date.now() + 30000
  };
};

const getActionStatus = async (actionId) => {
  const action = await ActionMetric.findOne({ actionId });
  
  if (!action) {
    throw new Error('Action not found');
  }
  
  return {
    actionId: action.actionId,
    status: action.status,
    retries: action.retries,
    maxRetries: action.maxRetries,
    actionType: action.actionType,
    amount: action.amount,
    createdAt: action.createdAt,
    lastAttempt: action.lastAttemptAt
  };
};

const getUserActions = async (address) => {
  const actions = await ActionMetric.find({ user: address })
    .sort({ createdAt: -1 })
    .limit(50);
  
  const formatted = actions.map(action => ({
    actionId: action.actionId,
    actionType: action.actionType,
    status: action.status,
    retries: action.retries,
    maxRetries: action.maxRetries,
    amount: action.amount,
    txHash: action.txHash,
    createdAt: Math.floor(action.createdAt.getTime() / 1000),
    lastAttempt: action.lastAttemptAt ? Math.floor(action.lastAttemptAt.getTime() / 1000) : null
  }));
  
  const stats = {
    total: actions.length,
    pending: actions.filter(a => a.status === 'PENDING').length,
    success: actions.filter(a => a.status === 'SUCCESS').length,
    failed: actions.filter(a => a.status === 'FAILED').length,
    compensated: actions.filter(a => a.status === 'COMPENSATED').length
  };
  
  return {
    actions: formatted,
    stats
  };
};

module.exports = {
  executeInsuredAction,
  getActionStatus,
  getUserActions
};

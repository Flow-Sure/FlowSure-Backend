const fcl = require('@onflow/fcl');

fcl.config({
  'accessNode.api': process.env.FLOW_ACCESS_NODE || 'https://rest-testnet.onflow.org',
  'discovery.wallet': 'https://fcl-discovery.onflow.org/testnet/authn',
  'app.detail.title': 'FlowSure',
  'app.detail.icon': 'https://flowsure.io/logo.png',
  '0xFrothRewards': process.env.FROTH_REWARDS_ADDRESS || '0x8401ed4fc6788c8a',
  '0xAutoCompound': process.env.AUTO_COMPOUND_ADDRESS || '0x8401ed4fc6788c8a',
  '0xScheduler': process.env.SCHEDULER_ADDRESS || '0x8401ed4fc6788c8a',
  '0xDapperProtection': process.env.DAPPER_PROTECTION_ADDRESS || '0x8401ed4fc6788c8a'
});

module.exports = fcl;

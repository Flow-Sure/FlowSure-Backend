const fcl = require('@onflow/fcl');

fcl.config({
  'accessNode.api': process.env.FLOW_ACCESS_NODE || 'https://rest-testnet.onflow.org',
  'discovery.wallet': 'https://fcl-discovery.onflow.org/testnet/authn',
  'app.detail.title': 'FlowSure',
  'app.detail.icon': 'https://flowsure.io/logo.png',
  '0xFrothRewards': process.env.FROTH_REWARDS_ADDRESS,
  '0xDapperProtection': process.env.DAPPER_PROTECTION_ADDRESS
});

module.exports = fcl;

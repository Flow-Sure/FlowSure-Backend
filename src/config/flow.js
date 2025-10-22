const fcl = require('@onflow/fcl');
const { SHA3 } = require('sha3');
const elliptic = require('elliptic');

fcl.config({
  'accessNode.api': process.env.FLOW_ACCESS_NODE || 'https://rest-testnet.onflow.org',
  'discovery.wallet': 'https://fcl-discovery.onflow.org/testnet/authn',
  'app.detail.title': 'FlowSure',
  'app.detail.icon': 'https://flowsure.io/logo.png',
  '0xFrothRewards': process.env.FROTH_REWARDS_ADDRESS || '0x8401ed4fc6788c8a',
  '0xAutoCompound': process.env.AUTO_COMPOUND_ADDRESS || '0x8401ed4fc6788c8a',
  '0xScheduler': process.env.SCHEDULER_ADDRESS || '0x8401ed4fc6788c8a',
  '0xDapperProtection': process.env.DAPPER_PROTECTION_ADDRESS || '0x8401ed4fc6788c8a',
  '0xScheduledTransfer': process.env.SCHEDULER_ADDRESS || '0x8401ed4fc6788c8a',
  '0xFlowTransactionScheduler': '0x8c5303eaa26202d6'
});

/**
 * Get service account authorization for signing transactions
 */
const getServiceAccountAuthorization = () => {
  const address = process.env.FLOW_SERVICE_ACCOUNT_ADDRESS;
  const privateKey = process.env.FLOW_SERVICE_ACCOUNT_PRIVATE_KEY;
  const keyId = parseInt(process.env.FLOW_SERVICE_ACCOUNT_KEY_ID || '0');

  if (!address || !privateKey) {
    throw new Error('Service account credentials not configured. Set FLOW_SERVICE_ACCOUNT_ADDRESS and FLOW_SERVICE_ACCOUNT_PRIVATE_KEY in .env');
  }

  return async (account = {}) => {
    const ec = new elliptic.ec('p256');
    const key = ec.keyFromPrivate(Buffer.from(privateKey, 'hex'));

    const sign = async (signable) => {
      const hash = new SHA3(256);
      hash.update(Buffer.from(signable.message, 'hex'));
      const digest = hash.digest();
      
      const signature = key.sign(digest);
      const n = 32;
      const r = signature.r.toArrayLike(Buffer, 'be', n);
      const s = signature.s.toArrayLike(Buffer, 'be', n);
      
      return {
        addr: fcl.withPrefix(address),
        keyId,
        signature: Buffer.concat([r, s]).toString('hex')
      };
    };

    return {
      ...account,
      addr: fcl.withPrefix(address),
      keyId,
      signingFunction: sign
    };
  };
};

module.exports = {
  fcl,
  getServiceAccountAuthorization
};

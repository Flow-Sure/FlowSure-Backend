#!/usr/bin/env node

/**
 * Verify service account credentials
 * This script checks if the private key matches the account's public key
 */

const fs = require('fs');
const path = require('path');
const fcl = require('@onflow/fcl');
const elliptic = require('elliptic');

// Simple .env parser
function loadEnv() {
  const envPath = path.join(__dirname, 'FlowSure-Backend', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found at:', envPath);
    console.log('   Create FlowSure-Backend/.env from .env.example\n');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

loadEnv();

// Configure FCL
fcl.config({
  'accessNode.api': process.env.FLOW_ACCESS_NODE || 'https://rest-testnet.onflow.org'
});

async function verifyServiceAccount() {
  const address = process.env.FLOW_SERVICE_ACCOUNT_ADDRESS;
  const privateKey = process.env.FLOW_SERVICE_ACCOUNT_PRIVATE_KEY;
  const keyId = parseInt(process.env.FLOW_SERVICE_ACCOUNT_KEY_ID || '0');

  console.log('\n🔍 Verifying Service Account Credentials\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Address: ${address}`);
  console.log(`Key ID: ${keyId}`);
  console.log(`Private Key: ${privateKey ? privateKey.substring(0, 16) + '...' : 'NOT SET'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!address || !privateKey) {
    console.error('❌ Service account credentials not configured in .env file');
    console.log('\nRequired environment variables:');
    console.log('  FLOW_SERVICE_ACCOUNT_ADDRESS=0x...');
    console.log('  FLOW_SERVICE_ACCOUNT_PRIVATE_KEY=...');
    console.log('  FLOW_SERVICE_ACCOUNT_KEY_ID=0\n');
    process.exit(1);
  }

  try {
    // Get public key from private key
    const ec = new elliptic.ec('p256');
    const key = ec.keyFromPrivate(Buffer.from(privateKey, 'hex'));
    const publicKey = key.getPublic('hex').substring(2); // Remove '04' prefix

    console.log('📝 Derived from Private Key:');
    console.log(`   Public Key: ${publicKey}\n`);

    // Get account info from blockchain
    const script = `
      access(all) fun main(address: Address): {String: AnyStruct} {
        let account = getAccount(address)
        let keys: [{String: AnyStruct}] = []
        
        account.keys.forEach(fun (key: AccountKey): Bool {
          keys.append({
            "index": key.keyIndex,
            "publicKey": key.publicKey.publicKey.decodeHex(),
            "signAlgo": key.publicKey.signatureAlgorithm.rawValue,
            "hashAlgo": key.hashAlgorithm.rawValue,
            "weight": key.weight,
            "isRevoked": key.isRevoked
          })
          return true
        })
        
        return {
          "address": address,
          "balance": account.balance,
          "keys": keys
        }
      }
    `;

    const accountInfo = await fcl.query({
      cadence: script,
      args: (arg, t) => [arg(address, t.Address)]
    });

    console.log('🔗 On-Chain Account Info:');
    console.log(`   Address: ${accountInfo.address}`);
    console.log(`   Balance: ${accountInfo.balance} FLOW`);
    console.log(`   Total Keys: ${accountInfo.keys.length}\n`);

    if (accountInfo.balance === '0.00000000') {
      console.log('⚠️  WARNING: Account has 0 FLOW balance!');
      console.log('   Get testnet FLOW from: https://testnet-faucet.onflow.org/\n');
    }

    // Check if the key matches
    let keyFound = false;
    let keyMatch = false;

    accountInfo.keys.forEach((accountKey, index) => {
      const onChainPublicKey = Buffer.from(accountKey.publicKey).toString('hex');
      const isMatch = onChainPublicKey === publicKey;
      
      console.log(`📌 Key ${accountKey.index}:`);
      console.log(`   Public Key: ${onChainPublicKey}`);
      console.log(`   Sign Algo: ${accountKey.signAlgo} (2 = ECDSA_P256)`);
      console.log(`   Hash Algo: ${accountKey.hashAlgo} (3 = SHA3_256)`);
      console.log(`   Weight: ${accountKey.weight}`);
      console.log(`   Revoked: ${accountKey.isRevoked}`);
      console.log(`   Matches Private Key: ${isMatch ? '✅ YES' : '❌ NO'}\n`);

      if (accountKey.index === keyId) {
        keyFound = true;
        keyMatch = isMatch;
      }
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (!keyFound) {
      console.error(`❌ Key ID ${keyId} not found on account!`);
      console.log(`   Available key IDs: ${accountInfo.keys.map(k => k.index).join(', ')}`);
      console.log(`   Update FLOW_SERVICE_ACCOUNT_KEY_ID in .env\n`);
      process.exit(1);
    }

    if (!keyMatch) {
      console.error(`❌ Private key does NOT match public key at index ${keyId}!`);
      console.log('\n   Possible issues:');
      console.log('   1. Wrong private key in .env file');
      console.log('   2. Wrong account address in .env file');
      console.log('   3. Wrong key ID in .env file');
      console.log('\n   Solution:');
      console.log('   - Verify you have the correct private key for this account');
      console.log('   - Check the key was added to the account on Flow blockchain');
      console.log('   - Use: flow keys list --signer <account-name>\n');
      process.exit(1);
    }

    console.log('✅ SUCCESS! Service account credentials are valid!\n');
    console.log('   The private key matches the public key on the blockchain.');
    console.log('   The backend can now sign transactions for scheduled transfers.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

verifyServiceAccount();

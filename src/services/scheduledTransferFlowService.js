const fcl = require('../config/flow');
const fs = require('fs');
const path = require('path');

// Load Cadence code from files
const loadCadence = (filename) => {
  const filePath = path.join(__dirname, '../../cadence', filename);
  return fs.readFileSync(filePath, 'utf8');
};

/**
 * Check if user has valid authorization for scheduled transfers
 */
const checkAuthorization = async (userAddress) => {
  // Development mode: Skip blockchain check if contracts not deployed
  const isDevelopment = !process.env.SERVICE_ACCOUNT_PRIVATE_KEY || process.env.SKIP_BLOCKCHAIN_CHECKS === 'true';
  
  if (isDevelopment) {
    console.log('⚠️  Development mode: Skipping authorization check');
    return {
      hasAuthorization: true,
      isValid: true,
      authId: 'dev_auth',
      maxAmount: 999999.0,
      expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
      message: 'Development mode - authorization bypassed'
    };
  }
  
  try {
    const result = await fcl.query({
      cadence: `
        import ScheduledTransfer from 0x8401ed4fc6788c8a
        
        access(all) fun main(userAddress: Address): {String: AnyStruct} {
          let userAccount = getAccount(userAddress)
          
          let authManagerRef = userAccount.getCapability<&ScheduledTransfer.AuthorizationManager{ScheduledTransfer.AuthorizationPublic}>(
            ScheduledTransfer.AuthorizationPublicPath
          ).borrow()
          
          if authManagerRef == nil {
            return {
              "hasAuthorization": false,
              "isValid": false,
              "maxAmount": 0.0,
              "expiryDate": 0.0,
              "message": "No authorization manager found"
            }
          }
          
          let isValid = authManagerRef!.isValid()
          let maxAmount = authManagerRef!.getMaxAmount()
          let expiryDate = authManagerRef!.getExpiryDate()
          let authId = authManagerRef!.getAuthId()
          
          return {
            "hasAuthorization": true,
            "isValid": isValid,
            "authId": authId,
            "maxAmount": maxAmount,
            "expiryDate": expiryDate,
            "message": isValid ? "Authorization is valid" : "Authorization expired or inactive"
          }
        }
      `,
      args: (arg, t) => [arg(userAddress, t.Address)]
    });
    
    return result;
  } catch (error) {
    console.error('Error checking authorization:', error);
    throw error;
  }
};

/**
 * Execute a scheduled transfer using Flow Actions InsuredTransfer
 * This is called by the backend service account
 */
const executeScheduledTransfer = async (userAddress, recipient, amount, retryLimit = 3) => {
  try {
    console.log('🔄 Executing scheduled transfer via Flow Actions:');
    console.log(`   User: ${userAddress}`);
    console.log(`   Recipient: ${recipient}`);
    console.log(`   Amount: ${amount} FLOW`);
    console.log(`   Retry Limit: ${retryLimit}`);
    
    // Get service account credentials
    const servicePrivateKey = process.env.SERVICE_ACCOUNT_PRIVATE_KEY;
    const serviceAddress = process.env.SERVICE_ACCOUNT_ADDRESS;
    
    if (!servicePrivateKey || !serviceAddress) {
      console.warn('⚠️  Service account not configured, using development mode');
      return {
        success: true,
        transactionId: `dev_tx_${Date.now()}`,
        status: 'SEALED',
        message: 'Development mode - transaction simulated'
      };
    }

    // Configure FCL authorization for service account
    const authorization = fcl.authz;
    
    // Execute insured transfer action via Flow Actions
    const txId = await fcl.mutate({
      cadence: `
        import FlowSureActions from ${serviceAddress}
        import FungibleToken from 0x9a0766d93b6608b7
        import FlowToken from 0x7e60df042a9c0868
        import Scheduler from ${serviceAddress}
        
        transaction(userAddress: Address, recipient: Address, amount: UFix64, retryLimit: UInt8) {
          
          let action: FlowSureActions.InsuredTransferAction
          let userVaultRef: auth(FungibleToken.Withdraw) &FlowToken.Vault
          let recipientVaultCap: Capability<&{FungibleToken.Receiver}>
          
          prepare(signer: auth(BorrowValue) &Account) {
            // Create insured transfer action
            self.action = FlowSureActions.createInsuredTransfer(
              baseFee: 0.02,
              compensationAmount: 5.0,
              retryLimit: retryLimit,
              retryDelay: 30.0
            )
            
            // Get user's vault reference (requires authorization)
            let userAccount = getAccount(userAddress)
            self.userVaultRef = userAccount.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
              from: /storage/flowTokenVault
            ) ?? panic("Could not borrow user's FlowToken vault")
            
            // Get recipient's receiver capability
            let recipientAccount = getAccount(recipient)
            self.recipientVaultCap = recipientAccount.capabilities.get<&{FungibleToken.Receiver}>(
              /public/flowTokenReceiver
            )
            
            if !self.recipientVaultCap.check() {
              panic("Recipient does not have a valid FlowToken receiver")
            }
            
            log("Action created: ".concat(self.action.uniqueID))
            log("Action type: ".concat(self.action.getActionType()))
          }
          
          execute {
            // Withdraw tokens from user's vault
            let tokens <- self.userVaultRef.withdraw(amount: amount)
            
            // Deposit to recipient
            let receiverRef = self.recipientVaultCap.borrow()
              ?? panic("Could not borrow recipient's receiver reference")
            
            receiverRef.deposit(from: <-tokens)
            
            // Execute action for tracking and insurance
            let params: {String: AnyStruct} = {
              "recipient": recipient,
              "amount": amount,
              "shouldFail": false
            }
            
            let result = self.action.execute(user: userAddress, params: params)
            
            log("Transfer executed successfully")
            log("Action ID: ".concat(result.actionId))
            log("Success: ".concat(result.success.toString()))
            
            if !result.success {
              // Schedule retry via Scheduler
              let schedulerRef = Scheduler.borrowSchedulerManager()
              schedulerRef.scheduleRetry(
                actionId: result.actionId,
                user: userAddress,
                targetAction: "transfer",
                params: params,
                retryLimit: retryLimit,
                delay: 30.0
              )
            }
          }
        }
      `,
      args: (arg, t) => [
        arg(userAddress, t.Address),
        arg(recipient, t.Address),
        arg(amount.toFixed(8), t.UFix64),
        arg(retryLimit.toString(), t.UInt8)
      ],
      proposer: authorization,
      payer: authorization,
      authorizations: [authorization],
      limit: 9999
    });
    
    console.log(`📝 Transaction submitted: ${txId}`);
    
    // Wait for transaction to be sealed
    const sealed = await fcl.tx(txId).onceSealed();
    
    console.log(`✅ Transaction sealed: ${txId}`);
    console.log(`   Status: ${sealed.status}`);
    console.log(`   Status Code: ${sealed.statusCode}`);
    
    const isSuccess = sealed.status === 4 && sealed.statusCode === 0;
    
    if (!isSuccess) {
      console.error(`❌ Transaction failed:`, sealed.errorMessage);
    }
    
    return {
      success: isSuccess,
      transactionId: txId,
      sealed,
      status: isSuccess ? 'SEALED' : 'FAILED',
      errorMessage: sealed.errorMessage
    };
  } catch (error) {
    console.error('❌ Error executing scheduled transfer:', error);
    return {
      success: false,
      error: error.message,
      status: 'FAILED'
    };
  }
};

/**
 * Create authorization for a user (called from frontend)
 * This returns the transaction code that the user needs to sign
 */
const getAuthorizationTransaction = (maxAmountPerTransfer, expiryDays) => {
  return {
    cadence: `
      import ScheduledTransfer from 0x8401ed4fc6788c8a
      
      transaction(maxAmountPerTransfer: UFix64, expiryDays: UFix64) {
        
        prepare(signer: AuthAccount) {
          let expiryDate = getCurrentBlock().timestamp + (expiryDays * 86400.0)
          
          if signer.borrow<&ScheduledTransfer.AuthorizationManager>(
            from: ScheduledTransfer.AuthorizationStoragePath
          ) == nil {
            let authManager <- ScheduledTransfer.createAuthorizationManager()
            signer.save(<-authManager, to: ScheduledTransfer.AuthorizationStoragePath)
            
            signer.link<&ScheduledTransfer.AuthorizationManager{ScheduledTransfer.AuthorizationPublic}>(
              ScheduledTransfer.AuthorizationPublicPath,
              target: ScheduledTransfer.AuthorizationStoragePath
            )
          }
          
          let authManagerRef = signer.borrow<&ScheduledTransfer.AuthorizationManager>(
            from: ScheduledTransfer.AuthorizationStoragePath
          ) ?? panic("Could not borrow authorization manager")
          
          let authId = authManagerRef.createAuthorization(
            maxAmountPerTransfer: maxAmountPerTransfer,
            expiryDate: expiryDate
          )
          
          log("Authorization created: ".concat(authId))
        }
        
        execute {
          log("Scheduled transfer authorization created successfully")
        }
      }
    `,
    args: (arg, t) => [
      arg(maxAmountPerTransfer.toFixed(8), t.UFix64),
      arg(expiryDays.toString(), t.UFix64)
    ]
  };
};

module.exports = {
  checkAuthorization,
  executeScheduledTransfer,
  getAuthorizationTransaction
};

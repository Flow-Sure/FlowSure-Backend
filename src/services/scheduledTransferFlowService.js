const { fcl } = require('../config/flow');
const fs = require('fs');
const path = require('path');

// Load Cadence code from files
const loadCadence = (filename) => {
  const filePath = path.join(__dirname, '../../cadence', filename);
  return fs.readFileSync(filePath, 'utf8');
};

/**
 * Check if user has initialized the scheduled transfer handler
 */
const checkHandlerInitialized = async (userAddress) => {
  try {
    const result = await fcl.query({
      cadence: `
        import ScheduledTransfer from 0x8401ed4fc6788c8a
        
        access(all) fun main(userAddress: Address): Bool {
          let userAccount = getAccount(userAddress)
          
          // Check if handler exists in storage
          let hasHandler = userAccount.storage.check<@AnyResource>(from: ScheduledTransfer.HandlerStoragePath)
          
          return hasHandler
        }
      `,
      args: (arg, t) => [arg(userAddress, t.Address)]
    });
    
    return {
      hasHandler: result,
      message: result ? 'Handler initialized' : 'Handler not initialized'
    };
  } catch (error) {
    console.error('Error checking handler:', error);
    throw error;
  }
};

/**
 * Get the transaction code for initializing the scheduled transfer handler
 * User must sign this once before scheduling any transfers
 */
const getInitHandlerTransaction = () => {
  return {
    cadence: `
      import ScheduledTransfer from 0x8401ed4fc6788c8a
      import FlowTransactionScheduler from 0x8c5303eaa26202d6

      transaction() {
        prepare(signer: auth(Storage, Capabilities) &Account) {
          // Save handler if not already present
          if signer.storage.borrow<&AnyResource>(from: ScheduledTransfer.HandlerStoragePath) == nil {
            let handler <- ScheduledTransfer.createHandler()
            signer.storage.save(<-handler, to: ScheduledTransfer.HandlerStoragePath)
          }

          // Issue entitled capability for execution
          let _ = signer.capabilities.storage
            .issue<auth(FlowTransactionScheduler.Execute) &{FlowTransactionScheduler.TransactionHandler}>(ScheduledTransfer.HandlerStoragePath)

          // Issue public capability
          let publicCap = signer.capabilities.storage
            .issue<&{FlowTransactionScheduler.TransactionHandler}>(ScheduledTransfer.HandlerStoragePath)

          signer.capabilities.publish(publicCap, at: ScheduledTransfer.HandlerPublicPath)
          
          log("Scheduled transfer handler initialized")
        }
      }
    `,
    args: (arg, t) => []
  };
};

/**
 * Get the transaction code for scheduling a transfer
 * User signs this to schedule a transfer at a future time
 */
const getScheduleTransferTransaction = (recipient, amount, delaySeconds) => {
  return {
    cadence: `
      import ScheduledTransfer from 0x8401ed4fc6788c8a
      import FlowTransactionScheduler from 0x8c5303eaa26202d6
      import FlowToken from 0x7e60df042a9c0868
      import FungibleToken from 0x9a0766d93b6608b7

      transaction(recipient: Address, amount: UFix64, delaySeconds: UFix64) {
        prepare(signer: auth(Storage, Capabilities) &Account) {
          let future = getCurrentBlock().timestamp + delaySeconds
          let priority = FlowTransactionScheduler.Priority.Medium
          let executionEffort: UInt64 = 1000
          
          let transferData = ScheduledTransfer.TransferData(
            recipient: recipient,
            amount: amount
          )
          
          let estimate = FlowTransactionScheduler.estimate(
            data: transferData,
            timestamp: future,
            priority: priority,
            executionEffort: executionEffort
          )
          
          assert(
            estimate.timestamp != nil || priority == FlowTransactionScheduler.Priority.Low,
            message: estimate.error ?? "estimation failed"
          )
          
          let vaultRef = signer.storage
            .borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow FlowToken vault")
          let fees <- vaultRef.withdraw(amount: estimate.flowFee ?? 0.0) as! @FlowToken.Vault
          
          var handlerCap: Capability<auth(FlowTransactionScheduler.Execute) &{FlowTransactionScheduler.TransactionHandler}>? = nil
          
          let controllers = signer.capabilities.storage.getControllers(forPath: ScheduledTransfer.HandlerStoragePath)
          
          for controller in controllers {
            if let cap = controller.capability as? Capability<auth(FlowTransactionScheduler.Execute) &{FlowTransactionScheduler.TransactionHandler}> {
              handlerCap = cap
              break
            }
          }
          
          assert(handlerCap != nil, message: "Could not get handler capability")
          
          FlowTransactionScheduler.schedule(
            handlerCap: handlerCap!,
            data: transferData,
            timestamp: future,
            priority: priority,
            executionEffort: executionEffort,
            fees: <-fees
          )
          
          log("Transfer scheduled")
        }
      }
    `,
    args: (arg, t) => [
      arg(recipient, t.Address),
      arg(amount.toFixed(8), t.UFix64),
      arg(delaySeconds.toString(), t.UFix64)
    ]
  };
};

/**
 * Execute a scheduled transfer using user's pre-authorized capability
 * This is the backend fallback when Flow's automatic execution doesn't trigger
 * Backend service account signs this transaction
 */
const executeScheduledTransfer = async (userAddress, recipient, amount) => {
  try {
    const transaction = `
      import ScheduledTransfer from 0x8401ed4fc6788c8a
      
      transaction(userAddress: Address, recipient: Address, amount: UFix64) {
        prepare(serviceAccount: auth(Storage) &Account) {
          // Get user's account
          let userAccount = getAccount(userAddress)
          
          // Get the authorization capability
          let authCap = userAccount.capabilities
            .get<&ScheduledTransfer.TransferAuthorization>(/public/scheduledTransferAuth)
            .borrow()
            ?? panic("Could not borrow authorization capability from user account")
          
          // Execute the transfer
          // This will withdraw from user's vault and send to recipient
          authCap.executeTransfer(recipient: recipient, amount: amount)
          
          log("Scheduled transfer executed from ".concat(userAddress.toString())
            .concat(" to ").concat(recipient.toString())
            .concat(" amount: ").concat(amount.toString()))
        }
      }
    `;
    
    return {
      cadence: transaction,
      args: (arg, t) => [
        arg(userAddress, t.Address),
        arg(recipient, t.Address),
        arg(amount.toFixed(8), t.UFix64)
      ]
    };
  } catch (error) {
    console.error('Error creating execution transaction:', error);
    throw error;
  }
};

/**
 * Check if user has authorized backend for scheduled transfers
 */
const checkBackendAuthorization = async (userAddress) => {
  try {
    const result = await fcl.query({
      cadence: `
        import ScheduledTransfer from 0x8401ed4fc6788c8a
        
        access(all) fun main(userAddress: Address): {String: AnyStruct} {
          let userAccount = getAccount(userAddress)
          
          if let authCap = userAccount.capabilities
            .get<&ScheduledTransfer.TransferAuthorization>(/public/scheduledTransferAuth)
            .borrow() {
            
            return {
              "isAuthorized": true,
              "maxAmountPerTransfer": authCap.maxAmountPerTransfer,
              "authorizedAccount": authCap.authorizedAccount,
              "isRevoked": authCap.isRevoked
            }
          }
          
          return {
            "isAuthorized": false,
            "maxAmountPerTransfer": 0.0,
            "authorizedAccount": nil,
            "isRevoked": false
          }
        }
      `,
      args: (arg, t) => [arg(userAddress, t.Address)]
    });
    
    return result;
  } catch (error) {
    console.error('Error checking backend authorization:', error);
    throw error;
  }
};

/**
 * Get transaction for user to authorize backend for scheduled transfers
 * User signs this once to allow backend to execute transfers on their behalf
 */
const getAuthorizationTransaction = (maxAmountPerTransfer, expiryDays) => {
  const serviceAccount = process.env.FLOW_SERVICE_ACCOUNT_ADDRESS;
  
  return {
    cadence: `
      import ScheduledTransfer from 0x8401ed4fc6788c8a
      import FlowToken from 0x7e60df042a9c0868
      import FungibleToken from 0x9a0766d93b6608b7

      transaction(maxAmountPerTransfer: UFix64, serviceAccount: Address) {
        prepare(signer: auth(Storage, Capabilities) &Account) {
          // Destroy existing authorization if present
          if signer.storage.borrow<&AnyResource>(from: /storage/scheduledTransferAuth) != nil {
            let oldAuth <- signer.storage.load<@AnyResource>(from: /storage/scheduledTransferAuth)
            destroy oldAuth
          }

          // Issue withdraw capability for FlowToken vault
          let withdrawCap = signer.capabilities.storage
            .issue<auth(FungibleToken.Withdraw) &FlowToken.Vault>(/storage/flowTokenVault)
          
          // Create the authorization resource
          let authorization <- ScheduledTransfer.createAuthorization(
            withdrawCapability: withdrawCap,
            maxAmountPerTransfer: maxAmountPerTransfer,
            authorizedAccount: serviceAccount
          )
          
          // Save to storage
          signer.storage.save(<-authorization, to: /storage/scheduledTransferAuth)
          
          // Unpublish existing capability if present
          signer.capabilities.unpublish(/public/scheduledTransferAuth)
          
          // Publish a public capability so backend can access it
          let authCap = signer.capabilities.storage
            .issue<&ScheduledTransfer.TransferAuthorization>(/storage/scheduledTransferAuth)
          signer.capabilities.publish(authCap, at: /public/scheduledTransferAuth)
          
          log("Backend authorized for scheduled transfers")
        }
      }
    `,
    args: (arg, t) => [
      arg(maxAmountPerTransfer.toFixed(8), t.UFix64),
      arg(serviceAccount, t.Address)
    ]
  };
};

/**
 * Alias for checkBackendAuthorization for consistency with route naming
 */
const checkAuthorization = checkBackendAuthorization;

module.exports = {
  checkHandlerInitialized,
  getInitHandlerTransaction,
  getScheduleTransferTransaction,
  executeScheduledTransfer,
  checkBackendAuthorization,
  getAuthorizationTransaction,
  checkAuthorization
};

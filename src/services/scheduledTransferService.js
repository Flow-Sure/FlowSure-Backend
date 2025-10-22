const ScheduledTransfer = require('../models/ScheduledTransfer');
const { executeInsuredAction } = require('./transactionService');
const { executeScheduledTransfer: getExecutionTransaction, checkBackendAuthorization } = require('./scheduledTransferFlowService');
const { generateNextInstance } = require('./recurringTransferService');
const { fcl, getServiceAccountAuthorization } = require('../config/flow');

/**
 * Execute a scheduled transfer
 * This is called by the cron job when a transfer is due
 */
const executeScheduledTransfer = async (transferId) => {
  try {
    const transfer = await ScheduledTransfer.findById(transferId);
    
    if (!transfer) {
      throw new Error('Scheduled transfer not found');
    }

    if (transfer.status !== 'scheduled') {
      throw new Error(`Transfer status is ${transfer.status}, cannot execute`);
    }

    // Check if user has authorized backend
    const authCheck = await checkBackendAuthorization(transfer.userAddress);
    if (!authCheck.isAuthorized || authCheck.isRevoked) {
      throw new Error('User has not authorized backend or authorization is revoked');
    }

    // Validate amount against authorization
    if (transfer.amount > authCheck.maxAmountPerTransfer) {
      throw new Error(`Transfer amount ${transfer.amount} exceeds authorized maximum ${authCheck.maxAmountPerTransfer}`);
    }

    // Update status to executing
    transfer.status = 'executing';
    await transfer.save();

    // Get execution transaction
    const transaction = await getExecutionTransaction(
      transfer.userAddress,
      transfer.recipient,
      transfer.amount
    );

    // Execute with service account
    const serviceAuth = getServiceAccountAuthorization();
    const txId = await fcl.mutate({
      cadence: transaction.cadence,
      args: transaction.args,
      proposer: serviceAuth,
      payer: serviceAuth,
      authorizations: [serviceAuth],
      limit: 9999
    });

    // Wait for seal
    await fcl.tx(txId).onceSealed();

    const results = [{
      recipient: transfer.recipient,
      transactionId: txId,
      status: 'completed'
    }];
    const allSuccessful = true;

    if (allSuccessful) {
      transfer.status = 'completed';
      transfer.executedAt = new Date();
      transfer.transactionIds = results;
      transfer.transactionId = results[0].transactionId;
      await transfer.save();

      console.log(`✅ Scheduled transfer ${transferId} executed successfully`);
      console.log(`   Transaction: ${txId}`);
      
      // Generate next instance if recurring
      if (transfer.parentRecurringId) {
        try {
          await generateNextInstance(transfer.parentRecurringId);
        } catch (error) {
          console.error('Failed to generate next recurring instance:', error);
        }
      }
      
      return {
        success: true,
        transfer,
        results
      };
    } else {
      throw new Error(`Some transfers failed: ${results.filter(r => r.status === 'failed').length}/${recipients.length}`);
    }
  } catch (error) {
    console.error(`❌ Failed to execute scheduled transfer ${transferId}:`, error);
    
    // Update transfer with failure
    try {
      const transfer = await ScheduledTransfer.findById(transferId);
      if (transfer) {
        const canRetry = transfer.executionMethod === 'backend' && (transfer.retryCount || 0) < (transfer.retryLimit || 0);
        if (canRetry) {
          transfer.retryCount = (transfer.retryCount || 0) + 1;
          const backoffMinutes = 5;
          transfer.scheduledDate = new Date(Date.now() + backoffMinutes * 60 * 1000);
          transfer.status = 'scheduled';
          transfer.errorMessage = error.message;
          await transfer.save();
          console.log(`↩️  Rescheduled transfer ${transferId} for retry ${transfer.retryCount}/${transfer.retryLimit} in ${backoffMinutes}m`);
        } else {
          transfer.status = 'failed';
          transfer.executedAt = new Date();
          transfer.errorMessage = error.message;
          await transfer.save();
        }
      }
    } catch (updateError) {
      console.error('Failed to update transfer status:', updateError);
    }

    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Find and execute all due scheduled transfers
 * This is called by the cron job every minute
 */
const processDueTransfers = async () => {
  try {
    const now = new Date();
    
    // Find all scheduled transfers that are due
    const dueTransfers = await ScheduledTransfer.find({
      status: 'scheduled',
      executionMethod: 'backend',
      scheduledDate: { $lte: now }
    }).sort({ scheduledDate: 1 });

    if (dueTransfers.length === 0) {
      return {
        processed: 0,
        message: 'No due transfers to process'
      };
    }

    console.log(`📅 Processing ${dueTransfers.length} due scheduled transfers...`);

    const results = [];
    for (const transfer of dueTransfers) {
      const result = await executeScheduledTransfer(transfer._id);
      results.push({
        transferId: transfer._id,
        title: transfer.title,
        ...result
      });
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Processed ${dueTransfers.length} transfers: ${successful} successful, ${failed} failed`);

    return {
      processed: dueTransfers.length,
      successful,
      failed,
      results
    };
  } catch (error) {
    console.error('❌ Error processing due transfers:', error);
    throw error;
  }
};

/**
 * Get statistics about scheduled transfers
 */
const getScheduledTransferStats = async (userAddress) => {
  const stats = {
    total: 0,
    scheduled: 0,
    executing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  };

  const query = userAddress ? { userAddress } : {};
  
  const transfers = await ScheduledTransfer.find(query);
  
  stats.total = transfers.length;
  stats.scheduled = transfers.filter(t => t.status === 'scheduled').length;
  stats.executing = transfers.filter(t => t.status === 'executing').length;
  stats.completed = transfers.filter(t => t.status === 'completed').length;
  stats.failed = transfers.filter(t => t.status === 'failed').length;
  stats.cancelled = transfers.filter(t => t.status === 'cancelled').length;

  return stats;
};

module.exports = {
  executeScheduledTransfer,
  processDueTransfers,
  getScheduledTransferStats
};

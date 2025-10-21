const ScheduledTransfer = require('../models/ScheduledTransfer');
const { executeInsuredAction } = require('./transactionService');
const { executeScheduledTransfer: executeOnChain, checkAuthorization } = require('./scheduledTransferFlowService');
const { generateNextInstance } = require('./recurringTransferService');

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

    // Check if user has valid authorization
    const authCheck = await checkAuthorization(transfer.userAddress);
    if (!authCheck.isValid) {
      throw new Error('User authorization is invalid or expired');
    }

    // Calculate total amount needed
    const recipients = transfer.recipients && transfer.recipients.length > 0 
      ? transfer.recipients 
      : [{ address: transfer.recipient }];
    
    const totalAmount = transfer.amountPerRecipient 
      ? transfer.amount * recipients.length 
      : transfer.amount;

    // Validate amount against authorization
    if (totalAmount > authCheck.maxAmount) {
      throw new Error(`Total transfer amount ${totalAmount} exceeds authorized maximum ${authCheck.maxAmount}`);
    }

    // Update status to executing
    transfer.status = 'executing';
    await transfer.save();

    // Execute transfers for all recipients
    const results = [];
    let allSuccessful = true;

    for (const recipient of recipients) {
      const recipientAmount = transfer.amountPerRecipient 
        ? transfer.amount 
        : transfer.amount / recipients.length;

      try {
        const result = await executeOnChain(
          transfer.userAddress,
          recipient.address,
          recipientAmount,
          transfer.retryLimit
        );

        results.push({
          recipient: recipient.address,
          transactionId: result.transactionId,
          status: result.success ? 'completed' : 'failed',
          error: result.error
        });

        if (!result.success) {
          allSuccessful = false;
        }
      } catch (error) {
        results.push({
          recipient: recipient.address,
          status: 'failed',
          error: error.message
        });
        allSuccessful = false;
      }
    }

    if (allSuccessful) {
      transfer.status = 'completed';
      transfer.executedAt = new Date();
      transfer.transactionIds = results;
      if (recipients.length === 1) {
        transfer.transactionId = results[0].transactionId;
      }
      await transfer.save();

      console.log(`✅ Scheduled transfer ${transferId} executed successfully`);
      console.log(`   Sent to ${recipients.length} recipient(s)`);
      
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
        transfer.status = 'failed';
        transfer.executedAt = new Date();
        transfer.errorMessage = error.message;
        await transfer.save();
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

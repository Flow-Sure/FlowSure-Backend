const ScheduledTransfer = require('../models/ScheduledTransfer');
const { fcl } = require('../config/flow');

/**
 * Check the status of a Flow transaction
 */
const checkTransactionStatus = async (transactionId) => {
  try {
    const txStatus = await fcl.tx(transactionId).onceExecuted();
    
    return {
      status: txStatus.status,
      statusCode: txStatus.statusCode,
      errorMessage: txStatus.errorMessage,
      events: txStatus.events
    };
  } catch (error) {
    console.error(`Error checking transaction ${transactionId}:`, error);
    return null;
  }
};

/**
 * Monitor Flow-scheduled transfers and update their status
 */
const monitorFlowScheduledTransfers = async () => {
  try {
    // Find all Flow-scheduled transfers that are still 'scheduled'
    const pendingTransfers = await ScheduledTransfer.find({
      executionMethod: 'flow_native',
      status: 'scheduled',
      scheduledDate: { $lte: new Date() } // Only check transfers that should have executed
    });

    if (pendingTransfers.length === 0) {
      return {
        checked: 0,
        message: 'No pending Flow-scheduled transfers to monitor'
      };
    }

    console.log(`📊 Monitoring ${pendingTransfers.length} Flow-scheduled transfers...`);

    const results = [];
    for (const transfer of pendingTransfers) {
      try {
        const txStatus = await checkTransactionStatus(transfer.transactionId);
        
        if (!txStatus) {
          continue;
        }

        // Check if transaction was executed successfully
        if (txStatus.statusCode === 0) {
          // Success
          transfer.status = 'completed';
          transfer.executedAt = new Date();
          await transfer.save();
          
          console.log(`✅ Transfer ${transfer._id} completed (TX: ${transfer.transactionId})`);
          results.push({ transferId: transfer._id, status: 'completed' });
        } else if (txStatus.statusCode > 0) {
          // Failed
          transfer.status = 'failed';
          transfer.executedAt = new Date();
          transfer.errorMessage = txStatus.errorMessage || 'Transaction failed';
          await transfer.save();
          
          console.log(`❌ Transfer ${transfer._id} failed (TX: ${transfer.transactionId})`);
          results.push({ transferId: transfer._id, status: 'failed' });
        }
      } catch (error) {
        console.error(`Error monitoring transfer ${transfer._id}:`, error);
      }
    }

    return {
      checked: pendingTransfers.length,
      updated: results.length,
      results
    };
  } catch (error) {
    console.error('❌ Error monitoring Flow-scheduled transfers:', error);
    throw error;
  }
};

/**
 * Get scheduled transaction info from Flow blockchain
 */
const getScheduledTransactionInfo = async (userAddress) => {
  try {
    // This would query Flow's scheduler contract to get scheduled transactions
    // For now, we'll rely on our database tracking
    const transfers = await ScheduledTransfer.find({
      userAddress,
      executionMethod: 'flow_native',
      status: { $in: ['scheduled', 'executing'] }
    }).sort({ scheduledDate: 1 });

    return transfers;
  } catch (error) {
    console.error('Error getting scheduled transaction info:', error);
    throw error;
  }
};

module.exports = {
  checkTransactionStatus,
  monitorFlowScheduledTransfers,
  getScheduledTransactionInfo
};

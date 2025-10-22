const cron = require('node-cron');
const { monitorFlowScheduledTransfers } = require('./flowSchedulerMonitor');

let cronJob = null;

/**
 * Start the Flow scheduler monitor cron job
 * Runs every 2 minutes to check for completed/failed transactions
 */
const startFlowSchedulerMonitor = () => {
  if (cronJob) {
    console.log('⚠️  Flow scheduler monitor is already running');
    return;
  }

  // Run every 2 minutes
  cronJob = cron.schedule('*/2 * * * *', async () => {
    console.log('🔍 Running Flow scheduler monitor...');
    try {
      const result = await monitorFlowScheduledTransfers();
      if (result.updated > 0) {
        console.log(`✅ Updated ${result.updated} transfers`);
      }
    } catch (error) {
      console.error('❌ Flow scheduler monitor error:', error);
    }
  });

  console.log('✅ Flow scheduler monitor started (runs every 2 minutes)');
};

/**
 * Stop the Flow scheduler monitor cron job
 */
const stopFlowSchedulerMonitor = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('⏹️  Flow scheduler monitor stopped');
  }
};

/**
 * Get the status of the cron job
 */
const getMonitorStatus = () => {
  return {
    running: cronJob !== null,
    schedule: '*/2 * * * *',
    description: 'Monitors Flow-scheduled transfers every 2 minutes'
  };
};

module.exports = {
  startFlowSchedulerMonitor,
  stopFlowSchedulerMonitor,
  getMonitorStatus
};

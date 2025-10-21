const { processDueTransfers } = require('./scheduledTransferService');

/**
 * Cron job that runs every minute to check for and execute due scheduled transfers
 */
class ScheduledTransferCron {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.intervalMs = 60000; // 1 minute
  }

  /**
   * Start the cron job
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Scheduled transfer cron is already running');
      return;
    }

    console.log('🚀 Starting scheduled transfer cron job (runs every minute)...');
    
    // Run immediately on start
    this.runJob();
    
    // Then run every minute
    this.intervalId = setInterval(() => {
      this.runJob();
    }, this.intervalMs);
    
    this.isRunning = true;
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Scheduled transfer cron is not running');
      return;
    }

    console.log('🛑 Stopping scheduled transfer cron job...');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
  }

  /**
   * Execute the cron job
   */
  async runJob() {
    try {
      const timestamp = new Date().toISOString();
      console.log(`\n⏰ [${timestamp}] Running scheduled transfer check...`);
      
      const result = await processDueTransfers();
      
      if (result.processed > 0) {
        console.log(`📊 Cron job completed: ${result.successful} successful, ${result.failed} failed`);
      }
    } catch (error) {
      console.error('❌ Error in scheduled transfer cron job:', error);
    }
  }

  /**
   * Get cron job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      intervalMinutes: this.intervalMs / 60000
    };
  }
}

// Create singleton instance
const scheduledTransferCron = new ScheduledTransferCron();

module.exports = scheduledTransferCron;

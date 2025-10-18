const fcl = require('@onflow/fcl');

class SchedulerService {
  constructor() {
    this.isRunning = false;
    this.pollInterval = 30000; // 30 seconds
    this.intervalId = null;
    this.contractAddress = process.env.SCHEDULER_ADDRESS || '0x8401ed4fc6788c8a';
  }

  async start() {
    if (this.isRunning) {
      console.log('Scheduler already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting scheduler service...');
    
    // Start polling for scheduled actions
    this.intervalId = setInterval(() => {
      this.checkScheduledActions();
    }, this.pollInterval);

    // Run immediately on start
    await this.checkScheduledActions();
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Scheduler service stopped');
  }

  async checkScheduledActions() {
    try {
      const scheduledActions = await this.getScheduledActions();
      
      if (!scheduledActions || scheduledActions.length === 0) {
        console.log('[Scheduler] No scheduled actions found');
        return;
      }

      console.log(`[Scheduler] Found ${scheduledActions.length} scheduled action(s)`);

      for (const action of scheduledActions) {
        await this.processScheduledAction(action);
      }
    } catch (error) {
      console.error('[Scheduler] Error checking scheduled actions:', error.message);
    }
  }

  async getScheduledActions() {
    const script = `
      import Scheduler from ${this.contractAddress}

      access(all) fun main(): [Scheduler.ScheduledAction] {
        return Scheduler.getAllScheduledActions()
      }
    `;

    try {
      const result = await fcl.query({
        cadence: script
      });
      return result || [];
    } catch (error) {
      console.error('[Scheduler] Error fetching scheduled actions:', error.message);
      return [];
    }
  }

  async processScheduledAction(action) {
    try {
      const currentTime = Date.now() / 1000; // Convert to seconds
      const scheduledFor = parseFloat(action.scheduledFor);

      if (currentTime < scheduledFor) {
        const timeRemaining = Math.round(scheduledFor - currentTime);
        console.log(`[Scheduler] Action ${action.actionId} scheduled for ${timeRemaining}s from now`);
        return;
      }

      console.log(`[Scheduler] Executing retry for action ${action.actionId}`);
      await this.executeRetry(action);
    } catch (error) {
      console.error(`[Scheduler] Error processing action ${action.actionId}:`, error.message);
    }
  }

  async executeRetry(action) {
    const transaction = `
      import InsuredAction from ${this.contractAddress}

      transaction(
        actionId: String,
        targetAction: String,
        params: {String: AnyStruct},
        retryLimit: UInt8
      ) {
        let actionManagerRef: &InsuredAction.ActionManager

        prepare(signer: auth(BorrowValue) &Account) {
          self.actionManagerRef = InsuredAction.borrowActionManager()
        }

        execute {
          let result = self.actionManagerRef.executeAction(
            actionId: actionId,
            user: ${action.user},
            targetAction: targetAction,
            params: params,
            retryLimit: retryLimit
          )

          log("Retry executed with result: ".concat(result.message))
        }
      }
    `;

    try {
      // Note: This would need proper authorization
      // For now, we log that a retry should be executed
      console.log(`[Scheduler] Would execute retry for action ${action.actionId}`);
      console.log(`[Scheduler] Target: ${action.targetAction}, Retry: ${action.retryCount}/${action.retryLimit}`);
      
      // In production, this would trigger the actual transaction
      // with proper authorization from the service account
    } catch (error) {
      console.error(`[Scheduler] Error executing retry:`, error.message);
    }
  }

  async getActionStatus(actionId) {
    const script = `
      import InsuredAction from ${this.contractAddress}

      access(all) fun main(actionId: String): InsuredAction.ActionRecord? {
        let actionManagerRef = InsuredAction.borrowActionManager()
        return actionManagerRef.getActionRecord(actionId: actionId)
      }
    `;

    try {
      const result = await fcl.query({
        cadence: script,
        args: (arg, t) => [arg(actionId, t.String)]
      });
      return result;
    } catch (error) {
      console.error(`[Scheduler] Error getting action status:`, error.message);
      return null;
    }
  }
}

module.exports = new SchedulerService();

const axios = require('axios');
const fcl = require('@onflow/fcl');

class EventMonitor {
  constructor() {
    this.isRunning = false;
    this.pollInterval = 5000; // 5 seconds
    this.intervalId = null;
    this.contractAddress = process.env.FLOW_CONTRACT_ACCOUNT || '0x8401ed4fc6788c8a';
    this.lastBlockHeight = null;
    this.eventCallbacks = new Map();
  }

  async start() {
    if (this.isRunning) {
      console.log('Event monitor already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting event monitor...');
    
    // Get current block height
    await this.initializeBlockHeight();
    
    // Start polling for events
    this.intervalId = setInterval(() => {
      this.pollEvents();
    }, this.pollInterval);
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Event monitor stopped');
  }

  async initializeBlockHeight() {
    try {
      const block = await fcl.block({ sealed: true });
      this.lastBlockHeight = block.height;
      console.log(`[EventMonitor] Initialized at block height: ${this.lastBlockHeight}`);
    } catch (error) {
      console.error('[EventMonitor] Error initializing block height:', error.message);
      this.lastBlockHeight = 0;
    }
  }

  async pollEvents() {
    try {
      const currentBlock = await fcl.block({ sealed: true });
      const currentHeight = currentBlock.height;

      if (!this.lastBlockHeight || currentHeight <= this.lastBlockHeight) {
        return;
      }

      // Fetch events from last block to current
      await this.fetchEvents(this.lastBlockHeight + 1, currentHeight);
      
      this.lastBlockHeight = currentHeight;
    } catch (error) {
      console.error('[EventMonitor] Error polling events:', error.message);
    }
  }

  async fetchEvents(startBlock, endBlock) {
    const eventTypes = [
      `A.${this.contractAddress.replace('0x', '')}.Scheduler.RetryScheduledEvent`,
      `A.${this.contractAddress.replace('0x', '')}.Scheduler.TransactionStatusEvent`,
      `A.${this.contractAddress.replace('0x', '')}.InsuredAction.CompensationEvent`,
      `A.${this.contractAddress.replace('0x', '')}.InsuredAction.ActionSuccessEvent`,
      `A.${this.contractAddress.replace('0x', '')}.InsuredAction.ActionFailureEvent`,
      `A.${this.contractAddress.replace('0x', '')}.FrothRewards.FrothStakedEvent`,
      `A.${this.contractAddress.replace('0x', '')}.FrothRewards.FrothUnstakedEvent`,
      `A.${this.contractAddress.replace('0x', '')}.FrothRewards.PremiumDiscountAppliedEvent`,
    ];

    for (const eventType of eventTypes) {
      try {
        const events = await fcl.send([
          fcl.getEventsAtBlockHeightRange(eventType, startBlock, endBlock)
        ]).then(fcl.decode);

        if (events && events.length > 0) {
          console.log(`[EventMonitor] Found ${events.length} ${eventType.split('.').pop()} event(s)`);
          events.forEach(event => this.handleEvent(event));
        }
      } catch (error) {
        // Silently continue if event type doesn't exist
        if (!error.message.includes('not found')) {
          console.error(`[EventMonitor] Error fetching ${eventType}:`, error.message);
        }
      }
    }
  }

  handleEvent(event) {
    const eventType = event.type.split('.').pop();
    const eventData = event.data;

    console.log(`[EventMonitor] ${eventType}:`, JSON.stringify(eventData, null, 2));

    // Trigger registered callbacks
    const callbacks = this.eventCallbacks.get(eventType) || [];
    callbacks.forEach(callback => {
      try {
        callback(eventData, event);
      } catch (error) {
        console.error(`[EventMonitor] Error in callback for ${eventType}:`, error.message);
      }
    });

    // Broadcast to WebSocket clients if available
    if (global.wss) {
      this.broadcastEvent(eventType, eventData);
    }
  }

  broadcastEvent(eventType, eventData) {
    if (!global.wss) return;

    const message = JSON.stringify({
      type: 'event',
      eventType,
      data: eventData,
      timestamp: Date.now()
    });

    global.wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  on(eventType, callback) {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, []);
    }
    this.eventCallbacks.get(eventType).push(callback);
  }

  off(eventType, callback) {
    const callbacks = this.eventCallbacks.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Helper method to get recent events
  async getRecentEvents(eventType, limit = 10) {
    try {
      const currentBlock = await fcl.block({ sealed: true });
      const startBlock = Math.max(0, currentBlock.height - 1000); // Last ~1000 blocks

      const fullEventType = `A.${this.contractAddress.replace('0x', '')}.${eventType}`;
      
      const events = await fcl.send([
        fcl.getEventsAtBlockHeightRange(fullEventType, startBlock, currentBlock.height)
      ]).then(fcl.decode);

      return events.slice(-limit);
    } catch (error) {
      console.error(`[EventMonitor] Error getting recent events:`, error.message);
      return [];
    }
  }
}

module.exports = new EventMonitor();

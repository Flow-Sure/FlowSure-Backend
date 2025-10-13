const { EventEmitter } = require('events');
const fcl = require('../config/flow');
const ProtectedAsset = require('../models/ProtectedAsset');
const Compensation = require('../models/Compensation');
const Staker = require('../models/Staker');

class FlowSureEventListener extends EventEmitter {
  constructor() {
    super();
    this.subscriptions = [];
  }
  
  async start() {
    console.log('Event listener initialized (subscriptions disabled for development)');
    console.log('To enable event subscriptions, ensure contracts are deployed on testnet');
    return;
    
    // Event subscriptions disabled for development
    // Uncomment below when contracts are deployed and events are available
    /*
    try {
      const protectedSub = await fcl.events(
        "A.8401ed4fc6788c8a.DapperAssetProtection.DapperAssetProtectedEvent"
      ).subscribe(event => {
        this.emit('assetProtected', event);
        this.handleAssetProtected(event);
      });
      
      const compensationSub = await fcl.events(
        "A.8401ed4fc6788c8a.DapperAssetProtection.DapperAssetCompensatedEvent"
      ).subscribe(event => {
        this.emit('compensation', event);
        this.handleCompensation(event);
      });
      
      const stakedSub = await fcl.events(
        "A.8401ed4fc6788c8a.FrothRewards.FrothStakedEvent"
      ).subscribe(event => {
        this.emit('frothStaked', event);
        this.handleFrothStaked(event);
      });
      
      this.subscriptions.push(protectedSub, compensationSub, stakedSub);
      console.log('Event listeners started successfully');
    } catch (error) {
      console.error('Error starting event listeners:', error);
    }
    */
  }
  
  async handleAssetProtected(event) {
    try {
      const { user, assetType, assetId, actionId } = event.data;
      
      await ProtectedAsset.create({
        user,
        assetType,
        assetId: assetId.toString(),
        actionId,
        status: 'PROTECTED',
        protectedAt: new Date(event.data.timestamp * 1000)
      });
      
      console.log(`Asset protected: ${assetType} #${assetId} for user ${user}`);
    } catch (error) {
      console.error('Error handling asset protected event:', error);
    }
  }
  
  async handleCompensation(event) {
    try {
      const { user, assetType, assetId, compensation } = event.data;
      
      await Compensation.create({
        user,
        assetType,
        assetId: assetId.toString(),
        amount: compensation,
        txId: event.transactionId,
        paidAt: new Date(event.data.timestamp * 1000)
      });
      
      await ProtectedAsset.findOneAndUpdate(
        { user, assetId: assetId.toString() },
        { status: 'COMPENSATED' }
      );
      
      console.log(`Compensation paid: ${compensation} FLOW to ${user} for ${assetType} #${assetId}`);
    } catch (error) {
      console.error('Error handling compensation event:', error);
    }
  }
  
  async handleFrothStaked(event) {
    try {
      const { user, amount, totalStaked } = event.data;
      
      await Staker.findOneAndUpdate(
        { address: user },
        {
          stakedAmount: totalStaked,
          lastStakedAt: new Date(event.data.timestamp * 1000)
        },
        { upsert: true }
      );
      
      console.log(`FROTH staked: ${amount} by ${user}, total: ${totalStaked}`);
    } catch (error) {
      console.error('Error handling froth staked event:', error);
    }
  }
  
  stop() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    console.log('Event listeners stopped');
  }
}

module.exports = FlowSureEventListener;

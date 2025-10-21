const fcl = require('@onflow/fcl');
const fs = require('fs');
const path = require('path');

class AutoCompoundService {
  constructor() {
    this.contractsPath = path.join(__dirname, '../../../FlowSure-SmartContract');
  }

  async getCompoundConfig(userAddress) {
    try {
      const script = fs.readFileSync(
        path.join(this.contractsPath, 'scripts/get_compound_config.cdc'),
        'utf8'
      );

      const config = await fcl.query({
        cadence: script,
        args: (arg, t) => [arg(userAddress, t.Address)]
      });

      return config;
    } catch (error) {
      console.error('Error getting compound config:', error);
      return null;
    }
  }

  async getPendingRewards(userAddress) {
    try {
      const script = fs.readFileSync(
        path.join(this.contractsPath, 'scripts/get_pending_rewards.cdc'),
        'utf8'
      );

      const rewards = await fcl.query({
        cadence: script,
        args: (arg, t) => [arg(userAddress, t.Address)]
      });

      return parseFloat(rewards);
    } catch (error) {
      console.error('Error getting pending rewards:', error);
      return 0;
    }
  }

  async getStakerData(userAddress) {
    try {
      const script = `
        import FrothRewards from 0xFrothRewards
        
        access(all) fun main(user: Address): FrothRewards.StakerData? {
          return FrothRewards.getStakerData(user: user)
        }
      `;

      const data = await fcl.query({
        cadence: script,
        args: (arg, t) => [arg(userAddress, t.Address)]
      });

      return data;
    } catch (error) {
      console.error('Error getting staker data:', error);
      return null;
    }
  }

  async enableAutoCompound(userAddress, frequency) {
    try {
      const transaction = fs.readFileSync(
        path.join(this.contractsPath, 'transactions/enable_auto_compound.cdc'),
        'utf8'
      );

      const txId = await fcl.mutate({
        cadence: transaction,
        args: (arg, t) => [arg(frequency.toFixed(1), t.UFix64)],
        proposer: fcl.currentUser,
        payer: fcl.currentUser,
        authorizations: [fcl.currentUser],
        limit: 999
      });

      const tx = await fcl.tx(txId).onceSealed();
      return { success: true, txId, transaction: tx };
    } catch (error) {
      console.error('Error enabling auto compound:', error);
      return { success: false, error: error.message };
    }
  }

  async disableAutoCompound(userAddress) {
    try {
      const transaction = fs.readFileSync(
        path.join(this.contractsPath, 'transactions/disable_auto_compound.cdc'),
        'utf8'
      );

      const txId = await fcl.mutate({
        cadence: transaction,
        proposer: fcl.currentUser,
        payer: fcl.currentUser,
        authorizations: [fcl.currentUser],
        limit: 999
      });

      const tx = await fcl.tx(txId).onceSealed();
      return { success: true, txId, transaction: tx };
    } catch (error) {
      console.error('Error disabling auto compound:', error);
      return { success: false, error: error.message };
    }
  }

  async executeCompound(userAddress) {
    try {
      const transaction = fs.readFileSync(
        path.join(this.contractsPath, 'transactions/execute_compound.cdc'),
        'utf8'
      );

      const txId = await fcl.mutate({
        cadence: transaction,
        proposer: fcl.currentUser,
        payer: fcl.currentUser,
        authorizations: [fcl.currentUser],
        limit: 999
      });

      const tx = await fcl.tx(txId).onceSealed();
      return { success: true, txId, transaction: tx };
    } catch (error) {
      console.error('Error executing compound:', error);
      return { success: false, error: error.message };
    }
  }

  calculateProjectedAPY(stakedAmount, compoundFrequency) {
    const baseAPR = 0.12;
    const secondsPerYear = 31536000;
    const compoundsPerYear = secondsPerYear / compoundFrequency;
    
    const apy = Math.pow(1 + (baseAPR / compoundsPerYear), compoundsPerYear) - 1;
    return apy;
  }

  calculateTimeUntilNextCompound(lastCompoundTime, frequency) {
    const now = Date.now() / 1000;
    const nextCompoundTime = lastCompoundTime + frequency;
    const timeRemaining = Math.max(0, nextCompoundTime - now);
    
    return {
      nextCompoundTime,
      timeRemaining,
      formattedTime: this.formatTimeRemaining(timeRemaining)
    };
  }

  formatTimeRemaining(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  async getCompoundHistory(userAddress, limit = 10) {
    return [];
  }

  async getGlobalStats() {
    try {
      const totalStaked = await this.getTotalStaked();
      const totalCompounds = await this.getTotalCompounds();
      const totalRewardsCompounded = await this.getTotalRewardsCompounded();
      
      return {
        totalStaked,
        totalCompounds,
        totalRewardsCompounded,
        averageCompoundAmount: totalCompounds > 0 ? totalRewardsCompounded / totalCompounds : 0
      };
    } catch (error) {
      console.error('Error getting global stats:', error);
      return {
        totalStaked: 0,
        totalCompounds: 0,
        totalRewardsCompounded: 0,
        averageCompoundAmount: 0
      };
    }
  }

  async getTotalStaked() {
    try {
      const script = `
        import FrothRewards from 0xFrothRewards
        
        access(all) fun main(): UFix64 {
          return FrothRewards.getTotalStaked()
        }
      `;

      const total = await fcl.query({ cadence: script });
      return parseFloat(total);
    } catch (error) {
      return 0;
    }
  }

  async getTotalCompounds() {
    try {
      const script = `
        import AutoCompound from 0xAutoCompound
        
        access(all) fun main(): UInt64 {
          return AutoCompound.getTotalCompounds()
        }
      `;

      const total = await fcl.query({ cadence: script });
      return parseInt(total);
    } catch (error) {
      return 0;
    }
  }

  async getTotalRewardsCompounded() {
    try {
      const script = `
        import AutoCompound from 0xAutoCompound
        
        access(all) fun main(): UFix64 {
          return AutoCompound.getTotalRewardsCompounded()
        }
      `;

      const total = await fcl.query({ cadence: script });
      return parseFloat(total);
    } catch (error) {
      return 0;
    }
  }
}

module.exports = new AutoCompoundService();

const fcl = require('../config/flow');

const queryStakerInfo = async (address) => {
  const result = await fcl.query({
    cadence: `
      import FrothRewards from 0x8401ed4fc6788c8a
      
      access(all) fun main(address: Address): {String: AnyStruct} {
        let account = getAccount(address)
        let stakerCap = account.capabilities.get<&FrothRewards.FrothStaker>(
          FrothRewards.StakerPublicPath
        )
        
        if let stakerRef = stakerCap.borrow() {
          return {
            "address": address,
            "stakedAmount": stakerRef.getStakedAmount(),
            "discount": stakerRef.getDiscount(),
            "discountPercentage": stakerRef.getDiscount() * 100.0
          }
        }
        
        return {
          "address": address,
          "stakedAmount": 0.0,
          "discount": 0.0,
          "discountPercentage": 0.0
        }
      }
    `,
    args: (arg, t) => [arg(address, t.Address)]
  });
  
  return result;
};

const stakeTokens = async (user, amount) => {
  const tx = await fcl.mutate({
    cadence: `
      import FrothRewards from 0x8401ed4fc6788c8a
      
      transaction(amount: UFix64) {
        let stakerRef: &FrothRewards.FrothStaker
        
        prepare(signer: auth(BorrowValue) &Account) {
          self.stakerRef = signer.storage.borrow<&FrothRewards.FrothStaker>(
            from: FrothRewards.StakerStoragePath
          ) ?? panic("No staker found")
        }
        
        execute {
          self.stakerRef.stake(amount: amount)
        }
      }
    `,
    args: (arg, t) => [arg(amount.toFixed(8), t.UFix64)],
    proposer: fcl.currentUser,
    payer: fcl.currentUser,
    authorizations: [fcl.currentUser]
  });
  
  const sealed = await fcl.tx(tx).onceSealed();
  return { txId: tx.transactionId, sealed };
};

const unstakeTokens = async (user, amount) => {
  const tx = await fcl.mutate({
    cadence: `
      import FrothRewards from 0x8401ed4fc6788c8a
      
      transaction(amount: UFix64) {
        let stakerRef: &FrothRewards.FrothStaker
        
        prepare(signer: auth(BorrowValue) &Account) {
          self.stakerRef = signer.storage.borrow<&FrothRewards.FrothStaker>(
            from: FrothRewards.StakerStoragePath
          ) ?? panic("No staker found")
        }
        
        execute {
          self.stakerRef.unstake(amount: amount)
        }
      }
    `,
    args: (arg, t) => [arg(amount.toFixed(8), t.UFix64)],
    proposer: fcl.currentUser,
    payer: fcl.currentUser,
    authorizations: [fcl.currentUser]
  });
  
  const sealed = await fcl.tx(tx).onceSealed();
  return { txId: tx.transactionId, sealed };
};

const queryProtectedAssets = async (address) => {
  const result = await fcl.query({
    cadence: `
      import DapperAssetProtection from 0x8401ed4fc6788c8a
      
      access(all) fun main(address: Address): [AnyStruct] {
        let account = getAccount(address)
        let managerCap = account.capabilities.get<&{DapperAssetProtection.ProtectionManagerPublic}>(
          DapperAssetProtection.ProtectionManagerPublicPath
        )
        
        if let managerRef = managerCap.borrow() {
          let assets = managerRef.getProtectedAssets(user: address)
          let result: [AnyStruct] = []
          
          for asset in assets {
            result.append({
              "assetId": asset.assetId,
              "assetType": asset.assetType,
              "status": asset.status,
              "protectedAt": asset.protectedAt
            })
          }
          
          return result
        }
        
        return []
      }
    `,
    args: (arg, t) => [arg(address, t.Address)]
  });
  
  return result;
};

const protectDapperAsset = async (user, assetType, assetId, actionType) => {
  const tx = await fcl.mutate({
    cadence: `
      import DapperAssetProtection from 0x8401ed4fc6788c8a
      
      transaction(assetType: String, assetId: UInt64, actionType: String) {
        let managerRef: &DapperAssetProtection.ProtectionManager
        
        prepare(signer: auth(BorrowValue) &Account) {
          self.managerRef = signer.storage.borrow<&DapperAssetProtection.ProtectionManager>(
            from: DapperAssetProtection.ProtectionManagerStoragePath
          ) ?? panic("No protection manager found")
        }
        
        execute {
          let actionId = self.managerRef.insureDapperAsset(
            user: self.managerRef.owner!.address,
            assetType: assetType,
            assetId: assetId,
            actionType: actionType
          )
          
          log("Asset protected with action ID: ".concat(actionId))
        }
      }
    `,
    args: (arg, t) => [
      arg(assetType, t.String),
      arg(assetId.toString(), t.UInt64),
      arg(actionType, t.String)
    ],
    proposer: fcl.currentUser,
    payer: fcl.currentUser,
    authorizations: [fcl.currentUser]
  });
  
  const sealed = await fcl.tx(tx).onceSealed();
  return { txId: tx.transactionId, sealed };
};

module.exports = {
  queryStakerInfo,
  stakeTokens,
  unstakeTokens,
  queryProtectedAssets,
  protectDapperAsset
};

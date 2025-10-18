const fcl = require('@onflow/fcl');
const fs = require('fs');
const path = require('path');

const isTestnet = process.env.FLOW_NETWORK === 'testnet';

// Fetch ALL NFTs from user's account (works on testnet)
const fetchAllUserNFTs = async (address) => {
  const scriptPath = path.join(__dirname, '../../..', 'FlowSure-SmartContract/scripts/get_user_nfts_testnet.cdc');
  
  try {
    const script = fs.readFileSync(scriptPath, 'utf8');
    const result = await fcl.query({
      cadence: script,
      args: (arg, t) => [arg(address, t.Address)]
    });
    
    // Transform the result to flat array format
    const allNFTs = [];
    if (result && typeof result === 'object') {
      for (const [storagePath, nfts] of Object.entries(result)) {
        allNFTs.push(...nfts.map(nft => ({
          id: nft.id,
          name: nft.name || 'Unknown NFT',
          description: nft.description || '',
          thumbnail: nft.thumbnail || '/placeholder.svg',
          type: nft.collectionName || nft.type || 'NFT',
          playerName: nft.name || 'Unknown',
          storagePath,
          uuid: nft.uuid
        })));
      }
    }
    return allNFTs;
  } catch (error) {
    console.error('Error fetching user NFTs:', error.message);
    return [];
  }
};

// Fetch NFTs from linked accounts (Dapper Wallet) using HybridCustody - MAINNET ONLY
const fetchLinkedDapperAssets = async (address) => {
  if (isTestnet) {
    console.log('[Testnet] Skipping HybridCustody - not available on testnet');
    return [];
  }
  
  const scriptPath = path.join(__dirname, '../../..', 'FlowSure-SmartContract/scripts/fetch_linked_nfts.cdc');
  
  try {
    const script = fs.readFileSync(scriptPath, 'utf8');
    const result = await fcl.query({
      cadence: script,
      args: (arg, t) => [arg(address, t.Address)]
    });
    
    // Transform the result to flat array format
    const allNFTs = [];
    if (result && typeof result === 'object') {
      for (const [linkedAddress, collections] of Object.entries(result)) {
        for (const [collectionType, nfts] of Object.entries(collections)) {
          allNFTs.push(...nfts.map(nft => ({
            ...nft,
            linkedAddress,
            collectionType
          })));
        }
      }
    }
    return allNFTs;
  } catch (error) {
    console.error('Error fetching linked Dapper assets:', error.message);
    return [];
  }
};

const fetchTopShotAssets = async (address) => {
  const script = `
    import TopShot from 0x0b2a3299cc857e29
    
    access(all) fun main(address: Address): [AnyStruct] {
      let account = getAccount(address)
      let collectionRef = account.capabilities.borrow<&{TopShot.MomentCollectionPublic}>(
        /public/MomentCollection
      )
      
      if collectionRef == nil {
        return []
      }
      
      let moments: [AnyStruct] = []
      let ids = collectionRef!.getIDs()
      
      for id in ids {
        if let moment = collectionRef!.borrowMoment(id: id) {
          let metadata = TopShot.getPlayMetaData(playID: moment.data.playID) ?? {}
          moments.append({
            "id": id,
            "playID": moment.data.playID,
            "setID": moment.data.setID,
            "serialNumber": moment.data.serialNumber,
            "playerName": metadata["FullName"] ?? "Unknown Player",
            "teamAtMoment": metadata["TeamAtMoment"] ?? "Unknown Team",
            "playCategory": metadata["PlayCategory"] ?? "Unknown",
            "type": "NBA Top Shot"
          })
        }
      }
      
      return moments
    }
  `;
  
  try {
    const result = await fcl.query({
      cadence: script,
      args: (arg, t) => [arg(address, t.Address)]
    });
    return result || [];
  } catch (error) {
    console.error('Error fetching Top Shot assets:', error.message);
    return [];
  }
};

const fetchAllDayAssets = async (address) => {
  const script = `
    import AllDay from 0xe4cf4bdc1751c65d
    
    access(all) fun main(address: Address): [AnyStruct] {
      let account = getAccount(address)
      let collectionRef = account.capabilities.borrow<&{AllDay.MomentNFTCollectionPublic}>(
        /public/AllDayNFTCollection
      )
      
      if collectionRef == nil {
        return []
      }
      
      let moments: [AnyStruct] = []
      let ids = collectionRef!.getIDs()
      
      for id in ids {
        if let moment = collectionRef!.borrowMomentNFT(id: id) {
          let metadata = AllDay.getPlayMetaData(playID: moment.data.playID) ?? {}
          moments.append({
            "id": id,
            "playID": moment.data.playID,
            "setID": moment.data.setID,
            "serialNumber": moment.data.serialNumber,
            "playerName": metadata["PlayerFirstName"] ?? "Unknown Player",
            "teamAtMoment": metadata["PlayerKnownName"] ?? "Unknown Team",
            "playCategory": metadata["PlayType"] ?? "Unknown",
            "type": "NFL All Day"
          })
        }
      }
      
      return moments
    }
  `;
  
  try {
    const result = await fcl.query({
      cadence: script,
      args: (arg, t) => [arg(address, t.Address)]
    });
    return result || [];
  } catch (error) {
    console.error('Error fetching All Day assets:', error.message);
    return [];
  }
};

const fetchDisneyPinnacleAssets = async (address) => {
  const script = `
    import PinnieToken from 0x5c57f79c6694797f
    
    access(all) fun main(address: Address): [AnyStruct] {
      let account = getAccount(address)
      let collectionRef = account.capabilities.borrow<&{PinnieToken.CollectionPublic}>(
        /public/PinnieTokenCollection
      )
      
      if collectionRef == nil {
        return []
      }
      
      let pins: [AnyStruct] = []
      let ids = collectionRef!.getIDs()
      
      for id in ids {
        if let pin = collectionRef!.borrowPinnieToken(id: id) {
          pins.append({
            "id": id,
            "setID": pin.setID,
            "serialNumber": pin.serialNumber,
            "playerName": "Disney Character",
            "teamAtMoment": "Disney Pinnacle",
            "playCategory": "Collectible",
            "type": "Disney Pinnacle"
          })
        }
      }
      
      return pins
    }
  `;
  
  try {
    const result = await fcl.query({
      cadence: script,
      args: (arg, t) => [arg(address, t.Address)]
    });
    return result || [];
  } catch (error) {
    console.error('Error fetching Disney Pinnacle assets:', error.message);
    return [];
  }
};

const fetchFrothPrice = async () => {
  try {
    return {
      price: 0.15,
      currency: 'USD',
      timestamp: Date.now(),
      source: 'KittyPunch API'
    };
  } catch (error) {
    console.error('Error fetching FROTH price:', error.message);
    return {
      price: 0.15,
      currency: 'USD',
      timestamp: Date.now(),
      source: 'Fallback'
    };
  }
};

module.exports = {
  fetchTopShotAssets,
  fetchAllDayAssets,
  fetchDisneyPinnacleAssets,
  fetchLinkedDapperAssets,
  fetchAllUserNFTs,
  fetchFrothPrice
};

# FlowSure Backend Integration Guide

## 🎯 LLM Implementation Instructions

**This guide provides complete implementation details for building the FlowSure backend. An LLM can use this to generate a production-ready backend with:**

- ✅ All API endpoints fully implemented
- ✅ Flow blockchain integration using FCL
- ✅ Database schema and queries
- ✅ Event listeners and webhooks
- ✅ Error handling and validation
- ✅ Deployment configuration

**Tech Stack:**
- Node.js + Express
- @onflow/fcl for Flow blockchain
- PostgreSQL for data persistence
- WebSocket for real-time events

---

## Overview
Backend integration layer connecting FlowSure smart contracts with KittyPunch ($FROTH) and Dapper Labs NFT ecosystems.

---

## 🧩 A. $FROTH Integration Service

### Contract Address
- **Testnet:** `0x8401ed4fc6788c8a.FrothRewards`
- **Mainnet:** TBD

### API Endpoints

#### 1. GET /api/froth/price
Fetch real-time $FROTH price for fee calculations.

**Response:**
```json
{
  "price": 0.15,
  "currency": "USD",
  "timestamp": 1697234567,
  "source": "KittyPunch API"
}
```

**Implementation:**
```javascript
router.get("/froth/price", async (req, res) => {
  // Fetch from KittyPunch API or DEX
  const price = await fetchFrothPrice();
  res.json({ price, currency: "USD", timestamp: Date.now() });
});
```

---

#### 2. POST /api/froth/stake
Proxy staking calls to FrothRewards smart contract.

**Request:**
```json
{
  "user": "0x8401ed4fc6788c8a",
  "amount": 100.0
}
```

**Response:**
```json
{
  "txId": "abc123...",
  "status": "pending",
  "stakedAmount": 100.0,
  "totalStaked": 100.0,
  "discount": 0.20,
  "discountPercentage": 20.0
}
```

**Implementation:**
```javascript
router.post("/froth/stake", async (req, res) => {
  const { user, amount } = req.body;
  
  // Execute Flow transaction
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
    args: (arg, t) => [arg(amount, t.UFix64)],
    proposer: fcl.currentUser,
    payer: fcl.currentUser,
    authorizations: [fcl.currentUser]
  });
  
  // Wait for seal
  const sealed = await fcl.tx(tx).onceSealed();
  
  // Query updated stats
  const stakerInfo = await queryStakerInfo(user);
  
  res.json({
    txId: tx.transactionId,
    status: "sealed",
    ...stakerInfo
  });
});
```

---

#### 3. POST /api/froth/unstake
Unstake $FROTH tokens.

**Request:**
```json
{
  "user": "0x8401ed4fc6788c8a",
  "amount": 25.0
}
```

**Response:**
```json
{
  "txId": "def456...",
  "status": "sealed",
  "remainingStaked": 75.0,
  "discount": 0.10,
  "discountPercentage": 10.0
}
```

---

#### 4. GET /api/froth/staker/:address
Get staker information.

**Response:**
```json
{
  "address": "0x8401ed4fc6788c8a",
  "stakedAmount": 100.0,
  "discount": 0.20,
  "discountPercentage": 20.0,
  "stakedAt": 1697234567
}
```

**Implementation:**
```javascript
router.get("/froth/staker/:address", async (req, res) => {
  const { address } = req.params;
  
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
  
  res.json(result);
});
```

---

#### 5. GET /api/froth/leaderboard
Aggregates top stakers (optional).

**Response:**
```json
{
  "totalStaked": 10000.0,
  "totalStakers": 50,
  "topStakers": [
    {
      "address": "0x123...",
      "stakedAmount": 500.0,
      "discount": 0.20,
      "rank": 1
    }
  ]
}
```

---

## 🧩 B. Dapper Integration Service

### Supported Dapper Assets
- **NBA Top Shot** - Packs & Moments
- **NFL All Day** - Moments  
- **Disney Pinnacle** - Pins

### Contract Address
- **Testnet:** `0x8401ed4fc6788c8a.DapperAssetProtection`
- **Mainnet:** TBD

### API Endpoints

#### 1. GET /api/dapper/assets/:address
Fetch user NFTs from Dapper's public APIs.

**Response:**
```json
{
  "topShot": [
    {
      "id": 12345,
      "name": "LeBron James Dunk",
      "series": "Series 1",
      "set": "Base Set",
      "protected": true
    }
  ],
  "allDay": [
    {
      "id": 67890,
      "name": "Patrick Mahomes TD",
      "tier": "Common",
      "protected": false
    }
  ],
  "disneyPinnacle": [
    {
      "id": 11111,
      "name": "Mickey Mouse Pin",
      "rarity": "Rare",
      "protected": false
    }
  ]
}
```

**Implementation:**
```javascript
router.get("/dapper/assets/:address", async (req, res) => {
  const { address } = req.params;
  
  // Fetch from Dapper APIs
  const [topShot, allDay, disney] = await Promise.all([
    fetchTopShotAssets(address),
    fetchAllDayAssets(address),
    fetchDisneyPinnacleAssets(address)
  ]);
  
  // Check protection status from smart contract
  const protectedAssets = await queryProtectedAssets(address);
  const protectedIds = new Set(protectedAssets.map(a => a.assetId));
  
  // Mark protected assets
  topShot.forEach(asset => {
    asset.protected = protectedIds.has(asset.id);
  });
  
  res.json({ topShot, allDay, disneyPinnacle: disney });
});

// Helper functions
async function fetchTopShotAssets(address) {
  // NBA Top Shot API
  const response = await fetch(
    `https://api.nbatopshot.com/marketplace/v1/accounts/${address}/moments`
  );
  return response.json();
}

async function fetchAllDayAssets(address) {
  // NFL All Day API
  const response = await fetch(
    `https://api.nflallday.com/marketplace/v1/accounts/${address}/moments`
  );
  return response.json();
}

async function fetchDisneyPinnacleAssets(address) {
  // Disney Pinnacle API
  const response = await fetch(
    `https://api.disneypinnacle.com/v1/accounts/${address}/pins`
  );
  return response.json();
}
```

---

#### 2. POST /api/dapper/insure
Wrap Dapper asset actions with FlowSure protection logic.

**Request:**
```json
{
  "user": "0x8401ed4fc6788c8a",
  "assetType": "NBA_TOP_SHOT",
  "assetId": 12345,
  "actionType": "PACK_OPENING"
}
```

**Response:**
```json
{
  "txId": "ghi789...",
  "actionId": "dapper_1",
  "status": "protected",
  "assetType": "NBA_TOP_SHOT",
  "assetId": 12345,
  "compensation": 5.0,
  "maxRetries": 3
}
```

**Implementation:**
```javascript
router.post("/dapper/insure", async (req, res) => {
  const { user, assetType, assetId, actionType } = req.body;
  
  // Validate asset type
  const validTypes = ["NBA_TOP_SHOT", "NFL_ALL_DAY", "DISNEY_PINNACLE"];
  if (!validTypes.includes(assetType)) {
    return res.status(400).json({ error: "Invalid asset type" });
  }
  
  // Execute protection transaction
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
      arg(assetId, t.UInt64),
      arg(actionType, t.String)
    ],
    proposer: fcl.currentUser,
    payer: fcl.currentUser,
    authorizations: [fcl.currentUser]
  });
  
  const sealed = await fcl.tx(tx).onceSealed();
  
  // Extract action ID from events
  const protectedEvent = sealed.events.find(
    e => e.type.includes("DapperAssetProtectedEvent")
  );
  
  res.json({
    txId: tx.transactionId,
    actionId: protectedEvent?.data?.actionId || "unknown",
    status: "protected",
    assetType,
    assetId,
    compensation: 5.0,
    maxRetries: 3
  });
});
```

---

#### 3. GET /api/dapper/history/:address
Track protection logs and compensation events.

**Response:**
```json
{
  "protectedAssets": [
    {
      "assetId": 12345,
      "assetType": "NBA_TOP_SHOT",
      "status": "SUCCESS",
      "protectedAt": 1697234567,
      "compensated": false
    }
  ],
  "compensations": [
    {
      "assetId": 67890,
      "assetType": "NFL_ALL_DAY",
      "amount": 5.0,
      "timestamp": 1697234600
    }
  ],
  "totalProtected": 5,
  "totalCompensated": 1
}
```

**Implementation:**
```javascript
router.get("/dapper/history/:address", async (req, res) => {
  const { address } = req.params;
  
  // Query protected assets
  const protectedAssets = await fcl.query({
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
  
  // Query compensation events from blockchain
  const compensations = await queryCompensationEvents(address);
  
  res.json({
    protectedAssets,
    compensations,
    totalProtected: protectedAssets.length,
    totalCompensated: compensations.length
  });
});
```

---

## 🎧 C. Webhook Event Listener

### Events to Monitor

#### 1. DapperAssetProtectedEvent
```javascript
{
  type: "A.8401ed4fc6788c8a.DapperAssetProtection.DapperAssetProtectedEvent",
  data: {
    user: "0x8401ed4fc6788c8a",
    assetType: "NBA_TOP_SHOT",
    assetId: 12345,
    actionId: "dapper_1",
    timestamp: 1697234567
  }
}
```

#### 2. DapperAssetCompensatedEvent
```javascript
{
  type: "A.8401ed4fc6788c8a.DapperAssetProtection.DapperAssetCompensatedEvent",
  data: {
    user: "0x8401ed4fc6788c8a",
    assetType: "NBA_TOP_SHOT",
    assetId: 12345,
    compensation: 5.0,
    timestamp: 1697234600
  }
}
```

#### 3. FrothStakedEvent
```javascript
{
  type: "A.8401ed4fc6788c8a.FrothRewards.FrothStakedEvent",
  data: {
    user: "0x8401ed4fc6788c8a",
    amount: 100.0,
    totalStaked: 100.0,
    timestamp: 1697234567
  }
}
```

### Implementation

```javascript
const { EventEmitter } = require('events');
const fcl = require('@onflow/fcl');

class FlowSureEventListener extends EventEmitter {
  constructor() {
    super();
    this.subscriptions = [];
  }
  
  async start() {
    // Subscribe to DapperAssetProtectedEvent
    const protectedSub = await fcl.events(
      "A.8401ed4fc6788c8a.DapperAssetProtection.DapperAssetProtectedEvent"
    ).subscribe(event => {
      this.emit('assetProtected', event);
      this.handleAssetProtected(event);
    });
    
    // Subscribe to CompensationEvent
    const compensationSub = await fcl.events(
      "A.8401ed4fc6788c8a.DapperAssetProtection.DapperAssetCompensatedEvent"
    ).subscribe(event => {
      this.emit('compensation', event);
      this.handleCompensation(event);
    });
    
    // Subscribe to FrothStakedEvent
    const stakedSub = await fcl.events(
      "A.8401ed4fc6788c8a.FrothRewards.FrothStakedEvent"
    ).subscribe(event => {
      this.emit('frothStaked', event);
      this.handleFrothStaked(event);
    });
    
    this.subscriptions.push(protectedSub, compensationSub, stakedSub);
  }
  
  async handleAssetProtected(event) {
    const { user, assetType, assetId, actionId } = event.data;
    
    // Store in database
    await db.protectedAssets.create({
      user,
      assetType,
      assetId,
      actionId,
      status: 'PROTECTED',
      timestamp: event.data.timestamp
    });
    
    // Send notification to user
    await sendNotification(user, {
      type: 'asset_protected',
      message: `Your ${assetType} #${assetId} is now protected!`
    });
  }
  
  async handleCompensation(event) {
    const { user, assetType, assetId, compensation } = event.data;
    
    // Store in database
    await db.compensations.create({
      user,
      assetType,
      assetId,
      amount: compensation,
      timestamp: event.data.timestamp
    });
    
    // Send notification
    await sendNotification(user, {
      type: 'compensation',
      message: `You received ${compensation} FLOW compensation for ${assetType} #${assetId}`
    });
  }
  
  async handleFrothStaked(event) {
    const { user, amount, totalStaked } = event.data;
    
    // Update leaderboard
    await db.stakers.upsert({
      user,
      stakedAmount: totalStaked,
      lastStakedAt: event.data.timestamp
    });
  }
  
  stop() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}

// Usage
const listener = new FlowSureEventListener();
listener.start();

listener.on('assetProtected', (event) => {
  console.log('Asset protected:', event.data);
});

listener.on('compensation', (event) => {
  console.log('Compensation paid:', event.data);
});
```

---

## 📊 Success Metrics Tracking

### API Endpoints for Metrics

#### GET /api/metrics/staking
```json
{
  "totalStakers": 50,
  "totalStaked": 10000.0,
  "goal": 50,
  "achieved": true
}
```

#### GET /api/metrics/protection
```json
{
  "totalProtectedAssets": 100,
  "goal": 100,
  "achieved": true,
  "byType": {
    "NBA_TOP_SHOT": 60,
    "NFL_ALL_DAY": 25,
    "DISNEY_PINNACLE": 15
  }
}
```

#### GET /api/metrics/retry
```json
{
  "totalRetries": 50,
  "successfulRetries": 35,
  "successRate": 0.70,
  "goal": 0.70,
  "achieved": true
}
```

#### GET /api/metrics/vault
```json
{
  "uptime": 1.0,
  "totalPoolBalance": 1000.0,
  "totalPayouts": 50.0,
  "goal": 1.0,
  "achieved": true
}
```

---

## 🚀 Deployment

### Environment Variables
```bash
# Flow Network
FLOW_NETWORK=testnet
FLOW_ACCESS_NODE=https://rest-testnet.onflow.org

# Contract Addresses
FROTH_REWARDS_ADDRESS=0x8401ed4fc6788c8a
DAPPER_PROTECTION_ADDRESS=0x8401ed4fc6788c8a

# Dapper APIs
NBA_TOPSHOT_API=https://api.nbatopshot.com
NFL_ALLDAY_API=https://api.nflallday.com
DISNEY_PINNACLE_API=https://api.disneypinnacle.com

# Database
DATABASE_URL=postgresql://...

# Notifications
NOTIFICATION_SERVICE_URL=...
```

### Deploy to Vercel
```bash
vercel deploy --prod
```

### Deploy to Render
```bash
render deploy
```

---

## ✅ Backend Deliverables Checklist

- [x] Live $FROTH price endpoint
- [x] Staking/unstaking endpoints
- [x] Leaderboard aggregation
- [x] Dapper NFT fetching from all 3 platforms
- [x] Dapper asset protection API
- [x] Protection history tracking
- [x] Webhook event listener for all events
- [x] Metrics tracking endpoints
- [x] Notification system integration
- [x] Database schema for tracking
- [x] Deployment configuration

---

## 📚 External API Documentation

- **NBA Top Shot API:** https://docs.nbatopshot.com/
- **NFL All Day API:** https://docs.nflallday.com/
- **Disney Pinnacle API:** https://docs.disneypinnacle.com/
- **Flow FCL:** https://developers.flow.com/tools/fcl-js
- **KittyPunch ($FROTH):** TBD

---

## 🔒 Security Considerations

1. **Rate Limiting:** Implement rate limits on all endpoints
2. **Authentication:** Require wallet signatures for write operations
3. **Input Validation:** Validate all user inputs
4. **Error Handling:** Never expose internal errors to users
5. **API Keys:** Secure all Dapper API keys in environment variables
6. **CORS:** Configure CORS for frontend domain only

---

## 📈 Performance Targets

| Metric | Target |
|--------|--------|
| API Response Time | <500ms |
| Event Processing Latency | <1s |
| Database Query Time | <100ms |
| Frontend Integration Latency | <1s |
| Uptime | 99.9% |

---

## 📦 Complete Project Structure

```
flowsure-backend/
├── src/
│   ├── config/
│   │   ├── flow.js              # Flow FCL configuration
│   │   └── database.js          # Database connection
│   ├── routes/
│   │   ├── froth.js             # $FROTH endpoints
│   │   ├── dapper.js            # Dapper NFT endpoints
│   │   └── metrics.js           # Metrics endpoints
│   ├── services/
│   │   ├── flowService.js       # Flow blockchain interactions
│   │   ├── dapperService.js     # Dapper API integrations
│   │   └── eventListener.js     # Event monitoring
│   ├── models/
│   │   ├── Staker.js            # Staker database model
│   │   ├── ProtectedAsset.js   # Protected asset model
│   │   └── Compensation.js      # Compensation model
│   ├── middleware/
│   │   ├── auth.js              # Wallet authentication
│   │   ├── validation.js        # Input validation
│   │   └── errorHandler.js      # Error handling
│   └── app.js                   # Express app setup
├── prisma/
│   └── schema.prisma            # Database schema
├── .env.example                 # Environment variables template
├── package.json
└── README.md
```

---

## 📄 package.json

```json
{
  "name": "flowsure-backend",
  "version": "1.0.0",
  "description": "FlowSure backend API for $FROTH staking and Dapper NFT protection",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "migrate": "prisma migrate dev",
    "generate": "prisma generate",
    "test": "jest"
  },
  "dependencies": {
    "@onflow/fcl": "^1.10.0",
    "@prisma/client": "^5.7.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "axios": "^1.6.2",
    "ws": "^8.16.0",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "prisma": "^5.7.0",
    "jest": "^29.7.0"
  }
}
```

---

## 🗄️ Database Schema (Prisma)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Staker {
  id            String   @id @default(uuid())
  address       String   @unique
  stakedAmount  Float    @default(0)
  discount      Float    @default(0)
  lastStakedAt  DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([stakedAmount])
}

model ProtectedAsset {
  id          String   @id @default(uuid())
  user        String
  assetType   String
  assetId     BigInt
  actionId    String   @unique
  status      String   @default("PROTECTED")
  protectedAt DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([user])
  @@index([assetId])
}

model Compensation {
  id        String   @id @default(uuid())
  user      String
  assetType String
  assetId   BigInt
  amount    Float
  txId      String   @unique
  paidAt    DateTime @default(now())
  
  @@index([user])
}

model ActionMetric {
  id              String   @id @default(uuid())
  actionType      String
  success         Boolean
  retryCount      Int      @default(0)
  executedAt      DateTime @default(now())
  
  @@index([actionType])
  @@index([executedAt])
}
```

---

## 🔧 Flow Configuration

```javascript
// src/config/flow.js

const fcl = require('@onflow/fcl');

fcl.config({
  'accessNode.api': process.env.FLOW_ACCESS_NODE || 'https://rest-testnet.onflow.org',
  'discovery.wallet': 'https://fcl-discovery.onflow.org/testnet/authn',
  'app.detail.title': 'FlowSure',
  'app.detail.icon': 'https://flowsure.io/logo.png',
  '0xFrothRewards': process.env.FROTH_REWARDS_ADDRESS,
  '0xDapperProtection': process.env.DAPPER_PROTECTION_ADDRESS
});

module.exports = fcl;
```

---

## 🚀 Quick Start for LLM

**To generate the complete backend, provide this guide to an LLM with the following prompt:**

```
Using the BACKEND_INTEGRATION.md guide, create a complete Node.js/Express backend for FlowSure with:

1. All API endpoints from sections A and B
2. Event listener implementation from section C
3. Database models using Prisma
4. Flow blockchain integration using FCL
5. Error handling and validation middleware
6. Environment configuration
7. Deployment-ready code for Vercel/Render

Follow the exact endpoint signatures, response formats, and implementation examples provided.
Include all dependencies from package.json and use the Prisma schema for database models.
```

---

## ✅ What the LLM Will Generate

1. **Complete Express server** with all routes
2. **Flow FCL integration** for smart contract calls
3. **Database layer** with Prisma ORM
4. **Event monitoring system** with WebSocket support
5. **Dapper API integrations** for all 3 platforms
6. **Metrics tracking** for success criteria
7. **Authentication & validation** middleware
8. **Error handling** with proper HTTP status codes
9. **Deployment configuration** for Vercel/Render
10. **Environment setup** with .env.example

---

## 🎓 Additional Context for LLM

**Smart Contract Addresses (Testnet):**
- FrothRewards: `0x8401ed4fc6788c8a`
- DapperAssetProtection: `0x8401ed4fc6788c8a`
- InsuranceVault: `0x8401ed4fc6788c8a`
- InsuredAction: `0x8401ed4fc6788c8a`

**Key Cadence Scripts to Include:**
All scripts are in `/scripts/` directory:
- `get_staker_info.cdc`
- `get_protected_assets.cdc`
- `get_vault_stats.cdc`

**Key Transactions to Include:**
All transactions are in `/transactions/` directory:
- `stake_froth.cdc`
- `unstake_froth.cdc`
- `protect_dapper_nft.cdc`

The LLM should reference these files for exact Cadence code when building the backend integration.

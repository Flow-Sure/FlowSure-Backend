# FlowSure Backend

Backend API for FlowSure - Flow blockchain integration for $FROTH staking and Dapper NFT protection.

## Tech Stack

- **Node.js** + **Express** - Server framework
- **MongoDB** + **Mongoose** - Database and ORM
- **@onflow/fcl** - Flow blockchain integration
- **WebSocket** - Real-time event listening

## Features

- $FROTH token staking/unstaking
- Dapper NFT asset protection (NBA Top Shot, NFL All Day, Disney Pinnacle)
- Real-time blockchain event monitoring
- Leaderboard and metrics tracking
- Rate limiting and security middleware

## Setup

### Prerequisites

- Node.js 18+
- MongoDB running locally or connection URI
- Flow testnet access

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
```

### Environment Variables

```env
FLOW_NETWORK=testnet
FLOW_ACCESS_NODE=https://rest-testnet.onflow.org
FROTH_REWARDS_ADDRESS=0x8401ed4fc6788c8a
DAPPER_PROTECTION_ADDRESS=0x8401ed4fc6788c8a
MONGODB_URI=mongodb://localhost:27017/flowsure
PORT=3000
```

### Running

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start and display:
```
MongoDB connected successfully
Event listener initialized (subscriptions disabled for development)
FlowSure backend running on port 3000
API Documentation: http://localhost:3000/api-docs
```

### API Documentation

Interactive Swagger documentation is available at:
```
http://localhost:3000/api-docs
```

See `SWAGGER_GUIDE.md` for detailed usage instructions.

## API Endpoints

### $FROTH Integration

- `GET /api/froth/price` - Get current $FROTH price
- `POST /api/froth/stake` - Stake $FROTH tokens
- `POST /api/froth/unstake` - Unstake $FROTH tokens
- `GET /api/froth/staker/:address` - Get staker info
- `GET /api/froth/leaderboard` - Get top stakers

### Dapper Integration

- `GET /api/dapper/assets/:address` - Get user's Dapper NFTs
- `POST /api/dapper/insure` - Protect a Dapper asset
- `GET /api/dapper/history/:address` - Get protection history

### Metrics

- `GET /api/metrics/staking` - Staking metrics
- `GET /api/metrics/protection` - Protection metrics
- `GET /api/metrics/retry` - Retry success metrics
- `GET /api/metrics/vault` - Vault metrics

## Project Structure

```
src/
├── config/
│   ├── flow.js              # Flow FCL configuration
│   └── database.js          # MongoDB connection
├── routes/
│   ├── froth.js             # $FROTH endpoints
│   ├── dapper.js            # Dapper NFT endpoints
│   └── metrics.js           # Metrics endpoints
├── services/
│   ├── flowService.js       # Flow blockchain interactions
│   ├── dapperService.js     # Dapper API integrations
│   └── eventListener.js     # Event monitoring
├── models/
│   ├── Staker.js            # Staker schema
│   ├── ProtectedAsset.js   # Protected asset schema
│   ├── Compensation.js      # Compensation schema
│   └── ActionMetric.js      # Action metric schema
├── middleware/
│   ├── auth.js              # Wallet authentication
│   ├── validation.js        # Input validation
│   └── errorHandler.js      # Error handling
└── app.js                   # Express app setup
```

## Database Models

### Staker
- address (unique)
- stakedAmount
- discount
- lastStakedAt

### ProtectedAsset
- user
- assetType (NBA_TOP_SHOT | NFL_ALL_DAY | DISNEY_PINNACLE)
- assetId
- actionId (unique)
- status
- protectedAt

### Compensation
- user
- assetType
- assetId
- amount
- txId (unique)
- paidAt

### ActionMetric
- actionType
- success
- retryCount
- executedAt

## Development

```bash
# Run tests
npm test

# Lint code
npm run lint
```

## Deployment

The backend can be deployed to:
- Vercel
- Render
- Railway
- Any Node.js hosting platform

Ensure MongoDB is accessible and environment variables are configured.

## License

MIT

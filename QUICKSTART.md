# FlowSure Backend - Quick Start Guide

## Prerequisites

1. **Node.js 18+** installed
2. **MongoDB** running locally or accessible via URI
3. **Flow testnet** access

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup MongoDB

**Option A: Local MongoDB**
```bash
# Install MongoDB (macOS)
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Verify it's running
mongosh
```

**Option B: MongoDB Atlas (Cloud)**
- Create free account at https://www.mongodb.com/cloud/atlas
- Create a cluster
- Get connection string
- Update `MONGODB_URI` in `.env`

### 3. Configure Environment

The `.env` file is already created with default values. Update if needed:

```env
MONGODB_URI=mongodb://localhost:27017/flowsure
PORT=3000
```

### 4. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

You should see:
```
MongoDB connected successfully
Event listeners started successfully
FlowSure backend running on port 3000
```

## Testing the API

### 1. Check Server Status
```bash
curl http://localhost:3000/
```

### 2. Get FROTH Price
```bash
curl http://localhost:3000/api/froth/price
```

### 3. Get Staker Info
```bash
curl http://localhost:3000/api/froth/staker/0x8401ed4fc6788c8a
```

### 4. Get Metrics
```bash
curl http://localhost:3000/api/metrics/staking
curl http://localhost:3000/api/metrics/protection
```

## Project Structure

```
FlowSure-Backend/
├── src/
│   ├── app.js                    # Main Express app
│   ├── config/
│   │   ├── database.js           # MongoDB connection
│   │   └── flow.js               # Flow blockchain config
│   ├── middleware/
│   │   ├── auth.js               # Authentication
│   │   ├── errorHandler.js       # Error handling
│   │   └── validation.js         # Input validation
│   ├── models/
│   │   ├── ActionMetric.js       # Mongoose model
│   │   ├── Compensation.js       # Mongoose model
│   │   ├── ProtectedAsset.js     # Mongoose model
│   │   └── Staker.js             # Mongoose model
│   ├── routes/
│   │   ├── dapper.js             # Dapper NFT routes
│   │   ├── froth.js              # FROTH staking routes
│   │   └── metrics.js            # Metrics routes
│   └── services/
│       ├── dapperService.js      # Dapper API integration
│       ├── eventListener.js      # Blockchain event listener
│       └── flowService.js        # Flow blockchain service
├── .env                          # Environment variables
├── .env.example                  # Environment template
├── package.json                  # Dependencies
├── API_REFERENCE.md              # API documentation
└── README.md                     # Project documentation
```

## Common Issues

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Make sure MongoDB is running
```bash
brew services start mongodb-community
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:** Change PORT in `.env` or kill the process using port 3000
```bash
lsof -ti:3000 | xargs kill -9
```

### Flow Connection Issues
**Solution:** Check that `FLOW_ACCESS_NODE` is accessible
```bash
curl https://rest-testnet.onflow.org
```

## Next Steps

1. **Review API Documentation**: See `API_REFERENCE.md`
2. **Test Endpoints**: Use Postman or curl
3. **Integrate with Frontend**: Connect to your React/Next.js app
4. **Deploy**: Deploy to Vercel, Render, or Railway

## Development Tips

- Use `npm run dev` for development (auto-reload on changes)
- Check MongoDB data: `mongosh` → `use flowsure` → `db.stakers.find()`
- Monitor logs for blockchain events
- Rate limit is 100 requests per 15 minutes per IP

## Support

For issues or questions:
- Check `Backend-PRD.md` for detailed specifications
- Review `API_REFERENCE.md` for endpoint details
- Check MongoDB logs: `mongosh` → `show dbs`

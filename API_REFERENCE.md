# FlowSure API Reference

## Base URL
```
http://localhost:3000/api
```

## $FROTH Endpoints

### Get FROTH Price
```http
GET /froth/price
```

**Response:**
```json
{
  "price": 0.15,
  "currency": "USD",
  "timestamp": 1697234567,
  "source": "KittyPunch API"
}
```

### Stake FROTH
```http
POST /froth/stake
Content-Type: application/json

{
  "user": "0x8401ed4fc6788c8a",
  "amount": 100.0
}
```

**Response:**
```json
{
  "txId": "abc123...",
  "status": "sealed",
  "stakedAmount": 100.0,
  "totalStaked": 100.0,
  "discount": 0.20,
  "discountPercentage": 20.0
}
```

### Unstake FROTH
```http
POST /froth/unstake
Content-Type: application/json

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

### Get Staker Info
```http
GET /froth/staker/:address
```

**Response:**
```json
{
  "address": "0x8401ed4fc6788c8a",
  "stakedAmount": 100.0,
  "discount": 0.20,
  "discountPercentage": 20.0
}
```

### Get Leaderboard
```http
GET /froth/leaderboard
```

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

## Dapper NFT Endpoints

### Get User Assets
```http
GET /dapper/assets/:address
```

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
  "allDay": [],
  "disneyPinnacle": []
}
```

### Insure Dapper Asset
```http
POST /dapper/insure
Content-Type: application/json

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

### Get Protection History
```http
GET /dapper/history/:address
```

**Response:**
```json
{
  "protectedAssets": [
    {
      "assetId": "12345",
      "assetType": "NBA_TOP_SHOT",
      "status": "SUCCESS",
      "protectedAt": 1697234567,
      "compensated": false
    }
  ],
  "compensations": [
    {
      "assetId": "67890",
      "assetType": "NFL_ALL_DAY",
      "amount": 5.0,
      "timestamp": 1697234600
    }
  ],
  "totalProtected": 5,
  "totalCompensated": 1
}
```

## Metrics Endpoints

### Staking Metrics
```http
GET /metrics/staking
```

**Response:**
```json
{
  "totalStakers": 50,
  "totalStaked": 10000.0,
  "goal": 50,
  "achieved": true
}
```

### Protection Metrics
```http
GET /metrics/protection
```

**Response:**
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

### Retry Metrics
```http
GET /metrics/retry
```

**Response:**
```json
{
  "totalRetries": 50,
  "successfulRetries": 35,
  "successRate": 0.70,
  "goal": 0.70,
  "achieved": true
}
```

### Vault Metrics
```http
GET /metrics/vault
```

**Response:**
```json
{
  "uptime": 1.0,
  "totalPoolBalance": 1000.0,
  "totalPayouts": 50.0,
  "goal": 1.0,
  "achieved": true
}
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message here"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (authentication required)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const FlowSureEventListener = require('./services/eventListener');
const schedulerService = require('./services/schedulerService');
const eventMonitor = require('./services/eventMonitor');
const websocketServer = require('./services/websocketServer');
const scheduledTransferCron = require('./services/scheduledTransferCron');
const flowSchedulerCron = require('./services/flowSchedulerCron');

const frothRoutes = require('./routes/froth');
const dapperRoutes = require('./routes/dapper');
const metricsRoutes = require('./routes/metrics');
const transactionRoutes = require('./routes/transactions');
const nbaTopShotRoutes = require('./routes/nbaTopShot');
const scheduledTransfersRoutes = require('./routes/scheduledTransfers');
const recipientListsRoutes = require('./routes/recipientLists');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.get('/', (req, res) => {
  res.json({
    message: 'FlowSure Backend API',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      froth: '/api/froth',
      dapper: '/api/dapper',
      metrics: '/api/metrics',
      transactions: '/api/transactions',
      scheduledTransfers: '/api/scheduled-transfers',
      recipientLists: '/api/recipient-lists'
    }
  });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'FlowSure API Documentation'
}));

app.use('/api/froth', frothRoutes);
app.use('/api/dapper', dapperRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/nba-topshot', nbaTopShotRoutes);
app.use('/api/scheduled-transfers', scheduledTransfersRoutes);
app.use('/api/recipient-lists', recipientListsRoutes);

app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    
    const server = app.listen(PORT, () => {
      console.log(`FlowSure backend running on port ${PORT}`);
      console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
    });

    // Initialize WebSocket server
    websocketServer.initialize(server);
    
    // Start event monitoring
    await eventMonitor.start();
    console.log('Event monitor started');
    
    // Start scheduler service
    await schedulerService.start();
    console.log('Scheduler service started');
    
    // Start scheduled transfer cron job
    scheduledTransferCron.start();
    console.log('Scheduled transfer cron job started');
    
    // Start Flow scheduler monitor
    flowSchedulerCron.startFlowSchedulerMonitor();
    console.log('Flow scheduler monitor started');
    
    // Legacy event listener (keep for compatibility)
    const eventListener = new FlowSureEventListener();
    await eventListener.start();
    
    eventListener.on('assetProtected', (event) => {
      console.log('Asset protected event received:', event.data);
    });
    
    eventListener.on('compensation', (event) => {
      console.log('Compensation event received:', event.data);
      websocketServer.broadcastEvent('compensation', event.data);
    });
    
    eventListener.on('frothStaked', (event) => {
      console.log('FROTH staked event received:', event.data);
      websocketServer.broadcastEvent('frothStaked', event.data);
    });
    
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      eventListener.stop();
      eventMonitor.stop();
      schedulerService.stop();
      scheduledTransferCron.stop();
      flowSchedulerCron.stopFlowSchedulerMonitor();
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      eventListener.stop();
      eventMonitor.stop();
      schedulerService.stop();
      scheduledTransferCron.stop();
      flowSchedulerCron.stopFlowSchedulerMonitor();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;

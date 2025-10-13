const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FlowSure API',
      version: '1.0.0',
      description: 'Backend API for FlowSure - Flow blockchain integration for $FROTH staking and Dapper NFT protection',
      contact: {
        name: 'FlowSure Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      {
        name: 'FROTH',
        description: '$FROTH token staking and rewards',
      },
      {
        name: 'Dapper',
        description: 'Dapper NFT asset protection',
      },
      {
        name: 'Metrics',
        description: 'Platform metrics and statistics',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

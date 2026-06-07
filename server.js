const app = require('./src/app');
const { sequelize, authenticate } = require('./src/db/models');
const config = require('./src/config/env');
const logger = require('./src/config/logger');

const PORT = config.port;

let server;

async function startServer() {
  try {
    // Authenticate database connection
    await authenticate();
    
    // Sync database schema (use migrations in production!)
    logger.info('Syncing database schema...');
    await sequelize.sync({ alter: true });
    logger.info('Database schema synced successfully');
    
    // Start server
    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info('SERVER_STARTED', {
        port: PORT,
        environment: config.nodeEnv,
        nodeVersion: process.version,
        pid: process.pid
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown handlers
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      
      // Close database connection
      sequelize.close().then(() => {
        logger.info('Database connection closed');
        process.exit(0);
      }).catch((err) => {
        logger.error('Error closing database:', err.message);
        process.exit(1);
      });
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error.message, { stack: error.stack });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

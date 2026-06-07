const express = require('express');
const router = express.Router();
const { sequelize } = require('../../db/models');
const logger = require('../../config/logger');
const packageJson = require('../../../package.json');

/**
 * GET /health
 * Check database connectivity and return service status
 */
router.get('/health', async (req, res) => {
  logger.debug('Health check request received');
  
  try {
    // Test database connection
    await sequelize.authenticate();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: packageJson.version || '1.0.0',
      db: 'connected',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Health check failed:', error.message);
    
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      version: packageJson.version || '1.0.0',
      db: 'disconnected',
      error: error.message,
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

module.exports = router;

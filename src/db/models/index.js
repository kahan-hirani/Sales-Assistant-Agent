const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const logger = require('../../config/logger');

// Get database configuration
const env = process.env.NODE_ENV || 'development';
const config = require('../../config/database')[env];

let sequelize;

// Validate database URL
if (!config.url) {
  logger.error('DATABASE_URL is not configured!');
  throw new Error('DATABASE_URL environment variable is required');
}

// Detect Supabase
const isSupabase = config.url.includes('supabase.co') || 
                   config.url.includes('aws-0-');

if (isSupabase) {
  logger.info('Detected Supabase database connection');
}

// Configure Sequelize with enhanced options for cloud databases
const sequelizeOptions = {
  dialect: config.dialect,
  dialectOptions: config.dialectOptions,
  logging: config.logging === false ? false : (msg) => logger.debug(msg),
  pool: config.pool || {
    max: isSupabase ? 5 : 10,  // Conservative for Supabase
    min: 0,
    acquire: 60000,
    idle: 10000
  },
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /Connection terminated unexpectedly/,
      /ECONNRESET/,
      /ETIMEDOUT/,
      /ECONNREFUSED/
    ],
    backoffBase: 1000,  // Start with 1s delay
    backoffExponent: 1.5  // Increase delay between retries
  },
  // Connection timeout settings
  dialectOptions: {
    ...config.dialectOptions,
    connectTimeout: 60000  // 60 seconds
  }
};

try {
  sequelize = new Sequelize(config.url, sequelizeOptions);
  logger.info('Sequelize initialized successfully');
} catch (error) {
  logger.error('Failed to initialize Sequelize:', error.message);
  throw error;
}

// Import models
const Conversation = require('./Conversation')(sequelize, DataTypes);
const MemoryFact = require('./MemoryFact')(sequelize, DataTypes);
const EvalLog = require('./EvalLog')(sequelize, DataTypes);

// Define associations (if any)
// Currently no foreign key relationships needed between these models

// Test database connection with retry
const authenticate = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await sequelize.authenticate();
      logger.info('Database connection established successfully');
      return;
    } catch (error) {
      logger.error(`Database connection attempt ${i + 1}/${retries} failed:`, error.message);
      
      if (i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;  // Exponential backoff: 1s, 2s, 4s
        logger.info(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error('All database connection attempts failed');
        throw error;
      }
    }
  }
};

// Graceful shutdown handler
const closeConnection = async () => {
  try {
    await sequelize.close();
    logger.info('Database connection closed gracefully');
  } catch (error) {
    logger.error('Error closing database connection:', error.message);
  }
};

module.exports = {
  sequelize,
  Sequelize,
  Conversation,
  MemoryFact,
  EvalLog,
  authenticate,
  closeConnection,
  isSupabase
};

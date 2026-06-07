/**
 * Sequelize Models Index
 * Initializes Sequelize and exports all models
 */

const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const logger = require('../../config/logger');

// Get database configuration
const env = process.env.NODE_ENV || 'development';
const config = require('../../config/database')[env];

let sequelize;

// Configure Sequelize with retry logic for local development
const sequelizeOptions = {
  dialect: config.dialect,
  dialectOptions: config.dialectOptions,
  logging: config.logging === false ? false : (msg) => logger.debug(msg),
  pool: config.pool || {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/
    ]
  }
};

if (config.url) {
  sequelize = new Sequelize(config.url, sequelizeOptions);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    ...sequelizeOptions
  });
}

// Import models
const Conversation = require('./Conversation')(sequelize, DataTypes);
const MemoryFact = require('./MemoryFact')(sequelize, DataTypes);
const EvalLog = require('./EvalLog')(sequelize, DataTypes);

// Define associations (if any)
// Currently no foreign key relationships needed between these models

// Test database connection
const authenticate = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error('Unable to connect to the database:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  Sequelize,
  Conversation,
  MemoryFact,
  EvalLog,
  authenticate
};

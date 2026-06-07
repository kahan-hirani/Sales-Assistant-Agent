/**
 * Sequelize Database Configuration
 * Supports local development, Docker, and cloud deployments
 */

const config = require('./env');

// Parse DATABASE_URL for local development without SSL
const isLocalDevelopment = config.nodeEnv === 'development';

module.exports = {
  development: {
    url: config.databaseUrl,
    dialect: 'postgres',
    dialectOptions: isLocalDevelopment && !config.databaseUrl?.includes('railway') 
      ? { 
          // No SSL for local development
        }
      : {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        },
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  production: {
    url: config.databaseUrl,
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    url: config.databaseUrl,
    dialect: 'postgres',
    dialectOptions: {},
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};

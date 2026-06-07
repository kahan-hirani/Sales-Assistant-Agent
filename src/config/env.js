require('dotenv').config();

const logger = require('./logger');

const requiredVars = ['GROQ_API_KEY', 'DATABASE_URL'];
const missingVars = [];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    missingVars.push(varName);
  }
}

if (missingVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  logger.error('Please check your .env file or environment configuration');
  process.exit(1);
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  groqApiKey: process.env.GROQ_API_KEY,
  databaseUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV || 'development',
  memoryBackend: process.env.MEMORY_BACKEND || 'sequelize'
};

logger.info('Environment configuration validated successfully');

module.exports = Object.freeze(config);

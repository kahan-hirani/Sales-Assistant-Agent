/**
 * Memory Store Factory
 * Returns the appropriate memory store implementation based on MEMORY_BACKEND env var
 * 
 * To swap to Redis or Mem0:
 * 1. Implement IMemoryStore interface in a new file (e.g., redisMemory.js)
 * 2. Update MEMORY_BACKEND env var
 * 3. Add the new case in the factory below
 */

const config = require('../config/env');
const SequelizeMemoryStore = require('./sequelizeMemory');
const logger = require('../config/logger');

let memoryStore;

switch (config.memoryBackend) {
  case 'sequelize':
    memoryStore = new SequelizeMemoryStore();
    logger.info('Using Sequelize/PostgreSQL memory backend');
    break;
  
  // Future implementations:
  // case 'redis':
  //   memoryStore = new RedisMemoryStore();
  //   break;
  // case 'mem0':
  //   memoryStore = new Mem0MemoryStore();
  //   break;
  
  default:
    logger.warn(`Unknown memory backend: ${config.memoryBackend}, defaulting to Sequelize`);
    memoryStore = new SequelizeMemoryStore();
}

module.exports = memoryStore;

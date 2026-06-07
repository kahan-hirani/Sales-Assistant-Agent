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

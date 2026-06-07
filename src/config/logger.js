const winston = require('winston');
const { AsyncLocalStorage } = require('async_hooks');
const path = require('path');

// AsyncLocalStorage to track requestId across async operations
const asyncLocalStorage = new AsyncLocalStorage();

const nodeEnv = process.env.NODE_ENV || 'development';

// Custom format to add requestId from AsyncLocalStorage
const requestIdFormat = winston.format((info) => {
  const store = asyncLocalStorage.getStore();
  if (store && store.requestId) {
    info.requestId = store.requestId;
  }
  return info;
});

// Development format: colorized, simple
const devFormat = winston.format.combine(
  winston.format.timestamp(),
  requestIdFormat(),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, requestId, ...metadata }) => {
    let msg = `${timestamp} [${level}]`;
    if (requestId) {
      msg += ` [${requestId}]`;
    }
    msg += `: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Production format: JSON
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  requestIdFormat(),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: nodeEnv === 'production' ? prodFormat : devFormat
  })
];

// Add file transports for non-development environments
if (nodeEnv !== 'development') {
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: prodFormat
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: prodFormat
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'sales-agent-api' },
  transports
});

// Helper to run function within request context
logger.runWithRequestId = (requestId, fn) => {
  return asyncLocalStorage.run({ requestId }, fn);
};

// Helper to get current requestId
logger.getRequestId = () => {
  const store = asyncLocalStorage.getStore();
  return store ? store.requestId : null;
};

module.exports = logger;

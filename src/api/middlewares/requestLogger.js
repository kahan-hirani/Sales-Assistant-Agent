/**
 * Request Logger Middleware
 * Logs every incoming request with requestId
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../../config/logger');

/**
 * Request logger middleware
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next
 */
function requestLogger(req, res, next) {
  // Generate requestId
  const requestId = uuidv4();
  
  // Attach to request
  req.requestId = requestId;
  
  // Add to response header
  res.setHeader('X-Request-Id', requestId);
  
  // Record start time
  const startTime = Date.now();
  
  // Extract userId from params if available
  const userId = req.params?.userId || null;
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    userId,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent')
  });
  
  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    const logData = {
      requestId,
      statusCode: res.statusCode,
      durationMs: duration
    };
    
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });
  
  next();
}

module.exports = { requestLogger };

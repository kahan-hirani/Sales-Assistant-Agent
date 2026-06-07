const logger = require('../../config/logger');

// Custom error classes
class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.details = details;
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.code = 'NOT_FOUND';
    this.statusCode = 404;
  }
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
    this.code = 'UNAUTHORIZED';
    this.statusCode = 401;
  }
}

/**
 * Global error handler
 * @param {Error} err - Error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next
 */
function errorHandler(err, req, res, next) {
  // Determine status code
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_ERROR';
  
  // Map known error types
  if (err.name === 'ValidationError' || err.name === 'SequelizeValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    errorCode = 'DUPLICATE_ERROR';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (err.name === 'SyntaxError' && err.body) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
  }
  
  // Build error response
  const isDev = process.env.NODE_ENV === 'development';
  const errorResponse = {
    success: false,
    error: {
      message: err.message || 'An unexpected error occurred',
      code: errorCode
    }
  };
  
  // Add details for validation errors
  if (err.details) {
    errorResponse.error.details = err.details;
  }
  
  // Only include stack trace in development
  if (isDev && err.stack) {
    errorResponse.error.stack = err.stack.split('\n');
  }
  
  // Log error with requestId if available
  const logData = {
    requestId: req.requestId || logger.getRequestId(),
    statusCode,
    errorCode,
    message: err.message,
    path: req.path,
    method: req.method
  };
  
  if (statusCode >= 500) {
    logger.error('Server error:', logData);
  } else {
    logger.warn('Client error:', logData);
  }
  
  res.status(statusCode).json(errorResponse);
}

module.exports = {
  errorHandler,
  ValidationError,
  NotFoundError,
  UnauthorizedError
};

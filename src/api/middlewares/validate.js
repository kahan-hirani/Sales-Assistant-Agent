/**
 * Validation Middleware Factory
 * Creates Express middleware for Joi schema validation
 */

const Joi = require('joi');
const { ValidationError } = require('./errorHandler');

/**
 * Create validation middleware for request body
 * @param {Joi.Schema} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Return all validation errors
      stripUnknown: true, // Remove unknown keys
      convert: true // Convert types (e.g., string '123' to number 123)
    });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return next(new ValidationError('Validation failed', details));
    }
    
    // Replace body with validated/coerced value
    req.body = value;
    next();
  };
}

/**
 * Common validation schemas
 */
const schemas = {
  // Chat message schema
  chatMessage: Joi.object({
    message: Joi.string()
      .min(1)
      .max(2000)
      .required()
      .messages({
        'string.empty': 'Message cannot be empty',
        'string.min': 'Message must be at least 1 character',
        'string.max': 'Message cannot exceed 2000 characters',
        'any.required': 'Message is required'
      })
  }),
  
  // User ID param schema
  userId: Joi.object({
    userId: Joi.string()
      .min(1)
      .max(100)
      .required()
      .pattern(/^[a-zA-Z0-9_-]+$/) // Alphanumeric, underscore, hyphen
      .messages({
        'string.pattern.base': 'User ID can only contain alphanumeric characters, underscores, and hyphens'
      })
  })
};

module.exports = {
  validate,
  schemas
};

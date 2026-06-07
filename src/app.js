/**
 * Express Application Setup
 * Configures middleware and routes
 */

require('dotenv').config();
require('./config/env'); // Validates env vars, crashes if missing

const express = require('express');
const cors = require('cors');
const chatRoutes = require('./api/routes/chat.routes');
const catalogRoutes = require('./api/routes/catalog.routes');
const healthRoutes = require('./api/routes/health.routes');
const evalRoutes = require('./api/routes/evals.routes');
const { errorHandler } = require('./api/middlewares/errorHandler');
const { requestLogger } = require('./api/middlewares/requestLogger');
const logger = require('./config/logger');

const app = express();

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'development' ? '*' : undefined,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));

// Request logger middleware (must come before routes)
app.use(requestLogger);

// Routes
app.use('/api/v1', chatRoutes);
app.use('/api/v1', catalogRoutes);
app.use('/api/v1', healthRoutes);
app.use('/api/v1', evalRoutes);

// 404 handler
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND'
    }
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;

require('dotenv').config();
require('./config/env'); // Validates env vars, crashes if missing

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
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

// Swagger UI Custom Options
const swaggerUiOptions = {
  explorer: true,
  customSiteTitle: 'Sales Agent API Documentation',
  customCss: `
    .topbar { display: none }
    .swagger-ui .info { margin: 30px 0 }
    .swagger-ui .info .title { font-size: 36px; font-weight: bold; color: #2c3e50 }
    .swagger-ui .scheme-container { background: #f8f9fa; padding: 20px; border-radius: 8px }
    .swagger-ui .opblock { border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1) }
    .swagger-ui .opblock .opblock-summary { padding: 15px }
    .swagger-ui .btn { border-radius: 6px; transition: all 0.3s ease }
    .swagger-ui .btn.execute { background-color: #28a745; border-color: #28a745 }
    .swagger-ui .btn.execute:hover { background-color: #218838; border-color: #1e7e34 }
    .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5 { color: #2c3e50 }
  `,
  swaggerOptions: {
    docExpansion: 'list',
    filter: true,
    showRequestDuration: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    persistAuthorization: true,
    tryItOutEnabled: true,
    displayRequestDuration: true,
    syntaxHighlight: {
      theme: 'monokai'
    },
    requestInterceptor: (req) => {
      // Add custom headers if needed
      return req;
    }
  }
};

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, swaggerUiOptions));

// Redirect root to API docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Serve Swagger JSON spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

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

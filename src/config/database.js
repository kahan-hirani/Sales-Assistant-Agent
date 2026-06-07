/**
 * Sequelize Database Configuration
 * Supports local development, Docker, Supabase, and cloud deployments
 * 
 * IMPORTANT: Supabase Configuration
 * - Use Session Pooler port (6543) for connection pooling
 * - Must enable SSL with rejectUnauthorized: false
 * - Connection limit: 10 for free tier, 30 for Pro
 * - Always use IPv4 (enable IPv4 addon if needed)
 */

const config = require('./env');

// Detect if using Supabase (session pooler or direct connection)
const isSupabase = config.databaseUrl?.includes('supabase.co') || 
                   config.databaseUrl?.includes('aws-0-');

// Detect environment
const isProduction = config.nodeEnv === 'production';

// Base configuration for all environments
const baseConfig = {
  dialect: 'postgres',
  logging: isProduction ? false : (msg) => console.log(msg),
  pool: {
    // Supabase free tier: 10 connections max
    // Leave room for other apps/environments
    max: isProduction ? 5 : 3,  // Reduced for Supabase safety
    min: 0,  // Allow all connections to close when idle
    acquire: 60000,  // Increased timeout for external DB (60s)
    idle: 10000,
    evict: 1000  // Check for idle connections every second
  },
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /Connection terminated unexpectedly/,
      /ECONNRESET/,
      /ETIMEDOUT/
    ]
  }
};

// SSL Configuration
// Supabase REQUIRES SSL, local development may not
const getSslConfig = () => {
  // Always use SSL for production or Supabase
  if (isProduction || isSupabase) {
    return {
      require: true,
      rejectUnauthorized: false  // Required for self-signed certs
    };
  }
  // Development without SSL (local PostgreSQL)
  return false;
};

// Dialect options
const getDialectOptions = () => {
  const ssl = getSslConfig();
  
  if (!ssl) {
    return {};  // No SSL for local dev
  }
  
  return {
    ssl: ssl,
    // Additional options for Supabase stability
    keepAlive: true,
    statement_timeout: 30000,  // 30s query timeout
    query_timeout: 30000,
    connectTimeout: 60000  // 60s connection timeout
  };
};

module.exports = {
  development: {
    url: config.databaseUrl,
    ...baseConfig,
    dialectOptions: getDialectOptions(),
    logging: console.log
  },
  production: {
    url: config.databaseUrl,
    ...baseConfig,
    dialectOptions: getDialectOptions()
  },
  test: {
    url: config.databaseUrl,
    ...baseConfig,
    dialectOptions: isSupabase ? getDialectOptions() : {},
    logging: false
  }
};

/**
 * Jest Setup File
 * Configures test environment
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'test-groq-api-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.PORT = '3001';

// Mock logger to avoid console output during tests
jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  getRequestId: jest.fn(() => 'test-request-id'),
  runWithRequestId: jest.fn((id, fn) => fn())
}));

// Increase timeout for integration tests
jest.setTimeout(30000);

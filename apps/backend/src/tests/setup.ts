import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.test') });

// Global test setup
beforeAll(() => {
  // Verify required environment variables
  const requiredEnvVars = [
    'SPORTRADAR_API_KEY',
    'TEST_SPORT_EVENT_ID'
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`⚠️ Missing required test environment variables: ${missing.join(', ')}`);
    console.warn('Some tests may fail. Create a .env.test file with these variables.');
  }
});

// Global test teardown
afterAll(() => {
  // Add any cleanup here if needed
});

// Mock authentication middleware
jest.mock('../api/middleware/auth', () => ({
  authenticateUser: (req: any, res: any, next: any) => {
    req.user = {
      id: 'test-user-id',
      email: 'test@example.com'
    };
    next();
  }
})); 
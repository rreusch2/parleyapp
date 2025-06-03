import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.join(__dirname, '../../.env.test') });

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
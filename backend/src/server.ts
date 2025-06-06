import dotenv from 'dotenv';
import app from './api';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;

// Start the server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
  logger.info(`API available at http://localhost:${PORT}/api`);
}); 
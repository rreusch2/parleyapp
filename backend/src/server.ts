import dotenv from 'dotenv';
import app from './api';
import { logger } from './utils/logger';
import { initScheduler } from './services/sportsData/scheduler';
import { initializeDailyGames } from './scripts/dailyGamesFetch';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;

// Initialize sports data scheduler
initScheduler();

// Start the server
app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
  logger.info(`API available at http://localhost:${PORT}/api`);
  
  // Initialize daily games with smart duplicate prevention
  setTimeout(async () => {
    try {
      await initializeDailyGames();
      logger.info('✅ Daily games initialization completed');
    } catch (error) {
      logger.error('❌ Error in daily games initialization:', error);
    }
  }, 2000); // Wait 2 seconds for server to fully start
}); 
import express, { Request, Response } from 'express';
import { fetchTomorrowGames } from '../scripts/fetchTomorrowGames';
import { createLogger } from '../utils/logger';
import sportsEventsRoutes from '../api/routes/sportsEvents';

const router = express.Router();
const logger = createLogger('api');

// Mount sports events routes
router.use('/sports-events', sportsEventsRoutes);

// Endpoint to fetch tomorrow's games
router.post('/fetch-tomorrow-games', async (req: Request, res: Response) => {
  try {
    logger.info('📅 API request to fetch tomorrow\'s games');
    
    // Run the fetch tomorrow games script
    await fetchTomorrowGames();
    
    logger.info('✅ Successfully fetched tomorrow\'s games via API');
    res.json({ 
      success: true, 
      message: 'Tomorrow\'s games fetched successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error fetching tomorrow\'s games via API:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch tomorrow\'s games',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
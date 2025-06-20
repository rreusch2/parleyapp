import { Router } from 'express';
import { 
  getSportsEvents, 
  getSportsEventById, 
  searchSportsEvents 
} from '../controllers/sportsEvents';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// TEMPORARY: Test route without auth for debugging
router.get('/test-no-auth', async (req, res) => {
  try {
    console.log('Testing sports events without auth...');
    
    // Simple query to check if we can connect to database
    const { supabase } = await import('../../services/supabase/client');
    const { data, error } = await supabase
      .from('sports_events')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database query failed', details: error.message });
    }
    
    console.log(`Found ${data?.length || 0} total games in database`);
    
    res.json({
      success: true,
      totalGames: data?.length || 0,
      games: data || [],
      message: 'Database connection working'
    });
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ error: 'Server error', details: error instanceof Error ? error.message : String(error) });
  }
});

// TEMPORARILY DISABLE AUTH FOR TESTING CORS
// router.use(authenticateUser);

// Get all sports events with optional filters
router.get('/', getSportsEvents);

// Search sports events
router.get('/search', searchSportsEvents);

// Manual trigger for sports data update (development only) - MUST be before /:id route
router.get('/trigger-update', async (req, res) => {
  try {
    console.log('🔄 Manual sports data update triggered from /api/sports-events/trigger-update');
    
    // Import the sports data service
    const { sportsDataService } = require('../../services/sportsData/sportsDataService');
    
    // Trigger the update
    await sportsDataService.runFullUpdate();
    
    res.json({
      success: true,
      message: 'Sports data update completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in manual sports data update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update sports data',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get a specific sports event by ID - MUST be last to avoid conflicts
router.get('/:id', getSportsEventById);

export default router; 
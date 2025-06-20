import { Router } from 'express';
import { 
  triggerSportsDataUpdate, 
  getLeaguesAdmin,
  updateGameStatuses
} from '../controllers/sportsDataAdmin';
import { authenticateUser } from '../middleware/auth';
import express from 'express';
import { sportsDataService } from '../../services/sportsData/sportsDataService';

const router = Router();

// Apply authentication middleware to all admin routes
router.use(authenticateUser);

// Trigger a sports data update
router.post('/update', triggerSportsDataUpdate);

// Get leagues (admin)
router.get('/leagues', getLeaguesAdmin);

// Update game statuses
router.post('/update-statuses', updateGameStatuses);

// Test endpoint to manually update sports data
router.get('/update-now', async (req, res) => {
  try {
    console.log('Manual sports data update triggered');
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

// Get update status
router.get('/status', async (req, res) => {
  try {
    // You can add logic here to check last update time, etc.
    res.json({
      success: true,
      status: 'Sports data service is available',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Service unavailable'
    });
  }
});

export default router; 
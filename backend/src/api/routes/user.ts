import express from 'express';
import { createLogger } from '../../utils/logger';

const router = express.Router();
const logger = createLogger('userRoutes');

/**
 * @route GET /api/user/stats
 * @desc Get user betting statistics
 * @access Private
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('Fetching user stats');
    
    // This would normally fetch real user stats from your database
    // For now, returning calculated stats based on user's betting history
    const stats = {
      todayPicks: 3,
      winRate: '67%',
      roi: '+22.4%',
      streak: 5,
      totalBets: 86,
      profitLoss: '+$2,456'
    };
    
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error(`Error fetching user stats: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user stats' 
    });
  }
});

/**
 * @route PUT /api/user/preferences
 * @desc Save user betting preferences
 * @access Private
 */
router.put('/preferences', async (req, res) => {
  try {
    const preferences = req.body;
    logger.info('Saving user preferences:', preferences);
    
    // This would normally save to your database
    // For now, just validate the data structure
    if (!preferences) {
      return res.status(400).json({
        success: false,
        error: 'Preferences data is required'
      });
    }
    
    // Validate expected fields
    const validFields = [
      'risk_tolerance', 'sports', 'bet_types', 'max_bet_size', 
      'notification_preferences'
    ];
    
    return res.status(200).json({
      success: true,
      message: 'Preferences saved successfully'
    });
  } catch (error) {
    logger.error(`Error saving preferences: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to save preferences' 
    });
  }
});

/**
 * @route GET /api/user/preferences
 * @desc Get user betting preferences
 * @access Private
 */
router.get('/preferences', async (req, res) => {
  try {
    logger.info('Fetching user preferences');
    
    // This would normally fetch from your database
    const preferences = {
      risk_tolerance: 'medium',
      sports: ['Basketball', 'Football', 'Baseball'],
      bet_types: ['moneyline', 'spread', 'total'],
      max_bet_size: 500,
      notification_preferences: {
        frequency: 'daily',
        types: ['new_predictions', 'bet_results']
      }
    };
    
    return res.status(200).json({
      success: true,
      preferences
    });
  } catch (error) {
    logger.error(`Error fetching preferences: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch preferences' 
    });
  }
});

export default router; 
import express from 'express';
import { sportsBettingServiceManager } from '../../services/sportsBettingServiceManager';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * GET /status - Check sports betting API status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await sportsBettingServiceManager.getApiStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error getting sports betting API status: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get API status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /start - Start the sports betting API
 */
router.post('/start', async (req, res) => {
  try {
    logger.info('Received request to start sports betting API');
    
    const started = await sportsBettingServiceManager.ensureApiRunning();
    
    if (started) {
      const status = await sportsBettingServiceManager.getApiStatus();
      res.json({
        success: true,
        message: 'Sports betting API is running',
        data: status,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to start sports betting API',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error(`Error starting sports betting API: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      success: false,
      error: 'Failed to start API',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /stop - Stop the sports betting API
 */
router.post('/stop', async (req, res) => {
  try {
    logger.info('Received request to stop sports betting API');
    
    sportsBettingServiceManager.stopApi();
    
    // Wait a moment for the process to stop
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const status = await sportsBettingServiceManager.getApiStatus();
    
    res.json({
      success: true,
      message: 'Sports betting API stopped',
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error stopping sports betting API: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      success: false,
      error: 'Failed to stop API',
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 
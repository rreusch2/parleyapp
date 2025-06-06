import express from 'express';
import { generateBettingRecommendation } from '../../ai/orchestrator/geminiOrchestrator';
import { createLogger } from '../../utils/logger';

const router = express.Router();
const logger = createLogger('aiRoutes');

/**
 * @route POST /api/ai/recommendations
 * @desc Generate a betting recommendation using the AI orchestrator
 * @access Private
 */
router.post('/recommendations', async (req, res) => {
  try {
    const {
      userId,
      gameId,
      fixtureId,
      betType,
      sport,
      playerId,
      statType,
      overUnderLine,
      marketName,
      odds
    } = req.body;
    
    // Validate required fields
    if (!userId || (!gameId && !fixtureId) || !betType || !sport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId, (gameId or fixtureId), betType, and sport are required' 
      });
    }
    
    // Validate betType
    const validBetTypes = [
      'moneyline', 'spread', 'total', 'player_prop', 
      'football_1x2', 'football_over_under'
    ];
    if (!validBetTypes.includes(betType)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid betType. Must be one of: ${validBetTypes.join(', ')}` 
      });
    }
    
    // Additional validation for player props
    if (betType === 'player_prop' && (!playerId || !statType || !overUnderLine)) {
      return res.status(400).json({ 
        success: false, 
        error: 'For player_prop bets, playerId, statType, and overUnderLine are required' 
      });
    }
    
    // Additional validation for football bets
    if ((betType === 'football_1x2' || betType === 'football_over_under') && !fixtureId) {
      return res.status(400).json({ 
        success: false, 
        error: 'For football bets, fixtureId is required' 
      });
    }
    
    // Additional validation for football over/under bets
    if (betType === 'football_over_under' && !overUnderLine) {
      return res.status(400).json({ 
        success: false, 
        error: 'For football_over_under bets, overUnderLine is required' 
      });
    }
    
    logger.info(`Generating recommendation for user ${userId}, sport ${sport}, bet type ${betType}`);
    
    // Generate recommendation
    const recommendation = await generateBettingRecommendation({
      userId,
      gameId,
      fixtureId,
      betType,
      sport,
      playerId,
      statType,
      overUnderLine,
      marketName,
      odds
    });
    
    logger.info(`Successfully generated recommendation for user ${userId}, sport ${sport}`);
    
    return res.status(200).json({
      success: true,
      data: recommendation
    });
  } catch (error) {
    logger.error(`Error generating recommendation: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to generate recommendation' 
    });
  }
});

/**
 * @route GET /api/ai/health
 * @desc Check if the AI orchestrator is healthy
 * @access Public
 */
router.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'AI orchestrator is healthy'
  });
});

export default router; 
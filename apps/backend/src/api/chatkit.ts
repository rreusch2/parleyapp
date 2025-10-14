import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { createLogger } from '../utils/logger';
import { 
  createPickCardWidget, 
  createParlayBuilderWidget, 
  createStatsComparisonWidget,
  createEliteLockWidget,
  createMultiplePicksWidget
} from './widgets';

const router = Router();
const logger = createLogger('chatkit');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Agent Builder Workflow ID
const WORKFLOW_ID = "wf_68edde0b32e08190b090de89bef1a0d302929051ff1c5a9a";

/**
 * Create ChatKit session for Professor Lock chat
 */
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { userId, userTier } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    logger.info(`Creating ChatKit session for user ${userId} (tier: ${userTier})`);

    // Create ChatKit session with your Agent Builder workflow
    const session = await openai.chatkit.sessions.create({
      workflow: { 
        id: WORKFLOW_ID
      },
      user: userId,
      // Pass user context for personalization
      metadata: {
        userTier: userTier || 'free',
        isElite: userTier === 'elite',
        isPro: userTier === 'pro' || userTier === 'elite',
        timestamp: new Date().toISOString()
      }
    });

    logger.info(`✅ ChatKit session created: ${session.id}`);

    res.json({ 
      client_secret: session.client_secret,
      session_id: session.id
    });

  } catch (error) {
    logger.error(`❌ Failed to create ChatKit session: ${error}`);
    res.status(500).json({ 
      error: 'Failed to create chat session',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Widget action handler endpoint
 * Handles widget button clicks from ChatKit
 */
router.post('/action', async (req: Request, res: Response) => {
  try {
    const { action, userId } = req.body;
    
    logger.info(`Widget action received: ${action.type} from user ${userId}`);
    
    switch (action.type) {
      case 'add_to_parlay':
        // Handle adding pick to parlay
        logger.info(`Adding pick ${action.payload.pickId} to parlay`);
        res.json({ 
          success: true, 
          message: 'Pick added to parlay!' 
        });
        break;
        
      case 'view_pick_details':
        // Handle viewing pick details
        logger.info(`Viewing details for pick ${action.payload.pickId}`);
        res.json({ 
          success: true,
          pickId: action.payload.pickId
        });
        break;
        
      case 'place_parlay':
        // Handle parlay placement
        logger.info(`Placing parlay with ${action.payload.picks.length} picks`);
        res.json({ 
          success: true,
          message: `Parlay placed! Potential win: $${action.payload.potentialPayout}`,
          parlayId: `parlay_${Date.now()}`
        });
        break;
        
      default:
        res.status(400).json({ error: 'Unknown action type' });
    }
  } catch (error) {
    logger.error(`❌ Widget action error: ${error}`);
    res.status(500).json({ 
      error: 'Action failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Generate widget examples for testing
 */
router.get('/widgets/example', async (req: Request, res: Response) => {
  const examplePick = {
    id: 'pick_123',
    match_teams: 'Lakers vs Warriors',
    pick: 'Lakers ML',
    odds: '+150',
    confidence: 78,
    sport: 'NBA',
    reasoning: 'Lakers have won 7 of last 10 matchups. LeBron averaging 28 PPG in last 5 games. Warriors missing Curry and Wiggins.',
    value_percentage: 12.5,
    roi_estimate: 15.3,
    league_logo_url: 'https://cdn.nba.com/logos/leagues/logo-nba.svg',
    risk_level: 'Medium' as const
  };

  const pickCardWidget = createPickCardWidget(examplePick);
  
  res.json({ 
    pickCard: pickCardWidget,
    usage: 'Return this widget from your Agent Builder workflow to display beautiful betting pick cards in ChatKit'
  });
});

export default router;


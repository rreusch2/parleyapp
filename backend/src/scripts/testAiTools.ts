import dotenv from 'dotenv';
import { sportsDataIOService } from '../ai/tools/sportsDataIO';
import { webSearchService } from '../ai/tools/webSearch';
import { userDataService } from '../ai/tools/userData';
import { sportmonksService } from '../ai/tools/sportmonks';
import { generateBettingRecommendation } from '../ai/orchestrator/geminiOrchestrator';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Test configuration
const TEST_USER_ID = 'test-user-123';
const TEST_GAME_ID = 'nba-2023-12345';
const TEST_SPORT = 'NBA';
const TEST_PLAYER_ID = 'player-123';
const TEST_FOOTBALL_FIXTURE_ID = '18243671'; // Example fixture ID for Sportmonks

async function runTests() {
  logger.info('Starting AI tools tests');
  
  try {
    // Test SportsDataIO service
    logger.info('Testing SportsDataIO service...');
    if (process.env.SPORTSDATAIO_API_KEY) {
      try {
        const gamePrediction = await sportsDataIOService.getGamePrediction(
          TEST_GAME_ID,
          'moneyline',
          TEST_SPORT
        );
        logger.info('SportsDataIO game prediction test result:', gamePrediction);
      } catch (error) {
        logger.error('SportsDataIO game prediction test failed:', error);
      }
    } else {
      logger.warn('Skipping SportsDataIO test - API key not configured');
    }
    
    // Test Sportmonks service
    logger.info('Testing Sportmonks service...');
    if (process.env.SPORTMONKS_API_KEY) {
      try {
        const footballPrediction = await sportmonksService.getFootballPrediction(
          TEST_FOOTBALL_FIXTURE_ID
        );
        logger.info('Sportmonks football prediction test result:', footballPrediction);
        
        const valueBets = await sportmonksService.getValueBets(
          TEST_FOOTBALL_FIXTURE_ID,
          0.05 // 5% value threshold
        );
        logger.info(`Sportmonks value bets test returned ${valueBets.length} value bets`);
      } catch (error) {
        logger.error('Sportmonks test failed:', error);
      }
    } else {
      logger.warn('Skipping Sportmonks test - API key not configured');
    }
    
    // Test Web Search service
    logger.info('Testing Web Search service...');
    try {
      const searchResults = await webSearchService.performSearch('NBA Lakers injury report');
      logger.info(`Web Search test returned ${searchResults.length} results`);
    } catch (error) {
      logger.error('Web Search test failed:', error);
    }
    
    // Test User Data service
    logger.info('Testing User Data service...');
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const userPreferences = await userDataService.getUserPreferences(TEST_USER_ID);
        logger.info('User preferences test result:', userPreferences);
        
        const bettingHistory = await userDataService.getUserBettingHistory(TEST_USER_ID);
        logger.info(`User betting history test returned ${bettingHistory.length} entries`);
      } catch (error) {
        logger.error('User Data test failed:', error);
      }
    } else {
      logger.warn('Skipping User Data test - Supabase not configured');
    }
    
    // Test Gemini Orchestrator
    logger.info('Testing Gemini Orchestrator...');
    if (process.env.GEMINI_API_KEY) {
      try {
        const recommendation = await generateBettingRecommendation({
          userId: TEST_USER_ID,
          gameId: TEST_GAME_ID,
          betType: 'moneyline',
          sport: TEST_SPORT,
          odds: {
            homeOdds: -110,
            awayOdds: +100
          }
        });
        logger.info('Gemini Orchestrator test result:', recommendation);
      } catch (error) {
        logger.error('Gemini Orchestrator test failed:', error);
      }
    } else {
      logger.warn('Skipping Gemini Orchestrator test - API key not configured');
    }
    
    logger.info('All tests completed');
  } catch (error) {
    logger.error('Test suite failed:', error);
  }
}

// Run the tests
runTests().catch(error => {
  logger.error('Fatal error in test suite:', error);
  process.exit(1);
}); 
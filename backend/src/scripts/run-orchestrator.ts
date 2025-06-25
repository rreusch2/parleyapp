#!/usr/bin/env ts-node
/**
 * Manual Orchestrator Runner
 * Run the enhanced DeepSeek orchestrator to generate daily picks
 * Usage: ts-node run-orchestrator.ts [--test] [--user-id=xxx]
 */

import dotenv from 'dotenv';
import path from 'path';
import { createLogger } from '../utils/logger';
import orchestrator from '../ai/orchestrator/enhancedDeepseekOrchestrator';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const logger = createLogger('run-orchestrator');

// Define BestPick interface to fix TypeScript errors
interface BestPick {
  id: string;
  game_id: string;
  user_id: string;
  match_teams: string;
  pick: string;
  odds: string;
  confidence: number;
  sport: string;
  event_time: string;
  reasoning: string;
  value_percentage: number;
  roi_estimate: number;
  bet_type: 'moneyline' | 'spread' | 'total';
  status: 'pending';
  metadata: any;
}

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const testMode = args.includes('--test');
    const userIdArg = args.find(arg => arg.startsWith('--user-id='));
    
    // Generate a consistent system user UUID (deterministic based on "system")
    const systemUserUUID = userIdArg ? userIdArg.split('=')[1] : '00000000-0000-0000-0000-000000000000';
    const userId = systemUserUUID;
    
    const maxPicks = args.find(arg => arg.startsWith('--max-picks='));
    const pickCount = maxPicks ? parseInt(maxPicks.split('=')[1]) : 10;

    logger.info('🚀 Starting Enhanced DeepSeek Orchestrator');
    logger.info(`📊 Configuration:`);
    logger.info(`   - Test Mode: ${testMode}`);
    logger.info(`   - User ID: ${userId}`);
    logger.info(`   - Max Picks: ${pickCount}`);
    logger.info(`   - ML Server: ${process.env.PYTHON_ML_SERVER_URL || 'http://localhost:8001'}`);

    // Verify ML server is running
    try {
      const axios = require('axios');
      const mlServerUrl = process.env.PYTHON_ML_SERVER_URL || 'http://localhost:8001';
      const healthResponse = await axios.get(`${mlServerUrl}/health`);
      logger.info(`✅ ML Server is healthy: ${healthResponse.data.models_loaded} models loaded`);
    } catch (error) {
      logger.warn(`⚠️ ML Server health check failed - orchestrator will use fallback predictions`);
    }

    // Generate picks using the orchestrator singleton (NOT instantiating with new)
    logger.info('🎯 Generating daily picks...');
    const picks: BestPick[] = await orchestrator.generateDailyPicks(userId, pickCount);
    
    logger.info(`✅ Generated ${picks.length} picks successfully!`);
    
    // Display picks in test mode
    if (testMode) {
      logger.info('\n📋 Generated Picks:');
      picks.forEach((pick: BestPick, index: number) => {
        logger.info(`\n${index + 1}. ${pick.match_teams}`);
        logger.info(`   Pick: ${pick.pick}`);
        logger.info(`   Odds: ${pick.odds}`);
        logger.info(`   Confidence: ${pick.confidence.toFixed(1)}%`);
        logger.info(`   Value: ${pick.value_percentage.toFixed(1)}%`);
        logger.info(`   Type: ${pick.bet_type}`);
        logger.info(`   Reasoning: ${pick.reasoning.substring(0, 100)}...`);
      });
      
      logger.info('\n⚠️ TEST MODE - Picks were NOT saved to database');
    } else {
      logger.info('✅ Picks have been saved to the database');
    }
    
  } catch (error) {
    logger.error(`❌ Orchestrator failed: ${error}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      logger.info('✅ Orchestrator completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`❌ Fatal error: ${error}`);
      process.exit(1);
    });
} 
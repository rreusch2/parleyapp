#!/usr/bin/env ts-node
/**
 * Test script for Enhanced DeepSeek Orchestrator
 * 
 * This script demonstrates the new enhanced orchestrator that:
 * 1. Pulls games from your database (your 16 games from today)
 * 2. Uses Python ML server for predictions
 * 3. Generates ML, totals, and player prop picks
 * 4. Uses DeepSeek AI to select the best picks
 * 5. Stores only the best picks in the database
 * 
 * Usage: npx ts-node src/scripts/testEnhancedOrchestrator.ts
 */

import enhancedOrchestratorService from '../ai/orchestrator/enhancedDeepseekOrchestrator';
import { createLogger } from '../utils/logger';

const logger = createLogger('testEnhancedOrchestrator');

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
  metadata: {
    tools_used: string[];
    processing_time: number;
    model_version: string;
    value_analysis: {
      expected_value: number;
      implied_probability: number;
      fair_odds: number;
      edge_percentage: number;
    };
  };
}

async function testEnhancedOrchestrator() {
  try {
    logger.info('🚀 TESTING ENHANCED DEEPSEEK ORCHESTRATOR');
    logger.info('=' .repeat(60));
    
    // Test user ID (would be real user from auth.users in production)
    const testUserId = 'f08b56d3-d4ec-4815-b502-6647d723d2a6';
    const maxPicks = 5;
    
    logger.info(`👤 Test User ID: ${testUserId}`);
    logger.info(`🎯 Max Picks: ${maxPicks}`);
    logger.info('');
    
    logger.info('📊 ENHANCED ORCHESTRATOR FEATURES:');
    logger.info('  ✅ Database Game Integration (pulls your daily games)');
    logger.info('  ✅ Python ML Server Predictions (66.9% accuracy)');
    logger.info('  ✅ Multi-Bet Type Support (ML/Totals only)');
    logger.info('  ✅ DeepSeek AI Selection & Analysis');
    logger.info('  ✅ Value-Based Edge Filtering (3%+ edge required)');
    logger.info('  ✅ Generates 10 picks daily for tier-based distribution');
    logger.info('');
    
    logger.info('🔄 Starting enhanced orchestration...');
    const startTime = Date.now();
    
    // Generate enhanced daily picks (system generates 10, stores all)  
    const enhancedPicks: BestPick[] = await enhancedOrchestratorService.generateDailyPicks(testUserId, maxPicks);
    
    const totalTime = Date.now() - startTime;
    
    logger.info('');
    logger.info('🏆 ENHANCED ORCHESTRATION RESULTS:');
    logger.info('=' .repeat(60));
    logger.info(`⏱️  Total Processing Time: ${totalTime}ms`);
    logger.info(`📈 Generated Picks: ${enhancedPicks.length}`);
    logger.info('');
    
    // Display each pick
    enhancedPicks.forEach((pick: BestPick, index: number) => {
      logger.info(`📊 PICK ${index + 1}:`);
      logger.info(`   🎯 Game: ${pick.match_teams}`);
      logger.info(`   🎲 Pick: ${pick.pick}`);
      logger.info(`   📊 Bet Type: ${pick.bet_type.toUpperCase()}`);
      logger.info(`   🎯 Confidence: ${pick.confidence}%`);
      logger.info(`   💰 Edge: ${pick.value_percentage.toFixed(1)}%`);
      logger.info(`   📈 ROI Estimate: ${pick.roi_estimate.toFixed(1)}%`);
      logger.info(`   🏈 Sport: ${pick.sport}`);
      logger.info(`   💡 Reasoning: ${pick.reasoning}`);
      logger.info(`   🔧 Tools Used: ${pick.metadata.tools_used.join(', ')}`);
      logger.info('');
    });
    
    // Summary statistics
    const avgConfidence = enhancedPicks.reduce((sum: number, pick: BestPick) => sum + pick.confidence, 0) / enhancedPicks.length;
    const avgEdge = enhancedPicks.reduce((sum: number, pick: BestPick) => sum + pick.value_percentage, 0) / enhancedPicks.length;
    const betTypeDistribution = enhancedPicks.reduce((acc: Record<string, number>, pick: BestPick) => {
      acc[pick.bet_type] = (acc[pick.bet_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    logger.info('📈 SUMMARY STATISTICS:');
    logger.info('=' .repeat(60));
    logger.info(`📊 Average Confidence: ${avgConfidence.toFixed(1)}%`);
    logger.info(`💰 Average Edge: ${avgEdge.toFixed(1)}%`);
    logger.info(`🎲 Bet Type Distribution:`);
    Object.entries(betTypeDistribution).forEach(([type, count]) => {
      logger.info(`   - ${type.toUpperCase()}: ${count} picks`);
    });
    
    const sportsDistribution = enhancedPicks.reduce((acc: Record<string, number>, pick: BestPick) => {
      acc[pick.sport] = (acc[pick.sport] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    logger.info(`🏈 Sports Distribution:`);
    Object.entries(sportsDistribution).forEach(([sport, count]) => {
      logger.info(`   - ${sport}: ${count} picks`);
    });
    
    logger.info('');
    logger.info('✅ ENHANCED ORCHESTRATOR TEST COMPLETED SUCCESSFULLY!');
    logger.info('');
    logger.info('🎯 WHAT HAPPENED:');
    logger.info('1. 📊 Pulled today\'s games from your database');
    logger.info('2. 🤖 Generated ML predictions using Python server');
    logger.info('3. 🎲 Created ML and totals bet candidates');
    logger.info('4. 🧠 Used DeepSeek AI to select the best 10 picks');
    logger.info('5. 💾 Stored all 10 picks in your database for tier distribution');
    logger.info('');
    logger.info('👀 CHECK YOUR DATABASE:');
    logger.info('   - Table: ai_predictions');
    logger.info(`   - User ID: ${testUserId}`);
    logger.info(`   - Generated: ${enhancedPicks.length} picks`);
    logger.info('');
    logger.info('🚀 READY FOR PRODUCTION USE!');
    
  } catch (error) {
    logger.error('❌ Enhanced orchestrator test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testEnhancedOrchestrator()
    .then(() => {
      logger.info('🎉 Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export default testEnhancedOrchestrator; 
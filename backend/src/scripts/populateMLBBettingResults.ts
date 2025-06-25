#!/usr/bin/env ts-node

import { MLBBettingResultsService } from '../services/mlbBettingResultsService';
import { createLogger } from '../utils/logger';

const logger = createLogger('PopulateMLBBettingResults');

async function main() {
  try {
    logger.info('🚀 Starting MLB betting results population...');
    
    const mlbService = new MLBBettingResultsService();
    
    // Get command line arguments
    const args = process.argv.slice(2);
    // Default values
    let limit = 100; // how many DB rows to process when using fallback lines
    // Calculate default days to ensure we cover Jan 1, 2024 ➜ today
    const today = new Date();
    const janFirst2024 = new Date('2024-01-01');
    let days = Math.ceil((today.getTime() - janFirst2024.getTime()) / (1000 * 60 * 60 * 24));
    let useRealAPI = false;

    // Simple arg parsing without extra dependencies
    args.forEach((arg, idx) => {
      if (/^\d+$/.test(arg)) {
        // If the arg is purely numeric and we haven't set limit explicitly yet,
        // treat it as the limit argument (backwards-compatible behaviour)
        if (limit === 100) {
          limit = parseInt(arg, 10);
        }
      } else if (arg === '--real') {
        useRealAPI = true;
      } else if (arg.startsWith('--days=')) {
        const value = arg.split('=')[1];
        if (value && /^\d+$/.test(value)) {
          days = parseInt(value, 10);
        }
      } else if (arg === '--days') {
        const next = args[idx + 1];
        if (next && /^\d+$/.test(next)) {
          days = parseInt(next, 10);
        }
      }
    });
    
    logger.info(`Processing limit: ${limit} records`);
    logger.info(`Use real API: ${useRealAPI}`);
    if (useRealAPI) {
      logger.info(`Fetching historical window: last ${days} days`);
    }
    
    if (useRealAPI) {
      // Use real Sports Game Odds API
      logger.info('📡 Using real Sports Game Odds API...');
      await mlbService.populateRealBettingResults(days);
    } else {
      // Use typical lines for existing data
      logger.info('📊 Using typical lines for existing data...');
      await mlbService.populateBettingResults(limit);
    }
    
    // Show trend analysis
    logger.info('📈 Generating trend analysis...');
    const trends = await mlbService.getTrendAnalysis(10);
    
    if (trends.length > 0) {
      logger.info('\n🔥 Top Trends Found:');
      trends.forEach((trend, index) => {
        logger.info(`${index + 1}. ${trend.playerName} (${trend.team}) - ${trend.propType.toUpperCase()}`);
        logger.info(`   📉 ${trend.streakLength} ${trend.streakType.toUpperCase()} in a row`);
        logger.info(`   🎯 ${trend.confidence}% confidence\n`);
      });
    } else {
      logger.info('No trends found yet. Run with more data.');
    }
    
    logger.info('✅ Script completed successfully!');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  main();
}

export { main }; 
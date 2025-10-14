#!/usr/bin/env node

import { injuryScrapingService } from '../services/injuryScrapingService';
import { logger } from '../utils/logger';

/**
 * Daily injury update script
 * Can be run via cron or manually
 */
async function runDailyInjuryUpdate() {
  try {
    console.log('🏥 Starting daily injury update...');
    logger.info('[DailyInjuryUpdate]: Starting daily injury update');
    
    await injuryScrapingService.runInjuryUpdate();
    
    console.log('✅ Daily injury update completed successfully');
    logger.info('[DailyInjuryUpdate]: Daily injury update completed successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Daily injury update failed:', error);
    logger.error('[DailyInjuryUpdate]: Daily injury update failed:', error);
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runDailyInjuryUpdate();
}

export { runDailyInjuryUpdate }; 
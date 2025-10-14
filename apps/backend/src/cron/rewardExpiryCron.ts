import cron from 'node-cron';
import { checkRewardExpiry } from '../jobs/rewardExpiry';
import { createLogger } from '../utils/logger';

const logger = createLogger('rewardExpiryCron');

/**
 * Initialize reward expiry cron job
 * Runs every hour to check for expired temporary upgrades
 */
export function initRewardExpiryCron() {
  // Run every hour at minute 0 (0 * * * *)
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('🔄 Starting scheduled reward expiry check...');
      const result = await checkRewardExpiry();
      
      if (result.success) {
        logger.info(`✅ Reward expiry job completed successfully. Processed: ${result.processed} users`);
      } else {
        logger.error(`❌ Reward expiry job failed: ${result.error}`);
      }
    } catch (error) {
      logger.error('💥 Reward expiry cron job crashed:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/New_York" // EST timezone
  });

  logger.info('⏰ Reward expiry cron job initialized - runs every hour');
}

import cron from 'node-cron';
import { logger } from '../utils/logger';

export function initRevenueCatCron() {
  logger.info('⏱️ Initializing RevenueCat webhook processor cron');

  const task = cron.schedule('* * * * *', async () => {
    try {
      const { processRevenueCatWebhooks } = await import('../jobs/processRevenueCatWebhooks');
      const { processed, failed } = await processRevenueCatWebhooks(200);
      if (processed || failed) {
        logger.info(`🧾 RevenueCat cron run → processed=${processed}, failed=${failed}`);
      }
    } catch (e: any) {
      logger.error('❌ RevenueCat cron processing error', e);
    }
  }, { scheduled: true, timezone: 'America/New_York' });

  task.start();
}

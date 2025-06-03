import cron from 'node-cron';
import { sportsDataService } from './sportsDataService';

// Schedule configurations
const SCHEDULES = {
  // Run full update of upcoming games daily at 1:00 AM
  DAILY_UPDATE: '0 1 * * *',
  
  // Update game statuses every 15 minutes
  STATUS_UPDATE: '*/15 * * * *',
  
  // Run full update when server starts
  RUN_ON_START: true
};

/**
 * Initialize and start all scheduled jobs
 */
export const initScheduler = () => {
  console.log('Initializing sports data scheduler...');
  
  // Schedule daily full update of upcoming games
  cron.schedule(SCHEDULES.DAILY_UPDATE, async () => {
    console.log('Running scheduled daily update of sports data');
    try {
      await sportsDataService.runFullUpdate();
      console.log('Scheduled daily update completed successfully');
    } catch (error) {
      console.error('Error in scheduled daily update:', error);
    }
  });
  
  // Schedule frequent updates of game statuses
  cron.schedule(SCHEDULES.STATUS_UPDATE, async () => {
    console.log('Running scheduled status update');
    try {
      await sportsDataService.updateGameStatuses();
      console.log('Scheduled status update completed successfully');
    } catch (error) {
      console.error('Error in scheduled status update:', error);
    }
  });
  
  // Run initial update when server starts if configured
  if (SCHEDULES.RUN_ON_START) {
    console.log('Running initial sports data update on server start');
    setTimeout(async () => {
      try {
        await sportsDataService.runFullUpdate();
        console.log('Initial sports data update completed successfully');
      } catch (error) {
        console.error('Error in initial sports data update:', error);
      }
    }, 5000); // Wait 5 seconds before starting the initial update
  }
  
  console.log('Sports data scheduler initialized successfully');
};

export default { initScheduler }; 
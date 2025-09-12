import cron from 'node-cron';
import { runDayPassExpirationCheck } from '../scripts/checkDayPassExpirations';

/**
 * Day Pass Expiration Scheduler
 * Runs every hour to check for expired Pro Day Pass subscriptions
 * and automatically revert users to Free tier
 */
export class DayPassScheduler {
  private static instance: DayPassScheduler;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  private constructor() {}

  public static getInstance(): DayPassScheduler {
    if (!DayPassScheduler.instance) {
      DayPassScheduler.instance = new DayPassScheduler();
    }
    return DayPassScheduler.instance;
  }

  /**
   * Start the day pass expiration scheduler
   * Runs every hour at the top of the hour
   */
  public start(): void {
    if (this.isRunning) {
      console.log('⚠️ Day Pass scheduler is already running');
      return;
    }

    console.log('🚀 Starting Day Pass expiration scheduler...');
    
    // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
    this.cronJob = cron.schedule('0 * * * *', async () => {
      console.log('⏰ Day Pass expiration check triggered by scheduler');
      try {
        await runDayPassExpirationCheck();
      } catch (error) {
        console.error('❌ Scheduled day pass expiration check failed:', error);
      }
    }, {
      scheduled: false, // Don't start automatically
      timezone: 'America/New_York' // Adjust to your app's timezone
    });

    this.cronJob.start();
    this.isRunning = true;
    
    console.log('✅ Day Pass expiration scheduler started (runs hourly)');
    console.log('📅 Next run: top of the next hour');

    // Run an initial check when the scheduler starts
    this.runInitialCheck();
  }

  /**
   * Stop the day pass expiration scheduler
   */
  public stop(): void {
    if (!this.isRunning || !this.cronJob) {
      console.log('⚠️ Day Pass scheduler is not currently running');
      return;
    }

    console.log('🛑 Stopping Day Pass expiration scheduler...');
    this.cronJob.stop();
    this.cronJob = null;
    this.isRunning = false;
    console.log('✅ Day Pass expiration scheduler stopped');
  }

  /**
   * Check if the scheduler is currently running
   */
  public getStatus(): { isRunning: boolean; nextExecution?: Date } {
    const status = { 
      isRunning: this.isRunning,
      nextExecution: undefined as Date | undefined
    };

    if (this.isRunning && this.cronJob) {
      // Calculate next execution (top of next hour)
      const now = new Date();
      const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
      status.nextExecution = nextHour;
    }

    return status;
  }

  /**
   * Run the expiration check manually (for testing or immediate execution)
   */
  public async runManually(): Promise<void> {
    console.log('🔧 Running Day Pass expiration check manually...');
    try {
      await runDayPassExpirationCheck();
      console.log('✅ Manual Day Pass expiration check completed');
    } catch (error) {
      console.error('❌ Manual Day Pass expiration check failed:', error);
      throw error;
    }
  }

  /**
   * Run an initial check when the scheduler starts (don't wait for first cron)
   */
  private async runInitialCheck(): Promise<void> {
    console.log('🔄 Running initial Day Pass expiration check...');
    try {
      await runDayPassExpirationCheck();
    } catch (error) {
      console.error('❌ Initial Day Pass expiration check failed:', error);
    }
  }
}

// Export singleton instance
export const dayPassScheduler = DayPassScheduler.getInstance();

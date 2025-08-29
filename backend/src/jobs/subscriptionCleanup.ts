import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Background job to automatically downgrade expired subscriptions
 * Runs every hour to check for expired day passes and other subscriptions
 */
export class SubscriptionCleanupJob {
  private isRunning = false;

  constructor() {
    // Schedule cleanup job to run every hour
    cron.schedule('0 * * * *', () => {
      this.runCleanup();
    });
    
    console.log('📅 Subscription cleanup job scheduled (every hour)');
  }

  async runCleanup() {
    if (this.isRunning) {
      console.log('⏳ Subscription cleanup already running, skipping...');
      return;
    }

    this.isRunning = true;
    
    try {
      console.log('🧹 Starting subscription cleanup job...');
      
      // Find all expired subscriptions
      const { data: expiredUsers, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('id, subscription_tier, subscription_plan_type, subscription_expires_at, subscription_product_id')
        .eq('subscription_tier', 'pro')
        .not('subscription_expires_at', 'is', null)
        .lt('subscription_expires_at', new Date().toISOString());

      if (fetchError) {
        console.error('❌ Failed to fetch expired subscriptions:', fetchError);
        return;
      }

      if (!expiredUsers || expiredUsers.length === 0) {
        console.log('✅ No expired subscriptions found');
        return;
      }

      console.log(`🎯 Found ${expiredUsers.length} expired subscriptions to downgrade`);

      // Group by subscription type for logging
      const dayPasses = expiredUsers.filter(u => 
        u.subscription_plan_type === 'daypass' || 
        u.subscription_product_id === 'com.parleyapp.prodaypass'
      );
      const otherSubscriptions = expiredUsers.filter(u => 
        u.subscription_plan_type !== 'daypass' && 
        u.subscription_product_id !== 'com.parleyapp.prodaypass'
      );

      console.log(`📊 Breakdown: ${dayPasses.length} day passes, ${otherSubscriptions.length} other subscriptions`);

      // Downgrade all expired users to free
      const userIds = expiredUsers.map(u => u.id);
      const { error: updateError, count } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_status: 'expired',
          updated_at: new Date().toISOString()
        })
        .in('id', userIds);

      if (updateError) {
        console.error('❌ Failed to downgrade expired users:', updateError);
        return;
      }

      console.log(`✅ Successfully downgraded ${count} users from pro to free`);
      
      // Log details for day passes (more frequent, need monitoring)
      if (dayPasses.length > 0) {
        console.log('📅 Day pass expirations:');
        dayPasses.forEach(user => {
          console.log(`  - User ${user.id}: expired at ${user.subscription_expires_at}`);
        });
      }

    } catch (error) {
      console.error('❌ Subscription cleanup job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual cleanup trigger for testing or immediate needs
   */
  async runManualCleanup() {
    console.log('🚀 Running manual subscription cleanup...');
    await this.runCleanup();
  }
}

// Singleton instance
export const subscriptionCleanupJob = new SubscriptionCleanupJob();

import { supabaseAdmin } from '../services/supabase/client';

/**
 * Subscription Status Checker Service
 * Automatically handles expired subscriptions and status updates
 */
class SubscriptionCheckerService {
  private checkInterval: NodeJS.Timeout | null = null;

  /**
   * Start periodic subscription checks
   */
  start(): void {
    console.log('🔄 Starting subscription checker service...');
    
    // Run immediately
    this.checkExpiredSubscriptions();
    
    // Then run every hour
    this.checkInterval = setInterval(() => {
      this.checkExpiredSubscriptions();
    }, 60 * 60 * 1000); // 1 hour
    
    console.log('✅ Subscription checker started - runs every hour');
  }

  /**
   * Stop periodic checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏹️ Subscription checker stopped');
    }
  }

  /**
   * Check for expired subscriptions and downgrade users
   */
  async checkExpiredSubscriptions(): Promise<void> {
    try {
      console.log('🔍 Checking for expired subscriptions...');
      
      const now = new Date().toISOString();
      
      // Find all users with expired subscriptions that are still marked as active
      const { data: expiredUsers, error: selectError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, subscription_tier, subscription_expires_at')
        .eq('subscription_status', 'active')
        .not('subscription_tier', 'eq', 'free')
        .not('subscription_tier', 'eq', 'pro_lifetime') // Lifetime never expires
        .lt('subscription_expires_at', now);

      if (selectError) {
        console.error('❌ Error finding expired subscriptions:', selectError);
        return;
      }

      if (!expiredUsers || expiredUsers.length === 0) {
        console.log('✅ No expired subscriptions found');
        return;
      }

      console.log(`⚠️ Found ${expiredUsers.length} expired subscriptions`);

      // Update all expired users to free tier
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_status: 'expired',
          subscription_expires_at: null,
          updated_at: now
        })
        .in('id', expiredUsers.map(u => u.id));

      if (updateError) {
        console.error('❌ Error updating expired subscriptions:', updateError);
        return;
      }

      console.log('✅ Successfully downgraded expired users:', 
        expiredUsers.map(u => ({ 
          email: u.email, 
          tier: u.subscription_tier,
          expiredAt: u.subscription_expires_at 
        }))
      );

      // Log the update for monitoring
      await this.logSubscriptionUpdates(expiredUsers.length, 'expired');
      
    } catch (error) {
      console.error('❌ Subscription check failed:', error);
    }
  }

  /**
   * Check specific user's subscription status
   */
  async checkUserSubscription(userId: string): Promise<{
    isActive: boolean;
    isPro: boolean;
    tier: string;
    status: string;
    expiresAt: string | null;
    daysRemaining: number | null;
  }> {
    try {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('subscription_tier, subscription_status, subscription_expires_at')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        return {
          isActive: false,
          isPro: false,
          tier: 'free',
          status: 'inactive',
          expiresAt: null,
          daysRemaining: null
        };
      }

      const tier = profile.subscription_tier || 'free';
      const status = profile.subscription_status || 'inactive';
      const expiresAt = profile.subscription_expires_at;
      
      const isLifetime = tier === 'pro_lifetime';
      const now = new Date();
      const expiry = expiresAt ? new Date(expiresAt) : null;
      
      let isActive = false;
      let isPro = false;
      let daysRemaining: number | null = null;

      if (isLifetime) {
        isActive = status === 'active';
        isPro = true;
      } else if (tier.startsWith('pro_') && expiry) {
        isActive = status === 'active' && expiry > now;
        isPro = isActive;
        daysRemaining = isActive ? 
          Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      }

      return {
        isActive,
        isPro,
        tier,
        status,
        expiresAt,
        daysRemaining
      };
      
    } catch (error) {
      console.error('❌ Error checking user subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptionStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    cancelled: number;
    lifetime: number;
    monthly: number;
    yearly: number;
  }> {
    try {
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('subscription_tier, subscription_status');

      if (error || !profiles) {
        throw error;
      }

      const stats = {
        total: profiles.length,
        active: 0,
        expired: 0,
        cancelled: 0,
        lifetime: 0,
        monthly: 0,
        yearly: 0
      };

      profiles.forEach(profile => {
        const tier = profile.subscription_tier || 'free';
        const status = profile.subscription_status || 'inactive';

        if (status === 'active') stats.active++;
        if (status === 'expired') stats.expired++;
        if (status === 'cancelled') stats.cancelled++;
        
        if (tier === 'pro_lifetime') stats.lifetime++;
        if (tier === 'pro_monthly') stats.monthly++;
        if (tier === 'pro_yearly') stats.yearly++;
      });

      return stats;
      
    } catch (error) {
      console.error('❌ Error getting subscription stats:', error);
      throw error;
    }
  }

  /**
   * Log subscription updates for monitoring
   */
  private async logSubscriptionUpdates(count: number, type: string): Promise<void> {
    try {
      console.log(`📊 Subscription update: ${count} users ${type}`);
      // In production, you might want to log this to a monitoring service
      // or send alerts if many subscriptions expire at once
    } catch (error) {
      console.error('❌ Error logging subscription update:', error);
    }
  }
}

// Export singleton instance
export const subscriptionChecker = new SubscriptionCheckerService();
export default subscriptionChecker;

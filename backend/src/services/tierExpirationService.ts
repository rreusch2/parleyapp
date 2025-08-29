import { supabaseAdmin } from './supabaseClient';
import cron from 'node-cron';

export class TierExpirationService {
  private static instance: TierExpirationService;
  private cronJob: cron.ScheduledTask | null = null;

  private constructor() {}

  public static getInstance(): TierExpirationService {
    if (!TierExpirationService.instance) {
      TierExpirationService.instance = new TierExpirationService();
    }
    return TierExpirationService.instance;
  }

  public startExpirationScheduler(): void {
    // Run every hour to check for expired temporary tiers
    this.cronJob = cron.schedule('0 * * * *', async () => {
      console.log('🔄 Running tier expiration check...');
      await this.processExpiredTiers();
    });

    // Also run every 6 hours to send expiration warnings
    cron.schedule('0 */6 * * *', async () => {
      console.log('⚠️ Checking for expiring rewards...');
      await this.sendExpirationWarnings();
    });

    console.log('✅ Tier expiration scheduler started');
  }

  public stopExpirationScheduler(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('⏹️ Tier expiration scheduler stopped');
    }
  }

  public async processExpiredTiers(): Promise<{
    expiredUsers: number;
    expiredClaims: number;
  }> {
    try {
      // Call the database function to handle expired tiers
      const { error } = await supabaseAdmin.rpc('handle_expired_temporary_tiers');
      
      if (error) {
        console.error('❌ Error processing expired tiers:', error);
        throw error;
      }

      // Get count of users that were affected
      const { data: expiredUsers, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('temporary_tier_active', false)
        .not('temporary_tier_expires_at', 'is', null);

      const { data: expiredClaims, error: claimsError } = await supabaseAdmin
        .from('user_reward_claims')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', false)
        .not('expires_at', 'is', null);

      const result = {
        expiredUsers: expiredUsers?.length || 0,
        expiredClaims: expiredClaims?.length || 0
      };

      if (result.expiredUsers > 0 || result.expiredClaims > 0) {
        console.log(`✅ Processed ${result.expiredUsers} expired user tiers and ${result.expiredClaims} expired claims`);
      }

      return result;

    } catch (error) {
      console.error('❌ Failed to process expired tiers:', error);
      throw error;
    }
  }

  public async sendExpirationWarnings(): Promise<void> {
    try {
      // Get rewards expiring in the next 24 hours
      const { data: expiringRewards, error } = await supabaseAdmin
        .rpc('get_expiring_rewards', { hours_ahead: 24 });

      if (error) throw error;

      if (expiringRewards && expiringRewards.length > 0) {
        console.log(`⚠️ Found ${expiringRewards.length} rewards expiring in next 24 hours`);
        
        // Here you would integrate with your push notification service
        // For now, we'll just log the expiring rewards
        for (const reward of expiringRewards) {
          console.log(`⏰ User ${reward.user_id}: ${reward.reward_name} expires in ${reward.hours_remaining} hours`);
          
          // TODO: Send push notification to user
          // await this.sendExpirationNotification(reward);
        }
      }

    } catch (error) {
      console.error('❌ Failed to send expiration warnings:', error);
    }
  }

  public async getUserRewardStatus(userId: string): Promise<{
    hasActiveRewards: boolean;
    activeRewards: any[];
    effectiveTier: string;
  }> {
    try {
      // Get user's profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select(`
          subscription_tier,
          base_subscription_tier,
          temporary_tier_active,
          temporary_tier,
          temporary_tier_expires_at
        `)
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Get active reward claims
      const { data: activeRewards, error: claimsError } = await supabaseAdmin
        .from('user_reward_claims')
        .select(`
          *,
          referral_rewards (
            reward_name,
            reward_description,
            upgrade_tier,
            duration_hours
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      if (claimsError) throw claimsError;

      // Calculate effective tier
      let effectiveTier = profile.subscription_tier || 'free';
      
      if (profile.temporary_tier_active && profile.temporary_tier_expires_at) {
        const expiresAt = new Date(profile.temporary_tier_expires_at);
        if (expiresAt > new Date()) {
          effectiveTier = profile.temporary_tier;
        }
      }

      return {
        hasActiveRewards: (activeRewards?.length || 0) > 0,
        activeRewards: activeRewards || [],
        effectiveTier
      };

    } catch (error) {
      console.error('❌ Error getting user reward status:', error);
      throw error;
    }
  }

  // Manual cleanup function for testing
  public async forceExpireReward(userId: string, claimId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('user_reward_claims')
        .update({
          is_active: false,
          expires_at: new Date().toISOString(),
          metadata: {
            manually_expired: true,
            expired_at: new Date().toISOString()
          }
        })
        .eq('id', claimId)
        .eq('user_id', userId);

      if (error) throw error;

      // Process the expiration
      await this.processExpiredTiers();
      
      console.log(`✅ Manually expired reward claim ${claimId} for user ${userId}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to manually expire reward:', error);
      return false;
    }
  }
}

// Initialize and export the singleton instance
export const tierExpirationService = TierExpirationService.getInstance();

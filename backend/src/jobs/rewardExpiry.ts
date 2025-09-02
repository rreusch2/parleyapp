import { createLogger } from '../utils/logger';
import { supabaseAdmin } from '../services/supabase/client';

const logger = createLogger('rewardExpiry');

/**
 * Automated job to check and expire temporary reward upgrades
 * Should be run every hour via cron
 */
export async function checkRewardExpiry() {
  try {
    logger.info('🕒 Starting reward expiry check...');
    const now = new Date().toISOString();

    // Find users with expired referral upgrades
    const { data: expiredUsers, error } = await supabaseAdmin
      .from('profiles')
      .select('id, base_subscription_tier, referral_upgrade_expires_at, subscription_tier')
      .lt('referral_upgrade_expires_at', now)
      .not('referral_upgrade_expires_at', 'is', null);

    if (error) {
      logger.error('Error finding expired users:', error);
      return { success: false, error: error.message };
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      logger.info('✅ No expired rewards found');
      return { success: true, processed: 0 };
    }

    logger.info(`⏰ Found ${expiredUsers.length} expired reward upgrades to process`);

    // Process each expired user
    for (const user of expiredUsers) {
      try {
        // Revert user back to their base subscription tier
        const baseTier = user.base_subscription_tier || 'free';
        
        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_tier: baseTier,
            referral_upgrade_expires_at: null
          })
          .eq('id', user.id);

        // Mark reward claims as inactive
        await supabaseAdmin
          .from('user_reward_claims')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .lt('expires_at', now);

        logger.info(`✅ Reverted user ${user.id} from ${user.subscription_tier} to ${baseTier}`);
      } catch (userError) {
        logger.error(`❌ Failed to process user ${user.id}:`, userError);
      }
    }

    logger.info(`🎉 Successfully processed ${expiredUsers.length} expired rewards`);
    return { success: true, processed: expiredUsers.length };

  } catch (error: any) {
    logger.error('❌ Reward expiry job failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Award referral bonus when user subscribes
 */
export async function awardReferralBonus(userId: string) {
  try {
    logger.info(`💰 Checking referral bonus for user: ${userId}`);

    // Get user's referrer and subscription tier
    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('referred_by, subscription_tier')
      .eq('id', userId)
      .single();

    if (error || !user?.referred_by) {
      logger.info(`ℹ️ No referrer found for user ${userId}`);
      return { success: true, message: 'No referrer to reward' };
    }

    // Award subscription bonus based on tier
    let subscriptionBonus = 100; // Default Pro bonus
    if (user.subscription_tier === 'elite') {
      subscriptionBonus = 200; // Elite bonus
    }

    logger.info(`💎 Awarding ${subscriptionBonus} points for ${user.subscription_tier} subscription`);

    const { data: referrer } = await supabaseAdmin
      .from('profiles')
      .select('referral_points_pending, referral_points, referral_points_lifetime')
      .eq('id', user.referred_by)
      .single();

    if (referrer) {
      await supabaseAdmin
        .from('profiles')
        .update({
          referral_points: (referrer.referral_points || 0) + subscriptionBonus,
          referral_points_pending: Math.max(0, (referrer.referral_points_pending || 0) - 25), // Convert pending signup bonus to active
          referral_points_lifetime: (referrer.referral_points_lifetime || 0) + subscriptionBonus
        })
        .eq('id', user.referred_by);

      logger.info(`🎊 Awarded ${subscriptionBonus} points to referrer ${user.referred_by} for user ${userId} subscription`);
    }

    return { 
      success: true, 
      message: `${subscriptionBonus} points awarded to referrer`,
      referrer_id: user.referred_by,
      points_awarded: subscriptionBonus
    };
  } catch (error: any) {
    logger.error('❌ Failed to award referral bonus:', error);
    return { success: false, error: error.message };
  }
}

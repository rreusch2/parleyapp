import cron from 'node-cron';
import { supabaseAdmin } from '../services/supabaseClient';
import { logger } from '../utils/logger';

/**
 * Subscription Tier Fix Cron Job
 * Runs every 10 minutes to fix users whose subscription_tier was incorrectly set to 'free'
 * despite having active RevenueCat entitlements
 */

async function fixSubscriptionTiers() {
  try {
    logger.info('🔧 Running subscription tier fix check...');
    
    // Get all users with free/null tier but active entitlements
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, subscription_tier, revenuecat_entitlements, subscription_product_id')
      .or('subscription_tier.eq.free,subscription_tier.is.null')
      .not('revenuecat_entitlements', 'is', null);
    
    if (error) {
      logger.error('❌ Error fetching users for tier fix:', error);
      return;
    }
    
    if (!users || users.length === 0) {
      logger.info('✅ No users need tier fixing');
      return;
    }
    
    logger.info(`📊 Checking ${users.length} users with free/null tier...`);
    
    let fixedCount = 0;
    
    for (const user of users) {
      const entitlements = user.revenuecat_entitlements as any;
      
      if (!entitlements) continue;
      
      let correctTier: 'pro' | 'elite' | null = null;
      
      // Determine correct tier from entitlements
      if (entitlements.elite === true) {
        correctTier = 'elite';
      } else if (entitlements.predictiveplaypro === true) {
        correctTier = 'pro';
      }
      
      // If we found a correct tier and it's different from current
      if (correctTier && correctTier !== user.subscription_tier) {
        logger.info(`🔄 Fixing user ${user.username} (${user.id}): ${user.subscription_tier} → ${correctTier}`);
        
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_tier: correctTier,
            max_daily_picks: correctTier === 'elite' ? 30 : 20,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (updateError) {
          logger.error(`❌ Failed to update user ${user.id}:`, updateError);
        } else {
          logger.info(`✅ Fixed user ${user.username}: now ${correctTier}`);
          fixedCount++;
        }
      }
    }
    
    if (fixedCount > 0) {
      logger.info(`🎉 Fixed ${fixedCount} users with incorrect subscription tiers`);
    } else {
      logger.info('✅ All users have correct subscription tiers');
    }
    
  } catch (error) {
    logger.error('❌ Subscription tier fix cron failed:', error);
  }
}

/**
 * Start the subscription tier fix cron job
 * Runs every 10 minutes
 */
export function startSubscriptionTierFixCron() {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    await fixSubscriptionTiers();
  });
  
  logger.info('🔄 Subscription tier fix cron job started (runs every 10 minutes)');
  
  // Run once immediately on startup to catch any existing issues
  setTimeout(() => {
    fixSubscriptionTiers();
  }, 5000); // Wait 5 seconds after startup
}

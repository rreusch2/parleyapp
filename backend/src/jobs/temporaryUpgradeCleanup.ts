import cron from 'node-cron';
import { supabaseAdmin } from '../services/supabaseClient';

/**
 * Background job to automatically downgrade users when their temporary upgrades expire
 * Runs every 5 minutes to check for expired temporary upgrades
 */
export function startTemporaryUpgradeCleanup() {
  console.log('🕐 Starting temporary upgrade cleanup job...');
  
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('🔍 Checking for expired temporary upgrades...');
      
      // Find users with expired temporary upgrades
      const { data: expiredUsers, error: selectError } = await supabaseAdmin
        .from('profiles')
        .select('id, username, subscription_tier, temporary_upgrade_expires_at')
        .not('temporary_upgrade_expires_at', 'is', null)
        .lt('temporary_upgrade_expires_at', new Date().toISOString());
      
      if (selectError) {
        console.error('❌ Error finding expired upgrades:', selectError);
        return;
      }
      
      if (!expiredUsers || expiredUsers.length === 0) {
        console.log('✅ No expired temporary upgrades found');
        return;
      }
      
      console.log(`📉 Found ${expiredUsers.length} expired temporary upgrades`);
      
      // Downgrade all expired users back to free
      for (const user of expiredUsers) {
        console.log(`📉 Downgrading user ${user.username} (${user.id}) from ${user.subscription_tier} to free`);
        
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_tier: 'free',
            temporary_upgrade_expires_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (updateError) {
          console.error(`❌ Failed to downgrade user ${user.id}:`, updateError);
        } else {
          console.log(`✅ Successfully downgraded user ${user.username} to free tier`);
        }
      }
      
      // Mark expired reward claims as inactive
      const { error: claimsError } = await supabaseAdmin
        .from('user_reward_claims')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('is_active', true)
        .lt('expires_at', new Date().toISOString());
      
      if (claimsError) {
        console.error('❌ Error updating expired reward claims:', claimsError);
      } else {
        console.log('✅ Updated expired reward claims to inactive');
      }
      
    } catch (error) {
      console.error('❌ Temporary upgrade cleanup job failed:', error);
    }
  });
  
  console.log('✅ Temporary upgrade cleanup job started (runs every 5 minutes)');
}

/**
 * Manual function to run cleanup immediately (for testing)
 */
export async function runTemporaryUpgradeCleanupNow() {
  console.log('🔧 Running temporary upgrade cleanup manually...');
  
  try {
    const { data: expiredUsers, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, subscription_tier, temporary_upgrade_expires_at')
      .not('temporary_upgrade_expires_at', 'is', null)
      .lt('temporary_upgrade_expires_at', new Date().toISOString());
    
    if (error) throw error;
    
    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('✅ No expired temporary upgrades to clean up');
      return;
    }
    
    for (const user of expiredUsers) {
      await supabaseAdmin
        .from('profiles')
        .update({
          subscription_tier: 'free',
          temporary_upgrade_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      console.log(`✅ Downgraded ${user.username} from ${user.subscription_tier} to free`);
    }
    
    console.log(`✅ Cleanup completed: ${expiredUsers.length} users downgraded`);
    
  } catch (error) {
    console.error('❌ Manual cleanup failed:', error);
  }
}

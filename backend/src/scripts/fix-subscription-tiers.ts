import { supabaseAdmin } from '../services/supabaseClient';

/**
 * Fix subscription tiers for users based on their revenuecat_entitlements
 * This corrects cases where the app overwrote the correct tier set by webhooks
 */
async function fixSubscriptionTiers() {
  console.log('🔧 Starting subscription tier fix...');
  
  try {
    // Get specific users that need fixing
    const targetUserIds = [
      '32fb79d5-92eb-4701-84f7-3acc16d54f09',
      'aa45cac0-716f-4f21-b019-bef1fa71821d'
    ];
    
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, subscription_tier, revenuecat_entitlements, subscription_product_id')
      .in('id', targetUserIds);
    
    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }
    
    console.log(`📊 Found ${users?.length || 0} target users`);
    
    let fixedCount = 0;
    
    for (const user of users || []) {
      console.log(`\n👤 User: ${user.username} (${user.id})`);
      console.log(`   Current tier: ${user.subscription_tier}`);
      console.log(`   Entitlements:`, user.revenuecat_entitlements);
      console.log(`   Product ID: ${user.subscription_product_id}`);
      
      const entitlements = user.revenuecat_entitlements as any;
      
      if (!entitlements) {
        console.log('   ⚠️ No entitlements found');
        continue;
      }
      
      let correctTier: 'pro' | 'elite' | null = null;
      
      // Determine correct tier from entitlements
      if (entitlements.elite === true) {
        correctTier = 'elite';
      } else if (entitlements.predictiveplaypro === true) {
        correctTier = 'pro';
      }
      
      console.log(`   Correct tier should be: ${correctTier}`);
      
      // If we found a correct tier and it's different from current
      if (correctTier && correctTier !== user.subscription_tier) {
        console.log(`   🔄 Fixing: ${user.subscription_tier} → ${correctTier}`);
        
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_tier: correctTier,
            max_daily_picks: correctTier === 'elite' ? 30 : 20,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (updateError) {
          console.error(`   ❌ Failed to update:`, updateError);
        } else {
          console.log(`   ✅ Fixed! Now ${correctTier}`);
          fixedCount++;
        }
      } else {
        console.log(`   ℹ️ No fix needed (already correct or no valid tier)`);
      }
    }
    
    console.log(`\n🎉 Fixed ${fixedCount} users!`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

// Run the script
fixSubscriptionTiers()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

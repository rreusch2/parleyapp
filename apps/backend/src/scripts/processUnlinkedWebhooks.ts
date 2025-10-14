import { supabaseAdmin } from '../services/supabaseClient';

async function processUnlinkedWebhooks() {
  console.log('🔄 Processing unlinked RevenueCat webhooks...');

  // Get all INITIAL_PURCHASE webhooks that don't have a user_id
  const { data: webhooks, error } = await supabaseAdmin
    .from('revenuecat_webhook_events')
    .select('*')
    .eq('event_type', 'INITIAL_PURCHASE')
    .is('user_id', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('❌ Error fetching webhooks:', error);
    return;
  }

  if (!webhooks || webhooks.length === 0) {
    console.log('✅ No unlinked webhooks found');
    return;
  }

  console.log(`📊 Found ${webhooks.length} unlinked INITIAL_PURCHASE webhooks`);

  for (const webhook of webhooks) {
    const eventData = webhook.event_data as any;
    const aliases = eventData.aliases || [];
    const entitlementIds = eventData.entitlement_ids || [];
    
    console.log(`\n📥 Processing webhook ${webhook.id}`);
    console.log(`   Aliases: ${aliases.join(', ')}`);
    console.log(`   Entitlements: ${entitlementIds.join(', ')}`);

    // Determine tier from entitlements
    let tier: 'pro' | 'elite' | null = null;
    if (entitlementIds.includes('elite')) {
      tier = 'elite';
    } else if (entitlementIds.includes('predictiveplaypro')) {
      tier = 'pro';
    } else {
      console.log('   ⚠️ Unknown entitlements, skipping');
      continue;
    }

    // Find user from aliases
    let userId: string | null = null;
    let userFound = false;

    for (const alias of aliases) {
      // Skip RevenueCat anonymous IDs
      if (alias.startsWith('$RCAnonymousID:')) continue;

      // Check if alias is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(alias)) {
        // Try to find user by ID
        const { data: user } = await supabaseAdmin
          .from('profiles')
          .select('id, username, subscription_tier')
          .eq('id', alias)
          .single();

        if (user) {
          userId = user.id;
          console.log(`   ✅ Found user ${user.username} (${user.id})`);
          console.log(`   Current tier: ${user.subscription_tier}, New tier: ${tier}`);
          userFound = true;
          break;
        }
      }
    }

    if (!userFound) {
      console.log('   ❌ User not found in any alias');
      
      // Update webhook with error
      await supabaseAdmin
        .from('revenuecat_webhook_events')
        .update({
          processing_error: 'User not found in aliases',
          retries: (webhook.retries || 0) + 1
        })
        .eq('id', webhook.id);
      
      continue;
    }

    // Update user's subscription tier
    const entitlements = {
      elite: tier === 'elite',
      predictiveplaypro: tier === 'pro'
    };

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_tier: tier,
        revenuecat_customer_id: eventData.original_app_user_id || eventData.app_user_id,
        revenuecat_entitlements: entitlements,
        subscription_status: 'active',
        subscription_source: 'revenuecat',
        subscription_product_id: eventData.product_id,
        last_revenuecat_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error(`   ❌ Failed to update user:`, updateError);
      continue;
    }

    console.log(`   ✅ Updated user to ${tier} tier`);

    // Update webhook event with user_id
    await supabaseAdmin
      .from('revenuecat_webhook_events')
      .update({
        user_id: userId,
        processed_at: new Date().toISOString(),
        processing_error: null
      })
      .eq('id', webhook.id);

    console.log(`   ✅ Linked webhook to user`);
  }

  console.log('\n✅ Webhook processing complete');
  
  // Get summary of subscription tiers
  const { data: stats } = await supabaseAdmin
    .from('profiles')
    .select('subscription_tier')
    .in('subscription_tier', ['pro', 'elite']);
  
  if (stats) {
    const proCount = stats.filter(s => s.subscription_tier === 'pro').length;
    const eliteCount = stats.filter(s => s.subscription_tier === 'elite').length;
    console.log(`\n📊 Current subscription stats:`);
    console.log(`   Pro users: ${proCount}`);
    console.log(`   Elite users: ${eliteCount}`);
    console.log(`   Total paid users: ${proCount + eliteCount}`);
  }
}

// Run the script
processUnlinkedWebhooks()
  .then(() => {
    console.log('✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

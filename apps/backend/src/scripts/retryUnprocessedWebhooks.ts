import { supabaseAdmin } from '../services/supabaseClient';

/**
 * Script to retry unprocessed RevenueCat webhooks
 * Usage: npx ts-node src/scripts/retryUnprocessedWebhooks.ts
 */

interface WebhookEvent {
  id: string;
  event_type: string;
  event_data: any;
  revenuecat_customer_id: string;
  processing_error: string | null;
  retries: number;
  created_at: string;
}

async function retryUnprocessedWebhooks() {
  console.log('🔄 Starting unprocessed webhook retry...\n');

  // Get all unprocessed webhooks
  const { data: webhooks, error: fetchError } = await supabaseAdmin
    .from('revenuecat_webhook_events')
    .select('*')
    .is('processed_at', null)
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Error fetching webhooks:', fetchError);
    return;
  }

  if (!webhooks || webhooks.length === 0) {
    console.log('✅ No unprocessed webhooks found!');
    return;
  }

  console.log(`📦 Found ${webhooks.length} unprocessed webhooks\n`);

  for (const webhook of webhooks as WebhookEvent[]) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Processing webhook ${webhook.id}`);
    console.log(`Event Type: ${webhook.event_type}`);
    console.log(`RevenueCat Customer ID: ${webhook.revenuecat_customer_id}`);
    console.log(`Previous Error: ${webhook.processing_error}`);
    console.log(`Created: ${webhook.created_at}`);

    const event = webhook.event_data;
    const emailFromWebhook = event.subscriber_attributes?.['$email']?.value || 
                            event.subscriber_attributes?.['$Email']?.value;
    const usernameFromWebhook = event.subscriber_attributes?.['$displayName']?.value ||
                               event.subscriber_attributes?.['$DisplayName']?.value;

    console.log(`\n📧 Email: ${emailFromWebhook || 'Not available'}`);
    console.log(`👤 Username: ${usernameFromWebhook || 'Not available'}`);
    console.log(`🔗 Aliases: ${event.aliases ? event.aliases.join(', ') : 'None'}`);

    // Try all lookup strategies
    let user = null;

    // Strategy 1: Direct RevenueCat customer ID
    console.log('\n🔍 Strategy 1: RevenueCat Customer ID lookup...');
    const { data: rcUser } = await supabaseAdmin
      .from('profiles')
      .select('id, revenuecat_customer_id, subscription_tier, email, username')
      .eq('revenuecat_customer_id', event.app_user_id)
      .single();
    
    if (rcUser) {
      console.log(`✅ Found: ${rcUser.email} (${rcUser.id})`);
      user = rcUser;
    } else {
      console.log('❌ Not found');
    }

    // Strategy 2: Email lookup
    if (!user && emailFromWebhook) {
      console.log('\n🔍 Strategy 2: Email lookup...');
      const { data: emailUser } = await supabaseAdmin
        .from('profiles')
        .select('id, revenuecat_customer_id, subscription_tier, email, username')
        .eq('email', emailFromWebhook)
        .single();
      
      if (emailUser) {
        console.log(`✅ Found: ${emailUser.email} (${emailUser.id})`);
        user = emailUser;
        
        // Link RevenueCat ID
        await supabaseAdmin
          .from('profiles')
          .update({ revenuecat_customer_id: event.app_user_id })
          .eq('id', emailUser.id);
        console.log(`🔗 Linked RevenueCat ID to user`);
      } else {
        console.log('❌ Not found');
      }
    }

    // Strategy 3: Username lookup
    if (!user && usernameFromWebhook) {
      console.log('\n🔍 Strategy 3: Username lookup...');
      const { data: usernameUser } = await supabaseAdmin
        .from('profiles')
        .select('id, revenuecat_customer_id, subscription_tier, email, username')
        .eq('username', usernameFromWebhook)
        .single();
      
      if (usernameUser) {
        console.log(`✅ Found: ${usernameUser.username} (${usernameUser.id})`);
        user = usernameUser;
        
        // Link RevenueCat ID
        await supabaseAdmin
          .from('profiles')
          .update({ revenuecat_customer_id: event.app_user_id })
          .eq('id', usernameUser.id);
        console.log(`🔗 Linked RevenueCat ID to user`);
      } else {
        console.log('❌ Not found');
      }
    }

    // Strategy 4: Alias search
    if (!user && event.aliases && Array.isArray(event.aliases)) {
      console.log(`\n🔍 Strategy 4: Searching ${event.aliases.length} aliases...`);
      
      for (const alias of event.aliases) {
        if (alias === event.app_user_id) continue;
        
        console.log(`   Trying alias: ${alias}`);
        const { data: aliasUser } = await supabaseAdmin
          .from('profiles')
          .select('id, revenuecat_customer_id, subscription_tier, email, username')
          .or(`id.eq.${alias},revenuecat_customer_id.eq.${alias}`)
          .single();
        
        if (aliasUser) {
          console.log(`   ✅ Found: ${aliasUser.email} (${aliasUser.id})`);
          user = aliasUser;
          
          // Link primary RevenueCat ID
          await supabaseAdmin
            .from('profiles')
            .update({ revenuecat_customer_id: event.app_user_id })
            .eq('id', aliasUser.id);
          console.log(`   🔗 Linked primary RevenueCat ID to user`);
          break;
        }
      }
      
      if (!user) {
        console.log('❌ No matches found in aliases');
      }
    }

    // Strategy 5: UUID match
    if (!user) {
      console.log('\n🔍 Strategy 5: UUID match...');
      const { data: uuidUser } = await supabaseAdmin
        .from('profiles')
        .select('id, revenuecat_customer_id, subscription_tier, email, username')
        .eq('id', event.app_user_id)
        .single();
      
      if (uuidUser) {
        console.log(`✅ Found: ${uuidUser.email} (${uuidUser.id})`);
        user = uuidUser;
      } else {
        console.log('❌ Not found');
      }
    }

    // Process or mark as still unprocessed
    if (user) {
      console.log(`\n✅ USER FOUND! Processing ${webhook.event_type} event...`);
      
      // Mark webhook as processed (actual event processing would happen via webhook handler)
      await supabaseAdmin
        .from('revenuecat_webhook_events')
        .update({ 
          processed_at: new Date().toISOString(),
          user_id: user.id,
          processing_error: null
        })
        .eq('id', webhook.id);
      
      console.log(`✅ Webhook marked as processed and linked to user ${user.id}`);
    } else {
      console.log(`\n⚠️ USER NOT FOUND - This webhook cannot be processed`);
      console.log(`\nPossible reasons:`);
      console.log(`  1. User subscribed but never created an account in the app`);
      console.log(`  2. User deleted their account after subscribing`);
      console.log(`  3. RevenueCat ID mismatch (contact support)`);
      console.log(`\nRecommendation: Wait for new app version with email/username attributes`);
      
      // Update retry count
      await supabaseAdmin
        .from('revenuecat_webhook_events')
        .update({ 
          retries: (webhook.retries || 0) + 1,
          processing_error: 'User not found - needs manual investigation'
        })
        .eq('id', webhook.id);
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);
  console.log('✅ Retry process complete!');
}

retryUnprocessedWebhooks()
  .then(() => {
    console.log('\n✨ Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

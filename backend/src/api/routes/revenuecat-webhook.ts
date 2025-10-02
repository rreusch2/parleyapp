import { Request, Response } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../../services/supabaseClient';

interface RevenueCatWebhookEvent {
  event: {
    type: string;
    id: string;
    event_timestamp_ms: number;
    api_version: string;
    app_id: string;
    app_user_id: string;
    original_app_user_id: string;
    aliases?: string[];
    original_transaction_id?: string;
    product_id?: string;
    period_type?: string;
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    environment?: string;
    presented_offering_identifier?: string;
    transaction_id?: string;
    original_purchase_date_ms?: number;
    store?: string;
    takehome_percentage?: number;
    commission_percentage?: number;
    country_code?: string;
    price?: number;
    currency?: string;
    subscriber_attributes?: Record<string, any>;
    entitlements?: Record<string, {
      expires_date?: string;
      grace_period_expires_date?: string;
      product_identifier: string;
      purchase_date: string;
    }>;
  };
}

// Simple authorization: RevenueCat sends an Authorization: Bearer <token> header
function isAuthorizedAuthHeader(authHeader: string | undefined, secret: string): boolean {
  if (!authHeader) return false;
  if (authHeader === secret) return true; // allow exact match
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === secret;
  }
  return false;
}

// Map RevenueCat product IDs to tiers
function getProductTier(productId: string): 'pro' | 'elite' | null {
  const proProducts = [
    'com.parleyapp.premium_monthly',
    'com.parleyapp.premium_weekly', 
    'com.parleyapp.premiumyearly',
    'com.parleyapp.premium_lifetime',
    'com.parleyapp.pro:proweekly1',
    'com.parleyapp.pro:promonthy',
    'com.parleyapp.pro:proyearly',
    'com.parleyapp.prodaypass',
    'prod_SntVCPbLpTUopK', // Monthly Pro (Stripe)
    'prod_SntY5QNcfRieKy', // Weekly Pro (Stripe)  
    'prod_SntZxhho7WaBPE', // Yearly Pro (Stripe)
    'prod_SntkjlxuVOIhSX'  // Lifetime Pro (Stripe)
  ];
  
  const eliteProducts = [
    'com.parleyapp.allstarweekly',
    'com.parleyapp.allstarmonthly', 
    'com.parleyapp.allstaryearly',
    'com.parleyapp.elitedaypass',
    'com.parleyapp.elite:eliteweekly',
    'com.parleyapp.elite:monthlyelite',
    'com.parleyapp.elite:yearly',
    'prod_Sntg5FMrsqzK0o', // Monthly Elite (Stripe)
    'prod_SntVCPbLpTUopK', // Weekly Elite (Stripe)
    'prod_Snti3YqrYpAOS7'  // Yearly Elite (Stripe)
  ];
  
  if (proProducts.includes(productId)) return 'pro';
  if (eliteProducts.includes(productId)) return 'elite';
  return null;
}

// Check if product is a day pass (non-renewable)
function isDayPassProduct(productId: string): boolean {
  return productId.includes('daypass');
}

export async function handleRevenueCatWebhook(req: Request, res: Response) {
  try {
    const authHeader = req.headers['authorization'] as string | undefined;
    const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET || '';
    if (webhookSecret && !isAuthorizedAuthHeader(authHeader, webhookSecret)) {
      console.error('Invalid RevenueCat webhook authorization');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const webhookData: RevenueCatWebhookEvent = req.body;
    const { event } = webhookData;
    
    console.log(`📥 RevenueCat Webhook: ${event.type} for user ${event.app_user_id}`);
    
    // Store webhook event for debugging
    await supabaseAdmin
      .from('revenuecat_webhook_events')
      .insert({
        event_type: event.type,
        event_data: event,
        revenuecat_customer_id: event.app_user_id,
        created_at: new Date().toISOString()
      });

    // Enhanced user lookup for multiple RevenueCat integration scenarios
    let user: { id: string; revenuecat_customer_id: string | null; subscription_tier: string; stripe_customer_id: string | null } | null = null;
    
    console.log(`🔍 Looking for user with app_user_id: ${event.app_user_id}`);
    
    // Extract email and username from subscriber_attributes (available in new app version)
    const emailFromWebhook = event.subscriber_attributes?.['$email']?.value || 
                            event.subscriber_attributes?.['$Email']?.value;
    const usernameFromWebhook = event.subscriber_attributes?.['$displayName']?.value ||
                               event.subscriber_attributes?.['$DisplayName']?.value;
    
    if (emailFromWebhook || usernameFromWebhook) {
      console.log(`📧 Webhook contains email: ${emailFromWebhook || 'N/A'}, username: ${usernameFromWebhook || 'N/A'}`);
    }
    
    // Strategy 1: Direct RevenueCat customer ID match
    const { data: rcUser } = await supabaseAdmin
      .from('profiles')
      .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
      .eq('revenuecat_customer_id', event.app_user_id)
      .single();
    
    if (rcUser) {
      console.log(`✅ Found user by revenuecat_customer_id: ${rcUser.id}`);
      user = rcUser;
    } else {
      // Strategy 2: Email lookup (NEW - for enhanced webhooks)
      if (emailFromWebhook) {
        const { data: emailUser } = await supabaseAdmin
          .from('profiles')
          .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
          .eq('email', emailFromWebhook)
          .single();
        
        if (emailUser) {
          console.log(`✅ Found user by email: ${emailUser.id}`);
          user = emailUser;
          
          // Link this RevenueCat ID to the user for future webhooks
          await supabaseAdmin
            .from('profiles')
            .update({ revenuecat_customer_id: event.app_user_id })
            .eq('id', emailUser.id);
          console.log(`🔗 Linked RevenueCat ID ${event.app_user_id} to user ${emailUser.id} via email`);
        }
      }
      
      // Strategy 3: Username lookup (NEW - for enhanced webhooks)
      if (!user && usernameFromWebhook) {
        const { data: usernameUser } = await supabaseAdmin
          .from('profiles')
          .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
          .eq('username', usernameFromWebhook)
          .single();
        
        if (usernameUser) {
          console.log(`✅ Found user by username: ${usernameUser.id}`);
          user = usernameUser;
          
          // Link this RevenueCat ID to the user for future webhooks
          await supabaseAdmin
            .from('profiles')
            .update({ revenuecat_customer_id: event.app_user_id })
            .eq('id', usernameUser.id);
          console.log(`🔗 Linked RevenueCat ID ${event.app_user_id} to user ${usernameUser.id} via username`);
        }
      }
      
      // Strategy 4: Search through aliases array (NEW - better alias handling)
      if (!user && event.aliases && Array.isArray(event.aliases)) {
        console.log(`🔍 Checking ${event.aliases.length} aliases: ${event.aliases.join(', ')}`);
        
        for (const alias of event.aliases) {
          // Skip if we already checked this one
          if (alias === event.app_user_id) continue;
          
          // Try each alias as a potential user ID or RevenueCat ID
          const { data: aliasUser } = await supabaseAdmin
            .from('profiles')
            .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
            .or(`id.eq.${alias},revenuecat_customer_id.eq.${alias}`)
            .single();
          
          if (aliasUser) {
            console.log(`✅ Found user via alias ${alias}: ${aliasUser.id}`);
            user = aliasUser;
            
            // Link the primary app_user_id to this profile
            await supabaseAdmin
              .from('profiles')
              .update({ revenuecat_customer_id: event.app_user_id })
              .eq('id', aliasUser.id);
            console.log(`🔗 Linked primary RevenueCat ID ${event.app_user_id} to user ${aliasUser.id} via alias`);
            break;
          }
        }
      }
      
      // Strategy 5: Stripe customer ID match (for Stripe-originated purchases)
      if (!user) {
        const { data: stripeUser } = await supabaseAdmin
          .from('profiles')
          .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
          .eq('stripe_customer_id', event.app_user_id)
          .single();
        
        if (stripeUser) {
          console.log(`✅ Found user by stripe_customer_id: ${stripeUser.id}`);
          user = stripeUser;
        }
      }
      
      // Strategy 6: UUID match (for app-native purchases)
      if (!user) {
        const { data: uuidUser } = await supabaseAdmin
          .from('profiles')
          .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
          .eq('id', event.app_user_id)
          .single();
        
        if (uuidUser) {
          console.log(`✅ Found user by UUID: ${uuidUser.id}`);
          user = uuidUser;
        }
      }
      
      // Strategy 7: Handle anonymous RevenueCat IDs from Stripe purchases
      if (!user && event.app_user_id.startsWith('$RCAnonymousID:')) {
        console.log(`🔍 Anonymous RevenueCat ID detected, checking for Stripe linkage...`);
        
        const stripeCustomerId = event.subscriber_attributes?.['$stripeCustomerId']?.value;
        
        if (stripeCustomerId) {
          const { data: linkUser } = await supabaseAdmin
            .from('profiles')
            .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
            .eq('stripe_customer_id', stripeCustomerId)
            .single();
          
          if (linkUser) {
            console.log(`✅ Found user via Stripe attribute linkage: ${linkUser.id}`);
            user = linkUser;
            
            // Update the user's RevenueCat customer ID for future webhooks
            await supabaseAdmin
              .from('profiles')
              .update({ revenuecat_customer_id: event.app_user_id })
              .eq('id', linkUser.id);
              
            console.log(`🔗 Linked RevenueCat ID ${event.app_user_id} to user ${linkUser.id}`);
          }
        }
      }
    }

    if (!user) {
      console.log(`⚠️ User not found for RevenueCat ID: ${event.app_user_id}`);
      // Store as unprocessed for later retry
      await supabaseAdmin
        .from('revenuecat_webhook_events')
        .update({ 
          processing_error: 'User not found',
          retries: 1 
        })
        .eq('revenuecat_customer_id', event.app_user_id)
        .eq('event_type', event.type)
        .order('created_at', { ascending: false })
        .limit(1);
      
      return res.status(200).json({ message: 'User not found, stored for retry' });
    }

    // Process different event types
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE': 
      case 'NON_RENEWING_PURCHASE': {
        await handleSubscriptionActive(user.id, event);
        break;
      }
      
      case 'CANCELLATION': {
        // Do NOT downgrade on cancellation — user keeps access until expiration
        await handleSubscriptionCancelled(user.id, event);
        break;
      }

      case 'BILLING_ISSUE': {
        // Mark as past_due but do NOT downgrade tier
        await handleSubscriptionPastDue(user.id, event);
        break;
      }

      case 'EXPIRATION': {
        // Only expiration should actually downgrade the account
        await handleSubscriptionInactive(user.id, event);
        break;
      }
      
      case 'UNCANCELLATION': {
        await handleSubscriptionReactivated(user.id, event);
        break;
      }
      
      default:
        console.log(`🤷 Unhandled event type: ${event.type}`);
    }

    // Mark webhook as processed
    await supabaseAdmin
      .from('revenuecat_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('revenuecat_customer_id', event.app_user_id)
      .eq('event_type', event.type)
      .order('created_at', { ascending: false })
      .limit(1);

    res.status(200).json({ message: 'Webhook processed successfully' });
    
  } catch (error) {
    console.error('❌ RevenueCat webhook error:', error);
    
    // Log error to database
    if (req.body?.event?.app_user_id) {
      await supabaseAdmin
        .from('revenuecat_webhook_events')
        .update({ 
          processing_error: error instanceof Error ? error.message : 'Unknown error',
          retries: 1 
        })
        .eq('revenuecat_customer_id', req.body.event.app_user_id)
        .eq('event_type', req.body.event.type)
        .order('created_at', { ascending: false })
        .limit(1);
    }
    
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleSubscriptionActive(userId: string, event: any) {
  // For day passes: Handle via NON_RENEWING_PURCHASE event (not entitlements)
  if (event.type === 'NON_RENEWING_PURCHASE') {
    const productId = event.product_id;
    const tier = getProductTier(productId);
    
    if (!tier || !isDayPassProduct(productId)) {
      console.log(`⚠️ Unknown day pass product: ${productId}`);
      return;
    }
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    await supabaseAdmin
      .from('profiles') 
      .update({
        day_pass_tier: tier,
        day_pass_expires_at: expiresAt.toISOString(),
        day_pass_granted_at: new Date().toISOString(),
        subscription_source: 'daypass',
        subscription_tier: tier, // ensure UI unlocks immediately
        subscription_status: 'active',
        revenuecat_customer_id: event.app_user_id,
        last_revenuecat_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    console.log(`🎫 Day pass granted: ${tier} until ${expiresAt.toISOString()}`);
    return;
  }
  
  // For renewable subscriptions: Use entitlement_ids array from RevenueCat
  // RevenueCat sends entitlement_ids as an array: ["predictiveplaypro"] or ["elite"]
  let mappedTier: 'pro' | 'elite' | null = null;
  
  // Strategy 1: Check entitlement_ids array (most reliable for INITIAL_PURCHASE and RENEWAL)
  if (event.entitlement_ids && Array.isArray(event.entitlement_ids) && event.entitlement_ids.length > 0) {
    const entitlementIds = event.entitlement_ids;
    console.log('🔍 Found entitlement_ids:', entitlementIds);
    
    if (entitlementIds.includes('elite')) {
      mappedTier = 'elite';
    } else if (entitlementIds.includes('predictiveplaypro')) {
      mappedTier = 'pro';
    }
  }
  
  // Strategy 2: Check entitlements object (for other event types)
  if (!mappedTier && event.entitlements) {
    const entitlements = event.entitlements;
    if (entitlements && (entitlements.predictiveplaypro || entitlements.elite)) {
      const proActive = !!entitlements.predictiveplaypro && entitlements.predictiveplaypro.expires_date && new Date(entitlements.predictiveplaypro.expires_date) > new Date();
      const eliteActive = !!entitlements.elite && entitlements.elite.expires_date && new Date(entitlements.elite.expires_date) > new Date();
      mappedTier = eliteActive ? 'elite' : (proActive ? 'pro' : null);
    }
  }
  
  // Strategy 3: Fallback to product mapping if entitlements missing
  if (!mappedTier && event.product_id) {
    mappedTier = getProductTier(event.product_id);
  }
  
  console.log('🎯 Determined subscription tier:', mappedTier);
  const revenuecatEntitlements = {
    predictiveplaypro: mappedTier === 'pro',
    elite: mappedTier === 'elite'
  };
  
  await supabaseAdmin
    .from('profiles')
    .update({
      revenuecat_entitlements: revenuecatEntitlements,
      revenuecat_customer_id: event.app_user_id,
      revenuecat_customer_info: event,
      subscription_source: 'revenuecat',
      subscription_product_id: event.product_id,
      subscription_tier: mappedTier || 'free',
      subscription_status: mappedTier ? 'active' : 'inactive',
      last_revenuecat_sync: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  console.log(`✅ Entitlements updated:`, revenuecatEntitlements);
}

async function handleSubscriptionInactive(userId: string, event: any) {
  // Clear RevenueCat entitlements but preserve day passes
  // Determine if day pass is still active before downgrading tier
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('day_pass_expires_at, day_pass_tier')
    .eq('id', userId)
    .single();

  const hasActiveDayPass = !!(profile?.day_pass_expires_at && new Date(profile.day_pass_expires_at) > new Date());

  await supabaseAdmin
    .from('profiles')
    .update({
      revenuecat_entitlements: { predictiveplaypro: false, elite: false },
      revenuecat_customer_info: event,
      subscription_source: hasActiveDayPass ? 'daypass' : 'legacy',
      subscription_tier: hasActiveDayPass ? profile?.day_pass_tier : 'free',
      subscription_status: hasActiveDayPass ? 'active' : 'expired',
      last_revenuecat_sync: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  console.log(`❌ Subscription deactivated for user ${userId}`);
}

// Cancellation: user opted out of renewal, but access continues until expiration.
// Do not clear entitlements or downgrade tier here.
async function handleSubscriptionCancelled(userId: string, event: any) {
  await supabaseAdmin
    .from('profiles')
    .update({
      revenuecat_customer_info: event,
      subscription_status: 'cancelled',
      last_revenuecat_sync: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  console.log(`🛑 Subscription marked as cancelled (no downgrade) for user ${userId}`);
}

// Billing issue: payment failure or grace period. Do not downgrade; mark as past_due.
async function handleSubscriptionPastDue(userId: string, event: any) {
  await supabaseAdmin
    .from('profiles')
    .update({
      revenuecat_customer_info: event,
      subscription_status: 'past_due',
      last_revenuecat_sync: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  console.log(`⚠️ Subscription marked as past_due (no downgrade) for user ${userId}`);
}

async function handleSubscriptionReactivated(userId: string, event: any) {
  const productId = event.product_id;
  const tier = getProductTier(productId);
  
  if (tier) {
    const entitlements = {
      predictiveplaypro: tier === 'pro',
      elite: tier === 'elite'
    };
    
    await supabaseAdmin
      .from('profiles')
      .update({
        revenuecat_entitlements: entitlements,
        revenuecat_customer_info: event,
        subscription_source: 'revenuecat',
        last_revenuecat_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    console.log(`🔄 Subscription reactivated: ${tier} for user ${userId}`);
  }
}

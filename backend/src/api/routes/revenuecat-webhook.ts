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

function isUUIDLike(id: string | undefined): boolean {
  if (!id) return false;
  return /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(id);
}

function isRcAnonymous(id: string | undefined): boolean {
  return !!id && id.startsWith('$RCAnonymousID:');
}

function getAliasesFromEvent(ev: any): string[] {
  try {
    const a = ev?.aliases;
    if (Array.isArray(a)) return a.filter((x) => typeof x === 'string');
  } catch {}
  return [];
}

async function findUserFromRevenueCatEvent(event: any): Promise<{
  id: string;
  revenuecat_customer_id: string | null;
  subscription_tier: string;
  stripe_customer_id: string | null;
} | null> {
  // Strategy 1: Direct RC customer id match
  const appUserId: string | undefined = event?.app_user_id;
  if (appUserId) {
    const { data: rcUser } = await supabaseAdmin
      .from('profiles')
      .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
      .eq('revenuecat_customer_id', appUserId)
      .single();
    if (rcUser) return rcUser as any;

    // Strategy 1b: Sometimes app_user_id is the actual profile UUID
    if (isUUIDLike(appUserId)) {
      const { data: uuidUser } = await supabaseAdmin
        .from('profiles')
        .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
        .eq('id', appUserId)
        .single();
      if (uuidUser) return uuidUser as any;
    }
  }

  // Strategy 2: Stripe customer id match (RevenueCat may use Stripe id as app_user_id)
  if (appUserId) {
    const { data: stripeUser } = await supabaseAdmin
      .from('profiles')
      .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
      .eq('stripe_customer_id', appUserId)
      .single();
    if (stripeUser) return stripeUser as any;
  }

  // Strategy 3: Aliases array provided by RC often includes the actual UUID or historical ids
  const aliases = getAliasesFromEvent(event);
  for (const alias of aliases) {
    if (isRcAnonymous(alias)) continue; // skip anonymous placeholders
    if (isUUIDLike(alias)) {
      const { data: aliasUserById } = await supabaseAdmin
        .from('profiles')
        .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
        .eq('id', alias)
        .single();
      if (aliasUserById) return aliasUserById as any;
    }
    const { data: aliasUserByRc } = await supabaseAdmin
      .from('profiles')
      .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
      .eq('revenuecat_customer_id', alias)
      .single();
    if (aliasUserByRc) return aliasUserByRc as any;
  }

  // Strategy 4: Link anonymous RC id via Stripe attribute if present
  const stripeCustomerId = event?.subscriber_attributes?.['$stripeCustomerId']?.value;
  if (stripeCustomerId) {
    const { data: linkUser } = await supabaseAdmin
      .from('profiles')
      .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();
    if (linkUser) return linkUser as any;
  }

  return null;
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

    // RevenueCat can require raw body. If express.raw is used, req.body will be Buffer.
    let incoming: any = req.body;
    if (Buffer.isBuffer(incoming)) {
      try {
        incoming = JSON.parse(incoming.toString('utf8'));
      } catch (e) {
        console.error('❌ Failed to parse raw webhook body:', e);
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    } else if (typeof incoming === 'string') {
      try {
        incoming = JSON.parse(incoming);
      } catch {}
    }

    const webhookData: RevenueCatWebhookEvent = incoming;
    const { event } = webhookData;
    
    console.log(`📥 RevenueCat Webhook: ${event.type} for user ${event.app_user_id}`);
    
    // Store webhook event and capture row id so we can mark the specific row processed
    let eventRowId: string | null = null;
    {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from('revenuecat_webhook_events')
        .insert({
          event_type: event.type,
          event_data: event,
          revenuecat_customer_id: event.app_user_id,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      if (insErr) {
        console.warn('⚠️ Failed to insert webhook event row:', insErr);
      } else {
        eventRowId = inserted?.id ?? null;
      }
    }

    // Robust user lookup including aliases
    console.log(`🔍 Looking for user with app_user_id: ${event.app_user_id}`);
    let user: { id: string; revenuecat_customer_id: string | null; subscription_tier: string; stripe_customer_id: string | null } | null = null;
    user = await findUserFromRevenueCatEvent(event);
    if (user) {
      console.log(`✅ Mapped webhook to user ${user.id}`);
      if (eventRowId) {
        await supabaseAdmin
          .from('revenuecat_webhook_events')
          .update({ user_id: user.id })
          .eq('id', eventRowId);
      }
    }

    if (!user) {
      console.log(`⚠️ User not found for RevenueCat ID: ${event.app_user_id}`);
      // If it's an anonymous/unlinkable id, mark processed with a helpful error to avoid backlog
      const aliases = getAliasesFromEvent(event);
      const onlyAnonymous = (!aliases.length || aliases.every(isRcAnonymous)) && isRcAnonymous(event.app_user_id);
      const processing_error = onlyAnonymous ? 'Anonymous RC id with no linkable alias' : 'User not found';
      if (eventRowId) {
        await supabaseAdmin
          .from('revenuecat_webhook_events')
          .update({ processed_at: new Date().toISOString(), processing_error })
          .eq('id', eventRowId);
      } else {
        await supabaseAdmin
          .from('revenuecat_webhook_events')
          .update({ processed_at: new Date().toISOString(), processing_error })
          .eq('revenuecat_customer_id', event.app_user_id)
          .eq('event_type', event.type);
      }
      return res.status(200).json({ message: 'No linkable user; marked processed' });
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

    // Mark webhook as processed for the specific inserted row
    if (eventRowId) {
      await supabaseAdmin
        .from('revenuecat_webhook_events')
        .update({ processed_at: new Date().toISOString(), processing_error: null })
        .eq('id', eventRowId);
    } else {
      // Fallback if insert id was not captured
      await supabaseAdmin
        .from('revenuecat_webhook_events')
        .update({ processed_at: new Date().toISOString(), processing_error: null })
        .eq('revenuecat_customer_id', event.app_user_id)
        .eq('event_type', event.type);
    }

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
        .eq('event_type', req.body.event.type);
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

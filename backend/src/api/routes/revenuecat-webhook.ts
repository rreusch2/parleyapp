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

// Webhook signature verification
function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
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
    const signature = req.headers['authorization']?.replace('Bearer ', '') || '';
    const rawBody = JSON.stringify(req.body);
    
    // Verify webhook signature (optional but recommended)
    const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (webhookSecret && !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('Invalid RevenueCat webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
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

    // Find user by RevenueCat customer ID or app_user_id
    const { data: user } = await supabaseAdmin
      .from('profiles')
      .select('id, revenuecat_customer_id, subscription_tier')
      .or(`revenuecat_customer_id.eq.${event.app_user_id},id.eq.${event.app_user_id}`)
      .single();

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
      
      case 'CANCELLATION':
      case 'EXPIRATION':
      case 'BILLING_ISSUE': {
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
        revenuecat_customer_id: event.app_user_id,
        last_revenuecat_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    console.log(`🎫 Day pass granted: ${tier} until ${expiresAt.toISOString()}`);
    return;
  }
  
  // For renewable subscriptions: Use entitlements from RevenueCat
  // RevenueCat will send us the active entitlements in the event data
  const entitlements = event.entitlements || {};
  
  const revenuecatEntitlements = {
    predictiveplaypro: !!entitlements.predictiveplaypro && 
                      entitlements.predictiveplaypro.expires_date && 
                      new Date(entitlements.predictiveplaypro.expires_date) > new Date(),
    elite: !!entitlements.elite && 
           entitlements.elite.expires_date && 
           new Date(entitlements.elite.expires_date) > new Date()
  };
  
  await supabaseAdmin
    .from('profiles')
    .update({
      revenuecat_entitlements: revenuecatEntitlements,
      revenuecat_customer_id: event.app_user_id,
      revenuecat_customer_info: event,
      subscription_source: 'revenuecat',
      subscription_product_id: event.product_id,
      last_revenuecat_sync: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  console.log(`✅ Entitlements updated:`, revenuecatEntitlements);
}

async function handleSubscriptionInactive(userId: string, event: any) {
  // Clear RevenueCat entitlements but preserve day passes
  await supabaseAdmin
    .from('profiles')
    .update({
      revenuecat_entitlements: { predictiveplaypro: false, elite: false },
      revenuecat_customer_info: event,
      subscription_source: 'legacy', // Fall back to legacy logic if any
      last_revenuecat_sync: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
    
  console.log(`❌ Subscription deactivated for user ${userId}`);
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

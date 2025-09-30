import cron from 'node-cron';
import { supabaseAdmin } from '../services/supabaseClient';
import { logger } from '../utils/logger';

function isUUIDLike(id?: string): boolean {
  if (!id) return false;
  return /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(id);
}

function isRcAnonymous(id?: string): boolean {
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
  subscription_tier: string | null;
  stripe_customer_id: string | null;
} | null> {
  const appUserId: string | undefined = event?.app_user_id;
  if (appUserId) {
    // Direct revenuecat_customer_id match
    const { data: rcUser } = await supabaseAdmin
      .from('profiles')
      .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
      .eq('revenuecat_customer_id', appUserId)
      .single();
    if (rcUser) return rcUser as any;

    // profile UUID match
    if (isUUIDLike(appUserId)) {
      const { data: uuidUser } = await supabaseAdmin
        .from('profiles')
        .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
        .eq('id', appUserId)
        .single();
      if (uuidUser) return uuidUser as any;
    }

    // Stripe customer id match
    const { data: stripeUser } = await supabaseAdmin
      .from('profiles')
      .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
      .eq('stripe_customer_id', appUserId)
      .single();
    if (stripeUser) return stripeUser as any;
  }

  // aliases
  const aliases = getAliasesFromEvent(event);
  for (const alias of aliases) {
    if (isRcAnonymous(alias)) continue;
    if (isUUIDLike(alias)) {
      const { data: byId } = await supabaseAdmin
        .from('profiles')
        .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
        .eq('id', alias)
        .single();
      if (byId) return byId as any;
    }
    const { data: byRc } = await supabaseAdmin
      .from('profiles')
      .select('id, revenuecat_customer_id, subscription_tier, stripe_customer_id')
      .eq('revenuecat_customer_id', alias)
      .single();
    if (byRc) return byRc as any;
  }

  // Stripe attribute linkage
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
    'prod_SntVCPbLpTUopK',
    'prod_SntY5QNcfRieKy',
    'prod_SntZxhho7WaBPE',
    'prod_SntkjlxuVOIhSX'
  ];
  const eliteProducts = [
    'com.parleyapp.allstarweekly',
    'com.parleyapp.allstarmonthly',
    'com.parleyapp.allstaryearly',
    'com.parleyapp.elitedaypass',
    'com.parleyapp.elite:eliteweekly',
    'com.parleyapp.elite:monthlyelite',
    'com.parleyapp.elite:yearly',
    'prod_Sntg5FMrsqzK0o',
    'prod_SntVCPbLpTUopK',
    'prod_Snti3YqrYpAOS7'
  ];
  if (proProducts.includes(productId)) return 'pro';
  if (eliteProducts.includes(productId)) return 'elite';
  return null;
}

function isDayPassProduct(productId: string): boolean {
  return !!productId && productId.toLowerCase().includes('daypass');
}

async function handleSubscriptionActive(userId: string, event: any) {
  if (event.type === 'NON_RENEWING_PURCHASE') {
    const productId = event.product_id;
    const tier = getProductTier(productId);
    if (!tier || !isDayPassProduct(productId)) return;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await supabaseAdmin
      .from('profiles')
      .update({
        day_pass_tier: tier,
        day_pass_expires_at: expiresAt.toISOString(),
        day_pass_granted_at: new Date().toISOString(),
        subscription_source: 'daypass',
        subscription_tier: tier,
        subscription_status: 'active',
        revenuecat_customer_id: event.app_user_id,
        last_revenuecat_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    return;
  }
  let mappedTier: 'pro' | 'elite' | null = null;
  if (event.entitlement_ids && Array.isArray(event.entitlement_ids) && event.entitlement_ids.length > 0) {
    const entitlementIds = event.entitlement_ids as string[];
    if (entitlementIds.includes('elite')) mappedTier = 'elite';
    else if (entitlementIds.includes('predictiveplaypro')) mappedTier = 'pro';
  }
  if (!mappedTier && event.entitlements) {
    const entitlements = event.entitlements;
    const proActive = !!entitlements?.predictiveplaypro?.expires_date && new Date(entitlements.predictiveplaypro.expires_date) > new Date();
    const eliteActive = !!entitlements?.elite?.expires_date && new Date(entitlements.elite.expires_date) > new Date();
    mappedTier = eliteActive ? 'elite' : (proActive ? 'pro' : null);
  }
  if (!mappedTier && event.product_id) mappedTier = getProductTier(event.product_id);
  const revenuecatEntitlements = {
    predictiveplaypro: mappedTier === 'pro',
    elite: mappedTier === 'elite'
  } as any;
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
}

async function handleSubscriptionInactive(userId: string, event: any) {
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
}

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
}

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
}

async function handleSubscriptionReactivated(userId: string, event: any) {
  const productId = event.product_id;
  const tier = getProductTier(productId);
  if (!tier) return;
  const entitlements = {
    predictiveplaypro: tier === 'pro',
    elite: tier === 'elite'
  } as any;
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
}

async function processBacklogOnce(limit = 200) {
  try {
    const { data: events, error } = await supabaseAdmin
      .from('revenuecat_webhook_events')
      .select('id, event_type, event_data, revenuecat_customer_id, created_at')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      logger.error('❌ Failed to fetch unprocessed RC events', error);
      return;
    }

    if (!events || events.length === 0) {
      logger.info('✅ No unprocessed RevenueCat events');
      return;
    }

    let linked = 0;
    let marked = 0;

    for (const e of events) {
      const ev = e.event_data;
      const user = await findUserFromRevenueCatEvent(ev);

      if (user) {
        // Link row to user for audit
        await supabaseAdmin
          .from('revenuecat_webhook_events')
          .update({ user_id: user.id })
          .eq('id', e.id);

        // Apply business logic by event type
        try {
          switch (ev?.type) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'PRODUCT_CHANGE':
            case 'NON_RENEWING_PURCHASE':
              await handleSubscriptionActive(user.id, ev);
              break;
            case 'CANCELLATION':
              await handleSubscriptionCancelled(user.id, ev);
              break;
            case 'BILLING_ISSUE':
              await handleSubscriptionPastDue(user.id, ev);
              break;
            case 'EXPIRATION':
              await handleSubscriptionInactive(user.id, ev);
              break;
            case 'UNCANCELLATION':
              await handleSubscriptionReactivated(user.id, ev);
              break;
            default:
              // mark processed but do nothing
              break;
          }
        } catch (applyErr) {
          logger.warn('⚠️ Failed applying RC logic for event', { id: e.id, err: (applyErr as any)?.message });
        }

        // Mark processed
        await supabaseAdmin
          .from('revenuecat_webhook_events')
          .update({ processed_at: new Date().toISOString(), processing_error: null })
          .eq('id', e.id);
        linked++;
      } else {
        const aliases = getAliasesFromEvent(ev);
        const onlyAnonymous = (!aliases.length || aliases.every(isRcAnonymous)) && isRcAnonymous(ev?.app_user_id);
        const processing_error = onlyAnonymous ? 'Anonymous RC id with no linkable alias' : 'User not found';
        await supabaseAdmin
          .from('revenuecat_webhook_events')
          .update({ processed_at: new Date().toISOString(), processing_error })
          .eq('id', e.id);
        marked++;
      }
    }

    logger.info(`📦 RC backlog processed: linked=${linked}, marked=${marked}, total=${events.length}`);
  } catch (err) {
    logger.error('❌ RC backlog processing failed', err as any);
  }
}

export function startRevenueCatBacklogCron() {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    await processBacklogOnce();
  });
  logger.info('🔄 RevenueCat backlog cron started (every 10 minutes)');
  // Run once shortly after startup
  setTimeout(() => processBacklogOnce(), 5000);
}

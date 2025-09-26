import { supabaseAdmin } from './supabase/client';

/**
 * RevenueCat webhook processor
 *
 * Goal: Make RC entitlements the source of truth for renewable access.
 * - Update profiles.base_subscription_tier from entitlements (elite > pro)
 * - Update subscription_status and subscription_product_id where possible
 * - For day passes, optionally set temporary tier with expiry if product id indicates daypass
 */

export type RevenueCatWebhookPayload = any; // Be flexible; RC sends different shapes based on event type

function pick<T>(obj: any, path: string[], fallback?: T): T | undefined {
  try {
    return path.reduce<any>((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? fallback;
  } catch {
    return fallback;
  }
}

function parseEntitlements(payload: any): Record<string, any> | undefined {
  // Common RC webhook payloads include `event.subscriber.entitlements` or `subscriber.entitlements`
  return (
    pick<Record<string, any>>(payload, ['event', 'subscriber', 'entitlements']) ||
    pick<Record<string, any>>(payload, ['subscriber', 'entitlements']) ||
    pick<Record<string, any>>(payload, ['entitlements'])
  );
}

function parseAppUserId(payload: any): string | undefined {
  return (
    pick<string>(payload, ['event', 'app_user_id']) ||
    pick<string>(payload, ['app_user_id']) ||
    pick<string>(payload, ['subscriber', 'app_user_id'])
  );
}

function entitlementIsActive(ent: any): boolean {
  if (!ent) return false;
  // RC typically includes `expires_date` or `expiration_date` and `is_active`
  const active = ent.is_active ?? ent.active;
  if (typeof active === 'boolean') return active;
  const expStr = ent.expires_date || ent.expiration_date || ent.expires_at || ent.expires_at_ms;
  if (!expStr) return false;
  const expMs = typeof expStr === 'number' ? expStr : Date.parse(expStr);
  return !isNaN(expMs) && expMs > Date.now();
}

function productIdentifierFromEntitlement(ent: any): string | undefined {
  return ent.product_identifier || ent.productId || ent.store_product_id;
}

function detectPlanType(productId?: string): string | null {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (id.includes('weekly')) return 'weekly';
  if (id.includes('monthly') || id.includes('month')) return 'monthly';
  if (id.includes('yearly') || id.includes('annual') || id.includes('year')) return 'yearly';
  if (id.includes('lifetime')) return 'lifetime';
  if (id.includes('daypass') || id.includes('day_pass') || id.includes('day-pass')) return 'daypass';
  return null;
}

function isDayPassProduct(productId?: string): boolean {
  if (!productId) return false;
  const id = productId.toLowerCase();
  return id.includes('daypass') || id === 'com.parleyapp.elitedaypass' || id === 'com.parleyapp.prodaypass';
}

export async function updateProfileFromRevenueCat(payload: RevenueCatWebhookPayload): Promise<{ userId?: string; updated: boolean; reason?: string; }>
{
  const appUserId = parseAppUserId(payload);
  if (!appUserId) {
    return { updated: false, reason: 'Missing app_user_id' };
  }

  // Map RC app_user_id → profiles.id
  const { data: profileByRc, error: mapErr } = await supabaseAdmin
    .from('profiles')
    .select('id, base_subscription_tier, temporary_tier, temporary_tier_expires_at')
    .eq('revenuecat_customer_id', appUserId)
    .single();

  if (mapErr || !profileByRc) {
    return { updated: false, reason: 'User not found for revenuecat_customer_id' };
  }

  const entitlements = parseEntitlements(payload) || {};
  const eliteEnt = entitlements['elite'];
  const proEnt = entitlements['predictiveplaypro'];

  const eliteActive = entitlementIsActive(eliteEnt);
  const proActive = entitlementIsActive(proEnt);

  // Highest tier wins for base subscription
  const newBaseTier = eliteActive ? 'elite' : proActive ? 'pro' : null;
  let subscription_product_id: string | null = null;
  let subscription_plan_type: string | null = null;

  if (eliteActive && eliteEnt) {
    subscription_product_id = productIdentifierFromEntitlement(eliteEnt) ?? null;
    subscription_plan_type = detectPlanType(subscription_product_id || undefined);
  } else if (proActive && proEnt) {
    subscription_product_id = productIdentifierFromEntitlement(proEnt) ?? null;
    subscription_plan_type = detectPlanType(subscription_product_id || undefined);
  }

  // Prepare updates
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (newBaseTier) {
    updates.base_subscription_tier = newBaseTier;
    updates.subscription_status = 'active';
  } else {
    // No renewable entitlement active
    updates.base_subscription_tier = null;
    updates.subscription_status = 'inactive';
  }

  if (subscription_product_id !== null) updates.subscription_product_id = subscription_product_id;
  if (subscription_plan_type !== null) updates.subscription_plan_type = subscription_plan_type;

  // Day pass overlay (temporary tier) if product looks like day pass
  const eliteProduct = productIdentifierFromEntitlement(eliteEnt);
  const proProduct = productIdentifierFromEntitlement(proEnt);

  let temporaryTierToSet: string | undefined;
  let temporaryExpiryISO: string | undefined;

  // Prefer explicit expiry from entitlement if available
  function expiryFromEnt(ent: any): string | undefined {
    const exp = ent?.expires_date || ent?.expiration_date || ent?.expires_at || ent?.expires_at_ms;
    const ms = typeof exp === 'number' ? exp : (exp ? Date.parse(exp) : undefined);
    return ms && !isNaN(ms) ? new Date(ms).toISOString() : undefined;
  }

  if (eliteActive && isDayPassProduct(eliteProduct)) {
    temporaryTierToSet = 'elite';
    temporaryExpiryISO = expiryFromEnt(eliteEnt) || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  } else if (proActive && isDayPassProduct(proProduct)) {
    temporaryTierToSet = 'pro';
    temporaryExpiryISO = expiryFromEnt(proEnt) || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  if (temporaryTierToSet && temporaryExpiryISO) {
    updates.temporary_tier = temporaryTierToSet;
    updates.temporary_tier_active = true;
    updates.temporary_tier_expires_at = temporaryExpiryISO;
  }

  const { error: upErr } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', profileByRc.id);

  if (upErr) {
    return { userId: profileByRc.id, updated: false, reason: upErr.message };
  }

  return { userId: profileByRc.id, updated: true };
}

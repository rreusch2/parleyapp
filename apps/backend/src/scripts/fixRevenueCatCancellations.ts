/*
  One-off backfill script to correct profiles incorrectly downgraded to 'free' on CANCELLATION.

  What it does:
  - Finds the latest RevenueCat CANCELLATION event per customer.
  - If the event indicates a future expiration (expiration_at_ms > now or any entitlement.expires_date > now),
    and the profile is currently 'free' or has subscription_status in ('expired','inactive'),
    then restore the user to `subscription_status='cancelled'` and set `subscription_tier` based on product_id mapping.
  - Skips day pass products.

  Usage:
    Dry run (no writes):
      npx ts-node --transpile-only backend/src/scripts/fixRevenueCatCancellations.ts --dry-run

    Apply changes:
      npx ts-node --transpile-only backend/src/scripts/fixRevenueCatCancellations.ts
*/

import { supabaseAdmin } from '../services/supabaseClient';

// Map RevenueCat/Stripe product IDs to tiers
function getProductTier(productId: string | null | undefined): 'pro' | 'elite' | null {
  if (!productId) return null;
  const proProducts = new Set([
    'com.parleyapp.premium_monthly',
    'com.parleyapp.premium_weekly',
    'com.parleyapp.premiumyearly',
    'com.parleyapp.premium_lifetime',
    'com.parleyapp.pro:proweekly1',
    'com.parleyapp.pro:promonthy',
    'com.parleyapp.pro:proyearly',
    'com.parleyapp.prodaypass', // day pass, we'll skip below
    // Stripe products (if any)
    'prod_SntVCPbLpTUopK', // Monthly Pro (Stripe)
    'prod_SntY5QNcfRieKy', // Weekly Pro (Stripe)
    'prod_SntZxhho7WaBPE', // Yearly Pro (Stripe)
    'prod_SntkjlxuVOIhSX', // Lifetime Pro (Stripe)
  ]);

  const eliteProducts = new Set([
    'com.parleyapp.allstarweekly',
    'com.parleyapp.allstarmonthly',
    'com.parleyapp.allstaryearly',
    'com.parleyapp.elitedaypass', // day pass, we'll skip below
    'com.parleyapp.elite:eliteweekly',
    'com.parleyapp.elite:monthlyelite',
    'com.parleyapp.elite:yearly',
    // Stripe products (if any)
    'prod_Sntg5FMrsqzK0o', // Monthly Elite (Stripe)
    'prod_Snti3YqrYpAOS7', // Yearly Elite (Stripe)
  ]);

  if (eliteProducts.has(productId)) return 'elite';
  if (proProducts.has(productId)) return 'pro';

  // Fallback: heuristic
  if (/allstar|elite/i.test(productId)) return 'elite';
  if (/premium|pro/i.test(productId)) return 'pro';

  return null;
}

function isDayPass(productId: string | null | undefined): boolean {
  if (!productId) return false;
  return /daypass/i.test(productId);
}

function hasFutureEntitlement(eventData: any): boolean {
  try {
    const ents = eventData?.entitlements;
    if (!ents || typeof ents !== 'object') return false;
    const now = Date.now();
    for (const key of Object.keys(ents)) {
      const exp = ents[key]?.expires_date ? Date.parse(ents[key].expires_date) : null;
      if (exp && exp > now) return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log(`\nFix RevenueCat CANCELLATION downgrades — ${dryRun ? 'DRY RUN' : 'APPLY'}\n`);

  // Fetch recent CANCELLATION events in pages
  const pageSize = 500;
  let page = 0;
  const latestByCustomer: Record<string, any> = {};

  // We'll page over most recent 5000 events (adjust if needed)
  while (page < 10) {
    const { data, error } = await supabaseAdmin
      .from('revenuecat_webhook_events')
      .select('*')
      .eq('event_type', 'CANCELLATION')
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    if (error) {
      console.error('Error fetching CANCELLATION events:', error);
      break;
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      const rcId: string | null = row.revenuecat_customer_id;
      if (!rcId) continue;
      if (!latestByCustomer[rcId]) {
        latestByCustomer[rcId] = row;
      }
    }

    page += 1;
  }

  const nowMs = Date.now();
  const candidates = Object.values(latestByCustomer) as any[];
  console.log(`Found ${candidates.length} latest CANCELLATION candidates.`);

  let toUpdate: {
    profileId: string;
    rcId: string;
    currentTier: string | null;
    newTier: 'pro' | 'elite' | null;
    productId: string | null;
  }[] = [];

  // For each candidate, load profile and decide
  for (const ev of candidates) {
    const rcId = ev.revenuecat_customer_id as string;
    const eventData = ev.event_data as any;
    const productId: string | null = eventData?.product_id ?? null;

    const expirationAtMs = Number(eventData?.expiration_at_ms ?? 0);
    const isFuture = (expirationAtMs > nowMs) || hasFutureEntitlement(eventData);

    if (!isFuture) continue; // nothing to restore
    if (isDayPass(productId)) continue; // skip day passes

    const { data: profile, error: pErr } = await supabaseAdmin
      .from('profiles')
      .select('id, subscription_tier, subscription_status, revenuecat_customer_id')
      .eq('revenuecat_customer_id', rcId)
      .single();

    if (pErr || !profile) continue;

    const needsRestore = (profile.subscription_tier === 'free') || ['expired', 'inactive'].includes(profile.subscription_status);
    if (!needsRestore) continue;

    const newTier = getProductTier(productId);
    if (!newTier) continue; // unknown product mapping — skip

    toUpdate.push({
      profileId: profile.id,
      rcId,
      currentTier: profile.subscription_tier,
      newTier,
      productId,
    });
  }

  console.log(`Impacted profiles to restore: ${toUpdate.length}`);
  for (const u of toUpdate) {
    console.log(` - ${u.profileId} (${u.rcId}) => tier: ${u.currentTier} -> ${u.newTier}, product: ${u.productId}`);
  }

  if (dryRun) {
    console.log('\nDry run complete. No changes applied.');
    return;
  }

  let success = 0;
  for (const u of toUpdate) {
    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .update({
        subscription_status: 'cancelled',
        subscription_tier: u.newTier,
        subscription_product_id: u.productId,
        last_revenuecat_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', u.profileId);

    if (upErr) {
      console.error(`Failed to update ${u.profileId}:`, upErr);
    } else {
      success += 1;
    }
  }

  console.log(`\nApplied ${success}/${toUpdate.length} updates.`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});

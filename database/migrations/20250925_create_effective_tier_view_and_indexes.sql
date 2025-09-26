-- Effective tier view: temporary overlay > base entitlement > free
create or replace view public.v_profiles_effective_tier as
select
  p.id,
  case
    when coalesce(p.temporary_tier_active, false) is true
         and p.temporary_tier_expires_at is not null
         and p.temporary_tier_expires_at > now()
      then p.temporary_tier
    when p.base_subscription_tier is not null
         and (p.subscription_status in ('active','grace_period') or p.subscription_status is null)
      then p.base_subscription_tier
    else 'free'
  end as effective_tier,
  case
    when coalesce(p.temporary_tier_active, false) is true
         and p.temporary_tier_expires_at is not null
         and p.temporary_tier_expires_at > now()
      then p.temporary_tier_expires_at
    else null
  end as effective_tier_expires_at,
  p.base_subscription_tier,
  p.subscription_status,
  p.temporary_tier,
  p.temporary_tier_expires_at,
  p.revenuecat_customer_id,
  p.subscription_product_id,
  p.subscription_plan_type,
  p.auto_renew_enabled
from public.profiles p;

-- Helpful indexes
create index if not exists idx_webhook_events_processed on public.webhook_events (processed);
create index if not exists idx_webhook_events_source_processed on public.webhook_events (source, processed);
create index if not exists idx_profiles_revenuecat_customer_id on public.profiles (revenuecat_customer_id);
create index if not exists idx_profiles_temporary_tier_active_expires on public.profiles (temporary_tier_active, temporary_tier_expires_at);

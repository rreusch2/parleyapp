-- Stripe webhook audit trail
create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  created_at timestamptz default now(),
  payload jsonb not null,
  processed boolean default false,
  processed_at timestamptz,
  error text
);

-- Optional provider-specific columns for Stripe web billing
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists stripe_price_id text;
alter table public.profiles add column if not exists stripe_status text;
alter table public.profiles add column if not exists current_period_start timestamptz;
alter table public.profiles add column if not exists current_period_end timestamptz;
alter table public.profiles add column if not exists cancel_at_period_end boolean default false;
alter table public.profiles add column if not exists canceled_at timestamptz;
alter table public.profiles add column if not exists last_webhook_at timestamptz;
alter table public.profiles add column if not exists subscription_provider text default 'none';

-- Helpful index for cron/status checks
create index if not exists idx_profiles_subscription_expires_at on public.profiles (subscription_expires_at);

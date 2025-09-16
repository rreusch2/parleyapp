-- Enable required extensions
create extension if not exists pgcrypto;

-- 1) Audit table for rewarded ad grants
create table if not exists public.ad_reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ad_network text not null default 'admob',
  ad_unit_id text,
  reward_item text,
  reward_amount integer not null default 1,
  transaction_id text unique,
  ssv_signature text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'
);

create index if not exists idx_ad_reward_grants_user_created on public.ad_reward_grants(user_id, created_at desc);

-- 2) Lightweight counters on profiles for fast daily limit checks
alter table public.profiles
  add column if not exists daily_ad_rewards_used integer not null default 0,
  add column if not exists last_ad_reward_reset timestamptz,
  add column if not exists ad_timezone text;

-- Optional view to compute today's grants per user (UTC day)
create or replace view public.v_ad_reward_grants_today as
select
  user_id,
  count(*)::int as grants_today
from public.ad_reward_grants
where created_at >= date_trunc('day', now())
  and created_at < date_trunc('day', now()) + interval '1 day'
group by user_id;

-- Notes:
-- - Daily reset logic will be handled in backend based on last_ad_reward_reset timestamp (24h window)
-- - For more precise resets by timezone, backend can compute start/end using profiles.ad_timezone
-- - SSV (server-side verification) endpoint will upsert rows into ad_reward_grants with transaction_id

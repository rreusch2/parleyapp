-- Migration: Create trigger to reset welcome bonus on paid subscription
-- Purpose: Ensure welcome bonus is cleared immediately when a user becomes a paid, active subscriber (pro/elite and variants)
-- Date: 2025-08-29

-- 1) Function: reset_welcome_bonus_on_paid_subscription
CREATE OR REPLACE FUNCTION public.reset_welcome_bonus_on_paid_subscription()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If subscription is paid and active, clear welcome bonus flags
  IF NEW.subscription_status = 'active'
     AND (
       NEW.subscription_tier IN ('pro', 'elite')
       OR NEW.subscription_tier LIKE 'pro_%'
       OR NEW.subscription_tier LIKE 'elite_%'
     ) THEN
    NEW.welcome_bonus_claimed := false;
    NEW.welcome_bonus_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Trigger: fire on insert or when tier/status change
DROP TRIGGER IF EXISTS trg_reset_welcome_bonus_on_paid_subscription ON public.profiles;
CREATE TRIGGER trg_reset_welcome_bonus_on_paid_subscription
BEFORE INSERT OR UPDATE OF subscription_tier, subscription_status
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.reset_welcome_bonus_on_paid_subscription();

-- 3) One-time backfill: clear welcome bonus for any currently active paid users
UPDATE public.profiles
SET welcome_bonus_claimed = false,
    welcome_bonus_expires_at = NULL,
    updated_at = NOW()
WHERE subscription_status = 'active'
  AND (
    subscription_tier IN ('pro', 'elite')
    OR subscription_tier LIKE 'pro_%'
    OR subscription_tier LIKE 'elite_%'
  );

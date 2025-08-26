-- Migration: Fix Welcome Bonus + Subscription Tier Conflicts
-- Purpose: Clear welcome bonus for users who have active paid subscriptions
-- Date: 2025-08-26

-- Fix existing users with paid subscriptions who still have welcome bonus active
-- This prevents welcome bonus from overriding paid subscription benefits
UPDATE profiles 
SET 
  welcome_bonus_claimed = false,
  welcome_bonus_expires_at = null,
  updated_at = NOW()
WHERE 
  subscription_tier IN ('pro', 'elite') 
  AND subscription_status = 'active'
  AND welcome_bonus_claimed = true
  AND (subscription_expires_at IS NULL OR subscription_expires_at > NOW());

-- Also clear welcome bonus for expired subscriptions to prevent future conflicts
UPDATE profiles 
SET 
  welcome_bonus_claimed = false,
  welcome_bonus_expires_at = null,
  subscription_tier = 'free',
  subscription_status = 'inactive',
  updated_at = NOW()
WHERE 
  subscription_tier IN ('pro', 'elite') 
  AND welcome_bonus_claimed = true
  AND subscription_expires_at IS NOT NULL 
  AND subscription_expires_at < NOW();

-- Report on the fixes applied
SELECT 
  'Active Paid Subscriptions - Welcome Bonus Cleared' as fix_type,
  COUNT(*) as users_fixed
FROM profiles 
WHERE 
  subscription_tier IN ('pro', 'elite') 
  AND subscription_status = 'active'
  AND welcome_bonus_claimed = false
  AND (subscription_expires_at IS NULL OR subscription_expires_at > NOW())

UNION ALL

SELECT 
  'Expired Subscriptions - Downgraded to Free' as fix_type,
  COUNT(*) as users_fixed
FROM profiles 
WHERE 
  subscription_tier = 'free'
  AND subscription_status = 'inactive'
  AND welcome_bonus_claimed = false;

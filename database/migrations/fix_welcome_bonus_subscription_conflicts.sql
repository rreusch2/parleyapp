-- Migration: Fix users with conflicting subscription status and welcome bonus flags
-- Issue: Users have subscription_tier='pro' but welcome_bonus_claimed=true and subscription_status='inactive'
-- This causes UI confusion where they appear as paid users but frontend shows free UI

-- Step 1: Fix users who have paid subscriptions (with product_id) but still have welcome bonus flags
UPDATE profiles 
SET 
  welcome_bonus_claimed = false,
  welcome_bonus_expires_at = null,
  subscription_status = 'active',  -- These users should be active since they have product_id
  updated_at = NOW()
WHERE 
  subscription_tier IN ('pro', 'elite') 
  AND welcome_bonus_claimed = true
  AND subscription_product_id IS NOT NULL;

-- Step 2: Fix users who have pro/elite tier but no product_id (likely test/invalid subscriptions)
UPDATE profiles 
SET 
  welcome_bonus_claimed = false,
  welcome_bonus_expires_at = null,
  subscription_status = 'inactive',  -- These should be inactive since no product_id
  updated_at = NOW()
WHERE 
  subscription_tier IN ('pro', 'elite') 
  AND welcome_bonus_claimed = true
  AND subscription_product_id IS NULL;

-- Step 3: Verify the fixes - show count of users that were fixed
SELECT 
  'Users with conflicting subscription/welcome bonus status fixed' as message,
  COUNT(*) as total_fixed_users
FROM profiles 
WHERE 
  subscription_tier IN ('pro', 'elite') 
  AND welcome_bonus_claimed = false 
  AND welcome_bonus_expires_at IS NULL;

-- Step 4: Show remaining conflicts (should be 0)
SELECT 
  'Remaining conflicts after migration' as message,
  COUNT(*) as remaining_conflicts,
  subscription_tier,
  subscription_status,
  subscription_product_id IS NOT NULL as has_product_id
FROM profiles 
WHERE 
  subscription_tier IN ('pro', 'elite') 
  AND welcome_bonus_claimed = true
GROUP BY subscription_tier, subscription_status, (subscription_product_id IS NOT NULL);

-- Migration: Fix Day Pass Users and Implement Automatic Expiration
-- Date: 2025-08-28
-- Purpose: Fix existing day pass users who don't have proper expiration and implement cleanup

-- Step 1: Fix existing day pass users who have the correct product ID but wrong plan type
UPDATE profiles 
SET 
  subscription_plan_type = 'daypass',
  subscription_expires_at = CASE 
    WHEN subscription_expires_at IS NULL THEN (updated_at + INTERVAL '24 hours')
    ELSE subscription_expires_at
  END,
  updated_at = NOW()
WHERE subscription_product_id = 'com.parleyapp.prodaypass'
  AND (subscription_plan_type IS NULL OR subscription_plan_type != 'daypass');

-- Step 2: Fix users who have 'weekly' plan type but prodaypass product (data inconsistency)
UPDATE profiles 
SET 
  subscription_plan_type = 'daypass',
  subscription_expires_at = CASE 
    WHEN subscription_expires_at IS NULL THEN (updated_at + INTERVAL '24 hours')
    ELSE subscription_expires_at
  END,
  updated_at = NOW()
WHERE subscription_product_id = 'com.parleyapp.prodaypass'
  AND subscription_plan_type = 'weekly';

-- Step 3: Downgrade expired day pass users to free (immediate cleanup)
UPDATE profiles 
SET 
  subscription_tier = 'free',
  subscription_status = 'expired',
  updated_at = NOW()
WHERE subscription_product_id = 'com.parleyapp.prodaypass'
  AND subscription_expires_at < NOW()
  AND subscription_tier = 'pro';

-- Step 4: Show results for verification
SELECT 
  id,
  subscription_tier,
  subscription_plan_type,
  subscription_product_id,
  subscription_expires_at,
  CASE 
    WHEN subscription_expires_at > NOW() THEN 'Active'
    WHEN subscription_expires_at < NOW() THEN 'Expired'
    ELSE 'No Expiration Set'
  END as status
FROM profiles 
WHERE subscription_product_id = 'com.parleyapp.prodaypass'
ORDER BY subscription_expires_at DESC;

-- Step 5: Create index for better performance on expiration checks
CREATE INDEX IF NOT EXISTS idx_profiles_expiration_cleanup 
ON profiles (subscription_expires_at, subscription_tier) 
WHERE subscription_expires_at IS NOT NULL;

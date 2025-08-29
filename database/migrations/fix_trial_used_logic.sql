-- Migration: Fix trial_used logic 
-- Purpose: Reset trial_used to false for users who shouldn't have it marked as true
-- Date: 2025-08-29

-- Reset trial_used to false for all users except those with monthly subscription plan
UPDATE profiles 
SET trial_used = false,
    updated_at = NOW()
WHERE trial_used = true 
  AND (subscription_plan_type IS NULL OR subscription_plan_type != 'monthly');

-- Report on users who had trial_used corrected
SELECT 
  'Trial Used Flag Corrected' as fix_type,
  COUNT(*) as users_fixed
FROM profiles 
WHERE trial_used = false
  AND updated_at >= NOW() - INTERVAL '5 minutes';

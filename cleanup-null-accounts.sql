-- Clean up existing NULL accounts created before trigger fix
-- These are unusable ghost accounts that serve no purpose

-- First, let's see what we're about to delete (verification query)
SELECT 
    id,
    username,
    email,
    created_at,
    subscription_tier,
    phone_verified,
    revenuecat_customer_id
FROM profiles 
WHERE username IS NULL 
  AND email IS NULL
  AND phone_verified = false
  AND revenuecat_customer_id IS NULL
ORDER BY created_at DESC;

-- Safe cleanup: Delete NULL accounts that are clearly unusable
-- Only deleting accounts with ALL these criteria to be extra safe:
-- 1. Username is NULL
-- 2. Email is NULL  
-- 3. Phone not verified
-- 4. No RevenueCat customer ID (not paying customers)
-- 5. No subscription active

DELETE FROM profiles 
WHERE username IS NULL 
  AND email IS NULL
  AND phone_verified = false
  AND revenuecat_customer_id IS NULL
  AND subscription_tier = 'free'
  AND subscription_status IN ('inactive', 'cancelled')
  AND welcome_bonus_claimed = false;

-- Check for database issues that could cause app crashes

-- 1. Check for users with NULL or missing welcome bonus fields
SELECT 
    COUNT(*) as users_with_null_welcome_bonus,
    COUNT(CASE WHEN welcome_bonus_claimed IS NULL THEN 1 END) as null_claimed,
    COUNT(CASE WHEN welcome_bonus_expires_at IS NULL AND welcome_bonus_claimed = true THEN 1 END) as claimed_but_no_expiry
FROM profiles;

-- 2. Check for users with missing or corrupt profile data
SELECT 
    id,
    email,
    subscription_tier,
    welcome_bonus_claimed,
    welcome_bonus_expires_at,
    created_at
FROM profiles
WHERE 
    subscription_tier IS NULL 
    OR email IS NULL
    OR (welcome_bonus_claimed = true AND welcome_bonus_expires_at IS NULL)
    OR created_at IS NULL
LIMIT 20;

-- 3. Check for invalid subscription tiers
SELECT 
    subscription_tier,
    COUNT(*) as count
FROM profiles
GROUP BY subscription_tier;

-- 4. Check for users created recently (potential signup issues)
SELECT 
    id,
    email,
    subscription_tier,
    welcome_bonus_claimed,
    welcome_bonus_expires_at,
    created_at
FROM profiles
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 5. Check for missing AI predictions data
SELECT 
    COUNT(*) as total_predictions,
    COUNT(CASE WHEN pick IS NULL THEN 1 END) as null_picks,
    COUNT(CASE WHEN odds IS NULL THEN 1 END) as null_odds,
    COUNT(CASE WHEN confidence IS NULL THEN 1 END) as null_confidence,
    COUNT(CASE WHEN bet_type IS NULL THEN 1 END) as null_bet_type
FROM ai_predictions
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 6. Check for corrupted AI predictions
SELECT 
    id,
    pick,
    odds,
    confidence,
    bet_type,
    created_at
FROM ai_predictions
WHERE 
    pick IS NULL 
    OR odds IS NULL 
    OR confidence IS NULL 
    OR bet_type IS NULL
    OR pick = ''
    OR odds = ''
ORDER BY created_at DESC
LIMIT 20;

-- 7. Check for users with expired welcome bonuses that might not be handled properly
SELECT 
    id,
    email,
    subscription_tier,
    welcome_bonus_claimed,
    welcome_bonus_expires_at,
    NOW() > welcome_bonus_expires_at as is_expired
FROM profiles
WHERE 
    welcome_bonus_claimed = true 
    AND welcome_bonus_expires_at IS NOT NULL
    AND NOW() > welcome_bonus_expires_at
    AND subscription_tier = 'free'
LIMIT 20;

-- 8. Fix immediate issues: Set NULL welcome bonus fields to safe defaults
-- UNCOMMMENT TO RUN:
-- UPDATE profiles
-- SET 
--     welcome_bonus_claimed = COALESCE(welcome_bonus_claimed, false),
--     welcome_bonus_expires_at = CASE 
--         WHEN welcome_bonus_claimed = true AND welcome_bonus_expires_at IS NULL 
--         THEN created_at + INTERVAL '24 hours'
--         ELSE welcome_bonus_expires_at
--     END
-- WHERE welcome_bonus_claimed IS NULL OR (welcome_bonus_claimed = true AND welcome_bonus_expires_at IS NULL);

-- 9. Fix missing subscription tiers
-- UNCOMMMENT TO RUN:
-- UPDATE profiles
-- SET subscription_tier = 'free'
-- WHERE subscription_tier IS NULL;
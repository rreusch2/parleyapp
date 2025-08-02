-- Diagnostic queries to find the root cause of free user crashes

-- 1. Check free users with potential issues
SELECT 
    p.id,
    p.email,
    p.subscription_tier,
    p.welcome_bonus_claimed,
    p.welcome_bonus_expires_at,
    p.created_at,
    CASE 
        WHEN p.welcome_bonus_claimed = true AND p.welcome_bonus_expires_at > NOW() 
        THEN 'Welcome Bonus Active'
        WHEN p.subscription_tier = 'free' 
        THEN 'Free User'
        ELSE p.subscription_tier
    END as effective_tier,
    COUNT(DISTINCT ap.id) as total_predictions
FROM profiles p
LEFT JOIN ai_predictions ap ON ap.user_id = p.id
WHERE p.subscription_tier = 'free' OR p.subscription_tier IS NULL
GROUP BY p.id, p.email, p.subscription_tier, p.welcome_bonus_claimed, p.welcome_bonus_expires_at, p.created_at
ORDER BY p.created_at DESC
LIMIT 20;

-- 2. Check for NULL values in critical fields
SELECT 
    'Profiles with NULL subscription_tier' as issue,
    COUNT(*) as count
FROM profiles
WHERE subscription_tier IS NULL
UNION ALL
SELECT 
    'Profiles with NULL welcome_bonus_claimed' as issue,
    COUNT(*) as count
FROM profiles
WHERE welcome_bonus_claimed IS NULL
UNION ALL
SELECT 
    'AI Predictions with NULL critical fields' as issue,
    COUNT(*) as count
FROM ai_predictions
WHERE pick IS NULL OR odds IS NULL OR match_teams IS NULL OR match_teams = '';

-- 3. Check recent AI predictions for free users
SELECT 
    ap.id,
    ap.user_id,
    p.subscription_tier,
    p.welcome_bonus_claimed,
    p.welcome_bonus_expires_at,
    ap.pick,
    ap.odds,
    ap.match_teams,
    ap.bet_type,
    ap.created_at
FROM ai_predictions ap
JOIN profiles p ON p.id = ap.user_id
WHERE p.subscription_tier = 'free' 
   OR (p.welcome_bonus_claimed = true AND p.welcome_bonus_expires_at > NOW())
ORDER BY ap.created_at DESC
LIMIT 20;

-- 4. Check pick counts per user in last 24 hours
SELECT 
    p.email,
    p.subscription_tier,
    p.welcome_bonus_claimed,
    p.welcome_bonus_expires_at,
    COUNT(ap.id) as picks_last_24h,
    COUNT(CASE WHEN ap.bet_type = 'team' THEN 1 END) as team_picks,
    COUNT(CASE WHEN ap.bet_type = 'player_prop' THEN 1 END) as prop_picks
FROM profiles p
LEFT JOIN ai_predictions ap ON ap.user_id = p.id 
    AND ap.created_at >= NOW() - INTERVAL '24 hours'
WHERE p.subscription_tier = 'free' OR p.subscription_tier IS NULL
GROUP BY p.id, p.email, p.subscription_tier, p.welcome_bonus_claimed, p.welcome_bonus_expires_at
HAVING COUNT(ap.id) > 0
ORDER BY picks_last_24h DESC;

-- 5. Check for users created recently (potential crash on signup)
SELECT 
    id,
    email,
    subscription_tier,
    welcome_bonus_claimed,
    welcome_bonus_expires_at,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_since_creation
FROM profiles
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;
-- Fix database issues that are causing app crashes

BEGIN;

-- 1. Fix users with NULL welcome bonus fields
UPDATE profiles
SET 
    welcome_bonus_claimed = COALESCE(welcome_bonus_claimed, false),
    welcome_bonus_expires_at = CASE 
        WHEN welcome_bonus_claimed = true AND welcome_bonus_expires_at IS NULL 
        THEN created_at + INTERVAL '24 hours'
        ELSE welcome_bonus_expires_at
    END
WHERE welcome_bonus_claimed IS NULL 
   OR (welcome_bonus_claimed = true AND welcome_bonus_expires_at IS NULL);

-- 2. Fix missing subscription tiers (default to free)
UPDATE profiles
SET subscription_tier = 'free'
WHERE subscription_tier IS NULL OR subscription_tier = '';

-- 3. Fix any corrupted AI predictions with NULL values
UPDATE ai_predictions
SET 
    pick = COALESCE(pick, 'Pick unavailable'),
    odds = COALESCE(odds, 'N/A'),
    confidence = COALESCE(confidence, 0),
    bet_type = COALESCE(bet_type, 'unknown'),
    sport = COALESCE(sport, 'MLB'),
    match_teams = CASE 
        WHEN match_teams IS NULL OR match_teams = '' 
        THEN 'Unknown vs Unknown'
        ELSE match_teams
    END
WHERE pick IS NULL 
   OR odds IS NULL 
   OR confidence IS NULL 
   OR bet_type IS NULL
   OR pick = ''
   OR odds = '';

-- 4. Fix expired welcome bonuses that should be deactivated
UPDATE profiles
SET 
    welcome_bonus_claimed = false,
    welcome_bonus_expires_at = NULL
WHERE welcome_bonus_claimed = true 
  AND welcome_bonus_expires_at IS NOT NULL
  AND NOW() > welcome_bonus_expires_at + INTERVAL '1 day'; -- Give 1 day grace period

-- 5. Ensure all profiles have required fields
UPDATE profiles
SET 
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL;

-- 6. Add default values for any missing user preferences
INSERT INTO user_preferences (user_id, risk_tolerance, sports, bet_types, notification_preferences)
SELECT 
    p.id,
    'medium',
    ARRAY['MLB'],
    ARRAY['moneyline', 'spread', 'total'],
    '{"types": ["ai_picks"], "frequency": "daily"}'::jsonb
FROM profiles p
LEFT JOIN user_preferences up ON p.id = up.user_id
WHERE up.user_id IS NULL;

-- 7. Log the fixes applied
DO $$
DECLARE
    fixed_profiles INTEGER;
    fixed_predictions INTEGER;
BEGIN
    SELECT COUNT(*) INTO fixed_profiles 
    FROM profiles 
    WHERE welcome_bonus_claimed = false 
      AND updated_at > NOW() - INTERVAL '1 minute';
    
    SELECT COUNT(*) INTO fixed_predictions 
    FROM ai_predictions 
    WHERE updated_at > NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Fixed % profiles and % predictions', fixed_profiles, fixed_predictions;
END $$;

COMMIT;

-- Verify the fixes
SELECT 
    'Profiles with issues' as check_type,
    COUNT(*) as count
FROM profiles
WHERE subscription_tier IS NULL 
   OR (welcome_bonus_claimed = true AND welcome_bonus_expires_at IS NULL)
UNION ALL
SELECT 
    'Predictions with NULL values' as check_type,
    COUNT(*) as count
FROM ai_predictions
WHERE pick IS NULL OR odds IS NULL OR confidence IS NULL;
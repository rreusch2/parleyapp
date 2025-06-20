-- Step 1: Check what users exist in your auth.users table
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Step 2: If you see users, copy one of the IDs and use it instead
-- For example, if you see a user with ID like 'a1b2c3d4-e5f6-7890-abcd-1234567890ab'
-- Then update your profile insert to use that real ID:

-- INSERT INTO public.profiles (
--   id, 
--   username, 
--   email, 
--   risk_tolerance, 
--   favorite_teams, 
--   favorite_players, 
--   preferred_bet_types, 
--   preferred_sports, 
--   preferred_bookmakers
-- ) VALUES (
--   'REPLACE_WITH_REAL_USER_ID_FROM_ABOVE_QUERY',
--   'test_user',
--   'test@parleyapp.com',
--   'medium',
--   '{"Lakers", "Cowboys", "Yankees"}',
--   '{"LeBron James", "Dak Prescott", "Aaron Judge"}',
--   '{"moneyline", "spread", "total"}',
--   '{"NBA", "NFL", "MLB"}',
--   '{"DraftKings", "FanDuel"}'
-- )
-- ON CONFLICT (id) DO UPDATE SET
--   username = EXCLUDED.username; 
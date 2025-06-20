-- Create test user in auth.users table first
-- Note: This should ideally be done through Supabase Auth API, but for testing we can insert directly

-- First, let's check if we have any existing users we can use
-- SELECT id, email FROM auth.users LIMIT 5;

-- If no users exist, we'll need to either:
-- 1. Sign up through your app frontend
-- 2. Use Supabase dashboard to create a user
-- 3. Or temporarily remove the foreign key constraint for testing

-- Option 3: Temporarily remove foreign key constraint for testing
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Now insert our test profile
INSERT INTO public.profiles (
  id, 
  username, 
  email, 
  risk_tolerance, 
  favorite_teams, 
  favorite_players, 
  preferred_bet_types, 
  preferred_sports, 
  preferred_bookmakers
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test_user',
  'test@parleyapp.com',
  'medium',
  '{"Lakers", "Cowboys", "Yankees"}',
  '{"LeBron James", "Dak Prescott", "Aaron Judge"}',
  '{"moneyline", "spread", "total"}',
  '{"NBA", "NFL", "MLB"}',
  '{"DraftKings", "FanDuel"}'
)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  risk_tolerance = EXCLUDED.risk_tolerance,
  favorite_teams = EXCLUDED.favorite_teams,
  favorite_players = EXCLUDED.favorite_players,
  preferred_bet_types = EXCLUDED.preferred_bet_types,
  preferred_sports = EXCLUDED.preferred_sports,
  preferred_bookmakers = EXCLUDED.preferred_bookmakers;

-- Re-add the foreign key constraint (optional, can skip for testing)
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey 
-- FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; 
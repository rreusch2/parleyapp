-- Create test user profile for development
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
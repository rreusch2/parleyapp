-- Grant all permissions to the service_role on the sports_events table
-- This allows the backend service to bypass row-level security policies
ALTER TABLE public.sports_events ENABLE ROW LEVEL SECURITY;

-- Allow the service_role to perform all actions on the sports_events table
-- This is necessary for the backend scripts to insert and update game data
CREATE POLICY "Allow all for service_role"
ON public.sports_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Grant all permissions to the service_role on the odds_data table
ALTER TABLE public.odds_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service_role on odds_data"
ON public.odds_data
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Grant all permissions to the service_role on the player_props_odds table
ALTER TABLE public.player_props_odds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service_role on player_props_odds"
ON public.player_props_odds
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

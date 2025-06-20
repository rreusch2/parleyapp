-- Add user preference columns to existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS risk_tolerance TEXT DEFAULT 'medium' CHECK (risk_tolerance IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS favorite_teams TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS favorite_players TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_bet_types TEXT[] DEFAULT '{moneyline,spread,total}',
ADD COLUMN IF NOT EXISTS preferred_sports TEXT[] DEFAULT '{NBA,NFL}',
ADD COLUMN IF NOT EXISTS preferred_bookmakers TEXT[] DEFAULT '{}';

-- Update any existing users to have default preferences if they don't have them
UPDATE public.profiles 
SET 
    risk_tolerance = COALESCE(risk_tolerance, 'medium'),
    favorite_teams = COALESCE(favorite_teams, '{}'),
    favorite_players = COALESCE(favorite_players, '{}'),
    preferred_bet_types = COALESCE(preferred_bet_types, '{moneyline,spread,total}'),
    preferred_sports = COALESCE(preferred_sports, '{NBA,NFL}'),
    preferred_bookmakers = COALESCE(preferred_bookmakers, '{}')
WHERE risk_tolerance IS NULL 
   OR favorite_teams IS NULL 
   OR favorite_players IS NULL 
   OR preferred_bet_types IS NULL 
   OR preferred_sports IS NULL 
   OR preferred_bookmakers IS NULL; 
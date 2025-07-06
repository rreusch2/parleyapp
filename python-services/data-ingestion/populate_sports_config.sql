-- Predictive Play: Populate sports_config table for The Odds API integration
-- Run this in your Supabase SQL editor

-- First, insert the sports we're tracking
INSERT INTO sports_config (sport_key, sport_name, display_name, is_active, api_endpoint, icon, color, display_order)
VALUES 
    ('NFL', 'americanfootball_nfl', 'NFL Football', true, 'americanfootball_nfl', '🏈', '#013369', 1),
    ('NBA', 'basketball_nba', 'NBA Basketball', true, 'basketball_nba', '🏀', '#C9082A', 2),
    ('MLB', 'baseball_mlb', 'MLB Baseball', true, 'baseball_mlb', '⚾', '#003831', 3),
    ('NHL', 'icehockey_nhl', 'NHL Hockey', true, 'icehockey_nhl', '🏒', '#111111', 4),
    ('NCAAF', 'americanfootball_ncaaf', 'NCAA Football', true, 'americanfootball_ncaaf', '🏈', '#FFC72C', 5),
    ('NCAAB', 'basketball_ncaab', 'NCAA Basketball', true, 'basketball_ncaab', '🏀', '#FF6900', 6)
ON CONFLICT (sport_key) DO UPDATE SET
    sport_name = EXCLUDED.sport_name,
    display_name = EXCLUDED.display_name,
    api_endpoint = EXCLUDED.api_endpoint,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- If sports_config table doesn't exist, create it first
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'sports_config') THEN
        CREATE TABLE sports_config (
            sport_key VARCHAR(50) PRIMARY KEY,
            sport_name VARCHAR(100) NOT NULL,
            display_name VARCHAR(100) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            api_endpoint VARCHAR(255),
            icon VARCHAR(10),
            color VARCHAR(7),
            display_order INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Check if we need to create missing tables for complete data ingestion
-- Create player_props table if it doesn't exist
CREATE TABLE IF NOT EXISTS player_props (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES sports_events(id) ON DELETE CASCADE,
    player_name VARCHAR(255) NOT NULL,
    prop_type VARCHAR(50) NOT NULL,
    line FLOAT,
    over_odds FLOAT,
    under_odds FLOAT,
    bookmaker VARCHAR(100),
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, player_name, prop_type, bookmaker)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_player_props_event ON player_props(event_id);
CREATE INDEX IF NOT EXISTS idx_player_props_player ON player_props(player_name);

-- Verify the setup
SELECT 
    sport_key,
    display_name,
    is_active,
    icon
FROM sports_config
ORDER BY display_order; 
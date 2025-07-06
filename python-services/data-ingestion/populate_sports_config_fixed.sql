-- Predictive Play: Populate sports_config table for The Odds API integration
-- This script works with the existing table structure

-- First, let's check what columns exist in sports_config
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sports_config'
ORDER BY ordinal_position;

-- Insert the sports we're tracking (using only existing columns)
-- We'll use sport_name as the display name since display_name doesn't exist
INSERT INTO sports_config (sport_key, sport_name, is_active)
VALUES 
    ('NFL', 'NFL Football', true),
    ('NBA', 'NBA Basketball', true),
    ('MLB', 'MLB Baseball', true),
    ('NHL', 'NHL Hockey', true),
    ('NCAAF', 'NCAA Football', true),
    ('NCAAB', 'NCAA Basketball', true)
ON CONFLICT (sport_key) DO UPDATE SET
    sport_name = EXCLUDED.sport_name,
    is_active = EXCLUDED.is_active;

-- Let's also make sure player_props table exists
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'player_props_unique_constraint'
    ) THEN
        ALTER TABLE player_props 
        ADD CONSTRAINT player_props_unique_constraint 
        UNIQUE(event_id, player_name, prop_type, bookmaker);
    END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_player_props_event ON player_props(event_id);
CREATE INDEX IF NOT EXISTS idx_player_props_player ON player_props(player_name);

-- Verify the setup
SELECT 
    sport_key,
    sport_name,
    is_active
FROM sports_config
ORDER BY sport_key;

-- Check if we have the necessary tables
SELECT 
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('sports_config', 'sports_events', 'player_props', 'odds_data')
GROUP BY table_name
ORDER BY table_name; 
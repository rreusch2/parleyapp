-- ParleyApp Phase 1 Migration - STEP 2: Teams and Sports Events
-- Run this after step 1

-- Create teams table (depends on sports_config from step 1)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    team_key VARCHAR(100) UNIQUE NOT NULL,
    team_name VARCHAR(200) NOT NULL,
    team_abbreviation VARCHAR(10),
    city VARCHAR(100),
    conference VARCHAR(50),
    division VARCHAR(50),
    logo_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update existing sports_events table
DO $$
BEGIN
    -- Add new columns if they don't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sports_events') THEN
        -- Add columns one by one
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'external_event_id') THEN
            ALTER TABLE sports_events ADD COLUMN external_event_id VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'sport_key') THEN
            ALTER TABLE sports_events ADD COLUMN sport_key VARCHAR(50);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'home_team_id') THEN
            ALTER TABLE sports_events ADD COLUMN home_team_id UUID;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'away_team_id') THEN
            ALTER TABLE sports_events ADD COLUMN away_team_id UUID;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'venue') THEN
            ALTER TABLE sports_events ADD COLUMN venue VARCHAR(200);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'venue_city') THEN
            ALTER TABLE sports_events ADD COLUMN venue_city VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'weather_conditions') THEN
            ALTER TABLE sports_events ADD COLUMN weather_conditions JSONB DEFAULT '{}';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'period_scores') THEN
            ALTER TABLE sports_events ADD COLUMN period_scores JSONB DEFAULT '[]';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'final_home_score') THEN
            ALTER TABLE sports_events ADD COLUMN final_home_score INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'final_away_score') THEN
            ALTER TABLE sports_events ADD COLUMN final_away_score INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'attendance') THEN
            ALTER TABLE sports_events ADD COLUMN attendance INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'broadcast_info') THEN
            ALTER TABLE sports_events ADD COLUMN broadcast_info JSONB DEFAULT '[]';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'metadata') THEN
            ALTER TABLE sports_events ADD COLUMN metadata JSONB DEFAULT '{}';
        END IF;
        
        -- Update sport_key from sport column
        UPDATE sports_events 
        SET sport_key = CASE 
            WHEN sport = 'NFL' THEN 'americanfootball_nfl'
            WHEN sport = 'NBA' THEN 'basketball_nba'
            WHEN sport = 'MLB' THEN 'baseball_mlb'
            WHEN sport = 'NHL' THEN 'icehockey_nhl'
            ELSE LOWER(sport)
        END
        WHERE sport_key IS NULL AND sport IS NOT NULL;
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Step 2 completed successfully! Run step 3 next.';
END $$; 
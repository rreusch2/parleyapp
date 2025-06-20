-- ParleyApp Phase 1 Migration - STEP 3: Remaining Tables and Constraints
-- Run this after steps 1 and 2

-- First, let's verify that the teams table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
        RAISE EXCEPTION 'Teams table does not exist. Please run Step 2 first.';
    END IF;
    RAISE NOTICE 'Teams table exists, proceeding with Step 3...';
END $$;

-- Diagnostic: Show current players table structure if it exists
DO $$
DECLARE
    col_record RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players') THEN
        RAISE NOTICE 'Players table already exists. Current columns:';
        FOR col_record IN 
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'players' 
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  - %: %', col_record.column_name, col_record.data_type;
        END LOOP;
    ELSE
        RAISE NOTICE 'Players table does not exist, will create new one.';
    END IF;
END $$;

-- Create/update players table with proper columns
DO $$
BEGIN
    -- Create players table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players') THEN
        CREATE TABLE players (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            player_key VARCHAR(100) UNIQUE NOT NULL,
            player_name VARCHAR(200) NOT NULL,
            team_id UUID,
            sport_key VARCHAR(50),
            position VARCHAR(50),
            jersey_number VARCHAR(10),
            status VARCHAR(50) DEFAULT 'active',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        RAISE NOTICE 'Created new players table with all required columns';
    ELSE
        -- Table exists, ensure it has ALL required columns
        RAISE NOTICE 'Players table exists, checking/adding required columns...';
        
        -- Check and add each required column (carefully handling NOT NULL constraints)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'id') THEN
            -- For existing table, we need to be careful with PRIMARY KEY
            ALTER TABLE players ADD COLUMN id UUID DEFAULT uuid_generate_v4();
            RAISE NOTICE 'Added id column (will handle PRIMARY KEY later if needed)';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'player_key') THEN
            -- Add as nullable first, then populate and make NOT NULL
            ALTER TABLE players ADD COLUMN player_key VARCHAR(100);
            -- Generate unique keys for existing rows
            UPDATE players SET player_key = 'player_' || id::text WHERE player_key IS NULL;
            -- Now make it NOT NULL and UNIQUE
            ALTER TABLE players ALTER COLUMN player_key SET NOT NULL;
            ALTER TABLE players ADD CONSTRAINT players_player_key_unique UNIQUE (player_key);
            RAISE NOTICE 'Added player_key column with generated values';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'player_name') THEN
            -- Add as nullable first
            ALTER TABLE players ADD COLUMN player_name VARCHAR(200);
            -- Set default value for existing rows
            UPDATE players SET player_name = 'Unknown Player' WHERE player_name IS NULL;
            -- Now make it NOT NULL
            ALTER TABLE players ALTER COLUMN player_name SET NOT NULL;
            RAISE NOTICE 'Added player_name column with default values';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'team_id') THEN
            ALTER TABLE players ADD COLUMN team_id UUID;
            RAISE NOTICE 'Added team_id column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'sport_key') THEN
            ALTER TABLE players ADD COLUMN sport_key VARCHAR(50);
            RAISE NOTICE 'Added sport_key column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'position') THEN
            ALTER TABLE players ADD COLUMN position VARCHAR(50);
            RAISE NOTICE 'Added position column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'jersey_number') THEN
            ALTER TABLE players ADD COLUMN jersey_number VARCHAR(10);
            RAISE NOTICE 'Added jersey_number column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'status') THEN
            ALTER TABLE players ADD COLUMN status VARCHAR(50) DEFAULT 'active';
            RAISE NOTICE 'Added status column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'metadata') THEN
            ALTER TABLE players ADD COLUMN metadata JSONB DEFAULT '{}';
            RAISE NOTICE 'Added metadata column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'created_at') THEN
            ALTER TABLE players ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added created_at column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'updated_at') THEN
            ALTER TABLE players ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
            RAISE NOTICE 'Added updated_at column';
        END IF;
        
        RAISE NOTICE 'Finished updating players table structure';
    END IF;
END $$;

-- Now add foreign key constraints to players table
DO $$
BEGIN
    -- Add team_id foreign key constraint
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'players_team_id_fkey') THEN
        ALTER TABLE players ADD CONSTRAINT players_team_id_fkey 
            FOREIGN KEY (team_id) REFERENCES teams(id);
        RAISE NOTICE 'Added team_id foreign key constraint to players table';
    END IF;
    
    -- Add sport_key foreign key constraint
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'players_sport_key_fkey') THEN
        ALTER TABLE players ADD CONSTRAINT players_sport_key_fkey 
            FOREIGN KEY (sport_key) REFERENCES sports_config(sport_key);
        RAISE NOTICE 'Added sport_key foreign key constraint to players table';
    END IF;
END $$;

-- Add foreign key constraints to sports_events for team references
DO $$
BEGIN
    -- Add foreign key constraint for sport_key if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sports_events_sport_key_fkey') THEN
        ALTER TABLE sports_events ADD CONSTRAINT sports_events_sport_key_fkey 
            FOREIGN KEY (sport_key) REFERENCES sports_config(sport_key);
        RAISE NOTICE 'Added sport_key foreign key constraint to sports_events table';
    END IF;
    
    -- Add foreign key constraint for home_team_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sports_events_home_team_id_fkey') THEN
        ALTER TABLE sports_events ADD CONSTRAINT sports_events_home_team_id_fkey 
            FOREIGN KEY (home_team_id) REFERENCES teams(id);
        RAISE NOTICE 'Added home_team_id foreign key constraint to sports_events table';
    END IF;
    
    -- Add foreign key constraint for away_team_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sports_events_away_team_id_fkey') THEN
        ALTER TABLE sports_events ADD CONSTRAINT sports_events_away_team_id_fkey 
            FOREIGN KEY (away_team_id) REFERENCES teams(id);
        RAISE NOTICE 'Added away_team_id foreign key constraint to sports_events table';
    END IF;
END $$;

-- Create bookmakers table
CREATE TABLE IF NOT EXISTS bookmakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bookmaker_key VARCHAR(50) UNIQUE NOT NULL,
    bookmaker_name VARCHAR(100) NOT NULL,
    region VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    affiliate_link TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample bookmakers
INSERT INTO bookmakers (bookmaker_key, bookmaker_name, region) VALUES
    ('draftkings', 'DraftKings', 'US'),
    ('fanduel', 'FanDuel', 'US'),
    ('betmgm', 'BetMGM', 'US'),
    ('caesars', 'Caesars Sportsbook', 'US'),
    ('pointsbet', 'PointsBet', 'US')
ON CONFLICT (bookmaker_key) DO NOTHING;

-- Create market types table
CREATE TABLE IF NOT EXISTS market_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_key VARCHAR(100) UNIQUE NOT NULL,
    market_name VARCHAR(200) NOT NULL,
    market_category VARCHAR(50),
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert market types
INSERT INTO market_types (market_key, market_name, market_category, sport_key) VALUES
    ('h2h', 'Head to Head', 'game', NULL),
    ('spreads', 'Point Spreads', 'game', NULL),
    ('totals', 'Totals (Over/Under)', 'game', NULL),
    ('player_points', 'Player Points', 'player_prop', 'basketball_nba'),
    ('player_rebounds', 'Player Rebounds', 'player_prop', 'basketball_nba'),
    ('player_assists', 'Player Assists', 'player_prop', 'basketball_nba')
ON CONFLICT (market_key) DO NOTHING;

-- Create odds data table
CREATE TABLE IF NOT EXISTS odds_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES sports_events(id) ON DELETE CASCADE,
    bookmaker_id UUID REFERENCES bookmakers(id),
    market_type_id UUID REFERENCES market_types(id),
    outcome_name VARCHAR(200),
    outcome_price DECIMAL(10, 2),
    outcome_point DECIMAL(10, 2),
    implied_probability DECIMAL(5, 4),
    is_best_odds BOOLEAN DEFAULT false,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create player prop types table
CREATE TABLE IF NOT EXISTS player_prop_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prop_key VARCHAR(100) UNIQUE NOT NULL,
    prop_name VARCHAR(200) NOT NULL,
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    stat_category VARCHAR(50),
    unit VARCHAR(20),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert NBA player prop types
INSERT INTO player_prop_types (prop_key, prop_name, sport_key, stat_category, unit) VALUES
    ('points', 'Points', 'basketball_nba', 'scoring', 'points'),
    ('rebounds', 'Rebounds', 'basketball_nba', 'rebounding', 'rebounds'),
    ('assists', 'Assists', 'basketball_nba', 'playmaking', 'assists'),
    ('threes', 'Three Pointers Made', 'basketball_nba', 'scoring', 'threes'),
    ('blocks', 'Blocks', 'basketball_nba', 'defense', 'blocks'),
    ('steals', 'Steals', 'basketball_nba', 'defense', 'steals'),
    ('turnovers', 'Turnovers', 'basketball_nba', 'ball_handling', 'turnovers'),
    ('pra', 'Points + Rebounds + Assists', 'basketball_nba', 'combined', 'total')
ON CONFLICT (prop_key) DO NOTHING;

-- Create player props odds
CREATE TABLE IF NOT EXISTS player_props_odds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES sports_events(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id),
    prop_type_id UUID REFERENCES player_prop_types(id),
    bookmaker_id UUID REFERENCES bookmakers(id),
    line DECIMAL(10, 2) NOT NULL,
    over_odds DECIMAL(10, 2),
    under_odds DECIMAL(10, 2),
    implied_prob_over DECIMAL(5, 4),
    implied_prob_under DECIMAL(5, 4),
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create historical odds
CREATE TABLE IF NOT EXISTS historical_odds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES sports_events(id),
    bookmaker_id UUID REFERENCES bookmakers(id),
    market_type_id UUID REFERENCES market_types(id),
    opening_line JSONB NOT NULL,
    closing_line JSONB NOT NULL,
    line_movements JSONB DEFAULT '[]',
    result VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create player game stats
CREATE TABLE IF NOT EXISTS player_game_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES sports_events(id),
    player_id UUID REFERENCES players(id),
    minutes_played DECIMAL(5, 2),
    stats JSONB NOT NULL,
    fantasy_points DECIMAL(6, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, player_id)
);

-- Create player season stats
CREATE TABLE IF NOT EXISTS player_season_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id),
    season VARCHAR(20) NOT NULL,
    games_played INTEGER DEFAULT 0,
    stats_avg JSONB NOT NULL,
    stats_total JSONB NOT NULL,
    recent_form JSONB DEFAULT '{}',
    home_away_splits JSONB DEFAULT '{}',
    opponent_splits JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, season)
);

-- Create AI predictions table
CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_type VARCHAR(50) NOT NULL,
    event_id UUID REFERENCES sports_events(id),
    player_id UUID REFERENCES players(id),
    prop_type_id UUID REFERENCES player_prop_types(id),
    predicted_value DECIMAL(10, 2) NOT NULL,
    predicted_outcome VARCHAR(100),
    confidence_score DECIMAL(5, 4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    expected_value DECIMAL(10, 4),
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    features_used JSONB DEFAULT '{}',
    market_comparison JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    actual_result DECIMAL(10, 2),
    result_status VARCHAR(20)
);

-- Create model performance tracking
CREATE TABLE IF NOT EXISTS model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    prediction_type VARCHAR(50) NOT NULL,
    evaluation_period DATERANGE NOT NULL,
    total_predictions INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    accuracy DECIMAL(5, 4),
    roi DECIMAL(10, 4),
    avg_confidence DECIMAL(5, 4),
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes (with column existence checks)
DO $$
BEGIN
    -- Basic table indexes (these tables should exist)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
        CREATE INDEX IF NOT EXISTS idx_teams_sport ON teams(sport_key);
        CREATE INDEX IF NOT EXISTS idx_teams_key ON teams(team_key);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'team_id') THEN
            CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'sport_key') THEN
            CREATE INDEX IF NOT EXISTS idx_players_sport ON players(sport_key);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'player_key') THEN
            CREATE INDEX IF NOT EXISTS idx_players_key ON players(player_key);
        END IF;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sports_events') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'sport_key') THEN
            CREATE INDEX IF NOT EXISTS idx_events_sport ON sports_events(sport_key);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'start_time') THEN
            CREATE INDEX IF NOT EXISTS idx_events_start_time ON sports_events(start_time);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'status') THEN
            CREATE INDEX IF NOT EXISTS idx_events_status ON sports_events(status);
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'home_team_id') 
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_events' AND column_name = 'away_team_id') THEN
            CREATE INDEX IF NOT EXISTS idx_events_teams ON sports_events(home_team_id, away_team_id);
        END IF;
    END IF;
    
    -- Odds data indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'odds_data') THEN
        CREATE INDEX IF NOT EXISTS idx_odds_event ON odds_data(event_id);
        CREATE INDEX IF NOT EXISTS idx_odds_market ON odds_data(market_type_id);
        CREATE INDEX IF NOT EXISTS idx_odds_bookmaker ON odds_data(bookmaker_id);
        CREATE INDEX IF NOT EXISTS idx_odds_update ON odds_data(last_update);
    END IF;
    
    -- Player props indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_props_odds') THEN
        CREATE INDEX IF NOT EXISTS idx_player_props_event ON player_props_odds(event_id);
        CREATE INDEX IF NOT EXISTS idx_player_props_player ON player_props_odds(player_id);
        CREATE INDEX IF NOT EXISTS idx_player_props_type ON player_props_odds(prop_type_id);
    END IF;
    
    -- AI predictions indexes (handle existing table structure)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_predictions') THEN
        -- Check if event_id column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_predictions' AND column_name = 'event_id') THEN
            CREATE INDEX IF NOT EXISTS idx_predictions_event ON ai_predictions(event_id) WHERE event_id IS NOT NULL;
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_predictions' AND column_name = 'event_time') THEN
            -- Use event_time if event_id doesn't exist
            CREATE INDEX IF NOT EXISTS idx_predictions_event_time ON ai_predictions(event_time) WHERE event_time IS NOT NULL;
            RAISE NOTICE 'Created index on event_time column (event_id column not found)';
        END IF;
        
        -- Check if created_at column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_predictions' AND column_name = 'created_at') THEN
            CREATE INDEX IF NOT EXISTS idx_predictions_created ON ai_predictions(created_at DESC);
        END IF;
    END IF;
    
    RAISE NOTICE 'Finished creating indexes with column existence checks';
END $$;

-- Create update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
DO $$
BEGIN
    -- Teams table
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_teams_updated_at') THEN
        CREATE TRIGGER update_teams_updated_at 
            BEFORE UPDATE ON teams
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Players table
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_players_updated_at') THEN
        CREATE TRIGGER update_players_updated_at 
            BEFORE UPDATE ON players
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Sports events table (if trigger doesn't exist)
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sports_events_updated_at') THEN
        CREATE TRIGGER update_sports_events_updated_at 
            BEFORE UPDATE ON sports_events
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Player season stats table
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_player_season_stats_updated_at') THEN
        CREATE TRIGGER update_player_season_stats_updated_at 
            BEFORE UPDATE ON player_season_stats
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Phase 1 Step 3 completed successfully! Enhanced database schema is now ready for real data ingestion.';
    RAISE NOTICE 'Summary of tables created:';
    RAISE NOTICE '- players (with team and sport references)';
    RAISE NOTICE '- bookmakers (5 major US sportsbooks)';
    RAISE NOTICE '- market_types (spreads, totals, player props)';
    RAISE NOTICE '- odds_data (real-time odds storage)';
    RAISE NOTICE '- player_prop_types (NBA props configured)';
    RAISE NOTICE '- player_props_odds (player prop odds storage)';
    RAISE NOTICE '- historical_odds (line movement tracking)';
    RAISE NOTICE '- player_game_stats (actual game results)';
    RAISE NOTICE '- player_season_stats (season averages and splits)';
    RAISE NOTICE '- ai_predictions (model predictions storage)';
    RAISE NOTICE '- model_performance (ML model tracking)';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Get API key from The Odds API (free tier: 500 requests/month)';
    RAISE NOTICE '2. Configure data ingestion service with API credentials';
    RAISE NOTICE '3. Start real-time data ingestion';
END $$; 
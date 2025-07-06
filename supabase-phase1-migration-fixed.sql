-- Predictive Play Phase 1 Data Layer Migration for Supabase (FIXED)
-- This version handles dependencies properly to avoid foreign key errors

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- =====================================================
-- STEP 1: CREATE BASE TABLES WITHOUT FOREIGN KEYS
-- =====================================================

-- Sports configuration (no dependencies)
CREATE TABLE IF NOT EXISTS sports_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sport_key VARCHAR(50) UNIQUE NOT NULL,
    sport_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    season_type VARCHAR(50),
    current_season VARCHAR(20),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default sports
INSERT INTO sports_config (sport_key, sport_name, is_active) VALUES
    ('americanfootball_nfl', 'NFL', true),
    ('basketball_nba', 'NBA', true),
    ('baseball_mlb', 'MLB', true),
    ('icehockey_nhl', 'NHL', true)
ON CONFLICT (sport_key) DO NOTHING;

-- Teams table (only depends on sports_config)
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

-- Now create players table (after teams exists)
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_key VARCHAR(100) UNIQUE NOT NULL,
    player_name VARCHAR(200) NOT NULL,
    team_id UUID REFERENCES teams(id),
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    position VARCHAR(50),
    jersey_number VARCHAR(10),
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 2: HANDLE SPORTS_EVENTS TABLE CAREFULLY
-- =====================================================

-- Check if sports_events exists and update it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sports_events') THEN
        -- Add columns one by one to avoid errors
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
        
        -- Update sport_key from sport column if it exists
        UPDATE sports_events 
        SET sport_key = CASE 
            WHEN sport = 'NFL' THEN 'americanfootball_nfl'
            WHEN sport = 'NBA' THEN 'basketball_nba'
            WHEN sport = 'MLB' THEN 'baseball_mlb'
            WHEN sport = 'NHL' THEN 'icehockey_nhl'
            ELSE LOWER(sport)
        END
        WHERE sport_key IS NULL AND sport IS NOT NULL;
        
        -- Add foreign key constraints if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sports_events_sport_key_fkey') THEN
            ALTER TABLE sports_events ADD CONSTRAINT sports_events_sport_key_fkey 
                FOREIGN KEY (sport_key) REFERENCES sports_config(sport_key);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sports_events_home_team_id_fkey') THEN
            ALTER TABLE sports_events ADD CONSTRAINT sports_events_home_team_id_fkey 
                FOREIGN KEY (home_team_id) REFERENCES teams(id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sports_events_away_team_id_fkey') THEN
            ALTER TABLE sports_events ADD CONSTRAINT sports_events_away_team_id_fkey 
                FOREIGN KEY (away_team_id) REFERENCES teams(id);
        END IF;
        
        -- Add unique constraint on external_event_id if not exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sports_events_external_event_id_key') THEN
            ALTER TABLE sports_events ADD CONSTRAINT sports_events_external_event_id_key UNIQUE (external_event_id);
        END IF;
    ELSE
        -- Create new sports_events table
        CREATE TABLE sports_events (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            external_event_id VARCHAR(100) UNIQUE,
            sport VARCHAR(50),
            sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
            league VARCHAR(100) NOT NULL,
            home_team VARCHAR(200),
            away_team VARCHAR(200),
            home_team_id UUID REFERENCES teams(id),
            away_team_id UUID REFERENCES teams(id),
            start_time TIMESTAMP WITH TIME ZONE NOT NULL,
            venue VARCHAR(200),
            venue_city VARCHAR(100),
            weather_conditions JSONB DEFAULT '{}',
            status VARCHAR(50) DEFAULT 'scheduled',
            period_scores JSONB DEFAULT '[]',
            final_home_score INTEGER,
            final_away_score INTEGER,
            attendance INTEGER,
            broadcast_info JSONB DEFAULT '[]',
            odds JSONB DEFAULT '{}',
            stats JSONB DEFAULT '{}',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled', 'postponed'))
        );
    END IF;
END $$;

-- =====================================================
-- STEP 3: CREATE REMAINING TABLES
-- =====================================================

-- Bookmakers
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

-- Insert bookmakers
INSERT INTO bookmakers (bookmaker_key, bookmaker_name, region) VALUES
    ('draftkings', 'DraftKings', 'us'),
    ('fanduel', 'FanDuel', 'us'),
    ('betmgm', 'BetMGM', 'us'),
    ('caesars', 'Caesars', 'us'),
    ('pointsbet', 'PointsBet', 'us'),
    ('williamhill_us', 'William Hill (US)', 'us'),
    ('betonlineag', 'BetOnline.ag', 'us'),
    ('bovada', 'Bovada', 'us'),
    ('mybookieag', 'MyBookie.ag', 'us')
ON CONFLICT (bookmaker_key) DO NOTHING;

-- Market types
CREATE TABLE IF NOT EXISTS market_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_key VARCHAR(100) UNIQUE NOT NULL,
    market_name VARCHAR(200) NOT NULL,
    market_category VARCHAR(50),
    sport_key VARCHAR(50),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert market types
INSERT INTO market_types (market_key, market_name, market_category) VALUES
    ('spreads', 'Point Spreads', 'game'),
    ('totals', 'Over/Under Totals', 'game'),
    ('h2h', 'Moneyline', 'game'),
    ('player_points', 'Player Points', 'player_prop'),
    ('player_rebounds', 'Player Rebounds', 'player_prop'),
    ('player_assists', 'Player Assists', 'player_prop'),
    ('player_threes', 'Player 3-Pointers Made', 'player_prop'),
    ('player_pass_tds', 'Player Passing TDs', 'player_prop'),
    ('player_rush_yds', 'Player Rushing Yards', 'player_prop'),
    ('player_receptions', 'Player Receptions', 'player_prop')
ON CONFLICT (market_key) DO NOTHING;

-- Odds data table
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

-- Historical odds
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

-- Player prop types
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

-- Player props odds
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

-- Player game stats
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

-- Player season stats
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

-- =====================================================
-- STEP 4: UPDATE EXISTING PREDICTIONS TABLE
-- =====================================================

DO $$
BEGIN
    -- Check if predictions table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'predictions') THEN
        -- Add columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'prediction_type') THEN
            ALTER TABLE predictions ADD COLUMN prediction_type VARCHAR(50);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'player_id') THEN
            ALTER TABLE predictions ADD COLUMN player_id UUID;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'prop_type_id') THEN
            ALTER TABLE predictions ADD COLUMN prop_type_id UUID;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'predicted_value') THEN
            ALTER TABLE predictions ADD COLUMN predicted_value DECIMAL(10, 2);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'predicted_outcome') THEN
            ALTER TABLE predictions ADD COLUMN predicted_outcome VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'confidence_score') THEN
            ALTER TABLE predictions ADD COLUMN confidence_score DECIMAL(5, 4);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'expected_value') THEN
            ALTER TABLE predictions ADD COLUMN expected_value DECIMAL(10, 4);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'model_name') THEN
            ALTER TABLE predictions ADD COLUMN model_name VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'model_version') THEN
            ALTER TABLE predictions ADD COLUMN model_version VARCHAR(50);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'features_used') THEN
            ALTER TABLE predictions ADD COLUMN features_used JSONB DEFAULT '{}';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'market_comparison') THEN
            ALTER TABLE predictions ADD COLUMN market_comparison JSONB DEFAULT '{}';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'actual_result') THEN
            ALTER TABLE predictions ADD COLUMN actual_result DECIMAL(10, 2);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'predictions' AND column_name = 'result_status') THEN
            ALTER TABLE predictions ADD COLUMN result_status VARCHAR(20);
        END IF;
        
        -- Add foreign key constraints if columns were just added
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'predictions_player_id_fkey') THEN
            ALTER TABLE predictions ADD CONSTRAINT predictions_player_id_fkey 
                FOREIGN KEY (player_id) REFERENCES players(id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'predictions_prop_type_id_fkey') THEN
            ALTER TABLE predictions ADD CONSTRAINT predictions_prop_type_id_fkey 
                FOREIGN KEY (prop_type_id) REFERENCES player_prop_types(id);
        END IF;
    END IF;
    
    -- Create ai_predictions if neither predictions nor ai_predictions exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('predictions', 'ai_predictions')) THEN
        CREATE TABLE ai_predictions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            prediction_type VARCHAR(50) NOT NULL,
            event_id UUID REFERENCES sports_events(id),
            player_id UUID REFERENCES players(id),
            prop_type_id UUID REFERENCES player_prop_types(id),
            sport TEXT,
            matchup TEXT,
            pick TEXT,
            odds TEXT,
            predicted_value DECIMAL(10, 2),
            predicted_outcome VARCHAR(100),
            confidence DECIMAL,
            confidence_score DECIMAL(5, 4),
            expected_value DECIMAL(10, 4),
            model_name VARCHAR(100),
            model_version VARCHAR(50),
            features_used JSONB DEFAULT '{}',
            market_comparison JSONB DEFAULT '{}',
            analysis TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            expires_at TIMESTAMP WITH TIME ZONE,
            actual_result DECIMAL(10, 2),
            status VARCHAR(20) DEFAULT 'pending',
            result_status VARCHAR(20),
            metadata JSONB DEFAULT '{}'
        );
    END IF;
END $$;

-- Model performance tracking
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

-- =====================================================
-- STEP 5: CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_teams_sport ON teams(sport_key);
CREATE INDEX IF NOT EXISTS idx_teams_key ON teams(team_key);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_sport ON players(sport_key);
CREATE INDEX IF NOT EXISTS idx_players_key ON players(player_key);
CREATE INDEX IF NOT EXISTS idx_events_sport ON sports_events(sport_key);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON sports_events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_status ON sports_events(status);
CREATE INDEX IF NOT EXISTS idx_events_teams ON sports_events(home_team_id, away_team_id);
CREATE INDEX IF NOT EXISTS idx_odds_event ON odds_data(event_id);
CREATE INDEX IF NOT EXISTS idx_odds_market ON odds_data(market_type_id);
CREATE INDEX IF NOT EXISTS idx_odds_bookmaker ON odds_data(bookmaker_id);
CREATE INDEX IF NOT EXISTS idx_odds_update ON odds_data(last_update);
CREATE INDEX IF NOT EXISTS idx_player_props_event ON player_props_odds(event_id);
CREATE INDEX IF NOT EXISTS idx_player_props_player ON player_props_odds(player_id);
CREATE INDEX IF NOT EXISTS idx_player_props_type ON player_props_odds(prop_type_id);

-- =====================================================
-- STEP 6: CREATE FUNCTIONS AND TRIGGERS
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sports_config_updated_at') THEN
        CREATE TRIGGER update_sports_config_updated_at BEFORE UPDATE ON sports_config
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_teams_updated_at') THEN
        CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_players_updated_at') THEN
        CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sports_events_updated_at') THEN
        CREATE TRIGGER update_sports_events_updated_at BEFORE UPDATE ON sports_events
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Implied probability function
CREATE OR REPLACE FUNCTION calculate_implied_probability(odds DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF odds > 0 THEN
        RETURN 100.0 / (odds + 100.0);
    ELSE
        RETURN ABS(odds) / (ABS(odds) + 100.0);
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- STEP 7: ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_props_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_prop_types ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can view teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public can view sports" ON sports_config FOR SELECT USING (true);
CREATE POLICY "Public can view bookmakers" ON bookmakers FOR SELECT USING (true);
CREATE POLICY "Public can view market types" ON market_types FOR SELECT USING (true);
CREATE POLICY "Public can view odds" ON odds_data FOR SELECT USING (true);
CREATE POLICY "Public can view player props odds" ON player_props_odds FOR SELECT USING (true);
CREATE POLICY "Public can view players" ON players FOR SELECT USING (true);
CREATE POLICY "Public can view prop types" ON player_prop_types FOR SELECT USING (true);

-- =====================================================
-- STEP 8: GRANT PERMISSIONS
-- =====================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON sports_events TO authenticated;
GRANT ALL ON odds_data TO authenticated;
GRANT ALL ON player_props_odds TO authenticated;

-- For predictions table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'predictions') THEN
        EXECUTE 'GRANT ALL ON predictions TO authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_predictions') THEN
        EXECUTE 'GRANT ALL ON ai_predictions TO authenticated';
    END IF;
END $$;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully! Next steps:';
    RAISE NOTICE '1. Get your API key from https://the-odds-api.com';
    RAISE NOTICE '2. Set up environment variables';
    RAISE NOTICE '3. Start the data ingestion service';
END $$; 
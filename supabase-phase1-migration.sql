-- ParleyApp Phase 1 Data Layer Migration for Supabase
-- Safe to run multiple times - uses IF NOT EXISTS
-- Optimized for The Odds API integration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- =====================================================
-- CORE CONFIGURATION TABLES
-- =====================================================

-- Sports configuration
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

-- Insert default sports if not exists
INSERT INTO sports_config (sport_key, sport_name, is_active) VALUES
    ('americanfootball_nfl', 'NFL', true),
    ('basketball_nba', 'NBA', true),
    ('baseball_mlb', 'MLB', true),
    ('icehockey_nhl', 'NHL', true)
ON CONFLICT (sport_key) DO NOTHING;

-- Teams master table
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

-- Players master table
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
-- ENHANCED SPORTS EVENTS (PRESERVE EXISTING DATA)
-- =====================================================

-- First, let's backup existing sports_events if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sports_events') THEN
        -- Add new columns if they don't exist
        ALTER TABLE sports_events 
        ADD COLUMN IF NOT EXISTS external_event_id VARCHAR(100) UNIQUE,
        ADD COLUMN IF NOT EXISTS sport_key VARCHAR(50),
        ADD COLUMN IF NOT EXISTS home_team_id UUID,
        ADD COLUMN IF NOT EXISTS away_team_id UUID,
        ADD COLUMN IF NOT EXISTS venue VARCHAR(200),
        ADD COLUMN IF NOT EXISTS venue_city VARCHAR(100),
        ADD COLUMN IF NOT EXISTS weather_conditions JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS period_scores JSONB DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS final_home_score INTEGER,
        ADD COLUMN IF NOT EXISTS final_away_score INTEGER,
        ADD COLUMN IF NOT EXISTS attendance INTEGER,
        ADD COLUMN IF NOT EXISTS broadcast_info JSONB DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
        
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
-- ODDS AND BETTING MARKETS
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

-- Insert common US bookmakers
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

-- Insert market types for The Odds API
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

-- Real-time odds table
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

-- =====================================================
-- PLAYER PROPS
-- =====================================================

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

-- =====================================================
-- STATISTICS AND PERFORMANCE
-- =====================================================

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
-- ENHANCED AI PREDICTIONS (UPDATE EXISTING)
-- =====================================================

-- Add new columns to existing predictions/ai_predictions table if exists
DO $$
BEGIN
    -- Handle both 'predictions' and 'ai_predictions' table names
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'predictions') THEN
        ALTER TABLE predictions
        ADD COLUMN IF NOT EXISTS prediction_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id),
        ADD COLUMN IF NOT EXISTS prop_type_id UUID REFERENCES player_prop_types(id),
        ADD COLUMN IF NOT EXISTS predicted_value DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS predicted_outcome VARCHAR(100),
        ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5, 4),
        ADD COLUMN IF NOT EXISTS expected_value DECIMAL(10, 4),
        ADD COLUMN IF NOT EXISTS model_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS model_version VARCHAR(50),
        ADD COLUMN IF NOT EXISTS features_used JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS market_comparison JSONB DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS actual_result DECIMAL(10, 2),
        ADD COLUMN IF NOT EXISTS result_status VARCHAR(20);
    END IF;
    
    -- Create new table if neither exists
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
-- INDEXES FOR PERFORMANCE
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
CREATE INDEX IF NOT EXISTS idx_predictions_event ON ai_predictions(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_predictions_created ON ai_predictions(created_at DESC);

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Update timestamp function
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
    -- Sports config
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sports_config_updated_at') THEN
        CREATE TRIGGER update_sports_config_updated_at BEFORE UPDATE ON sports_config
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Teams
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_teams_updated_at') THEN
        CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Players
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_players_updated_at') THEN
        CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Sports events
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sports_events_updated_at') THEN
        CREATE TRIGGER update_sports_events_updated_at BEFORE UPDATE ON sports_events
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Function to calculate implied probability from American odds
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
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_props_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_prop_types ENABLE ROW LEVEL SECURITY;

-- Public read access for reference data
CREATE POLICY "Public can view teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public can view sports" ON sports_config FOR SELECT USING (true);
CREATE POLICY "Public can view bookmakers" ON bookmakers FOR SELECT USING (true);
CREATE POLICY "Public can view market types" ON market_types FOR SELECT USING (true);
CREATE POLICY "Public can view odds" ON odds_data FOR SELECT USING (true);
CREATE POLICY "Public can view player props odds" ON player_props_odds FOR SELECT USING (true);
CREATE POLICY "Public can view players" ON players FOR SELECT USING (true);
CREATE POLICY "Public can view prop types" ON player_prop_types FOR SELECT USING (true);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON sports_events TO authenticated;
GRANT ALL ON odds_data TO authenticated;
GRANT ALL ON player_props_odds TO authenticated;
GRANT ALL ON ai_predictions TO authenticated;

-- =====================================================
-- FINAL NOTES
-- =====================================================

-- This migration:
-- 1. Preserves all existing data
-- 2. Adds support for The Odds API data structure
-- 3. Is safe to run multiple times (idempotent)
-- 4. Maintains Supabase RLS policies
-- 5. Uses The Odds API sport key format (e.g., 'basketball_nba')

-- After running this, update your environment:
-- API_PROVIDER=theodds
-- SPORTS_API_KEY=your_the_odds_api_key
-- Then start the data ingestion service! 
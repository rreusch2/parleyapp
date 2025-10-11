-- Enhanced Predictive Play Database Schema for Phase 1
-- Designed to support comprehensive sports betting data from OddsJam/The Odds API

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- For time-based partitioning

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Sports and Leagues Configuration
CREATE TABLE sports_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sport_key VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'NFL', 'NBA', 'MLB', 'NHL'
    sport_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    season_type VARCHAR(50), -- 'regular', 'playoffs', 'preseason'
    current_season VARCHAR(20), -- e.g., '2024-2025'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams Master Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    team_key VARCHAR(100) UNIQUE NOT NULL, -- Unique identifier from API
    team_name VARCHAR(200) NOT NULL,
    team_abbreviation VARCHAR(10),
    city VARCHAR(100),
    conference VARCHAR(50),
    division VARCHAR(50),
    logo_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_teams_sport (sport_key),
    INDEX idx_teams_key (team_key)
);

-- Players Master Table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_key VARCHAR(100) UNIQUE NOT NULL, -- Unique identifier from API
    player_name VARCHAR(200) NOT NULL,
    team_id UUID REFERENCES teams(id),
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    position VARCHAR(50),
    jersey_number VARCHAR(10),
    status VARCHAR(50) DEFAULT 'active', -- active, injured, suspended, etc.
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_players_team (team_id),
    INDEX idx_players_sport (sport_key),
    INDEX idx_players_key (player_key)
);

-- Enhanced Sports Events Table
CREATE TABLE sports_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_event_id VARCHAR(100) UNIQUE NOT NULL,
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    league VARCHAR(100) NOT NULL,
    home_team_id UUID REFERENCES teams(id),
    away_team_id UUID REFERENCES teams(id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    venue VARCHAR(200),
    venue_city VARCHAR(100),
    weather_conditions JSONB DEFAULT '{}', -- temperature, wind, precipitation
    status VARCHAR(50) DEFAULT 'scheduled',
    period_scores JSONB DEFAULT '[]', -- Array of period/quarter/inning scores
    final_home_score INTEGER,
    final_away_score INTEGER,
    attendance INTEGER,
    broadcast_info JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled', 'postponed')),
    INDEX idx_events_sport (sport_key),
    INDEX idx_events_start_time (start_time),
    INDEX idx_events_status (status),
    INDEX idx_events_teams (home_team_id, away_team_id)
);

-- =====================================================
-- ODDS AND BETTING MARKETS
-- =====================================================

-- Bookmakers/Sportsbooks
CREATE TABLE bookmakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bookmaker_key VARCHAR(50) UNIQUE NOT NULL,
    bookmaker_name VARCHAR(100) NOT NULL,
    region VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    affiliate_link TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Betting Markets Configuration
CREATE TABLE market_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_key VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'spreads', 'totals', 'h2h', 'player_points_over'
    market_name VARCHAR(200) NOT NULL,
    market_category VARCHAR(50), -- 'game', 'player_prop', 'team_prop', 'futures'
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time Odds Table (Partitioned by date for performance)
CREATE TABLE odds_data (
    id UUID DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES sports_events(id) ON DELETE CASCADE,
    bookmaker_id UUID REFERENCES bookmakers(id),
    market_type_id UUID REFERENCES market_types(id),
    outcome_name VARCHAR(200), -- Team name, Over/Under, Player name
    outcome_price DECIMAL(10, 2), -- American odds format
    outcome_point DECIMAL(10, 2), -- Spread points or total points
    implied_probability DECIMAL(5, 4), -- Calculated from odds
    is_best_odds BOOLEAN DEFAULT false,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, created_at),
    INDEX idx_odds_event (event_id),
    INDEX idx_odds_market (market_type_id),
    INDEX idx_odds_bookmaker (bookmaker_id),
    INDEX idx_odds_update (last_update)
) PARTITION BY RANGE (created_at);

-- Create partitions for odds_data (example for current and next month)
CREATE TABLE odds_data_2025_01 PARTITION OF odds_data
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Historical Odds Table (for model training)
CREATE TABLE historical_odds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES sports_events(id),
    bookmaker_id UUID REFERENCES bookmakers(id),
    market_type_id UUID REFERENCES market_types(id),
    opening_line JSONB NOT NULL, -- Opening odds/lines
    closing_line JSONB NOT NULL, -- Closing odds/lines
    line_movements JSONB DEFAULT '[]', -- Array of {timestamp, line, volume}
    result VARCHAR(50), -- 'win', 'loss', 'push'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PLAYER PROPS AND STATISTICS
-- =====================================================

-- Player Props Markets
CREATE TABLE player_prop_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prop_key VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'points', 'rebounds', 'passing_yards'
    prop_name VARCHAR(200) NOT NULL,
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    stat_category VARCHAR(50), -- 'scoring', 'rebounding', 'passing', etc.
    unit VARCHAR(20), -- 'points', 'yards', 'goals', etc.
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player Props Odds
CREATE TABLE player_props_odds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES sports_events(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id),
    prop_type_id UUID REFERENCES player_prop_types(id),
    bookmaker_id UUID REFERENCES bookmakers(id),
    line DECIMAL(10, 2) NOT NULL, -- The prop line (e.g., 25.5 points)
    over_odds DECIMAL(10, 2), -- Odds for over
    under_odds DECIMAL(10, 2), -- Odds for under
    implied_prob_over DECIMAL(5, 4),
    implied_prob_under DECIMAL(5, 4),
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_player_props_event (event_id),
    INDEX idx_player_props_player (player_id),
    INDEX idx_player_props_type (prop_type_id)
);

-- Player Game Statistics (Actual results)
CREATE TABLE player_game_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES sports_events(id),
    player_id UUID REFERENCES players(id),
    minutes_played DECIMAL(5, 2),
    stats JSONB NOT NULL, -- Flexible stats based on sport
    fantasy_points DECIMAL(6, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, player_id),
    INDEX idx_player_stats_event (event_id),
    INDEX idx_player_stats_player (player_id)
);

-- Player Season Statistics
CREATE TABLE player_season_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id),
    season VARCHAR(20) NOT NULL,
    games_played INTEGER DEFAULT 0,
    stats_avg JSONB NOT NULL, -- Average stats per game
    stats_total JSONB NOT NULL, -- Total season stats
    recent_form JSONB DEFAULT '{}', -- Last 5, 10 games stats
    home_away_splits JSONB DEFAULT '{}',
    opponent_splits JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, season),
    INDEX idx_season_stats_player (player_id)
);

-- =====================================================
-- INJURY AND NEWS DATA
-- =====================================================

-- Injury Reports
CREATE TABLE injury_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id),
    injury_date DATE NOT NULL,
    injury_type VARCHAR(100),
    injury_location VARCHAR(100), -- body part
    injury_status VARCHAR(50), -- 'out', 'doubtful', 'questionable', 'probable'
    expected_return DATE,
    notes TEXT,
    source VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_injuries_player (player_id),
    INDEX idx_injuries_date (injury_date),
    INDEX idx_injuries_active (is_active)
);

-- News and Updates
CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    headline TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    source VARCHAR(100),
    source_url TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    team_ids UUID[] DEFAULT '{}', -- Array of related team IDs
    player_ids UUID[] DEFAULT '{}', -- Array of related player IDs
    tags TEXT[] DEFAULT '{}',
    sentiment_score DECIMAL(3, 2), -- -1 to 1
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_news_sport (sport_key),
    INDEX idx_news_published (published_at),
    INDEX idx_news_teams (team_ids),
    INDEX idx_news_players (player_ids)
);

-- =====================================================
-- AI VIDEO GENERATION AND USER CONTENT
-- =====================================================

-- User Generated Videos Table
CREATE TABLE user_generated_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    video_type VARCHAR(50) NOT NULL, -- 'highlight_reel', 'player_analysis', 'strategy_explanation', 'trend_analysis', 'custom_content'
    content_prompt TEXT NOT NULL,
    generation_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'
    video_url TEXT,
    thumbnail_url TEXT,
    video_duration INTEGER, -- in seconds
    video_size INTEGER, -- in bytes
    video_metadata JSONB DEFAULT '{}',
    views_count INTEGER DEFAULT 0,
    downloads_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    sport VARCHAR(50),
    game_id UUID REFERENCES sports_events(id),
    player_id UUID REFERENCES players(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_videos_user (user_id),
    INDEX idx_videos_status (generation_status),
    INDEX idx_videos_sport (sport),
    INDEX idx_videos_public (is_public, created_at DESC),
    CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
    CHECK (video_type IN ('highlight_reel', 'player_analysis', 'strategy_explanation', 'trend_analysis', 'custom_content'))
);

-- Video Generation Queue (for managing concurrent requests)
CREATE TABLE video_generation_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    video_type VARCHAR(50) NOT NULL,
    content_prompt TEXT NOT NULL,
    priority INTEGER DEFAULT 1, -- 1-10, higher = more important
    queue_position INTEGER,
    estimated_completion TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_queue_user (user_id),
    INDEX idx_queue_status (queue_position, priority DESC),
    CHECK (priority BETWEEN 1 AND 10),
    CHECK (retry_count <= max_retries)
);

-- User Video Preferences
CREATE TABLE user_video_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    default_video_type VARCHAR(50) DEFAULT 'highlight_reel',
    preferred_sports TEXT[] DEFAULT '{MLB}',
    max_video_length INTEGER DEFAULT 60, -- seconds
    auto_generate BOOLEAN DEFAULT false,
    notification_preferences JSONB DEFAULT '{"generation_complete": true, "daily_digest": false}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Video Templates (for consistent branding)
CREATE TABLE video_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- 'highlight_reel', 'player_analysis', etc.
    base_prompt TEXT NOT NULL,
    style_settings JSONB DEFAULT '{}', -- colors, fonts, effects
    is_premium BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_templates_type (template_type),
    INDEX idx_templates_premium (is_premium)
);

-- =====================================================
-- PREDICTIONS AND ANALYSIS
-- =====================================================

-- Enhanced AI Predictions Table
CREATE TABLE ai_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prediction_type VARCHAR(50) NOT NULL, -- 'spread', 'total', 'moneyline', 'player_prop'
    event_id UUID REFERENCES sports_events(id),
    player_id UUID REFERENCES players(id), -- For player props
    prop_type_id UUID REFERENCES player_prop_types(id), -- For player props
    predicted_value DECIMAL(10, 2) NOT NULL,
    predicted_outcome VARCHAR(100), -- 'over', 'under', 'home', 'away'
    confidence_score DECIMAL(5, 4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    expected_value DECIMAL(10, 4), -- EV calculation
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    features_used JSONB DEFAULT '{}', -- Key features that influenced prediction
    market_comparison JSONB DEFAULT '{}', -- Comparison with current market odds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    actual_result DECIMAL(10, 2), -- Filled after game completion
    result_status VARCHAR(20), -- 'pending', 'won', 'lost', 'push'
    INDEX idx_predictions_event (event_id),
    INDEX idx_predictions_type (prediction_type),
    INDEX idx_predictions_created (created_at),
    INDEX idx_predictions_confidence (confidence_score DESC)
);

-- Model Performance Tracking
CREATE TABLE model_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    sport_key VARCHAR(50) REFERENCES sports_config(sport_key),
    prediction_type VARCHAR(50) NOT NULL,
    evaluation_period DATERANGE NOT NULL,
    total_predictions INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    accuracy DECIMAL(5, 4),
    roi DECIMAL(10, 4), -- Return on investment
    avg_confidence DECIMAL(5, 4),
    metrics JSONB DEFAULT '{}', -- Additional metrics (RMSE, MAE, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_model_perf_name (model_name, model_version),
    INDEX idx_model_perf_sport (sport_key)
);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to relevant tables
CREATE TRIGGER update_sports_config_updated_at BEFORE UPDATE ON sports_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sports_events_updated_at BEFORE UPDATE ON sports_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_injury_reports_updated_at BEFORE UPDATE ON injury_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Function to identify best odds across bookmakers
CREATE OR REPLACE FUNCTION update_best_odds()
RETURNS TRIGGER AS $$
BEGIN
    -- Reset all best odds flags for this event and market
    UPDATE odds_data 
    SET is_best_odds = false 
    WHERE event_id = NEW.event_id 
    AND market_type_id = NEW.market_type_id;
    
    -- Set best odds flags
    WITH best_odds AS (
        SELECT DISTINCT ON (outcome_name) 
            id, outcome_price
        FROM odds_data
        WHERE event_id = NEW.event_id 
        AND market_type_id = NEW.market_type_id
        ORDER BY outcome_name, outcome_price DESC
    )
    UPDATE odds_data 
    SET is_best_odds = true
    WHERE id IN (SELECT id FROM best_odds);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_best_odds_trigger
AFTER INSERT OR UPDATE ON odds_data
FOR EACH ROW EXECUTE FUNCTION update_best_odds();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Composite indexes for common queries
CREATE INDEX idx_odds_best_by_event ON odds_data(event_id, market_type_id) WHERE is_best_odds = true;
CREATE INDEX idx_events_upcoming ON sports_events(start_time) WHERE status = 'scheduled';
CREATE INDEX idx_predictions_recent ON ai_predictions(created_at DESC) WHERE result_status = 'pending';
CREATE INDEX idx_player_props_current ON player_props_odds(event_id, player_id, prop_type_id);

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Insert common bookmakers
INSERT INTO bookmakers (bookmaker_key, bookmaker_name, region) VALUES
    ('draftkings', 'DraftKings', 'us'),
    ('fanduel', 'FanDuel', 'us'),
    ('betmgm', 'BetMGM', 'us'),
    ('caesars', 'Caesars', 'us'),
    ('pointsbet', 'PointsBet', 'us'),
    ('bet365', 'Bet365', 'us');

-- Insert sports configuration
INSERT INTO sports_config (sport_key, sport_name) VALUES
    ('NFL', 'National Football League'),
    ('NBA', 'National Basketball Association'),
    ('MLB', 'Major League Baseball'),
    ('NHL', 'National Hockey League');

-- Insert common market types
INSERT INTO market_types (market_key, market_name, market_category) VALUES
    ('spreads', 'Point Spreads', 'game'),
    ('totals', 'Over/Under Totals', 'game'),
    ('h2h', 'Moneyline', 'game'),
    ('player_points', 'Player Points', 'player_prop'),
    ('player_rebounds', 'Player Rebounds', 'player_prop'),
    ('player_assists', 'Player Assists', 'player_prop');

-- Sample player prop types for NBA
INSERT INTO player_prop_types (prop_key, prop_name, sport_key, stat_category, unit) VALUES
    ('points', 'Points', 'NBA', 'scoring', 'points'),
    ('rebounds', 'Rebounds', 'NBA', 'rebounding', 'rebounds'),
    ('assists', 'Assists', 'NBA', 'playmaking', 'assists'),
    ('threes', 'Three Pointers Made', 'NBA', 'scoring', 'threes'),
    ('blocks', 'Blocks', 'NBA', 'defense', 'blocks'),
    ('steals', 'Steals', 'NBA', 'defense', 'steals'); 
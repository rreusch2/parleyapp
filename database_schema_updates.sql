-- Database Schema Updates for Enhanced Sports Betting AI System
-- Supports Scrapy integration, enhanced metadata, and improved analytics

-- ============================================================================
-- SCRAPY DATA TABLES
-- ============================================================================

-- Table for storing scraped news articles
CREATE TABLE IF NOT EXISTS scrapy_news (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    url VARCHAR(1000) UNIQUE,
    source VARCHAR(200),
    published_date TIMESTAMP,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    teams TEXT[], -- Array of team names mentioned
    players TEXT[], -- Array of player names mentioned
    keywords TEXT[], -- Array of extracted keywords
    sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
    relevance_score DECIMAL(3,2), -- 0.0 to 1.0
    category VARCHAR(100), -- injury, trade, performance, etc.
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing scraped player statistics
CREATE TABLE IF NOT EXISTS scrapy_player_stats (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(200) NOT NULL,
    team VARCHAR(100),
    sport VARCHAR(50),
    season VARCHAR(20),
    game_date DATE,
    stat_type VARCHAR(100), -- batting_avg, points_per_game, etc.
    stat_value DECIMAL(10,4),
    stat_context VARCHAR(200), -- vs team, home/away, etc.
    source_url VARCHAR(1000),
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_quality_score DECIMAL(3,2), -- 0.0 to 1.0
    verification_status VARCHAR(50) DEFAULT 'unverified',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for storing scraped team performance data
CREATE TABLE IF NOT EXISTS scrapy_team_performance (
    id SERIAL PRIMARY KEY,
    team_name VARCHAR(200) NOT NULL,
    sport VARCHAR(50),
    season VARCHAR(20),
    game_date DATE,
    opponent VARCHAR(200),
    performance_metric VARCHAR(100), -- win_rate, avg_score, etc.
    metric_value DECIMAL(10,4),
    context VARCHAR(200), -- home/away, recent form, etc.
    source_url VARCHAR(1000),
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_quality_score DECIMAL(3,2),
    verification_status VARCHAR(50) DEFAULT 'unverified',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ENHANCED PREDICTIONS TABLES
-- ============================================================================

-- Enhanced version of existing predictions table
CREATE TABLE IF NOT EXISTS enhanced_predictions (
    id SERIAL PRIMARY KEY,
    prediction_type VARCHAR(50) NOT NULL, -- 'team' or 'props'
    pick TEXT NOT NULL,
    odds VARCHAR(50),
    confidence DECIMAL(5,2) NOT NULL,
    match_teams TEXT[],
    
    -- Enhanced metadata fields
    model_used VARCHAR(100) DEFAULT 'grok-4',
    enhanced_system BOOLEAN DEFAULT true,
    scrapy_insights_used BOOLEAN DEFAULT false,
    scrapy_edge TEXT, -- Description of Scrapy data advantage
    research_insights_count INTEGER DEFAULT 0,
    
    -- Player props specific fields
    player_name VARCHAR(200),
    prop_type VARCHAR(100), -- over/under, points, rebounds, etc.
    recommendation VARCHAR(50), -- over, under, etc.
    line DECIMAL(10,2),
    
    -- Data source tracking
    statmuse_data_used BOOLEAN DEFAULT false,
    web_search_data_used BOOLEAN DEFAULT false,
    scrapy_news_count INTEGER DEFAULT 0,
    scrapy_stats_count INTEGER DEFAULT 0,
    scrapy_performance_count INTEGER DEFAULT 0,
    
    -- Performance tracking
    ai_reasoning TEXT,
    confidence_factors TEXT[],
    risk_assessment TEXT,
    expected_value DECIMAL(10,4),
    
    -- System metadata
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    agent_version VARCHAR(50),
    processing_time_ms INTEGER,
    data_freshness_score DECIMAL(3,2), -- 0.0 to 1.0
    
    -- Standard fields
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Outcome tracking (for future analysis)
    actual_outcome VARCHAR(50), -- win, loss, push
    outcome_recorded_at TIMESTAMP,
    profit_loss DECIMAL(10,2)
);

-- ============================================================================
-- SYSTEM MONITORING TABLES
-- ============================================================================

-- Table for tracking system performance and health
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4),
    metric_unit VARCHAR(50),
    component VARCHAR(100), -- scrapy_service, teams_agent, etc.
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    alert_threshold_exceeded BOOLEAN DEFAULT false
);

-- Table for tracking workflow executions
CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_name VARCHAR(100) NOT NULL,
    execution_status VARCHAR(50) NOT NULL, -- success, failed, running
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    execution_time_ms INTEGER,
    data_processed INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    error_details TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for tracking data quality metrics
CREATE TABLE IF NOT EXISTS data_quality_metrics (
    id SERIAL PRIMARY KEY,
    data_source VARCHAR(100) NOT NULL, -- scrapy_news, statmuse, etc.
    quality_metric VARCHAR(100) NOT NULL, -- completeness, accuracy, etc.
    metric_value DECIMAL(5,4), -- 0.0 to 1.0
    sample_size INTEGER,
    measurement_date DATE DEFAULT CURRENT_DATE,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ENHANCED ANALYTICS VIEWS
-- ============================================================================

-- View for comprehensive prediction analytics
CREATE OR REPLACE VIEW enhanced_prediction_analytics AS
SELECT 
    prediction_type,
    COUNT(*) as total_predictions,
    AVG(confidence) as avg_confidence,
    COUNT(CASE WHEN scrapy_insights_used THEN 1 END) as scrapy_enhanced_count,
    COUNT(CASE WHEN scrapy_insights_used THEN 1 END)::DECIMAL / COUNT(*) as scrapy_enhancement_rate,
    AVG(research_insights_count) as avg_research_insights,
    AVG(processing_time_ms) as avg_processing_time_ms,
    AVG(data_freshness_score) as avg_data_freshness,
    COUNT(CASE WHEN actual_outcome = 'win' THEN 1 END) as wins,
    COUNT(CASE WHEN actual_outcome = 'loss' THEN 1 END) as losses,
    COUNT(CASE WHEN actual_outcome = 'push' THEN 1 END) as pushes,
    COUNT(CASE WHEN actual_outcome IS NOT NULL THEN 1 END) as total_resolved,
    CASE 
        WHEN COUNT(CASE WHEN actual_outcome IS NOT NULL THEN 1 END) > 0 
        THEN COUNT(CASE WHEN actual_outcome = 'win' THEN 1 END)::DECIMAL / COUNT(CASE WHEN actual_outcome IS NOT NULL THEN 1 END)
        ELSE NULL 
    END as win_rate,
    SUM(COALESCE(profit_loss, 0)) as total_profit_loss,
    DATE(created_at) as prediction_date
FROM enhanced_predictions 
WHERE is_active = true
GROUP BY prediction_type, DATE(created_at)
ORDER BY prediction_date DESC;

-- View for Scrapy data freshness monitoring
CREATE OR REPLACE VIEW scrapy_data_freshness AS
SELECT 
    'news' as data_type,
    COUNT(*) as total_records,
    MAX(scraped_at) as latest_scrape,
    MIN(scraped_at) as earliest_scrape,
    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - scraped_at))/3600) as avg_age_hours,
    COUNT(CASE WHEN scraped_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END) as records_last_24h
FROM scrapy_news WHERE is_active = true

UNION ALL

SELECT 
    'player_stats' as data_type,
    COUNT(*) as total_records,
    MAX(scraped_at) as latest_scrape,
    MIN(scraped_at) as earliest_scrape,
    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - scraped_at))/3600) as avg_age_hours,
    COUNT(CASE WHEN scraped_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END) as records_last_24h
FROM scrapy_player_stats WHERE is_active = true

UNION ALL

SELECT 
    'team_performance' as data_type,
    COUNT(*) as total_records,
    MAX(scraped_at) as latest_scrape,
    MIN(scraped_at) as earliest_scrape,
    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - scraped_at))/3600) as avg_age_hours,
    COUNT(CASE WHEN scraped_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END) as records_last_24h
FROM scrapy_team_performance WHERE is_active = true;

-- View for system health dashboard
CREATE OR REPLACE VIEW system_health_dashboard AS
SELECT 
    component,
    metric_name,
    metric_value,
    metric_unit,
    recorded_at,
    CASE 
        WHEN alert_threshold_exceeded THEN '🔴 Alert'
        WHEN metric_value IS NULL THEN '⚠️ No Data'
        ELSE '✅ Normal'
    END as status
FROM system_health_metrics 
WHERE recorded_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY component, recorded_at DESC;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Scrapy data indexes
CREATE INDEX IF NOT EXISTS idx_scrapy_news_teams ON scrapy_news USING GIN(teams);
CREATE INDEX IF NOT EXISTS idx_scrapy_news_players ON scrapy_news USING GIN(players);
CREATE INDEX IF NOT EXISTS idx_scrapy_news_scraped_at ON scrapy_news(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrapy_news_published_date ON scrapy_news(published_date DESC);

CREATE INDEX IF NOT EXISTS idx_scrapy_player_stats_player ON scrapy_player_stats(player_name);
CREATE INDEX IF NOT EXISTS idx_scrapy_player_stats_team ON scrapy_player_stats(team);
CREATE INDEX IF NOT EXISTS idx_scrapy_player_stats_scraped_at ON scrapy_player_stats(scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrapy_team_performance_team ON scrapy_team_performance(team_name);
CREATE INDEX IF NOT EXISTS idx_scrapy_team_performance_scraped_at ON scrapy_team_performance(scraped_at DESC);

-- Enhanced predictions indexes
CREATE INDEX IF NOT EXISTS idx_enhanced_predictions_type ON enhanced_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_enhanced_predictions_scrapy_used ON enhanced_predictions(scrapy_insights_used);
CREATE INDEX IF NOT EXISTS idx_enhanced_predictions_created_at ON enhanced_predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enhanced_predictions_player ON enhanced_predictions(player_name);
CREATE INDEX IF NOT EXISTS idx_enhanced_predictions_teams ON enhanced_predictions USING GIN(match_teams);

-- System monitoring indexes
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health_metrics(component);
CREATE INDEX IF NOT EXISTS idx_system_health_recorded_at ON system_health_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_name ON workflow_executions(workflow_name);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_start_time ON workflow_executions(start_time DESC);

-- ============================================================================
-- FUNCTIONS FOR DATA MANAGEMENT
-- ============================================================================

-- Function to clean old scrapy data
CREATE OR REPLACE FUNCTION cleanup_old_scrapy_data(days_to_keep INTEGER DEFAULT 30)
RETURNS TABLE(
    table_name TEXT,
    records_deleted INTEGER
) AS $$
DECLARE
    news_deleted INTEGER;
    stats_deleted INTEGER;
    performance_deleted INTEGER;
BEGIN
    -- Clean old news data
    DELETE FROM scrapy_news 
    WHERE scraped_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS news_deleted = ROW_COUNT;
    
    -- Clean old player stats data
    DELETE FROM scrapy_player_stats 
    WHERE scraped_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS stats_deleted = ROW_COUNT;
    
    -- Clean old team performance data
    DELETE FROM scrapy_team_performance 
    WHERE scraped_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS performance_deleted = ROW_COUNT;
    
    -- Return results
    RETURN QUERY VALUES 
        ('scrapy_news', news_deleted),
        ('scrapy_player_stats', stats_deleted),
        ('scrapy_team_performance', performance_deleted);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate data quality scores
CREATE OR REPLACE FUNCTION calculate_data_quality_scores()
RETURNS TABLE(
    data_source TEXT,
    completeness_score DECIMAL(5,4),
    freshness_score DECIMAL(5,4),
    overall_quality_score DECIMAL(5,4)
) AS $$
BEGIN
    RETURN QUERY
    WITH quality_metrics AS (
        -- News data quality
        SELECT 
            'scrapy_news' as source,
            COUNT(CASE WHEN title IS NOT NULL AND content IS NOT NULL THEN 1 END)::DECIMAL / COUNT(*) as completeness,
            COUNT(CASE WHEN scraped_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END)::DECIMAL / COUNT(*) as freshness
        FROM scrapy_news WHERE is_active = true
        
        UNION ALL
        
        -- Player stats data quality
        SELECT 
            'scrapy_player_stats' as source,
            COUNT(CASE WHEN player_name IS NOT NULL AND stat_value IS NOT NULL THEN 1 END)::DECIMAL / COUNT(*) as completeness,
            COUNT(CASE WHEN scraped_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END)::DECIMAL / COUNT(*) as freshness
        FROM scrapy_player_stats WHERE is_active = true
        
        UNION ALL
        
        -- Team performance data quality
        SELECT 
            'scrapy_team_performance' as source,
            COUNT(CASE WHEN team_name IS NOT NULL AND metric_value IS NOT NULL THEN 1 END)::DECIMAL / COUNT(*) as completeness,
            COUNT(CASE WHEN scraped_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END)::DECIMAL / COUNT(*) as freshness
        FROM scrapy_team_performance WHERE is_active = true
    )
    SELECT 
        source,
        completeness,
        freshness,
        (completeness + freshness) / 2 as overall_quality
    FROM quality_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all tables (with existence checks)
DO $$
BEGIN
    -- Trigger for scrapy_news
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_scrapy_news_updated_at'
        AND tgrelid = 'scrapy_news'::regclass
    ) THEN
        CREATE TRIGGER update_scrapy_news_updated_at
            BEFORE UPDATE ON scrapy_news
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Trigger for scrapy_player_stats
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_scrapy_player_stats_updated_at'
        AND tgrelid = 'scrapy_player_stats'::regclass
    ) THEN
        CREATE TRIGGER update_scrapy_player_stats_updated_at
            BEFORE UPDATE ON scrapy_player_stats
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Trigger for scrapy_team_performance
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_scrapy_team_performance_updated_at'
        AND tgrelid = 'scrapy_team_performance'::regclass
    ) THEN
        CREATE TRIGGER update_scrapy_team_performance_updated_at
            BEFORE UPDATE ON scrapy_team_performance
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Trigger for enhanced_predictions
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_enhanced_predictions_updated_at'
        AND tgrelid = 'enhanced_predictions'::regclass
    ) THEN
        CREATE TRIGGER update_enhanced_predictions_updated_at
            BEFORE UPDATE ON enhanced_predictions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- SAMPLE DATA INSERTION (FOR TESTING)
-- ============================================================================

-- Insert sample scrapy news data
INSERT INTO scrapy_news (title, content, url, source, teams, players, sentiment_score, relevance_score, category) VALUES
('Yankees Sign Star Pitcher', 'The New York Yankees have signed ace pitcher...', 'https://example.com/yankees-pitcher', 'ESPN', ARRAY['Yankees'], ARRAY['Gerrit Cole'], 0.8, 0.9, 'trade'),
('Lakers Injury Update', 'LeBron James expected to return next week...', 'https://example.com/lakers-injury', 'NBA.com', ARRAY['Lakers'], ARRAY['LeBron James'], -0.2, 0.7, 'injury')
ON CONFLICT (url) DO NOTHING;

-- Insert sample player stats
INSERT INTO scrapy_player_stats (player_name, team, sport, stat_type, stat_value, data_quality_score) VALUES
('Aaron Judge', 'Yankees', 'baseball', 'batting_average', 0.311, 0.95),
('LeBron James', 'Lakers', 'basketball', 'points_per_game', 25.7, 0.92)
ON CONFLICT DO NOTHING;

-- Insert sample team performance data
INSERT INTO scrapy_team_performance (team_name, sport, performance_metric, metric_value, data_quality_score) VALUES
('Yankees', 'baseball', 'win_percentage', 0.625, 0.90),
('Lakers', 'basketball', 'avg_points_scored', 112.5, 0.88)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PERMISSIONS AND SECURITY
-- ============================================================================

-- Grant appropriate permissions (adjust user names as needed)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO betting_app_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO betting_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO betting_app_user;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Enhanced Sports Betting AI Database Schema Updates Complete!';
    RAISE NOTICE '📊 Created tables: scrapy_news, scrapy_player_stats, scrapy_team_performance, enhanced_predictions';
    RAISE NOTICE '📈 Created monitoring tables: system_health_metrics, workflow_executions, data_quality_metrics';
    RAISE NOTICE '👁️ Created analytics views: enhanced_prediction_analytics, scrapy_data_freshness, system_health_dashboard';
    RAISE NOTICE '⚡ Created indexes for optimal performance';
    RAISE NOTICE '🔧 Created utility functions for data management and quality scoring';
    RAISE NOTICE '🔄 Created triggers for automatic timestamp updates';
    RAISE NOTICE '🎯 Database is ready for enhanced AI system with Scrapy integration!';
END $$;

-- ============================================================================
-- MISSING TABLES FOR ENHANCED AGENTS
-- ============================================================================

-- Create team_odds table that enhanced_teams_agent.py expects
CREATE TABLE IF NOT EXISTS team_odds (
    id SERIAL PRIMARY KEY,
    home_team VARCHAR(200) NOT NULL,
    away_team VARCHAR(200) NOT NULL,
    bet_type VARCHAR(100) NOT NULL, -- moneyline, spread, total
    recommendation VARCHAR(50) NOT NULL, -- home, away, over, under
    odds INTEGER NOT NULL, -- American odds format
    line DECIMAL(10,2), -- Point spread or total line
    event_id UUID NOT NULL, -- Changed to UUID to match sports_events.id
    bookmaker VARCHAR(100) NOT NULL,
    market VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    -- Foreign key reference to sports_events
    CONSTRAINT fk_team_odds_event FOREIGN KEY (event_id) REFERENCES sports_events(id) ON DELETE CASCADE
);

-- Add missing team column to player_props table
DO $$
BEGIN
    -- Check if team column exists in player_props table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'player_props'
        AND column_name = 'team'
    ) THEN
        ALTER TABLE player_props ADD COLUMN team VARCHAR(100);
        RAISE NOTICE 'Added team column to player_props table';
    ELSE
        RAISE NOTICE 'Team column already exists in player_props table';
    END IF;
END $$;

-- Create indexes for the new team_odds table
CREATE INDEX IF NOT EXISTS idx_team_odds_event_id ON team_odds(event_id);
CREATE INDEX IF NOT EXISTS idx_team_odds_home_team ON team_odds(home_team);
CREATE INDEX IF NOT EXISTS idx_team_odds_away_team ON team_odds(away_team);
CREATE INDEX IF NOT EXISTS idx_team_odds_bet_type ON team_odds(bet_type);
CREATE INDEX IF NOT EXISTS idx_team_odds_created_at ON team_odds(created_at DESC);

-- Create index for the new team column in player_props
CREATE INDEX IF NOT EXISTS idx_player_props_team ON player_props(team);

-- Create trigger for team_odds updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_team_odds_updated_at'
        AND tgrelid = 'team_odds'::regclass
    ) THEN
        CREATE TRIGGER update_team_odds_updated_at
            BEFORE UPDATE ON team_odds
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Insert sample team_odds data for testing
INSERT INTO team_odds (home_team, away_team, bet_type, recommendation, odds, line, event_id, bookmaker, market)
SELECT
    home_team,
    away_team,
    'moneyline' as bet_type,
    'home' as recommendation,
    -150 as odds,
    NULL as line,
    id as event_id,
    'DraftKings' as bookmaker,
    'MLB' as market
FROM sports_events
WHERE sport = 'MLB'
AND start_time > CURRENT_TIMESTAMP
LIMIT 10
ON CONFLICT DO NOTHING;

-- Insert sample spread bets
INSERT INTO team_odds (home_team, away_team, bet_type, recommendation, odds, line, event_id, bookmaker, market)
SELECT
    home_team,
    away_team,
    'spread' as bet_type,
    'home' as recommendation,
    -110 as odds,
    -1.5 as line,
    id as event_id,
    'FanDuel' as bookmaker,
    'MLB' as market
FROM sports_events
WHERE sport = 'MLB'
AND start_time > CURRENT_TIMESTAMP
LIMIT 10
ON CONFLICT DO NOTHING;

-- Insert sample total bets
INSERT INTO team_odds (home_team, away_team, bet_type, recommendation, odds, line, event_id, bookmaker, market)
SELECT
    home_team,
    away_team,
    'total' as bet_type,
    'over' as recommendation,
    -105 as odds,
    8.5 as line,
    id as event_id,
    'BetMGM' as bookmaker,
    'MLB' as market
FROM sports_events
WHERE sport = 'MLB'
AND start_time > CURRENT_TIMESTAMP
LIMIT 10
ON CONFLICT DO NOTHING;

-- Update existing player_props with team data where possible
UPDATE player_props
SET team = CASE
    WHEN player_name LIKE '%Yankees%' OR player_name IN (SELECT DISTINCT player_name FROM player_props WHERE player_name LIKE '%Judge%' OR player_name LIKE '%Cole%') THEN 'Yankees'
    WHEN player_name LIKE '%Dodgers%' OR player_name LIKE '%Betts%' OR player_name LIKE '%Freeman%' THEN 'Dodgers'
    WHEN player_name LIKE '%Braves%' OR player_name LIKE '%Acuna%' OR player_name LIKE '%Harris%' THEN 'Braves'
    WHEN player_name LIKE '%Astros%' OR player_name LIKE '%Altuve%' OR player_name LIKE '%Bregman%' THEN 'Astros'
    ELSE 'Unknown'
END
WHERE team IS NULL;

DO $$
BEGIN
    RAISE NOTICE '✅ Enhanced Agents Database Schema Fixes Complete!';
    RAISE NOTICE '📊 Created team_odds table for enhanced_teams_agent.py';
    RAISE NOTICE '⚾ Added team column to player_props table for enhanced_props_agent.py';
    RAISE NOTICE '🔧 Created indexes and triggers for optimal performance';
    RAISE NOTICE '📝 Inserted sample data for testing';
    RAISE NOTICE '🎯 Enhanced agents should now work with correct database schema!';
END $$;
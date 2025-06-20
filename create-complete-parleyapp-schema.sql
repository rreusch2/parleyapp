-- Complete ParleyApp Database Schema
-- This creates all necessary tables for full data persistence

-- ==============================================
-- 1. AI Predictions Table
-- ==============================================
CREATE TABLE IF NOT EXISTS ai_predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    match_teams VARCHAR(255) NOT NULL,
    pick VARCHAR(255) NOT NULL,
    odds VARCHAR(50) NOT NULL,
    confidence INTEGER CHECK (confidence >= 0 AND confidence <= 100),
    sport VARCHAR(50) NOT NULL,
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reasoning TEXT,
    value_percentage DECIMAL(5,2),
    roi_estimate DECIMAL(5,2),
    status VARCHAR(20) CHECK (status IN ('pending', 'won', 'lost', 'cancelled')) DEFAULT 'pending',
    game_id VARCHAR(100), -- External game identifier
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 2. AI Insights Table  
-- ==============================================
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) CHECK (type IN ('trend', 'value', 'alert', 'prediction')) NOT NULL,
    impact VARCHAR(10) CHECK (impact IN ('high', 'medium', 'low')) NOT NULL,
    data JSONB,
    is_global BOOLEAN DEFAULT false, -- Global insights vs user-specific
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 3. User Statistics (Historical Tracking)
-- ==============================================
CREATE TABLE IF NOT EXISTS user_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    total_picks INTEGER DEFAULT 0,
    winning_picks INTEGER DEFAULT 0,
    losing_picks INTEGER DEFAULT 0,
    pending_picks INTEGER DEFAULT 0,
    total_roi DECIMAL(8,2) DEFAULT 0,
    profit_loss DECIMAL(10,2) DEFAULT 0,
    win_streak INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    total_bets_placed INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- ==============================================
-- 4. User Preferences
-- ==============================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    risk_tolerance VARCHAR(20) CHECK (risk_tolerance IN ('low', 'medium', 'high')) DEFAULT 'medium',
    preferred_sports JSONB DEFAULT '[]'::jsonb,
    favorite_teams JSONB DEFAULT '[]'::jsonb,
    preferred_bet_types JSONB DEFAULT '[]'::jsonb,
    bankroll_amount DECIMAL(10,2),
    max_bet_percentage DECIMAL(5,2) DEFAULT 5.0,
    kelly_criterion_enabled BOOLEAN DEFAULT true,
    notifications_enabled BOOLEAN DEFAULT true,
    notification_preferences JSONB DEFAULT '{}'::jsonb,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 5. Betting History
-- ==============================================
CREATE TABLE IF NOT EXISTS betting_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    prediction_id UUID REFERENCES ai_predictions(id),
    bet_amount DECIMAL(10,2) NOT NULL,
    potential_payout DECIMAL(10,2),
    actual_payout DECIMAL(10,2),
    bet_type VARCHAR(100) NOT NULL,
    odds VARCHAR(50) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'won', 'lost', 'cancelled', 'pushed')) DEFAULT 'pending',
    placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settled_at TIMESTAMP WITH TIME ZONE,
    sportsbook VARCHAR(100),
    bet_reference VARCHAR(100), -- External bet ID
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 6. Strategy Performance Tracking
-- ==============================================
CREATE TABLE IF NOT EXISTS strategy_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    strategy_name VARCHAR(100) NOT NULL,
    sport VARCHAR(50),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    total_bets INTEGER DEFAULT 0,
    winning_bets INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2),
    total_roi DECIMAL(8,2),
    profit_loss DECIMAL(10,2),
    kelly_optimal_stakes JSONB,
    backtest_results JSONB,
    confidence_intervals JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 7. Live Games Cache
-- ==============================================
CREATE TABLE IF NOT EXISTS live_games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    external_game_id VARCHAR(100) NOT NULL UNIQUE,
    sport VARCHAR(50) NOT NULL,
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    odds JSONB,
    game_status VARCHAR(50) DEFAULT 'scheduled',
    venue VARCHAR(255),
    weather JSONB,
    injuries JSONB,
    line_movements JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 8. Daily Insights (Already created, but included for completeness)
-- ==============================================
-- This table was already created in the previous schema

-- ==============================================
-- INDEXES for Performance
-- ==============================================

-- AI Predictions indexes
CREATE INDEX IF NOT EXISTS idx_ai_predictions_user_date ON ai_predictions (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_sport ON ai_predictions (sport);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_status ON ai_predictions (status);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_event_time ON ai_predictions (event_time);

-- AI Insights indexes
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_type ON ai_insights (user_id, type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_global ON ai_insights (is_global, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_insights_expires ON ai_insights (expires_at);

-- User Statistics indexes
CREATE INDEX IF NOT EXISTS idx_user_statistics_user_date ON user_statistics (user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_statistics_date ON user_statistics (date);

-- Betting History indexes
CREATE INDEX IF NOT EXISTS idx_betting_history_user_date ON betting_history (user_id, placed_at);
CREATE INDEX IF NOT EXISTS idx_betting_history_prediction ON betting_history (prediction_id);
CREATE INDEX IF NOT EXISTS idx_betting_history_status ON betting_history (status);

-- Strategy Performance indexes
CREATE INDEX IF NOT EXISTS idx_strategy_performance_user ON strategy_performance (user_id, strategy_name);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_sport ON strategy_performance (sport, date_to);

-- Live Games indexes
CREATE INDEX IF NOT EXISTS idx_live_games_sport_time ON live_games (sport, event_time);
CREATE INDEX IF NOT EXISTS idx_live_games_external_id ON live_games (external_game_id);
CREATE INDEX IF NOT EXISTS idx_live_games_updated ON live_games (last_updated);

-- ==============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================

-- Enable RLS on all user-specific tables
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE betting_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_performance ENABLE ROW LEVEL SECURITY;

-- AI Predictions policies
CREATE POLICY "Users can view their own predictions" ON ai_predictions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own predictions" ON ai_predictions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own predictions" ON ai_predictions
    FOR UPDATE USING (auth.uid() = user_id);

-- AI Insights policies (includes global insights)
CREATE POLICY "Users can view their insights and global insights" ON ai_insights
    FOR SELECT USING (auth.uid() = user_id OR is_global = true);
CREATE POLICY "Users can insert their own insights" ON ai_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own insights" ON ai_insights
    FOR UPDATE USING (auth.uid() = user_id);

-- User Statistics policies
CREATE POLICY "Users can view their own statistics" ON user_statistics
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own statistics" ON user_statistics
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own statistics" ON user_statistics
    FOR UPDATE USING (auth.uid() = user_id);

-- User Preferences policies
CREATE POLICY "Users can view their own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- Betting History policies
CREATE POLICY "Users can view their own betting history" ON betting_history
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own betting history" ON betting_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own betting history" ON betting_history
    FOR UPDATE USING (auth.uid() = user_id);

-- Strategy Performance policies
CREATE POLICY "Users can view their own strategy performance" ON strategy_performance
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own strategy performance" ON strategy_performance
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own strategy performance" ON strategy_performance
    FOR UPDATE USING (auth.uid() = user_id);

-- Live Games (public data, no RLS needed)
ALTER TABLE live_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view live games" ON live_games FOR SELECT USING (true);

-- ==============================================
-- TRIGGERS for Auto-updating timestamps
-- ==============================================

-- Update triggers for all tables
CREATE TRIGGER update_ai_predictions_updated_at 
    BEFORE UPDATE ON ai_predictions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_insights_updated_at 
    BEFORE UPDATE ON ai_insights 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_statistics_updated_at 
    BEFORE UPDATE ON user_statistics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_betting_history_updated_at 
    BEFORE UPDATE ON betting_history 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategy_performance_updated_at 
    BEFORE UPDATE ON strategy_performance 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- HELPER FUNCTIONS
-- ==============================================

-- Function to calculate current user stats
CREATE OR REPLACE FUNCTION get_user_current_stats(user_uuid UUID)
RETURNS TABLE(
    today_picks INTEGER,
    win_rate DECIMAL,
    roi DECIMAL,
    current_streak INTEGER,
    total_bets INTEGER,
    profit_loss DECIMAL
) AS $$
DECLARE
    today_date DATE := CURRENT_DATE;
    last_stat RECORD;
BEGIN
    -- Get today's picks
    SELECT COUNT(*) INTO today_picks
    FROM ai_predictions 
    WHERE user_id = user_uuid 
    AND DATE(created_at) = today_date;

    -- Get latest statistics record
    SELECT * INTO last_stat
    FROM user_statistics 
    WHERE user_id = user_uuid 
    ORDER BY date DESC 
    LIMIT 1;

    IF last_stat IS NOT NULL THEN
        win_rate := CASE 
            WHEN (last_stat.winning_picks + last_stat.losing_picks) > 0 
            THEN (last_stat.winning_picks::DECIMAL / (last_stat.winning_picks + last_stat.losing_picks)) * 100
            ELSE 0 
        END;
        roi := last_stat.total_roi;
        current_streak := last_stat.current_streak;
        total_bets := last_stat.total_bets_placed;
        profit_loss := last_stat.profit_loss;
    ELSE
        win_rate := 0;
        roi := 0;
        current_streak := 0;
        total_bets := 0;
        profit_loss := 0;
    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- COMMENTS for Documentation
-- ==============================================

COMMENT ON TABLE ai_predictions IS 'Stores AI-generated betting predictions with outcomes';
COMMENT ON TABLE ai_insights IS 'Stores AI-generated insights and market intelligence';
COMMENT ON TABLE user_statistics IS 'Daily aggregated user performance statistics';
COMMENT ON TABLE user_preferences IS 'User betting preferences and risk settings';
COMMENT ON TABLE betting_history IS 'Complete betting transaction history';
COMMENT ON TABLE strategy_performance IS 'Historical performance data for betting strategies';
COMMENT ON TABLE live_games IS 'Cached live game data with odds and conditions';
COMMENT ON TABLE daily_insights IS 'Daily AI-generated insights for users'; 
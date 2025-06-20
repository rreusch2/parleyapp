-- Extended ParleyApp Schema for Player Props, Over/Under, and Parlays
-- Run this after the main schema to add new betting types

-- ==============================================
-- 1. Player Props Tables
-- ==============================================

-- Players table for storing player information
CREATE TABLE IF NOT EXISTS players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    external_player_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(50),
    team VARCHAR(100),
    sport VARCHAR(50) NOT NULL,
    jersey_number INTEGER,
    active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player statistics for tracking performance
CREATE TABLE IF NOT EXISTS player_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    game_id VARCHAR(100),
    date DATE NOT NULL,
    sport VARCHAR(50) NOT NULL,
    season VARCHAR(20),
    stats JSONB NOT NULL, -- Flexible stats storage
    game_context JSONB, -- Home/away, opponent, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player prop markets
CREATE TABLE IF NOT EXISTS player_prop_markets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    game_id VARCHAR(100) NOT NULL,
    market_type VARCHAR(100) NOT NULL, -- 'points', 'rebounds', 'assists', 'passing_yards', etc.
    line_value DECIMAL(6,2) NOT NULL, -- The prop line (e.g., 25.5 points)
    over_odds VARCHAR(20),
    under_odds VARCHAR(20),
    sportsbook VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 2. Over/Under (Totals) Markets
-- ==============================================

-- Game totals (over/under for entire games)
CREATE TABLE IF NOT EXISTS game_totals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id VARCHAR(100) NOT NULL,
    sport VARCHAR(50) NOT NULL,
    home_team VARCHAR(100),
    away_team VARCHAR(100),
    event_time TIMESTAMP WITH TIME ZONE,
    total_line DECIMAL(6,2) NOT NULL, -- e.g., 225.5 total points
    over_odds VARCHAR(20),
    under_odds VARCHAR(20),
    sportsbook VARCHAR(100),
    market_status VARCHAR(20) DEFAULT 'active', -- active, suspended, settled
    actual_total DECIMAL(6,2), -- Final result
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team totals (over/under for individual teams)
CREATE TABLE IF NOT EXISTS team_totals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id VARCHAR(100) NOT NULL,
    team VARCHAR(100) NOT NULL,
    sport VARCHAR(50) NOT NULL,
    total_line DECIMAL(6,2) NOT NULL,
    over_odds VARCHAR(20),
    under_odds VARCHAR(20),
    sportsbook VARCHAR(100),
    market_status VARCHAR(20) DEFAULT 'active',
    actual_total DECIMAL(6,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 3. Parlay System
-- ==============================================

-- Parlay bet slips
CREATE TABLE IF NOT EXISTS parlays (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    parlay_name VARCHAR(255),
    total_legs INTEGER NOT NULL,
    combined_odds VARCHAR(20), -- e.g., "+450"
    decimal_odds DECIMAL(8,3), -- 5.50
    stake_amount DECIMAL(10,2),
    potential_payout DECIMAL(10,2),
    status VARCHAR(20) CHECK (status IN ('pending', 'won', 'lost', 'cancelled', 'pushed')) DEFAULT 'pending',
    legs_won INTEGER DEFAULT 0,
    legs_lost INTEGER DEFAULT 0,
    legs_pending INTEGER,
    is_same_game_parlay BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual parlay legs
CREATE TABLE IF NOT EXISTS parlay_legs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parlay_id UUID REFERENCES parlays(id) ON DELETE CASCADE,
    leg_number INTEGER NOT NULL, -- Position in parlay
    bet_type VARCHAR(50) NOT NULL, -- 'moneyline', 'spread', 'total', 'player_prop'
    market_reference_id UUID, -- Links to specific market table
    selection VARCHAR(255) NOT NULL, -- "Lakers ML", "Over 25.5 points", etc.
    odds VARCHAR(20) NOT NULL,
    decimal_odds DECIMAL(8,3),
    status VARCHAR(20) CHECK (status IN ('pending', 'won', 'lost', 'pushed')) DEFAULT 'pending',
    game_info JSONB, -- Game details for display
    player_info JSONB, -- Player details if player prop
    result_value DECIMAL(6,2), -- Actual result for verification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 4. Enhanced AI Predictions for New Bet Types
-- ==============================================

-- Extend ai_predictions to support new bet types
ALTER TABLE ai_predictions 
ADD COLUMN IF NOT EXISTS bet_type VARCHAR(50) DEFAULT 'moneyline',
ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id),
ADD COLUMN IF NOT EXISTS prop_market_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS line_value DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS prediction_value DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS is_parlay_leg BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parlay_id UUID REFERENCES parlays(id);

-- ==============================================
-- 5. Indexes for New Tables
-- ==============================================

-- Players indexes
CREATE INDEX IF NOT EXISTS idx_players_external_id ON players (external_player_id);
CREATE INDEX IF NOT EXISTS idx_players_team_sport ON players (team, sport);
CREATE INDEX IF NOT EXISTS idx_players_name ON players (name);

-- Player statistics indexes
CREATE INDEX IF NOT EXISTS idx_player_stats_player_date ON player_statistics (player_id, date);
CREATE INDEX IF NOT EXISTS idx_player_stats_game ON player_statistics (game_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_sport_season ON player_statistics (sport, season);

-- Player prop markets indexes
CREATE INDEX IF NOT EXISTS idx_player_props_player_game ON player_prop_markets (player_id, game_id);
CREATE INDEX IF NOT EXISTS idx_player_props_market_type ON player_prop_markets (market_type);
CREATE INDEX IF NOT EXISTS idx_player_props_active ON player_prop_markets (is_active, expires_at);

-- Game totals indexes
CREATE INDEX IF NOT EXISTS idx_game_totals_game_sport ON game_totals (game_id, sport);
CREATE INDEX IF NOT EXISTS idx_game_totals_status ON game_totals (market_status);

-- Team totals indexes
CREATE INDEX IF NOT EXISTS idx_team_totals_game_team ON team_totals (game_id, team);

-- Parlay indexes
CREATE INDEX IF NOT EXISTS idx_parlays_user_status ON parlays (user_id, status);
CREATE INDEX IF NOT EXISTS idx_parlays_created ON parlays (created_at);

-- Parlay legs indexes
CREATE INDEX IF NOT EXISTS idx_parlay_legs_parlay ON parlay_legs (parlay_id, leg_number);
CREATE INDEX IF NOT EXISTS idx_parlay_legs_status ON parlay_legs (status);

-- ==============================================
-- 6. RLS Policies for New Tables
-- ==============================================

-- Enable RLS
ALTER TABLE parlays ENABLE ROW LEVEL SECURITY;
ALTER TABLE parlay_legs ENABLE ROW LEVEL SECURITY;

-- Parlay policies
CREATE POLICY "Users can view their own parlays" ON parlays
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own parlay legs" ON parlay_legs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM parlays 
      WHERE parlays.id = parlay_legs.parlay_id 
      AND parlays.user_id = auth.uid()
    )
  );

-- ==============================================
-- 7. Helper Functions
-- ==============================================

-- Function to calculate parlay odds
CREATE OR REPLACE FUNCTION calculate_parlay_odds(parlay_uuid UUID)
RETURNS DECIMAL(8,3) AS $$
DECLARE
    combined_odds DECIMAL(8,3) := 1.0;
    leg_odds DECIMAL(8,3);
BEGIN
    FOR leg_odds IN 
        SELECT decimal_odds 
        FROM parlay_legs 
        WHERE parlay_id = parlay_uuid 
        ORDER BY leg_number
    LOOP
        combined_odds := combined_odds * leg_odds;
    END LOOP;
    
    RETURN combined_odds;
END;
$$ LANGUAGE plpgsql;

-- Function to update parlay status based on legs
CREATE OR REPLACE FUNCTION update_parlay_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE parlays 
    SET 
        legs_won = (SELECT COUNT(*) FROM parlay_legs WHERE parlay_id = NEW.parlay_id AND status = 'won'),
        legs_lost = (SELECT COUNT(*) FROM parlay_legs WHERE parlay_id = NEW.parlay_id AND status = 'lost'),
        legs_pending = (SELECT COUNT(*) FROM parlay_legs WHERE parlay_id = NEW.parlay_id AND status = 'pending')
    WHERE id = NEW.parlay_id;
    
    -- Update overall parlay status
    UPDATE parlays 
    SET status = CASE
        WHEN legs_lost > 0 THEN 'lost'
        WHEN legs_pending = 0 AND legs_lost = 0 THEN 'won'
        ELSE 'pending'
    END
    WHERE id = NEW.parlay_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update parlay status when legs change
CREATE TRIGGER update_parlay_status_trigger
    AFTER INSERT OR UPDATE ON parlay_legs
    FOR EACH ROW
    EXECUTE FUNCTION update_parlay_status();

-- ==============================================
-- 8. Sample Data for Testing
-- ==============================================

-- Insert sample players
INSERT INTO players (external_player_id, name, position, team, sport, jersey_number) VALUES
('nba_lebron_james', 'LeBron James', 'Forward', 'Los Angeles Lakers', 'NBA', 23),
('nba_stephen_curry', 'Stephen Curry', 'Guard', 'Golden State Warriors', 'NBA', 30),
('nfl_tom_brady', 'Tom Brady', 'Quarterback', 'Tampa Bay Buccaneers', 'NFL', 12),
('mlb_aaron_judge', 'Aaron Judge', 'Outfielder', 'New York Yankees', 'MLB', 99)
ON CONFLICT (external_player_id) DO NOTHING;

-- Sample player prop markets
INSERT INTO player_prop_markets (player_id, game_id, market_type, line_value, over_odds, under_odds, sportsbook)
SELECT 
    p.id, 
    'game_123',
    'points',
    25.5,
    '-110',
    '-110',
    'DraftKings'
FROM players p WHERE p.external_player_id = 'nba_lebron_james'
ON CONFLICT DO NOTHING; 
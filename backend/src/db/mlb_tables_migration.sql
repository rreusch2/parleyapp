-- Migration: Add MLB Statistics Tables
-- Run this to add tables needed for pybaseball data integration

-- Team Season Statistics Table
CREATE TABLE IF NOT EXISTS team_season_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id VARCHAR(100) NOT NULL, -- Using team abbreviation (e.g., 'NYY', 'LAD')
    season VARCHAR(20) NOT NULL,
    stats_avg JSONB NOT NULL DEFAULT '{}', -- Season averages and totals
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, season)
);

-- Team Game Results Table (for historical game data)
CREATE TABLE IF NOT EXISTS team_game_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team VARCHAR(10) NOT NULL, -- Team abbreviation
    season INTEGER NOT NULL,
    game_date DATE NOT NULL,
    opponent VARCHAR(10) NOT NULL,
    result VARCHAR(1), -- 'W', 'L', 'T'
    runs_scored INTEGER,
    runs_allowed INTEGER,
    record VARCHAR(20), -- e.g., '95-67'
    winning_pitcher VARCHAR(100),
    losing_pitcher VARCHAR(100),
    save_pitcher VARCHAR(100),
    attendance INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team, game_date, opponent)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_season_stats_team ON team_season_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_team_season_stats_season ON team_season_stats(season);
CREATE INDEX IF NOT EXISTS idx_team_game_results_team ON team_game_results(team);
CREATE INDEX IF NOT EXISTS idx_team_game_results_season ON team_game_results(season);
CREATE INDEX IF NOT EXISTS idx_team_game_results_date ON team_game_results(game_date);

-- Add MLB-specific player prop types
INSERT INTO player_prop_types (prop_key, prop_name, sport_key, stat_category, unit) VALUES
    ('hits', 'Hits', 'MLB', 'batting', 'hits'),
    ('runs', 'Runs Scored', 'MLB', 'scoring', 'runs'),
    ('rbi', 'RBIs', 'MLB', 'batting', 'rbi'),
    ('home_runs', 'Home Runs', 'MLB', 'batting', 'home_runs'),
    ('stolen_bases', 'Stolen Bases', 'MLB', 'baserunning', 'stolen_bases'),
    ('strikeouts_pitched', 'Strikeouts (Pitcher)', 'MLB', 'pitching', 'strikeouts'),
    ('innings_pitched', 'Innings Pitched', 'MLB', 'pitching', 'innings'),
    ('walks_allowed', 'Walks Allowed', 'MLB', 'pitching', 'walks'),
    ('hits_allowed', 'Hits Allowed', 'MLB', 'pitching', 'hits')
ON CONFLICT (prop_key) DO NOTHING;

-- Add trigger for team_season_stats updated_at
CREATE TRIGGER update_team_season_stats_updated_at BEFORE UPDATE ON team_season_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 
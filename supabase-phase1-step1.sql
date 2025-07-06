-- Predictive Play Phase 1 Migration - STEP 1: Base Tables Only
-- Run this first to create the foundation tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sports configuration table
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

-- Insert sports
INSERT INTO sports_config (sport_key, sport_name, is_active) VALUES
    ('americanfootball_nfl', 'NFL', true),
    ('basketball_nba', 'NBA', true),
    ('baseball_mlb', 'MLB', true),
    ('icehockey_nhl', 'NHL', true)
ON CONFLICT (sport_key) DO NOTHING;

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

-- Create market types table
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

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Step 1 completed successfully! Run step 2 next.';
END $$; 
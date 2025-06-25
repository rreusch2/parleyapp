-- Create historical_games table for ML training data
-- This keeps training data separate from live upcoming games

CREATE TABLE IF NOT EXISTS public.historical_games (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    
    -- Game identifiers
    external_game_id character varying UNIQUE NOT NULL,
    sport character varying NOT NULL,
    league character varying NOT NULL,
    season character varying,
    
    -- Teams
    home_team character varying NOT NULL,
    away_team character varying NOT NULL,
    
    -- Game time
    game_date timestamp with time zone NOT NULL,
    
    -- Final scores (for completed games)
    home_score integer NOT NULL,
    away_score integer NOT NULL,
    
    -- Betting lines at close
    ml_home_close numeric,
    ml_away_close numeric,
    spread_line_close numeric,
    spread_home_odds_close numeric,
    spread_away_odds_close numeric,
    total_line_close numeric,
    total_over_odds_close numeric,
    total_under_odds_close numeric,
    
    -- Opening lines (if available)
    ml_home_open numeric,
    ml_away_open numeric,
    spread_line_open numeric,
    total_line_open numeric,
    
    -- Game metadata
    venue character varying,
    attendance integer,
    weather_conditions jsonb,
    
    -- Data source
    source character varying DEFAULT 'theodds_api',
    ingested_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT historical_games_pkey PRIMARY KEY (id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_historical_games_sport ON public.historical_games(sport);
CREATE INDEX idx_historical_games_game_date ON public.historical_games(game_date);
CREATE INDEX idx_historical_games_teams ON public.historical_games(home_team, away_team);
CREATE INDEX idx_historical_games_external_id ON public.historical_games(external_game_id);

-- Add comments
COMMENT ON TABLE public.historical_games IS 'Historical completed games with scores and closing odds for ML model training';
COMMENT ON COLUMN public.historical_games.ml_home_close IS 'Moneyline odds for home team at close';
COMMENT ON COLUMN public.historical_games.spread_line_close IS 'Point spread at close (negative = home favored)';
COMMENT ON COLUMN public.historical_games.total_line_close IS 'Over/under total at close'; 
-- Team Trends Database Schema
-- Creates unified team performance tracking using TheOdds API historical scores

-- 1. Create team_recent_stats table for team performance tracking
CREATE TABLE IF NOT EXISTS team_recent_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id),
    team_name VARCHAR NOT NULL,
    sport VARCHAR NOT NULL,
    sport_key VARCHAR NOT NULL,
    game_date DATE NOT NULL,
    opponent_team VARCHAR NOT NULL,
    opponent_team_id UUID REFERENCES teams(id),
    is_home BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Game Results
    team_score INTEGER NOT NULL DEFAULT 0,
    opponent_score INTEGER NOT NULL DEFAULT 0,
    game_result VARCHAR(1) NOT NULL CHECK (game_result IN ('W', 'L', 'T')), -- Win/Loss/Tie
    margin INTEGER NOT NULL DEFAULT 0, -- Score difference (positive = win margin)
    
    -- Betting Results
    spread_line DECIMAL(4,1), -- The spread they had to cover
    spread_result VARCHAR(1) CHECK (spread_result IN ('W', 'L', 'P')), -- Win/Loss/Push against spread
    total_line DECIMAL(5,1), -- Over/under line for game total
    total_result VARCHAR(1) CHECK (total_result IN ('O', 'U', 'P')), -- Over/Under/Push
    
    -- Performance Metrics
    offensive_performance DECIMAL(5,2), -- Team score relative to season average
    defensive_performance DECIMAL(5,2), -- Opponent score relative to their average
    
    -- Game Context
    venue VARCHAR,
    weather_conditions JSONB,
    external_game_id VARCHAR, -- TheOdds API game ID
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(team_id, game_date, opponent_team_id)
);

-- 2. Create indexes for fast team trends queries
CREATE INDEX IF NOT EXISTS idx_team_recent_stats_team_sport_date 
ON team_recent_stats(team_id, sport_key, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_team_recent_stats_sport_date 
ON team_recent_stats(sport_key, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_team_recent_stats_team_date 
ON team_recent_stats(team_id, game_date DESC);

-- 3. Create trigger to maintain only last 15 games per team
CREATE OR REPLACE FUNCTION maintain_team_stats_limit() 
RETURNS TRIGGER AS $$
BEGIN
  -- Delete oldest records if team has more than 15 games
  WITH ranked_stats AS (
    SELECT id, 
           ROW_NUMBER() OVER (
             PARTITION BY team_id, sport_key 
             ORDER BY game_date DESC
           ) as row_num
    FROM team_recent_stats 
    WHERE team_id = NEW.team_id 
      AND sport_key = NEW.sport_key
  )
  DELETE FROM team_recent_stats 
  WHERE id IN (
    SELECT id FROM ranked_stats WHERE row_num > 15
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_maintain_team_stats_limit ON team_recent_stats;
CREATE TRIGGER trigger_maintain_team_stats_limit
AFTER INSERT ON team_recent_stats
FOR EACH ROW EXECUTE FUNCTION maintain_team_stats_limit();

-- 4. Create team trends view for easy frontend access
CREATE OR REPLACE VIEW team_trends_data AS
WITH recent_games AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY team_id, sport_key 
           ORDER BY game_date DESC
         ) as game_rank
  FROM team_recent_stats
),
team_performance AS (
  SELECT 
    team_id,
    sport_key,
    COUNT(*) as games_played,
    SUM(CASE WHEN game_result = 'W' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN game_result = 'L' THEN 1 ELSE 0 END) as losses,
    ROUND(AVG(team_score), 1) as avg_points_for,
    ROUND(AVG(opponent_score), 1) as avg_points_against,
    ROUND(AVG(margin), 1) as avg_margin,
    SUM(CASE WHEN spread_result = 'W' THEN 1 ELSE 0 END) as ats_wins,
    SUM(CASE WHEN spread_result = 'L' THEN 1 ELSE 0 END) as ats_losses,
    SUM(CASE WHEN total_result = 'O' THEN 1 ELSE 0 END) as over_results,
    SUM(CASE WHEN total_result = 'U' THEN 1 ELSE 0 END) as under_results
  FROM recent_games 
  WHERE game_rank <= 10
  GROUP BY team_id, sport_key
)
SELECT 
  t.id as team_id,
  t.team_name,
  t.team_abbreviation,
  t.city,
  t.sport_key,
  tp.games_played,
  tp.wins,
  tp.losses,
  ROUND((tp.wins::DECIMAL / NULLIF(tp.games_played, 0)) * 100, 1) as win_percentage,
  tp.avg_points_for,
  tp.avg_points_against,
  tp.avg_margin,
  tp.ats_wins,
  tp.ats_losses,
  CASE 
    WHEN (tp.ats_wins + tp.ats_losses) > 0 
    THEN ROUND((tp.ats_wins::DECIMAL / (tp.ats_wins + tp.ats_losses)) * 100, 1)
    ELSE 0
  END as ats_percentage,
  tp.over_results,
  tp.under_results,
  -- Trend indicators
  CASE 
    WHEN tp.avg_margin > 5 THEN 'strong_offense'
    WHEN tp.avg_margin < -5 THEN 'weak_defense' 
    WHEN ROUND((tp.wins::DECIMAL / NULLIF(tp.games_played, 0)) * 100, 1) > 70 THEN 'hot_streak'
    WHEN ROUND((tp.wins::DECIMAL / NULLIF(tp.games_played, 0)) * 100, 1) < 30 THEN 'cold_streak'
    ELSE 'stable'
  END as trend_indicator
FROM teams t
JOIN team_performance tp ON t.id = tp.team_id
ORDER BY t.sport_key, win_percentage DESC;

-- 5. Create function to get team-specific trends (similar to player trends)
CREATE OR REPLACE FUNCTION get_team_trend_data(
  p_team_id UUID,
  p_trend_type VARCHAR DEFAULT 'wins',
  p_limit INTEGER DEFAULT 10
) 
RETURNS TABLE (
  game_date DATE,
  opponent VARCHAR,
  is_home BOOLEAN,
  trend_value DECIMAL,
  trend_line DECIMAL,
  hit_trend BOOLEAN
) AS $$
BEGIN
  CASE p_trend_type
    WHEN 'wins' THEN
      RETURN QUERY
      SELECT 
        trs.game_date,
        trs.opponent_team,
        trs.is_home,
        CASE WHEN trs.game_result = 'W' THEN 1 ELSE 0 END::DECIMAL as trend_value,
        0.5::DECIMAL as trend_line, -- 50% baseline
        (trs.game_result = 'W') as hit_trend
      FROM team_recent_stats trs
      WHERE trs.team_id = p_team_id
      ORDER BY trs.game_date DESC
      LIMIT p_limit;
      
    WHEN 'ats_covers' THEN
      RETURN QUERY
      SELECT 
        trs.game_date,
        trs.opponent_team,
        trs.is_home,
        CASE WHEN trs.spread_result = 'W' THEN 1 ELSE 0 END::DECIMAL as trend_value,
        0.5::DECIMAL as trend_line,
        (trs.spread_result = 'W') as hit_trend
      FROM team_recent_stats trs
      WHERE trs.team_id = p_team_id 
        AND trs.spread_result IS NOT NULL
      ORDER BY trs.game_date DESC
      LIMIT p_limit;
      
    WHEN 'total_points' THEN
      RETURN QUERY
      SELECT 
        trs.game_date,
        trs.opponent_team,
        trs.is_home,
        trs.team_score::DECIMAL as trend_value,
        COALESCE(
          (SELECT AVG(team_score) FROM team_recent_stats WHERE team_id = p_team_id), 
          0
        )::DECIMAL as trend_line,
        (trs.team_score >= COALESCE(
          (SELECT AVG(team_score) FROM team_recent_stats WHERE team_id = p_team_id), 
          0
        )) as hit_trend
      FROM team_recent_stats trs
      WHERE trs.team_id = p_team_id
      ORDER BY trs.game_date DESC
      LIMIT p_limit;
      
    WHEN 'over_under' THEN
      RETURN QUERY
      SELECT 
        trs.game_date,
        trs.opponent_team,
        trs.is_home,
        (trs.team_score + trs.opponent_score)::DECIMAL as trend_value,
        COALESCE(trs.total_line, 0) as trend_line,
        CASE 
          WHEN trs.total_line IS NOT NULL 
          THEN (trs.team_score + trs.opponent_score) > trs.total_line
          ELSE FALSE
        END as hit_trend
      FROM team_recent_stats trs
      WHERE trs.team_id = p_team_id
        AND trs.total_line IS NOT NULL
      ORDER BY trs.game_date DESC
      LIMIT p_limit;
      
    ELSE
      RETURN;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to get trending teams by sport
CREATE OR REPLACE FUNCTION get_trending_teams(
  p_sport_key VARCHAR DEFAULT 'MLB',
  p_trend_type VARCHAR DEFAULT 'hot_streak',
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  team_name VARCHAR,
  team_abbreviation VARCHAR,
  city VARCHAR,
  wins BIGINT,
  losses BIGINT,
  win_percentage NUMERIC,
  avg_margin NUMERIC,
  ats_percentage NUMERIC,
  trend_indicator TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ttd.team_name,
    ttd.team_abbreviation,
    ttd.city,
    ttd.wins,
    ttd.losses,
    ttd.win_percentage,
    ttd.avg_margin,
    ttd.ats_percentage,
    ttd.trend_indicator
  FROM team_trends_data ttd
  WHERE ttd.sport_key = p_sport_key
    AND (
      CASE p_trend_type
        WHEN 'hot_streak' THEN ttd.win_percentage > 60
        WHEN 'cold_streak' THEN ttd.win_percentage < 40
        WHEN 'ats_hot' THEN ttd.ats_percentage > 60
        WHEN 'ats_cold' THEN ttd.ats_percentage < 40
        ELSE TRUE
      END
    )
  ORDER BY 
    CASE p_trend_type
      WHEN 'hot_streak' THEN ttd.win_percentage
      WHEN 'ats_hot' THEN ttd.ats_percentage
      WHEN 'cold_streak' THEN 100 - ttd.win_percentage
      WHEN 'ats_cold' THEN 100 - ttd.ats_percentage
      ELSE ttd.win_percentage
    END DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Usage examples:
-- SELECT * FROM team_trends_data WHERE sport_key = 'MLB';
-- SELECT * FROM get_team_trend_data('team-uuid', 'wins', 10);
-- SELECT * FROM get_trending_teams('MLB', 'hot_streak', 5);

-- Optimal Database Schema for Unified Player Stats System
-- Run this SQL in Supabase SQL Editor to optimize your trends system

-- 1. Add performance indexes to player_recent_stats table
CREATE INDEX IF NOT EXISTS idx_player_recent_stats_player_sport_date 
ON player_recent_stats(player_id, sport, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_player_recent_stats_sport_date 
ON player_recent_stats(sport, game_date DESC);

CREATE INDEX IF NOT EXISTS idx_player_recent_stats_player_date 
ON player_recent_stats(player_id, game_date DESC);

-- 2. Add constraint to ensure data quality
ALTER TABLE player_recent_stats 
ADD CONSTRAINT check_valid_game_date 
CHECK (game_date IS NOT NULL AND game_date <= CURRENT_DATE);

-- 3. Create function to automatically maintain last 15 games per player
CREATE OR REPLACE FUNCTION maintain_recent_stats_limit() 
RETURNS TRIGGER AS $$
BEGIN
  -- Delete oldest records if player has more than 15 games in this sport
  WITH ranked_stats AS (
    SELECT id, 
           ROW_NUMBER() OVER (
             PARTITION BY player_id, sport 
             ORDER BY game_date DESC
           ) as row_num
    FROM player_recent_stats 
    WHERE player_id = NEW.player_id 
      AND sport = NEW.sport
  )
  DELETE FROM player_recent_stats 
  WHERE id IN (
    SELECT id FROM ranked_stats WHERE row_num > 15
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger to automatically cleanup old data
DROP TRIGGER IF EXISTS trigger_maintain_recent_stats_limit ON player_recent_stats;
CREATE TRIGGER trigger_maintain_recent_stats_limit
AFTER INSERT ON player_recent_stats
FOR EACH ROW EXECUTE FUNCTION maintain_recent_stats_limit();

-- 5. Create view for easy trends data access (last 10 games per player)
CREATE OR REPLACE VIEW player_trends_data AS
WITH recent_games AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY player_id, sport 
           ORDER BY game_date DESC
         ) as game_rank
  FROM player_recent_stats
)
SELECT 
  p.id as player_id,
  p.name as player_name,
  p.team,
  p.sport,
  p.position,
  rg.game_date,
  rg.opponent,
  rg.is_home,
  rg.game_result,
  -- MLB Stats
  rg.hits,
  rg.at_bats,
  rg.home_runs,
  rg.rbis,
  rg.runs_scored,
  rg.stolen_bases,
  rg.strikeouts,
  rg.walks,
  rg.total_bases,
  -- NBA/WNBA Stats  
  rg.points,
  rg.rebounds,
  rg.assists,
  rg.steals,
  rg.blocks,
  rg.three_pointers,
  rg.minutes_played,
  -- NFL Stats
  rg.passing_yards,
  rg.rushing_yards,
  rg.receiving_yards,
  rg.receptions,
  rg.passing_tds,
  rg.rushing_tds,
  rg.receiving_tds,
  -- Pitching Stats
  rg.innings_pitched,
  rg.strikeouts_pitcher,
  rg.hits_allowed,
  rg.walks_allowed,
  rg.earned_runs,
  -- UFC/MMA Stats
  rg.significant_strikes,
  rg.takedowns,
  rg.game_rank
FROM recent_games rg
JOIN players p ON rg.player_id = p.id
WHERE rg.game_rank <= 10  -- Last 10 games only
ORDER BY p.name, rg.game_date DESC;

-- 6. Create function to get prop-specific trends for any player/sport
CREATE OR REPLACE FUNCTION get_player_prop_trend(
  p_player_id UUID,
  p_sport TEXT,
  p_prop_type TEXT,
  p_limit INTEGER DEFAULT 10
) 
RETURNS TABLE (
  game_date DATE,
  opponent TEXT,
  is_home BOOLEAN,
  prop_value NUMERIC,
  prop_line NUMERIC,
  hit_prop BOOLEAN
) AS $$
BEGIN
  -- Dynamic query based on prop type
  CASE p_prop_type
    WHEN 'hits' THEN
      RETURN QUERY
      SELECT 
        prd.game_date,
        prd.opponent,
        prd.is_home,
        prd.hits::NUMERIC as prop_value,
        COALESCE(ppo.line, 0) as prop_line,
        (prd.hits >= COALESCE(ppo.line, 0)) as hit_prop
      FROM player_recent_stats prd
      LEFT JOIN player_props_odds ppo ON ppo.player_id = p_player_id 
        AND ppo.prop_type_id = (
          SELECT id FROM player_prop_types WHERE prop_key = 'batter_hits'
        )
      WHERE prd.player_id = p_player_id 
        AND prd.sport = p_sport
      ORDER BY prd.game_date DESC
      LIMIT p_limit;
      
    WHEN 'points' THEN
      RETURN QUERY
      SELECT 
        prd.game_date,
        prd.opponent,
        prd.is_home,
        prd.points::NUMERIC as prop_value,
        COALESCE(ppo.line, 0) as prop_line,
        (prd.points >= COALESCE(ppo.line, 0)) as hit_prop
      FROM player_recent_stats prd
      LEFT JOIN player_props_odds ppo ON ppo.player_id = p_player_id 
        AND ppo.prop_type_id = (
          SELECT id FROM player_prop_types WHERE prop_key = 'player_points'
        )
      WHERE prd.player_id = p_player_id 
        AND prd.sport = p_sport
      ORDER BY prd.game_date DESC
      LIMIT p_limit;
      
    WHEN 'receiving_yards' THEN
      RETURN QUERY
      SELECT 
        prd.game_date,
        prd.opponent,
        prd.is_home,
        prd.receiving_yards::NUMERIC as prop_value,
        COALESCE(ppo.line, 0) as prop_line,
        (prd.receiving_yards >= COALESCE(ppo.line, 0)) as hit_prop
      FROM player_recent_stats prd
      LEFT JOIN player_props_odds ppo ON ppo.player_id = p_player_id 
        AND ppo.prop_type_id = (
          SELECT id FROM player_prop_types WHERE prop_key = 'player_receiving_yards'
        )
      WHERE prd.player_id = p_player_id 
        AND prd.sport = p_sport
      ORDER BY prd.game_date DESC
      LIMIT p_limit;
      
    -- Add more prop types as needed
    ELSE
      RETURN;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 7. Create materialized view for fast trend calculations
CREATE MATERIALIZED VIEW IF NOT EXISTS player_trend_metrics AS
WITH player_stats AS (
  SELECT 
    player_id,
    sport,
    COUNT(*) as games_played,
    -- MLB averages
    AVG(NULLIF(hits, 0)) as avg_hits,
    AVG(NULLIF(home_runs, 0)) as avg_home_runs,
    AVG(NULLIF(rbis, 0)) as avg_rbis,
    AVG(NULLIF(runs_scored, 0)) as avg_runs,
    -- NBA/WNBA averages
    AVG(NULLIF(points, 0)) as avg_points,
    AVG(NULLIF(rebounds, 0)) as avg_rebounds,
    AVG(NULLIF(assists, 0)) as avg_assists,
    -- NFL averages
    AVG(NULLIF(receiving_yards, 0)) as avg_receiving_yards,
    AVG(NULLIF(rushing_yards, 0)) as avg_rushing_yards,
    AVG(NULLIF(passing_yards, 0)) as avg_passing_yards,
    -- Last 5 games averages for trending
    AVG(CASE WHEN ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date DESC) <= 5 
        THEN NULLIF(hits, 0) END) as last_5_hits,
    AVG(CASE WHEN ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date DESC) <= 5 
        THEN NULLIF(points, 0) END) as last_5_points,
    MAX(game_date) as last_game_date
  FROM player_recent_stats
  GROUP BY player_id, sport
)
SELECT 
  ps.*,
  p.name as player_name,
  p.team,
  -- Calculate trend direction
  CASE 
    WHEN ps.sport = 'MLB' AND ps.last_5_hits > ps.avg_hits * 1.1 THEN 'trending_up'
    WHEN ps.sport = 'MLB' AND ps.last_5_hits < ps.avg_hits * 0.9 THEN 'trending_down'
    WHEN ps.sport IN ('NBA', 'WNBA') AND ps.last_5_points > ps.avg_points * 1.1 THEN 'trending_up'
    WHEN ps.sport IN ('NBA', 'WNBA') AND ps.last_5_points < ps.avg_points * 0.9 THEN 'trending_down'
    ELSE 'stable'
  END as trend_direction
FROM player_stats ps
JOIN players p ON ps.player_id = p.id
WHERE ps.games_played >= 3;  -- Only include players with at least 3 games

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_trend_metrics_player_sport 
ON player_trend_metrics(player_id, sport);

-- 8. Function to refresh trend metrics (call this daily)
CREATE OR REPLACE FUNCTION refresh_trend_metrics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY player_trend_metrics;
END;
$$ LANGUAGE plpgsql;

-- 9. Create RLS policies if needed (optional - based on your security requirements)
-- Enable RLS
-- ALTER TABLE player_recent_stats ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all stats
-- CREATE POLICY "Users can read player stats" ON player_recent_stats
--   FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for service role to manage all stats  
-- CREATE POLICY "Service role can manage stats" ON player_recent_stats
--   FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 10. Create helpful utility functions
CREATE OR REPLACE FUNCTION get_trending_players(p_sport TEXT DEFAULT 'MLB', p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  player_name TEXT,
  team TEXT,
  sport TEXT,
  trend_direction TEXT,
  games_played BIGINT,
  avg_key_stat NUMERIC,
  last_5_avg NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ptm.player_name,
    ptm.team,
    ptm.sport,
    ptm.trend_direction,
    ptm.games_played,
    CASE 
      WHEN p_sport = 'MLB' THEN ptm.avg_hits
      WHEN p_sport IN ('NBA', 'WNBA') THEN ptm.avg_points
      ELSE 0
    END as avg_key_stat,
    CASE 
      WHEN p_sport = 'MLB' THEN ptm.last_5_hits
      WHEN p_sport IN ('NBA', 'WNBA') THEN ptm.last_5_points
      ELSE 0
    END as last_5_avg
  FROM player_trend_metrics ptm
  WHERE ptm.sport = p_sport
    AND ptm.trend_direction IN ('trending_up', 'trending_down')
  ORDER BY 
    CASE WHEN ptm.trend_direction = 'trending_up' THEN 1 ELSE 2 END,
    ptm.games_played DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Usage examples (run these to test):
-- SELECT * FROM player_trends_data WHERE sport = 'MLB' AND player_name ILIKE '%harper%' LIMIT 10;
-- SELECT * FROM get_player_prop_trend('player-uuid', 'MLB', 'hits', 10);
-- SELECT * FROM get_trending_players('MLB', 10);
-- SELECT refresh_trend_metrics();

-- Performance check query
SELECT 
  schemaname,
  tablename,
  attname as column_name,
  n_distinct,
  correlation
FROM pg_stats 
WHERE tablename = 'player_recent_stats'
ORDER BY n_distinct DESC;

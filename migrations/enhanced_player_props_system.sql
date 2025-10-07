-- ============================================================================
-- COMPREHENSIVE PLAYER PROPS SYSTEM - Database Migration
-- Adds NHL, NBA, headshot support, and optimizes for alternate lines
-- ============================================================================

-- Step 1: Add headshot support to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS headshot_url varchar,
ADD COLUMN IF NOT EXISTS headshot_source varchar,  -- 'espn', 'nba', 'mlb', 'nhl'
ADD COLUMN IF NOT EXISTS headshot_last_updated timestamptz;

-- Add index for faster player matching
CREATE INDEX IF NOT EXISTS idx_players_normalized_name_team_sport 
ON players(normalized_name, team, sport);

CREATE INDEX IF NOT EXISTS idx_players_external_id 
ON players(external_player_id);

-- Step 2: Create comprehensive sport prop mappings table
CREATE TABLE IF NOT EXISTS sport_prop_mappings_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport varchar NOT NULL,  -- 'MLB', 'NFL', 'NBA', 'NHL', etc.
  theodds_market_key varchar NOT NULL,  -- Exact key from TheOdds API
  display_name varchar NOT NULL,  -- User-friendly name
  stat_category varchar,  -- 'scoring', 'passing', 'rebounding'
  has_alternates boolean DEFAULT false,  -- Does this prop have alt lines?
  alternate_market_key varchar,  -- e.g., 'alternate_player_points'
  default_lines numeric[],  -- Common lines
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,  -- Display order (higher = more important)
  created_at timestamptz DEFAULT now(),
  UNIQUE(sport, theodds_market_key)
);

-- Step 3: Populate comprehensive prop mappings
INSERT INTO sport_prop_mappings_v2 (sport, theodds_market_key, display_name, stat_category, has_alternates, alternate_market_key, default_lines, priority) VALUES

-- ================== MLB (6 main props) ==================
('MLB', 'batter_hits', 'Hits', 'batting', true, 'alternate_batter_hits', '{0.5, 1.5, 2.5}', 100),
('MLB', 'batter_total_bases', 'Total Bases', 'batting', true, 'alternate_batter_total_bases', '{1.5, 2.5, 3.5}', 90),
('MLB', 'batter_home_runs', 'Home Runs', 'batting', true, 'alternate_batter_home_runs', '{0.5, 1.5}', 95),
('MLB', 'batter_rbis', 'RBIs', 'batting', true, 'alternate_batter_rbis', '{0.5, 1.5, 2.5}', 85),
('MLB', 'batter_runs_scored', 'Runs Scored', 'batting', true, 'alternate_batter_runs_scored', '{0.5, 1.5}', 80),
('MLB', 'pitcher_strikeouts', 'Strikeouts (P)', 'pitching', true, 'alternate_pitcher_strikeouts', '{4.5, 5.5, 6.5, 7.5}', 100),

-- ================== NHL (5 main props) - NEW! ==================
('NHL', 'player_points', 'Points (G+A)', 'scoring', true, 'alternate_player_points', '{0.5, 1.5, 2.5}', 100),
('NHL', 'player_goals', 'Goals', 'scoring', true, 'alternate_player_goals', '{0.5, 1.5}', 95),
('NHL', 'player_assists', 'Assists', 'playmaking', true, 'alternate_player_assists', '{0.5, 1.5}', 90),
('NHL', 'player_shots_on_goal', 'Shots on Goal', 'shooting', true, 'alternate_player_shots_on_goal', '{2.5, 3.5, 4.5}', 80),
('NHL', 'player_saves', 'Saves (Goalie)', 'goaltending', true, 'alternate_player_saves', '{24.5, 29.5, 34.5}', 85),

-- ================== NBA (10 main props) - NEW! ==================
('NBA', 'player_points', 'Points', 'scoring', true, 'alternate_player_points', '{19.5, 24.5, 29.5, 34.5}', 100),
('NBA', 'player_rebounds', 'Rebounds', 'rebounding', true, 'alternate_player_rebounds', '{5.5, 7.5, 9.5, 11.5}', 95),
('NBA', 'player_assists', 'Assists', 'playmaking', true, 'alternate_player_assists', '{3.5, 5.5, 7.5, 9.5}', 95),
('NBA', 'player_threes', '3-Pointers Made', 'scoring', true, 'alternate_player_threes', '{1.5, 2.5, 3.5, 4.5}', 90),
('NBA', 'player_blocks', 'Blocks', 'defense', true, 'alternate_player_blocks', '{0.5, 1.5, 2.5}', 75),
('NBA', 'player_steals', 'Steals', 'defense', true, 'alternate_player_steals', '{0.5, 1.5, 2.5}', 75),
('NBA', 'player_turnovers', 'Turnovers', 'ball_handling', true, 'alternate_player_turnovers', '{2.5, 3.5, 4.5}', 70),
('NBA', 'player_double_double', 'Double-Double', 'combined', false, null, null, 80),
('NBA', 'player_triple_double', 'Triple-Double', 'combined', false, null, null, 70),
('NBA', 'player_points_rebounds_assists', 'Pts+Reb+Ast', 'combined', true, 'alternate_player_points_rebounds_assists', '{29.5, 34.5, 39.5, 44.5}', 90),

-- ================== NFL (14 main props) ==================
('NFL', 'player_pass_yds', 'Passing Yards', 'passing', true, 'alternate_player_pass_yds', '{224.5, 249.5, 274.5, 299.5}', 100),
('NFL', 'player_pass_tds', 'Passing TDs', 'passing', true, 'alternate_player_pass_tds', '{0.5, 1.5, 2.5}', 100),
('NFL', 'player_pass_completions', 'Completions', 'passing', true, 'alternate_player_pass_completions', '{19.5, 22.5, 25.5}', 85),
('NFL', 'player_pass_attempts', 'Pass Attempts', 'passing', true, 'alternate_player_pass_attempts', '{29.5, 34.5, 39.5}', 75),
('NFL', 'player_pass_interceptions', 'Interceptions', 'passing', false, null, '{0.5, 1.5}', 70),
('NFL', 'player_rush_yds', 'Rushing Yards', 'rushing', true, 'alternate_player_rush_yds', '{39.5, 49.5, 59.5, 69.5}', 95),
('NFL', 'player_rush_attempts', 'Rush Attempts', 'rushing', true, 'alternate_player_rush_attempts', '{9.5, 12.5, 15.5}', 80),
('NFL', 'player_rush_tds', 'Rushing TDs', 'rushing', true, 'alternate_player_rush_tds', '{0.5, 1.5}', 90),
('NFL', 'player_reception_yds', 'Receiving Yards', 'receiving', true, 'alternate_player_reception_yds', '{39.5, 49.5, 59.5, 69.5}', 95),
('NFL', 'player_receptions', 'Receptions', 'receiving', true, 'alternate_player_receptions', '{3.5, 4.5, 5.5, 6.5}', 90),
('NFL', 'player_reception_tds', 'Receiving TDs', 'receiving', true, 'alternate_player_reception_tds', '{0.5, 1.5}', 90),
('NFL', 'player_kicking_points', 'Kicking Points', 'kicking', false, null, '{6.5, 8.5}', 75),
('NFL', 'player_anytime_td', 'Anytime TD', 'scoring', false, null, null, 85),
('NFL', 'player_1st_td', 'First TD', 'scoring', false, null, null, 80),

-- ================== CFB (14 main props) ==================
('CFB', 'player_pass_yds', 'Passing Yards', 'passing', true, 'alternate_player_pass_yds', '{224.5, 249.5, 274.5}', 100),
('CFB', 'player_pass_tds', 'Passing TDs', 'passing', true, 'alternate_player_pass_tds', '{0.5, 1.5, 2.5}', 100),
('CFB', 'player_rush_yds', 'Rushing Yards', 'rushing', true, 'alternate_player_rush_yds', '{39.5, 49.5, 59.5}', 95),
('CFB', 'player_reception_yds', 'Receiving Yards', 'receiving', true, 'alternate_player_reception_yds', '{39.5, 49.5, 59.5}', 95),
('CFB', 'player_receptions', 'Receptions', 'receiving', true, 'alternate_player_receptions', '{3.5, 4.5, 5.5}', 90),
('CFB', 'player_anytime_td', 'Anytime TD', 'scoring', false, null, null, 85),

-- ================== WNBA (3 main props) ==================
('WNBA', 'player_points', 'Points', 'scoring', false, null, '{14.5, 19.5, 24.5}', 100),
('WNBA', 'player_rebounds', 'Rebounds', 'rebounding', false, null, '{5.5, 7.5, 9.5}', 95),
('WNBA', 'player_assists', 'Assists', 'playmaking', false, null, '{3.5, 5.5, 7.5}', 90),

-- ================== Soccer (5 props - limited availability) ==================
('SOCCER', 'player_shots_on_goal', 'Shots on Goal', 'shooting', false, null, '{0.5, 1.5, 2.5}', 90),
('SOCCER', 'player_anytime_goalscorer', 'Anytime Goal', 'scoring', false, null, null, 100),
('SOCCER', 'player_shots', 'Total Shots', 'shooting', false, null, '{1.5, 2.5, 3.5}', 80),
('SOCCER', 'player_tackles', 'Tackles', 'defense', false, null, '{2.5, 3.5, 4.5}', 70),
('SOCCER', 'player_passes', 'Completed Passes', 'playmaking', false, null, '{29.5, 34.5, 39.5}', 65)

ON CONFLICT (sport, theodds_market_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  stat_category = EXCLUDED.stat_category,
  has_alternates = EXCLUDED.has_alternates,
  alternate_market_key = EXCLUDED.alternate_market_key,
  default_lines = EXCLUDED.default_lines,
  priority = EXCLUDED.priority;

-- Step 4: Add indexes to player_props_v2 for better performance
CREATE INDEX IF NOT EXISTS idx_player_props_v2_event 
ON player_props_v2(event_id);

CREATE INDEX IF NOT EXISTS idx_player_props_v2_player 
ON player_props_v2(player_id);

CREATE INDEX IF NOT EXISTS idx_player_props_v2_sport_date 
ON player_props_v2(sport, game_date);

CREATE INDEX IF NOT EXISTS idx_player_props_v2_stat_type 
ON player_props_v2(stat_type);

-- GIN index for JSONB columns (fast queries on alt_lines)
CREATE INDEX IF NOT EXISTS idx_player_props_v2_alt_lines 
ON player_props_v2 USING gin(alt_lines);

CREATE INDEX IF NOT EXISTS idx_player_props_v2_main_over_odds 
ON player_props_v2 USING gin(main_over_odds);

-- Step 5: Add comments for documentation
COMMENT ON TABLE sport_prop_mappings_v2 IS 'Comprehensive mapping of TheOdds API market keys to display names with alternate line support';
COMMENT ON COLUMN sport_prop_mappings_v2.theodds_market_key IS 'Exact market key from TheOdds API (e.g., player_points, batter_hits)';
COMMENT ON COLUMN sport_prop_mappings_v2.has_alternates IS 'Whether this prop type has alternate lines available from TheOdds API';
COMMENT ON COLUMN sport_prop_mappings_v2.alternate_market_key IS 'Market key for alternate lines (e.g., alternate_player_points)';

COMMENT ON COLUMN players.headshot_url IS 'URL to player headshot image (from ESPN, NBA.com, MLB.com, etc.)';
COMMENT ON COLUMN players.headshot_source IS 'Source of headshot: espn, nba, mlb, nhl, sportsradar';
COMMENT ON COLUMN players.headshot_last_updated IS 'Last time headshot was fetched/updated';

COMMENT ON COLUMN player_props_v2.alt_lines IS 'JSON array of alternate lines with odds: {lines: [{line: 24.5, over_odds: {fanduel: -110}, under_odds: {fanduel: -110}}]}';
COMMENT ON COLUMN player_props_v2.main_over_odds IS 'JSON object of over odds by bookmaker: {fanduel: -110, draftkings: -115}';
COMMENT ON COLUMN player_props_v2.main_under_odds IS 'JSON object of under odds by bookmaker: {fanduel: -110, draftkings: -105}';

-- Step 6: Create view for easy querying with player info and headshots
CREATE OR REPLACE VIEW player_props_with_details AS
SELECT 
  pp.id,
  pp.event_id,
  pp.sport,
  pp.game_date,
  pp.stat_type,
  pp.main_line,
  pp.main_over_odds,
  pp.main_under_odds,
  pp.best_over_odds,
  pp.best_over_book,
  pp.best_under_odds,
  pp.best_under_book,
  pp.alt_lines,
  pp.opponent_team,
  pp.is_home,
  pp.num_bookmakers,
  pp.line_movement,
  pp.last_updated,
  
  -- Player info
  p.id as player_id,
  p.name as player_name,
  p.normalized_name,
  p.team as player_team,
  p.position,
  p.headshot_url,  -- NEW!
  p.headshot_source,
  p.jersey_number,
  
  -- Event info
  se.home_team,
  se.away_team,
  se.start_time,
  
  -- Prop mapping info
  spm.display_name as prop_display_name,
  spm.stat_category,
  spm.has_alternates,
  spm.priority as prop_priority
  
FROM player_props_v2 pp
LEFT JOIN players p ON pp.player_id = p.id
LEFT JOIN sports_events se ON pp.event_id = se.id
LEFT JOIN sport_prop_mappings_v2 spm ON pp.stat_type = spm.theodds_market_key AND pp.sport = spm.sport
ORDER BY pp.game_date DESC, spm.priority DESC NULLS LAST, pp.last_updated DESC;

COMMENT ON VIEW player_props_with_details IS 'Complete view of player props with player details (including headshots), event info, and prop type mappings';

-- Step 7: Create function to get best alternate line for a target
CREATE OR REPLACE FUNCTION get_best_alt_line(
  prop_alt_lines jsonb,
  target_line numeric,
  direction text  -- 'over' or 'under'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  best_line jsonb;
  line_obj jsonb;
  current_odds numeric;
  best_odds numeric := -9999;
BEGIN
  -- Loop through alt_lines.lines array
  FOR line_obj IN SELECT jsonb_array_elements(prop_alt_lines->'lines')
  LOOP
    -- Check if this line matches target
    IF (line_obj->>'line')::numeric = target_line THEN
      -- Get odds for direction
      IF direction = 'over' THEN
        current_odds := (line_obj->'over_odds'->>'fanduel')::numeric;
      ELSE
        current_odds := (line_obj->'under_odds'->>'fanduel')::numeric;
      END IF;
      
      -- Track best odds
      IF current_odds > best_odds THEN
        best_odds := current_odds;
        best_line := line_obj;
      END IF;
    END IF;
  END LOOP;
  
  RETURN best_line;
END;
$$;

COMMENT ON FUNCTION get_best_alt_line IS 'Find the best alternate line matching a target value with best odds';

-- Step 8: Grant permissions
GRANT SELECT ON sport_prop_mappings_v2 TO anon, authenticated, service_role;
GRANT SELECT ON player_props_with_details TO anon, authenticated, service_role;

-- ============================================================================
-- Migration Complete!
-- 
-- New Features Added:
-- ✅ NHL support (5 prop types + alternates)
-- ✅ NBA support (10 prop types + alternates)
-- ✅ Player headshot URLs with source tracking
-- ✅ Comprehensive prop mappings with alternate line support
-- ✅ Optimized indexes for performance
-- ✅ View for easy querying with all details
-- ✅ Helper function for finding best alternate lines
-- 
-- Next Steps:
-- 1. Update multiSportConfig.ts to add NHL and NBA
-- 2. Update setupOddsIntegration.ts to fetch alternate lines
-- 3. Create playerHeadshots.ts service for fetching headshots
-- 4. Update AI scripts to query player_props_v2
-- ============================================================================

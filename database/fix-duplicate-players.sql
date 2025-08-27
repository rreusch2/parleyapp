-- Fix duplicate players and consolidate Patrick Mahomes records
-- Run this SQL migration to fix the trends tab issues

BEGIN;

-- Step 1: Update the record with game stats to have the correct team info from the good record
UPDATE players 
SET 
  team = 'KC',
  updated_at = NOW()
WHERE id = '2e334022-c501-4ba1-9005-b2188e3bb4cb' 
  AND name = 'Patrick Mahomes';

-- Step 2: Link the headshot to the record that has the game stats
UPDATE player_headshots 
SET 
  player_id = '2e334022-c501-4ba1-9005-b2188e3bb4cb',
  last_updated = NOW()
WHERE player_id = 'd6985744-4b27-44a2-8d20-6a6a57df628d';

-- Step 3: Delete the duplicate player record that has no game stats
DELETE FROM players 
WHERE id = 'd6985744-4b27-44a2-8d20-6a6a57df628d' 
  AND name = 'Patrick Mahomes';

-- Step 4: Fix any other NFL players with missing team info by consolidating duplicates
WITH duplicate_players AS (
  SELECT 
    p1.id as id_without_team,
    p2.id as id_with_team,
    p1.name,
    p2.team,
    COUNT(pgs1.id) as stats_count_1,
    COUNT(pgs2.id) as stats_count_2
  FROM players p1
  JOIN players p2 ON LOWER(p1.name) = LOWER(p2.name) 
    AND p1.sport = p2.sport 
    AND p1.id != p2.id
  LEFT JOIN player_game_stats pgs1 ON p1.id = pgs1.player_id
  LEFT JOIN player_game_stats pgs2 ON p2.id = pgs2.player_id
  WHERE p1.sport = 'NFL' 
    AND (p1.team IS NULL OR p1.team = '') 
    AND p2.team IS NOT NULL 
    AND p2.team != ''
  GROUP BY p1.id, p2.id, p1.name, p2.team
)
UPDATE players p1
SET team = dp.team
FROM duplicate_players dp
WHERE p1.id = dp.id_without_team 
  AND dp.stats_count_1 > dp.stats_count_2;

-- Step 5: Drop existing view first, then create new one
DROP VIEW IF EXISTS players_with_headshots CASCADE;

-- Create a view for better player search that prevents duplicates
CREATE VIEW players_with_headshots AS
SELECT DISTINCT ON (LOWER(p.name), p.sport)
  p.id,
  p.name,
  p.team,
  p.sport,
  p.position,
  p.external_player_id,
  p.active,
  ph.headshot_url,
  CASE WHEN ph.is_active = true THEN true ELSE false END as has_headshot,
  COUNT(pgs.id) as recent_games_count,
  MAX(pgs.created_at) as last_game_date
FROM players p
LEFT JOIN player_headshots ph ON p.id = ph.player_id AND ph.is_active = true
LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
WHERE p.active IS NOT FALSE
GROUP BY p.id, p.name, p.team, p.sport, p.position, p.external_player_id, p.active, ph.headshot_url, ph.is_active
ORDER BY LOWER(p.name), p.sport, recent_games_count DESC, has_headshot DESC;

-- Step 6: Add index for better search performance
CREATE INDEX IF NOT EXISTS idx_players_name_sport_search 
ON players (LOWER(name), sport, team) 
WHERE active IS NOT FALSE;

COMMIT;

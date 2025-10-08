-- Script to backfill game_info with team abbreviations for existing predictions
-- Run this if you ever need to update predictions with game info

-- Backfill game_info with team abbreviations from teams table
UPDATE ai_predictions ap
SET metadata = jsonb_set(
  COALESCE(ap.metadata, '{}'::jsonb),
  '{game_info}',
  jsonb_build_object(
    'away_team', se.away_team,
    'home_team', se.home_team,
    'away_team_abbr', COALESCE(at.team_abbreviation, se.away_team),
    'home_team_abbr', COALESCE(ht.team_abbreviation, se.home_team),
    'start_time', se.start_time::text
  )
)
FROM sports_events se
LEFT JOIN teams ht ON se.home_team = ht.team_name
LEFT JOIN teams at ON se.away_team = at.team_name
WHERE ap.game_id = se.id::text
  AND ap.bet_type = 'player_prop'
  AND se.away_team IS NOT NULL
  AND se.home_team IS NOT NULL;

-- Verify the update
SELECT 
  COUNT(*) as total_props,
  COUNT(CASE WHEN metadata->'game_info' IS NOT NULL THEN 1 END) as with_game_info,
  COUNT(CASE WHEN metadata->'game_info' IS NULL THEN 1 END) as without_game_info,
  COUNT(CASE WHEN metadata->'game_info'->>'away_team_abbr' IS NOT NULL THEN 1 END) as with_abbreviations
FROM ai_predictions
WHERE bet_type = 'player_prop'
AND created_at > NOW() - INTERVAL '7 days';

-- Check sample results
SELECT 
  sport,
  metadata->'game_info'->>'away_team' as away,
  metadata->'game_info'->>'away_team_abbr' as away_abbr,
  metadata->'game_info'->>'home_team' as home,
  metadata->'game_info'->>'home_team_abbr' as home_abbr
FROM ai_predictions
WHERE bet_type = 'player_prop'
ORDER BY created_at DESC
LIMIT 10;


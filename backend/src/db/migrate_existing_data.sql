-- Migration Script: Existing Data to Enhanced Schema
-- Phase 1 Data Layer Foundation

-- This script migrates data from the existing simple schema to the enhanced schema
-- Run this AFTER applying enhanced_schema.sql

BEGIN;

-- 1. Migrate sports_events data to new structure
-- First, insert any missing sports configurations
INSERT INTO sports_config (sport_key, sport_name)
SELECT DISTINCT 
    sport,
    CASE 
        WHEN sport = 'NFL' THEN 'National Football League'
        WHEN sport = 'NBA' THEN 'National Basketball Association'
        WHEN sport = 'MLB' THEN 'Major League Baseball'
        WHEN sport = 'NHL' THEN 'National Hockey League'
        ELSE sport
    END
FROM sports_events
ON CONFLICT (sport_key) DO NOTHING;

-- 2. Extract and create teams from existing events
-- Insert home teams
INSERT INTO teams (team_key, team_name, sport_key)
SELECT DISTINCT 
    LOWER(REPLACE(home_team, ' ', '_')),
    home_team,
    sport
FROM sports_events
ON CONFLICT (team_key) DO NOTHING;

-- Insert away teams
INSERT INTO teams (team_key, team_name, sport_key)
SELECT DISTINCT 
    LOWER(REPLACE(away_team, ' ', '_')),
    away_team,
    sport
FROM sports_events
ON CONFLICT (team_key) DO NOTHING;

-- 3. Create temporary mapping table for migration
CREATE TEMP TABLE event_migration_map AS
SELECT 
    se.id as old_id,
    se.sport,
    se.league,
    se.home_team,
    se.away_team,
    se.start_time,
    se.status,
    se.created_at,
    se.updated_at,
    ht.id as home_team_id,
    at.id as away_team_id,
    COALESCE(se.stats->>'venue', 'Unknown') as venue,
    COALESCE(se.stats->>'city', 'Unknown') as venue_city,
    se.stats
FROM sports_events se
JOIN teams ht ON ht.team_name = se.home_team AND ht.sport_key = se.sport
JOIN teams at ON at.team_name = se.away_team AND at.sport_key = se.sport;

-- 4. Rename old sports_events table
ALTER TABLE sports_events RENAME TO sports_events_old;

-- 5. Create new sports_events table (from enhanced schema)
-- Note: This should already exist from enhanced_schema.sql
-- If not, you need to run enhanced_schema.sql first

-- 6. Insert data into new sports_events table
INSERT INTO sports_events (
    id,
    external_event_id,
    sport_key,
    league,
    home_team_id,
    away_team_id,
    start_time,
    venue,
    venue_city,
    status,
    metadata,
    created_at,
    updated_at
)
SELECT 
    old_id,
    COALESCE(stats->>'external_event_id', old_id::text),
    sport,
    league,
    home_team_id,
    away_team_id,
    start_time,
    venue,
    venue_city,
    status,
    stats,
    created_at,
    updated_at
FROM event_migration_map;

-- 7. Update any existing scores
UPDATE sports_events se
SET 
    final_home_score = CASE 
        WHEN (se.metadata->>'home_score') IS NOT NULL 
        THEN (se.metadata->>'home_score')::INTEGER 
        ELSE NULL 
    END,
    final_away_score = CASE 
        WHEN (se.metadata->>'away_score') IS NOT NULL 
        THEN (se.metadata->>'away_score')::INTEGER 
        ELSE NULL 
    END
WHERE se.metadata->>'home_score' IS NOT NULL;

-- 8. Migrate predictions table to ai_predictions
INSERT INTO ai_predictions (
    id,
    prediction_type,
    event_id,
    predicted_value,
    predicted_outcome,
    confidence_score,
    model_name,
    created_at,
    expires_at,
    result_status
)
SELECT 
    p.id,
    CASE 
        WHEN p.metadata->>'type' = 'player_prop' THEN 'player_prop'
        WHEN p.pick LIKE '%spread%' THEN 'spread'
        WHEN p.pick LIKE '%over%' OR p.pick LIKE '%under%' THEN 'total'
        ELSE 'moneyline'
    END,
    p.event_id,
    0.0, -- We don't have predicted values in old schema
    p.pick,
    COALESCE(p.confidence / 100.0, 0.5),
    'legacy_model',
    p.created_at,
    p.expires_at,
    p.status
FROM predictions p
WHERE EXISTS (
    SELECT 1 FROM sports_events se WHERE se.id = p.event_id
);

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(team_name);
CREATE INDEX IF NOT EXISTS idx_teams_sport_name ON teams(sport_key, team_name);

-- 10. Update sequences to avoid ID conflicts
SELECT setval('sports_events_id_seq', (SELECT MAX(id) FROM sports_events));
SELECT setval('teams_id_seq', (SELECT MAX(id) FROM teams));
SELECT setval('ai_predictions_id_seq', (SELECT MAX(id) FROM ai_predictions));

-- 11. Add RLS policies for new tables (matching existing pattern)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE odds_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_props_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_predictions ENABLE ROW LEVEL SECURITY;

-- Public read access for reference data
CREATE POLICY "Public can view teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public can view sports" ON sports_config FOR SELECT USING (true);
CREATE POLICY "Public can view bookmakers" ON bookmakers FOR SELECT USING (true);
CREATE POLICY "Public can view odds" ON odds_data FOR SELECT USING (true);

-- User-specific policies for predictions
CREATE POLICY "Users can view own AI predictions"
    ON ai_predictions FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- 12. Clean up
DROP TABLE event_migration_map;

-- 13. Validate migration
DO $$
DECLARE
    old_count INTEGER;
    new_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO old_count FROM sports_events_old;
    SELECT COUNT(*) INTO new_count FROM sports_events;
    
    IF old_count != new_count THEN
        RAISE EXCEPTION 'Migration failed: Event count mismatch (old: %, new: %)', 
            old_count, new_count;
    END IF;
    
    RAISE NOTICE 'Migration successful: % events migrated', new_count;
END $$;

COMMIT;

-- After verification, you can drop the old table:
-- DROP TABLE sports_events_old CASCADE; 
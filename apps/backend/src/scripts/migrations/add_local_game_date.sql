-- Add local_game_date column to sports_events table
-- This stores the date in US Eastern Time for consistent game date tracking
-- regardless of UTC midnight boundaries

ALTER TABLE sports_events 
ADD COLUMN IF NOT EXISTS local_game_date DATE;

-- Create index for efficient queries by game date
CREATE INDEX IF NOT EXISTS idx_sports_events_local_game_date 
ON sports_events(local_game_date);

-- Backfill existing data: Convert UTC start_time to ET and extract date
-- ET is UTC-5 (EST) or UTC-4 (EDT)
UPDATE sports_events 
SET local_game_date = (start_time AT TIME ZONE 'America/New_York')::DATE
WHERE local_game_date IS NULL;

-- Update player_props_v2 to add local_game_date if needed
ALTER TABLE player_props_v2 
ADD COLUMN IF NOT EXISTS local_game_date DATE;

CREATE INDEX IF NOT EXISTS idx_player_props_v2_local_game_date 
ON player_props_v2(local_game_date);

-- Backfill player_props_v2 from related sports_events
UPDATE player_props_v2 pp
SET local_game_date = se.local_game_date
FROM sports_events se
WHERE pp.event_id = se.id AND pp.local_game_date IS NULL;



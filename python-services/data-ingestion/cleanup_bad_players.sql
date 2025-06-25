-- Clean up invalid player records created during testing
-- Remove players with names like "Over" or "Under" that were incorrectly parsed

-- First, check what bad players exist
SELECT id, name, external_player_id, team, sport 
FROM players 
WHERE name IN ('Over', 'Under') 
   OR name LIKE 'Over (%' 
   OR name LIKE 'Under (%'
   OR external_player_id LIKE '%_Over'
   OR external_player_id LIKE '%_Under';

-- Delete player_props_odds records for these bad players first (due to foreign key)
DELETE FROM player_props_odds 
WHERE player_id IN (
    SELECT id FROM players 
    WHERE name IN ('Over', 'Under') 
       OR name LIKE 'Over (%' 
       OR name LIKE 'Under (%'
       OR external_player_id LIKE '%_Over'
       OR external_player_id LIKE '%_Under'
);

-- Now delete the bad players
DELETE FROM players 
WHERE name IN ('Over', 'Under') 
   OR name LIKE 'Over (%' 
   OR name LIKE 'Under (%'
   OR external_player_id LIKE '%_Over'
   OR external_player_id LIKE '%_Under';

-- Verify cleanup
SELECT COUNT(*) as remaining_bad_players
FROM players 
WHERE name IN ('Over', 'Under') 
   OR name LIKE 'Over (%' 
   OR name LIKE 'Under (%'
   OR external_player_id LIKE '%_Over'
   OR external_player_id LIKE '%_Under'; 
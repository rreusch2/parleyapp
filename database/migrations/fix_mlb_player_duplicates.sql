-- Migration to fix MLB player duplicates and standardize sport/sport_key values
-- This will consolidate all MLB players under consistent sport='MLB' and sport_key='baseball_mlb'

BEGIN;

-- Step 1: Create a temporary table to identify the canonical player for each name
CREATE TEMP TABLE player_consolidation AS
WITH ranked_players AS (
    SELECT 
        id,
        name,
        LOWER(TRIM(name)) as normalized_name,
        team,
        sport,
        sport_key,
        position,
        created_at,
        -- Prioritize records with team data, then MLB sport, then oldest created_at
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(name))
            ORDER BY 
                CASE WHEN team IS NOT NULL AND team != '' THEN 0 ELSE 1 END,
                CASE WHEN sport = 'MLB' THEN 0 ELSE 1 END,
                created_at ASC NULLS LAST
        ) as rn
    FROM players
    WHERE sport IN ('MLB', 'BASEBALL_MLB')
)
SELECT 
    normalized_name,
    id as canonical_id,
    name as canonical_name,
    team as canonical_team
FROM ranked_players
WHERE rn = 1;

-- Step 2: Create mapping of all duplicate IDs to canonical IDs
CREATE TEMP TABLE player_id_mapping AS
SELECT 
    p.id as old_id,
    pc.canonical_id as new_id,
    p.name,
    p.sport,
    p.sport_key
FROM players p
JOIN player_consolidation pc ON LOWER(TRIM(p.name)) = pc.normalized_name
WHERE p.sport IN ('MLB', 'BASEBALL_MLB');

-- Step 3a: Update player_trends_data to use canonical player IDs
UPDATE player_trends_data ptd
SET player_id = pim.new_id
FROM player_id_mapping pim
WHERE ptd.player_id = pim.old_id
  AND pim.old_id != pim.new_id;

-- Step 3b: Update player_game_stats to use canonical player IDs
UPDATE player_game_stats pgs
SET player_id = pim.new_id
FROM player_id_mapping pim
WHERE pgs.player_id = pim.old_id
  AND pim.old_id != pim.new_id;

-- Step 4a: Update player_headshots to use canonical player IDs
UPDATE player_headshots ph
SET player_id = pim.new_id
FROM player_id_mapping pim
WHERE ph.player_id = pim.old_id
  AND pim.old_id != pim.new_id;

-- Step 4b: Update player_props_odds to use canonical player IDs
UPDATE player_props_odds ppo
SET player_id = pim.new_id
FROM player_id_mapping pim
WHERE ppo.player_id = pim.old_id
  AND pim.old_id != pim.new_id;

-- Step 5: Update any other tables that reference player_id
-- Note: mlb_batting_stats and mlb_pitching_stats tables don't exist in this database

-- Step 6: Delete duplicate player records (keep only canonical)
DELETE FROM players
WHERE id IN (
    SELECT old_id 
    FROM player_id_mapping 
    WHERE old_id != new_id
);

-- Step 7: Standardize all remaining MLB players to consistent values
UPDATE players
SET 
    sport = 'MLB',
    sport_key = 'baseball_mlb'
WHERE sport IN ('MLB', 'BASEBALL_MLB');

-- Step 8: Fix known team assignments based on actual MLB rosters
-- This is a sample of corrections - add more as needed
UPDATE players
SET team = CASE
    WHEN LOWER(name) = 'bobby witt jr.' THEN 'Kansas City Royals'
    WHEN LOWER(name) = 'aaron judge' THEN 'New York Yankees'
    WHEN LOWER(name) = 'mike trout' THEN 'Los Angeles Angels'
    WHEN LOWER(name) = 'shohei ohtani' THEN 'Los Angeles Dodgers'
    WHEN LOWER(name) = 'ronald acuna jr.' THEN 'Atlanta Braves'
    WHEN LOWER(name) = 'mookie betts' THEN 'Los Angeles Dodgers'
    WHEN LOWER(name) = 'freddie freeman' THEN 'Los Angeles Dodgers'
    WHEN LOWER(name) = 'juan soto' THEN 'New York Yankees'
    WHEN LOWER(name) = 'jose altuve' THEN 'Houston Astros'
    WHEN LOWER(name) = 'yordan alvarez' THEN 'Houston Astros'
    WHEN LOWER(name) = 'fernando tatis jr.' THEN 'San Diego Padres'
    WHEN LOWER(name) = 'manny machado' THEN 'San Diego Padres'
    WHEN LOWER(name) = 'corey seager' THEN 'Texas Rangers'
    WHEN LOWER(name) = 'marcus semien' THEN 'Texas Rangers'
    WHEN LOWER(name) = 'vladimir guerrero jr.' THEN 'Toronto Blue Jays'
    WHEN LOWER(name) = 'bo bichette' THEN 'Toronto Blue Jays'
    WHEN LOWER(name) = 'brandon nimmo' THEN 'New York Mets'
    WHEN LOWER(name) = 'pete alonso' THEN 'New York Mets'
    WHEN LOWER(name) = 'francisco lindor' THEN 'New York Mets'
    WHEN LOWER(name) = 'bryce harper' THEN 'Philadelphia Phillies'
    WHEN LOWER(name) = 'trea turner' THEN 'Philadelphia Phillies'
    WHEN LOWER(name) = 'kyle schwarber' THEN 'Philadelphia Phillies'
    WHEN LOWER(name) = 'alec bohm' THEN 'Philadelphia Phillies'
    WHEN LOWER(name) = 'bryson stott' THEN 'Philadelphia Phillies'
    WHEN LOWER(name) = 'christian yelich' THEN 'Milwaukee Brewers'
    WHEN LOWER(name) = 'willy adames' THEN 'Milwaukee Brewers'
    WHEN LOWER(name) = 'alex verdugo' THEN 'New York Yankees'
    WHEN LOWER(name) = 'rafael devers' THEN 'Boston Red Sox'
    WHEN LOWER(name) = 'xander bogaerts' THEN 'San Diego Padres'
    WHEN LOWER(name) = 'cedric mullins' THEN 'Baltimore Orioles'
    WHEN LOWER(name) = 'gunnar henderson' THEN 'Baltimore Orioles'
    WHEN LOWER(name) = 'adley rutschman' THEN 'Baltimore Orioles'
    WHEN LOWER(name) = 'christian walker' THEN 'Arizona Diamondbacks'
    WHEN LOWER(name) = 'ketel marte' THEN 'Arizona Diamondbacks'
    ELSE team
END
WHERE sport = 'MLB';

-- Step 9: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_sport_key ON players(sport_key);
CREATE INDEX IF NOT EXISTS idx_players_sport_name ON players(sport, name);

-- Step 10: Log the results
DO $$
DECLARE
    v_duplicates_removed INTEGER;
    v_stats_updated INTEGER;
    v_players_standardized INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_duplicates_removed
    FROM player_id_mapping 
    WHERE old_id != new_id;
    
    SELECT COUNT(*) INTO v_players_standardized
    FROM players
    WHERE sport = 'MLB';
    
    RAISE NOTICE 'Migration complete: % duplicate players removed, % MLB players standardized', 
        v_duplicates_removed, v_players_standardized;
END $$;

COMMIT;

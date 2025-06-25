-- Fix player_props_odds table constraint issue
-- This adds the unique constraint needed for ON CONFLICT clause

-- First, let's check the current structure
SELECT 
    table_name, 
    constraint_name, 
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'player_props_odds';

-- Add the unique constraint for ON CONFLICT
ALTER TABLE player_props_odds 
ADD CONSTRAINT player_props_odds_unique_key 
UNIQUE (event_id, player_id, prop_type_id, bookmaker_id);

-- Verify the constraint was added
SELECT 
    constraint_name, 
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'player_props_odds' 
AND constraint_type = 'UNIQUE';

-- Show the constraint definition
SELECT 
    tc.constraint_name,
    kcu.column_name,
    kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'player_props_odds' 
AND tc.constraint_type = 'UNIQUE'
ORDER BY kcu.ordinal_position; 
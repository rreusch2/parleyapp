-- Verify the betting_results column exists and check its structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'player_game_stats' 
AND column_name = 'betting_results';

-- Check if the index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'player_game_stats' 
AND indexname = 'idx_player_game_stats_betting_results';

-- Show sample of existing data structure
SELECT 
    players.name,
    players.team,
    stats,
    betting_results,
    player_game_stats.created_at
FROM player_game_stats 
JOIN players ON players.id = player_game_stats.player_id
WHERE players.sport = 'MLB'
ORDER BY player_game_stats.created_at DESC
LIMIT 5;

-- Count how many records have betting_results populated
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN betting_results != '{}' THEN 1 END) as records_with_betting_results,
    COUNT(CASE WHEN betting_results = '{}' OR betting_results IS NULL THEN 1 END) as records_without_betting_results
FROM player_game_stats 
JOIN players ON players.id = player_game_stats.player_id
WHERE players.sport = 'MLB'; 
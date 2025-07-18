-- Add MMA and UFC to sports_config table
INSERT INTO sports_config (id, sport_key, sport_name, is_active, current_season, metadata)
VALUES
  (gen_random_uuid(), 'mma_ufc', 'UFC', true, '2025', '{"source": "theodds_api"}'),
  (gen_random_uuid(), 'mma_mixed', 'MMA', true, '2025', '{"source": "theodds_api"}')
ON CONFLICT (sport_key) DO UPDATE
SET 
  sport_name = EXCLUDED.sport_name,
  is_active = EXCLUDED.is_active,
  current_season = EXCLUDED.current_season,
  metadata = EXCLUDED.metadata;

-- Add MMA market types
INSERT INTO market_types (id, market_key, market_name, market_category, sport_key, description, metadata)
VALUES
  (gen_random_uuid(), 'fighter_win_method', 'Fighter Win Method', 'mma', NULL, 'MMA/UFC market for Fighter Win Method', '{"source": "theodds_api"}'),
  (gen_random_uuid(), 'fight_outcome', 'Fight Outcome', 'mma', NULL, 'MMA/UFC market for Fight Outcome', '{"source": "theodds_api"}'),
  (gen_random_uuid(), 'fight_completion', 'Fight Completion', 'mma', NULL, 'MMA/UFC market for Fight Completion (over/under rounds)', '{"source": "theodds_api"}'),
  (gen_random_uuid(), 'round_betting', 'Round Betting', 'mma', NULL, 'MMA/UFC market for Round Betting', '{"source": "theodds_api"}')
ON CONFLICT (market_key) DO UPDATE
SET 
  market_name = EXCLUDED.market_name,
  market_category = EXCLUDED.market_category,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;

-- Add MMA/UFC player prop types
INSERT INTO player_prop_types (id, prop_key, prop_name, sport_key, stat_category, metadata)
VALUES
  (gen_random_uuid(), 'fighter_ko_tko_win', 'Fighter Win by KO/TKO', 'mma_ufc', 'fighting', '{"source": "theodds_api"}'),
  (gen_random_uuid(), 'fighter_submission_win', 'Fighter Win by Submission', 'mma_ufc', 'fighting', '{"source": "theodds_api"}'),
  (gen_random_uuid(), 'fighter_decision_win', 'Fighter Win by Decision', 'mma_ufc', 'fighting', '{"source": "theodds_api"}'),
  (gen_random_uuid(), 'fight_to_go_distance', 'Fight Goes the Distance', 'mma_ufc', 'fighting', '{"source": "theodds_api"}'),
  (gen_random_uuid(), 'fighter_total_rounds', 'Fighter Total Rounds O/U', 'mma_ufc', 'fighting', '{"source": "theodds_api"}')
ON CONFLICT (prop_key) DO UPDATE
SET 
  prop_name = EXCLUDED.prop_name,
  sport_key = EXCLUDED.sport_key,
  stat_category = EXCLUDED.stat_category,
  metadata = EXCLUDED.metadata; 
-- Add sample player props data to address shortage issue
-- This helps ensure the orchestrator can generate player props picks

-- Insert sample players if they don't exist
INSERT INTO players (id, name, team, position, league) VALUES
('mike-trout-angels', 'Mike Trout', 'Los Angeles Angels', 'CF', 'MLB'),
('vladimir-guerrero-jr-jays', 'Vladimir Guerrero Jr.', 'Toronto Blue Jays', '1B', 'MLB'),
('bo-bichette-jays', 'Bo Bichette', 'Toronto Blue Jays', 'SS', 'MLB'),
('tj-friedl-reds', 'TJ Friedl', 'Cincinnati Reds', 'OF', 'MLB'),
('aaron-judge-yankees', 'Aaron Judge', 'New York Yankees', 'RF', 'MLB'),
('mookie-betts-dodgers', 'Mookie Betts', 'Los Angeles Dodgers', 'RF', 'MLB'),
('ronald-acuna-braves', 'Ronald Acuña Jr.', 'Atlanta Braves', 'OF', 'MLB'),
('juan-soto-padres', 'Juan Soto', 'San Diego Padres', 'OF', 'MLB'),
('freddie-freeman-dodgers', 'Freddie Freeman', 'Los Angeles Dodgers', '1B', 'MLB'),
('trea-turner-phillies', 'Trea Turner', 'Philadelphia Phillies', 'SS', 'MLB')
ON CONFLICT (id) DO NOTHING;

-- Insert sample prop types if they don't exist
INSERT INTO player_prop_types (prop_key, prop_name, sport, category) VALUES
('batter_hits_ou', 'Batter Hits O/U', 'MLB', 'hitting'),
('batter_rbis_ou', 'Batter RBIs O/U', 'MLB', 'hitting'),
('batter_total_bases_ou', 'Batter Total Bases O/U', 'MLB', 'hitting'),
('batter_home_runs_ou', 'Batter Home Runs O/U', 'MLB', 'hitting'),
('pitcher_strikeouts_ou', 'Pitcher Strikeouts O/U', 'MLB', 'pitching')
ON CONFLICT (prop_key) DO NOTHING;

-- Insert sample bookmakers if they don't exist
INSERT INTO bookmakers (bookmaker_key, bookmaker_name, is_active) VALUES
('draftkings', 'DraftKings', true),
('fanduel', 'FanDuel', true),
('betmgm', 'BetMGM', true),
('caesars', 'Caesars', true)
ON CONFLICT (bookmaker_key) DO NOTHING;

-- Get current sports events to link props to
DO $$
DECLARE
    event_record RECORD;
    player_record RECORD;
    prop_type_record RECORD;
    bookmaker_record RECORD;
BEGIN
    -- Loop through recent sports events
    FOR event_record IN 
        SELECT id, home_team, away_team 
        FROM sports_events 
        WHERE start_time >= CURRENT_DATE 
        AND start_time <= CURRENT_DATE + INTERVAL '7 days'
        AND league = 'MLB'
        LIMIT 10
    LOOP
        -- Loop through players
        FOR player_record IN 
            SELECT id, name, team 
            FROM players 
            WHERE league = 'MLB'
            LIMIT 20
        LOOP
            -- Loop through prop types
            FOR prop_type_record IN 
                SELECT prop_key, prop_name 
                FROM player_prop_types 
                WHERE sport = 'MLB'
            LOOP
                -- Loop through bookmakers
                FOR bookmaker_record IN 
                    SELECT bookmaker_key, bookmaker_name 
                    FROM bookmakers 
                    WHERE is_active = true
                    LIMIT 2
                LOOP
                    -- Insert sample player props odds
                    INSERT INTO player_props_odds (
                        event_id,
                        player_id,
                        prop_type,
                        bookmaker,
                        line,
                        over_odds,
                        under_odds,
                        last_update
                    ) VALUES (
                        event_record.id,
                        player_record.id,
                        prop_type_record.prop_key,
                        bookmaker_record.bookmaker_key,
                        CASE 
                            WHEN prop_type_record.prop_key = 'batter_hits_ou' THEN 0.5 + (random() * 2)
                            WHEN prop_type_record.prop_key = 'batter_rbis_ou' THEN 0.5 + (random() * 2)
                            WHEN prop_type_record.prop_key = 'batter_total_bases_ou' THEN 1.0 + (random() * 2.5)
                            WHEN prop_type_record.prop_key = 'batter_home_runs_ou' THEN 0.5
                            WHEN prop_type_record.prop_key = 'pitcher_strikeouts_ou' THEN 5.5 + (random() * 4)
                            ELSE 1.5
                        END,
                        CASE WHEN random() > 0.3 THEN -110 - (random() * 20)::int ELSE NULL END,
                        CASE WHEN random() > 0.3 THEN -110 - (random() * 20)::int ELSE NULL END,
                        NOW()
                    )
                    ON CONFLICT (event_id, player_id, prop_type, bookmaker) DO UPDATE SET
                        line = EXCLUDED.line,
                        over_odds = EXCLUDED.over_odds,
                        under_odds = EXCLUDED.under_odds,
                        last_update = EXCLUDED.last_update;
                END LOOP;
            END LOOP;
        END LOOP;
    END LOOP;
END
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_player_props_odds_event_player ON player_props_odds(event_id, player_id);
CREATE INDEX IF NOT EXISTS idx_player_props_odds_prop_type ON player_props_odds(prop_type);
CREATE INDEX IF NOT EXISTS idx_player_props_odds_last_update ON player_props_odds(last_update DESC);

-- Update statistics
ANALYZE player_props_odds;

SELECT 
    COUNT(*) as total_props,
    COUNT(DISTINCT event_id) as events_with_props,
    COUNT(DISTINCT player_id) as players_with_props,
    COUNT(DISTINCT prop_type) as prop_types_available
FROM player_props_odds 
WHERE last_update >= CURRENT_DATE; 
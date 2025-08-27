-- Player Headshots Database Schema Extension
-- Adds headshot support to existing players table and creates headshot management system

-- 1. Add headshot_url column to players table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' 
        AND column_name = 'headshot_url'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE players ADD COLUMN headshot_url TEXT;
    END IF;
END $$;

-- 2. Add external_id column to store SportsDataIO player IDs
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' 
        AND column_name = 'external_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE players ADD COLUMN external_id VARCHAR(50);
    END IF;
END $$;

-- 3. Create index on external_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_players_external_id ON players(external_id);
CREATE INDEX IF NOT EXISTS idx_players_name_team_sport ON players(name, team, sport);

-- 4. Create player_headshots table for tracking headshot management
CREATE TABLE IF NOT EXISTS player_headshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    sportsdata_player_id INTEGER,
    headshot_url TEXT NOT NULL,
    thumbnail_url TEXT,
    source VARCHAR(50) DEFAULT 'sportsdata_io',
    image_width INTEGER,
    image_height INTEGER,
    file_size INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    last_updated TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(player_id, source)
);

-- 5. Create indexes for headshot queries
CREATE INDEX IF NOT EXISTS idx_player_headshots_player_id ON player_headshots(player_id);
CREATE INDEX IF NOT EXISTS idx_player_headshots_sportsdata_id ON player_headshots(sportsdata_player_id);
CREATE INDEX IF NOT EXISTS idx_player_headshots_active ON player_headshots(is_active) WHERE is_active = true;

-- 6. Create view for players with headshots
CREATE OR REPLACE VIEW players_with_headshots AS
SELECT 
    p.id,
    p.name,
    p.team,
    p.sport,
    p."position",
    p.active,
    p.external_id,
    ph.headshot_url,
    ph.thumbnail_url,
    ph.source as headshot_source,
    ph.last_updated as headshot_updated,
    CASE WHEN ph.headshot_url IS NOT NULL THEN TRUE ELSE FALSE END as has_headshot
FROM players p
LEFT JOIN player_headshots ph ON p.id = ph.player_id AND ph.is_active = true
WHERE p.active = true
ORDER BY p.sport, p.team, p.name;

-- 7. Function to get player with headshot by name and team
CREATE OR REPLACE FUNCTION get_player_with_headshot(
    p_name VARCHAR,
    p_team VARCHAR,
    p_sport VARCHAR DEFAULT 'MLB'
)
RETURNS TABLE (
    player_id UUID,
    name VARCHAR,
    team VARCHAR,
    sport VARCHAR,
    "position" VARCHAR,
    headshot_url TEXT,
    has_headshot BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pwh.id,
        pwh.name,
        pwh.team,
        pwh.sport,
        pwh."position",
        pwh.headshot_url,
        pwh.has_headshot
    FROM players_with_headshots pwh
    WHERE pwh.name ILIKE p_name
      AND pwh.team ILIKE p_team
      AND pwh.sport = p_sport
      AND pwh.active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 8. Function to update player headshot
CREATE OR REPLACE FUNCTION update_player_headshot(
    p_player_id UUID,
    p_headshot_url TEXT,
    p_sportsdata_id INTEGER DEFAULT NULL,
    p_thumbnail_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert or update headshot record
    INSERT INTO player_headshots (
        player_id, 
        sportsdata_player_id, 
        headshot_url, 
        thumbnail_url,
        last_updated
    )
    VALUES (
        p_player_id, 
        p_sportsdata_id, 
        p_headshot_url, 
        p_thumbnail_url,
        now()
    )
    ON CONFLICT (player_id, source) 
    DO UPDATE SET
        headshot_url = EXCLUDED.headshot_url,
        thumbnail_url = EXCLUDED.thumbnail_url,
        sportsdata_player_id = EXCLUDED.sportsdata_player_id,
        last_updated = now(),
        is_active = true;
    
    -- Also update the main players table for quick access
    UPDATE players 
    SET 
        headshot_url = p_headshot_url,
        external_id = COALESCE(external_id, p_sportsdata_id::VARCHAR),
        updated_at = now()
    WHERE id = p_player_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 9. Function to get players missing headshots
CREATE OR REPLACE FUNCTION get_players_missing_headshots(
    p_sport VARCHAR DEFAULT 'MLB',
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    player_id UUID,
    name VARCHAR,
    team VARCHAR,
    sport VARCHAR,
    external_id VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.team,
        p.sport,
        p.external_id
    FROM players p
    LEFT JOIN player_headshots ph ON p.id = ph.player_id AND ph.is_active = true
    WHERE p.sport = p_sport
      AND p.active = true
      AND ph.headshot_url IS NULL
    ORDER BY p.team, p.name
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- 10. Create trigger to update players.updated_at when headshot changes
CREATE OR REPLACE FUNCTION trigger_update_player_on_headshot_change()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE players 
    SET updated_at = now() 
    WHERE id = NEW.player_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_player_headshot_update ON player_headshots;
CREATE TRIGGER trigger_player_headshot_update
    AFTER INSERT OR UPDATE ON player_headshots
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_player_on_headshot_change();

-- 11. Function to clean up old/inactive headshots
CREATE OR REPLACE FUNCTION cleanup_old_headshots()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Mark old headshots as inactive (keep for history)
    UPDATE player_headshots 
    SET is_active = false 
    WHERE last_updated < (now() - INTERVAL '90 days')
      AND is_active = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 12. Create materialized view for headshot statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS headshot_stats AS
SELECT 
    sport,
    COUNT(*) as total_players,
    COUNT(CASE WHEN headshot_url IS NOT NULL THEN 1 END) as players_with_headshots,
    ROUND(
        (COUNT(CASE WHEN headshot_url IS NOT NULL THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
        1
    ) as headshot_coverage_percentage,
    MAX(last_updated) as last_headshot_update
FROM players_with_headshots
WHERE active = true
GROUP BY sport
ORDER BY headshot_coverage_percentage DESC;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_headshot_stats_sport ON headshot_stats(sport);

-- 13. Function to refresh headshot stats
CREATE OR REPLACE FUNCTION refresh_headshot_stats()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY headshot_stats;
END;
$$ LANGUAGE plpgsql;

-- Usage examples:
-- SELECT * FROM players_with_headshots WHERE sport = 'MLB' AND has_headshot = true;
-- SELECT * FROM get_player_with_headshot('Bryce Harper', 'PHI', 'MLB');
-- SELECT * FROM get_players_missing_headshots('MLB', 25);
-- SELECT update_player_headshot('player-uuid', 'https://image-url.com/player.jpg', 12345);
-- SELECT * FROM headshot_stats;
-- SELECT refresh_headshot_stats();

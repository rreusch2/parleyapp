-- Fix the player_id linking issue in ai_predictions
-- Create function to match player names to player_id
CREATE OR REPLACE FUNCTION match_player_name_to_id(player_name_input TEXT, sport_input TEXT)
RETURNS UUID AS $$
DECLARE
    matched_player_id UUID;
BEGIN
    -- Try exact match first
    SELECT id INTO matched_player_id 
    FROM players 
    WHERE LOWER(name) = LOWER(player_name_input) 
    AND sport = sport_input 
    LIMIT 1;
    
    -- If no exact match, try fuzzy match
    IF matched_player_id IS NULL THEN
        SELECT id INTO matched_player_id 
        FROM players 
        WHERE LOWER(name) ILIKE '%' || LOWER(player_name_input) || '%'
        AND sport = sport_input 
        LIMIT 1;
    END IF;
    
    RETURN matched_player_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate player_id when ai_predictions are inserted
CREATE OR REPLACE FUNCTION auto_link_player_predictions()
RETURNS TRIGGER AS $$
DECLARE
    player_uuid UUID;
    player_headshot TEXT;
BEGIN
    -- Only process if it's a player_prop and player_id is null
    IF NEW.bet_type = 'player_prop' AND NEW.player_id IS NULL THEN
        -- Extract player name from metadata
        IF NEW.metadata ? 'player_name' THEN
            -- Match player name to player_id
            SELECT match_player_name_to_id(
                NEW.metadata->>'player_name',
                CASE NEW.sport
                    WHEN 'MLB' THEN 'Major League Baseball'
                    WHEN 'NFL' THEN 'National Football League'
                    WHEN 'CFB' THEN 'College Football'
                    WHEN 'WNBA' THEN 'Women''s National Basketball Association'
                    WHEN 'NHL' THEN 'National Hockey League'
                    ELSE NEW.sport
                END
            ) INTO player_uuid;
            
            -- Update player_id if found
            IF player_uuid IS NOT NULL THEN
                NEW.player_id := player_uuid;
                
                -- Get headshot URL from players table
                SELECT headshot_url INTO player_headshot
                FROM players 
                WHERE id = player_uuid;
                
                -- Update metadata with proper headshot URL if available
                IF player_headshot IS NOT NULL THEN
                    NEW.metadata := NEW.metadata || jsonb_build_object('player_headshot_url', player_headshot);
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_link_player_predictions ON ai_predictions;
CREATE TRIGGER trigger_auto_link_player_predictions
    BEFORE INSERT ON ai_predictions
    FOR EACH ROW
    EXECUTE FUNCTION auto_link_player_predictions();


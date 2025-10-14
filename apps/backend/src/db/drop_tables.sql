DO $$ 
BEGIN
    -- Drop triggers if they exist
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_preferences_updated_at') THEN
        DROP TRIGGER update_user_preferences_updated_at ON user_preferences;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sports_events_updated_at') THEN
        DROP TRIGGER update_sports_events_updated_at ON sports_events;
    END IF;

    -- Drop tables if they exist
    DROP TABLE IF EXISTS bet_history CASCADE;
    DROP TABLE IF EXISTS predictions CASCADE;
    DROP TABLE IF EXISTS sports_events CASCADE;
    DROP TABLE IF EXISTS user_preferences CASCADE;

    -- Drop functions if they exist
    DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
END $$; 
-- Migration script to add missing fields to sports_events table
-- Run this in your Supabase SQL editor

-- Add external_event_id and source columns if they don't exist
DO $$
BEGIN
    -- Add external_event_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sports_events' 
        AND column_name = 'external_event_id'
    ) THEN
        ALTER TABLE sports_events ADD COLUMN external_event_id TEXT;
        CREATE INDEX idx_sports_events_external_id ON sports_events(external_event_id);
        RAISE NOTICE 'Added external_event_id column to sports_events';
    ELSE
        RAISE NOTICE 'external_event_id column already exists';
    END IF;

    -- Add source column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sports_events' 
        AND column_name = 'source'
    ) THEN
        ALTER TABLE sports_events ADD COLUMN source TEXT;
        CREATE INDEX idx_sports_events_source ON sports_events(source);
        RAISE NOTICE 'Added source column to sports_events';
    ELSE
        RAISE NOTICE 'source column already exists';
    END IF;

    -- Update status check constraint to include new statuses
    BEGIN
        ALTER TABLE sports_events DROP CONSTRAINT IF EXISTS sports_events_status_check;
        ALTER TABLE sports_events ADD CONSTRAINT sports_events_status_check 
            CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled', 'postponed'));
        RAISE NOTICE 'Updated status constraint to include postponed';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Status constraint update failed or already exists: %', SQLERRM;
    END;

END $$;

-- Add indexes for better performance with duplicate checking
CREATE INDEX IF NOT EXISTS idx_sports_events_teams_date ON sports_events(sport, home_team, away_team, start_time);
CREATE INDEX IF NOT EXISTS idx_sports_events_created_at ON sports_events(created_at);

-- Show current table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sports_events'
ORDER BY ordinal_position; 
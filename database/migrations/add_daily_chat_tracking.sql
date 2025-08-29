-- Migration: Add daily chat message tracking to prevent app restart exploit
-- This implements server-side message counting with daily reset mechanism

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS daily_chat_messages integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_chat_reset timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS chat_timezone text DEFAULT 'America/New_York';

-- Create index for efficient daily reset queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_chat_reset ON profiles(last_chat_reset);

-- Add comment explaining the columns
COMMENT ON COLUMN profiles.daily_chat_messages IS 'Number of chat messages sent by free user today (resets daily)';
COMMENT ON COLUMN profiles.last_chat_reset IS 'Timestamp of last daily chat message reset';
COMMENT ON COLUMN profiles.chat_timezone IS 'User timezone for accurate daily resets';

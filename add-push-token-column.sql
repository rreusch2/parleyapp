-- Add push_token column to profiles table
-- This fixes the error: column profiles.push_token does not exist

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.push_token IS 'Push notification token for mobile devices';

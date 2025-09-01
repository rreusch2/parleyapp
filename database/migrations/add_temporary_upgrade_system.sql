-- Add temporary upgrade system to profiles table
-- Migration: add_temporary_upgrade_system
-- Created: 2025-01-13

-- Add temporary upgrade tracking column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS temporary_upgrade_expires_at timestamptz;

-- Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_profiles_temp_upgrade_expires 
ON profiles(temporary_upgrade_expires_at) 
WHERE temporary_upgrade_expires_at IS NOT NULL;

-- Fix inconsistent referral points (migrate 1500-point users to new 50-point system)
-- This preserves the relative value while making the system consistent
UPDATE profiles 
SET referral_points = CASE 
  WHEN referral_points = 1500 THEN 50
  WHEN referral_points > 1500 THEN GREATEST(50, referral_points * 50 / 1500)
  ELSE referral_points 
END
WHERE referral_points >= 1500;

-- Add comment for documentation
COMMENT ON COLUMN profiles.temporary_upgrade_expires_at IS 'Timestamp when temporary tier upgrade expires, user automatically downgraded to free';

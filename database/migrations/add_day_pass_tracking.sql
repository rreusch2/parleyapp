-- Migration: Add day pass tracking columns to profiles table
-- This enables hybrid subscription management with RevenueCat + custom day passes

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS day_pass_tier VARCHAR,
ADD COLUMN IF NOT EXISTS day_pass_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS day_pass_granted_at TIMESTAMPTZ;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_day_pass_expires_at ON profiles(day_pass_expires_at) WHERE day_pass_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_revenuecat_customer_id ON profiles(revenuecat_customer_id) WHERE revenuecat_customer_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN profiles.day_pass_tier IS 'Temporary tier from day pass purchases (pro/elite), overrides subscription_tier when active';
COMMENT ON COLUMN profiles.day_pass_expires_at IS 'When the day pass expires (24 hours from purchase)';
COMMENT ON COLUMN profiles.day_pass_granted_at IS 'When the day pass was granted (for tracking purposes)';

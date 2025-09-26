-- Migration: Unified RevenueCat Subscription System
-- This migration creates a unified system using RevenueCat as single source of truth
-- while maintaining backward compatibility with existing subscription_tier usage

-- Step 1: Add new columns for RevenueCat integration
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS revenuecat_entitlements JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS revenuecat_customer_info JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_revenuecat_sync TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_source TEXT DEFAULT 'legacy' CHECK (subscription_source IN ('legacy', 'revenuecat', 'daypass'));

-- Step 2: Create function to calculate effective subscription tier
CREATE OR REPLACE FUNCTION calculate_effective_tier(profile_row profiles)
RETURNS TEXT AS $$
BEGIN
  -- Priority 1: Active day pass (highest priority)
  IF profile_row.day_pass_expires_at IS NOT NULL AND profile_row.day_pass_expires_at > NOW() THEN
    RETURN profile_row.day_pass_tier;
  END IF;
  
  -- Priority 2: RevenueCat entitlements  
  IF profile_row.revenuecat_entitlements->>'elite' = 'true' THEN
    RETURN 'elite';
  END IF;
  
  IF profile_row.revenuecat_entitlements->>'predictiveplaypro' = 'true' THEN
    RETURN 'pro';  
  END IF;
  
  -- Priority 3: Legacy subscription (for backward compatibility during migration)
  IF profile_row.subscription_expires_at IS NOT NULL AND profile_row.subscription_expires_at > NOW() THEN
    RETURN profile_row.subscription_tier;
  END IF;
  
  -- Default: free tier
  RETURN 'free';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Create view for effective subscription tier (this is what your app should use)
CREATE OR REPLACE VIEW profiles_with_effective_tier AS
SELECT 
  *,
  calculate_effective_tier(profiles.*) AS effective_subscription_tier,
  CASE 
    WHEN day_pass_expires_at IS NOT NULL AND day_pass_expires_at > NOW() THEN 'daypass'
    WHEN revenuecat_entitlements->>'elite' = 'true' OR revenuecat_entitlements->>'predictiveplaypro' = 'true' THEN 'revenuecat'
    WHEN subscription_expires_at IS NOT NULL AND subscription_expires_at > NOW() THEN 'legacy'
    ELSE 'free'
  END AS subscription_source_active
FROM profiles;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_revenuecat_entitlements ON profiles USING GIN (revenuecat_entitlements);
CREATE INDEX IF NOT EXISTS idx_profiles_day_pass_expires ON profiles (day_pass_expires_at) WHERE day_pass_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_revenuecat_customer_id ON profiles (revenuecat_customer_id) WHERE revenuecat_customer_id IS NOT NULL;

-- Step 5: Add webhook events tracking table
CREATE TABLE IF NOT EXISTS revenuecat_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  user_id UUID REFERENCES profiles(id),
  revenuecat_customer_id TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processing_error TEXT,
  retries INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON revenuecat_webhook_events (user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_customer_id ON revenuecat_webhook_events (revenuecat_customer_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON revenuecat_webhook_events (processed_at);

-- Step 6: Function to expire day passes (for scheduled job)
CREATE OR REPLACE FUNCTION expire_day_passes()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE profiles 
  SET 
    day_pass_tier = NULL,
    day_pass_expires_at = NULL,
    day_pass_granted_at = NULL,
    updated_at = NOW()
  WHERE 
    day_pass_expires_at IS NOT NULL 
    AND day_pass_expires_at <= NOW()
    AND day_pass_tier IS NOT NULL;
    
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  -- Log the expiration
  INSERT INTO revenuecat_webhook_events (event_type, event_data, processed_at)
  VALUES ('DAY_PASS_EXPIRED', jsonb_build_object('expired_count', expired_count), NOW());
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Add comments for documentation
COMMENT ON COLUMN profiles.revenuecat_entitlements IS 'Active entitlements from RevenueCat webhooks: {"predictiveplaypro": true, "elite": false}';
COMMENT ON COLUMN profiles.revenuecat_customer_info IS 'Full customer info from RevenueCat for debugging and analytics';
COMMENT ON COLUMN profiles.last_revenuecat_sync IS 'Last time we received webhook data for this user';
COMMENT ON FUNCTION calculate_effective_tier IS 'Calculates the effective subscription tier based on day passes, RevenueCat entitlements, and legacy data';
COMMENT ON VIEW profiles_with_effective_tier IS 'Use this view instead of profiles table - includes calculated effective_subscription_tier';
COMMENT ON FUNCTION expire_day_passes IS 'Run this on a scheduled job every 5-10 minutes to expire day passes';

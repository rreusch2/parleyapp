-- Elite Day Pass: 24-Hour Temporary Tier System
-- Run this migration in your Supabase SQL editor

-- Function to reset expired temporary tiers
CREATE OR REPLACE FUNCTION reset_expired_temporary_tiers()
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET 
    temporary_tier_active = false,
    temporary_tier = null,
    temporary_tier_expires_at = null,
    subscription_tier = COALESCE(base_subscription_tier, 'free')
  WHERE 
    temporary_tier_active = true 
    AND temporary_tier_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to activate Elite Day Pass (24-hour temporary tier)
CREATE OR REPLACE FUNCTION activate_elite_daypass(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET 
    temporary_tier_active = true,
    temporary_tier = 'elite',
    temporary_tier_expires_at = NOW() + INTERVAL '24 hours',
    subscription_tier = 'elite'
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has active Elite Day Pass
CREATE OR REPLACE FUNCTION check_elite_daypass_status(user_id_param UUID)
RETURNS boolean AS $$
DECLARE
  is_active boolean := false;
BEGIN
  SELECT 
    temporary_tier_active AND 
    temporary_tier = 'elite' AND 
    temporary_tier_expires_at > NOW()
  INTO is_active
  FROM profiles 
  WHERE id = user_id_param;
  
  RETURN COALESCE(is_active, false);
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled function to auto-reset expired temporary tiers every hour
-- Note: This requires pg_cron extension to be enabled in Supabase
SELECT cron.schedule(
  'reset-expired-temporary-tiers',
  '0 * * * *', -- Every hour at minute 0
  'SELECT reset_expired_temporary_tiers();'
);

-- Real-time trigger to check expiration on each profile read/update
CREATE OR REPLACE FUNCTION check_temporary_tier_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-expire temporary tiers that have passed their expiration time
  IF NEW.temporary_tier_active = true AND NEW.temporary_tier_expires_at < NOW() THEN
    NEW.temporary_tier_active = false;
    NEW.temporary_tier = null;
    NEW.temporary_tier_expires_at = null;
    NEW.subscription_tier = COALESCE(NEW.base_subscription_tier, 'free');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_check_temporary_tier_expiration ON profiles;
CREATE TRIGGER trigger_check_temporary_tier_expiration
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION check_temporary_tier_expiration();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION activate_elite_daypass TO authenticated;
GRANT EXECUTE ON FUNCTION check_elite_daypass_status TO authenticated;
GRANT EXECUTE ON FUNCTION reset_expired_temporary_tiers TO authenticated;

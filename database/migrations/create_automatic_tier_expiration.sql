-- Function to handle expired temporary tiers
CREATE OR REPLACE FUNCTION handle_expired_temporary_tiers()
RETURNS void AS $$
BEGIN
  -- Update users whose temporary tiers have expired
  UPDATE profiles 
  SET 
    subscription_tier = base_subscription_tier,
    temporary_tier_active = false,
    temporary_tier = NULL,
    temporary_tier_expires_at = NULL,
    updated_at = now()
  WHERE 
    temporary_tier_active = true 
    AND temporary_tier_expires_at IS NOT NULL 
    AND temporary_tier_expires_at <= now();
  
  -- Mark expired reward claims as inactive
  UPDATE user_reward_claims 
  SET 
    is_active = false,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{expired_at}',
      to_jsonb(now())
    )
  WHERE 
    is_active = true 
    AND expires_at IS NOT NULL 
    AND expires_at <= now();
    
  -- Log the cleanup
  RAISE NOTICE 'Expired temporary tier cleanup completed at %', now();
END;
$$ LANGUAGE plpgsql;

-- Function to automatically restore tiers when rewards expire
CREATE OR REPLACE FUNCTION auto_restore_expired_tiers()
RETURNS TRIGGER AS $$
BEGIN
  -- If a reward claim is being marked as inactive due to expiration
  IF NEW.is_active = false AND OLD.is_active = true AND NEW.expires_at <= now() THEN
    
    -- Check if this was the user's only active temporary upgrade
    IF NOT EXISTS (
      SELECT 1 FROM user_reward_claims urc
      JOIN referral_rewards rr ON urc.reward_id = rr.id
      WHERE urc.user_id = NEW.user_id 
        AND urc.is_active = true 
        AND rr.reward_type = 'temporary_upgrade'
        AND urc.id != NEW.id
    ) THEN
      -- Restore user to their base tier
      UPDATE profiles 
      SET 
        subscription_tier = base_subscription_tier,
        temporary_tier_active = false,
        temporary_tier = NULL,
        temporary_tier_expires_at = NULL,
        updated_at = now()
      WHERE id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic tier restoration
DROP TRIGGER IF EXISTS trigger_auto_restore_expired_tiers ON user_reward_claims;
CREATE TRIGGER trigger_auto_restore_expired_tiers
  AFTER UPDATE ON user_reward_claims
  FOR EACH ROW
  EXECUTE FUNCTION auto_restore_expired_tiers();

-- Create function to check for imminent expirations (for notifications)
CREATE OR REPLACE FUNCTION get_expiring_rewards(hours_ahead INTEGER DEFAULT 24)
RETURNS TABLE (
  user_id UUID,
  reward_name VARCHAR,
  expires_at TIMESTAMPTZ,
  hours_remaining NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    urc.user_id,
    rr.reward_name,
    urc.expires_at,
    ROUND(EXTRACT(EPOCH FROM (urc.expires_at - now())) / 3600, 1) as hours_remaining
  FROM user_reward_claims urc
  JOIN referral_rewards rr ON urc.reward_id = rr.id
  WHERE urc.is_active = true
    AND urc.expires_at IS NOT NULL
    AND urc.expires_at BETWEEN now() AND (now() + INTERVAL '1 hour' * hours_ahead)
  ORDER BY urc.expires_at ASC;
END;
$$ LANGUAGE plpgsql;

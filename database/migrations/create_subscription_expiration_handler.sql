-- Function to handle subscription expiration (day passes and regular subscriptions)
CREATE OR REPLACE FUNCTION handle_subscription_expiration()
RETURNS void AS $$
BEGIN
    -- Handle expired day passes and regular subscriptions
    UPDATE profiles 
    SET 
        subscription_tier = 'free',
        subscription_status = 'expired',
        subscription_expires_at = null,
        subscription_plan_type = null,
        updated_at = now()
    WHERE 
        subscription_expires_at IS NOT NULL 
        AND subscription_expires_at <= now()
        AND subscription_status = 'active'
        AND subscription_tier != 'pro_lifetime';  -- Don't touch lifetime subscriptions
        
    -- Log the number of expired subscriptions
    RAISE NOTICE 'Expired % subscriptions at %', ROW_COUNT, now();
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to run every minute to check for expired subscriptions
-- Note: This requires pg_cron extension, alternatively use a scheduled job
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the function to run every minute
SELECT cron.schedule('subscription-expiration-check', '* * * * *', 'SELECT handle_subscription_expiration();');

-- Also create a manual function for immediate checking (useful for testing)
CREATE OR REPLACE FUNCTION check_and_expire_subscriptions()
RETURNS TABLE(
    user_id uuid,
    previous_tier text,
    expired_at timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    UPDATE profiles 
    SET 
        subscription_tier = 'free',
        subscription_status = 'expired',
        subscription_expires_at = null,
        subscription_plan_type = null,
        updated_at = now()
    WHERE 
        profiles.subscription_expires_at IS NOT NULL 
        AND profiles.subscription_expires_at <= now()
        AND profiles.subscription_status = 'active'
        AND profiles.subscription_tier != 'pro_lifetime'
    RETURNING 
        profiles.id as user_id,
        profiles.subscription_tier as previous_tier,
        profiles.subscription_expires_at as expired_at;
END;
$$ LANGUAGE plpgsql;

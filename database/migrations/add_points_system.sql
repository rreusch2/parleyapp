-- Add points-related columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS referral_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_points_pending INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_points_lifetime INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_trial_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS referral_trial_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS referral_free_month_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS referral_upgrade_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50),
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE;

-- Create device fingerprints table for fraud prevention
CREATE TABLE IF NOT EXISTS device_fingerprints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    os_name VARCHAR(50),
    os_version VARCHAR(50),
    ip_address INET,
    network_type VARCHAR(50),
    user_agent TEXT,
    screen_dimensions VARCHAR(50),
    timezone VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    flagged_reason TEXT,
    flagged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fraud logs table
CREATE TABLE IF NOT EXISTS fraud_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    details TEXT,
    risk_score INTEGER DEFAULT 0,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update existing referrals table to support points system
ALTER TABLE referrals 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reward_granted BOOLEAN DEFAULT FALSE;

-- Update referral_rewards table to support points and credits
ALTER TABLE referral_rewards 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_referral_points ON profiles(referral_points) WHERE referral_points > 0;
CREATE INDEX IF NOT EXISTS idx_referrals_points_awarded ON referrals(points_awarded_at) WHERE points_awarded_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referral_rewards_expires ON referral_rewards(expires_at) WHERE expires_at IS NOT NULL;

-- Fraud prevention indexes
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user_id ON device_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_device_id ON device_fingerprints(device_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_ip_address ON device_fingerprints(ip_address);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_status ON device_fingerprints(status);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_user_id ON fraud_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_event_type ON fraud_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_created_at ON fraud_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON profiles(phone_verified) WHERE phone_verified = true;

-- Update RLS policies for new columns
-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view their own points" ON profiles;
DROP POLICY IF EXISTS "Users can view their own rewards" ON referral_rewards;
DROP POLICY IF EXISTS "Service role can manage points" ON profiles;
DROP POLICY IF EXISTS "Service role can manage rewards" ON referral_rewards;

-- Profiles table - users can read their own points
CREATE POLICY "Users can view their own points" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Referral rewards table - users can view their own rewards
CREATE POLICY "Users can view their own rewards" ON referral_rewards
    FOR SELECT USING (auth.uid() = user_id);

-- Allow service role to insert/update points and rewards
CREATE POLICY "Service role can manage points" ON profiles
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage rewards" ON referral_rewards
    FOR ALL USING (auth.role() = 'service_role');

-- Enable RLS on fraud prevention tables
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_logs ENABLE ROW LEVEL SECURITY;

-- Device fingerprints policies
CREATE POLICY "Users can view their own device fingerprints" ON device_fingerprints
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage device fingerprints" ON device_fingerprints
    FOR ALL USING (auth.role() = 'service_role');

-- Fraud logs policies
CREATE POLICY "Users can view their own fraud logs" ON fraud_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage fraud logs" ON fraud_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Function to automatically expire old rewards
CREATE OR REPLACE FUNCTION expire_old_rewards()
RETURNS void AS $$
BEGIN
    UPDATE referral_rewards 
    SET status = 'expired'
    WHERE status = 'active' 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run the expiration function (if pg_cron is available)
-- This would need to be run manually if pg_cron is not installed:
-- SELECT cron.schedule('expire-rewards', '0 0 * * *', 'SELECT expire_old_rewards();');

COMMENT ON COLUMN profiles.referral_points IS 'Available points balance (1 point = $0.01)';
COMMENT ON COLUMN profiles.referral_points_pending IS 'Points pending confirmation';
COMMENT ON COLUMN profiles.referral_points_lifetime IS 'Total points earned all time';
COMMENT ON COLUMN profiles.referral_trial_active IS 'Whether user has active referral trial';
COMMENT ON COLUMN referrals.completed_at IS 'When referral was completed (user subscribed)';
COMMENT ON COLUMN referrals.reward_granted IS 'Whether referrer reward has been granted';
COMMENT ON COLUMN referral_rewards.expires_at IS 'When reward expires (NULL = no expiration)';
COMMENT ON COLUMN referral_rewards.status IS 'Reward status: active, redeemed, expired';

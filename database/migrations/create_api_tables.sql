-- Developer API Tables for StatMuse API monetization
-- Run this migration to set up API key management and usage tracking

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL, -- First 8 chars for display (pk_live_abc12345...)
    name TEXT NOT NULL DEFAULT 'Default API Key',
    is_active BOOLEAN DEFAULT true,
    current_month_usage INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- API Usage tracking table  
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    query_text TEXT,
    response_time_ms INTEGER,
    status_code INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    month TEXT NOT NULL -- Format: 2025-01 for aggregation
);

-- API Subscriptions table (extends users table)
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_subscription_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_subscription_id TEXT; -- Stripe subscription ID
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_monthly_limit INTEGER DEFAULT 1000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_current_usage INTEGER DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_month ON api_usage(month);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage(timestamp);

-- Function to increment API usage (called from Python)
CREATE OR REPLACE FUNCTION increment_api_usage(user_id_param UUID, month_param TEXT)
RETURNS void AS $$
BEGIN
    -- Update user's current usage
    UPDATE users 
    SET api_current_usage = api_current_usage + 1
    WHERE id = user_id_param;
    
    -- Update API key usage if we can find it
    UPDATE api_keys 
    SET current_month_usage = current_month_usage + 1,
        last_used_at = NOW()
    WHERE user_id = user_id_param AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly usage (call via cron job)
CREATE OR REPLACE FUNCTION reset_monthly_api_usage()
RETURNS void AS $$
BEGIN
    -- Reset user usage counters
    UPDATE users SET api_current_usage = 0;
    
    -- Reset API key usage counters  
    UPDATE api_keys SET current_month_usage = 0;
    
    -- Log the reset
    INSERT INTO api_usage (user_id, endpoint, query_text, month) 
    VALUES (gen_random_uuid(), 'system', 'Monthly usage reset', TO_CHAR(NOW(), 'YYYY-MM'));
END;
$$ LANGUAGE plpgsql;

-- Sample API subscription tiers
-- free: 1,000 calls/month
-- developer: 1,000 calls/month (same as free, for testing)  
-- startup: 25,000 calls/month ($29/month)
-- enterprise: 100,000 calls/month ($99/month)

COMMENT ON TABLE api_keys IS 'API keys for accessing the StatMuse API service';
COMMENT ON TABLE api_usage IS 'Usage tracking and analytics for API calls';
COMMENT ON FUNCTION increment_api_usage IS 'Increments usage counters when API is called';
COMMENT ON FUNCTION reset_monthly_api_usage IS 'Resets monthly usage counters (run monthly via cron)';

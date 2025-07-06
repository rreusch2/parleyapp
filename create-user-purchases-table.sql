-- Create user_purchases table for storing In-App Purchase data
CREATE TABLE IF NOT EXISTS user_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
    product_id VARCHAR(100) NOT NULL,
    transaction_id VARCHAR(200) UNIQUE NOT NULL,
    purchase_token TEXT, -- Android purchase token
    receipt_data TEXT, -- iOS receipt data
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'refunded', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_purchases_user_id ON user_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_transaction_id ON user_purchases(transaction_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_status ON user_purchases(status);
CREATE INDEX IF NOT EXISTS idx_user_purchases_expires_at ON user_purchases(expires_at);

-- Add subscription tracking columns to profiles table if they don't exist
DO $$ 
BEGIN
    -- Add subscription_tier column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'subscription_tier') THEN
        ALTER TABLE profiles ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'free' 
        CHECK (subscription_tier IN ('free', 'pro_monthly', 'pro_yearly', 'pro_lifetime'));
    END IF;
    
    -- Add subscription_status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'subscription_status') THEN
        ALTER TABLE profiles ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'inactive'
        CHECK (subscription_status IN ('active', 'inactive', 'expired', 'cancelled'));
    END IF;
    
    -- Add subscription_expires_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'subscription_expires_at') THEN
        ALTER TABLE profiles ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create RLS policies for user_purchases table
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own purchases
CREATE POLICY "Users can view own purchases" ON user_purchases
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Prevent direct inserts/updates (only backend can do this)
CREATE POLICY "Only service role can insert purchases" ON user_purchases
    FOR INSERT WITH CHECK (false);

CREATE POLICY "Only service role can update purchases" ON user_purchases
    FOR UPDATE USING (false);

-- Grant permissions to service role
GRANT ALL ON user_purchases TO service_role;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_user_purchases_updated_at
    BEFORE UPDATE ON user_purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_purchases IS 'Stores In-App Purchase verification data';
COMMENT ON COLUMN user_purchases.platform IS 'Platform where purchase was made (ios/android)';
COMMENT ON COLUMN user_purchases.product_id IS 'Product identifier from App Store/Play Store';
COMMENT ON COLUMN user_purchases.transaction_id IS 'Unique transaction identifier';
COMMENT ON COLUMN user_purchases.purchase_token IS 'Android purchase token for verification';
COMMENT ON COLUMN user_purchases.receipt_data IS 'iOS receipt data for verification';
COMMENT ON COLUMN user_purchases.status IS 'Current status of the purchase';
COMMENT ON COLUMN user_purchases.expires_at IS 'When the subscription expires (null for lifetime)';
COMMENT ON COLUMN user_purchases.verified_at IS 'When the purchase was verified with Apple/Google';
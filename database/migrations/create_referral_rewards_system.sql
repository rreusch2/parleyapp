-- Create rewards catalog table
CREATE TABLE IF NOT EXISTS reward_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_name VARCHAR(100) NOT NULL,
  reward_description TEXT NOT NULL,
  points_cost INTEGER NOT NULL,
  reward_type VARCHAR(50) NOT NULL CHECK (reward_type IN ('temporary_upgrade', 'bonus_picks', 'feature_unlock')),
  upgrade_tier VARCHAR(20) CHECK (upgrade_tier IN ('pro', 'elite')),
  duration_hours INTEGER, -- null for permanent rewards
  bonus_picks_count INTEGER, -- for bonus picks rewards
  feature_unlocks JSONB, -- for feature unlock rewards
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user reward claims table
CREATE TABLE IF NOT EXISTS user_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES reward_catalog(id),
  points_spent INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  original_tier VARCHAR(20), -- store user's original tier for restoration
  metadata JSONB
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_reward_claims_user_id ON user_reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reward_claims_active ON user_reward_claims(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_reward_claims_expires ON user_reward_claims(expires_at) WHERE expires_at IS NOT NULL;

-- Insert default reward catalog
INSERT INTO reward_catalog (reward_name, reward_description, points_cost, reward_type, upgrade_tier, duration_hours) VALUES
('1 Day Pro Access', 'Unlock Pro features for 24 hours including 20 daily picks, unlimited Professor Lock chat, and premium analytics', 100, 'temporary_upgrade', 'pro', 24),
('3 Day Pro Access', 'Unlock Pro features for 3 full days with all premium benefits', 250, 'temporary_upgrade', 'pro', 72),
('1 Day Elite Access', 'Experience Elite tier with 30 daily picks, advanced Professor Lock, and premium trends for 24 hours', 200, 'temporary_upgrade', 'elite', 24),
('Weekend Elite Pass', 'Elite access for the entire weekend (48 hours) - perfect for big game days', 350, 'temporary_upgrade', 'elite', 48)
ON CONFLICT DO NOTHING;

-- Add new columns to profiles if not exists (backup for existing structure)
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS base_subscription_tier VARCHAR(20) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS temporary_tier_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS temporary_tier VARCHAR(20),
  ADD COLUMN IF NOT EXISTS temporary_tier_expires_at TIMESTAMPTZ;

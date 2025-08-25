-- Create optimized table for trends display
CREATE TABLE IF NOT EXISTS player_recent_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID REFERENCES players(id),
    player_name VARCHAR NOT NULL,
    sport VARCHAR NOT NULL,
    team VARCHAR NOT NULL,
    game_date DATE NOT NULL,
    opponent VARCHAR NOT NULL,
    is_home BOOLEAN NOT NULL DEFAULT false,
    
    -- MLB Stats
    hits INTEGER DEFAULT 0,
    at_bats INTEGER DEFAULT 0,
    home_runs INTEGER DEFAULT 0,
    rbis INTEGER DEFAULT 0,
    runs_scored INTEGER DEFAULT 0,
    stolen_bases INTEGER DEFAULT 0,
    strikeouts INTEGER DEFAULT 0,
    walks INTEGER DEFAULT 0,
    total_bases INTEGER DEFAULT 0,
    
    -- WNBA Stats
    points INTEGER DEFAULT 0,
    rebounds INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    steals INTEGER DEFAULT 0,
    blocks INTEGER DEFAULT 0,
    three_pointers INTEGER DEFAULT 0,
    
    -- Pitcher Stats (MLB)
    innings_pitched DECIMAL(4,1) DEFAULT 0,
    strikeouts_pitcher INTEGER DEFAULT 0,
    hits_allowed INTEGER DEFAULT 0,
    walks_allowed INTEGER DEFAULT 0,
    earned_runs INTEGER DEFAULT 0,
    
    -- Metadata
    game_result VARCHAR(10), -- 'W', 'L', 'T'
    minutes_played INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicates
    UNIQUE(player_id, game_date, opponent)
);

-- Phone verification support (idempotent)
DO $$
BEGIN
    -- profiles table additions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE profiles ADD COLUMN phone_number TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'phone_verified'
    ) THEN
        ALTER TABLE profiles ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'phone_verified_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN phone_verified_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'trial_used'
    ) THEN
        ALTER TABLE profiles ADD COLUMN trial_used BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'verification_attempts'
    ) THEN
        ALTER TABLE profiles ADD COLUMN verification_attempts INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'last_verification_attempt'
    ) THEN
        ALTER TABLE profiles ADD COLUMN last_verification_attempt TIMESTAMPTZ;
    END IF;

    -- unique index to prevent duplicate verified phones
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_verified_phone_number'
    ) THEN
        CREATE UNIQUE INDEX uniq_verified_phone_number
        ON profiles (phone_number)
        WHERE phone_verified IS TRUE AND phone_number IS NOT NULL;
    END IF;
END $$;

-- Indexes for fast queries
CREATE INDEX idx_player_recent_stats_player_date ON player_recent_stats(player_id, game_date DESC);
CREATE INDEX idx_player_recent_stats_sport ON player_recent_stats(sport);
CREATE INDEX idx_player_recent_stats_name ON player_recent_stats(player_name);

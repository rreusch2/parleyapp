-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Preferences Table
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    risk_tolerance TEXT CHECK (risk_tolerance IN ('low', 'medium', 'high')),
    sports TEXT[] DEFAULT '{}',
    bet_types TEXT[] DEFAULT '{}',
    max_bet_size INTEGER CHECK (max_bet_size > 0),
    notification_preferences JSONB DEFAULT '{"frequency": "daily", "types": []}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Sports Events Table
CREATE TABLE sports_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sport TEXT NOT NULL,
    league TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    odds JSONB NOT NULL DEFAULT '{}',
    stats JSONB DEFAULT '{}',
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Predictions Table
CREATE TABLE predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES sports_events(id) ON DELETE CASCADE,
    sport TEXT NOT NULL,
    matchup TEXT NOT NULL,
    pick TEXT NOT NULL,
    odds TEXT NOT NULL,
    confidence DECIMAL CHECK (confidence >= 0 AND confidence <= 100),
    analysis TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost')),
    metadata JSONB DEFAULT '{}'
);

-- Bet History Table
CREATE TABLE bet_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    prediction_id UUID REFERENCES predictions(id),
    amount DECIMAL CHECK (amount > 0),
    odds TEXT NOT NULL,
    potential_payout DECIMAL,
    result TEXT CHECK (result IN ('pending', 'won', 'lost')),
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_sports_events_sport ON sports_events(sport);
CREATE INDEX idx_sports_events_start_time ON sports_events(start_time);
CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_expires_at ON predictions(expires_at);
CREATE INDEX idx_bet_history_user_id ON bet_history(user_id);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating updated_at
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sports_events_updated_at
    BEFORE UPDATE ON sports_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create Row Level Security (RLS) policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_history ENABLE ROW LEVEL SECURITY;

-- User Preferences policies
CREATE POLICY "Users can view own preferences"
    ON user_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
    ON user_preferences FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
    ON user_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Predictions policies
CREATE POLICY "Users can view own predictions"
    ON predictions FOR SELECT
    USING (auth.uid() = user_id);

-- Bet History policies
CREATE POLICY "Users can view own bets"
    ON bet_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bets"
    ON bet_history FOR INSERT
    WITH CHECK (auth.uid() = user_id); 
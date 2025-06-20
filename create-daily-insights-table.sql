-- Create daily_insights table for ParleyApp
-- This stores AI-generated daily insights for users

CREATE TABLE IF NOT EXISTS daily_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('analysis', 'alert', 'value', 'trend', 'prediction')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('analysis', 'news', 'injury', 'weather', 'line_movement')),
    source VARCHAR(100) NOT NULL,
    impact VARCHAR(10) NOT NULL CHECK (impact IN ('low', 'medium', 'high')),
    tools_used JSONB,
    impact_score DECIMAL(3,1),
    date DATE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_daily_insights_user_date ON daily_insights (user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_insights_date ON daily_insights (date);
CREATE INDEX IF NOT EXISTS idx_daily_insights_impact ON daily_insights (impact);
CREATE INDEX IF NOT EXISTS idx_daily_insights_type ON daily_insights (type);

-- Create RLS (Row Level Security) policies
ALTER TABLE daily_insights ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own insights
CREATE POLICY "Users can view their own daily insights" ON daily_insights
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own insights (for the backend service)
CREATE POLICY "Users can insert their own daily insights" ON daily_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own insights
CREATE POLICY "Users can update their own daily insights" ON daily_insights
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own insights
CREATE POLICY "Users can delete their own daily insights" ON daily_insights
    FOR DELETE USING (auth.uid() = user_id);

-- Add foreign key constraint to users table (if it exists)
-- ALTER TABLE daily_insights ADD CONSTRAINT fk_daily_insights_user 
--     FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on every update
CREATE TRIGGER update_daily_insights_updated_at 
    BEFORE UPDATE ON daily_insights 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create a function to clean up old insights (optional - keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_daily_insights()
RETURNS void AS $$
BEGIN
    DELETE FROM daily_insights 
    WHERE date < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE daily_insights IS 'Stores AI-generated daily insights for users with their betting recommendations';
COMMENT ON COLUMN daily_insights.tools_used IS 'JSON array of AI tools used to generate this insight';
COMMENT ON COLUMN daily_insights.impact_score IS 'Numerical score (1-10) indicating the importance/impact of this insight';
COMMENT ON COLUMN daily_insights.metadata IS 'Additional metadata like processing time, confidence, game IDs, etc.';
COMMENT ON COLUMN daily_insights.date IS 'The date this insight was generated for (YYYY-MM-DD format)'; 
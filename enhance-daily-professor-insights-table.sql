-- Enhance existing daily_professor_insights table to support rich UI data
-- Run this SQL in your Supabase database

-- Add enhanced columns to existing daily_professor_insights table
ALTER TABLE daily_professor_insights 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'research',
ADD COLUMN IF NOT EXISTS confidence INTEGER DEFAULT 75 CHECK (confidence >= 0 AND confidence <= 100),
ADD COLUMN IF NOT EXISTS impact TEXT DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS research_sources TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS game_info JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS teams TEXT[] DEFAULT '{}';

-- Create indexes for better performance on the new columns
CREATE INDEX IF NOT EXISTS idx_daily_professor_insights_category ON daily_professor_insights(category);
CREATE INDEX IF NOT EXISTS idx_daily_professor_insights_impact ON daily_professor_insights(impact);
CREATE INDEX IF NOT EXISTS idx_daily_professor_insights_date_generated ON daily_professor_insights(date_generated);

-- Add a comment to describe the enhanced table
COMMENT ON TABLE daily_professor_insights IS 'Enhanced Daily Professor Lock insights with detailed metadata for rich UI display';

-- Optional: Update existing records to have default values for new columns
UPDATE daily_professor_insights 
SET 
    title = COALESCE(title, 'Professor Lock Insight'),
    description = COALESCE(description, insight_text),
    category = COALESCE(category, 'research'),
    confidence = COALESCE(confidence, 75),
    impact = COALESCE(impact, 'medium'),
    research_sources = COALESCE(research_sources, '{}'),
    teams = COALESCE(teams, '{}')
WHERE title IS NULL OR description IS NULL; 
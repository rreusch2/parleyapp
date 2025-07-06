-- Create table for daily curated data that Professor Lock will use
CREATE TABLE IF NOT EXISTS daily_insights_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data_type VARCHAR NOT NULL, -- 'team_recent_games', 'player_recent_stats', 'standings', 'league_trends'
    team_name VARCHAR,
    player_name VARCHAR,
    data JSONB NOT NULL, -- The actual stats/data
    date_collected DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for fast queries on daily insights data
CREATE INDEX IF NOT EXISTS idx_daily_insights_data_type_date ON daily_insights_data(data_type, date_collected);
CREATE INDEX IF NOT EXISTS idx_daily_insights_team_date ON daily_insights_data(team_name, date_collected);
CREATE INDEX IF NOT EXISTS idx_daily_insights_player_date ON daily_insights_data(player_name, date_collected);

-- Create table for storing Professor Lock's generated insights
CREATE TABLE IF NOT EXISTS daily_professor_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    insight_text TEXT NOT NULL,
    insight_order INTEGER NOT NULL,
    date_generated DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for fast queries on professor insights
CREATE INDEX IF NOT EXISTS idx_daily_insights_date ON daily_professor_insights(date_generated);
CREATE INDEX IF NOT EXISTS idx_daily_insights_order ON daily_professor_insights(date_generated, insight_order);

-- Add RLS policies if needed (optional - depends on your security setup)
-- ALTER TABLE daily_insights_data ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE daily_professor_insights ENABLE ROW LEVEL SECURITY;

-- Test the tables by showing their structure
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('daily_insights_data', 'daily_professor_insights')
ORDER BY table_name, ordinal_position; 
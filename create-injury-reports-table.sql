-- Create injury_reports table if it doesn't exist
CREATE TABLE IF NOT EXISTS injury_reports (
    id BIGSERIAL PRIMARY KEY,
    player_name VARCHAR(255) NOT NULL,
    external_player_id VARCHAR(50),
    team_name VARCHAR(100) NOT NULL,
    position VARCHAR(10),
    injury_status VARCHAR(50) NOT NULL, -- 'out', 'doubtful', 'questionable', 'probable'
    estimated_return_date DATE,
    description TEXT,
    sport VARCHAR(10) NOT NULL, -- 'MLB', 'NFL', 'NBA', 'NHL'
    source VARCHAR(50) NOT NULL DEFAULT 'ESPN_SCRAPE',
    source_url TEXT,
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_injury_reports_sport ON injury_reports(sport);
CREATE INDEX IF NOT EXISTS idx_injury_reports_team ON injury_reports(team_name);
CREATE INDEX IF NOT EXISTS idx_injury_reports_status ON injury_reports(injury_status);
CREATE INDEX IF NOT EXISTS idx_injury_reports_active ON injury_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_injury_reports_player ON injury_reports(player_name);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_injury_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_injury_reports_updated_at ON injury_reports;
CREATE TRIGGER update_injury_reports_updated_at
    BEFORE UPDATE ON injury_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_injury_reports_updated_at(); 
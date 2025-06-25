-- Create news_articles table for storing sports news and injury reports
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  type TEXT NOT NULL CHECK (type IN ('injury', 'trade', 'lineup', 'weather', 'breaking', 'analysis')),
  sport TEXT NOT NULL,
  league TEXT,
  team TEXT,
  player TEXT,
  impact TEXT NOT NULL CHECK (impact IN ('high', 'medium', 'low')) DEFAULT 'medium',
  source TEXT NOT NULL,
  source_url TEXT,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  game_id UUID REFERENCES sports_events(id) ON DELETE SET NULL,
  relevant_to_bets BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_news_articles_sport ON news_articles(sport);
CREATE INDEX IF NOT EXISTS idx_news_articles_type ON news_articles(type);
CREATE INDEX IF NOT EXISTS idx_news_articles_impact ON news_articles(impact);
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_team ON news_articles(team);
CREATE INDEX IF NOT EXISTS idx_news_articles_player ON news_articles(player);
CREATE INDEX IF NOT EXISTS idx_news_articles_external_id ON news_articles(external_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_news_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_news_articles_updated_at ON news_articles;
CREATE TRIGGER trigger_update_news_articles_updated_at
  BEFORE UPDATE ON news_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_news_articles_updated_at();

-- Insert some sample news data for testing
INSERT INTO news_articles (
  external_id, title, summary, content, type, sport, team, player, impact, source, source_url, published_at
) VALUES 
(
  'espn_sample_1',
  'LeBron James Questionable with Ankle Injury',
  'Lakers star LeBron James is listed as questionable for tonight''s game against the Warriors due to a minor ankle sprain sustained in practice.',
  'Los Angeles Lakers superstar LeBron James suffered a minor ankle sprain during Tuesday''s practice session and is now questionable for Wednesday night''s highly anticipated matchup against the Golden State Warriors. The injury occurred when James landed awkwardly after a routine jump shot during scrimmage...',
  'injury',
  'NBA',
  'Lakers',
  'LeBron James',
  'high',
  'ESPN',
  'https://espn.com/nba/story/lebron-injury',
  NOW() - INTERVAL '30 minutes'
),
(
  'nfl_network_sample_1',
  'Cowboys Exploring Trade Options Before Deadline',
  'The Dallas Cowboys are reportedly exploring trade options to bolster their offensive line before the deadline.',
  'According to multiple league sources, the Dallas Cowboys front office has been actively exploring trade possibilities to address concerns along their offensive line. With the trade deadline approaching, the team is evaluating potential moves that could strengthen their protection for quarterback Dak Prescott...',
  'trade',
  'NFL',
  'Cowboys',
  null,
  'medium',
  'NFL Network',
  'https://nfl.com/news/cowboys-trade-deadline',
  NOW() - INTERVAL '2 hours'
),
(
  'weather_sample_1',
  'Heavy Snow Expected for Tonight''s Bears vs Packers Game',
  'Weather forecasts show heavy snowfall expected during tonight''s Bears vs Packers matchup, which could significantly impact scoring and betting lines.',
  'The National Weather Service has issued a winter weather advisory for the Green Bay area, with 4-6 inches of snow expected to fall during tonight''s Bears vs Packers game at Lambeau Field. The conditions are expected to affect passing games and could favor under bets for total points...',
  'weather',
  'NFL',
  'Packers',
  null,
  'medium',
  'Weather.com',
  'https://weather.com/sports/snow-packers-game',
  NOW() - INTERVAL '1 hour'
),
(
  'breaking_sample_1',
  'Major League Baseball Announces New Playoff Format',
  'MLB has announced significant changes to the playoff format starting next season, affecting betting strategies.',
  'Major League Baseball officially announced today that starting next season, the playoff format will expand to include additional wild card teams, creating new betting opportunities and changing the dynamics of pennant races...',
  'breaking',
  'MLB',
  null,
  null,
  'high',
  'MLB.com',
  'https://mlb.com/news/playoff-format-changes',
  NOW() - INTERVAL '15 minutes'
),
(
  'analysis_sample_1',
  'NBA Scoring Trends Show Defensive Shift in Western Conference',
  'Recent analysis reveals a significant defensive improvement across Western Conference teams, impacting over/under betting markets.',
  'A comprehensive analysis of the last 20 games across Western Conference teams shows a marked improvement in defensive efficiency, with teams averaging 8.2 fewer points allowed per game compared to the season start. This trend has major implications for total points betting markets...',
  'analysis',
  'NBA',
  null,
  null,
  'medium',
  'The Athletic',
  'https://theathletic.com/nba-defensive-trends',
  NOW() - INTERVAL '45 minutes'
);

-- Enable RLS if not already enabled
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for news_articles
CREATE POLICY "News articles are viewable by everyone" 
ON news_articles FOR SELECT 
USING (true);

CREATE POLICY "Only authenticated users can insert news articles" 
ON news_articles FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Only authenticated users can update news articles" 
ON news_articles FOR UPDATE 
USING (auth.role() = 'authenticated');

COMMENT ON TABLE news_articles IS 'Stores sports news articles, injury reports, and other relevant betting information';
COMMENT ON COLUMN news_articles.external_id IS 'Unique identifier from external news source to prevent duplicates';
COMMENT ON COLUMN news_articles.type IS 'Type of news: injury, trade, lineup, weather, breaking, analysis';
COMMENT ON COLUMN news_articles.impact IS 'Potential impact on betting: high, medium, low';
COMMENT ON COLUMN news_articles.relevant_to_bets IS 'Whether this news is relevant to current betting markets';
COMMENT ON COLUMN news_articles.game_id IS 'Reference to specific game if applicable'; 
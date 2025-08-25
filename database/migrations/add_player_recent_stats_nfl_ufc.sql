-- Extend player_recent_stats with NFL/CFB/UFC fields for trends
ALTER TABLE player_recent_stats
  ADD COLUMN IF NOT EXISTS passing_yards INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rushing_yards INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receiving_yards INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receptions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passing_tds INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rushing_tds INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receiving_tds INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS significant_strikes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS takedowns INTEGER DEFAULT 0;

-- Helpful composite index for player/date lookups
CREATE INDEX IF NOT EXISTS idx_prs_player_date ON player_recent_stats(player_id, game_date DESC);


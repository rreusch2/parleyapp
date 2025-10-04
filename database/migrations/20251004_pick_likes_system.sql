-- Pick Likes/Ranking System
-- Allows users to like/rank AI predictions to identify "Hot Picks"

-- Table to track user likes on predictions
CREATE TABLE IF NOT EXISTS pick_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prediction_id UUID NOT NULL REFERENCES ai_predictions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate likes
  UNIQUE(user_id, prediction_id)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_pick_likes_prediction_id ON pick_likes(prediction_id);
CREATE INDEX IF NOT EXISTS idx_pick_likes_user_id ON pick_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_pick_likes_created_at ON pick_likes(created_at DESC);

-- Add like_count to ai_predictions for quick access (denormalized)
ALTER TABLE ai_predictions 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- Index for finding hot picks
CREATE INDEX IF NOT EXISTS idx_ai_predictions_like_count ON ai_predictions(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_date_likes ON ai_predictions(created_at DESC, like_count DESC);

-- Function to update like count when a like is added
CREATE OR REPLACE FUNCTION increment_pick_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_predictions
  SET like_count = like_count + 1
  WHERE id = NEW.prediction_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update like count when a like is removed
CREATE OR REPLACE FUNCTION decrement_pick_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_predictions
  SET like_count = GREATEST(0, like_count - 1)
  WHERE id = OLD.prediction_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers to keep like_count in sync
DROP TRIGGER IF EXISTS trigger_increment_pick_likes ON pick_likes;
CREATE TRIGGER trigger_increment_pick_likes
  AFTER INSERT ON pick_likes
  FOR EACH ROW
  EXECUTE FUNCTION increment_pick_likes();

DROP TRIGGER IF EXISTS trigger_decrement_pick_likes ON pick_likes;
CREATE TRIGGER trigger_decrement_pick_likes
  AFTER DELETE ON pick_likes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_pick_likes();

-- RLS Policies
ALTER TABLE pick_likes ENABLE ROW LEVEL SECURITY;

-- Users can view all likes
CREATE POLICY "Anyone can view pick likes"
  ON pick_likes FOR SELECT
  USING (true);

-- Users can only insert their own likes
CREATE POLICY "Users can like picks"
  ON pick_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own likes
CREATE POLICY "Users can unlike picks"
  ON pick_likes FOR DELETE
  USING (auth.uid() = user_id);

-- View for hot picks (most liked picks from today)
CREATE OR REPLACE VIEW hot_picks_today AS
SELECT 
  p.*,
  p.like_count,
  COUNT(DISTINCT pl.user_id) as unique_likes
FROM ai_predictions p
LEFT JOIN pick_likes pl ON p.id = pl.prediction_id
WHERE p.created_at >= CURRENT_DATE
GROUP BY p.id
HAVING p.like_count > 0
ORDER BY p.like_count DESC, p.confidence DESC
LIMIT 100;

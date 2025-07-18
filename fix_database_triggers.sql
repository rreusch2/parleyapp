-- Fix Database Triggers - Safe Script to Handle Existing Triggers
-- This script can be run multiple times safely

-- Drop existing triggers if they exist (to avoid conflicts)
DROP TRIGGER IF EXISTS update_scrapy_news_updated_at ON scrapy_news;
DROP TRIGGER IF EXISTS update_scrapy_player_stats_updated_at ON scrapy_player_stats;
DROP TRIGGER IF EXISTS update_scrapy_team_performance_updated_at ON scrapy_team_performance;
DROP TRIGGER IF EXISTS update_enhanced_predictions_updated_at ON enhanced_predictions;

-- Recreate the update function (safe to run multiple times)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (now safe since we dropped any existing ones)
CREATE TRIGGER update_scrapy_news_updated_at 
    BEFORE UPDATE ON scrapy_news 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scrapy_player_stats_updated_at 
    BEFORE UPDATE ON scrapy_player_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scrapy_team_performance_updated_at 
    BEFORE UPDATE ON scrapy_team_performance 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enhanced_predictions_updated_at 
    BEFORE UPDATE ON enhanced_predictions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database triggers fixed successfully!';
    RAISE NOTICE '🔄 All update triggers recreated for enhanced tables';
END $$;
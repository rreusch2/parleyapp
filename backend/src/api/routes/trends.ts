import express from 'express';
import { trendAnalysisService } from '../../services/trendAnalysisService';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * Get recurring player prop trends for Pro users
 */
router.get('/player-props/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const { min_streak = '3', tier = 'free' } = req.query;

    // Check if user has Pro access
    if (tier !== 'pro') {
      return res.status(403).json({
        success: false,
        error: 'Pro subscription required for Recurring Trends',
        upgrade_url: '/upgrade'
      });
    }

    logger.info(`📊 Fetching player prop trends for ${sport}`);

    const trends = await trendAnalysisService.getPlayerPropTrends(
      sport.toUpperCase(),
      parseInt(min_streak as string)
    );

    res.json({
      success: true,
      sport: sport.toUpperCase(),
      trends,
      total_trends: trends.length,
      feature_type: 'recurring_trends'
    });

  } catch (error) {
    logger.error('Error fetching player prop trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recurring trends'
    });
  }
});

/**
 * Get recurring team trends for Pro users
 */
router.get('/team/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const { min_streak = '3', tier = 'free' } = req.query;

    // Check if user has Pro access
    if (tier !== 'pro') {
      return res.status(403).json({
        success: false,
        error: 'Pro subscription required for Team Trends',
        upgrade_url: '/upgrade'
      });
    }

    logger.info(`📊 Fetching team trends for ${sport}`);

    const trends = await trendAnalysisService.getTeamTrends(
      sport.toUpperCase(),
      parseInt(min_streak as string)
    );

    res.json({
      success: true,
      sport: sport.toUpperCase(),
      trends,
      total_trends: trends.length,
      feature_type: 'team_trends'
    });

  } catch (error) {
    logger.error('Error fetching team trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team trends'
    });
  }
});

/**
 * Get live betting opportunities based on trends
 */
router.get('/opportunities/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const { tier = 'free' } = req.query;

    // Check if user has Pro access
    if (tier !== 'pro') {
      return res.status(403).json({
        success: false,
        error: 'Pro subscription required for Live Opportunities',
        upgrade_url: '/upgrade'
      });
    }

    logger.info(`🔥 Fetching live trend opportunities for ${sport}`);

    const opportunities = await trendAnalysisService.getLiveTrendOpportunities(
      sport.toUpperCase()
    );

    res.json({
      success: true,
      sport: sport.toUpperCase(),
      opportunities,
      total_opportunities: opportunities.length,
      feature_type: 'live_opportunities'
    });

  } catch (error) {
    logger.error('Error fetching live opportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live opportunities'
    });
  }
});

/**
 * Get combined trends summary for Pro users
 */
router.get('/summary/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const { tier = 'free' } = req.query;

    // Check if user has Pro access
    if (tier !== 'pro') {
      return res.status(403).json({
        success: false,
        error: 'Pro subscription required for Trends Summary',
        upgrade_url: '/upgrade'
      });
    }

    logger.info(`📈 Fetching trends summary for ${sport}`);

    // Get all trend types in parallel
    const [playerTrends, teamTrends, opportunities] = await Promise.all([
      trendAnalysisService.getPlayerPropTrends(sport.toUpperCase(), 3),
      trendAnalysisService.getTeamTrends(sport.toUpperCase(), 3),
      trendAnalysisService.getLiveTrendOpportunities(sport.toUpperCase())
    ]);

    // Calculate summary stats
    const strongPlayerTrends = playerTrends.filter(t => t.trend_strength === 'strong');
    const strongTeamTrends = teamTrends.filter(t => t.trend_strength === 'strong');
    
    const topTrends = [
      ...playerTrends.slice(0, 3),
      ...teamTrends.slice(0, 2)
    ].sort((a, b) => {
      const scoreA = 'confidence_score' in a ? a.confidence_score : a.current_streak * 10;
      const scoreB = 'confidence_score' in b ? b.confidence_score : b.current_streak * 10;
      return scoreB - scoreA;
    });

    res.json({
      success: true,
      sport: sport.toUpperCase(),
      summary: {
        total_player_trends: playerTrends.length,
        strong_player_trends: strongPlayerTrends.length,
        total_team_trends: teamTrends.length,
        strong_team_trends: strongTeamTrends.length,
        live_opportunities: opportunities.length,
        top_trends: topTrends.slice(0, 5)
      },
      player_trends: playerTrends.slice(0, 8), // Top 8
      team_trends: teamTrends.slice(0, 5), // Top 5
      opportunities: opportunities.slice(0, 3), // Top 3
      feature_type: 'trends_summary'
    });

  } catch (error) {
    logger.error('Error fetching trends summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trends summary'
    });
  }
});

/**
 * Get trend details for a specific player/team
 */
router.get('/details/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { tier = 'free' } = req.query;

    // Check if user has Pro access
    if (tier !== 'pro') {
      return res.status(403).json({
        success: false,
        error: 'Pro subscription required for Trend Details',
        upgrade_url: '/upgrade'
      });
    }

    // This would fetch detailed trend analysis for a specific player/team
    // For now, return a placeholder response
    res.json({
      success: true,
      type,
      id,
      details: {
        message: 'Detailed trend analysis coming soon!',
        feature_type: 'trend_details'
      }
    });

  } catch (error) {
    logger.error('Error fetching trend details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trend details'
    });
  }
});

export default router; 
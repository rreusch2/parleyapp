import { Router } from 'express';
import { logger } from '../../utils/logger';
import { newsService, NewsItem } from '../../services/newsService';
import { authenticateUser } from '../middleware/auth';

const router = Router();

/**
 * GET /api/news
 * Get latest sports news and injury reports
 * Query params:
 * - sport: Filter by sport (nfl, nba, mlb, nhl)
 * - limit: Number of items to return (default: 20)
 * - type: Filter by news type (injury, trade, lineup, weather, breaking, analysis)
 */


router.get('/', authenticateUser, async (req, res) => {
  try {
    const { sport, limit = '20', type } = req.query;
    const userId = req.user?.id;

    logger.info(`[newsRoutes]: 📰 Fetching news for user ${userId}`, {
      sport,
      limit,
      type
    });

    // Fetch news from service
    const news = await newsService.getLatestNews(
      sport as string,
      parseInt(limit as string)
    );

    // Filter by type if specified
    const filteredNews = type 
      ? news.filter(item => item.type === type)
      : news;

    // Add user preferences (future enhancement)
    const enhancedNews = await enhanceNewsForUser(filteredNews, userId);

    logger.info(`[newsRoutes]: ✅ Returning ${enhancedNews.length} news items`);

    res.json({
      success: true,
      news: enhancedNews,
      total: enhancedNews.length,
      filters: {
        sport: sport || 'all',
        type: type || 'all',
        limit: parseInt(limit as string)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[newsRoutes]: Error fetching news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch news',
      news: [],
      total: 0
    });
  }
});

/**
 * GET /api/news/breaking
 * Get only breaking news and high-impact stories
 */
router.get('/breaking', authenticateUser, async (req, res) => {
  try {
    const { sport, limit = '10' } = req.query;
    const userId = req.user?.id;

    logger.info(`[newsRoutes]: 🚨 Fetching breaking news for user ${userId}`, { sport });

    const news = await newsService.getLatestNews(sport as string, 50);
    
    // Filter for breaking news and high impact
    const breakingNews = news.filter(item => 
      item.type === 'breaking' || 
      item.impact === 'high' ||
      item.type === 'injury'
    ).slice(0, parseInt(limit as string));

    res.json({
      success: true,
      news: breakingNews,
      total: breakingNews.length,
      type: 'breaking'
    });

  } catch (error) {
    logger.error('[newsRoutes]: Error fetching breaking news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch breaking news',
      news: []
    });
  }
});

/**
 * GET /api/news/injuries
 * Get only injury reports
 */
router.get('/injuries', authenticateUser, async (req, res) => {
  try {
    const { sport, limit = '15' } = req.query;
    const userId = req.user?.id;

    logger.info(`[newsRoutes]: 🏥 Fetching injury reports for user ${userId}`, { sport });

    const news = await newsService.getLatestNews(sport as string, 100);
    
    // Filter for injury reports only
    const injuryReports = news
      .filter(item => item.type === 'injury')
      .slice(0, parseInt(limit as string));

    // Group by sport for better organization
    const injuriesBySport = injuryReports.reduce((acc, injury) => {
      const sport = injury.sport;
      if (!acc[sport]) acc[sport] = [];
      acc[sport].push(injury);
      return acc;
    }, {} as Record<string, NewsItem[]>);

    res.json({
      success: true,
      injuries: injuryReports,
      injuriesBySport,
      total: injuryReports.length,
      type: 'injuries'
    });

  } catch (error) {
    logger.error('[newsRoutes]: Error fetching injury reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch injury reports',
      injuries: []
    });
  }
});

/**
 * GET /api/news/impact-analysis
 * Get news with betting impact analysis
 */
router.get('/impact-analysis', authenticateUser, async (req, res) => {
  try {
    const { sport, gameId } = req.query;
    const userId = req.user?.id;

    logger.info(`[newsRoutes]: 📊 Analyzing news impact for user ${userId}`, { sport, gameId });

    const news = await newsService.getLatestNews(sport as string, 30);
    
    // Analyze betting impact of news
    const impactAnalysis = await analyzeNewsImpact(news, {
      gameId: gameId as string,
      sport: sport as string
    });

    res.json({
      success: true,
      analysis: impactAnalysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[newsRoutes]: Error analyzing news impact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze news impact',
      analysis: {}
    });
  }
});

/**
 * GET /api/news/feed
 * Get personalized news feed based on user preferences
 */
router.get('/feed', authenticateUser, async (req, res) => {
  try {
    const { limit = '25' } = req.query;
    const userId = req.user?.id;

    logger.info(`[newsRoutes]: 🎯 Building personalized feed for user ${userId}`);

    // Get user's favorite sports/teams (from future user preferences)
    const userPreferences = await getUserNewsPreferences(userId);
    
    // Fetch news based on preferences
    const personalizedNews = await buildPersonalizedFeed(userPreferences, parseInt(limit as string));

    res.json({
      success: true,
      feed: personalizedNews,
      total: personalizedNews.length,
      personalized: true,
      preferences: userPreferences
    });

  } catch (error) {
    logger.error('[newsRoutes]: Error building personalized feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to build personalized feed',
      feed: []
    });
  }
});

/**
 * Helper functions
 */

async function enhanceNewsForUser(news: NewsItem[], userId?: string): Promise<NewsItem[]> {
  // Future enhancement: Add user-specific data like favorite teams, betting history, etc.
  return news.map(item => ({
    ...item,
    // Add user-specific enhancements here
    relevantToBets: false, // Check if news relates to user's active bets
    starred: false, // Check if user has starred this news
    read: false // Check if user has read this news
  }));
}

async function analyzeNewsImpact(news: NewsItem[], context: { gameId?: string; sport?: string }) {
  // Analyze how news might impact betting lines or predictions
  return {
    highImpactNews: news.filter(item => item.impact === 'high'),
    injuryImpacts: news.filter(item => item.type === 'injury').map(injury => ({
      ...injury,
      bettingImpact: calculateBettingImpact(injury),
      affectedBets: ['spread', 'total', 'player_props'] // Example
    })),
    weatherImpacts: news.filter(item => item.type === 'weather'),
    lineMovementTriggers: news.filter(item => 
      item.impact === 'high' && 
      (item.type === 'injury' || item.type === 'trade')
    ),
    summary: {
      totalHighImpact: news.filter(item => item.impact === 'high').length,
      injuryCount: news.filter(item => item.type === 'injury').length,
      breakingNewsCount: news.filter(item => item.type === 'breaking').length
    }
  };
}

function calculateBettingImpact(news: NewsItem): string {
  if (news.type === 'injury' && news.impact === 'high') {
    return 'Significant line movement expected';
  }
  if (news.type === 'weather' && news.impact === 'medium') {
    return 'May affect over/under totals';
  }
  if (news.type === 'trade' && news.impact === 'high') {
    return 'Team dynamics and spreads may shift';
  }
  return 'Minor impact expected';
}

async function getUserNewsPreferences(userId?: string) {
  // Future: Get from user preferences table
  return {
    favoriteSports: ['NBA', 'NFL'],
    favoriteTeams: ['Lakers', 'Cowboys'],
    newsTypes: ['injury', 'breaking', 'trade'],
    updatedAt: new Date().toISOString()
  };
}

async function buildPersonalizedFeed(preferences: any, limit: number): Promise<NewsItem[]> {
  // Build feed based on user preferences
  const allNews = await newsService.getLatestNews(undefined, limit * 2);
  
  // Score news based on user preferences
  const scoredNews = allNews.map(item => ({
    ...item,
    relevanceScore: calculateRelevanceScore(item, preferences)
  }));

  // Sort by relevance and return top items
  return scoredNews
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

function calculateRelevanceScore(news: NewsItem, preferences: any): number {
  let score = 0;
  
  // Base score by recency
  const hoursOld = (Date.now() - new Date(news.timestamp).getTime()) / (1000 * 60 * 60);
  score += Math.max(0, 10 - hoursOld); // Newer = higher score
  
  // Boost for favorite sports
  if (preferences.favoriteSports.includes(news.sport)) score += 15;
  
  // Boost for favorite teams
  if (news.team && preferences.favoriteTeams.includes(news.team)) score += 20;
  
  // Boost for preferred news types
  if (preferences.newsTypes.includes(news.type)) score += 10;
  
  // Boost for high impact
  if (news.impact === 'high') score += 8;
  if (news.impact === 'medium') score += 4;
  
  return score;
}

export default router; 
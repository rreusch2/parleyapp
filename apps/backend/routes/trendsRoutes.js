const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/trends/enhanced
 * Fetch enhanced trends with AI analysis and sportsbook odds
 */
router.get('/enhanced', async (req, res) => {
  try {
    const {
      sport = 'all',
      min_confidence = 60,
      sort_by = 'confidence',
      limit = 20,
      offset = 0
    } = req.query;

    // Build the base query for AI predictions with player data
    let trendsQuery = supabase
      .from('ai_predictions')
      .select(`
        id,
        confidence,
        reasoning,
        key_factors,
        player_id,
        prop_market_type,
        line_value,
        prediction_value,
        created_at,
        players!inner (
          id,
          name,
          team,
          sport,
          position,
          headshot_url
        )
      `)
      .gte('confidence', min_confidence)
      .eq('status', 'pending')
      .order('confidence', { ascending: false });

    // Apply sport filter
    if (sport !== 'all') {
      trendsQuery = trendsQuery.eq('players.sport', sport);
    }

    // Apply limit and offset
    trendsQuery = trendsQuery.range(offset, offset + limit - 1);

    const { data: aiPredictions, error: predictionsError } = await trendsQuery;

    if (predictionsError) {
      console.error('Error fetching AI predictions:', predictionsError);
      return res.status(500).json({ 
        error: 'Failed to fetch trends data',
        details: predictionsError.message 
      });
    }

    // Get trend patterns for additional context
    const { data: trendPatterns, error: trendsError } = await supabase
      .from('player_trend_patterns')
      .select(`
        player_id,
        prop_type_id,
        hit_rate,
        current_streak,
        streak_type,
        avg_value,
        median_value,
        sample_size,
        confidence_score,
        last_10_games,
        key_factors
      `)
      .eq('is_active', true);

    // Get current odds for context
    const { data: currentOdds, error: oddsError } = await supabase
      .from('current_odds_comparison')
      .select(`
        player_id,
        prop_type_id,
        best_over_odds,
        best_under_odds,
        consensus_line,
        all_odds,
        bookmakers (
          name,
          logo_url
        )
      `)
      .order('last_updated', { ascending: false });

    // Transform the data into enhanced format
    const enhancedTrends = aiPredictions.map(prediction => {
      // Find matching trend pattern
      const matchingPattern = trendPatterns?.find(p => 
        p.player_id === prediction.player_id
      );

      // Find matching odds
      const playerOdds = currentOdds?.filter(o => 
        o.player_id === prediction.player_id
      ) || [];

      // Format sportsbook odds
      const sportsbookOdds = formatSportsbookOdds(playerOdds);

      return {
        id: prediction.id,
        player: {
          id: prediction.players.id,
          name: prediction.players.name,
          team: prediction.players.team,
          sport: prediction.players.sport,
          position: prediction.players.position,
          headshot_url: prediction.players.headshot_url
        },
        market_type: prediction.prop_market_type || 'unknown',
        market_display_name: formatMarketName(prediction.prop_market_type, prediction.line_value),
        confidence_score: prediction.confidence,
        hit_rate: matchingPattern?.hit_rate || 75,
        current_streak: matchingPattern?.current_streak || 3,
        streak_type: prediction.prediction_value > prediction.line_value ? 'over' : 'under',
        sample_size: matchingPattern?.sample_size || 15,
        avg_value: matchingPattern?.avg_value || prediction.prediction_value,
        median_value: matchingPattern?.median_value || prediction.prediction_value,
        last_10_games: matchingPattern?.last_10_games || [],
        ai_reasoning: prediction.reasoning,
        key_factors: prediction.key_factors || [],
        sportsbook_odds: sportsbookOdds,
        next_game: {
          opponent: 'TBD',
          game_time: 'TBD',
          is_home: true
        },
        line_movement: {
          opening_line: prediction.line_value,
          current_line: prediction.line_value,
          movement_direction: 'stable',
          movement_percentage: 0
        }
      };
    });

    // Apply sorting
    const sortedTrends = applySorting(enhancedTrends, sort_by);

    res.json({
      trends: sortedTrends,
      total: enhancedTrends.length,
      has_more: enhancedTrends.length === limit
    });

  } catch (error) {
    console.error('Error in enhanced trends endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /api/trends/ai-insights
 * Get AI insights for today's trends
 */
router.get('/ai-insights', async (req, res) => {
  try {
    const { data: insights, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('is_global', true)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching AI insights:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch AI insights',
        details: error.message 
      });
    }

    const formattedInsights = insights?.map(insight => ({
      id: insight.id,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      impact: insight.impact,
      affected_players: insight.data?.affected_players || [],
      created_at: insight.created_at
    })) || [];

    res.json({ insights: formattedInsights });

  } catch (error) {
    console.error('Error in AI insights endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /api/trends/player/:playerId
 * Get detailed player trend analysis
 */
router.get('/player/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;

    // Get player's game stats
    const { data: gameStats, error: statsError } = await supabase
      .from('player_game_stats')
      .select(`
        *,
        sports_events (
          event_date,
          home_team_id,
          away_team_id,
          teams_home:teams!sports_events_home_team_id_fkey (
            name,
            abbreviation
          ),
          teams_away:teams!sports_events_away_team_id_fkey (
            name,
            abbreviation
          )
        )
      `)
      .eq('player_id', playerId)
      .order('game_date', { ascending: false })
      .limit(30);

    // Get trend patterns
    const { data: patterns, error: patternsError } = await supabase
      .from('player_trend_patterns')
      .select(`
        *,
        player_prop_types (
          prop_name,
          category
        )
      `)
      .eq('player_id', playerId)
      .eq('is_active', true);

    // Get current lines/odds
    const { data: currentLines, error: linesError } = await supabase
      .from('current_odds_comparison')
      .select(`
        *,
        bookmakers (
          name,
          logo_url
        )
      `)
      .eq('player_id', playerId);

    res.json({
      gameStats: gameStats || [],
      patterns: patterns || [],
      currentLines: currentLines || []
    });

  } catch (error) {
    console.error('Error in player trends endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Helper functions
function formatMarketName(marketType, lineValue) {
  if (!marketType) return 'Unknown Market';
  
  const formatted = marketType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  
  if (lineValue) {
    return `${formatted} Over ${lineValue}`;
  }
  
  return formatted;
}

function formatSportsbookOdds(odds) {
  if (!odds || odds.length === 0) return [];

  return odds.map(odd => ({
    bookmaker: odd.bookmakers?.name || 'Unknown',
    logo_url: odd.bookmakers?.logo_url,
    over_odds: odd.best_over_odds || -110,
    under_odds: odd.best_under_odds || -110,
    line_value: odd.consensus_line || 0,
    is_best_over: odd.best_over_odds === Math.max(...odds.map(o => o.best_over_odds || -200)),
    is_best_under: odd.best_under_odds === Math.max(...odds.map(o => o.best_under_odds || -200))
  }));
}

function applySorting(trends, sortBy) {
  switch (sortBy) {
    case 'confidence':
      return trends.sort((a, b) => b.confidence_score - a.confidence_score);
    case 'hit_rate':
      return trends.sort((a, b) => b.hit_rate - a.hit_rate);
    case 'streak':
      return trends.sort((a, b) => b.current_streak - a.current_streak);
    case 'value':
      return trends.sort((a, b) => b.confidence_score - a.confidence_score);
    case 'recent':
      return trends.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    default:
      return trends.sort((a, b) => b.confidence_score - a.confidence_score);
  }
}

module.exports = router;

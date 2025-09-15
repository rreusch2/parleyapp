import express from 'express';
import { supabase } from '../../services/supabase/client';
import { createLogger } from '../../utils/logger';

const router = express.Router();
const logger = createLogger('playerPropsRoutes');

/**
 * @route GET /api/player-props/players
 * @desc Get all active players for a specific sport
 * @access Private
 */
router.get('/players', async (req, res) => {
  try {
    const { sport, team } = req.query;
    
    let query = supabase
      .from('players')
      .select('*')
      .eq('active', true);
    
    if (sport) {
      query = query.eq('sport', sport);
    }
    
    if (team) {
      query = query.eq('team', team);
    }
    
    const { data: players, error } = await query.order('name');
    
    if (error) {
      logger.error('Error fetching players:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch players' });
    }
    
    return res.status(200).json({ success: true, players });
  } catch (error) {
    logger.error(`Error in /players: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route GET /api/player-props/markets
 * @desc Get player prop markets for a specific game or player
 * @access Private
 */
router.get('/markets', async (req, res) => {
  try {
    const { game_id, player_id, market_type, sport } = req.query;
    
    let query = supabase
      .from('player_prop_markets')
      .select(`
        *,
        players (
          id,
          name,
          position,
          team,
          sport,
          jersey_number
        )
      `)
      .eq('is_active', true);
    
    if (game_id) {
      query = query.eq('game_id', game_id);
    }
    
    if (player_id) {
      query = query.eq('player_id', player_id);
    }
    
    if (market_type) {
      query = query.eq('market_type', market_type);
    }
    
    // Filter by sport through the players table
    if (sport) {
      query = query.eq('players.sport', sport);
    }
    
    const { data: markets, error } = await query
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Error fetching player prop markets:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch prop markets' });
    }
    
    return res.status(200).json({ success: true, markets });
  } catch (error) {
    logger.error(`Error in /markets: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route GET /api/player-props/predictions/:playerId
 * @desc Get AI predictions for a specific player's props
 * @access Private
 */
router.get('/predictions/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { market_type, days = 7 } = req.query;
    
    // Get recent predictions for this player
    let query = supabase
      .from('ai_predictions')
      .select(`
        *,
        players (
          name,
          position,
          team,
          sport
        )
      `)
      .eq('player_id', playerId)
      .gte('created_at', new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString());
    
    if (market_type) {
      query = query.eq('prop_market_type', market_type);
    }
    
    const { data: predictions, error } = await query
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Error fetching player predictions:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch predictions' });
    }
    
    return res.status(200).json({ success: true, predictions });
  } catch (error) {
    logger.error(`Error in /predictions: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route GET /api/player-props/stats/:playerId
 * @desc Get historical statistics for a player
 * @access Private
 */
router.get('/stats/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { limit = 10, stat_type } = req.query;
    
    let query = supabase
      .from('player_statistics')
      .select('*')
      .eq('player_id', playerId)
      .order('date', { ascending: false })
      .limit(Number(limit));
    
    const { data: stats, error } = await query;
    
    if (error) {
      logger.error('Error fetching player stats:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch player stats' });
    }
    
    // Calculate averages and trends
    const processedStats = {
      recentGames: stats,
      averages: calculatePlayerAverages(stats, stat_type as string),
      trends: calculatePlayerTrends(stats, stat_type as string)
    };
    
    return res.status(200).json({ success: true, stats: processedStats });
  } catch (error) {
    logger.error(`Error in /stats: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/player-props/prediction
 * @desc Generate AI prediction for a player prop
 * @access Private
 */
router.post('/prediction', async (req, res) => {
  try {
    const { player_id, market_type, line_value, game_context, user_id } = req.body;
    
    if (!player_id || !market_type || !line_value) {
      return res.status(400).json({ 
        success: false, 
        error: 'player_id, market_type, and line_value are required' 
      });
    }
    
    // Get player info
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', player_id)
      .single();
    
    if (playerError || !player) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }
    
    // Get player's recent statistics
    const { data: recentStats, error: statsError } = await supabase
      .from('player_statistics')
      .select('*')
      .eq('player_id', player_id)
      .order('date', { ascending: false })
      .limit(10);
    
    if (statsError) {
      logger.error('Error fetching player stats for prediction:', statsError);
    }
    
    // Generate prediction using our Python AI service
    const prediction = await generatePlayerPropPrediction({
      player,
      marketType: market_type,
      lineValue: line_value,
      recentStats: recentStats || [],
      gameContext: game_context || {}
    });
    
    // Save prediction to database
    const { data: savedPrediction, error: saveError } = await supabase
      .from('ai_predictions')
      .insert({
        user_id: user_id || 'system',
        match_teams: `${player.name} ${market_type}`,
        pick: `${prediction.recommendation} ${line_value}`,
        odds: prediction.impliedOdds,
        confidence: Math.round(prediction.confidence),
        sport: player.sport,
        event_time: game_context?.event_time || new Date().toISOString(),
        reasoning: prediction.reasoning,
        bet_type: 'player_prop',
        player_id: player_id,
        prop_market_type: market_type,
        line_value: parseFloat(line_value.toString()),
        prediction_value: parseFloat(prediction.predictedValue.toString()),
        value_percentage: parseFloat(prediction.valuePercentage.toString()),
        roi_estimate: parseFloat(prediction.roiEstimate.toString())
      })
      .select()
      .single();
    
    if (saveError) {
      logger.error('Error saving prediction:', saveError);
      return res.status(500).json({ success: false, error: 'Failed to save prediction' });
    }
    
    return res.status(200).json({ 
      success: true, 
      prediction: {
        ...savedPrediction,
        player,
        analysis: prediction
      }
    });
  } catch (error) {
    logger.error(`Error in /prediction: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Helper functions
function calculatePlayerAverages(stats: any[], statType?: string) {
  if (!stats.length) return {};
  
  const averages: any = {};
  const statKeys = statType ? [statType] : Object.keys(stats[0].stats || {});
  
  statKeys.forEach(key => {
    const values = stats
      .map(stat => stat.stats[key])
      .filter(val => typeof val === 'number');
    
    if (values.length > 0) {
      averages[key] = {
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        games: values.length,
        total: values.reduce((sum, val) => sum + val, 0)
      };
    }
  });
  
  return averages;
}

function calculatePlayerTrends(stats: any[], statType?: string) {
  if (stats.length < 3) return {};
  
  const trends: any = {};
  const statKeys = statType ? [statType] : Object.keys(stats[0].stats || {});
  
  statKeys.forEach(key => {
    const values = stats
      .slice(0, 5) // Last 5 games
      .map(stat => stat.stats[key])
      .filter(val => typeof val === 'number')
      .reverse(); // Chronological order
    
    if (values.length >= 3) {
      const recent3 = values.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
      const previous3 = values.slice(-6, -3).reduce((sum, val) => sum + val, 0) / 3;
      
      trends[key] = {
        direction: recent3 > previous3 ? 'up' : recent3 < previous3 ? 'down' : 'stable',
        change: ((recent3 - previous3) / previous3 * 100).toFixed(1) + '%',
        recent3GameAvg: recent3,
        previous3GameAvg: previous3
      };
    }
  });
  
  return trends;
}

async function generatePlayerPropPrediction({
  player,
  marketType,
  lineValue,
  recentStats,
  gameContext
}: {
  player: any;
  marketType: string;
  lineValue: number;
  recentStats: any[];
  gameContext: any;
}) {
  try {
    // Call our Python AI service for real ML predictions
    const axios = require('axios');
    
    // Prepare player stats for the ML model
    const playerStats = {
      [`player_${marketType}`]: recentStats.length > 0 ? 
        recentStats.slice(0, 5).reduce((sum, stat) => sum + (stat.stats[marketType] || 0), 0) / Math.min(5, recentStats.length) :
        lineValue, // Use line as default if no stats
      opponent_allowed_points: gameContext.opponent_allowed_points || 110,
      is_home: gameContext.is_home ? 1 : 0,
      days_rest: gameContext.days_rest || 1,
      minutes_played: gameContext.minutes_played || 35,
      pace: gameContext.pace || 100,
      team_off_rating: gameContext.team_off_rating || 110,
      team_def_rating: gameContext.team_def_rating || 110
    };
    
    const aiResponse = await axios.post('http://localhost:5001/api/predict/player-prop', {
      sport: player.sport,
      prop_type: marketType,
      player_stats: playerStats,
      line_value: lineValue
    });
    
    if (aiResponse.data.success) {
      const aiPrediction = aiResponse.data.prediction;
      return {
        predictedValue: aiPrediction.predicted_value,
        recommendation: aiPrediction.recommendation,
        confidence: aiPrediction.confidence,
        reasoning: `AI Model: Predicted ${aiPrediction.predicted_value} vs line ${lineValue}. ${aiPrediction.recommendation} with ${aiPrediction.confidence}% confidence.`,
        impliedOdds: '-110',
        valuePercentage: aiPrediction.value_percentage,
        roiEstimate: aiPrediction.expected_profit
      };
    }
  } catch (error) {
    logger.error('Error calling AI service:', error);
  }
  
  // Fallback to simple prediction if AI service fails
  const averages = calculatePlayerAverages(recentStats, marketType);
  const trends = calculatePlayerTrends(recentStats, marketType);
  
  const playerAvg = averages[marketType]?.average || lineValue;
  const trendDirection = trends[marketType]?.direction || 'stable';
  
  // Simple prediction logic fallback
  let predictedValue = playerAvg;
  let confidence = 65; // Base confidence
  
  // Adjust based on trends
  if (trendDirection === 'up') {
    predictedValue *= 1.05;
    confidence += 10;
  } else if (trendDirection === 'down') {
    predictedValue *= 0.95;
    confidence -= 5;
  }
  
  // Adjust based on game context
  if (gameContext.isHome) {
    predictedValue *= 1.02;
    confidence += 3;
  }
  
  const recommendation = predictedValue > lineValue ? 'Over' : 'Under';
  const valuePercentage = Math.abs((predictedValue - lineValue) / lineValue * 100);
  
  return {
    predictedValue: Math.round(predictedValue * 10) / 10,
    recommendation,
    confidence: Math.round(Math.min(confidence, 95)),
    reasoning: `Based on ${recentStats.length} recent games, ${player.name} averages ${playerAvg.toFixed(1)} ${marketType}. Current trend is ${trendDirection}. Predicted value: ${predictedValue.toFixed(1)} vs line of ${lineValue}.`,
    impliedOdds: confidence > 75 ? '-120' : '-110',
    valuePercentage: Math.round(valuePercentage * 10) / 10,
    roiEstimate: valuePercentage > 5 ? Math.round((valuePercentage / 2) * 10) / 10 : 2.5
  };
}

/**
 * @route GET /api/player-props/recent-lines/:playerId
 * @desc Get recent betting lines for a specific player and prop type
 * @access Private
 */
router.get('/recent-lines/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { prop_type, limit = 10, sport } = req.query;
    
    if (!playerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Player ID is required' 
      });
    }

    // Get player info to validate sport if provided
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, name, sport')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ success: false, error: 'Player not found' });
    }

    // If sport filter is provided, validate it matches player's sport
    if (sport && sport !== player.sport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Sport filter does not match player\'s sport' 
      });
    }

    // Build the query for recent lines
    let query = supabase
      .from('player_props_odds')
      .select(`
        id,
        line,
        over_odds,
        under_odds,
        created_at,
        last_update,
        player_prop_types!inner (
          id,
          prop_key,
          prop_name
        ),
        bookmakers (
          name
        )
      `)
      .eq('player_id', playerId);

    // Filter by prop type if specified
    if (prop_type) {
      // Map common prop types to database prop_keys
      const propKeyMapping: { [key: string]: string[] } = {
        'points': ['player_points', 'points'],
        'rebounds': ['player_rebounds', 'rebounds'],  
        'assists': ['player_assists', 'assists'],
        'hits': ['player_hits', 'batter_hits', 'hits'],
        'home_runs': ['player_home_runs', 'batter_home_runs', 'home_runs'],
        'rbis': ['player_rbis', 'batter_rbis', 'rbi', 'rbis'],
        'runs_scored': ['batter_runs_scored', 'runs', 'player_runs_scored'],
        'passing_yards': ['player_pass_yds', 'passing_yards'],
        'rushing_yards': ['player_rush_yds', 'rushing_yards'],
        'receiving_yards': ['player_reception_yds', 'receiving_yards'],
        'passing_tds': ['player_pass_tds', 'passing_touchdowns', 'passing_tds'],
        'rushing_tds': ['player_rush_tds', 'rushing_touchdowns', 'rushing_tds'],
        'receiving_tds': ['player_reception_tds', 'receiving_touchdowns', 'receiving_tds'],
        'receptions': ['player_receptions', 'receptions'],
        'completions': ['player_completions', 'passing_completions', 'completions'],
        'attempts': ['player_pass_att', 'passing_attempts', 'attempts'],
        'interceptions': ['player_interceptions', 'passing_interceptions', 'interceptions']
      };

      const propKeys = propKeyMapping[prop_type as string] || [prop_type as string];
      
      // Get prop type IDs for the keys
      const { data: propTypes, error: propTypeError } = await supabase
        .from('player_prop_types')
        .select('id')
        .in('prop_key', propKeys);

      if (propTypeError) {
        logger.error('Error fetching prop types:', propTypeError);
        return res.status(500).json({ success: false, error: 'Failed to fetch prop types' });
      }

      if (propTypes && propTypes.length > 0) {
        const propTypeIds = propTypes.map(pt => pt.id);
        query = query.in('prop_type_id', propTypeIds);
      } else {
        // No matching prop types found, return empty result
        return res.status(200).json({ 
          success: true, 
          recent_lines: [],
          player_info: player,
          message: `No lines found for prop type: ${prop_type}`
        });
      }
    }

    // Execute query with ordering and limit
    const { data: recentLines, error: linesError } = await query
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (linesError) {
      logger.error('Error fetching recent lines:', linesError);
      return res.status(500).json({ success: false, error: 'Failed to fetch recent lines' });
    }

    // Format the response data
    const formattedLines = (recentLines || []).map((line: any) => ({
      id: line.id,
      line: parseFloat(line.line),
      over_odds: parseFloat(line.over_odds),
      under_odds: parseFloat(line.under_odds),
      created_at: line.created_at,
      last_update: line.last_update,
      prop_name: line.player_prop_types?.prop_name || 'Unknown',
      prop_key: line.player_prop_types?.prop_key || 'unknown',
      bookmaker_name: line.bookmakers?.name || 'Unknown'
    }));

    // Group lines by prop type for better organization
    const groupedLines = formattedLines.reduce((acc, line) => {
      const propKey = line.prop_key;
      if (!acc[propKey]) {
        acc[propKey] = {
          prop_name: line.prop_name,
          prop_key: line.prop_key,
          lines: []
        };
      }
      acc[propKey].lines.push(line);
      return acc;
    }, {} as any);

    return res.status(200).json({ 
      success: true, 
      recent_lines: prop_type ? formattedLines : groupedLines,
      player_info: player,
      total_lines: formattedLines.length,
      prop_type_filter: prop_type || null
    });

  } catch (error) {
    logger.error(`Error in /recent-lines: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route GET /api/player-props/line-movements/:playerId
 * @desc Get line movement history for a specific player and prop type
 * @access Private
 */
router.get('/line-movements/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { prop_type, hours = 24 } = req.query;
    
    if (!playerId || !prop_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Player ID and prop_type are required' 
      });
    }

    // Get lines from the last X hours to track movements
    const hoursAgo = new Date(Date.now() - Number(hours) * 60 * 60 * 1000).toISOString();

    const { data: lineHistory, error } = await supabase
      .from('player_props_odds')
      .select(`
        line,
        over_odds,
        under_odds,
        created_at,
        last_update,
        player_prop_types!inner (
          prop_name,
          prop_key
        ),
        bookmakers (
          name
        )
      `)
      .eq('player_id', playerId)
      .eq('player_prop_types.prop_key', prop_type)
      .gte('created_at', hoursAgo)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching line movements:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch line movements' });
    }

    // Calculate line movements
    const movements: any[] = [];
    for (let i = 1; i < (lineHistory?.length || 0); i++) {
      const current: any = lineHistory![i];
      const previous: any = lineHistory![i - 1];
      
      if (parseFloat(current.line) !== parseFloat(previous.line)) {
        movements.push({
          timestamp: current.created_at,
          from_line: parseFloat(previous.line),
          to_line: parseFloat(current.line),
          change: parseFloat(current.line) - parseFloat(previous.line),
          from_over_odds: parseFloat(previous.over_odds),
          to_over_odds: parseFloat(current.over_odds),
          from_under_odds: parseFloat(previous.under_odds),
          to_under_odds: parseFloat(current.under_odds),
          bookmaker: current.bookmakers?.name || 'Unknown'
        });
      }
    }

    return res.status(200).json({ 
      success: true, 
      movements,
      total_movements: movements.length,
      time_range_hours: Number(hours),
      current_line: lineHistory && lineHistory.length > 0 ? parseFloat(lineHistory[lineHistory.length - 1].line) : null
    });

  } catch (error) {
    logger.error(`Error in /line-movements: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router; 
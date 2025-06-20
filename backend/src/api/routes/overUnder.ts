import express from 'express';
import { supabase } from '../../services/supabase/client';
import { createLogger } from '../../utils/logger';

const router = express.Router();
const logger = createLogger('overUnderRoutes');

/**
 * @route GET /api/over-under/games
 * @desc Get game totals for over/under betting
 * @access Private
 */
router.get('/games', async (req, res) => {
  try {
    const { sport, date, sportsbook, status = 'active' } = req.query;
    
    let query = supabase
      .from('game_totals')
      .select('*')
      .eq('market_status', status)
      .order('event_time', { ascending: true });
    
    if (sport) {
      query = query.eq('sport', sport);
    }
    
    if (date) {
      const startDate = new Date(date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      query = query.gte('event_time', startDate.toISOString())
                  .lt('event_time', endDate.toISOString());
    }
    
    if (sportsbook) {
      query = query.eq('sportsbook', sportsbook);
    }
    
    const { data: games, error } = await query;
    
    if (error) {
      logger.error('Error fetching game totals:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch game totals' });
    }
    
    return res.status(200).json({ success: true, games });
  } catch (error) {
    logger.error(`Error in /games: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route GET /api/over-under/teams
 * @desc Get team totals for over/under betting
 * @access Private
 */
router.get('/teams', async (req, res) => {
  try {
    const { sport, team, game_id, sportsbook, status = 'active' } = req.query;
    
    let query = supabase
      .from('team_totals')
      .select('*')
      .eq('market_status', status)
      .order('created_at', { ascending: false });
    
    if (sport) {
      query = query.eq('sport', sport);
    }
    
    if (team) {
      query = query.eq('team', team);
    }
    
    if (game_id) {
      query = query.eq('game_id', game_id);
    }
    
    if (sportsbook) {
      query = query.eq('sportsbook', sportsbook);
    }
    
    const { data: teamTotals, error } = await query;
    
    if (error) {
      logger.error('Error fetching team totals:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch team totals' });
    }
    
    return res.status(200).json({ success: true, teamTotals });
  } catch (error) {
    logger.error(`Error in /teams: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/over-under/prediction
 * @desc Generate AI prediction for over/under totals
 * @access Private
 */
router.post('/prediction', async (req, res) => {
  try {
    const { 
      game_id, 
      sport, 
      total_line, 
      home_team, 
      away_team, 
      user_id,
      bet_type = 'game_total' // 'game_total' or 'team_total'
    } = req.body;
    
    if (!game_id || !sport || !total_line) {
      return res.status(400).json({ 
        success: false, 
        error: 'game_id, sport, and total_line are required' 
      });
    }
    
    // Get recent team statistics for analysis
    const teamStats = await getTeamTotalStats(home_team, away_team, sport);
    
    // Get weather data if applicable (outdoor sports)
    let weatherData = null;
    if (['NFL', 'MLB'].includes(sport)) {
      weatherData = await getWeatherData(game_id);
    }
    
    // Generate prediction using ML analysis
    const prediction = await generateOverUnderPrediction({
      gameId: game_id,
      sport,
      totalLine: total_line,
      homeTeam: home_team,
      awayTeam: away_team,
      teamStats,
      weatherData,
      betType: bet_type
    });
    
    // Save prediction to database
    const { data: savedPrediction, error: saveError } = await supabase
      .from('ai_predictions')
      .insert({
        user_id: user_id || 'system',
        match_teams: `${home_team} vs ${away_team}`,
        pick: `${prediction.recommendation} ${total_line}`,
        odds: prediction.impliedOdds,
        confidence: prediction.confidence,
        sport: sport,
        event_time: new Date().toISOString(), // Would get from game data
        reasoning: prediction.reasoning,
        bet_type: 'total',
        line_value: total_line,
        prediction_value: prediction.predictedTotal,
        value_percentage: prediction.valuePercentage,
        roi_estimate: prediction.roiEstimate,
        game_id: game_id
      })
      .select()
      .single();
    
    if (saveError) {
      logger.error('Error saving over/under prediction:', saveError);
      return res.status(500).json({ success: false, error: 'Failed to save prediction' });
    }
    
    return res.status(200).json({ 
      success: true, 
      prediction: {
        ...savedPrediction,
        analysis: prediction
      }
    });
  } catch (error) {
    logger.error(`Error in /prediction: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route GET /api/over-under/trends/:team
 * @desc Get over/under trends for a specific team
 * @access Private
 */
router.get('/trends/:team', async (req, res) => {
  try {
    const { team } = req.params;
    const { sport, last_games = 10 } = req.query;
    
    // Get recent team total results
    const { data: teamResults, error: teamError } = await supabase
      .from('team_totals')
      .select('*')
      .eq('team', team)
      .eq('market_status', 'settled')
      .order('created_at', { ascending: false })
      .limit(Number(last_games));
    
    if (teamError) {
      logger.error('Error fetching team trends:', teamError);
      return res.status(500).json({ success: false, error: 'Failed to fetch team trends' });
    }
    
    // Get recent game total results for team's games
    const { data: gameResults, error: gameError } = await supabase
      .from('game_totals')
      .select('*')
      .or(`home_team.eq.${team},away_team.eq.${team}`)
      .eq('market_status', 'settled')
      .order('event_time', { ascending: false })
      .limit(Number(last_games));
    
    if (gameError) {
      logger.error('Error fetching game trends:', gameError);
    }
    
    // Calculate trends
    const trends = calculateOverUnderTrends(teamResults || [], gameResults || []);
    
    return res.status(200).json({ 
      success: true, 
      team,
      trends,
      recentGames: gameResults || []
    });
  } catch (error) {
    logger.error(`Error in /trends: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/over-under/bulk-predictions
 * @desc Generate predictions for multiple games at once
 * @access Private
 */
router.post('/bulk-predictions', async (req, res) => {
  try {
    const { sport, date, min_confidence = 60, user_id } = req.body;
    
    if (!sport) {
      return res.status(400).json({ success: false, error: 'sport is required' });
    }
    
    // Get all active game totals for the sport/date
    let query = supabase
      .from('game_totals')
      .select('*')
      .eq('sport', sport)
      .eq('market_status', 'active');
    
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      query = query.gte('event_time', startDate.toISOString())
                  .lt('event_time', endDate.toISOString());
    }
    
    const { data: games, error } = await query;
    
    if (error) {
      logger.error('Error fetching games for bulk predictions:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch games' });
    }
    
    if (!games || games.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'No active games found for the specified criteria' 
      });
    }
    
    // Generate predictions for each game
    const predictions = [];
    
    for (const game of games) {
      try {
        const teamStats = await getTeamTotalStats(game.home_team, game.away_team, sport);
        const weatherData = ['NFL', 'MLB'].includes(sport) ? await getWeatherData(game.game_id) : null;
        
        const prediction = await generateOverUnderPrediction({
          gameId: game.game_id,
          sport: game.sport,
          totalLine: game.total_line,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          teamStats,
          weatherData,
          betType: 'game_total'
        });
        
        if (prediction.confidence >= min_confidence) {
          // Save high-confidence predictions
          const { data: savedPrediction, error: saveError } = await supabase
            .from('ai_predictions')
            .insert({
              user_id: user_id || 'system',
              match_teams: `${game.home_team} vs ${game.away_team}`,
              pick: `${prediction.recommendation} ${game.total_line}`,
              odds: prediction.impliedOdds,
              confidence: prediction.confidence,
              sport: game.sport,
              event_time: game.event_time,
              reasoning: prediction.reasoning,
              bet_type: 'total',
              line_value: game.total_line,
              prediction_value: prediction.predictedTotal,
              value_percentage: prediction.valuePercentage,
              roi_estimate: prediction.roiEstimate,
              game_id: game.game_id
            })
            .select()
            .single();
          
          if (!saveError) {
            predictions.push({
              game,
              prediction: savedPrediction,
              analysis: prediction
            });
          }
        }
      } catch (gameError) {
        logger.error(`Error generating prediction for game ${game.game_id}:`, gameError);
        continue;
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      totalGamesAnalyzed: games.length,
      highConfidencePredictions: predictions.length,
      predictions 
    });
  } catch (error) {
    logger.error(`Error in /bulk-predictions: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Helper functions
async function getTeamTotalStats(homeTeam: string, awayTeam: string, sport: string) {
  // This would fetch recent scoring statistics for both teams
  // For now, returning mock data
  return {
    homeTeam: {
      name: homeTeam,
      avgPointsFor: 112.5,
      avgPointsAgainst: 108.2,
      overRecord: '8-7',
      recentTotals: [225, 210, 235, 218, 240]
    },
    awayTeam: {
      name: awayTeam,
      avgPointsFor: 108.8,
      avgPointsAgainst: 105.5,
      overRecord: '9-6',
      recentTotals: [215, 198, 228, 205, 222]
    }
  };
}

async function getWeatherData(gameId: string) {
  // This would fetch weather data from an API
  // For now, returning mock data
  return {
    temperature: 72,
    windSpeed: 8,
    windDirection: 'NW',
    precipitation: 0,
    humidity: 45,
    conditions: 'Clear'
  };
}

async function generateOverUnderPrediction({
  gameId,
  sport,
  totalLine,
  homeTeam,
  awayTeam,
  teamStats,
  weatherData,
  betType
}: {
  gameId: string;
  sport: string;
  totalLine: number;
  homeTeam: string;
  awayTeam: string;
  teamStats: any;
  weatherData: any;
  betType: string;
}) {
  // Simplified prediction logic - replace with your ML model
  
  const homeAvg = teamStats.homeTeam?.avgPointsFor || 100;
  const awayAvg = teamStats.awayTeam?.avgPointsFor || 100;
  const homeDefense = teamStats.homeTeam?.avgPointsAgainst || 100;
  const awayDefense = teamStats.awayTeam?.avgPointsAgainst || 100;
  
  // Calculate predicted total based on team averages
  let predictedTotal = (homeAvg + awayAvg + homeDefense + awayDefense) / 2;
  
  let confidence = 65; // Base confidence
  
  // Adjust for weather (if applicable)
  if (weatherData && ['NFL', 'MLB'].includes(sport)) {
    if (weatherData.windSpeed > 15) {
      predictedTotal *= 0.95; // Wind reduces scoring
      confidence += 5;
    }
    if (weatherData.precipitation > 0) {
      predictedTotal *= 0.92; // Rain reduces scoring
      confidence += 8;
    }
    if (weatherData.temperature < 40) {
      predictedTotal *= 0.94; // Cold reduces scoring
      confidence += 3;
    }
  }
  
  // Adjust for pace/style factors (sport-specific)
  if (sport === 'NBA') {
    predictedTotal *= 1.02; // NBA tends to be higher scoring
  } else if (sport === 'NHL') {
    predictedTotal *= 0.85; // NHL lower scoring
  }
  
  const recommendation = predictedTotal > totalLine ? 'Over' : 'Under';
  const difference = Math.abs(predictedTotal - totalLine);
  const valuePercentage = (difference / totalLine) * 100;
  
  // Increase confidence if prediction differs significantly from line
  if (valuePercentage > 5) {
    confidence += Math.min(valuePercentage * 2, 20);
  }
  
  return {
    predictedTotal: Math.round(predictedTotal * 10) / 10,
    recommendation,
    confidence: Math.min(confidence, 95),
    reasoning: `Predicted total: ${predictedTotal.toFixed(1)} vs line of ${totalLine}. ${homeTeam} averages ${homeAvg} points, ${awayTeam} averages ${awayAvg}. Weather factors ${weatherData ? 'considered' : 'not applicable'}.`,
    impliedOdds: confidence > 75 ? '-125' : '-110',
    valuePercentage: Math.round(valuePercentage * 10) / 10,
    roiEstimate: valuePercentage > 3 ? Math.round((valuePercentage / 2) * 10) / 10 : 2.0,
    factors: {
      homeAverage: homeAvg,
      awayAverage: awayAvg,
      weatherImpact: weatherData ? 'Yes' : 'No',
      confidenceFactors: ['Team averages', 'Defensive stats', weatherData ? 'Weather conditions' : null].filter(Boolean)
    }
  };
}

function calculateOverUnderTrends(teamResults: any[], gameResults: any[]) {
  const trends = {
    teamTotal: {
      overRecord: 0,
      underRecord: 0,
      pushRecord: 0,
      overPercentage: 0
    },
    gameTotal: {
      overRecord: 0,
      underRecord: 0,
      pushRecord: 0,
      overPercentage: 0
    },
    averageTotal: 0,
    streak: {
      type: 'none',
      count: 0
    }
  };
  
  // Calculate team total trends
  if (teamResults.length > 0) {
    teamResults.forEach(result => {
      if (result.actual_total > result.total_line) {
        trends.teamTotal.overRecord++;
      } else if (result.actual_total < result.total_line) {
        trends.teamTotal.underRecord++;
      } else {
        trends.teamTotal.pushRecord++;
      }
    });
    
    trends.teamTotal.overPercentage = 
      (trends.teamTotal.overRecord / teamResults.length) * 100;
  }
  
  // Calculate game total trends
  if (gameResults.length > 0) {
    gameResults.forEach(result => {
      if (result.actual_total > result.total_line) {
        trends.gameTotal.overRecord++;
      } else if (result.actual_total < result.total_line) {
        trends.gameTotal.underRecord++;
      } else {
        trends.gameTotal.pushRecord++;
      }
    });
    
    trends.gameTotal.overPercentage = 
      (trends.gameTotal.overRecord / gameResults.length) * 100;
    
    trends.averageTotal = 
      gameResults.reduce((sum, game) => sum + (game.actual_total || 0), 0) / gameResults.length;
    
    // Calculate current streak
    let currentStreak = 0;
    let streakType = 'none';
    
    for (let i = 0; i < Math.min(5, gameResults.length); i++) {
      const result = gameResults[i];
      const isOver = result.actual_total > result.total_line;
      
      if (i === 0) {
        streakType = isOver ? 'over' : 'under';
        currentStreak = 1;
      } else if ((isOver && streakType === 'over') || (!isOver && streakType === 'under')) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    trends.streak = { type: streakType, count: currentStreak };
  }
  
  return trends;
}

export default router; 
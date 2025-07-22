import { Response } from 'express';
import { supabase } from '../../services/supabase/client';
import { AuthenticatedRequest } from '../../types/auth';

export const getPredictions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sport, status } = req.query;
    let query = supabase
      .from('predictions')
      .select(`
        *,
        sports_events (
          sport,
          league,
          home_team,
          away_team,
          start_time,
          odds,
          stats
        )
      `)
      .eq('user_id', { id: "test-user" }.id)
      .order('created_at', { ascending: false });

    if (sport) {
      query = query.eq('sport', sport);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
};

export const getPredictionById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('predictions')
      .select(`
        *,
        sports_events (
          sport,
          league,
          home_team,
          away_team,
          start_time,
          odds,
          stats
        )
      `)
      .eq('id', id)
      .eq('user_id', { id: "test-user" }.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching prediction:', error);
    res.status(500).json({ error: 'Failed to fetch prediction' });
  }
};

export const generatePrediction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { event_id, sport } = req.body;

    // First, get user preferences
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', { id: "test-user" }.id)
      .single();

    if (prefError) throw prefError;

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('sports_events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError) throw eventError;

    // Parse the odds from the event
    const odds = event.odds;
    
    // Apply AI-based prediction logic
    const prediction = generateAIPrediction(event, preferences);

    const predictionData = {
      user_id: { id: "test-user" }.id,
      event_id,
      sport,
      matchup: `${event.home_team} vs ${event.away_team}`,
      pick: prediction.pick,
      odds: prediction.odds,
      confidence: prediction.confidence,
      analysis: prediction.analysis,
      expires_at: event.start_time,
      status: 'pending'
    };

    const { data, error } = await supabase
      .from('predictions')
      .insert(predictionData)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error generating prediction:', error);
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
};

export const updatePredictionStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'won', 'lost'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('predictions')
      .update({ status })
      .eq('id', id)
      .eq('user_id', { id: "test-user" }.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating prediction:', error);
    res.status(500).json({ error: 'Failed to update prediction' });
  }
};

// Helper function to generate AI predictions
function generateAIPrediction(event: any, preferences: any) {
  // Get team data and stats
  const homeTeam = event.home_team;
  const awayTeam = event.away_team;
  const odds = event.odds;
  const stats = event.stats || {};
  
  // Default to home team advantage if no stats available
  let homeWinProbability = 0.55; // Default slight home advantage
  
  // If we have stats, use them to calculate a more accurate probability
  if (stats.home_win_percentage || stats.away_win_percentage) {
    homeWinProbability = stats.home_win_percentage || 0.55;
  }
  
  // Risk tolerance adjustment
  let confidenceThreshold = 0.55; // Medium risk default
  let preferredOddsType = 'moneyline';
  
  switch (preferences.risk_tolerance) {
    case 'low':
      // For low risk, we need higher confidence and prefer favorites
      confidenceThreshold = 0.65;
      break;
    case 'medium':
      // Medium risk is the default
      confidenceThreshold = 0.55;
      break;
    case 'high':
      // High risk, we can accept lower confidence and look for underdogs
      confidenceThreshold = 0.45;
      break;
  }
  
  // Determine the pick based on confidence and risk tolerance
  let pick = '';
  let oddsValue = '';
  let confidence = 0;
  let analysis = '';
  
  if (homeWinProbability >= confidenceThreshold) {
    // Home team is the pick
    pick = `${homeTeam} ML`;
    oddsValue = odds.home_win || '-110';
    confidence = Math.round(homeWinProbability * 100);
    
    analysis = `Based on our analysis, ${homeTeam} has a ${confidence}% chance to win against ${awayTeam}. `;
    
    if (preferences.risk_tolerance === 'low') {
      analysis += `This aligns with your low risk tolerance preference, as ${homeTeam} is the favorite with a high probability of winning.`;
    } else if (preferences.risk_tolerance === 'medium') {
      analysis += `This is a balanced pick that aligns with your medium risk tolerance.`;
    } else {
      analysis += `While this is a safer pick, you might consider more aggressive options given your high risk tolerance.`;
    }
  } else {
    // Away team is the pick
    pick = `${awayTeam} ML`;
    oddsValue = odds.away_win || '+110';
    confidence = Math.round((1 - homeWinProbability) * 100);
    
    analysis = `Based on our analysis, ${awayTeam} has a ${confidence}% chance to win against ${homeTeam}. `;
    
    if (preferences.risk_tolerance === 'low') {
      analysis += `This might be riskier than you prefer given your low risk tolerance.`;
    } else if (preferences.risk_tolerance === 'medium') {
      analysis += `This is a balanced pick that aligns with your medium risk tolerance.`;
    } else {
      analysis += `This underdog pick aligns well with your high risk tolerance and could provide good value.`;
    }
  }
  
  return {
    pick,
    odds: oddsValue,
    confidence,
    analysis
  };
} 
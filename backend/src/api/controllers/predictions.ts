import { Request, Response } from 'express';
import { supabase } from '../../services/supabase/client';

export const getPredictions = async (req: Request, res: Response) => {
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
      .eq('user_id', req.user!.id)
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

export const getPredictionById = async (req: Request, res: Response) => {
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
      .eq('user_id', req.user!.id)
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

export const generatePrediction = async (req: Request, res: Response) => {
  try {
    const { event_id, sport } = req.body;

    // First, get user preferences
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', req.user!.id)
      .single();

    if (prefError) throw prefError;

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('sports_events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError) throw eventError;

    // TODO: Implement AI prediction logic here
    // For now, we'll create a simple mock prediction
    const mockAnalysis = `Based on recent performance and historical data, 
      this prediction takes into account the user's ${preferences.risk_tolerance} risk tolerance.`;

    const prediction = {
      user_id: req.user!.id,
      event_id,
      sport,
      matchup: `${event.home_team} vs ${event.away_team}`,
      pick: `${event.home_team} ML`,
      odds: '-110',
      confidence: 75,
      analysis: mockAnalysis,
      expires_at: event.start_time,
      status: 'pending'
    };

    const { data, error } = await supabase
      .from('predictions')
      .insert(prediction)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error generating prediction:', error);
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
};

export const updatePredictionStatus = async (req: Request, res: Response) => {
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
      .eq('user_id', req.user!.id)
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
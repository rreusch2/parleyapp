import { Request, Response } from 'express';
import { supabase } from '../../services/supabase/client';

export const getUserBets = async (req: Request, res: Response) => {
  try {
    const { status, limit, page } = req.query;
    
    let query = supabase
      .from('bet_history')
      .select(`
        *,
        predictions (
          id,
          sport,
          matchup,
          pick,
          odds,
          confidence,
          status
        )
      `)
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('result', status);
    }

    // Pagination
    const pageSize = parseInt(limit as string) || 10;
    const pageNum = parseInt(page as string) || 1;
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      data: data || [],
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: count || 0,
        pages: count ? Math.ceil(count / pageSize) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({ error: 'Failed to fetch user bets' });
  }
};

export const createBet = async (req: Request, res: Response) => {
  try {
    const { prediction_id, amount, odds } = req.body;

    if (!prediction_id || !amount || !odds) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate potential payout
    let potentialPayout = 0;
    if (odds.startsWith('-')) {
      // Negative odds (favorite)
      const oddsValue = Math.abs(parseInt(odds.slice(1)));
      potentialPayout = amount + (amount * 100 / oddsValue);
    } else {
      // Positive odds (underdog)
      const oddsValue = parseInt(odds.slice(1));
      potentialPayout = amount + (amount * oddsValue / 100);
    }

    // Round to 2 decimal places
    potentialPayout = Math.round(potentialPayout * 100) / 100;

    const bet = {
      user_id: req.user!.id,
      prediction_id,
      amount,
      odds,
      potential_payout: potentialPayout,
      result: 'pending',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('bet_history')
      .insert(bet)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating bet:', error);
    res.status(500).json({ error: 'Failed to create bet' });
  }
};

export const updateBetResult = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { result } = req.body;

    if (!['won', 'lost', 'pending'].includes(result)) {
      return res.status(400).json({ error: 'Invalid result' });
    }

    const { data, error } = await supabase
      .from('bet_history')
      .update({ 
        result,
        settled_at: result !== 'pending' ? new Date().toISOString() : null
      })
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Bet not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating bet result:', error);
    res.status(500).json({ error: 'Failed to update bet result' });
  }
};

export const getBetById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('bet_history')
      .select(`
        *,
        predictions (
          id,
          sport,
          matchup,
          pick,
          odds,
          confidence,
          status
        )
      `)
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Bet not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching bet:', error);
    res.status(500).json({ error: 'Failed to fetch bet' });
  }
}; 
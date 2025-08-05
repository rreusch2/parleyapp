
import { supabase } from '@/lib/supabase/client';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { trendId } = req.query;

  if (!trendId) {
    return res.status(400).json({ error: 'Trend ID is required' });
  }

  try {
    const { data: trend, error: trendError } = await supabase
      .from('ai_trends')
      .select('*')
      .eq('id', trendId)
      .single();

    if (trendError) {
      throw trendError;
    }

    if (!trend) {
      return res.status(404).json({ error: 'Trend not found' });
    }

    const { data: propType, error: propTypeError } = await supabase
        .from('player_prop_types')
        .select('id')
        .eq('prop_name', trend.metadata?.prop_type_id)
        .single();

    if (propTypeError) {
        throw propTypeError;
    }
    
    const { data: propData, error: propError } = await supabase
      .from('player_props_odds')
      .select('line, over_odds, under_odds, event_id, prop_type_id')
      .eq('player_id', trend.player_id)
      .eq('event_id', trend.metadata?.event_id)
      .eq('prop_type_id', propType.id)
      .single();

    if (propError && propError.code !== 'PGRST116') {
      // Ignore 'PGRST116' which means no rows found
      throw propError;
    }

    const { data: eventData, error: eventError } = await supabase
        .from('sports_events')
        .select('home_team, away_team, start_time')
        .eq('id', trend.metadata?.event_id)
        .single();
    
    if (eventError) {
        throw eventError;
    }

    res.status(200).json({
      ...trend,
      prop_line: propData?.line,
      over_odds: propData?.over_odds,
      under_odds: propData?.under_odds,
      event_details: eventData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

import { Request, Response } from 'express';
import { supabase } from '../../services/supabase/client';

export const getSportsEvents = async (req: Request, res: Response) => {
  try {
    const { sport, league, status, start_date, end_date } = req.query;
    
    let query = supabase
      .from('sports_events')
      .select('*')
      .order('start_time', { ascending: true });

    // Apply filters if provided
    if (sport && typeof sport === 'string') {
      console.log('Filtering by sport:', sport.toUpperCase());
      query = query.eq('sport', sport.toUpperCase());
    }

    if (league && typeof league === 'string') {
      const leagueFilter = league.toUpperCase();
      console.log('Filtering by league:', leagueFilter);
      
      // Backend mapping to support frontend filters and handle inconsistent DB naming
      if (leagueFilter === 'NBA') {
        // Show NBA games only (WNBA has its own tab now)
        query = query.eq('sport', 'NBA');
      } else if (leagueFilter === 'WNBA') {
        // Handle WNBA games stored with full name in sport field
        query = query.eq('sport', "Women's National Basketball Association");
      } else if (leagueFilter === 'UFC') {
        // Show UFC/MMA games under UFC filter
        query = query.eq('sport', 'Ultimate Fighting Championship');
      } else if (leagueFilter === 'MMA') {
        // Show MMA games under MMA filter
        query = query.eq('sport', 'Ultimate Fighting Championship');
      } else if (leagueFilter === 'MLB') {
        // Handle MLB games with inconsistent naming
        query = query.in('sport', ['MLB', 'Major League Baseball']);
      } else {
        // Standard filtering for other leagues - try both sport and league fields
        query = query.or(`sport.eq.${leagueFilter},league.eq.${leagueFilter}`);
      }
    }
    
    // When no league filter is applied ("All" tab), we want all games
    // No additional filtering needed - let all sports through

    if (status) {
      console.log('Filtering by status:', status);
      query = query.eq('status', status);
    }

    if (start_date) {
      query = query.gte('start_time', start_date);
    }

    if (end_date) {
      query = query.lte('start_time', end_date);
    }

    // Limit to upcoming games for today and tomorrow only (unless specific dates provided)
    if (!start_date && !end_date) {
      const now = new Date();
      const today = new Date(now);
      today.setUTCHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date(now);
      dayAfterTomorrow.setDate(now.getDate() + 2);
      dayAfterTomorrow.setUTCHours(0, 0, 0, 0);
      
      console.log('Filtering games for today and tomorrow:', {
        from: today.toISOString(),
        to: dayAfterTomorrow.toISOString()
      });
      
      query = query
        .gte('start_time', today.toISOString())
        .lt('start_time', dayAfterTomorrow.toISOString())
        .eq('status', 'scheduled'); // Only show scheduled games
    }

    // Paginate results
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50; // Increased from 20 to 50 to handle all games
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    // Log the results for debugging
    console.log('Query results:', {
      total: count,
      filtered: data?.length,
      leagues: data?.map(game => game.league),
      dates: data?.map(game => game.start_time)
    });

    res.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: count ? Math.ceil(count / limit) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching sports events:', error);
    res.status(500).json({ error: 'Failed to fetch sports events' });
  }
};

export const getSportsEventById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('sports_events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Sports event not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching sports event:', error);
    res.status(500).json({ error: 'Failed to fetch sports event' });
  }
};

export const searchSportsEvents = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Search in team names and league
    const { data, error } = await supabase
      .from('sports_events')
      .select('*')
      .or(`home_team.ilike.%${query}%,away_team.ilike.%${query}%,league.ilike.%${query}%`)
      .order('start_time', { ascending: true })
      .limit(20);

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error searching sports events:', error);
    res.status(500).json({ error: 'Failed to search sports events' });
  }
}; 
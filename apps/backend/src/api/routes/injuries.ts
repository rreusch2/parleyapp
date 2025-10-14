import { Router } from 'express';
import { supabase } from '../../services/supabase/client';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/injuries
 * Get injury reports with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { 
      sport, 
      team, 
      status, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let query = supabase
      .from('injury_reports')
      .select('*')
      .eq('is_active', true)
      .order('scraped_at', { ascending: false });

    // Apply filters
    if (sport) {
      query = query.eq('sport', (sport as string).toUpperCase());
    }
    
    if (team) {
      query = query.ilike('team_name', `%${team}%`);
    }
    
    if (status) {
      query = query.eq('injury_status', status as string);
    }

    // Apply pagination
    query = query.range(
      parseInt(offset as string), 
      parseInt(offset as string) + parseInt(limit as string) - 1
    );

    const { data, error } = await query;

    if (error) {
      logger.error('[InjuriesAPI]: Database error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch injury reports',
        details: error.message 
      });
    }

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      filters: { sport, team, status },
      pagination: { limit, offset }
    });

  } catch (error: any) {
    logger.error('[InjuriesAPI]: Error fetching injuries:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/injuries/stats
 * Get injury statistics by sport
 */
router.get('/stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('injury_reports')
      .select('sport, injury_status, team_name')
      .eq('is_active', true);

    if (error) {
      logger.error('[InjuriesAPI]: Stats database error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch injury stats',
        details: error.message 
      });
    }

    // Process statistics
    const stats = {
      total: data?.length || 0,
      by_sport: {} as Record<string, number>,
      by_status: {} as Record<string, number>,
      by_team: {} as Record<string, number>
    };

    data?.forEach(injury => {
      // Count by sport
      stats.by_sport[injury.sport] = (stats.by_sport[injury.sport] || 0) + 1;
      
      // Count by status
      stats.by_status[injury.injury_status] = (stats.by_status[injury.injury_status] || 0) + 1;
      
      // Count by team (limit to top teams to avoid clutter)
      if (injury.team_name && injury.team_name !== 'Unknown Team') {
        stats.by_team[injury.team_name] = (stats.by_team[injury.team_name] || 0) + 1;
      }
    });

    res.json({
      success: true,
      stats,
      last_updated: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('[InjuriesAPI]: Error fetching injury stats:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/injuries/upcoming-games
 * Get injuries for players in upcoming games
 */
router.get('/upcoming-games', async (req, res) => {
  try {
    const { sport, date } = req.query;
    
    // This would integrate with your sports_events table
    // For now, return recent injuries for the specified sport
    let query = supabase
      .from('injury_reports')
      .select('*')
      .eq('is_active', true)
      .in('injury_status', ['questionable', 'doubtful', 'probable'])
      .order('estimated_return_date', { ascending: true });

    if (sport) {
      query = query.eq('sport', (sport as string).toUpperCase());
    }

    const { data, error } = await query.limit(20);

    if (error) {
      logger.error('[InjuriesAPI]: Upcoming games error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch upcoming game injuries',
        details: error.message 
      });
    }

    res.json({
      success: true,
      data: data || [],
      message: 'Injuries affecting upcoming games',
      sport: sport || 'all'
    });

  } catch (error: any) {
    logger.error('[InjuriesAPI]: Error fetching upcoming game injuries:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/injuries/refresh
 * Manually trigger injury data refresh (admin only)
 */
router.post('/refresh', async (req, res) => {
  try {
    // Import the injury service
    const { injuryScrapingService } = await import('../../services/injuryScrapingService');
    
    logger.info('[InjuriesAPI]: Manual injury refresh triggered');
    
    // Run the scraper in the background
    injuryScrapingService.runInjuryUpdate()
      .then(() => {
        logger.info('[InjuriesAPI]: Manual injury refresh completed');
      })
      .catch((error) => {
        logger.error('[InjuriesAPI]: Manual injury refresh failed:', error);
      });

    res.json({
      success: true,
      message: 'Injury data refresh started',
      status: 'processing'
    });

  } catch (error: any) {
    logger.error('[InjuriesAPI]: Error triggering injury refresh:', error);
    res.status(500).json({ 
      error: 'Failed to trigger injury refresh',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 
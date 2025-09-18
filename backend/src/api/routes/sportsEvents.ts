import { Router } from 'express';
import { 
  getSportsEvents, 
  getSportsEventById, 
  searchSportsEvents 
} from '../controllers/sportsEvents';
import { authenticateUser } from '../middleware/auth';
import { oddsApiService } from '../../services/oddsApi';

const router = Router();

// TEMPORARY: Test route without auth for debugging
router.get('/test-no-auth', async (req, res) => {
  try {
    console.log('Testing sports events without auth...');
    
    // Simple query to check if we can connect to database
    const { supabase } = await import('../../services/supabase/client');
    const { data, error } = await supabase
      .from('sports_events')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database query failed', details: error.message });
    }
    
    console.log(`Found ${data?.length || 0} total games in database`);
    
    res.json({
      success: true,
      totalGames: data?.length || 0,
      games: data || [],
      message: 'Database connection working'
    });
  } catch (error: any) {
    console.error('Route error:', error);
    res.status(500).json({ error: 'Server error', details: error instanceof Error ? error.message : String(error) });
  }
});

// TEMPORARILY DISABLE AUTH FOR TESTING CORS
// router.use(authenticateUser);

// Get all sports events with optional filters
router.get('/', getSportsEvents);

// Search sports events
router.get('/search', searchSportsEvents);

// Manual trigger for sports data update (development only) - MUST be before /:id route
router.get('/trigger-update', async (req, res) => {
  try {
    console.log('🔄 Manual sports data update triggered from /api/sports-events/trigger-update');
    
    // Import the sports data service
    const { sportsDataService } = require('../../services/sportsData/sportsDataService');
    
    // Trigger the update
    await sportsDataService.runFullUpdate();
    
    res.json({
      success: true,
      message: 'Sports data update completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in manual sports data update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update sports data',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get live scores for specific events (proxies The Odds API scores endpoint)
router.get('/live-scores', async (req, res) => {
  try {
    const { league, eventIds, daysFrom } = req.query as { league?: string; eventIds?: string; daysFrom?: string };

    if (!league) {
      return res.status(400).json({ success: false, error: 'Missing required parameter: league' });
    }
    if (!eventIds) {
      return res.status(400).json({ success: false, error: 'Missing required parameter: eventIds (comma-separated external_event_id list)' });
    }

    // Map frontend league/sport to The Odds API sport key
    const keyMap: Record<string, string> = {
      MLB: 'baseball_mlb',
      'MAJOR LEAGUE BASEBALL': 'baseball_mlb',
      WNBA: 'basketball_wnba',
      NBA: 'basketball_nba',
      UFC: 'mma_mixed_martial_arts',
      MMA: 'mma_mixed_martial_arts',
      NFL: 'americanfootball_nfl',
      NCAAF: 'americanfootball_ncaaf',
      CFB: 'americanfootball_ncaaf'
    };

    const sportKey = keyMap[(league as string).toUpperCase()] || league;

    const ids = (eventIds as string).split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid eventIds provided' });
    }

    // Call Odds API via service (batch by 50 to keep URL reasonable)
    const batchSize = 50;
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += batchSize) {
      batches.push(ids.slice(i, i + batchSize));
    }

    const results = await Promise.all(batches.map(b =>
      oddsApiService.getScores(sportKey as string, {
        eventIds: b,
        daysFrom: daysFrom ? parseInt(daysFrom as string, 10) : 2,
        dateFormat: 'iso'
      })
    ));

    const combined = ([] as any[]).concat(...results);

    // Normalize into a map keyed by event id
    const scoresMap: Record<string, any> = {};
    for (const item of combined) {
      // Expected Odds API shape: { id, sport_key, sport_title, commence_time, completed, scores: [{name, score}], last_update }
      const home = item.scores?.[0] || null;
      const away = item.scores?.[1] || null;

      // Determine status conservatively using commence_time
      const commenceTime = item.commence_time ? new Date(item.commence_time).getTime() : null;
      const nowTs = Date.now();
      let mappedStatus: 'scheduled' | 'live' | 'completed' = 'scheduled';
      if (item.completed) {
        mappedStatus = 'completed';
      } else if (commenceTime !== null && nowTs >= commenceTime) {
        mappedStatus = 'live';
      } else {
        mappedStatus = 'scheduled';
      }

      scoresMap[item.id] = {
        eventId: item.id,
        completed: mappedStatus === 'completed',
        status: mappedStatus,
        lastUpdate: item.last_update || null,
        commence_time: item.commence_time,
        home: home ? { name: home.name, score: Number(home.score) } : null,
        away: away ? { name: away.name, score: Number(away.score) } : null
      };
    }

    res.json({ success: true, data: scoresMap, count: Object.keys(scoresMap).length });
  } catch (error: any) {
    console.error('Error fetching live scores:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch live scores' });
  }
});

// Get a specific sports event by ID - MUST be last to avoid conflicts
router.get('/:id', getSportsEventById);

export default router; 
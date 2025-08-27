import { Router } from 'express';
import { supabaseAdmin } from '../../services/supabaseClient';

const router = Router();

// Search players across all sports
router.get('/search', async (req, res) => {
  try {
    const { query, sport, limit = 20 } = req.query;

    if (!query || typeof query !== 'string' || query.length < 2) {
      return res.status(400).json({ 
        error: 'Query parameter is required and must be at least 2 characters' 
      });
    }

    let supabaseQuery = supabaseAdmin
      .from('players_with_headshots')
      .select(`
        id,
        name,
        team,
        sport,
        position,
        active,
        headshot_url,
        has_headshot,
        recent_stats_count:player_recent_stats(count)
      `)
      .ilike('name', `%${query}%`)
      .eq('active', true)
      .order('name');

    if (sport && sport !== 'all') {
      supabaseQuery = supabaseQuery.eq('sport', sport);
    }

    const { data, error } = await supabaseQuery.limit(Number(limit));

    if (error) throw error;

    const playersWithStats = data?.map(player => ({
      ...player,
      recent_games_count: player.recent_stats_count?.[0]?.count || 0,
      last_game_date: new Date().toISOString() // Will be updated with real data
    })) || [];

    res.json({
      players: playersWithStats,
      total: playersWithStats.length
    });

  } catch (error) {
    console.error('Player search error:', error);
    res.status(500).json({ 
      error: 'Failed to search players',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get player recent stats for specific prop type
router.get('/:playerId/stats', async (req, res) => {
  try {
    const { playerId } = req.params;
    const { propType = 'hits', limit = 10 } = req.query;

    // Validate player exists
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, name, team, sport, position')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get recent stats
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('player_recent_stats')
      .select('*')
      .eq('player_id', playerId)
      .order('game_date', { ascending: false })
      .limit(Number(limit));

    if (statsError) throw statsError;

    // Transform stats for the requested prop type
    const gameStats = stats?.map(stat => ({
      game_date: stat.game_date,
      opponent: stat.opponent,
      is_home: stat.is_home,
      value: stat[propType as string] || 0,
      game_result: stat.game_result
    })).reverse() || []; // Reverse to show oldest to newest for chart

    // Get current prop line if available
    const { data: propLine } = await supabaseAdmin
      .from('player_props_odds')
      .select('line')
      .eq('player_id', playerId)
      .like('prop_type', `%${propType}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    const currentLine = propLine?.[0]?.line || null;

    res.json({
      player,
      gameStats,
      currentLine,
      propType,
      gamesCount: gameStats.length
    });

  } catch (error) {
    console.error('Player stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch player stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get available prop types for a player based on sport
router.get('/:playerId/prop-types', async (req, res) => {
  try {
    const { playerId } = req.params;

    // Get player sport
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('sport')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Sport-specific prop types
    const propMappings: Record<string, Array<{key: string, name: string}>> = {
      'MLB': [
        { key: 'hits', name: 'Hits' },
        { key: 'home_runs', name: 'Home Runs' },
        { key: 'rbis', name: 'RBIs' },
        { key: 'runs_scored', name: 'Runs Scored' },
        { key: 'stolen_bases', name: 'Stolen Bases' },
        { key: 'strikeouts', name: 'Strikeouts' },
        { key: 'walks', name: 'Walks' },
        { key: 'total_bases', name: 'Total Bases' }
      ],
      'WNBA': [
        { key: 'points', name: 'Points' },
        { key: 'rebounds', name: 'Rebounds' },
        { key: 'assists', name: 'Assists' },
        { key: 'steals', name: 'Steals' },
        { key: 'blocks', name: 'Blocks' },
        { key: 'three_pointers', name: '3-Pointers' }
      ],
      'NBA': [
        { key: 'points', name: 'Points' },
        { key: 'rebounds', name: 'Rebounds' },
        { key: 'assists', name: 'Assists' },
        { key: 'steals', name: 'Steals' },
        { key: 'blocks', name: 'Blocks' },
        { key: 'three_pointers', name: '3-Pointers' }
      ],
      'NFL': [
        { key: 'passing_yards', name: 'Passing Yards' },
        { key: 'rushing_yards', name: 'Rushing Yards' },
        { key: 'receiving_yards', name: 'Receiving Yards' },
        { key: 'touchdowns', name: 'Touchdowns' },
        { key: 'receptions', name: 'Receptions' }
      ]
    };

    const propTypes = propMappings[player.sport] || [];

    res.json({
      propTypes,
      sport: player.sport
    });

  } catch (error) {
    console.error('Prop types error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch prop types',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get current prop lines for a player
router.get('/:playerId/prop-lines', async (req, res) => {
  try {
    const { playerId } = req.params;

    const { data: propLines, error } = await supabaseAdmin
      .from('player_props_odds')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by prop type and get most recent line for each
    const latestLines: Record<string, any> = {};
    
    propLines?.forEach(line => {
      const propKey = line.prop_type?.toLowerCase().replace(/[^a-z]/g, '_');
      if (propKey && !latestLines[propKey]) {
        latestLines[propKey] = {
          prop_type: line.prop_type,
          line: line.line,
          over_odds: line.over_odds,
          under_odds: line.under_odds,
          bookmaker: line.bookmaker,
          created_at: line.created_at
        };
      }
    });

    res.json({
      propLines: Object.values(latestLines),
      playerId
    });

  } catch (error) {
    console.error('Prop lines error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch prop lines',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add recent game stat for a player (for data ingestion)
router.post('/:playerId/stats', async (req, res) => {
  try {
    const { playerId } = req.params;
    const statData = req.body;

    // Validate required fields
    const requiredFields = ['game_date', 'opponent', 'is_home'];
    const missingFields = requiredFields.filter(field => !(field in statData));
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missingFields 
      });
    }

    // Insert or update stat record
    const { data, error } = await supabaseAdmin
      .from('player_recent_stats')
      .upsert({
        player_id: playerId,
        ...statData
      }, {
        onConflict: 'player_id,game_date,opponent'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      stat: data
    });

  } catch (error) {
    console.error('Add stat error:', error);
    res.status(500).json({ 
      error: 'Failed to add player stat',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk update player stats (for daily ingestion)
router.post('/bulk-stats', async (req, res) => {
  try {
    const { stats } = req.body;

    if (!Array.isArray(stats) || stats.length === 0) {
      return res.status(400).json({ error: 'Stats array is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('player_recent_stats')
      .upsert(stats, {
        onConflict: 'player_id,game_date,opponent'
      })
      .select();

    if (error) throw error;

    res.json({
      success: true,
      inserted: data?.length || 0,
      stats: data
    });

  } catch (error) {
    console.error('Bulk stats error:', error);
    res.status(500).json({ 
      error: 'Failed to bulk insert stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

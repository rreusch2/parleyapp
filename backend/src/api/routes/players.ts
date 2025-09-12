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

    // Query players directly to avoid DISTINCT ON limitation in view
    let supabaseQuery = supabaseAdmin
      .from('players')
      .select(`
        id,
        name,
        team,
        sport,
        position,
        active,
        player_headshots!left(headshot_url, is_active),
        player_game_stats!left(id, created_at)
      `)
      .ilike('name', `%${query}%`)
      .eq('active', true)
      .order('name, team');

    if (sport && sport !== 'all') {
      supabaseQuery = supabaseQuery.eq('sport', sport);
    }

    const { data, error } = await supabaseQuery.limit(Number(limit));

    if (error) throw error;

    const playersWithStats = data?.map(player => {
      const activeHeadshot = player.player_headshots?.find(h => h.is_active);
      const gameStats = player.player_game_stats || [];
      const sortedStats = gameStats.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return {
        id: player.id,
        name: player.name,
        team: player.team,
        sport: player.sport,
        position: player.position,
        active: player.active,
        headshot_url: activeHeadshot?.headshot_url || null,
        has_headshot: !!activeHeadshot,
        recent_games_count: gameStats.length,
        last_game_date: sortedStats[0]?.created_at || null
      };
    }) || [];

    // Deduplicate by name+sport, prefer entries with headshot, full team name, has position, more recent games
    const score = (p: any) =>
      (p.has_headshot ? 1000 : 0) +
      ((p.team && p.team.length > 3) ? 100 : 0) +
      (p.position ? 50 : 0) +
      (p.recent_games_count || 0);

    const dedupMap: Record<string, any> = {};
    for (const p of playersWithStats) {
      const key = `${(p.name || '').toLowerCase()}|${p.sport || ''}`;
      if (!dedupMap[key] || score(p) > score(dedupMap[key])) {
        dedupMap[key] = p;
      }
    }
    const deduped = Object.values(dedupMap);

    res.json({
      players: deduped,
      total: deduped.length
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

    // Helper to extract value from player_game_stats JSON
    const extractValue = (s: any, sport: string, key: string): number => {
      switch (sport) {
        case 'MLB': {
          const map: Record<string, any> = {
            hits: s.hits,
            home_runs: s.home_runs,
            rbis: s.rbis,
            runs_scored: s.runs ?? s.runs_scored,
            stolen_bases: s.stolen_bases,
            strikeouts: s.strikeouts,
            walks: s.walks,
            total_bases: s.total_bases,
          };
          return Number(map[key] ?? 0);
        }
        case 'NBA':
        case 'WNBA': {
          const map: Record<string, any> = {
            points: s.points,
            rebounds: s.rebounds,
            assists: s.assists,
            steals: s.steals,
            blocks: s.blocks,
            three_pointers: s.three_pointers_made ?? s.threes ?? 0,
          };
          return Number(map[key] ?? 0);
        }
        case 'NFL': {
          const map: Record<string, any> = {
            passing_yards: s.passing_yards,
            passing_tds: s.passing_touchdowns ?? s.passing_tds,
            completions: s.passing_completions ?? s.completions,
            attempts: s.passing_attempts ?? s.attempts,
            interceptions: s.passing_interceptions ?? s.interceptions,
            rushing_yards: s.rushing_yards,
            rushing_tds: s.rushing_touchdowns ?? s.rushing_tds,
            rushing_attempts: s.rushing_attempts,
            receiving_yards: s.receiving_yards,
            receiving_tds: s.receiving_touchdowns ?? s.receiving_tds,
            receptions: s.receptions,
            targets: s.targets ?? s.receiving_targets,
            fantasy_points: s.fantasy_points,
          };
          return Number(map[key] ?? 0);
        }
        default:
          return Number(s[key] ?? 0);
      }
    };

    // Prefer player_game_stats (JSONB) similar to iOS modal, fallback to player_recent_stats
    let gameStats: Array<{ game_date: any, opponent: string, is_home: boolean, value: number, game_result?: string }> = [];

    const { data: jsonStats, error: jsonErr } = await supabaseAdmin
      .from('player_game_stats')
      .select('stats, created_at')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (!jsonErr && jsonStats && jsonStats.length > 0) {
      gameStats = jsonStats.map((row: any) => {
        const s = row.stats || {};
        const value = extractValue(s, player.sport, String(propType));
        const opponent = s.opponent_team || s.opponent || 'OPP';
        const isHome = (typeof s.is_home === 'boolean' ? s.is_home : (s.home_or_away === 'home')) || false;
        const game_date = s.game_date || row.created_at;
        const result = (typeof s.plus_minus === 'number' ? (s.plus_minus > 0 ? 'W' : 'L') : undefined);
        return { game_date, opponent, is_home: isHome, value: Number(value || 0), game_result: result };
      }).filter(g => g.value !== undefined).reverse();
    }

    if (gameStats.length === 0) {
      const { data: stats, error: statsError } = await supabaseAdmin
        .from('player_recent_stats')
        .select('*')
        .eq('player_id', playerId)
        .order('game_date', { ascending: false })
        .limit(Number(limit));

      if (statsError) throw statsError;

      gameStats = stats?.map((stat: any) => ({
        game_date: stat.game_date,
        opponent: stat.opponent,
        is_home: stat.is_home,
        value: Number(stat[propType as string] || 0),
        game_result: stat.game_result
      })).reverse() || [];
    }

    // Get current prop line from player_props_odds table with proper prop type matching
    const sport = player.sport;
    const aliasMap: Record<string, Record<string, string[]>> = {
      MLB: {
        hits: ['player_hits', 'batter_hits', 'hits', 'player_hits_o_u'],
        home_runs: ['player_home_runs', 'batter_home_runs', 'home_runs'],
        rbis: ['player_rbis', 'batter_rbis', 'rbi', 'rbis'],
        runs_scored: ['batter_runs_scored', 'runs', 'player_runs_scored'],
        total_bases: ['player_total_bases', 'batter_total_bases', 'total_bases'],
        strikeouts: ['player_strikeouts', 'strikeouts'],
        strikeouts_pitched: ['pitcher_strikeouts', 'strikeouts_pitched'],
        hits_allowed: ['pitcher_hits_allowed', 'hits_allowed']
      },
      NBA: {
        points: ['player_points', 'points'],
        rebounds: ['player_rebounds', 'rebounds'],
        assists: ['player_assists', 'assists'],
        three_pointers: ['threes', 'three_pointers']
      },
      WNBA: {
        points: ['player_points', 'points'],
        rebounds: ['player_rebounds', 'rebounds'],
        assists: ['player_assists', 'assists'],
        three_pointers: ['threes', 'three_pointers']
      },
      NFL: {
        passing_yards: ['player_pass_yds'],
        rushing_yards: ['player_rush_yds'],
        receiving_yards: ['player_reception_yds'],
        receptions: ['player_receptions']
      }
    };
    const aliases = aliasMap[sport]?.[propType as string] || [propType as string];

    // Find prop_type_id for any alias
    const { data: propTypeRows } = await supabaseAdmin
      .from('player_prop_types')
      .select('id, prop_key')
      .in('prop_key', aliases)
      .limit(1);

    let currentLine: number | null = null;
    if (propTypeRows && propTypeRows.length > 0) {
      const propTypeId = propTypeRows[0].id;
      const { data: oddsRows } = await supabaseAdmin
        .from('player_props_odds')
        .select('line, last_update')
        .eq('player_id', playerId)
        .eq('prop_type_id', propTypeId)
        .order('last_update', { ascending: false })
        .limit(1);
      if (oddsRows && oddsRows.length > 0) {
        currentLine = Number(oddsRows[0].line);
      }
    }

    // Fallback to mock lines if no real data found
    if (currentLine === null) {
      const mockLines: Record<string, number> = {
        hits: 1.5,
        home_runs: 0.5,
        rbis: 1.5,
        runs_scored: 1.5,
        points: 18.5,
        rebounds: 8.5,
        assists: 6.5,
        passing_yards: 250.5,
        rushing_yards: 75.5,
        receiving_yards: 65.5,
        receptions: 5.5
      };
      currentLine = mockLines[propType as string] ?? 1.5;
    }

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

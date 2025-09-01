import { Router } from 'express';
import { supabaseAdmin } from '../../services/supabaseClient';

const router = Router();

// Search teams across all sports
router.get('/search', async (req, res) => {
  try {
    const { query, sport, limit = 20 } = req.query;

    if (!query || typeof query !== 'string' || query.length < 2) {
      return res.status(400).json({ 
        error: 'Query parameter is required and must be at least 2 characters' 
      });
    }

    let supabaseQuery = supabaseAdmin
      .from('teams')
      .select(`
        id,
        team_name,
        team_abbreviation,
        city,
        sport_key,
        logo_url,
        metadata
      `)
      .or(`team_name.ilike.%${query}%,team_abbreviation.ilike.%${query}%,city.ilike.%${query}%`)
      .order('team_name');

    if (sport && sport !== 'all') {
      // Handle sport filtering - map frontend sport names to database sport_key values
      let sportKey = sport;
      if (sport === 'Major League Baseball') sportKey = 'MLB';
      if (sport === 'National Football League') sportKey = 'NFL';
      if (sport === 'National Hockey League') sportKey = 'NHL';
      if (sport === 'National Basketball Association') sportKey = 'NBA';
      if (sport === "Women's National Basketball Association") sportKey = 'WNBA';
      
      supabaseQuery = supabaseQuery.eq('sport_key', sportKey);
    }

    const { data, error } = await supabaseQuery.limit(Number(limit));

    if (error) throw error;

    // Get recent games count for each team from team_recent_stats
    const teamIds = data?.map(t => t.id) || [];
    const { data: recentGamesData } = await supabaseAdmin
      .from('team_recent_stats')
      .select('team_id, game_date')
      .in('team_id', teamIds)
      .gte('game_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('game_date', { ascending: false });

    const gamesCounts = recentGamesData?.reduce((acc, game) => {
      acc[game.team_id] = (acc[game.team_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const teamsWithStats = data?.map(team => ({
      id: team.id,
      name: team.team_name,
      abbreviation: team.team_abbreviation,
      city: team.city,
      sport: team.sport_key,
      logo_url: team.logo_url,
      recent_games_count: gamesCounts[team.id] || 0,
      last_game_date: recentGamesData?.find(g => g.team_id === team.id)?.game_date || null
    })) || [];

    res.json({
      teams: teamsWithStats,
      total: teamsWithStats.length
    });

  } catch (error) {
    console.error('Team search error:', error);
    res.status(500).json({ 
      error: 'Failed to search teams',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get detailed team trends data with recent games
router.get('/:teamId/trends', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { limit = 10 } = req.query;

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Get team basic info
    const { data: teamData, error: teamError } = await supabaseAdmin
      .from('team_trends_data')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (teamError) throw teamError;

    // Get recent games data
    const { data: recentGames, error: gamesError } = await supabaseAdmin
      .from('team_recent_stats')
      .select(`
        *,
        opponent_team:teams!team_recent_stats_opponent_team_id_fkey(
          team_name,
          team_abbreviation
        )
      `)
      .eq('team_id', teamId)
      .order('game_date', { ascending: false })
      .limit(Number(limit));

    if (gamesError) throw gamesError;

    // Get sportsbook lines from sports_events for this team
    const { data: sportsbookData, error: sportsbookError } = await supabaseAdmin
      .from('sports_events')
      .select('metadata, event_date, home_team, away_team')
      .or(`home_team.ilike.%${teamData.team_name}%,away_team.ilike.%${teamData.team_name}%`)
      .not('metadata', 'is', null)
      .order('event_date', { ascending: false })
      .limit(5);

    if (sportsbookError) {
      console.warn('Sportsbook data error:', sportsbookError);
    }

    // Extract betting lines from metadata (FanDuel focus)
    const bettingLines = sportsbookData?.map(event => {
      const metadata = event.metadata;
      const fanduelData = metadata?.full_data?.bookmakers?.find((book: any) => book.key === 'fanduel');
      
      if (!fanduelData) return null;

      const spreads = fanduelData.markets?.find((market: any) => market.key === 'spreads');
      const totals = fanduelData.markets?.find((market: any) => market.key === 'totals');
      const h2h = fanduelData.markets?.find((market: any) => market.key === 'h2h');

      return {
        event_date: event.event_date,
        home_team: event.home_team,
        away_team: event.away_team,
        spread_line: spreads?.outcomes?.find((o: any) => 
          o.name.toLowerCase().includes(teamData.team_name.toLowerCase())
        )?.point || null,
        total_line: totals?.outcomes?.find((o: any) => o.name === 'Over')?.point || null,
        moneyline: h2h?.outcomes?.find((o: any) => 
          o.name.toLowerCase().includes(teamData.team_name.toLowerCase())
        )?.price || null,
        last_update: fanduelData.last_update
      };
    }).filter(Boolean) || [];

    res.json({
      team: {
        id: teamData.team_id,
        name: teamData.team_name,
        abbreviation: teamData.team_abbreviation,
        city: teamData.city,
        sport: teamData.sport_key,
        games_played: teamData.games_played,
        wins: teamData.wins,
        losses: teamData.losses,
        win_percentage: parseFloat(teamData.win_percentage || '0'),
        avg_points_for: parseFloat(teamData.avg_points_for || '0'),
        avg_points_against: parseFloat(teamData.avg_points_against || '0'),
        avg_margin: parseFloat(teamData.avg_margin || '0'),
        ats_wins: teamData.ats_wins,
        ats_losses: teamData.ats_losses,
        ats_percentage: teamData.ats_percentage,
        over_results: teamData.over_results,
        under_results: teamData.under_results,
        trend_indicator: teamData.trend_indicator
      },
      recent_games: recentGames?.map(game => ({
        id: game.id,
        game_date: game.game_date,
        opponent_team: game.opponent_team?.team_name || game.opponent_team,
        opponent_abbreviation: game.opponent_team?.team_abbreviation,
        is_home: game.is_home,
        team_score: game.team_score,
        opponent_score: game.opponent_score,
        game_result: game.game_result,
        margin: game.margin,
        spread_line: game.spread_line,
        spread_result: game.spread_result,
        total_line: game.total_line,
        total_result: game.total_result
      })) || [],
      betting_lines: bettingLines,
      stats_summary: {
        total_games: recentGames?.length || 0,
        wins: recentGames?.filter(g => g.game_result === 'W').length || 0,
        losses: recentGames?.filter(g => g.game_result === 'L').length || 0,
        avg_score: recentGames?.length ? 
          (recentGames.reduce((sum, g) => sum + g.team_score, 0) / recentGames.length).toFixed(1) : '0.0',
        avg_margin: recentGames?.length ? 
          (recentGames.reduce((sum, g) => sum + g.margin, 0) / recentGames.length).toFixed(1) : '0.0'
      }
    });

  } catch (error) {
    console.error('Team trends error:', error);
    res.status(500).json({ 
      error: 'Failed to get team trends',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

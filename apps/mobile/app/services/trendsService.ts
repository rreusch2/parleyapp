import { supabase } from './api/supabaseClient';

export interface TrendData {
  id: string;
  player: {
    id: string;
    name: string;
    team: string;
    sport: string;
    position?: string;
    headshot_url?: string;
  };
  market_type: string;
  market_display_name: string;
  confidence_score: number;
  hit_rate: number;
  current_streak: number;
  streak_type: 'over' | 'under';
  sample_size: number;
  avg_value: number;
  median_value: number;
  last_10_games: GameStat[];
  ai_reasoning?: string;
  key_factors: string[];
  sportsbook_odds: SportsbookOdds[];
  next_game: {
    opponent: string;
    game_time: string;
    is_home: boolean;
  };
  line_movement: {
    opening_line: number;
    current_line: number;
    movement_direction: 'up' | 'down' | 'stable';
    movement_percentage: number;
  };
}

export interface GameStat {
  game_date: string;
  opponent: string;
  value: number;
  line_value?: number;
  result: 'over' | 'under' | 'push';
  is_home: boolean;
}

export interface SportsbookOdds {
  bookmaker: string;
  logo_url?: string;
  over_odds: number;
  under_odds: number;
  line_value: number;
  is_best_over: boolean;
  is_best_under: boolean;
}

export interface TrendsFilter {
  sport?: string;
  confidence_min?: number;
  hit_rate_min?: number;
  sort_by?: 'confidence' | 'hit_rate' | 'value' | 'streak' | 'recent';
  limit?: number;
  min_sample_size?: number;
  games_window?: number;
}

export interface AIInsight {
  id: string;
  type: 'value' | 'weather' | 'injury' | 'trend' | 'contrarian';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  affected_players?: string[];
  created_at: string;
}

class TrendsService {
  private readonly backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';

  private toNumber(val: any, fallback = 0): number {
    const n = typeof val === 'number' ? val : Number(val);
    return Number.isFinite(n) ? n : fallback;
  }

  private toArray<T>(val: any, fallback: T[] = []): T[] {
    return Array.isArray(val) ? val : fallback;
  }

  /**
   * Fetch enhanced trends with AI analysis and sportsbook odds
   */
  async getEnhancedTrends(filters: TrendsFilter = {}): Promise<TrendData[]> {
    try {
      const trends = await this.getTrendsFromPropsAndStats(filters);
      return this.applyFiltersAndSorting(trends, filters);

    } catch (error) {
      console.error('Error in getEnhancedTrends:', error);
      return [];
    }
  }

  /**
   * Get AI insights for today's trends
   */
  async getAIInsights(): Promise<AIInsight[]> {
    try {
      const { data: insights, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('is_global', true)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching AI insights:', error);
        return [];
      }

      return insights?.map(insight => ({
        id: insight.id,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        impact: insight.impact,
        affected_players: insight.data?.affected_players || [],
        created_at: insight.created_at
      })) || [];

    } catch (error) {
      console.error('Error in getAIInsights:', error);
      return [];
    }
  }

  /**
   * Get detailed player trend analysis
   */
  async getPlayerTrendAnalysis(playerId: string, propType?: string): Promise<any> {
    try {
      // Get player's game stats
      const { data: gameStats, error: statsError } = await supabase
        .from('player_game_stats')
        .select(`
          *,
          sports_events (
            event_date,
            home_team_id,
            away_team_id,
            teams_home:teams!sports_events_home_team_id_fkey (
              name,
              abbreviation
            ),
            teams_away:teams!sports_events_away_team_id_fkey (
              name,
              abbreviation
            )
          )
        `)
        .eq('player_id', playerId)
        .order('game_date', { ascending: false })
        .limit(30);

      // Get trend patterns
      const { data: patterns, error: patternsError } = await supabase
        .from('player_trend_patterns')
        .select(`
          *,
          player_prop_types (
            prop_name,
            category
          )
        `)
        .eq('player_id', playerId)
        .eq('is_active', true);

      // Get current lines/odds
      const { data: currentLines, error: linesError } = await supabase
        .from('current_odds_comparison')
        .select(`
          *,
          bookmakers (
            name,
            logo_url
          )
        `)
        .eq('player_id', playerId);

      return {
        gameStats: gameStats || [],
        patterns: patterns || [],
        currentLines: currentLines || []
      };

    } catch (error) {
      console.error('Error in getPlayerTrendAnalysis:', error);
      return {
        gameStats: [],
        patterns: [],
        currentLines: []
      };
    }
  }

  /**
   * Search for players with trend data
   */
  async searchPlayersWithTrends(query: string, sport?: string): Promise<any[]> {
    try {
      let supabaseQuery = supabase
        .from('players')
        .select(`
          id,
          name,
          team,
          sport,
          position,
          headshot_url,
          player_trend_patterns!inner (
            id,
            confidence_score,
            hit_rate
          )
        `)
        .ilike('name', `%${query}%`)
        .eq('active', true);

      if (sport && sport !== 'all') {
        supabaseQuery = supabaseQuery.eq('sport', sport);
      }

      const { data: players, error } = await supabaseQuery
        .order('name')
        .limit(20);

      if (error) {
        console.error('Error searching players:', error);
        return [];
      }

      return players || [];

    } catch (error) {
      console.error('Error in searchPlayersWithTrends:', error);
      return [];
    }
  }

  /**
   * Get line movement history for a specific prop
   */
  async getLineMovementHistory(playerId: string, propTypeId: string, days: number = 7): Promise<any[]> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: movements, error } = await supabase
        .from('line_movement_history_2025_01')
        .select(`
          *,
          bookmakers (
            name,
            logo_url
          )
        `)
        .eq('player_id', playerId)
        .eq('prop_type_id', propTypeId)
        .gte('timestamp', startDate)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching line movement:', error);
        return [];
      }

      return movements || [];

    } catch (error) {
      console.error('Error in getLineMovementHistory:', error);
      return [];
    }
  }

  /**
   * Transform raw data into enhanced trend format
   */
  private async transformToEnhancedTrends(
    predictions: any[],
    patterns: any[],
    odds: any[]
  ): Promise<TrendData[]> {
    const trends: TrendData[] = [];

    // Process AI predictions
    for (const prediction of predictions) {
      if (!prediction.players) continue;

      // Find matching trend pattern (by player; prop_type mapping may differ by schema)
      const matchingPattern = patterns.find(p => p.player_id === prediction.player_id);

      // Find matching odds
      const playerOdds = odds.filter(o => o.player_id === prediction.player_id);
      
      const confidenceScore = this.toNumber(prediction.confidence, 0);
      const predVal = this.toNumber(prediction.prediction_value, null as any);
      const lineVal = this.toNumber(prediction.line_value, null as any);

      const trend: TrendData = {
        id: prediction.id,
        player: {
          id: prediction.players.id,
          name: prediction.players.name,
          team: prediction.players.team,
          sport: prediction.players.sport,
          position: prediction.players.position,
          headshot_url: prediction.players.headshot_url
        },
        market_type: prediction.prop_market_type || 'unknown',
        market_display_name: this.formatMarketName(prediction.prop_market_type, prediction.line_value),
        confidence_score: confidenceScore,
        hit_rate: this.toNumber(matchingPattern?.hit_rate, 0),
        current_streak: this.toNumber(matchingPattern?.current_streak, 0),
        streak_type: predVal != null && lineVal != null && predVal > lineVal ? 'over' : 'under',
        sample_size: this.toNumber(matchingPattern?.sample_size, 0),
        avg_value: this.toNumber(matchingPattern?.avg_value ?? predVal, 0),
        median_value: this.toNumber(matchingPattern?.median_value ?? predVal, 0),
        last_10_games: this.toArray(matchingPattern?.last_10_games).map((g: any) => ({
          game_date: g?.game_date ?? '',
          opponent: g?.opponent ?? '',
          value: this.toNumber(g?.value, 0),
          line_value: g?.line_value != null ? this.toNumber(g?.line_value, 0) : undefined,
          result: (g?.result === 'over' || g?.result === 'under' || g?.result === 'push') ? g.result : 'push',
          is_home: Boolean(g?.is_home),
        })),
        ai_reasoning: prediction.reasoning,
        key_factors: prediction.key_factors || [],
        sportsbook_odds: this.formatSportsbookOdds(playerOdds),
        next_game: {
          opponent: 'TBD',
          game_time: 'TBD',
          is_home: true
        },
        line_movement: {
          opening_line: this.toNumber(prediction.line_value, 0),
          current_line: this.toNumber(prediction.line_value, 0),
          movement_direction: 'stable',
          movement_percentage: 0
        }
      };

      trends.push(trend);
    }

    return trends;
  }

  /**
   * Apply filters and sorting to trends
   */
  private applyFiltersAndSorting(trends: TrendData[], filters: TrendsFilter): TrendData[] {
    let filteredTrends = [...trends];

    // Filter by sport
    if (filters.sport && filters.sport !== 'all') {
      filteredTrends = filteredTrends.filter(t => t.player.sport === filters.sport);
    }

    // Filter by hit rate (fall back to confidence_min passed by UI as "minimum")
    const minHit = filters.hit_rate_min ?? filters.confidence_min;
    if (minHit) {
      filteredTrends = filteredTrends.filter(t => t.hit_rate >= (minHit as number));
    }

    // Sort
    switch (filters.sort_by) {
      case 'confidence':
        filteredTrends.sort((a, b) => b.confidence_score - a.confidence_score);
        break;
      case 'hit_rate':
        filteredTrends.sort((a, b) => b.hit_rate - a.hit_rate);
        break;
      case 'streak':
        filteredTrends.sort((a, b) => b.current_streak - a.current_streak);
        break;
      case 'value':
        // Sort by expected value if available
        filteredTrends.sort((a, b) => b.confidence_score - a.confidence_score);
        break;
      default:
        filteredTrends.sort((a, b) => b.confidence_score - a.confidence_score);
    }

    return filteredTrends;
  }

  /**
   * Build trends from latest player props (player_props_v2) and recent player stats
   */
  private async getTrendsFromPropsAndStats(filters: TrendsFilter): Promise<TrendData[]> {
    // 1) Get latest props with embedded player
    let query = supabase
      .from('player_props_v2')
      .select(`
        id, event_id, player_id, sport, stat_type, main_line, best_over_odds, best_under_odds, last_updated, local_game_date
      `)
      .order('last_updated', { ascending: false })
      .limit((filters.limit || 20) * 8);

    if (filters.sport && filters.sport !== 'all') {
      query = query.eq('sport', filters.sport);
    }

    const { data: propsRows, error } = await query;
    if (error) {
      console.error('Error fetching props rows:', error);
      return [];
    }

    // Deduplicate to most recent per (player_id, stat_type) and only keep supported stat types
    const seen = new Set<string>();
    const latestByPair: any[] = [];
    for (const r of propsRows || []) {
      const key = `${r.player_id}::${r.stat_type}`;
      if (seen.has(key)) continue;
      if (this.isUnsupportedStatType(r.stat_type)) continue;
      const supported = this.resolveStatAccessor(r.stat_type, r.sport);
      if (!supported) continue;
      seen.add(key);
      latestByPair.push(r);
      if (latestByPair.length >= (filters.limit || 20)) break;
    }

    // 2) Fetch player records in batch
    const playerIds = Array.from(new Set(latestByPair.map(r => r.player_id).filter(Boolean)));
    const playersMap = new Map<string, any>();
    if (playerIds.length > 0) {
      const { data: players, error: playersErr } = await supabase
        .from('players')
        .select('id, name, team, sport, position, headshot_url')
        .in('id', playerIds);
      if (playersErr) {
        console.error('Error fetching players:', playersErr);
      } else {
        for (const p of players || []) playersMap.set(p.id, p);
      }
    }

    // 3) Fetch last N game stats per player
    const gamesWindow = filters.games_window && filters.games_window > 0 ? filters.games_window : 10;
    const statsByPlayer = new Map<string, any[]>();
    if (playerIds.length > 0) {
      const { data: pstats, error: pstatsErr } = await supabase
        .from('player_game_stats')
        .select('player_id, stats, created_at')
        .in('player_id', playerIds)
        .order('created_at', { ascending: false })
        .limit(playerIds.length * gamesWindow);

      if (pstatsErr) {
        console.error('Error fetching player stats:', pstatsErr);
      } else {
        for (const row of pstats || []) {
          const arr = statsByPlayer.get(row.player_id) || [];
          if (arr.length < gamesWindow) {
            arr.push(row);
            statsByPlayer.set(row.player_id, arr);
          }
        }
      }
    }

    // 4) Compute trends only where we have stats values
    const trends: TrendData[] = [];
    for (const r of latestByPair) {
      const player = playersMap.get(r.player_id);
      if (!player) continue;
      const accessor = this.resolveStatAccessor(r.stat_type, r.sport);
      const line = this.toNumber(r.main_line, NaN);
      if (!accessor || !Number.isFinite(line)) continue;

      const playerStats = statsByPlayer.get(r.player_id) || [];
      const values: number[] = [];
      const lastGames: GameStat[] = [];
      for (const row of playerStats) {
        const s = row?.stats || {};
        // Only include games on/before the prop's local_game_date when available
        const gameDateStr = (s?.game_date || '').toString().slice(0,10);
        const cutoffDateStr = (r?.local_game_date || '').toString().slice(0,10);
        if (cutoffDateStr && gameDateStr && gameDateStr > cutoffDateStr) continue;
        let v: number | null = null;
        if (accessor.mode === 'direct') {
          for (const k of accessor.keys) {
            const num = this.toNumber(s?.[k], NaN);
            if (Number.isFinite(num)) { v = num; break; }
          }
        } else if (accessor.mode === 'sum') {
          let sum = 0; let foundAny = false;
          for (const k of accessor.keys) {
            const num = this.toNumber(s?.[k], NaN);
            if (Number.isFinite(num)) { sum += num; foundAny = true; }
          }
          if (foundAny) v = sum;
        }
        if (v == null) continue;
        values.push(v);
        lastGames.push({
          game_date: s?.game_date ?? row?.created_at ?? '',
          opponent: s?.opponent_team ?? '',
          value: v,
          line_value: line,
          result: v > line ? 'over' : v < line ? 'under' : 'push',
          is_home: Boolean(s?.is_home),
        });
        if (values.length >= gamesWindow) break;
      }

      const minSample = filters.min_sample_size && filters.min_sample_size > 0 ? filters.min_sample_size : 5;
      if (values.length < minSample) continue;

      const hits = values.filter(v => v > line).length;
      const pushes = values.filter(v => v === line).length;
      const total = values.length;
      const hitRate = Math.round((hits / total) * 100);
      const avg = values.reduce((a, b) => a + b, 0) / total;
      const sorted = [...values].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];

      const sportsbook_odds: SportsbookOdds[] = [{
        bookmaker: 'Consensus',
        logo_url: undefined,
        over_odds: this.toNumber(r.best_over_odds, 0),
        under_odds: this.toNumber(r.best_under_odds, 0),
        line_value: line,
        is_best_over: true,
        is_best_under: true,
      }];

      const trend: TrendData = {
        id: r.id,
        player: {
          id: player.id,
          name: player.name,
          team: player.team,
          sport: player.sport,
          position: player.position,
          headshot_url: player.headshot_url,
        },
        market_type: r.stat_type,
        market_display_name: this.formatMarketName(r.stat_type, line),
        confidence_score: hitRate,
        hit_rate: hitRate,
        current_streak: this.computeStreak(lastGames),
        streak_type: hits >= (total - hits - pushes) ? 'over' : 'under',
        sample_size: total,
        avg_value: avg,
        median_value: median,
        last_10_games: lastGames,
        ai_reasoning: undefined,
        key_factors: [],
        sportsbook_odds,
        next_game: {
          opponent: 'TBD',
          game_time: 'TBD',
          is_home: true,
        },
        line_movement: {
          opening_line: line,
          current_line: line,
          movement_direction: 'stable',
          movement_percentage: 0,
        },
      };

      trends.push(trend);
    }

    return trends;
  }

  private resolveStatAccessor(statType: string, sport?: string): { mode: 'direct' | 'sum', keys: string[] } | null {
    if (!statType) return null;
    const lowerSport = (sport || '').toUpperCase();

    // Base candidates (strip prefix)
    const base = statType.startsWith('player_') ? statType.replace(/^player_/, '') : statType;

    // MLB mappings
    if (lowerSport === 'MLB' || lowerSport === 'BASEBALL_MLB') {
      if (base === 'hits') return { mode: 'direct', keys: ['hits'] };
      if (base === 'home_runs') return { mode: 'direct', keys: ['home_runs'] };
      if (base === 'rbi' || base === 'runs_batted_in') return { mode: 'direct', keys: ['rbi'] };
      if (base === 'runs') return { mode: 'direct', keys: ['runs'] };
      if (base === 'total_bases') return { mode: 'direct', keys: ['total_bases'] };
      if (base === 'strikeouts_pitched') return { mode: 'direct', keys: ['strikeouts'] };
    }

    // NBA mappings
    if (lowerSport === 'NBA' || lowerSport === 'WNBA') {
      if (base === 'points') return { mode: 'direct', keys: ['points'] };
      if (base === 'assists') return { mode: 'direct', keys: ['assists'] };
      if (base === 'rebounds') return { mode: 'direct', keys: ['rebounds'] };
      if (base === 'three_pointers_made' || base === 'threes_made') return { mode: 'direct', keys: ['three_pointers_made'] };
      if (base === 'blocks') return { mode: 'direct', keys: ['blocks'] };
      if (base === 'steals') return { mode: 'direct', keys: ['steals'] };
    }

    // NFL mappings
    if (lowerSport === 'NFL' || lowerSport === 'COLLEGE FOOTBALL' || lowerSport === 'CFB') {
      if (base === 'receiving_yards') return { mode: 'direct', keys: ['receiving_yards'] };
      if (base === 'receptions') return { mode: 'direct', keys: ['receptions'] };
      if (base === 'rushing_yards') return { mode: 'direct', keys: ['rushing_yards'] };
      if (base === 'passing_yards') return { mode: 'direct', keys: ['passing_yards'] };
      if (base === 'passing_touchdowns') return { mode: 'direct', keys: ['passing_touchdowns'] };
    }

    // NHL mappings
    if (lowerSport === 'NHL') {
      if (base === 'shots_on_goal' || base === 'shots') return { mode: 'direct', keys: ['shots'] };
      if (base === 'goals') return { mode: 'direct', keys: ['goals'] };
      if (base === 'assists') return { mode: 'direct', keys: ['assists'] };
      if (base === 'points') return { mode: 'sum', keys: ['goals', 'assists'] };
    }

    // Fallback: try direct match and stripped base
    const candidates = Array.from(new Set([statType, base]));
    return { mode: 'direct', keys: candidates };
  }

  private isUnsupportedStatType(statType: string | undefined | null): boolean {
    if (!statType) return true;
    const s = String(statType).toLowerCase();
    const blocked = [
      'goal_scorer_anytime',
      'goal_scorer_first',
      'goal_scorer_last',
      'player_goal_scorer_anytime',
      'player_goal_scorer_first',
      'player_goal_scorer_last'
    ];
    return blocked.some(b => s.includes(b));
  }

  private computeStreak(games: GameStat[]): number {
    let streak = 0;
    for (const g of games) {
      if (g.result === 'over') streak += 1; else break;
    }
    return streak;
  }

  /**
   * Format market name for display
   */
  private formatMarketName(marketType: string, lineValue?: number): string {
    if (!marketType) return 'Unknown Market';
    
    const formatted = marketType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    if (lineValue) {
      return `${formatted} Over ${lineValue}`;
    }
    
    return formatted;
  }

  /**
   * Format sportsbook odds for display
   */
  private formatSportsbookOdds(odds: any[]): SportsbookOdds[] {
    if (!odds || odds.length === 0) return [];

    return odds.map(odd => ({
      bookmaker: odd.bookmakers?.name || 'Unknown',
      logo_url: odd.bookmakers?.logo_url,
      over_odds: odd.best_over_odds || -110,
      under_odds: odd.best_under_odds || -110,
      line_value: odd.consensus_line || 0,
      is_best_over: odd.best_over_odds === Math.max(...odds.map(o => o.best_over_odds || -200)),
      is_best_under: odd.best_under_odds === Math.max(...odds.map(o => o.best_under_odds || -200))
    }));
  }
}

export const trendsService = new TrendsService();

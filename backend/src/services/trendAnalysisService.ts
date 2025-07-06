import { supabase } from './supabase/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('trendAnalysisService');

interface TrendData {
  id: string;
  type: 'player_prop' | 'team_prop';
  player_id?: string;
  player_name?: string;
  team?: string;
  prop_type: string;
  current_streak: number;
  streak_type: 'over' | 'under' | 'hit' | 'cover';
  last_line?: number;
  avg_line?: number;
  streak_start_date: string;
  games_in_streak: number;
  confidence_score: number;
  recent_games: RecentGame[];
  trend_strength: 'strong' | 'moderate' | 'weak';
  next_game?: NextGame;
}

interface RecentGame {
  date: string;
  opponent: string;
  line: number;
  actual_value: number;
  result: 'over' | 'under' | 'hit' | 'cover';
  margin: number;
}

interface NextGame {
  date: string;
  opponent: string;
  current_line?: number;
  recommended_bet?: string;
}

interface TeamTrend {
  team: string;
  trend_type: 'spread_cover' | 'total_over' | 'total_under' | 'moneyline';
  current_streak: number;
  games_in_streak: number;
  trend_strength: 'strong' | 'moderate' | 'weak';
  recent_games: TeamGame[];
}

interface TeamGame {
  date: string;
  opponent: string;
  home_away: 'home' | 'away';
  line?: number;
  actual_result: number;
  result: 'cover' | 'over' | 'under' | 'win' | 'loss';
}

interface TrendResult {
  playerId: string;
  playerName: string;
  team: string;
  propType: string;
  streakType: 'over' | 'under';
  streakLength: number;
  confidence: number;
  lastLine: number;
  sportsbook: string;
  lastGameDate: string;
}

export class TrendAnalysisService {
  
  /**
   * Get recurring trends for MLB players based on actual betting results
   */
  async getMLBRecurringTrends(limit: number = 15): Promise<TrendResult[]> {
    try {
      // First check if we have any betting results data
      const { data: sampleData, error: sampleError } = await supabase
        .from('player_game_stats')
        .select('betting_results, players(name, team)')
        .not('betting_results', 'eq', '{}')
        .limit(1);

      if (sampleError) {
        console.error('Error checking betting results:', sampleError);
        return this.getFallbackTrends();
      }

      if (!sampleData || sampleData.length === 0) {
        console.log('No betting results data available, using fallback trends');
        return this.getFallbackTrends();
      }

      // Get players with betting results data
      const { data: playersWithBettingData, error: playersError } = await supabase
        .from('player_game_stats')
        .select(`
          player_id,
          betting_results,
          created_at,
          players!inner(name, team, sport)
        `)
        .eq('players.sport', 'MLB')
        .not('betting_results', 'eq', '{}')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (playersError) {
        console.error('Error fetching betting data:', playersError);
        return this.getFallbackTrends();
      }

      if (!playersWithBettingData || playersWithBettingData.length === 0) {
        return this.getFallbackTrends();
      }

      // Analyze trends for each player/prop combination
      const trends = this.analyzeBettingTrends(playersWithBettingData);
      
      // Sort by streak length and confidence
      return trends
        .sort((a, b) => {
          if (a.streakLength !== b.streakLength) {
            return b.streakLength - a.streakLength;
          }
          return b.confidence - a.confidence;
        })
        .slice(0, limit);

    } catch (error: any) {
      console.error('Error in getMLBRecurringTrends:', error);
      return this.getFallbackTrends();
    }
  }

  private analyzeBettingTrends(data: any[]): TrendResult[] {
    const playerPropMap = new Map<string, any[]>();

    // Group data by player and prop type
    data.forEach(record => {
      const bettingResults = record.betting_results || {};
      const playerName = record.players?.name;
      const team = record.players?.team;
      
      if (!playerName || !team) return;

      Object.keys(bettingResults).forEach(propType => {
        const key = `${record.player_id}-${propType}`;
        if (!playerPropMap.has(key)) {
          playerPropMap.set(key, []);
        }
        
        playerPropMap.get(key)!.push({
          ...record,
          propType,
          result: bettingResults[propType]
        });
      });
    });

    const trends: TrendResult[] = [];

    // Analyze each player-prop combination for streaks
    playerPropMap.forEach((records, key) => {
      const [playerId, propType] = key.split('-');
      
      // Sort by date (most recent first)
      records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      if (records.length < 3) return; // Need at least 3 games for a meaningful trend

      const firstRecord = records[0];
      const playerName = firstRecord.players?.name;
      const team = firstRecord.players?.team;
      const result = firstRecord.result;

      if (!result || !result.result || !result.line) return;

      // Find current streak
      let streakLength = 0;
      let streakType = result.result as 'over' | 'under';

      for (const record of records) {
        if (record.result && record.result.result === streakType) {
          streakLength++;
        } else {
          break;
        }
      }

      // Only include significant streaks (3+ games)
      if (streakLength >= 3) {
        const confidence = Math.min(50 + (streakLength * 5) + Math.random() * 20, 95);
        
        trends.push({
          playerId,
          playerName,
          team,
          propType: propType.toUpperCase(),
          streakType,
          streakLength,
          confidence: Math.round(confidence),
          lastLine: result.line,
          sportsbook: result.sportsbook || 'DraftKings',
          lastGameDate: firstRecord.created_at
        });
      }
    });

    return trends;
  }

  /**
   * Fallback trends when we don't have real betting data
   * Shows honest message about data availability
   */
  private getFallbackTrends(): TrendResult[] {
    return [
      {
        playerId: 'fallback-1',
        playerName: 'Data Collection In Progress',
        team: 'MLB',
        propType: 'BETTING TRENDS',
        streakType: 'under',
        streakLength: 0,
        confidence: 0,
        lastLine: 0,
        sportsbook: 'Multiple',
        lastGameDate: new Date().toISOString()
      }
    ];
  }

  /**
   * Update betting results for a player's game
   */
  async updateBettingResults(
    playerGameStatsId: string, 
    propType: string, 
    line: number, 
    actualValue: number, 
    sportsbook: string = 'DraftKings'
  ): Promise<void> {
    try {
      const result = actualValue >= line ? 'over' : 'under';
      
      // Get current betting results
      const { data: currentData, error: fetchError } = await supabase
        .from('player_game_stats')
        .select('betting_results')
        .eq('id', playerGameStatsId)
        .single();

      if (fetchError) {
        console.error('Error fetching current betting results:', fetchError);
        return;
      }

      const currentResults = currentData?.betting_results || {};
      
      // Update with new result
      const updatedResults = {
        ...currentResults,
        [propType]: {
          line,
          result,
          sportsbook,
          actual_value: actualValue
        }
      };

      // Save back to database
      const { error: updateError } = await supabase
        .from('player_game_stats')
        .update({ betting_results: updatedResults })
        .eq('id', playerGameStatsId);

      if (updateError) {
        console.error('Error updating betting results:', updateError);
      }
    } catch (error: any) {
      console.error('Error in updateBettingResults:', error);
    }
  }

  /**
   * Bulk process betting results from game stats
   */
  async processBettingResultsFromStats(
    playerGameStatsId: string,
    gameStats: any,
    bettingLines: { [propType: string]: number },
    sportsbook: string = 'DraftKings'
  ): Promise<void> {
    try {
      const bettingResults: any = {};
      
      // Map common prop types to game stats
      const propMapping = {
        'hits': gameStats.hits,
        'home_runs': gameStats.home_runs,
        'walks': gameStats.walks,
        'strikeouts': gameStats.strikeouts,
        'at_bats': gameStats.at_bats
      };

      // Process each prop type
      Object.keys(bettingLines).forEach(propType => {
        const line = bettingLines[propType];
        const actualValue = propMapping[propType];
        
        if (actualValue !== undefined && line !== undefined) {
          bettingResults[propType] = {
            line,
            result: actualValue >= line ? 'over' : 'under',
            sportsbook,
            actual_value: actualValue
          };
        }
      });

      // Update the record
      const { error } = await supabase
        .from('player_game_stats')
        .update({ betting_results: bettingResults })
        .eq('id', playerGameStatsId);

      if (error) {
        console.error('Error processing betting results:', error);
      }
    } catch (error: any) {
      console.error('Error in processBettingResultsFromStats:', error);
    }
  }

  /**
   * Get recurring player prop trends (3+ consecutive hits)
   */
  async getPlayerPropTrends(sport: string = 'NBA', minStreak: number = 3): Promise<TrendData[]> {
    try {
      logger.info(`🔍 Analyzing ${sport} player prop trends with min streak: ${minStreak}`);

      // Get players with both stats and betting results data
      const { data: playerStats, error } = await supabase
        .rpc('get_player_prop_streaks', {
          sport_param: sport,
          min_streak_param: minStreak
        });

      if (error) {
        logger.error('Error getting prop streaks:', error);
        // Fall back to manual analysis
        return this.getManualPropStreaks(sport, minStreak);
      }

      logger.info(`✅ Found ${playerStats?.length || 0} prop streaks`);
      return playerStats || [];

    } catch (error: any) {
      logger.error('Error in getPlayerPropTrends:', error);
      return this.getManualPropStreaks(sport, minStreak);
    }
  }

  /**
   * Manual prop streak analysis as fallback
   */
  private async getManualPropStreaks(sport: string, minStreak: number): Promise<TrendData[]> {
    const trends: TrendData[] = [];
    
    logger.info(`🔧 Running manual prop streak analysis for ${sport}`);

    // Get players with both stats and betting data
    const { data: players, error } = await supabase
      .from('player_game_stats')
      .select(`
        player_id,
        stats,
        betting_results,
        players!inner(
          name,
          team,
          sport
        )
      `)
      .eq('players.sport', sport === 'NBA' ? 'NBA' : 'MLB')
      .not('stats', 'is', null)
      .not('betting_results', 'is', null)
      .neq('betting_results', '{}')
      .order('stats->game_date', { ascending: true });

    if (error || !players) {
      logger.error('Error fetching player data:', error);
      return this.getFallbackTrendsData();
    }

    logger.info(`📊 Found ${players.length} records to analyze`);

    // Group by player
    const playerMap = new Map<string, any[]>();
    players.forEach(p => {
      const key = p.player_id;
      if (!playerMap.has(key)) {
        playerMap.set(key, []);
      }
      playerMap.get(key)!.push(p);
    });

    logger.info(`👥 Analyzing ${playerMap.size} players`);

    // Analyze each player for streaks
    playerMap.forEach((games, playerId) => {
      const playerName = games[0].players.name;
      const team = games[0].players.team;
      
      if (games.length < minStreak) return;

      logger.info(`🎲 Analyzing ${playerName}: ${games.length} games`);

      // Sort by game date
      games.sort((a, b) => new Date(a.stats.game_date).getTime() - new Date(b.stats.game_date).getTime());

      // Check hits streaks
      const hitsStreak = this.findSimpleStreak(games, 'hits', 1.5, minStreak);
      if (hitsStreak) {
        logger.info(`🔥 Found ${hitsStreak.length}-game ${hitsStreak.type} streak for ${playerName} hits`);
        trends.push({
          id: `${playerId}-hits-${hitsStreak.type}`,
          type: 'player_prop',
          player_name: playerName,
          team: team,
          prop_type: 'Hits',
          current_streak: hitsStreak.length,
          streak_type: hitsStreak.type,
          last_line: 1.5,
          avg_line: 1.5,
          streak_start_date: hitsStreak.startDate,
          games_in_streak: hitsStreak.length,
          confidence_score: Math.min(95, 50 + hitsStreak.length * 8),
          recent_games: hitsStreak.games.slice(-5).map(g => ({
            date: g.stats.game_date,
            opponent: 'vs OPP',
            line: 1.5,
            actual_value: parseInt(g.stats.hits),
            result: hitsStreak.type,
            margin: hitsStreak.type === 'over' ? parseInt(g.stats.hits) - 1.5 : 1.5 - parseInt(g.stats.hits)
          })),
          trend_strength: hitsStreak.length >= 7 ? 'strong' : hitsStreak.length >= 5 ? 'moderate' : 'weak',
          next_game: undefined
        });
      }

      // Check home runs streaks  
      const hrStreak = this.findSimpleStreak(games, 'home_runs', 0.5, minStreak);
      if (hrStreak) {
        logger.info(`🔥 Found ${hrStreak.length}-game ${hrStreak.type} streak for ${playerName} home runs`);
        trends.push({
          id: `${playerId}-home_runs-${hrStreak.type}`,
          type: 'player_prop',
          player_name: playerName,
          team: team,
          prop_type: 'Home Runs',
          current_streak: hrStreak.length,
          streak_type: hrStreak.type,
          last_line: 0.5,
          avg_line: 0.5,
          streak_start_date: hrStreak.startDate,
          games_in_streak: hrStreak.length,
          confidence_score: Math.min(95, 50 + hrStreak.length * 8),
          recent_games: hrStreak.games.slice(-5).map(g => ({
            date: g.stats.game_date,
            opponent: 'vs OPP',
            line: 0.5,
            actual_value: parseInt(g.stats.home_runs),
            result: hrStreak.type,
            margin: hrStreak.type === 'over' ? parseInt(g.stats.home_runs) - 0.5 : 0.5 - parseInt(g.stats.home_runs)
          })),
          trend_strength: hrStreak.length >= 7 ? 'strong' : hrStreak.length >= 5 ? 'moderate' : 'weak',
          next_game: undefined
        });
      }
    });

    logger.info(`✅ Manual analysis complete: ${trends.length} trends found`);
    return trends;
  }

  /**
   * Find simple streak for a prop (over/under a line)
   */
  private findSimpleStreak(games: any[], propType: string, line: number, minStreak: number): any | null {
    if (games.length < minStreak) return null;

    let currentOverStreak: any[] = [];
    let currentUnderStreak: any[] = [];
    let bestOverStreak: any[] = [];
    let bestUnderStreak: any[] = [];

    // Work through games chronologically
    for (const game of games) {
      const actual = parseInt(game.stats[propType] || '0');
      
      if (actual > line) {
        // Over hit
        currentOverStreak.push(game);
        currentUnderStreak = []; // Reset under streak
        if (currentOverStreak.length > bestOverStreak.length) {
          bestOverStreak = [...currentOverStreak];
        }
      } else if (actual < line) {
        // Under hit
        currentUnderStreak.push(game);
        currentOverStreak = []; // Reset over streak
        if (currentUnderStreak.length > bestUnderStreak.length) {
          bestUnderStreak = [...currentUnderStreak];
        }
      } else {
        // Push - reset both
        currentOverStreak = [];
        currentUnderStreak = [];
      }
    }

    // Return the longest current streak (most recent)
    if (currentOverStreak.length >= minStreak) {
      return {
        type: 'over' as const,
        length: currentOverStreak.length,
        games: currentOverStreak,
        startDate: currentOverStreak[0].stats.game_date
      };
    }
    
    if (currentUnderStreak.length >= minStreak) {
      return {
        type: 'under' as const,
        length: currentUnderStreak.length,
        games: currentUnderStreak,
        startDate: currentUnderStreak[0].stats.game_date
      };
    }

    return null;
  }

  /**
   * Get recurring team trends (spread covers, totals, etc.)
   */
  async getTeamTrends(sport: string = 'NBA', minStreak: number = 3): Promise<TeamTrend[]> {
    try {
      logger.info(`📊 Analyzing team trends for ${sport} (min streak: ${minStreak})`);

      // Get recent historical games
      const { data: games, error } = await supabase
        .from('historical_games')
        .select('*')
        .eq('sport', sport)
        .gte('game_date', this.getDateDaysAgo(45));

      if (error) throw error;

      const teamTrends: TeamTrend[] = [];
      const teamGroups = this.groupByTeam(games || []);

      for (const [team, teamGames] of Object.entries(teamGroups)) {
        const trends = this.analyzeTeamStreaks(teamGames, minStreak);
        
        for (const trend of trends) {
          teamTrends.push({
            team: team,
            trend_type: trend.trend_type,
            current_streak: trend.streak_length,
            games_in_streak: trend.games_in_streak,
            trend_strength: this.classifyTeamTrendStrength(trend),
            recent_games: trend.recent_games
          });
        }
      }

      // Sort by streak length and trend strength
      teamTrends.sort((a, b) => {
        const strengthOrder = { 'strong': 3, 'moderate': 2, 'weak': 1 };
        if (strengthOrder[a.trend_strength] !== strengthOrder[b.trend_strength]) {
          return strengthOrder[b.trend_strength] - strengthOrder[a.trend_strength];
        }
        return b.current_streak - a.current_streak;
      });

      logger.info(`✅ Found ${teamTrends.length} team trends`);
      
      return teamTrends.slice(0, 10); // Return top 10 team trends

    } catch (error: any) {
      logger.error('Error analyzing team trends:', error);
      throw error;
    }
  }

  /**
   * Get live betting opportunities based on trends
   */
  async getLiveTrendOpportunities(sport: string = 'NBA'): Promise<any[]> {
    try {
      // Get today's games
      const { data: todayGames, error } = await supabase
        .from('sports_events')
        .select('*')
        .eq('sport', sport)
        .gte('start_time', new Date().toISOString().split('T')[0])
        .lt('start_time', this.getDateDaysAgo(-1))
        .eq('status', 'scheduled');

      if (error) throw error;

      const opportunities = [];
      
      // Get current trends
      const [playerTrends, teamTrends] = await Promise.all([
        this.getPlayerPropTrends(sport, 3),
        this.getTeamTrends(sport, 3)
      ]);

      // Match trends with today's games
      for (const game of todayGames || []) {
        // Check for player trends in this game
        const relevantPlayerTrends = playerTrends.filter(trend => 
          trend.team === game.home_team || trend.team === game.away_team
        );

        // Check for team trends
        const relevantTeamTrends = teamTrends.filter(trend =>
          trend.team === game.home_team || trend.team === game.away_team
        );

        if (relevantPlayerTrends.length > 0 || relevantTeamTrends.length > 0) {
          opportunities.push({
            game: game,
            player_trends: relevantPlayerTrends,
            team_trends: relevantTeamTrends,
            total_trends: relevantPlayerTrends.length + relevantTeamTrends.length
          });
        }
      }

      return opportunities.sort((a, b) => b.total_trends - a.total_trends);

    } catch (error: any) {
      logger.error('Error getting live trend opportunities:', error);
      throw error;
    }
  }

  // Helper methods
  private groupByPlayer(stats: any[]): Record<string, any[]> {
    return stats.reduce((groups, stat) => {
      const playerId = stat.players.id;
      if (!groups[playerId]) groups[playerId] = [];
      groups[playerId].push(stat);
      return groups;
    }, {});
  }

  private groupByTeam(games: any[]): Record<string, any[]> {
    const teamGroups: Record<string, any[]> = {};
    
    games.forEach(game => {
      // Add to home team group
      if (!teamGroups[game.home_team]) teamGroups[game.home_team] = [];
      teamGroups[game.home_team].push({ ...game, team_perspective: 'home' });
      
      // Add to away team group
      if (!teamGroups[game.away_team]) teamGroups[game.away_team] = [];
      teamGroups[game.away_team].push({ ...game, team_perspective: 'away' });
    });
    
    return teamGroups;
  }

  private analyzePlayerPropStreaks(games: any[], minStreak: number): any[] {
    // MLB prop types - hits, home_runs, walks, strikeouts, at_bats
    const propTypes = ['hits', 'home_runs', 'walks', 'strikeouts', 'at_bats'];
    const trends = [];

    for (const propType of propTypes) {
      const streak = this.findCurrentStreak(games, propType);
      if (streak && streak.length >= minStreak) {
        trends.push({
          prop_type: propType,
          streak_length: streak.length,
          streak_type: streak.type,
          games_in_streak: streak.length,
          streak_start_date: streak.start_date,
          last_line: streak.last_line,
          avg_line: streak.avg_line,
          recent_games: streak.games
        });
      }
    }

    return trends;
  }

  private analyzeTeamStreaks(games: any[], minStreak: number): any[] {
    const trends = [];
    
    // Analyze different betting markets
    const spreadStreak = this.findTeamSpreadStreak(games);
    const totalStreak = this.findTeamTotalStreak(games);
    const mlStreak = this.findTeamMLStreak(games);

    if (spreadStreak && spreadStreak.length >= minStreak) {
      trends.push({
        trend_type: 'spread_cover',
        streak_length: spreadStreak.length,
        games_in_streak: spreadStreak.length,
        recent_games: spreadStreak.games
      });
    }

    if (totalStreak && totalStreak.length >= minStreak) {
      trends.push({
        trend_type: totalStreak.type === 'over' ? 'total_over' : 'total_under',
        streak_length: totalStreak.length,
        games_in_streak: totalStreak.length,
        recent_games: totalStreak.games
      });
    }

    return trends;
  }

  private findCurrentStreak(games: any[], propType: string): any | null {
    // Sort games by date (most recent first) - games are already sorted
    const sortedGames = games.sort((a, b) => 
      new Date(b.stats.game_date).getTime() - new Date(a.stats.game_date).getTime()
    );

    let streak = [];
    let currentStreakType: 'over' | 'under' | null = null;

    for (const game of sortedGames) {
      const stats = game.stats;
      const propValue = stats[propType];
      
      if (propValue !== undefined && propValue !== null) {
        // Use typical MLB betting lines
        const estimatedLine = this.getEstimatedLine(propType, propValue);
        const result = propValue > estimatedLine ? 'over' : 'under';
        
        if (currentStreakType === null) {
          currentStreakType = result;
          streak.push({
            date: stats.game_date,
            opponent: 'Unknown', // We don't have opponent data without sports_events
            line: estimatedLine,
            actual_value: propValue,
            result: result,
            margin: Math.abs(propValue - estimatedLine)
          });
        } else if (result === currentStreakType) {
          streak.push({
            date: stats.game_date,
            opponent: 'Unknown',
            line: estimatedLine,
            actual_value: propValue,
            result: result,
            margin: Math.abs(propValue - estimatedLine)
          });
        } else {
          break; // Streak broken
        }
      }
    }

    if (streak.length >= 3) {
      return {
        type: currentStreakType,
        length: streak.length,
        games: streak,
        start_date: streak[streak.length - 1].date,
        last_line: streak[0].line,
        avg_line: streak.reduce((sum, game) => sum + game.line, 0) / streak.length
      };
    }

    return null;
  }

  private findTeamSpreadStreak(games: any[]): any | null {
    // Implement spread streak analysis
    // This would analyze if team is covering spreads consistently
    return null; // Placeholder
  }

  private findTeamTotalStreak(games: any[]): any | null {
    // Implement total streak analysis
    // This would analyze if team games are going over/under consistently
    return null; // Placeholder
  }

  private findTeamMLStreak(games: any[]): any | null {
    // Implement moneyline streak analysis
    return null; // Placeholder
  }

  private getEstimatedLine(propType: string, actualValue: number): number {
    // MLB prop lines based on typical betting markets
    const mlbLines = {
      'hits': 1.5,
      'home_runs': 0.5,
      'walks': 1.0,
      'strikeouts': 1.5, // For batters
      'at_bats': 4.0
    };
    
    // Use typical line or calculate based on actual value
    return mlbLines[propType as keyof typeof mlbLines] || Math.max(0, actualValue * 0.8);
  }

  private calculateConfidenceScore(trend: any): number {
    let score = 0;
    
    // Base score from streak length
    score += Math.min(trend.streak_length * 15, 60); // Max 60 from streak
    
    // Bonus for consistency (margin of victory)
    const avgMargin = trend.recent_games.reduce((sum, game) => sum + game.margin, 0) / trend.recent_games.length;
    score += Math.min(avgMargin * 5, 25); // Max 25 from margin
    
    // Bonus for recent games
    score += Math.min(trend.games_in_streak * 3, 15); // Max 15 from recency
    
    return Math.min(score, 100);
  }

  private classifyTrendStrength(trend: any): 'strong' | 'moderate' | 'weak' {
    if (trend.streak_length >= 5 && trend.confidence_score >= 80) return 'strong';
    if (trend.streak_length >= 4 && trend.confidence_score >= 65) return 'moderate';
    return 'weak';
  }

  private classifyTeamTrendStrength(trend: any): 'strong' | 'moderate' | 'weak' {
    if (trend.streak_length >= 5) return 'strong';
    if (trend.streak_length >= 4) return 'moderate';
    return 'weak';
  }

  private async getNextGame(playerId: string, sport: string): Promise<NextGame | undefined> {
    try {
      const { data: nextGame, error } = await supabase
        .from('sports_events')
        .select(`
          *,
          players!inner(id, team)
        `)
        .eq('players.id', playerId)
        .eq('sport', sport)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(1)
        .single();

      if (error || !nextGame) return undefined;

      return {
        date: nextGame.start_time,
        opponent: nextGame.players.team === nextGame.home_team ? nextGame.away_team : nextGame.home_team,
        current_line: undefined, // Would fetch from odds API
        recommended_bet: undefined
      };
    } catch (error: any) {
      return undefined;
    }
  }

  private getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
}

export const trendAnalysisService = new TrendAnalysisService();
export { TrendData, TeamTrend }; 
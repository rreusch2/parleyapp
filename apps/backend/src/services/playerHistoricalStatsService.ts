import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Import Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface PlayerHistoricalStats {
  playerId: string;
  playerName: string;
  team: string;
  propType: string;
  
  // Season stats
  seasonAvg: number;
  seasonTotal: number;
  gamesPlayed: number;
  
  // Recent form
  last10Avg: number;
  last10Games: number;
  
  // Splits
  homeAvg: number;
  awayAvg: number;
  homeVsAwayDiff: number;
  
  // Opponent history
  vsOpponentAvg: number;
  vsOpponentGames: number;
  
  // Confidence metrics
  consistency: number; // Standard deviation
  sampleSize: number;
  
  // Raw data for detailed analysis
  recentGames: Array<{
    date: string;
    opponent: string;
    isHome: boolean;
    value: number;
    gameContext: any;
  }>;
}

interface PropTypeMapping {
  [key: string]: {
    statKeys: string[];
    calculation: (stats: any) => number;
    description: string;
  };
}

class PlayerHistoricalStatsService {
  
  // Team name mapping from full names (TheOdds API) to abbreviations (historical data)
  private teamNameMappings: Record<string, string[]> = {
    'Chicago White Sox': ['CWS', 'CHW', 'CHI'],
    'Arizona Diamondbacks': ['ARI', 'AZ'],
    'Cleveland Guardians': ['CLE', 'CLV'],
    'Los Angeles Dodgers': ['LAD', 'LA'],
    'New York Yankees': ['NYY', 'NY'],
    'Boston Red Sox': ['BOS'],
    'Houston Astros': ['HOU'],
    'Atlanta Braves': ['ATL'],
    'San Diego Padres': ['SD', 'SDP'],
    'New York Mets': ['NYM'],
    'Philadelphia Phillies': ['PHI'],
    'Miami Marlins': ['MIA', 'FLA'],
    // Add more mappings as needed
  };
  
  private propTypeMappings: PropTypeMapping = {
    'batter_hits': {
      statKeys: ['hits'],
      calculation: (stats) => parseFloat(stats.hits) || 0,
      description: 'Hits per game'
    },
    'batter_rbis': {
      statKeys: ['rbis', 'rbi', 'runs_batted_in'],
      calculation: (stats) => {
        // Try multiple possible field names for RBIs
        const rbis = stats.rbis || stats.rbi || stats.runs_batted_in;
        if (rbis !== undefined && rbis !== null) {
          return parseFloat(rbis);
        }
        
        // If no RBIs field found, estimate from hits and home runs
        const hits = parseFloat(stats.hits) || 0;
        const homeRuns = parseFloat(stats.home_runs || stats.hr) || 0;
        
        // Basic estimation: ~0.35 RBIs per hit, home runs count as 1 RBI minimum
        const estimatedRBIs = (hits * 0.35) + homeRuns;
        
        logger.debug(`🔍 No RBIs field found for player, estimating ${estimatedRBIs.toFixed(2)} from hits(${hits}) and HRs(${homeRuns})`);
        return estimatedRBIs;
      },
      description: 'RBIs per game'
    },
    'batter_home_runs': {
      statKeys: ['home_runs', 'hr'],
      calculation: (stats) => parseFloat(stats.home_runs || stats.hr) || 0,
      description: 'Home runs per game'
    },
    'batter_total_bases': {
      statKeys: ['total_bases', 'tb'],
      calculation: (stats) => {
        // Try direct total_bases field first
        const totalBases = stats.total_bases || stats.tb;
        if (totalBases !== undefined && totalBases !== null) {
          return parseFloat(totalBases);
        }
        
        // If no total_bases field, calculate from other stats
        const hits = parseFloat(stats.hits) || 0;
        const homeRuns = parseFloat(stats.home_runs || stats.hr) || 0;
        
        // Basic estimation: singles + doubles*2 + triples*3 + HR*4
        // Assume 70% singles, 20% doubles, 5% triples, 5% HR of all hits
        const estimatedTotalBases = (hits * 1.4) + (homeRuns * 3); // Rough approximation
        
        logger.debug(`🔍 No total_bases field found, estimating ${estimatedTotalBases.toFixed(2)} from hits(${hits}) and HRs(${homeRuns})`);
        return estimatedTotalBases;
      },
      description: 'Total bases per game'
    },
    'pitcher_strikeouts': {
      statKeys: ['strikeouts', 'so', 'k'],
      calculation: (stats) => parseFloat(stats.strikeouts || stats.so || stats.k) || 0,
      description: 'Strikeouts per game'
    }
  };

  /**
   * Get comprehensive historical stats for a player/prop combination
   */
  async getPlayerHistoricalStats(
    playerId: string, 
    propType: string, 
    gameContext?: {
      opponent?: string;
      isHome?: boolean;
      startDate?: string;
    }
  ): Promise<PlayerHistoricalStats | null> {
    try {
      logger.info(`📊 Fetching historical stats for player ${playerId}, prop ${propType}`);
      
      // Get player info
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id, name, team, sport')
        .eq('id', playerId)
        .single();

      if (playerError || !player) {
        logger.error(`❌ Player not found: ${playerId}`);
        return null;
      }

      // Check if we can find historical stats for this player
      let { data: gameStats, error: statsError } = await supabase
        .from('player_game_stats')
        .select(`
          stats,
          fantasy_points,
          created_at,
          sports_events (
            id,
            home_team,
            away_team,
            start_time,
            sport
          )
        `)
        .eq('player_id', playerId)
        .not('stats', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statsError) {
        logger.error(`❌ Database error fetching player stats: ${statsError.message}`);
      }

      // Debug: Log the raw query result
      logger.debug(`🔍 Player stats query for ${playerId}: found ${gameStats?.length || 0} records, error: ${statsError?.message || 'none'}`);

      // If no stats found, try alternative approach
      if (!gameStats || gameStats.length === 0) {
        logger.warn(`⚠️ No stats found for player ID ${playerId} (${player.name}, ${player.team})`);
        
        // Try direct query without JOIN to see if the issue is with the JOIN
        const { data: directStats, error: directError } = await supabase
          .from('player_game_stats')
          .select('stats, fantasy_points, created_at, event_id')
          .eq('player_id', playerId)
          .not('stats', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100);

        if (directStats && directStats.length > 0) {
          logger.info(`✅ Found ${directStats.length} stats records via direct query - JOIN issue identified`);
          
          // Get sports_events data separately
          const eventIds = directStats.map(stat => stat.event_id);
          const { data: eventsData } = await supabase
            .from('sports_events')
            .select('id, home_team, away_team, start_time, sport')
            .in('id', eventIds);

          // Combine the data manually
          gameStats = directStats.map(stat => ({
            ...stat,
            sports_events: eventsData?.find(event => event.id === stat.event_id) || null
          })).filter(stat => stat.sports_events) as any; // Type assertion for compatibility

          logger.info(`🔗 Manually joined ${gameStats?.length || 0} stats records with events data`);
        }
      }

      // If still no stats found, try to find player with different team abbreviations
      if (!gameStats || gameStats.length === 0) {
        logger.info(`🔍 Trying to find ${player.name} with different team abbreviations...`);
        
        // Try to find player by name with team mapping
        const possibleTeams = this.teamNameMappings[player.team] || [player.team];
        
        for (const teamAbbr of possibleTeams) {
          const { data: alternatePlayer } = await supabase
            .from('players')
            .select('id, name, team, sport')
            .eq('name', player.name)
            .eq('team', teamAbbr)
            .single();
          
          if (alternatePlayer) {
            logger.info(`✅ Found ${player.name} with team ${teamAbbr} (ID: ${alternatePlayer.id})`);
            
            // Try to get stats for this alternate player ID using direct query
            const { data: alternateStats } = await supabase
              .from('player_game_stats')
              .select('stats, fantasy_points, created_at, event_id')
              .eq('player_id', alternatePlayer.id)
              .not('stats', 'is', null)
              .order('created_at', { ascending: false })
              .limit(100);
            
            if (alternateStats && alternateStats.length > 0) {
              logger.info(`🎯 Found ${alternateStats.length} historical games for ${player.name} under team ${teamAbbr}`);
              
              // Get sports_events data separately
              const eventIds = alternateStats.map(stat => stat.event_id);
              const { data: eventsData } = await supabase
                .from('sports_events')
                .select('id, home_team, away_team, start_time, sport')
                .in('id', eventIds);

              // Combine the data manually
              gameStats = alternateStats.map(stat => ({
                ...stat,
                sports_events: eventsData?.find(event => event.id === stat.event_id) || null
              })).filter(stat => stat.sports_events) as any; // Type assertion for compatibility

              // Update player reference to the one with historical data
              player.id = alternatePlayer.id;
              player.team = alternatePlayer.team;
              break;
            }
          }
        }
      }

      // Get prop type mapping
      const propMapping = this.propTypeMappings[propType];
      if (!propMapping) {
        logger.error(`❌ Unsupported prop type: ${propType}`);
        return null;
      }

      // Final check - if still no stats found after team mapping attempts
      if (statsError || !gameStats || gameStats.length === 0) {
        logger.warn(`⚠️ No historical stats found for player ${player.name} (${player.id}) after trying team mappings`);
        return null;
      }

      logger.info(`📈 Found ${gameStats.length} historical games for ${player.name}`);

      // Check if any games have valid sports_events data
      const gamesWithEvents = gameStats.filter(game => game.sports_events);
      
      if (gamesWithEvents.length === 0) {
        logger.warn(`⚠️ No games have valid event data for ${player.name} - using fallback processing`);
        
        // Use fallback processing that doesn't require sports_events JOIN
        const fallbackStats = await this.processHistoricalStatsWithFallback(
          player, 
          gameStats, 
          propMapping, 
          gameContext
        );
        
        return fallbackStats;
      }

      // Process and calculate stats using the original method
      const processedStats = await this.processHistoricalStats(
        player, 
        gamesWithEvents, // Use only games with valid event data
        propMapping, 
        gameContext
      );

      return processedStats;

    } catch (error) {
      logger.error(`❌ Error fetching historical stats for ${playerId}: ${error}`);
      return null;
    }
  }

  /**
   * Process raw historical stats into usable format
   */
  private async processHistoricalStats(
    player: any,
    gameStats: any[],
    propMapping: any,
    gameContext?: any
  ): Promise<PlayerHistoricalStats> {
    
    const recentGames: Array<{
      date: string;
      opponent: string;
      isHome: boolean;
      value: number;
      gameContext: any;
    }> = [];

    const values: number[] = [];
    const last10Values: number[] = [];
    const homeValues: number[] = [];
    const awayValues: number[] = [];
    const vsOpponentValues: number[] = [];

    let processedGames = 0;
    let skippedGames = 0;
    let zeroStatGames = 0;

    // Process each game
    for (let i = 0; i < gameStats.length; i++) {
      const game = gameStats[i];
      
      // Skip if no stats or no event info
      if (!game.stats || !game.sports_events) {
        skippedGames++;
        logger.debug(`🔍 Skipped game ${i + 1}: missing stats or event info`);
        continue;
      }

      // Calculate the prop value for this game
      const propValue = propMapping.calculation(game.stats);
      
      // Debug log the first few games to understand the data
      if (i < 3) {
        logger.debug(`🔍 Game ${i + 1} for ${player.name}: raw stats = ${JSON.stringify(game.stats)}, calculated ${propMapping.description} = ${propValue}`);
      }

      // Determine if player was home or away
      // Handle team name variations and empty team names
      let isHome = false;
      let opponent = '';
      
      if (player.team && game.sports_events.home_team && game.sports_events.away_team) {
        // Try exact match first
        isHome = game.sports_events.home_team === player.team;
        
        // If no exact match, try partial matching for team abbreviations
        if (!isHome && !game.sports_events.away_team.includes(player.team)) {
          // Check if player team is an abbreviation that appears in the full team name
          isHome = game.sports_events.home_team.toLowerCase().includes(player.team.toLowerCase()) ||
                   game.sports_events.home_team.toLowerCase().endsWith(player.team.toLowerCase());
        }
        
        opponent = isHome ? game.sports_events.away_team : game.sports_events.home_team;
      } else {
        // If we can't determine home/away, treat as away game and use home team as opponent
        opponent = game.sports_events.home_team || 'Unknown';
        logger.debug(`🔍 Unable to determine home/away for ${player.name} (team: "${player.team}") vs ${game.sports_events.home_team} @ ${game.sports_events.away_team}`);
      }

      // Add to recent games (include all games, even 0-stat games, for complete picture)
      recentGames.push({
        date: game.sports_events.start_time,
        opponent,
        isHome,
        value: propValue,
        gameContext: {
          sport: game.sports_events.sport,
          fantasyPoints: game.fantasy_points,
          rawStats: game.stats
        }
      });

      // Count games with 0 stats for debugging
      if (propValue === 0) {
        zeroStatGames++;
      }

      // Add to value arrays (include 0 values - they are legitimate for some props)
      values.push(propValue);
      processedGames++;
      
      // Last 10 games
      if (i < 10) {
        last10Values.push(propValue);
      }
      
      // Home/Away splits
      if (isHome) {
        homeValues.push(propValue);
      } else {
        awayValues.push(propValue);
      }
      
      // Vs specific opponent
      if (gameContext?.opponent && opponent.toLowerCase().includes(gameContext.opponent.toLowerCase())) {
        vsOpponentValues.push(propValue);
      }
    }

    // Debug logging
    logger.debug(`🔍 ${player.name} stats processing: ${processedGames} games processed, ${skippedGames} skipped, ${zeroStatGames} with 0 stats`);
    logger.debug(`🔍 Values array length: ${values.length}, sample values: [${values.slice(0, 5).join(', ')}]`);

    // Calculate averages and metrics
    const seasonAvg = this.calculateAverage(values);
    const last10Avg = this.calculateAverage(last10Values);
    const homeAvg = this.calculateAverage(homeValues);
    const awayAvg = this.calculateAverage(awayValues);
    const vsOpponentAvg = this.calculateAverage(vsOpponentValues);
    const consistency = this.calculateStandardDeviation(values);

    const stats: PlayerHistoricalStats = {
      playerId: player.id,
      playerName: player.name,
      team: player.team,
      propType: propMapping.description,
      
      seasonAvg,
      seasonTotal: values.reduce((sum, val) => sum + val, 0),
      gamesPlayed: values.length,
      
      last10Avg,
      last10Games: last10Values.length,
      
      homeAvg,
      awayAvg,
      homeVsAwayDiff: homeAvg - awayAvg,
      
      vsOpponentAvg,
      vsOpponentGames: vsOpponentValues.length,
      
      consistency,
      sampleSize: values.length,
      
      recentGames: recentGames.slice(0, 10) // Most recent 10 games
    };

    // Additional debug logging for problematic cases
    if (stats.gamesPlayed === 0) {
      logger.warn(`❌ ${player.name}: No games processed from ${gameStats.length} raw records`);
      logger.warn(`❌ Raw game samples: ${JSON.stringify(gameStats.slice(0, 2).map(g => ({ stats: g.stats, hasEvent: !!g.sports_events })))}`);
    } else if (stats.seasonAvg === 0 && stats.gamesPlayed > 10) {
      logger.warn(`⚠️ ${player.name}: All ${stats.gamesPlayed} games have 0 ${propMapping.description} - possible data quality issue`);
    }

    logger.info(`📊 Player stats calculated for ${player.name}: Season avg: ${seasonAvg.toFixed(2)}, Last 10: ${last10Avg.toFixed(2)}, Home: ${homeAvg.toFixed(2)}, Away: ${awayAvg.toFixed(2)}`);

    return stats;
  }

  /**
   * Process historical stats with fallback for missing event references
   */
  private async processHistoricalStatsWithFallback(
    player: any,
    gameStats: any[],
    propMapping: any,
    gameContext?: any
  ): Promise<PlayerHistoricalStats> {
    
    const recentGames: Array<{
      date: string;
      opponent: string;
      isHome: boolean;
      value: number;
      gameContext: any;
    }> = [];

    const values: number[] = [];
    const last10Values: number[] = [];
    const homeValues: number[] = [];
    const awayValues: number[] = [];
    const vsOpponentValues: number[] = [];

    let processedGames = 0;
    let skippedGames = 0;
    let zeroStatGames = 0;

    logger.info(`🔄 Processing ${gameStats.length} historical records for ${player.name} using fallback method`);

    // Process each game without requiring sports_events data
    for (let i = 0; i < gameStats.length; i++) {
      const game = gameStats[i];
      
      // Skip if no stats
      if (!game.stats) {
        skippedGames++;
        continue;
      }

      // Calculate the prop value for this game
      const propValue = propMapping.calculation(game.stats);
      
      // Debug log the first few games
      if (i < 3) {
        logger.debug(`🔍 Game ${i + 1} for ${player.name}: calculated ${propMapping.description} = ${propValue} from stats: ${JSON.stringify(game.stats)}`);
      }

      // Use fallback data from stats or defaults
      const gameDate = game.stats.game_date || game.created_at || new Date().toISOString();
      const opponent = game.stats.opponent || 'Unknown';
      const isHome = game.stats.is_home === true || game.stats.home === true || false; // Default to away if unknown
      
      // Add to recent games
      recentGames.push({
        date: gameDate,
        opponent,
        isHome,
        value: propValue,
        gameContext: {
          sport: game.stats.type || 'MLB',
          fantasyPoints: game.fantasy_points,
          rawStats: game.stats,
          fallback: true
        }
      });

      // Count zero stat games
      if (propValue === 0) {
        zeroStatGames++;
      }

      // Add to value arrays (include 0 values - they are legitimate)
      values.push(propValue);
      processedGames++;
      
      // Last 10 games
      if (i < 10) {
        last10Values.push(propValue);
      }
      
      // Home/Away splits (use fallback logic)
      if (isHome) {
        homeValues.push(propValue);
      } else {
        awayValues.push(propValue);
      }
      
      // Vs specific opponent (basic string matching)
      if (gameContext?.opponent && opponent.toLowerCase().includes(gameContext.opponent.toLowerCase())) {
        vsOpponentValues.push(propValue);
      }
    }

    // Debug logging
    logger.info(`🔄 ${player.name} fallback processing: ${processedGames} games processed, ${skippedGames} skipped, ${zeroStatGames} with 0 stats`);

    // Calculate averages and metrics
    const seasonAvg = this.calculateAverage(values);
    const last10Avg = this.calculateAverage(last10Values);
    const homeAvg = this.calculateAverage(homeValues);
    const awayAvg = this.calculateAverage(awayValues);
    const vsOpponentAvg = this.calculateAverage(vsOpponentValues);
    const consistency = this.calculateStandardDeviation(values);

    const stats: PlayerHistoricalStats = {
      playerId: player.id,
      playerName: player.name,
      team: player.team,
      propType: propMapping.description,
      
      seasonAvg,
      seasonTotal: values.reduce((sum, val) => sum + val, 0),
      gamesPlayed: values.length,
      
      last10Avg,
      last10Games: last10Values.length,
      
      homeAvg,
      awayAvg,
      homeVsAwayDiff: homeAvg - awayAvg,
      
      vsOpponentAvg,
      vsOpponentGames: vsOpponentValues.length,
      
      consistency,
      sampleSize: values.length,
      
      recentGames: recentGames.slice(0, 10)
    };

    // Log results
    if (stats.gamesPlayed > 0) {
      logger.info(`📊 ${player.name} fallback stats: Season avg: ${seasonAvg.toFixed(2)}, Games: ${stats.gamesPlayed}, Non-zero: ${stats.gamesPlayed - zeroStatGames}`);
    } else {
      logger.warn(`❌ ${player.name}: No valid stats after fallback processing`);
    }

    return stats;
  }

  /**
   * Get multiple players' historical stats efficiently
   */
  async getBatchPlayerHistoricalStats(
    playerPropCombinations: Array<{
      playerId: string;
      propType: string;
      gameContext?: any;
    }>
  ): Promise<Array<PlayerHistoricalStats | null>> {
    const results: Array<PlayerHistoricalStats | null> = [];
    
    // Process in batches to avoid overwhelming the database
    const batchSize = 5;
    for (let i = 0; i < playerPropCombinations.length; i += batchSize) {
      const batch = playerPropCombinations.slice(i, i + batchSize);
      
      const batchPromises = batch.map(combo => 
        this.getPlayerHistoricalStats(combo.playerId, combo.propType, combo.gameContext)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < playerPropCombinations.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Calculate statistical prediction for a player prop
   */
  calculatePropPrediction(
    historicalStats: PlayerHistoricalStats,
    line: number,
    gameContext?: {
      isHome?: boolean;
      opponent?: string;
      pace?: number;
    }
  ): {
    prediction: number;
    confidence: number;
    overProbability: number;
    underProbability: number;
    factors: string[];
  } {
    let prediction = historicalStats.seasonAvg;
    const factors: string[] = [];

    // Weight recent form more heavily
    if (historicalStats.last10Games >= 5) {
      prediction = (prediction * 0.6) + (historicalStats.last10Avg * 0.4);
      factors.push(`Recent form: ${historicalStats.last10Avg.toFixed(2)} (last ${historicalStats.last10Games} games)`);
    }

    // Home/Away adjustment
    if (gameContext?.isHome !== undefined) {
      const homeAwayAdj = gameContext.isHome ? 
        (historicalStats.homeAvg - historicalStats.seasonAvg) * 0.3 :
        (historicalStats.awayAvg - historicalStats.seasonAvg) * 0.3;
      
      prediction += homeAwayAdj;
      factors.push(`${gameContext.isHome ? 'Home' : 'Away'} adjustment: ${homeAwayAdj > 0 ? '+' : ''}${homeAwayAdj.toFixed(2)}`);
    }

    // Opponent-specific adjustment
    if (historicalStats.vsOpponentGames >= 3) {
      const opponentAdj = (historicalStats.vsOpponentAvg - historicalStats.seasonAvg) * 0.2;
      prediction += opponentAdj;
      factors.push(`vs Opponent avg: ${historicalStats.vsOpponentAvg.toFixed(2)} (${historicalStats.vsOpponentGames} games)`);
    }

    // Calculate confidence based on sample size and consistency
    const sampleSizeConfidence = Math.min(1, historicalStats.sampleSize / 50);
    const consistencyConfidence = Math.max(0.3, 1 - (historicalStats.consistency / historicalStats.seasonAvg));
    const confidence = Math.max(0.5, Math.min(0.9, (sampleSizeConfidence + consistencyConfidence) / 2));

    // Calculate over/under probabilities using normal distribution
    const variance = Math.pow(historicalStats.consistency, 2);
    const standardDeviation = Math.sqrt(variance);
    const zScore = (line - prediction) / standardDeviation;
    const overProbability = 1 - this.normalCDF(zScore);

    return {
      prediction: Math.max(0, prediction),
      confidence,
      overProbability,
      underProbability: 1 - overProbability,
      factors
    };
  }

  // Helper methods
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.calculateAverage(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}

export const playerHistoricalStatsService = new PlayerHistoricalStatsService();
export { PlayerHistoricalStats }; 
import { supabase } from './supabase/client';
import { SportsGameOddsService } from './sportsGameOddsService';
import { createLogger } from '../utils/logger';

const logger = createLogger('MLBBettingResultsService');

interface PlayerGameStat {
  id: string;
  player_id: string;
  stats: any;
  betting_results: any;
  created_at: string;
  /**
   * Supabase join can return either a single object or an array of objects.
   * We keep it loose here and normalise when we access it.
   */
  players: any;
}

export class MLBBettingResultsService {
  private sportsGameOddsService: SportsGameOddsService;

  constructor() {
    this.sportsGameOddsService = new SportsGameOddsService();
  }

  /**
   * Populate betting results for existing MLB player game stats
   */
  async populateBettingResults(limit: number = 100): Promise<void> {
    try {
      logger.info('Starting to populate MLB betting results...');

      // Get player game stats that don't have betting results yet
      const { data: playerStats, error } = await supabase
        .from('player_game_stats')
        .select(`
          id,
          player_id,
          stats,
          betting_results,
          created_at,
          players(name, team, sport)
        `)
        .eq('players.sport', 'MLB')
        .or('betting_results.is.null,betting_results.eq.{}')
        .gte('created_at', '2024-01-01') // Only 2024 and 2025 data
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching player stats:', error);
        return;
      }

      if (!playerStats || playerStats.length === 0) {
        logger.info('No player stats found that need betting results');
        return;
      }

      logger.info(`Found ${playerStats.length} records to process`);

      // Process in batches
      const batchSize = 10;
      let processedCount = 0;

      for (let i = 0; i < playerStats.length; i += batchSize) {
        const batch = playerStats.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (record: PlayerGameStat) => {
          try {
            const bettingResults = await this.generateBettingResults(record);
            
            if (Object.keys(bettingResults).length > 0) {
              const { error: updateError } = await supabase
                .from('player_game_stats')
                .update({ betting_results: bettingResults })
                .eq('id', record.id);

              if (updateError) {
                logger.error(`Error updating record ${record.id}:`, updateError);
              } else {
                processedCount++;
                if (processedCount % 10 === 0) {
                  logger.info(`Processed ${processedCount} records...`);
                }
              }
            }
          } catch (recordError) {
            logger.error(`Error processing record ${record.id}:`, recordError);
          }
        }));

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logger.info(`✅ Successfully processed ${processedCount} records`);
      
      // Show sample results
      await this.showSampleResults();

    } catch (error) {
      logger.error('Error in populateBettingResults:', error);
    }
  }

  /**
   * Generate betting results for a player game stat record
   */
  private async generateBettingResults(record: PlayerGameStat): Promise<any> {
    const gameStats = record.stats || {};
    const bettingResults: any = {};

    // Common MLB prop types with typical lines
    const propLines = await this.getTypicalMLBLines();

    // Process each prop type
    Object.keys(propLines).forEach(propType => {
      const actualValue = gameStats[propType];
      
      if (actualValue !== undefined && actualValue !== null) {
        const line = propLines[propType];
        
        bettingResults[propType] = {
          line: line,
          result: actualValue >= line ? 'over' : 'under',
          sportsbook: 'draftkings', // Default sportsbook
          actual_value: actualValue,
          confidence: this.calculateConfidence(actualValue, line)
        };
      }
    });

    return bettingResults;
  }

  /**
   * Get typical MLB betting lines (we'll enhance this with real API data later)
   */
  private async getTypicalMLBLines(): Promise<{ [key: string]: number }> {
    // These are typical MLB prop lines - we can enhance this with real API data
    return {
      'hits': 1.5,
      'home_runs': 0.5,
      'walks': 0.5,
      'strikeouts': 1.5, // For batters
      'at_bats': 4.5,
      'rbis': 1.5,
      'runs': 0.5,
      'stolen_bases': 0.5,
      'total_bases': 2.5
    };
  }

  /**
   * Calculate confidence based on how close the actual value was to the line
   */
  private calculateConfidence(actualValue: number, line: number): number {
    const difference = Math.abs(actualValue - line);
    
    if (difference >= 2) return 95;
    if (difference >= 1.5) return 85;
    if (difference >= 1) return 75;
    if (difference >= 0.5) return 65;
    return 55; // Very close to the line
  }

  /**
   * Use Sports Game Odds API to get real betting lines for recent games
   */
  async populateRealBettingResults(days: number = 7): Promise<void> {
    try {
      logger.info(`Fetching real betting results for last ${days} days...`);
      
      // Test API connection first
      const isConnected = await this.sportsGameOddsService.testConnection();
      if (!isConnected) {
        logger.error('Cannot connect to Sports Game Odds API');
        return;
      }

      // Get real prop results from API
      const realResults = await this.sportsGameOddsService.getRecentMLBPropResults(days);
      
      if (realResults.length === 0) {
        logger.info('No real betting results found from API');
        return;
      }

      logger.info(`Found ${realResults.length} real betting results`);

      // Match API results with our database records
      for (const apiResult of realResults) {
        await this.matchAndUpdateRecord(apiResult);
      }

      logger.info('✅ Finished populating real betting results');

    } catch (error) {
      logger.error('Error populating real betting results:', error);
    }
  }

  /**
   * Match API result with database record and update
   */
  private async matchAndUpdateRecord(apiResult: any): Promise<void> {
    try {
      // Find matching player and game date
      const { data: playerStats, error } = await supabase
        .from('player_game_stats')
        .select(`
          id,
          betting_results,
          players(name)
        `)
        .ilike('players.name', `%${apiResult.player_name}%`)
        .gte('created_at', apiResult.game_date)
        .lte('created_at', `${apiResult.game_date}T23:59:59`)
        .limit(1);

      if (error || !playerStats || playerStats.length === 0) {
        return; // No matching record found
      }

      const record = playerStats[0];
      const currentBettingResults = record.betting_results || {};
      
      // Update with real API data
      currentBettingResults[apiResult.prop_type] = {
        line: apiResult.line,
        result: apiResult.result,
        sportsbook: apiResult.sportsbook,
        actual_value: apiResult.actual_value,
        won: apiResult.won,
        source: 'sports_game_odds_api'
      };

      // Update database
      const { error: updateError } = await supabase
        .from('player_game_stats')
        .update({ betting_results: currentBettingResults })
        .eq('id', record.id);

      if (updateError) {
        logger.error('Error updating record with real data:', updateError);
      }

    } catch (error) {
      logger.error('Error matching API result:', error);
    }
  }

  /**
   * Show sample betting results
   */
  private async showSampleResults(): Promise<void> {
    try {
      const { data: sampleResults, error } = await supabase
        .from('player_game_stats')
        .select(`
          betting_results,
          players(name, team)
        `)
        .eq('players.sport', 'MLB')
        .not('betting_results', 'eq', '{}')
        .limit(5);

      if (sampleResults && sampleResults.length > 0) {
        logger.info('\n📊 Sample betting results:');
        sampleResults.forEach((sample, index) => {
          const playerInfo = Array.isArray(sample.players) ? sample.players[0] : sample.players;
          logger.info(`${index + 1}. ${playerInfo?.name} (${playerInfo?.team}):`);
          logger.info(JSON.stringify(sample.betting_results, null, 2));
        });
      }
    } catch (error) {
      logger.error('Error showing sample results:', error);
    }
  }

  /**
   * Get trend analysis from betting results
   */
  async getTrendAnalysis(limit: number = 15): Promise<any[]> {
    try {
      // Get all records with betting results
      const { data: records, error } = await supabase
        .from('player_game_stats')
        .select(`
          betting_results,
          created_at,
          players(name, team, sport)
        `)
        .eq('players.sport', 'MLB')
        .not('betting_results', 'eq', '{}')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error || !records) {
        logger.error('Error fetching records for trend analysis:', error);
        return [];
      }

      // Analyze trends using the Sports Game Odds service
      const trends = this.sportsGameOddsService.analyzePlayerPropTrends(
        this.transformRecordsForAnalysis(records)
      );

      return trends.slice(0, limit);

    } catch (error) {
      logger.error('Error in trend analysis:', error);
      return [];
    }
  }

  /**
   * Transform database records for trend analysis
   */
  private transformRecordsForAnalysis(records: any[]): any[] {
    const results: any[] = [];

    records.forEach(record => {
      const bettingResults = record.betting_results || {};

      // Player info may be missing in join; if so, attempt a lookup
      let playerInfo = Array.isArray(record.players) ? record.players[0] : record.players;

      if (!playerInfo || !playerInfo.name) {
        // Fetch from players table synchronously (rare path)
        // We can't use await inside forEach; push a placeholder
        playerInfo = { name: 'Unknown', team: 'Unknown' };
      }

      const playerName = playerInfo?.name;
      const team = playerInfo?.team;
      const gameDate = record.created_at;

      Object.keys(bettingResults).forEach(propType => {
        const result = bettingResults[propType];
        
        results.push({
          player_name: playerName,
          team: team,
          prop_type: propType,
          line: result.line,
          actual_value: result.actual_value,
          result: result.result,
          won: result.result === 'over' ? result.actual_value >= result.line : result.actual_value < result.line,
          sportsbook: result.sportsbook || 'Unknown',
          game_date: gameDate
        });
      });
    });

    return results;
  }
} 
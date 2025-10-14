import axios from 'axios';
import { createLogger } from '../utils/logger';

const logger = createLogger('SportsGameOddsService');

interface PlayerPropResult {
  player_id: string;
  player_name: string;
  team: string;
  prop_type: string;
  line: number;
  actual_value: number;
  result: 'over' | 'under';
  won: boolean;
  sportsbook: string;
  game_date: string;
  game_id: string;
}

interface GameEvent {
  eventID: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
}

interface PropOdds {
  eventID: string;
  player: string;
  propType: string;
  line: number;
  overOdds: number;
  underOdds: number;
  sportsbook: string;
}

export class SportsGameOddsService {
  private apiKey: string;
  private baseUrl = 'https://api.sportsgameodds.com/v2';

  constructor() {
    this.apiKey = process.env.SPORTS_GAME_ODDS_API_KEY || '';
    if (!this.apiKey) {
      logger.error('SPORTS_GAME_ODDS_API_KEY environment variable is required');
    }
  }

  private async requestWithRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 3, waitMs = 2000): Promise<T | null> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 429) {
          attempt++;
          const retryAfter = parseInt(err?.response?.headers?.['retry-after'] || '0', 10);
          const delay = (retryAfter > 0 ? retryAfter * 1000 : waitMs) * attempt; // simple linear backoff
          logger.warn(`${label}: hit rate-limit 429 – retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})`);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        // Other errors – bail
        logger.error(`${label}:`, err.message || err);
        break;
      }
    }
    return null;
  }

  /**
   * Get MLB games for a specific date
   */
  async getMLBGames(date: string): Promise<GameEvent[]> {
    const res = await this.requestWithRetry(async () => {
      return axios.get(`${this.baseUrl}/events`, {
        params: {
          leagueID: 'MLB',
          date,
          apiKey: this.apiKey
        }
      });
    }, `getMLBGames ${date}`);

    if (res && 'data' in res) {
      // Type guard for AxiosResponse
      const anyRes: any = res;
      return anyRes.data.events || [];
    }
    return [];
  }

  /**
   * Get player prop odds for a specific game
   */
  async getPlayerPropOdds(eventId: string): Promise<PropOdds[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/props`, {
        params: {
          eventID: eventId,
          apiKey: this.apiKey
        }
      });

      return response.data.props || [];
    } catch (error) {
      logger.error('Error fetching player prop odds:', error);
      return [];
    }
  }

  /**
   * Get completed game results with bet grading
   */
  async getPlayerPropResults(eventId: string): Promise<PlayerPropResult[]> {
    const res = await this.requestWithRetry(async () => {
      return axios.get(`${this.baseUrl}/results`, {
        params: {
          eventID: eventId,
          includeProps: true,
          apiKey: this.apiKey
        }
      });
    }, `getPlayerPropResults ${eventId}`);

    if (!res || !('data' in res) || !res.data.results || !res.data.results.props) {
      return [];
    }

    const response: any = res;

    // Transform the API response to our format
    const results: PlayerPropResult[] = [];

    for (const prop of response.data.results.props) {
      results.push({
        player_id: prop.playerID || '',
        player_name: prop.playerName || '',
        team: prop.team || '',
        prop_type: this.normalizePropType(prop.propType),
        line: prop.line,
        actual_value: prop.actualValue,
        result: prop.actualValue >= prop.line ? 'over' : 'under',
        won: prop.result === 'won',
        sportsbook: prop.sportsbook || 'Unknown',
        game_date: response.data.results.gameDate || '',
        game_id: eventId
      });
    }

    return results;
  }

  /**
   * Get recent MLB player prop results for trend analysis
   */
  async getRecentMLBPropResults(days: number = 7): Promise<PlayerPropResult[]> {
    try {
      const results: PlayerPropResult[] = [];
      const today = new Date();
      
      // Get results for the last N days
      for (let i = 1; i <= days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        logger.info(`Fetching MLB games for ${dateString}`);
        const games = await this.getMLBGames(dateString);
        
        for (const game of games) {
          if (game.status === 'completed' || game.status === 'final') {
            const gameResults = await this.getPlayerPropResults(game.eventID);
            results.push(...gameResults);
          }
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return results;
    } catch (error) {
      logger.error('Error fetching recent MLB prop results:', error);
      return [];
    }
  }

  /**
   * Analyze player prop trends from results
   */
  analyzePlayerPropTrends(results: PlayerPropResult[]): any[] {
    const playerPropMap = new Map<string, PlayerPropResult[]>();
    
    // Group results by player and prop type
    results.forEach(result => {
      const key = `${result.player_name}-${result.prop_type}`;
      if (!playerPropMap.has(key)) {
        playerPropMap.set(key, []);
      }
      playerPropMap.get(key)!.push(result);
    });

    const trends: any[] = [];

    playerPropMap.forEach((playerResults, key) => {
      const [playerName, propType] = key.split('-');
      
      // Sort by date (most recent first)
      playerResults.sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime());
      
      if (playerResults.length < 3) return; // Need at least 3 games for a trend

      // Find current streak
      let streakLength = 0;
      let streakType = playerResults[0].result;
      
      for (const result of playerResults) {
        if (result.result === streakType) {
          streakLength++;
        } else {
          break;
        }
      }

      // Only include significant streaks (3+ games)
      if (streakLength >= 3) {
        const confidence = Math.min(50 + (streakLength * 8), 95);
        const lastResult = playerResults[0];
        
        trends.push({
          playerName,
          team: lastResult.team,
          propType: propType.toUpperCase(),
          streakType: streakType.toUpperCase(),
          streakLength,
          confidence: Math.round(confidence),
          lastLine: lastResult.line,
          sportsbook: lastResult.sportsbook,
          lastGameDate: lastResult.game_date,
          totalGames: playerResults.length
        });
      }
    });

    // Sort by streak length and confidence
    return trends.sort((a, b) => {
      if (a.streakLength !== b.streakLength) {
        return b.streakLength - a.streakLength;
      }
      return b.confidence - a.confidence;
    });
  }

  /**
   * Normalize prop type names to match our database
   */
  private normalizePropType(propType: string): string {
    const normalizedMap: { [key: string]: string } = {
      'hits': 'hits',
      'total_hits': 'hits',
      'home_runs': 'home_runs',
      'total_home_runs': 'home_runs',
      'rbis': 'rbis',
      'runs_batted_in': 'rbis',
      'strikeouts': 'strikeouts',
      'total_strikeouts': 'strikeouts',
      'walks': 'walks',
      'total_walks': 'walks',
      'stolen_bases': 'stolen_bases',
      'total_stolen_bases': 'stolen_bases',
      'total_bases': 'total_bases'
    };

    const normalized = propType.toLowerCase().replace(/\s+/g, '_');
    return normalizedMap[normalized] || normalized;
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const games = await this.getMLBGames(today);
      logger.info(`API test successful. Found ${games.length} MLB games for today.`);
      return true;
    } catch (error) {
      logger.error('API connection test failed:', error);
      return false;
    }
  }
} 
/**
 * The Odds API Service
 * Fetches real-time odds from The Odds API (replacement for Sportradar)
 * Free tier: 500 credits/month
 * Covers major US bookmakers: DraftKings, FanDuel, BetMGM, Caesars, etc.
 */

import axios from 'axios';
import { logger } from '../utils/logger';

interface OddsApiConfig {
  apiKey: string;
  baseUrl: string;
  provider: 'theodds' | 'oddsjam';
}

interface GameOdds {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: BookmakerOdds[];
}

interface BookmakerOdds {
  key: string;
  title: string;
  markets: Market[];
}

interface Market {
  key: string;
  outcomes: Outcome[];
}

interface Outcome {
  name: string;
  price: number;
  point?: number;
}

class OddsApiService {
  private config: OddsApiConfig;
  private axiosInstance: any;

  constructor() {
    this.config = {
      apiKey: process.env.THEODDS_API_KEY || process.env.SPORTS_API_KEY || '',
      baseUrl: 'https://api.the-odds-api.com/v4',
      provider: (process.env.API_PROVIDER as 'theodds' | 'oddsjam') || 'theodds'
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use((config: any) => {
      logger.info('OddsAPI Request:', {
        method: config.method,
        url: config.url,
        params: config.params
      });
      return config;
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response: any) => {
        const remaining = response.headers['x-requests-remaining'];
        const used = response.headers['x-requests-used'];
        
        if (remaining) {
          logger.info(`API Usage: ${used} used / ${remaining} remaining`);
        }
        
        return response;
      },
      (error: any) => {
        logger.error('OddsAPI Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  // Get available sports
  async getSports() {
    try {
      const response = await this.axiosInstance.get('/sports', {
        params: { apiKey: this.config.apiKey }
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching sports:', error);
      throw error;
    }
  }

  // Get upcoming games for a sport
  async getGames(sport: string) {
    try {
      const response = await this.axiosInstance.get(`/sports/${sport}/events`, {
        params: { apiKey: this.config.apiKey }
      });
      return response.data;
    } catch (error) {
      logger.error(`Error fetching games for ${sport}:`, error);
      throw error;
    }
  }

  // Get odds for games
  async getOdds(sport: string, markets: string[] = ['h2h', 'spreads', 'totals'], eventIds?: string[]) {
    try {
      const params: any = {
        apiKey: this.config.apiKey,
        regions: 'us',
        markets: markets.join(',')
      };

      if (eventIds && eventIds.length > 0) {
        params.eventIds = eventIds.join(',');
      }

      const response = await this.axiosInstance.get(`/sports/${sport}/odds`, { params });
      return response.data;
    } catch (error) {
      logger.error(`Error fetching odds for ${sport}:`, error);
      throw error;
    }
  }

  // Get player props for a specific game
  async getPlayerProps(sport: string, eventId: string) {
    try {
      const response = await this.axiosInstance.get(`/sports/${sport}/events/${eventId}/odds`, {
        params: {
          apiKey: this.config.apiKey,
          regions: 'us',
          markets: 'player_points,player_rebounds,player_assists,player_threes,player_doubles'
        }
      });
      return response.data;
    } catch (error) {
      logger.error(`Error fetching player props for game ${eventId}:`, error);
      // Return empty object if player props not available
      return { bookmakers: [] };
    }
  }

  // Get historical odds (not available in free tier)
  async getHistoricalOdds(sport: string, date: string) {
    logger.warn('Historical odds not available in The Odds API free tier');
    return [];
  }

  // Helper to find best odds across bookmakers
  findBestOdds(gameOdds: GameOdds, marketKey: string) {
    let bestOdds: any = null;
    let bestBookmaker = '';

    for (const bookmaker of gameOdds.bookmakers) {
      const market = bookmaker.markets.find(m => m.key === marketKey);
      if (!market) continue;

      for (const outcome of market.outcomes) {
        if (!bestOdds || outcome.price > bestOdds.price) {
          bestOdds = outcome;
          bestBookmaker = bookmaker.title;
        }
      }
    }

    return { odds: bestOdds, bookmaker: bestBookmaker };
  }

  // Convert American odds to decimal
  americanToDecimal(americanOdds: number): number {
    if (americanOdds > 0) {
      return (americanOdds / 100) + 1;
    } else {
      return (100 / Math.abs(americanOdds)) + 1;
    }
  }

  // Calculate implied probability
  calculateImpliedProbability(americanOdds: number): number {
    if (americanOdds > 0) {
      return 100 / (americanOdds + 100);
    } else {
      return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
    }
  }
}

// Export singleton instance
export const oddsApiService = new OddsApiService(); 
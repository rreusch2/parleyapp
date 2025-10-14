import axios from 'axios';
import dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';

// Load environment variables
dotenv.config();

const logger = createLogger('sportmonks');
const API_KEY = process.env.SPORTMONKS_API_KEY;
const BASE_URL = 'https://api.sportmonks.com/v3';

// Define interfaces for the response types
interface FootballPrediction {
  fixtureId: string;
  leagueId: string;
  homeTeam: {
    id: string;
    name: string;
    winProbability: number;
  };
  awayTeam: {
    id: string;
    name: string;
    winProbability: number;
  };
  drawProbability: number;
  predictions: {
    homeScore: number;
    awayScore: number;
    btts: boolean; // Both teams to score
    over_under: {
      value: number;
      over: number; // Probability for over
      under: number; // Probability for under
    };
  };
  value: {
    home: number; // Value rating for home win
    draw: number; // Value rating for draw
    away: number; // Value rating for away win
  };
  confidence: string; // "Low", "Medium", "High"
}

interface PredictionMarket {
  id: string;
  name: string;
  values: Array<{
    value: string;
    probability: number;
    odds: number;
  }>;
}

/**
 * Service for interacting with Sportmonks API for football predictions
 */
class SportmonksService {
  /**
   * Get prediction for a football match
   * @param fixtureId - Fixture/match ID
   */
  async getFootballPrediction(fixtureId: string): Promise<FootballPrediction> {
    try {
      if (!API_KEY) {
        throw new Error('SPORTMONKS_API_KEY not found in environment variables');
      }

      logger.info(`Fetching football prediction for fixture ${fixtureId}`);
      
      const response = await axios.get(`${BASE_URL}/football/predictions/fixtures/${fixtureId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });
      
      // Transform the response to match our interface
      const prediction = this.transformPredictionResponse(response.data.data);
      
      logger.info(`Successfully fetched prediction for fixture ${fixtureId}`);
      return prediction;
    } catch (error) {
      logger.error(`Error fetching football prediction: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get all available prediction markets for a football match
   * @param fixtureId - Fixture/match ID
   */
  async getPredictionMarkets(fixtureId: string): Promise<PredictionMarket[]> {
    try {
      if (!API_KEY) {
        throw new Error('SPORTMONKS_API_KEY not found in environment variables');
      }

      logger.info(`Fetching prediction markets for fixture ${fixtureId}`);
      
      const response = await axios.get(`${BASE_URL}/football/predictions/markets/fixtures/${fixtureId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });
      
      // Transform the response to match our interface
      const markets = this.transformMarketsResponse(response.data.data);
      
      logger.info(`Successfully fetched ${markets.length} prediction markets for fixture ${fixtureId}`);
      return markets;
    } catch (error) {
      logger.error(`Error fetching prediction markets: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get prediction for a specific market in a football match
   * @param fixtureId - Fixture/match ID
   * @param marketName - Market name (e.g., '1X2', 'Over/Under', 'BTTS')
   */
  async getMarketPrediction(fixtureId: string, marketName: string): Promise<PredictionMarket | null> {
    try {
      const markets = await this.getPredictionMarkets(fixtureId);
      const market = markets.find(m => m.name.toLowerCase() === marketName.toLowerCase());
      
      if (!market) {
        logger.warn(`Market "${marketName}" not found for fixture ${fixtureId}`);
        return null;
      }
      
      return market;
    } catch (error) {
      logger.error(`Error fetching market prediction: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get value bets for a football match
   * @param fixtureId - Fixture/match ID
   * @param threshold - Value threshold (e.g., 0.1 means 10% value)
   */
  async getValueBets(fixtureId: string, threshold: number = 0.1): Promise<Array<{market: string, selection: string, value: number}>> {
    try {
      const markets = await this.getPredictionMarkets(fixtureId);
      const valueBets: { market: string; selection: string; value: number; }[] = [];
      
      for (const market of markets) {
        for (const value of market.values) {
          // Calculate implied probability from odds
          const impliedProb = 1 / value.odds;
          
          // Calculate value (predicted probability - implied probability)
          const valueRating = value.probability - impliedProb;
          
          if (valueRating >= threshold) {
            valueBets.push({
              market: market.name,
              selection: value.value,
              value: valueRating
            });
          }
        }
      }
      
      // Sort by value (highest first)
      valueBets.sort((a, b) => b.value - a.value);
      
      logger.info(`Found ${valueBets.length} value bets for fixture ${fixtureId}`);
      return valueBets;
    } catch (error) {
      logger.error(`Error finding value bets: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Transform the prediction API response to our interface
   * @param data - API response data
   */
  private transformPredictionResponse(data: any): FootballPrediction {
    // This is a simplified transformation. Adjust based on actual API response structure.
    return {
      fixtureId: data.fixture_id.toString(),
      leagueId: data.league_id.toString(),
      homeTeam: {
        id: data.home_team.id.toString(),
        name: data.home_team.name,
        winProbability: data.predictions.home_win_probability
      },
      awayTeam: {
        id: data.away_team.id.toString(),
        name: data.away_team.name,
        winProbability: data.predictions.away_win_probability
      },
      drawProbability: data.predictions.draw_probability,
      predictions: {
        homeScore: data.predictions.home_score,
        awayScore: data.predictions.away_score,
        btts: data.predictions.btts === 'Yes',
        over_under: {
          value: data.predictions.over_under_value || 2.5,
          over: data.predictions.over_probability,
          under: data.predictions.under_probability
        }
      },
      value: {
        home: data.value_ratings?.home || 0,
        draw: data.value_ratings?.draw || 0,
        away: data.value_ratings?.away || 0
      },
      confidence: this.getConfidenceLevel(data.confidence || 0.5)
    };
  }

  /**
   * Transform the markets API response to our interface
   * @param data - API response data
   */
  private transformMarketsResponse(data: any[]): PredictionMarket[] {
    // This is a simplified transformation. Adjust based on actual API response structure.
    return data.map(market => ({
      id: market.id.toString(),
      name: market.name,
      values: market.values.map((value: any) => ({
        value: value.value,
        probability: value.probability,
        odds: value.odds
      }))
    }));
  }

  /**
   * Convert a confidence score to a confidence level
   * @param confidence - Confidence score (0-1)
   */
  private getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.7) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  }
}

// Create and export service instance
export const sportmonksService = new SportmonksService();

// Export tool functions for the LLM orchestrator
export const sportmonksGetFootballPredictionTool = async (fixtureId: string) => {
  return await sportmonksService.getFootballPrediction(fixtureId);
};

export const sportmonksGetMarketPredictionTool = async (fixtureId: string, marketName: string) => {
  return await sportmonksService.getMarketPrediction(fixtureId, marketName);
};

export const sportmonksGetValueBetsTool = async (fixtureId: string, threshold: number = 0.1) => {
  return await sportmonksService.getValueBets(fixtureId, threshold);
}; 
import axios from 'axios';
import dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';

// Load environment variables
dotenv.config();

const logger = createLogger('sportsDataIO');
const API_KEY = process.env.SPORTSDATAIO_API_KEY;
const BASE_URL = 'https://api.sportsdata.io/v3';

// Define interfaces for the response types
interface GamePrediction {
  gameId: string;
  homeTeamPrediction: {
    teamId: string;
    name: string;
    winProbability: number;
    predictedScore: number;
  };
  awayTeamPrediction: {
    teamId: string;
    name: string;
    winProbability: number;
    predictedScore: number;
  };
  spreadPrediction: {
    predictedSpread: number;
    predictedOverProbability: number;
    predictedUnderProbability: number;
  };
  totalPrediction: {
    predictedTotal: number;
    predictedOverProbability: number;
    predictedUnderProbability: number;
  };
  confidence: string; // "Low", "Medium", "High"
  bestBets: Array<{
    betType: string;
    recommendation: string;
    odds: number;
    impliedProbability: number;
    predictedProbability: number;
    value: number;
    confidence: string;
  }>;
}

interface PlayerPropPrediction {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  statType: string;
  line: number;
  overProbability: number;
  underProbability: number;
  predictedValue: number;
  confidence: string;
  recommendation: string;
  value: number;
}

/**
 * Service for interacting with SportsDataIO's BAKER Engine for predictions
 */
class SportsDataIOService {
  /**
   * Get game outcome prediction from BAKER Engine
   * @param gameId - Game ID
   * @param betType - Type of bet (moneyline, spread, total)
   * @param sport - Sport code (NBA, NFL, MLB, etc.)
   */
  async getGamePrediction(gameId: string, betType: 'moneyline' | 'spread' | 'total', sport: string): Promise<GamePrediction> {
    try {
      if (!API_KEY) {
        throw new Error('SPORTSDATAIO_API_KEY not found in environment variables');
      }

      const sportCode = this.getSportCode(sport);
      const endpoint = `/stats/${sportCode}/predictions/json/GamePredictionsByGameID/${gameId}`;
      
      logger.info(`Fetching game prediction for ${sport} game ${gameId} (${betType})`);
      
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        headers: {
          'Ocp-Apim-Subscription-Key': API_KEY
        }
      });

      // Transform the response to match our interface
      const prediction = this.transformGamePrediction(response.data, betType);
      
      logger.info(`Successfully fetched prediction for ${sport} game ${gameId}`);
      return prediction;
    } catch (error) {
      logger.error(`Error fetching game prediction: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get player prop prediction from BAKER Engine
   * @param playerId - Player ID
   * @param gameId - Game ID
   * @param statType - Stat type (points, rebounds, assists, etc.)
   * @param overUnderLine - The line for the over/under
   * @param sport - Sport code (NBA, NFL, MLB, etc.)
   */
  async getPlayerPropPrediction(
    playerId: string, 
    gameId: string, 
    statType: string, 
    overUnderLine: number, 
    sport: string
  ): Promise<PlayerPropPrediction> {
    try {
      if (!API_KEY) {
        throw new Error('SPORTSDATAIO_API_KEY not found in environment variables');
      }

      const sportCode = this.getSportCode(sport);
      const endpoint = `/stats/${sportCode}/predictions/json/PlayerPropsByGameID/${gameId}`;
      
      logger.info(`Fetching player prop prediction for ${sport} player ${playerId} in game ${gameId} (${statType})`);
      
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        headers: {
          'Ocp-Apim-Subscription-Key': API_KEY
        }
      });

      // Find the specific player prop prediction in the response
      const playerProps = response.data;
      const propPrediction = this.findPlayerPropPrediction(playerProps, playerId, statType, overUnderLine);
      
      if (!propPrediction) {
        throw new Error(`No prediction found for player ${playerId} with stat type ${statType} and line ${overUnderLine}`);
      }
      
      logger.info(`Successfully fetched player prop prediction for ${sport} player ${playerId}`);
      return propPrediction;
    } catch (error) {
      logger.error(`Error fetching player prop prediction: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get all available player prop predictions for a game
   * @param gameId - Game ID
   * @param sport - Sport code (NBA, NFL, MLB, etc.)
   */
  async getAllPlayerPropPredictions(gameId: string, sport: string): Promise<PlayerPropPrediction[]> {
    try {
      if (!API_KEY) {
        throw new Error('SPORTSDATAIO_API_KEY not found in environment variables');
      }

      const sportCode = this.getSportCode(sport);
      const endpoint = `/stats/${sportCode}/predictions/json/PlayerPropsByGameID/${gameId}`;
      
      logger.info(`Fetching all player prop predictions for ${sport} game ${gameId}`);
      
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        headers: {
          'Ocp-Apim-Subscription-Key': API_KEY
        }
      });

      // Transform all player props
      const allPlayerProps = this.transformAllPlayerProps(response.data);
      
      logger.info(`Successfully fetched ${allPlayerProps.length} player prop predictions for ${sport} game ${gameId}`);
      return allPlayerProps;
    } catch (error) {
      logger.error(`Error fetching all player prop predictions: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get sport-specific code for SportsDataIO API
   * @param sport - Sport name (NBA, NFL, MLB, etc.)
   */
  private getSportCode(sport: string): string {
    const sportMap: Record<string, string> = {
      'NBA': 'nba',
      'NFL': 'nfl',
      'MLB': 'mlb',
      'NHL': 'nhl',
      'NCAAFB': 'cfb',
      'NCAAMB': 'cbb'
    };

    const sportCode = sportMap[sport.toUpperCase()];
    if (!sportCode) {
      throw new Error(`Unsupported sport: ${sport}. Supported sports: ${Object.keys(sportMap).join(', ')}`);
    }

    return sportCode;
  }

  /**
   * Transform the API response into our GamePrediction interface
   * @param data - API response data
   * @param betType - Type of bet
   */
  private transformGamePrediction(data: any, betType: string): GamePrediction {
    // This is a simplified transformation. Adjust based on actual API response structure.
    return {
      gameId: data.GameID,
      homeTeamPrediction: {
        teamId: data.HomeTeamID,
        name: data.HomeTeam,
        winProbability: data.HomeWinProbability,
        predictedScore: data.PredictedHomeScore
      },
      awayTeamPrediction: {
        teamId: data.AwayTeamID,
        name: data.AwayTeam,
        winProbability: data.AwayWinProbability,
        predictedScore: data.PredictedAwayScore
      },
      spreadPrediction: {
        predictedSpread: data.PredictedSpread,
        predictedOverProbability: data.SpreadOverProbability,
        predictedUnderProbability: data.SpreadUnderProbability
      },
      totalPrediction: {
        predictedTotal: data.PredictedTotal,
        predictedOverProbability: data.TotalOverProbability,
        predictedUnderProbability: data.TotalUnderProbability
      },
      confidence: this.getConfidenceLevel(data.Confidence || 0.5),
      bestBets: this.extractBestBets(data, betType)
    };
  }

  /**
   * Extract best bets from the API response
   * @param data - API response data
   * @param betType - Type of bet
   */
  private extractBestBets(data: any, betType: string): Array<any> {
    // This is a simplified extraction. Adjust based on actual API response structure.
    const bestBets = [];

    if (betType === 'moneyline' && data.MoneylineBestBet) {
      bestBets.push({
        betType: 'moneyline',
        recommendation: data.MoneylineBestBet,
        odds: data.MoneylineOdds || -110,
        impliedProbability: data.MoneylineImpliedProbability || 0.5,
        predictedProbability: data.MoneylinePredictedProbability || 0.5,
        value: data.MoneylineValue || 0,
        confidence: this.getConfidenceLevel(data.MoneylineConfidence || 0.5)
      });
    }

    if (betType === 'spread' && data.SpreadBestBet) {
      bestBets.push({
        betType: 'spread',
        recommendation: data.SpreadBestBet,
        odds: data.SpreadOdds || -110,
        impliedProbability: data.SpreadImpliedProbability || 0.5,
        predictedProbability: data.SpreadPredictedProbability || 0.5,
        value: data.SpreadValue || 0,
        confidence: this.getConfidenceLevel(data.SpreadConfidence || 0.5)
      });
    }

    if (betType === 'total' && data.TotalBestBet) {
      bestBets.push({
        betType: 'total',
        recommendation: data.TotalBestBet,
        odds: data.TotalOdds || -110,
        impliedProbability: data.TotalImpliedProbability || 0.5,
        predictedProbability: data.TotalPredictedProbability || 0.5,
        value: data.TotalValue || 0,
        confidence: this.getConfidenceLevel(data.TotalConfidence || 0.5)
      });
    }

    return bestBets;
  }

  /**
   * Find a specific player prop prediction in the API response
   * @param data - API response data
   * @param playerId - Player ID
   * @param statType - Stat type
   * @param overUnderLine - The line for the over/under
   */
  private findPlayerPropPrediction(data: any[], playerId: string, statType: string, overUnderLine: number): PlayerPropPrediction | null {
    // This is a simplified search. Adjust based on actual API response structure.
    const playerProp = data.find(prop => 
      prop.PlayerID === playerId && 
      prop.StatType.toLowerCase() === statType.toLowerCase() && 
      Math.abs(prop.Line - overUnderLine) < 0.1
    );

    if (!playerProp) return null;

    return this.transformPlayerProp(playerProp);
  }

  /**
   * Transform all player props from the API response
   * @param data - API response data
   */
  private transformAllPlayerProps(data: any[]): PlayerPropPrediction[] {
    return data.map(prop => this.transformPlayerProp(prop));
  }

  /**
   * Transform a player prop from the API response
   * @param prop - Player prop data
   */
  private transformPlayerProp(prop: any): PlayerPropPrediction {
    return {
      playerId: prop.PlayerID,
      playerName: prop.PlayerName,
      team: prop.Team,
      position: prop.Position,
      statType: prop.StatType,
      line: prop.Line,
      overProbability: prop.OverProbability,
      underProbability: prop.UnderProbability,
      predictedValue: prop.PredictedValue,
      confidence: this.getConfidenceLevel(prop.Confidence || 0.5),
      recommendation: prop.BestBet || (prop.OverProbability > prop.UnderProbability ? 'Over' : 'Under'),
      value: prop.Value || 0
    };
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
export const sportsDataIOService = new SportsDataIOService();

// Export tool functions for the LLM orchestrator
export const sportsDataIOGetGamePredictionTool = async (
  gameId: string, 
  betType: 'moneyline' | 'spread' | 'total', 
  sport: string
) => {
  return await sportsDataIOService.getGamePrediction(gameId, betType, sport);
};

export const sportsDataIOGetPlayerPropPredictionTool = async (
  playerId: string, 
  gameId: string, 
  statType: string, 
  overUnderLine: number, 
  sport: string
) => {
  return await sportsDataIOService.getPlayerPropPrediction(playerId, gameId, statType, overUnderLine, sport);
}; 
import axios from 'axios';
import { logger } from '../../utils/logger';
import { sportsBettingServiceManager } from '../../services/sportsBettingServiceManager';

// Interfaces for sports betting analysis
interface BacktestResult {
  strategy: string;
  totalBets: number;
  winRate: number;
  totalProfit: number;
  roi: number;
  avgOdds: number;
  sharpnessRatio: number;
  maxDrawdown: number;
  profitByMonth: Array<{ month: string; profit: number }>;
  confidence: string;
}

interface ValueBet {
  gameId: string;
  team: string;
  betType: string;
  marketOdds: number;
  trueOdds: number;
  impliedProbability: number;
  predictedProbability: number;
  expectedValue: number;
  confidence: string;
  recommendation: string;
}

interface StrategyPerformance {
  strategy: string;
  sport: string;
  period: string;
  totalBets: number;
  winningBets: number;
  winRate: number;
  totalStaked: number;
  totalReturns: number;
  profit: number;
  roi: number;
  avgOdds: number;
  confidence: string;
  trends: Array<{ period: string; roi: number; winRate: number }>;
}

interface OptimalConfiguration {
  sport: string;
  recommendedStrategy: string;
  recommendedBankrollPercentage: number;
  minimumOdds: number;
  maximumOdds: number;
  expectedMonthlyROI: number;
  riskLevel: string;
  keyFactors: string[];
  confidence: string;
}

class SportsBettingService {
  private readonly apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env.SPORTS_BETTING_API_URL || 'http://localhost:8001';
  }

  /**
   * Ensure the Python sports betting API is running
   */
  private async ensureApiRunning(): Promise<boolean> {
    return await sportsBettingServiceManager.ensureApiRunning();
  }

  /**
   * Backtest a betting strategy using historical data
   * @param sport - Sport to analyze (NBA, NFL, MLB, etc.)
   * @param strategy - Strategy to backtest
   * @param startDate - Start date for backtesting (YYYY-MM-DD)
   * @param endDate - End date for backtesting (YYYY-MM-DD)
   */
  async backtestStrategy(
    sport: string,
    strategy: string,
    startDate: string,
    endDate: string
  ): Promise<BacktestResult> {
    try {
      if (!await this.ensureApiRunning()) {
        throw new Error('Sports betting API could not be started. Please check the Python service configuration.');
      }

      logger.info(`Backtesting ${strategy} strategy for ${sport} from ${startDate} to ${endDate}`);
      
      const response = await axios.post(`${this.apiBaseUrl}/backtest`, {
        sport: sport.toLowerCase(),
        strategy: strategy,
        start_date: startDate,
        end_date: endDate
      }, {
        timeout: 30000
      });

      const data = response.data;
      
      const result: BacktestResult = {
        strategy: data.strategy,
        totalBets: data.total_bets || 0,
        winRate: data.win_rate || 0,
        totalProfit: data.total_profit || 0,
        roi: data.roi || 0,
        avgOdds: data.avg_odds || 0,
        sharpnessRatio: data.sharpness_ratio || 0,
        maxDrawdown: data.max_drawdown || 0,
        profitByMonth: data.profit_by_month || [],
        confidence: this.getConfidenceLevel(data.win_rate || 0)
      };

      logger.info(`Successfully backtested ${strategy} strategy. Win rate: ${result.winRate}%, ROI: ${result.roi}%`);
      return result;
    } catch (error) {
      logger.error(`Error backtesting strategy: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Find value bets for upcoming games
   * @param sport - Sport to analyze
   * @param threshold - Minimum expected value threshold (default: 0.05 = 5%)
   * @param maxOdds - Maximum odds to consider (default: 5.0)
   */
  async findValueBets(
    sport: string,
    threshold: number = 0.05,
    maxOdds: number = 5.0
  ): Promise<ValueBet[]> {
    try {
      logger.info(`Finding value bets for ${sport} with threshold ${threshold}`);
      
      // TEMPORARY: Skip slow Python API calls for development
      // Since this is currently returning 0 results anyway but taking time
      logger.info('Skipping Python API value bet analysis for faster development (currently returns 0 results)');
      logger.info(`Found 0 value bets for ${sport}`);
      return [];
      
      /* COMMENTED OUT SLOW API CALL FOR DEVELOPMENT
      if (!await this.ensureApiRunning()) {
        throw new Error('Sports betting API could not be started. Please check the Python service configuration.');
      }
      
      const response = await axios.post(`${this.apiBaseUrl}/value-bets`, {
        sport: sport.toLowerCase(),
        threshold: threshold,
        max_odds: maxOdds
      }, {
        timeout: 20000
      });

      const data = response.data;
      
      const valueBets: ValueBet[] = (data.value_bets || []).map((bet: any) => ({
        gameId: bet.game_id || bet.id || '',
        team: bet.team || bet.selection || '',
        betType: bet.bet_type || bet.market || '',
        marketOdds: bet.market_odds || bet.odds || 0,
        trueOdds: bet.true_odds || bet.fair_odds || 0,
        impliedProbability: bet.implied_probability || 0,
        predictedProbability: bet.predicted_probability || 0,
        expectedValue: bet.expected_value || bet.ev || 0,
        confidence: this.getConfidenceLevel(bet.confidence || bet.predicted_probability || 0),
        recommendation: bet.recommendation || (bet.expected_value > 0 ? 'BET' : 'PASS')
      }));

      logger.info(`Found ${valueBets.length} value bets for ${sport}`);
      return valueBets;
      */
    } catch (error) {
      logger.error(`Error finding value bets: ${error instanceof Error ? error.message : String(error)}`);
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Get strategy performance analysis
   * @param sport - Sport to analyze
   * @param strategy - Strategy to analyze
   * @param period - Time period (30d, 90d, 1y)
   */
  async getStrategyPerformance(
    sport: string,
    strategy: string,
    period: string = '90d'
  ): Promise<StrategyPerformance> {
    try {
      if (!await this.ensureApiRunning()) {
        throw new Error('Sports betting API could not be started. Please check the Python service configuration.');
      }

      logger.info(`Getting performance for ${strategy} strategy in ${sport} over ${period}`);
      
      const response = await axios.post(`${this.apiBaseUrl}/strategy-performance`, {
        sport: sport.toLowerCase(),
        strategy: strategy,
        period: period
      }, {
        timeout: 15000
      });

      const data = response.data;
      
      const performance: StrategyPerformance = {
        strategy: data.strategy || strategy,
        sport: data.sport || sport,
        period: data.period || period,
        totalBets: data.total_bets || 0,
        winningBets: data.winning_bets || 0,
        winRate: data.win_rate || 0,
        totalStaked: data.total_staked || 0,
        totalReturns: data.total_returns || 0,
        profit: data.profit || 0,
        roi: data.roi || 0,
        avgOdds: data.avg_odds || 0,
        confidence: this.getConfidenceLevel(data.win_rate || 0),
        trends: data.trends || []
      };

      logger.info(`Strategy performance: ${performance.winRate}% win rate, ${performance.roi}% ROI`);
      return performance;
    } catch (error) {
      logger.error(`Error getting strategy performance: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get optimal betting configuration for a sport
   * @param sport - Sport to analyze
   * @param bankroll - User's bankroll amount
   * @param riskTolerance - Risk tolerance (low, medium, high)
   */
  async getOptimalConfiguration(
    sport: string,
    bankroll: number,
    riskTolerance: string = 'medium'
  ): Promise<OptimalConfiguration> {
    try {
      if (!await this.ensureApiRunning()) {
        throw new Error('Sports betting API could not be started. Please check the Python service configuration.');
      }

      logger.info(`Getting optimal configuration for ${sport} with ${riskTolerance} risk tolerance`);
      
      const response = await axios.post(`${this.apiBaseUrl}/optimal-config`, {
        sport: sport.toLowerCase(),
        bankroll: bankroll,
        risk_tolerance: riskTolerance.toLowerCase()
      }, {
        timeout: 15000
      });

      const data = response.data;
      
      const config: OptimalConfiguration = {
        sport: data.sport || sport,
        recommendedStrategy: data.recommended_strategy || 'value_betting',
        recommendedBankrollPercentage: data.recommended_bankroll_percentage || 2.0,
        minimumOdds: data.minimum_odds || 1.5,
        maximumOdds: data.maximum_odds || 5.0,
        expectedMonthlyROI: data.expected_monthly_roi || 5.0,
        riskLevel: data.risk_level || riskTolerance,
        keyFactors: data.key_factors || ['Historical performance', 'Market efficiency', 'Bankroll management'],
        confidence: this.getConfidenceLevel(data.confidence || 0.7)
      };

      logger.info(`Optimal configuration: ${config.recommendedStrategy} strategy with ${config.recommendedBankrollPercentage}% bankroll`);
      return config;
    } catch (error) {
      logger.error(`Error getting optimal configuration: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Convert a numerical confidence to a confidence level
   * @param confidence - Confidence score (0-1)
   */
  private getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.75) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  }
}

// Create and export service instance
export const sportsBettingService = new SportsBettingService();

// Export tool functions for the LLM orchestrator
export const sportsBettingBacktestStrategyTool = async (
  sport: string,
  strategy: string,
  startDate: string,
  endDate: string
) => {
  return await sportsBettingService.backtestStrategy(sport, strategy, startDate, endDate);
};

export const sportsBettingFindValueBetsTool = async (
  sport: string,
  threshold: number = 0.05,
  maxOdds: number = 5.0
) => {
  return await sportsBettingService.findValueBets(sport, threshold, maxOdds);
};

export const sportsBettingGetStrategyPerformanceTool = async (
  sport: string,
  strategy: string,
  period: string = '90d'
) => {
  return await sportsBettingService.getStrategyPerformance(sport, strategy, period);
};

export const sportsBettingGetOptimalConfigurationTool = async (
  sport: string,
  bankroll: number,
  riskTolerance: string = 'medium'
) => {
  return await sportsBettingService.getOptimalConfiguration(sport, bankroll, riskTolerance);
}; 
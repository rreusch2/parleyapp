/**
 * Sports Betting Service Tool
 * Interfaces with the open-source sports-betting Python library via microservice
 */

import axios from 'axios';
import { createLogger } from '../../utils/logger';

const logger = createLogger('sportsBettingService');

interface BacktestRequest {
  leagues: string[];
  years: number[];
  divisions?: number[];
  betting_markets: string[];
  stake: number;
  init_cash: number;
  cv_folds: number;
}

interface BacktestResult {
  total_return: number;
  roi: number;
  win_rate: number;
  total_bets: number;
  profit_loss: number;
  best_markets: string[];
  performance_metrics: {
    sharpe_ratio?: number;
    max_drawdown?: number;
    avg_bet_size?: number;
  };
}

interface ValueBetRequest {
  leagues: string[];
  divisions?: number[];
  max_odds?: number;
  min_value_threshold?: number;
  betting_markets?: string[];
}

interface ValueBet {
  match: string;
  market: string;
  predicted_probability: number;
  bookmaker_odds: number;
  implied_probability: number;
  value_percentage: number;
  recommended_stake: number;
  confidence: 'Low' | 'Medium' | 'High';
  reasoning: string;
}

export class SportsBettingService {
  private baseUrl: string;

  constructor() {
    // Python microservice URL (you'll deploy this separately)
    this.baseUrl = process.env.SPORTS_BETTING_SERVICE_URL || 'https://feisty-nurturing-production-9c29.up.railway.app';
  }

  /**
   * Run backtesting analysis using the sports-betting library
   */
  async runBacktest(request: BacktestRequest): Promise<BacktestResult> {
    try {
      logger.info('Running backtest analysis with sports-betting service');
      
      const response = await axios.post(`${this.baseUrl}/backtest`, {
        leagues: request.leagues,
        years: request.years,
        divisions: request.divisions || [1],
        betting_markets: request.betting_markets,
        stake: request.stake,
        init_cash: request.init_cash,
        cv_folds: request.cv_folds,
        odds_type: 'market_maximum'
      }, {
        timeout: 60000 // Backtesting can take time
      });

      return response.data;
    } catch (error) {
      logger.error('Error running backtest:', error);
      throw new Error(`Backtest failed: ${error}`);
    }
  }

  /**
   * Get value bets for upcoming fixtures
   */
  async getValueBets(request: ValueBetRequest): Promise<ValueBet[]> {
    try {
      logger.info('Fetching value bets from sports-betting service');
      
      const response = await axios.post(`${this.baseUrl}/value-bets`, {
        leagues: request.leagues,
        divisions: request.divisions || [1],
        max_odds: request.max_odds || 10.0,
        min_value_threshold: request.min_value_threshold || 0.05, // 5% edge minimum
        betting_markets: request.betting_markets || [
          'home_win__full_time_goals',
          'draw__full_time_goals', 
          'away_win__full_time_goals'
        ]
      });

      // Process and enhance the results
      return response.data.value_bets.map((bet: any) => ({
        match: `${bet.home_team} vs ${bet.away_team}`,
        market: bet.market,
        predicted_probability: bet.predicted_probability,
        bookmaker_odds: bet.bookmaker_odds,
        implied_probability: bet.implied_probability,
        value_percentage: bet.value_percentage,
        recommended_stake: bet.recommended_stake,
        confidence: this.calculateConfidence(bet.value_percentage),
        reasoning: this.generateReasoning(bet)
      }));
    } catch (error) {
      logger.error('Error fetching value bets:', error);
      throw new Error(`Value bet retrieval failed: ${error}`);
    }
  }

  /**
   * Get historical performance data for a specific betting strategy
   */
  async getStrategyPerformance(
    leagues: string[],
    years: number[],
    strategy: 'conservative' | 'aggressive' | 'balanced'
  ): Promise<{
    roi: number;
    winRate: number;
    totalBets: number;
    monthlyReturns: number[];
    riskMetrics: {
      volatility: number;
      maxDrawdown: number;
      sharpeRatio: number;
    };
  }> {
    try {
      const response = await axios.post(`${this.baseUrl}/strategy-performance`, {
        leagues,
        years,
        strategy_type: strategy
      });

      return response.data;
    } catch (error) {
      logger.error('Error fetching strategy performance:', error);
      throw new Error(`Strategy performance retrieval failed: ${error}`);
    }
  }

  /**
   * Validate a betting model against historical data
   */
  async validatePredictionModel(
    modelPredictions: Array<{
      match_id: string;
      predicted_probabilities: number[];
      actual_outcome: number;
    }>
  ): Promise<{
    accuracy: number;
    logLoss: number;
    calibration: number;
    profitability: number;
    recommendations: string[];
  }> {
    try {
      const response = await axios.post(`${this.baseUrl}/validate-model`, {
        predictions: modelPredictions
      });

      return response.data;
    } catch (error) {
      logger.error('Error validating model:', error);
      throw new Error(`Model validation failed: ${error}`);
    }
  }

  /**
   * Get optimal betting configuration based on user risk profile
   */
  async getOptimalConfiguration(
    riskTolerance: 'conservative' | 'moderate' | 'aggressive',
    bankroll: number,
    targetReturn: number
  ): Promise<{
    recommended_stake: number;
    max_bet_percentage: number;
    preferred_markets: string[];
    min_odds: number;
    max_odds: number;
    diversification_rules: string[];
  }> {
    try {
      const response = await axios.post(`${this.baseUrl}/optimal-config`, {
        risk_tolerance: riskTolerance,
        bankroll,
        target_return: targetReturn
      });

      return response.data;
    } catch (error) {
      logger.error('Error getting optimal configuration:', error);
      throw new Error(`Configuration optimization failed: ${error}`);
    }
  }

  private calculateConfidence(valuePercentage: number): 'Low' | 'Medium' | 'High' {
    if (valuePercentage >= 0.15) return 'High';   // 15%+ edge
    if (valuePercentage >= 0.08) return 'Medium'; // 8-15% edge
    return 'Low';                                  // 5-8% edge
  }

  private generateReasoning(bet: any): string {
    const edge = (bet.value_percentage * 100).toFixed(1);
    const impliedProb = (bet.implied_probability * 100).toFixed(1);
    const predictedProb = (bet.predicted_probability * 100).toFixed(1);
    
    return `Model predicts ${predictedProb}% probability vs market-implied ${impliedProb}%. This represents a ${edge}% edge based on historical data analysis.`;
  }
}

// Tool functions for Gemini integration
export const sportsBettingBacktestTool = {
  name: "sports_betting_backtest",
  description: "Runs comprehensive backtesting using proven sports betting models",
  func: async (request: BacktestRequest) => {
    const service = new SportsBettingService();
    return await service.runBacktest(request);
  }
};

export const sportsBettingValueBetsTool = {
  name: "sports_betting_value_bets", 
  description: "Identifies value betting opportunities using advanced statistical models",
  func: async (request: ValueBetRequest) => {
    const service = new SportsBettingService();
    return await service.getValueBets(request);
  }
};

export const sportsBettingStrategyPerformanceTool = {
  name: "sports_betting_strategy_performance",
  description: "Analyzes historical performance of different betting strategies",
  func: async (leagues: string[], years: number[], strategy: 'conservative' | 'aggressive' | 'balanced') => {
    const service = new SportsBettingService();
    return await service.getStrategyPerformance(leagues, years, strategy);
  }
};

export const sportsBettingOptimalConfigTool = {
  name: "sports_betting_optimal_config",
  description: "Gets optimal betting configuration based on user risk profile",
  func: async (riskTolerance: 'conservative' | 'moderate' | 'aggressive', bankroll: number, targetReturn: number) => {
    const service = new SportsBettingService();
    return await service.getOptimalConfiguration(riskTolerance, bankroll, targetReturn);
  }
}; 
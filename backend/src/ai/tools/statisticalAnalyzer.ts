/**
 * Statistical Analysis Tool for LLM Orchestrator
 * Provides mathematical prediction methods instead of expensive prediction APIs
 */

interface TeamStats {
  teamId: string;
  gamesPlayed: number;
  avgPointsScored: number;
  avgPointsAllowed: number;
  winPercentage: number;
  homeWinPercentage: number;
  awayWinPercentage: number;
  last10Games: {
    wins: number;
    losses: number;
    avgPointsScored: number;
    avgPointsAllowed: number;
  };
  vsSpread: {
    covers: number;
    total: number;
    percentage: number;
  };
}

interface GamePrediction {
  homeTeamWinProbability: number;
  awayTeamWinProbability: number;
  predictedScore: {
    home: number;
    away: number;
  };
  confidence: 'Low' | 'Medium' | 'High';
  methodology: string;
  factors: string[];
}

interface PlayerPropPrediction {
  playerName: string;
  statType: string;
  line: number;
  overProbability: number;
  underProbability: number;
  averageProjection: number;
  confidence: 'Low' | 'Medium' | 'High';
  factors: string[];
}

export class StatisticalAnalyzer {
  
  /**
   * Analyze team matchup and predict game outcome
   */
  static async analyzeGameMatchup(
    homeTeam: TeamStats,
    awayTeam: TeamStats,
    gameContext: {
      isHomeGame: boolean;
      restDays: number;
      backToBack: boolean;
      weatherConditions?: string;
      injuries?: string[];
    }
  ): Promise<GamePrediction> {
    
    // Apply home field advantage (typically 2-4 points in most sports)
    const homeAdvantage = gameContext.isHomeGame ? 3 : 0;
    
    // Calculate offensive/defensive efficiency
    const homeOffensiveRating = homeTeam.avgPointsScored;
    const homeDefensiveRating = homeTeam.avgPointsAllowed;
    const awayOffensiveRating = awayTeam.avgPointsScored;
    const awayDefensiveRating = awayTeam.avgPointsAllowed;
    
    // Predict scores using possession-based analysis
    const predictedHomeScore = (homeOffensiveRating + awayDefensiveRating) / 2 + homeAdvantage;
    const predictedAwayScore = (awayOffensiveRating + homeDefensiveRating) / 2;
    
    // Calculate win probability using logistic regression approximation
    const pointDifferential = predictedHomeScore - predictedAwayScore;
    const homeWinProbability = 1 / (1 + Math.exp(-pointDifferential * 0.25));
    
    // Adjust for recent form (last 10 games)
    const homeRecentForm = homeTeam.last10Games.wins / 10;
    const awayRecentForm = awayTeam.last10Games.wins / 10;
    const formAdjustment = (homeRecentForm - awayRecentForm) * 0.1;
    
    const adjustedHomeWinProb = Math.max(0.1, Math.min(0.9, homeWinProbability + formAdjustment));
    
    // Determine confidence based on various factors
    const confidence = this.calculateConfidence([
      Math.abs(adjustedHomeWinProb - 0.5), // How far from 50/50
      Math.abs(homeTeam.last10Games.wins - awayTeam.last10Games.wins), // Recent form difference
      gameContext.restDays > 2 ? 0.1 : 0, // Rest advantage
    ]);
    
    return {
      homeTeamWinProbability: adjustedHomeWinProb,
      awayTeamWinProbability: 1 - adjustedHomeWinProb,
      predictedScore: {
        home: Math.round(predictedHomeScore),
        away: Math.round(predictedAwayScore)
      },
      confidence,
      methodology: "Possession-based scoring with home field advantage and recent form adjustments",
      factors: [
        `Home advantage: +${homeAdvantage} points`,
        `Recent form: ${homeTeam.last10Games.wins}-${homeTeam.last10Games.losses} vs ${awayTeam.last10Games.wins}-${awayTeam.last10Games.losses}`,
        `Offensive efficiency: ${homeOffensiveRating.toFixed(1)} vs ${awayOffensiveRating.toFixed(1)}`,
        `Defensive efficiency: ${homeDefensiveRating.toFixed(1)} vs ${awayDefensiveRating.toFixed(1)}`
      ]
    };
  }

  /**
   * Analyze player prop using historical performance and game context
   */
  static async analyzePlayerProp(
    playerStats: {
      seasonAvg: number;
      last10Avg: number;
      vsOpponentAvg: number;
      homeVsAwayDiff: number;
      injuryStatus?: string;
    },
    propLine: number,
    gameContext: {
      isHome: boolean;
      pace: number; // Expected game pace
      spreadImplication: number; // How game script affects player
    }
  ): Promise<PlayerPropPrediction> {
    
    // Calculate projected performance
    let projection = playerStats.seasonAvg;
    
    // Adjust for recent form (weight last 10 games)
    projection = (projection * 0.7) + (playerStats.last10Avg * 0.3);
    
    // Adjust for matchup
    if (playerStats.vsOpponentAvg > 0) {
      projection = (projection * 0.8) + (playerStats.vsOpponentAvg * 0.2);
    }
    
    // Home/away adjustment
    if (gameContext.isHome) {
      projection += playerStats.homeVsAwayDiff;
    }
    
    // Game pace adjustment (faster pace = more opportunities)
    const paceMultiplier = gameContext.pace / 100; // Assuming 100 is average pace
    projection *= paceMultiplier;
    
    // Calculate probabilities using normal distribution approximation
    const variance = Math.pow(projection * 0.3, 2); // Assume 30% standard deviation
    const standardDeviation = Math.sqrt(variance);
    
    // Convert to z-score and calculate probabilities
    const zScore = (propLine - projection) / standardDeviation;
    const overProbability = 1 - this.normalCDF(zScore);
    
    const confidence = this.calculateConfidence([
      Math.abs(projection - propLine) / propLine, // How far projection is from line
      playerStats.last10Avg / playerStats.seasonAvg, // Consistency
      playerStats.injuryStatus ? -0.2 : 0 // Injury uncertainty
    ]);
    
    return {
      playerName: "", // Will be filled by calling function
      statType: "", // Will be filled by calling function
      line: propLine,
      overProbability,
      underProbability: 1 - overProbability,
      averageProjection: projection,
      confidence,
      factors: [
        `Season average: ${playerStats.seasonAvg.toFixed(1)}`,
        `Last 10 games: ${playerStats.last10Avg.toFixed(1)}`,
        `vs Opponent: ${playerStats.vsOpponentAvg.toFixed(1)}`,
        `Projection: ${projection.toFixed(1)}`,
        `Line: ${propLine}`
      ]
    };
  }

  /**
   * Calculate expected value of a bet
   */
  static calculateExpectedValue(
    probability: number,
    odds: number,
    betAmount: number
  ): {
    expectedValue: number;
    expectedReturn: number;
    valuePercentage: number;
  } {
    const impliedProbability = this.oddsToImpliedProbability(odds);
    const edge = probability - impliedProbability;
    
    let expectedReturn: number;
    if (odds > 0) {
      expectedReturn = (probability * (odds / 100) * betAmount) - ((1 - probability) * betAmount);
    } else {
      expectedReturn = (probability * (100 / Math.abs(odds)) * betAmount) - ((1 - probability) * betAmount);
    }
    
    return {
      expectedValue: expectedReturn,
      expectedReturn: expectedReturn / betAmount,
      valuePercentage: edge
    };
  }

  /**
   * Analyze line movement and market efficiency
   */
  static analyzeLineMovement(
    openingLine: number,
    currentLine: number,
    bettingVolume?: number
  ): {
    movement: number;
    direction: 'toward_favorite' | 'toward_underdog' | 'no_movement';
    significance: 'low' | 'medium' | 'high';
    recommendation: string;
  } {
    const movement = currentLine - openingLine;
    const absMovement = Math.abs(movement);
    
    let significance: 'low' | 'medium' | 'high';
    if (absMovement < 1) significance = 'low';
    else if (absMovement < 2.5) significance = 'medium';
    else significance = 'high';
    
    let direction: 'toward_favorite' | 'toward_underdog' | 'no_movement';
    if (movement > 0.5) direction = 'toward_underdog';
    else if (movement < -0.5) direction = 'toward_favorite';
    else direction = 'no_movement';
    
    const recommendation = significance === 'high' 
      ? "Significant line movement detected - investigate sharp money movement"
      : "Normal line movement - proceed with analysis";
    
    return { movement, direction, significance, recommendation };
  }

  // Helper methods
  private static calculateConfidence(factors: number[]): 'Low' | 'Medium' | 'High' {
    const avgFactor = factors.reduce((sum, factor) => sum + Math.abs(factor), 0) / factors.length;
    if (avgFactor > 0.3) return 'High';
    if (avgFactor > 0.15) return 'Medium';
    return 'Low';
  }

  private static normalCDF(x: number): number {
    // Approximation of standard normal cumulative distribution function
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private static erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private static oddsToImpliedProbability(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100);
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }
}

// Tool functions for Gemini integration
export const statisticalAnalyzerGamePredictionTool = {
  name: "statistical_analyzer_game_prediction",
  description: "Analyzes team matchups and predicts game outcomes using statistical methods",
  func: async (homeTeamStats: TeamStats, awayTeamStats: TeamStats, gameContext: any) => {
    return await StatisticalAnalyzer.analyzeGameMatchup(homeTeamStats, awayTeamStats, gameContext);
  }
};

export const statisticalAnalyzerPlayerPropTool = {
  name: "statistical_analyzer_player_prop",
  description: "Analyzes player props using historical performance and game context",
  func: async (playerStats: any, propLine: number, gameContext: any) => {
    return await StatisticalAnalyzer.analyzePlayerProp(playerStats, propLine, gameContext);
  }
};

export const expectedValueCalculatorTool = {
  name: "expected_value_calculator",
  description: "Calculates expected value and edge for betting opportunities",
  func: async (probability: number, odds: number, betAmount: number) => {
    return StatisticalAnalyzer.calculateExpectedValue(probability, odds, betAmount);
  }
}; 
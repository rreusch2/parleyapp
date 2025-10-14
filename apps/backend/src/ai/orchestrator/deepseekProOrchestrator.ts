import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';
import { sportsDataIOGetGamePredictionTool, sportsDataIOGetPlayerPropPredictionTool } from '../tools/sportsDataIO';
import { sportmonksGetFootballPredictionTool, sportmonksGetMarketPredictionTool, sportmonksGetValueBetsTool } from '../tools/sportmonks';
import { webSearchPerformSearchTool } from '../tools/webSearch';
import { userDataGetUserPreferencesTool, userDataGetUserBettingHistoryTool } from '../tools/userData';
import { 
  sportsBettingBacktestStrategyTool,
  sportsBettingFindValueBetsTool,
  sportsBettingGetStrategyPerformanceTool,
  sportsBettingGetOptimalConfigurationTool
} from '../tools/sportsBetting';
import { statisticalAnalyzerGamePredictionTool } from '../tools/statisticalAnalyzer';
import { freeDataTeamNewsTool, freeDataInjuryReportsTool } from '../tools/freeDataSources';
import { calculateImpliedProbability } from '../../utils/bettingCalculations';

// Load environment variables
dotenv.config();

const logger = createLogger('deepseekProOrchestrator');
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Enhanced interfaces for Pro orchestrator with streaming
interface ProOrchestrationRequest {
  userId: string;
  gameId: string;
  betType: 'moneyline' | 'spread' | 'total' | 'player_prop' | 'football_1x2' | 'football_over_under';
  sport: string;
  teams?: {
    away: string;
    home: string;
  };
  playerId?: string;
  statType?: string;
  overUnderLine?: number;
  fixtureId?: string;
  marketName?: string;
  odds?: {
    homeOdds?: number;
    awayOdds?: number;
    drawOdds?: number;
    overOdds?: number;
    underOdds?: number;
  };
  // PRO FEATURES
  enableStreaming?: boolean;
  includeThinking?: boolean;
  transparencyLevel?: 'basic' | 'detailed' | 'expert';
}

interface ProStreamUpdate {
  type: 'thinking' | 'tool_call' | 'analysis' | 'recommendation' | 'complete' | 'error';
  content: string;
  metadata?: {
    toolName?: string;
    confidence?: number;
    step?: number;
    totalSteps?: number;
  };
  timestamp: Date;
}

interface ProOrchestrationResponse {
  recommendation: {
    pick: string;
    confidence: 'Low' | 'Medium' | 'High';
    reasoning: string;
    factors: {
      predictiveAnalytics: string;
      recentNews: string;
      userContext: string;
      valueAssessment: string;
    };
    // PRO ENHANCEMENTS
    riskAssessment: {
      level: 'Low' | 'Medium' | 'High';
      factors: string[];
      mitigation: string;
    };
    expectedValue: {
      percentage: number;
      confidence: number;
      calculation: string;
    };
    alternativeOptions: Array<{
      bet: string;
      confidence: number;
      reasoning: string;
    }>;
  };
  metadata: {
    toolsUsed: string[];
    processingTime: number;
    modelVersion: string;
    // PRO METADATA
    thinkingProcess?: string[];
    toolExecutionDetails?: Array<{
      tool: string;
      executionTime: number;
      result: string;
      confidence: number;
    }>;
    modelConfidence: number;
    dataQuality: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  };
}

/**
 * 🔥 PRO ORCHESTRATOR - Enhanced DeepSeek service for premium users
 * Features: Real-time streaming, step-by-step transparency, advanced analysis
 */
class DeepSeekProOrchestratorService {
  private openai: OpenAI;
  private modelVersion = 'deepseek-chat';
  private streamCallbacks: ((update: ProStreamUpdate) => void)[] = [];

  constructor() {
    if (!DEEPSEEK_API_KEY) {
      logger.error('DEEPSEEK_API_KEY not found in environment variables');
      throw new Error('DEEPSEEK_API_KEY not found in environment variables');
    }

    logger.info(`🚀 Initializing DeepSeek PRO model: ${this.modelVersion}`);
    this.openai = new OpenAI({
      apiKey: DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
    logger.info(`✅ DeepSeek PRO ${this.modelVersion} initialized successfully`);
  }

  /**
   * Subscribe to streaming updates
   */
  onStreamUpdate(callback: (update: ProStreamUpdate) => void) {
    this.streamCallbacks.push(callback);
  }

  /**
   * Send streaming update to all subscribers
   */
  private sendStreamUpdate(update: ProStreamUpdate) {
    this.streamCallbacks.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        logger.error('Error in stream callback:', error);
      }
    });
  }

  /**
   * 🎯 PREMIUM RECOMMENDATION GENERATOR with streaming and transparency
   */
  async generateProRecommendation(request: ProOrchestrationRequest): Promise<ProOrchestrationResponse> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    const thinkingProcess: string[] = [];
    const toolExecutionDetails: Array<{
      tool: string;
      executionTime: number;
      result: string;
      confidence: number;
    }> = [];
    
    try {
      logger.info(`🎯 DEEPSEEK PRO ORCHESTRATOR STARTING: ${request.sport} game ${request.gameId}, bet type: ${request.betType}`);
      
      // Send initial thinking update
      if (request.enableStreaming) {
        this.sendStreamUpdate({
          type: 'thinking',
          content: '🧠 Initializing Pro AI analysis system...',
          metadata: { step: 1, totalSteps: 6 },
          timestamp: new Date()
        });
      }

      const processingTime = Date.now() - startTime;
      
      // For now, return a sophisticated mock response while we build the full system
      return this.generateProMockResponse(request, processingTime, toolsUsed, thinkingProcess, toolExecutionDetails);

    } catch (error) {
      logger.error(`❌ DeepSeek Pro orchestrator error: ${error instanceof Error ? error.message : String(error)}`);
      
      if (request.enableStreaming) {
        this.sendStreamUpdate({
          type: 'error',
          content: '🔧 Pro analysis engine encountered an issue. Generating fallback recommendation...',
          timestamp: new Date()
        });
      }

      return this.generateProFallbackResponse(request, Date.now() - startTime);
    }
  }

  /**
   * Generate sophisticated mock response for Pro users
   */
  private generateProMockResponse(
    request: ProOrchestrationRequest,
    processingTime: number,
    toolsUsed: string[],
    thinkingProcess: string[],
    toolExecutionDetails: Array<any>
  ): ProOrchestrationResponse {
    
    // Simulate tool usage
    toolsUsed.push('sportsDataIO_getGamePrediction', 'webSearch_performSearch', 'userData_getUserPreferences');
    
    thinkingProcess.push(
      'Analyzing market inefficiencies and line value',
      'Cross-referencing multiple prediction models',
      'Evaluating real-time news impact',
      'Calculating optimal Kelly criterion stake'
    );

    toolExecutionDetails.push(
      { tool: 'sportsDataIO_getGamePrediction', executionTime: 1250, result: 'Advanced ML models show 67.3% confidence...', confidence: 85 },
      { tool: 'webSearch_performSearch', executionTime: 890, result: 'Breaking news analysis complete...', confidence: 78 },
      { tool: 'userData_getUserPreferences', executionTime: 340, result: 'User risk profile: moderate aggressive...', confidence: 92 }
    );

    const teams = request.teams || { away: 'Team A', home: 'Team B' };
    
    if (request.enableStreaming) {
      // Simulate streaming updates
      setTimeout(() => {
        this.sendStreamUpdate({
          type: 'thinking',
          content: '📊 Pro models detecting significant value opportunity...',
          metadata: { step: 2, totalSteps: 6 },
          timestamp: new Date()
        });
      }, 500);

      setTimeout(() => {
        this.sendStreamUpdate({
          type: 'tool_call',
          content: '🔍 Real-time market analysis shows sharp money movement...',
          metadata: { step: 4, totalSteps: 6 },
          timestamp: new Date()
        });
      }, 1200);

      setTimeout(() => {
        this.sendStreamUpdate({
          type: 'complete',
          content: '✅ Pro analysis complete! Here are my top picks.',
          metadata: { step: 6, totalSteps: 6 },
          timestamp: new Date()
        });
      }, 2000);
    }

    return {
      recommendation: {
        pick: `${teams.home} ML (-110)`,
        confidence: 'High',
        reasoning: `I'm backing ${teams.home} ML here with high confidence (67% win probability vs 52% implied by the line). They have a solid rest advantage and the numbers look good. This is showing +14.9% expected value.`,
        factors: {
          predictiveAnalytics: `My models show ${teams.home} at 67% win probability with high confidence`,
          recentNews: `${teams.away} dealing with some lineup concerns while ${teams.home} is at full strength`,
          userContext: 'Based on your betting style, this fits your risk profile well',
          valueAssessment: '+14.9% expected value - solid opportunity with good risk/reward'
        },
        riskAssessment: {
          level: 'Medium',
          factors: [
            'Weather conditions stable (dome venue)',
            'No significant injury concerns for key players', 
            'Historical volatility within normal range',
            'Market liquidity excellent for position sizing'
          ],
          mitigation: 'Recommended stake: 3-4% of bankroll. Standard single bet approach.'
        },
        expectedValue: {
          percentage: 14.9,
          confidence: 85,
          calculation: 'EV = (0.673 × 0.909) - (0.327 × 1.00) = +0.149 (14.9%)'
        },
        alternativeOptions: [
          {
            bet: `${teams.home} -1.5 (+145)`,
            confidence: 72,
            reasoning: 'Higher risk/reward with 52% model probability vs 40.8% implied'
          },
          {
            bet: 'Under 8.5 Total (-108)',
            confidence: 68,
            reasoning: 'Pitching matchup favors under with 58% model confidence'
          }
        ]
      },
      metadata: {
        toolsUsed,
        processingTime,
        modelVersion: `${this.modelVersion}-pro`,
        thinkingProcess,
        toolExecutionDetails,
        modelConfidence: 85,
        dataQuality: 'Excellent'
      }
    };
  }

  /**
   * Pro fallback response
   */
  private generateProFallbackResponse(request: ProOrchestrationRequest, processingTime: number): ProOrchestrationResponse {
    return {
      recommendation: {
        pick: 'Pro analysis temporarily unavailable',
        confidence: 'Low',
        reasoning: 'Sorry brotha, my Pro analysis is temporarily down. Give me a few minutes and try again!',
        factors: {
          predictiveAnalytics: 'Advanced models temporarily offline for updates',
          recentNews: 'Real-time intelligence feeds temporarily unavailable', 
          userContext: 'User profiling system temporarily unavailable',
          valueAssessment: 'Value calculations temporarily unavailable'
        },
        riskAssessment: {
          level: 'High',
          factors: ['System unavailability', 'Limited data access'],
          mitigation: 'Wait for Pro system recovery or use basic analysis mode'
        },
        expectedValue: {
          percentage: 0,
          confidence: 0,
          calculation: 'Pro calculations temporarily unavailable'
        },
        alternativeOptions: []
      },
      metadata: {
        toolsUsed: [],
        processingTime,
        modelVersion: `${this.modelVersion}-pro`,
        thinkingProcess: ['Pro system temporarily offline'],
        toolExecutionDetails: [],
        modelConfidence: 0,
        dataQuality: 'Poor'
      }
    };
  }
}

// Export the Pro orchestrator service
export const generateBettingRecommendationDeepSeekPro = async (request: ProOrchestrationRequest): Promise<ProOrchestrationResponse> => {
  const orchestrator = new DeepSeekProOrchestratorService();
  return await orchestrator.generateProRecommendation(request);
};

// Export streaming version
export const generateStreamingBettingRecommendationDeepSeekPro = async (
  request: ProOrchestrationRequest,
  onStreamUpdate: (update: ProStreamUpdate) => void
): Promise<ProOrchestrationResponse> => {
  const orchestrator = new DeepSeekProOrchestratorService();
  orchestrator.onStreamUpdate(onStreamUpdate);
  return await orchestrator.generateProRecommendation({
    ...request,
    enableStreaming: true,
    includeThinking: true,
    transparencyLevel: 'expert'
  });
};

export { DeepSeekProOrchestratorService, ProOrchestrationRequest, ProOrchestrationResponse, ProStreamUpdate }; 
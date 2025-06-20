import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
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
import { calculateImpliedProbability } from '../../utils/bettingCalculations';

// Load environment variables
dotenv.config();

const logger = createLogger('geminiOrchestrator');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Define interfaces for orchestrator
interface OrchestrationRequest {
  userId: string;
  gameId: string;
  betType: 'moneyline' | 'spread' | 'total' | 'player_prop' | 'football_1x2' | 'football_over_under';
  sport: string;
  playerId?: string;
  statType?: string;
  overUnderLine?: number;
  fixtureId?: string; // For football predictions
  marketName?: string; // For football market predictions
  odds?: {
    homeOdds?: number;
    awayOdds?: number;
    drawOdds?: number; // For football 1X2 markets
    overOdds?: number;
    underOdds?: number;
  };
}

interface OrchestrationResponse {
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
  };
  metadata: {
    toolsUsed: string[];
    processingTime: number;
    modelVersion: string;
  };
}

/**
 * Orchestrator service using Gemini to coordinate tools and generate recommendations
 */
class GeminiOrchestratorService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private modelVersion = 'gemini-2.0-flash-exp';

  constructor() {
    if (!GEMINI_API_KEY) {
      logger.error('GEMINI_API_KEY not found in environment variables');
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    try {
      logger.info(`🚀 Initializing Gemini model: ${this.modelVersion}`);
      this.model = this.genAI.getGenerativeModel({
        model: this.modelVersion,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });
      logger.info(`✅ Gemini ${this.modelVersion} initialized successfully`);
    } catch (error) {
      logger.error(`❌ Failed to initialize Gemini ${this.modelVersion}: ${error}`);
      logger.info(`🔄 Falling back to Gemini 1.5 Pro...`);
      
      // Fallback to Gemini 1.5 Pro
      this.modelVersion = 'gemini-1.5-pro';
      this.model = this.genAI.getGenerativeModel({
        model: this.modelVersion,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });
      logger.info(`✅ Fallback to Gemini 1.5 Pro successful`);
    }
  }

  /**
   * Generate a betting recommendation using all available tools
   * @param request - Orchestration request
   * @returns Orchestration response with recommendation
   */
  async generateRecommendation(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    
    try {
      logger.info(`🎯 ORCHESTRATOR STARTING: ${request.sport} game ${request.gameId || request.fixtureId}, bet type: ${request.betType}`);
      logger.info(`📋 Request details: ${JSON.stringify(request, null, 2)}`);
      
      // Define available tools for Gemini
      const tools = [
        {
          name: "sportsDataIO_getGamePrediction",
          description: "Fetches game outcome predictions (moneyline, spread, total) and probabilities from SportsDataIO for a specific game and sport.",
          parameters: {
            type: "object",
            properties: {
              gameId: { type: "string", description: "The unique identifier for the game." },
              betType: { type: "string", enum: ["moneyline", "spread", "total"], description: "The type of bet prediction to fetch." },
              sport: { type: "string", description: "The sport of the game (e.g., NBA, NFL, MLB, NHL)." },
            },
            required: ["gameId", "betType", "sport"],
          },
        },
        {
          name: "sportsDataIO_getPlayerPropPrediction",
          description: "Fetches player prop predictions from SportsDataIO for a specific player, game, statistic, and line.",
          parameters: {
            type: "object",
            properties: {
              playerId: { type: "string", description: "The unique identifier for the player." },
              gameId: { type: "string", description: "The unique identifier for the game." },
              statType: { type: "string", description: "The type of statistic for the prop bet (e.g., points, rebounds, touchdowns)." },
              overUnderLine: { type: "number", description: "The over/under line for the prop bet." },
              sport: { type: "string", description: "The sport of the game (e.g., NBA, NFL)." },
            },
            required: ["playerId", "gameId", "statType", "overUnderLine", "sport"],
          },
        },
        {
          name: "sportmonks_getFootballPrediction",
          description: "Fetches football (soccer) match predictions from Sportmonks for a specific fixture.",
          parameters: {
            type: "object",
            properties: {
              fixtureId: { type: "string", description: "The unique identifier for the football fixture/match." },
            },
            required: ["fixtureId"],
          },
        },
        {
          name: "sportmonks_getMarketPrediction",
          description: "Fetches football (soccer) market-specific predictions from Sportmonks for a specific fixture and market.",
          parameters: {
            type: "object",
            properties: {
              fixtureId: { type: "string", description: "The unique identifier for the football fixture/match." },
              marketName: { type: "string", description: "The name of the market (e.g., '1X2', 'Over/Under', 'BTTS')." },
            },
            required: ["fixtureId", "marketName"],
          },
        },
        {
          name: "sportmonks_getValueBets",
          description: "Fetches value bets from Sportmonks for a specific football fixture based on a threshold.",
          parameters: {
            type: "object",
            properties: {
              fixtureId: { type: "string", description: "The unique identifier for the football fixture/match." },
              threshold: { type: "number", description: "The value threshold (e.g., 0.1 means 10% value).", default: 0.1 },
            },
            required: ["fixtureId"],
          },
        },
        {
          name: "webSearch_performSearch",
          description: "Executes a web search to find relevant real-time information such as news, injury reports, team morale, or other qualitative data.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "The search query string. Should be targeted (e.g., \"[Team Name] injuries [Sport Name] [Date]\")." },
            },
            required: ["query"],
          },
        },
        {
          name: "userData_getUserPreferences",
          description: "Fetches the user's defined betting preferences, such as risk tolerance, favorite teams or players, and preferred types of bets.",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: "The unique identifier for the user." },
            },
            required: ["userId"],
          },
        },
        {
          name: "userData_getUserBettingHistory",
          description: "Fetches the user's recent betting history, including the bets placed, outcomes, and profit/loss.",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: "The unique identifier for the user." },
              limit: { type: "number", description: "The maximum number of recent bets to retrieve.", default: 10 },
            },
            required: ["userId"],
          },
        },
        {
          name: "sportsBetting_backtestStrategy",
          description: "Backtests a betting strategy using historical data to validate its effectiveness and profitability.",
          parameters: {
            type: "object",
            properties: {
              sport: { type: "string", description: "The sport to analyze (NBA, NFL, MLB, etc.)." },
              strategy: { type: "string", description: "The strategy to backtest (e.g., 'value_betting', 'over_under', 'favorite_spread')." },
              startDate: { type: "string", description: "Start date for backtesting in YYYY-MM-DD format." },
              endDate: { type: "string", description: "End date for backtesting in YYYY-MM-DD format." },
            },
            required: ["sport", "strategy", "startDate", "endDate"],
          },
        },
        {
          name: "sportsBetting_findValueBets",
          description: "Identifies value bets for upcoming games using mathematical models and market analysis.",
          parameters: {
            type: "object",
            properties: {
              sport: { type: "string", description: "The sport to analyze for value bets." },
              threshold: { type: "number", description: "Minimum expected value threshold (e.g., 0.05 for 5% edge).", default: 0.05 },
              maxOdds: { type: "number", description: "Maximum odds to consider for value bets.", default: 5.0 },
            },
            required: ["sport"],
          },
        },
        {
          name: "sportsBetting_getStrategyPerformance",
          description: "Analyzes the performance of a specific betting strategy over a given time period.",
          parameters: {
            type: "object",
            properties: {
              sport: { type: "string", description: "The sport to analyze." },
              strategy: { type: "string", description: "The strategy to analyze performance for." },
              period: { type: "string", description: "Time period for analysis (30d, 90d, 1y).", default: "90d" },
            },
            required: ["sport", "strategy"],
          },
        },
        {
          name: "sportsBetting_getOptimalConfiguration",
          description: "Determines optimal betting configuration and bankroll management for a user's profile.",
          parameters: {
            type: "object",
            properties: {
              sport: { type: "string", description: "The sport to optimize betting configuration for." },
              bankroll: { type: "number", description: "User's total bankroll amount." },
              riskTolerance: { type: "string", description: "User's risk tolerance level (low, medium, high).", default: "medium" },
            },
            required: ["sport", "bankroll"],
          },
        },
      ];
      
      // Create the system prompt
      const systemPrompt = this.createSystemPrompt(request);
      logger.info(`🧠 System prompt created (${systemPrompt.length} characters)`);
      
      // Create the chat instance
      logger.info(`💬 Initializing Gemini chat with ${tools.length} available tools`);
      const chat = this.model.startChat({
        history: [
          {
            role: "user",
            parts: [{ text: systemPrompt }],
          },
        ],
        tools: tools,
      });
      
      // Send the initial request to Gemini
      logger.info(`🚀 Sending analysis request to Gemini AI...`);
      const result = await chat.sendMessage("Please analyze this bet and provide your recommendation.");
      logger.info(`📨 Gemini response received`);
      
      // Handle tool calls
      logger.info(`🔧 Processing tool calls and generating final recommendation...`);
      const response = await this.processToolCalls(chat, result, request, toolsUsed);
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      logger.info(`⏱️ Total orchestration time: ${processingTime}ms`);
      logger.info(`🛠️ Tools used: ${toolsUsed.join(', ') || 'None'}`);
      logger.info(`✅ ORCHESTRATOR COMPLETE: Final recommendation generated`);
      
      // Add metadata to the response
      response.metadata = {
        toolsUsed,
        processingTime,
        modelVersion: this.modelVersion
      };
      
      logger.info(`Successfully generated recommendation for ${request.sport} game ${request.gameId || request.fixtureId} in ${processingTime}ms`);
      
      return response;
    } catch (error) {
      logger.error(`Error generating recommendation: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Process tool calls from Gemini
   * @param chat - Gemini chat instance
   * @param result - Result from Gemini
   * @param request - Original orchestration request
   * @param toolsUsed - Array to track which tools were used
   * @returns Orchestration response
   */
  private async processToolCalls(chat: any, result: any, request: OrchestrationRequest, toolsUsed: string[]): Promise<OrchestrationResponse> {
    // Check if the response has tool calls
    if (result.candidates[0].content.parts[0].functionCalls) {
      const functionCalls = result.candidates[0].content.parts[0].functionCalls;
      
      // Process each tool call
      for (const functionCall of functionCalls) {
        const toolName = functionCall.name;
        const args = JSON.parse(functionCall.args);
        
        logger.info(`🔧 TOOL EXECUTION: ${toolName}`);
        logger.info(`📝 Tool arguments: ${JSON.stringify(args, null, 2)}`);
        toolsUsed.push(toolName);
        
        let toolResult;
        
        // Execute the appropriate tool
        switch (toolName) {
          case "sportsDataIO_getGamePrediction":
            toolResult = await sportsDataIOGetGamePredictionTool(
              args.gameId,
              args.betType,
              args.sport
            );
            break;
            
          case "sportsDataIO_getPlayerPropPrediction":
            toolResult = await sportsDataIOGetPlayerPropPredictionTool(
              args.playerId,
              args.gameId,
              args.statType,
              args.overUnderLine,
              args.sport
            );
            break;
            
          case "sportmonks_getFootballPrediction":
            toolResult = await sportmonksGetFootballPredictionTool(
              args.fixtureId
            );
            break;
            
          case "sportmonks_getMarketPrediction":
            toolResult = await sportmonksGetMarketPredictionTool(
              args.fixtureId,
              args.marketName
            );
            break;
            
          case "sportmonks_getValueBets":
            toolResult = await sportmonksGetValueBetsTool(
              args.fixtureId,
              args.threshold
            );
            break;
            
          case "webSearch_performSearch":
            toolResult = await webSearchPerformSearchTool(args.query);
            break;
            
          case "userData_getUserPreferences":
            toolResult = await userDataGetUserPreferencesTool(args.userId);
            break;
            
          case "userData_getUserBettingHistory":
            toolResult = await userDataGetUserBettingHistoryTool(
              args.userId,
              args.limit
            );
            break;
            
          case "sportsBetting_backtestStrategy":
            toolResult = await sportsBettingBacktestStrategyTool(
              args.sport,
              args.strategy,
              args.startDate,
              args.endDate
            );
            break;
            
          case "sportsBetting_findValueBets":
            toolResult = await sportsBettingFindValueBetsTool(
              args.sport,
              args.threshold,
              args.maxOdds
            );
            break;
            
          case "sportsBetting_getStrategyPerformance":
            toolResult = await sportsBettingGetStrategyPerformanceTool(
              args.sport,
              args.strategy,
              args.period
            );
            break;
            
          case "sportsBetting_getOptimalConfiguration":
            toolResult = await sportsBettingGetOptimalConfigurationTool(
              args.sport,
              args.bankroll,
              args.riskTolerance
            );
            break;
            
          default:
            logger.warn(`❌ Unknown tool called: ${toolName}`);
            toolResult = { error: "Unknown tool" };
        }
        
        logger.info(`📊 Tool result: ${JSON.stringify(toolResult, null, 2)}`);
        
        // Send the tool result back to Gemini
        logger.info(`📤 Sending tool result back to Gemini for analysis...`);
        await chat.sendMessage({
          role: "function",
          name: toolName,
          parts: [{ text: JSON.stringify(toolResult) }],
        });
      }
      
      // Get the final recommendation from Gemini
      logger.info(`🤔 Requesting final recommendation from Gemini after tool analysis...`);
      const finalResponse = await chat.sendMessage("Based on all the data you've gathered, what is your final recommendation?");
      logger.info(`✅ Final recommendation received from Gemini`);
      
      // Parse and format the response
      return this.parseGeminiResponse(finalResponse);
    } else {
      // If no tool calls were made, parse the direct response
      return this.parseGeminiResponse(result);
    }
  }

  /**
   * Create the system prompt for Gemini
   * @param request - Orchestration request
   * @returns System prompt
   */
  private createSystemPrompt(request: OrchestrationRequest): string {
    // Calculate implied probabilities if odds are provided
    let impliedProbabilities = '';
    if (request.odds) {
      if (request.betType === 'football_1x2' && request.odds.homeOdds && request.odds.awayOdds && request.odds.drawOdds) {
        const homeImpliedProb = calculateImpliedProbability(request.odds.homeOdds);
        const drawImpliedProb = calculateImpliedProbability(request.odds.drawOdds);
        const awayImpliedProb = calculateImpliedProbability(request.odds.awayOdds);
        impliedProbabilities = `
        Implied probabilities based on the odds:
        - Home win: ${(homeImpliedProb * 100).toFixed(2)}% (${request.odds.homeOdds})
        - Draw: ${(drawImpliedProb * 100).toFixed(2)}% (${request.odds.drawOdds})
        - Away win: ${(awayImpliedProb * 100).toFixed(2)}% (${request.odds.awayOdds})
        - Total implied probability: ${((homeImpliedProb + drawImpliedProb + awayImpliedProb) * 100).toFixed(2)}% (the excess over 100% represents the bookmaker's margin)
        `;
      } else if ((request.betType === 'moneyline' || request.betType === 'spread') && request.odds.homeOdds && request.odds.awayOdds) {
        const homeImpliedProb = calculateImpliedProbability(request.odds.homeOdds);
        const awayImpliedProb = calculateImpliedProbability(request.odds.awayOdds);
        impliedProbabilities = `
        Implied probabilities based on the odds:
        - Home team: ${(homeImpliedProb * 100).toFixed(2)}% (${request.odds.homeOdds})
        - Away team: ${(awayImpliedProb * 100).toFixed(2)}% (${request.odds.awayOdds})
        - Total implied probability: ${((homeImpliedProb + awayImpliedProb) * 100).toFixed(2)}% (the excess over 100% represents the bookmaker's margin)
        `;
      } else if ((request.betType === 'total' || request.betType === 'football_over_under' || request.betType === 'player_prop') && request.odds.overOdds && request.odds.underOdds) {
        const overImpliedProb = calculateImpliedProbability(request.odds.overOdds);
        const underImpliedProb = calculateImpliedProbability(request.odds.underOdds);
        impliedProbabilities = `
        Implied probabilities based on the odds:
        - Over ${request.overUnderLine}: ${(overImpliedProb * 100).toFixed(2)}% (${request.odds.overOdds})
        - Under ${request.overUnderLine}: ${(underImpliedProb * 100).toFixed(2)}% (${request.odds.underOdds})
        - Total implied probability: ${((overImpliedProb + underImpliedProb) * 100).toFixed(2)}% (the excess over 100% represents the bookmaker's margin)
        `;
      }
    }

    // Determine which prediction tools to highlight based on the sport and bet type
    let predictionToolsInstructions = '';
    if (request.sport.toLowerCase() === 'football' || request.sport.toLowerCase() === 'soccer') {
      predictionToolsInstructions = `
      For this football (soccer) bet, use the following tools:
      1. sportmonks_getFootballPrediction - Use this to get the main prediction for the match outcome
      2. sportmonks_getMarketPrediction - Use this to get predictions for specific markets like ${request.marketName || '1X2, Over/Under, BTTS'}
      3. sportmonks_getValueBets - Use this to find the best value bets for this fixture
      `;
    } else {
      predictionToolsInstructions = `
      For this ${request.sport} bet, use the following tools:
      1. sportsDataIO_getGamePrediction - Use this for game outcome predictions (moneyline, spread, total)
      ${request.betType === 'player_prop' ? '2. sportsDataIO_getPlayerPropPrediction - Use this for player prop predictions' : ''}
      `;
    }

    return `
    You are an expert sports betting analyst and advisor for the Predictive Play app. Your role is to analyze betting opportunities and provide personalized recommendations to users.

    CURRENT BET ANALYSIS REQUEST:
    - Sport: ${request.sport}
    ${request.gameId ? `- Game ID: ${request.gameId}` : ''}
    ${request.fixtureId ? `- Fixture ID: ${request.fixtureId}` : ''}
    - Bet Type: ${request.betType}
    ${request.playerId ? `- Player ID: ${request.playerId}` : ''}
    ${request.statType ? `- Stat Type: ${request.statType}` : ''}
    ${request.overUnderLine ? `- Over/Under Line: ${request.overUnderLine}` : ''}
    ${request.marketName ? `- Market Name: ${request.marketName}` : ''}
    ${impliedProbabilities}

    You have access to the following tools to help with your analysis:

    ${predictionToolsInstructions}

    Advanced Sports Betting Analytics (NEW - Use these for deeper analysis):
    - sportsBetting_findValueBets - Use this to identify value betting opportunities with mathematical edge
    - sportsBetting_backtestStrategy - Use this to validate betting strategies with historical data
    - sportsBetting_getStrategyPerformance - Use this to analyze performance of specific betting approaches
    - sportsBetting_getOptimalConfiguration - Use this to determine optimal bankroll management and betting configuration

    Additional tools available:
    - webSearch_performSearch - Use this to find recent news, injury reports, or other qualitative information
    - userData_getUserPreferences - Use this to understand the user's preferences and risk tolerance
    - userData_getUserBettingHistory - Use this to understand the user's betting patterns and history

    ANALYSIS PROCESS:
    1. First, gather all relevant quantitative data using the appropriate prediction tools.
    2. Use sportsBetting_findValueBets to identify if this specific bet represents good value.
    3. If relevant, use sportsBetting_getStrategyPerformance to understand how similar bets have performed historically.
    4. Search for recent news or developments that might impact the game using the webSearch tool.
    5. Consider the user's preferences and betting history to personalize your recommendation.
    6. Use sportsBetting_getOptimalConfiguration to suggest appropriate bet sizing based on user's bankroll and risk tolerance.
    7. Analyze the value of the bet by comparing the predicted probabilities to the implied probabilities from the odds.
    8. Make a final recommendation with a confidence level and detailed reasoning.

    YOUR RESPONSE FORMAT:
    Provide your recommendation in JSON format with the following structure:
    {
      "recommendation": {
        "pick": "Your recommended pick (e.g., 'Home Team', 'Over 220.5', 'Player X Over 25.5 Points')",
        "confidence": "Low/Medium/High",
        "reasoning": "A concise explanation of your recommendation",
        "factors": {
          "predictiveAnalytics": "How the predictive models influenced your decision",
          "recentNews": "How recent news or qualitative factors influenced your decision",
          "userContext": "How the user's preferences and history influenced your decision",
          "valueAssessment": "Your assessment of the betting value based on predicted vs. implied probabilities"
        }
      }
    }

    USER ID: ${request.userId}
    
    Begin your analysis by gathering the necessary information using the available tools.
    `;
  }

  /**
   * Parse the final response from Gemini
   * @param response - Gemini response
   * @returns Orchestration response
   */
  private parseGeminiResponse(response: any): OrchestrationResponse {
    try {
      const responseText = response.candidates[0].content.parts[0].text;
      
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonString = jsonMatch[0];
        const parsedResponse = JSON.parse(jsonString);
        
        // Ensure the response has the expected structure
        if (!parsedResponse.recommendation || !parsedResponse.recommendation.pick) {
          throw new Error('Invalid response format from Gemini');
        }
        
        return {
          recommendation: {
            pick: parsedResponse.recommendation.pick,
            confidence: parsedResponse.recommendation.confidence,
            reasoning: parsedResponse.recommendation.reasoning,
            factors: {
              predictiveAnalytics: parsedResponse.recommendation.factors.predictiveAnalytics,
              recentNews: parsedResponse.recommendation.factors.recentNews,
              userContext: parsedResponse.recommendation.factors.userContext,
              valueAssessment: parsedResponse.recommendation.factors.valueAssessment
            }
          },
          metadata: {
            toolsUsed: [],
            processingTime: 0,
            modelVersion: this.modelVersion
          }
        };
      } else {
        throw new Error('Could not extract JSON from Gemini response');
      }
    } catch (error) {
      logger.error(`Error parsing Gemini response: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

// Create and export service instance
export const geminiOrchestratorService = new GeminiOrchestratorService();

// Export function for API routes
export const generateBettingRecommendation = async (request: OrchestrationRequest): Promise<OrchestrationResponse> => {
  return await geminiOrchestratorService.generateRecommendation(request);
}; 
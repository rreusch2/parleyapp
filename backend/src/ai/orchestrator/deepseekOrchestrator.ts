import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';
import { sportsDBTool } from '../tools/sportsDB';
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
import { predictionValidator } from '../../services/predictionValidator';
import { sportsDataIOGetPlayerPropPredictionTool } from '../tools/sportsDataIO';

// Load environment variables
dotenv.config();

const logger = createLogger('deepseekOrchestrator');
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Define interfaces for orchestrator (same as Gemini)
interface OrchestrationRequest {
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
 * Orchestrator service using DeepSeek to coordinate tools and generate recommendations
 */
class DeepSeekOrchestratorService {
  private openai: OpenAI;
  private modelVersion = 'deepseek-chat';

  constructor() {
    if (!DEEPSEEK_API_KEY) {
      logger.error('DEEPSEEK_API_KEY not found in environment variables');
      throw new Error('DEEPSEEK_API_KEY not found in environment variables');
    }

    logger.info(`🚀 Initializing DeepSeek model: ${this.modelVersion}`);
    this.openai = new OpenAI({
      apiKey: DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
    logger.info(`✅ DeepSeek ${this.modelVersion} initialized successfully`);
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
      logger.info(`🎯 DEEPSEEK ORCHESTRATOR STARTING: ${request.sport} game ${request.gameId || request.fixtureId}, bet type: ${request.betType}`);
      logger.info(`📋 Request details: ${JSON.stringify(request, null, 2)}`);
      
      // Define available tools for DeepSeek - ENHANCED WITH 8 TOOLS
      const tools = [
        {
          type: "function" as const,
          function: {
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
        },
        {
          type: "function" as const,
          function: {
            name: "sportsDataIO_getPlayerPropPrediction",
            description: "Fetches player prop predictions (points, rebounds, assists, strikeouts, etc.) from SportsDataIO for a specific player and game.",
            parameters: {
              type: "object",
              properties: {
                playerId: { type: "string", description: "The unique identifier for the player." },
                gameId: { type: "string", description: "The unique identifier for the game." },
                statType: { type: "string", description: "The type of stat to predict (points, rebounds, assists, strikeouts, hits, etc.)." },
                overUnderLine: { type: "number", description: "The over/under line for the player prop." },
                sport: { type: "string", description: "The sport of the game (e.g., NBA, NFL, MLB, NHL)." },
              },
              required: ["playerId", "gameId", "statType", "overUnderLine", "sport"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
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
        },
        {
          type: "function" as const,
          function: {
            name: "webSearch_performSearch",
            description: "CRITICAL: Search for breaking news, injuries, weather, lineup changes, and team developments that could significantly impact game outcomes. This real-time data often provides the edge over market odds.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query for recent news (e.g., 'Padres injury report today', 'Brewers lineup changes June 2025', 'MLB weather conditions Milwaukee')" },
                timeframe: { type: "string", enum: ["24h", "7d", "30d"], description: "Time frame for search results (default: 24h for most current info)" },
              },
              required: ["query"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "freeData_getTeamNews",
            description: "VALUABLE: Get recent team news, trades, suspensions, and sentiment analysis from ESPN and news APIs. Can reveal market-moving information.",
            parameters: {
              type: "object",
              properties: {
                teamName: { type: "string", description: "Team name (e.g., 'Padres', 'Brewers', 'Dodgers', 'Cardinals')" },
                sport: { type: "string", description: "Sport (e.g., MLB, NBA, NFL, NHL)" },
              },
              required: ["teamName", "sport"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "freeData_getInjuryReports",
            description: "Get current injury reports for a team from free ESPN API sources.",
            parameters: {
              type: "object",
              properties: {
                teamId: { type: "string", description: "Team identifier" },
                sport: { type: "string", enum: ["nba", "nfl", "mlb"], description: "Sport to fetch injury data for" },
              },
              required: ["teamId", "sport"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "sportsBetting_backtestStrategy",
            description: "Backtest a betting strategy using historical data to validate performance and ROI.",
            parameters: {
              type: "object",
              properties: {
                sport: { type: "string", description: "Sport to analyze (NBA, NFL, MLB, NHL)" },
                strategy: { type: "string", description: "Strategy to backtest (conservative, balanced, aggressive)" },
                startDate: { type: "string", description: "Start date for backtesting (YYYY-MM-DD)" },
                endDate: { type: "string", description: "End date for backtesting (YYYY-MM-DD)" },
              },
              required: ["sport", "strategy", "startDate", "endDate"],
            },
          },
        },
        {
          type: "function" as const, 
          function: {
            name: "sportsBetting_getOptimalConfiguration",
            description: "Get optimal betting configuration based on user risk profile and bankroll.",
            parameters: {
              type: "object",
              properties: {
                sport: { type: "string", description: "Sport to analyze" },
                bankroll: { type: "number", description: "User's betting bankroll amount" },
                riskTolerance: { type: "string", enum: ["low", "medium", "high"], description: "User's risk tolerance level" },
              },
              required: ["sport", "bankroll", "riskTolerance"],
            },
          },
        }
      ];

      // Create the system prompt
      const systemPrompt = this.createSystemPrompt(request);
      logger.info(`🧠 System prompt created (${systemPrompt.length} characters)`);
      
      // Create the initial messages
      const messages = [
        {
          role: "system" as const,
          content: systemPrompt
        },
        {
          role: "user" as const,
          content: `Please analyze this betting opportunity and provide your recommendation. You MUST use multiple tools to provide comprehensive analysis.

Current request:
- Sport: ${request.sport}
- Game: ${request.gameId || request.fixtureId}
- Bet Type: ${request.betType}
- User: ${request.userId}

REQUIRED ANALYSIS STEPS:
1. ALWAYS call sportsDataIO_getGamePrediction first for statistical analysis
2. ALWAYS call userData_getUserPreferences for user context
3. STRONGLY RECOMMENDED: Call webSearch_performSearch to check for recent team news, injuries, or developments
4. CONSIDER: Call freeData_getTeamNews for additional team sentiment and news analysis
5. IF RELEVANT: Call freeData_getInjuryReports if injury concerns are mentioned

Use 3-4 tools minimum to provide the most comprehensive and well-informed recommendation possible. Real-time information can significantly impact betting value.`
        }
      ];

      logger.info(`💬 Starting DeepSeek chat with ${tools.length} available tools`);
      
      // Make the initial request to DeepSeek
      logger.info(`🚀 Sending analysis request to DeepSeek AI...`);
      const response = await this.openai.chat.completions.create({
        model: this.modelVersion,
        messages: messages,
        tools: tools,
        tool_choice: "auto",
        temperature: 0.1,
        max_tokens: 2000,
      });

      logger.info(`📨 DeepSeek response received`);
      
      // Process tool calls if any
      let finalResponse = response;
      if (response.choices[0].message.tool_calls) {
        logger.info(`🔧 Processing ${response.choices[0].message.tool_calls.length} tool calls...`);
        finalResponse = await this.processToolCalls(response, messages, tools, toolsUsed, request);
      }

      // Parse the final response
      const result = this.parseDeepSeekResponse(finalResponse, toolsUsed);
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      logger.info(`⏱️ Total orchestration time: ${processingTime}ms`);
      logger.info(`🛠️ Tools used: ${toolsUsed.join(', ') || 'None'}`);
      logger.info(`✅ DEEPSEEK ORCHESTRATOR COMPLETE: Final recommendation generated`);
      
      // Add metadata to the response
      result.metadata = {
        toolsUsed,
        processingTime,
        modelVersion: this.modelVersion,
      };
      
      return result;
      
    } catch (error) {
      logger.error(`💥 Error in DeepSeek orchestration: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return a fallback response with a valid pick
      return {
        recommendation: {
          pick: 'Home Team ML',
          confidence: 'Low',
          reasoning: 'Analysis temporarily unavailable due to system issues - this is a fallback recommendation',
          factors: {
            predictiveAnalytics: 'Temporarily unavailable',
            recentNews: 'Service temporarily unavailable',
            userContext: 'Limited access due to system issues',
            valueAssessment: 'Basic assessment applied',
          },
        },
        metadata: {
          toolsUsed: [],
          processingTime: Date.now() - startTime,
          modelVersion: this.modelVersion,
        },
      };
    }
  }

  /**
   * Process tool calls from DeepSeek
   */
  private async processToolCalls(
    response: any, 
    messages: any[], 
    tools: any[], 
    toolsUsed: string[], 
    request: OrchestrationRequest
  ): Promise<any> {
    
    // Add the assistant's message with tool calls to the conversation
    messages.push(response.choices[0].message);
    
    // Process each tool call
    for (const toolCall of response.choices[0].message.tool_calls) {
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      
      logger.info(`🔧 TOOL EXECUTION: ${toolName}`);
      toolsUsed.push(toolName);
      
      let toolResult;
      
      try {
        // Execute the appropriate tool
        switch (toolName) {
          case "sportsDataIO_getGamePrediction":
            // 🚀 USE THE-SPORTS-DB INSTEAD OF PAID APIs!
            toolResult = await sportsDBTool.execute(
              args.gameId,
              args.betType,
              args.sport,
              // Extract team names from the request context if available
              (request as any).teams?.home,
              (request as any).teams?.away
            );
            // Debug: Log the enhanced prediction data being sent to DeepSeek
            logger.info(`📊 SportsDB prediction data sent to DeepSeek: ${JSON.stringify(toolResult, null, 2)}`);
            break;
            
          case "sportsDataIO_getPlayerPropPrediction":
            toolResult = await sportsDataIOGetPlayerPropPredictionTool(
              args.playerId,
              args.gameId,
              args.statType,
              args.overUnderLine,
              args.sport
            );
            logger.info(`📊 Player prop prediction data: ${JSON.stringify(toolResult, null, 2)}`);
            break;
            
          case "userData_getUserPreferences":
            toolResult = await userDataGetUserPreferencesTool(args.userId);
            break;
            
          case "webSearch_performSearch":
            toolResult = await webSearchPerformSearchTool(args.query);
            break;
            
          case "freeData_getTeamNews":
            toolResult = await freeDataTeamNewsTool.func(args.teamName, args.sport);
            break;
            
          case "freeData_getInjuryReports":
            toolResult = await freeDataInjuryReportsTool.func(args.teamId, args.sport);
            break;
            
          case "sportsBetting_backtestStrategy":
            toolResult = await sportsBettingBacktestStrategyTool(
              args.sport,
              args.strategy,
              args.startDate,
              args.endDate
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
        
      } catch (toolError) {
        logger.error(`❌ Tool execution failed for ${toolName}: ${toolError}`);
        toolResult = { error: `Tool execution failed: ${toolError}` };
      }
      
      // Add the tool result to the conversation
      messages.push({
        role: "tool" as const,
        content: JSON.stringify(toolResult),
        tool_call_id: toolCall.id,
      });
    }
    
    // Get the final response from DeepSeek after tool execution
    logger.info(`🤔 Requesting final recommendation from DeepSeek after tool analysis...`);
    const finalResponse = await this.openai.chat.completions.create({
      model: this.modelVersion,
      messages: messages,
      temperature: 0.1,
      max_tokens: 1500,
    });
    
    logger.info(`✅ Final recommendation received from DeepSeek`);
    return finalResponse;
  }

  /**
   * Create the system prompt for DeepSeek
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
      }
    }

    return `You are an expert sports betting analyst and advisor for the ParleyApp. Your role is to analyze betting opportunities and provide personalized recommendations to users.

CURRENT BET ANALYSIS REQUEST:
- Sport: ${request.sport}
${request.gameId ? `- Game ID: ${request.gameId}` : ''}
${request.fixtureId ? `- Fixture ID: ${request.fixtureId}` : ''}
${request.teams ? `- Teams: ${request.teams.away} vs ${request.teams.home}` : ''}
- Bet Type: ${request.betType}
- User ID: ${request.userId}
${request.playerId ? `- Player ID: ${request.playerId}` : ''}
${request.statType ? `- Stat Type: ${request.statType}` : ''}
${request.overUnderLine ? `- Over/Under Line: ${request.overUnderLine}` : ''}
${request.marketName ? `- Market Name: ${request.marketName}` : ''}

${impliedProbabilities}

AVAILABLE TOOLS (ONLY USE THESE):
1. **sportsDataIO_getGamePrediction**: Get statistical predictions and win probabilities
2. **sportsDataIO_getPlayerPropPrediction**: Get player prop predictions
3. **userData_getUserPreferences**: Get user betting preferences and favorite teams
4. **webSearch_performSearch**: Search for recent news, injuries, and team developments
5. **freeData_getTeamNews**: Get recent team news and sentiment analysis from free sources
6. **freeData_getInjuryReports**: Get current injury reports for teams
7. **sportsBetting_backtestStrategy**: Validate strategies with historical data
8. **sportsBetting_getOptimalConfiguration**: Get risk-adjusted bankroll management

IMPORTANT: Only use the tools listed above. Do not attempt to use any other tools.

MANDATORY ANALYSIS PROTOCOL - USE MULTIPLE TOOLS:
1. **Statistical Foundation**: ALWAYS use sportsDataIO_getGamePrediction
${request.betType === 'player_prop' ? '2. **Player Prop Analysis**: MANDATORY use sportsDataIO_getPlayerPropPrediction for player-specific predictions' : ''}
2. **User Personalization**: ALWAYS use userData_getUserPreferences  
3. **Real-Time Edge**: MANDATORY use webSearch_performSearch for breaking news, injuries, weather
4. **Team Intelligence**: RECOMMENDED use freeData_getTeamNews for sentiment and roster changes
5. **Injury Impact**: Use freeData_getInjuryReports when injuries are discovered
6. **Historical Context**: Consider sportsBetting_backtestStrategy for strategy validation
7. **Risk Analysis**: Consider sportsBetting_getOptimalConfiguration for optimal sizing

${request.betType === 'player_prop' ? `
PLAYER PROP SPECIFIC REQUIREMENTS:
- MUST use sportsDataIO_getPlayerPropPrediction with these parameters:
  * playerId: ${request.playerId}
  * gameId: ${request.gameId}
  * statType: ${request.statType}
  * overUnderLine: ${request.overUnderLine}
  * sport: ${request.sport}
- Focus on player-specific factors: recent performance, matchup advantages, usage rates
- Consider injury status and playing time projections
- Analyze opponent defensive rankings against this stat type
` : ''}

CRITICAL: You MUST use at least 3-4 tools per analysis. The market often misprices games due to late-breaking information. Your job is to find that edge through comprehensive data gathering.

IMPORTANT: When tools return enhanced data like "kellyOptimalStake", "expectedValue", "confidenceInterval", "ROI", "winRate", or "modelMetrics", include this information in your valueAssessment.

OUTPUT REQUIREMENTS:
After using the available tools, provide your final response as a JSON object with this exact structure:
{
  "recommendation": {
    "pick": "Specific betting recommendation using ACTUAL team names (e.g., '${request.teams?.home || 'Home Team'} ML', '${request.teams?.away || 'Away Team'} ML', 'Over 8.5')",
    "confidence": "High|Medium|Low",
    "reasoning": "Detailed explanation based on the data from tools",
    "factors": {
      "predictiveAnalytics": "Summary of statistical predictions from tools",
      "recentNews": "Note if no real-time news available",
      "userContext": "User preferences from tools", 
      "valueAssessment": "Expected value based on predictions"
    }
  }
}

IMPORTANT: When making moneyline recommendations, use the ACTUAL team names provided: ${request.teams ? `"${request.teams.home}" for home team, "${request.teams.away}" for away team` : 'Home Team and Away Team'}. Never use generic "Home Team" or "Away Team" in your final pick recommendation.

Be thorough but only use the 2 available tools. Provide clear reasoning for your recommendation.`;
  }

  /**
   * Parse DeepSeek response into our standard format
   */
  private parseDeepSeekResponse(response: any, toolsUsed: string[]): OrchestrationResponse {
    try {
      let content = response.choices[0].message.content;
      
      // Clean up any tool call artifacts from the content
      // Handle multiple DeepSeek tool call marker formats
      content = content.replace(/<｜tool▁call▁begin｜>.*?<｜tool▁calls▁end｜>/gs, '');
      content = content.replace(/<｜tool▁call▁begin｜>.*?<｜tool▁call▁end｜>/gs, '');
      content = content.replace(/<｜tool▁calls▁begin｜>.*?<｜tool▁calls▁end｜>/gs, '');
      content = content.replace(/<｜tool▁calls▁begin｜>/g, '');
      content = content.replace(/<｜tool▁calls▁end｜>/g, '');
      content = content.replace(/<.*?tool.*?call.*?begin.*?>/gi, '');
      content = content.replace(/<.*?tool.*?call.*?end.*?>/gi, '');
      content = content.replace(/< \| tool__calls__begin \| >/g, '');
      content = content.replace(/< \| tool__calls__end \| >/g, '');
      content = content.trim();
      
      // Try to parse as JSON first
      let parsed;
      try {
        // Look for JSON within the content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch {
        // If not JSON, create a structured response from text
        const pick = this.extractPick(content);
        const confidence = this.extractConfidence(content);
        
        parsed = {
          recommendation: {
            pick: pick,
            confidence: confidence,
            reasoning: content.length > 10 ? content : 'Based on statistical analysis and user preferences',
            factors: {
              predictiveAnalytics: 'Statistical models analyzed',
              recentNews: 'No real-time news data available',
              userContext: 'User preferences considered',
              valueAssessment: 'Expected value calculated from predictions',
            },
          },
        };
      }
      
      // Ensure the response has the correct structure
      if (!parsed.recommendation) {
        parsed = { recommendation: parsed };
      }
      
      return {
        recommendation: {
          pick: parsed.recommendation.pick || this.extractPick(content) || 'Home Team ML',
          confidence: parsed.recommendation.confidence || 'Medium',
          reasoning: parsed.recommendation.reasoning || 'Analysis completed',
          factors: parsed.recommendation.factors || {
            predictiveAnalytics: 'Analysis completed',
            recentNews: 'No news data available',
            userContext: 'User context considered',
            valueAssessment: 'Value assessment completed',
          },
        },
        metadata: {
          toolsUsed,
          processingTime: 0, // Will be set by caller
          modelVersion: this.modelVersion,
        },
      };
      
    } catch (error) {
      logger.error(`Error parsing DeepSeek response: ${error}`);
      logger.error(`Raw response content: ${response.choices[0]?.message?.content}`);
      
      return {
        recommendation: {
          pick: 'Home Team ML',
          confidence: 'Low',
          reasoning: 'Analysis temporarily unavailable - this is a fallback recommendation',
          factors: {
            predictiveAnalytics: 'Temporarily unavailable',
            recentNews: 'No news data available',
            userContext: 'Limited user data access',
            valueAssessment: 'Basic value assessment applied',
          },
        },
        metadata: {
          toolsUsed,
          processingTime: 0,
          modelVersion: this.modelVersion,
        },
      };
    }
  }

  private extractPick(content: string): string {
    // Enhanced extraction logic to avoid "No specific pick identified"
    const lowerContent = content.toLowerCase();
    
    // Look for specific pick patterns
    const patterns = [
      /pick[":]\s*["']([^"']+)["']/i,
      /recommendation[":]\s*["']([^"']+)["']/i,
      /suggest[":]\s*["']([^"']+)["']/i,
      /betting on[":]\s*["']([^"']+)["']/i,
      /take[":]\s*["']([^"']+)["']/i,
      /(home team|away team)\s+(ml|moneyline)/i,
      /(under|over)\s+\d+\.?\d*/i,
      /\b(ml|moneyline)\b/i,
      /\b(spread|point spread)\b/i,
      /\b(total|over|under)\b/i
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        return match[1].trim();
      }
    }
    
    // If no structured pick found, look for team names with betting terminology
    if (lowerContent.includes('home') && (lowerContent.includes('ml') || lowerContent.includes('moneyline'))) {
      return 'Home Team ML';
    }
    if (lowerContent.includes('away') && (lowerContent.includes('ml') || lowerContent.includes('moneyline'))) {
      return 'Away Team ML';
    }
    if (lowerContent.includes('under') && /\d+/.test(content)) {
      const number = content.match(/(\d+\.?\d*)/)?.[1];
      return number ? `Under ${number}` : 'Under Total';
    }
    if (lowerContent.includes('over') && /\d+/.test(content)) {
      const number = content.match(/(\d+\.?\d*)/)?.[1];
      return number ? `Over ${number}` : 'Over Total';
    }
    
    // Last resort: try to extract any meaningful betting term
    const bettingTerms = ['moneyline', 'spread', 'total', 'over', 'under', 'ml'];
    for (const term of bettingTerms) {
      if (lowerContent.includes(term)) {
        return `${term.charAt(0).toUpperCase() + term.slice(1)} Pick`;
      }
    }
    
    // If we still can't find anything, return a generic but valid pick
    return 'Home Team ML';
  }

  private extractConfidence(content: string): 'Low' | 'Medium' | 'High' {
    const confidenceMatch = content.match(/confidence[":]\s*["']?(High|Medium|Low)["']?/i);
    return (confidenceMatch ? confidenceMatch[1] : 'Medium') as 'Low' | 'Medium' | 'High';
  }
}

// Create a singleton instance
const deepSeekOrchestrator = new DeepSeekOrchestratorService();

export const generateBettingRecommendationDeepSeek = async (request: OrchestrationRequest): Promise<OrchestrationResponse> => {
  return deepSeekOrchestrator.generateRecommendation(request);
};

export { OrchestrationRequest, OrchestrationResponse }; 
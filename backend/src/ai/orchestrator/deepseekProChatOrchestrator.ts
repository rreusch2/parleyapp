import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';
import { sportsDataIOGetGamePredictionTool } from '../tools/sportsDataIO';
import { webSearchPerformSearchTool } from '../tools/webSearch';
import { userDataGetUserPreferencesTool } from '../tools/userData';
import { 
  sportsBettingBacktestStrategyTool,
  sportsBettingGetOptimalConfigurationTool
} from '../tools/sportsBetting';
import { freeDataTeamNewsTool, freeDataInjuryReportsTool } from '../tools/freeDataSources';
import sportRadarService from '../../services/sportsData/sportRadarService';
import { generateBettingRecommendationDeepSeek } from './deepseekOrchestrator';

// Load environment variables
dotenv.config();

const logger = createLogger('deepseekProChatOrchestrator');
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

interface ChatRequest {
  userId: string;
  message: string;
  context?: any;
}

interface StreamingCallback {
  (data: { type: string; content: string; metadata?: any }): void;
}

interface ChatToolCall {
  name: string;
  args: any;
  result: any;
  executionTime: number;
}

interface ChatResponse {
  response: string;
  toolsUsed: ChatToolCall[];
  confidence?: 'Low' | 'Medium' | 'High';
  recommendations?: string[];
  processingTime: number;
  modelVersion: string;
}

/**
 * 🔥 PRO CHAT ORCHESTRATOR - Bridges the powerful working orchestrator with chat interface
 * Features: Intelligent tool selection, real-time data access, conversational personality
 */
class DeepSeekProChatOrchestratorService {
  private openai: OpenAI;
  private modelVersion = 'deepseek-chat';

  constructor() {
    if (!DEEPSEEK_API_KEY) {
      logger.error('DEEPSEEK_API_KEY not found in environment variables');
      throw new Error('DEEPSEEK_API_KEY not found in environment variables');
    }

    logger.info(`🚀 Initializing DeepSeek Pro Chat: ${this.modelVersion}`);
    this.openai = new OpenAI({
      apiKey: DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
    logger.info(`✅ DeepSeek Pro Chat initialized successfully`);
  }

  /**
   * Generate streaming chat response with intelligent tool usage
   */
  async generateStreamingChatResponse(
    request: ChatRequest, 
    streamCallback: StreamingCallback
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    const toolsUsed: ChatToolCall[] = [];
    
    try {
      logger.info(`🎯 PRO CHAT REQUEST: User ${request.userId} - "${request.message}"`);
      
      streamCallback({
        type: 'thinking',
        content: '🧠 Analyzing your question and determining the best approach...'
      });

      // Determine if this needs tool usage or just conversational response
      const needsTools = this.shouldUseTools(request.message);
      
      if (needsTools.useTools) {
        return await this.handleToolBasedResponse(request, streamCallback, toolsUsed, startTime);
      } else {
        return await this.handleConversationalResponse(request, streamCallback, startTime);
      }

    } catch (error) {
      logger.error(`❌ Pro chat orchestrator error: ${error instanceof Error ? error.message : String(error)}`);
      
      streamCallback({
        type: 'error',
        content: '🔧 I encountered an issue. Let me try a different approach...'
      });

      return {
        response: "Sorry brotha, I'm having a technical hiccup. Try asking again in a moment!",
        toolsUsed: [],
        confidence: 'Low',
        processingTime: Date.now() - startTime,
        modelVersion: this.modelVersion
      };
    }
  }

  /**
   * Determine if the message requires tool usage
   */
  private shouldUseTools(message: string): { useTools: boolean; intent: string; needsGameData?: boolean } {
    const lowerMessage = message.toLowerCase();

    // Real games and picks request patterns - EXPANDED to catch user requests
    if (lowerMessage.includes('games today') ||
        lowerMessage.includes('games tonight') ||
        lowerMessage.includes('what games') ||
        lowerMessage.includes('any good games') ||
        lowerMessage.includes('mlb games') ||
        lowerMessage.includes('nba games') ||
        lowerMessage.includes('nfl games') ||
        lowerMessage.includes('picks') ||
        lowerMessage.includes('good picks') ||
        lowerMessage.includes('mlb picks') ||
        lowerMessage.includes('some picks') ||
        lowerMessage.includes('schedule') ||
        lowerMessage.includes('check schedule') ||
        lowerMessage.includes('check the schedule') ||
        lowerMessage.includes('who plays') ||
        lowerMessage.includes('plays next') ||
        lowerMessage.includes('plays today') ||
        lowerMessage.includes('next game') ||
        lowerMessage.includes('whoever plays') ||
        lowerMessage.includes('who\'s playing') ||
        lowerMessage.includes('whats on') ||
        lowerMessage.includes('what\'s on')) {
      return { useTools: true, intent: 'get_games' };
    }

    // Game analysis patterns - specific game/team analysis
    if (lowerMessage.includes('analyze') ||
        lowerMessage.includes('should i bet') ||
        lowerMessage.includes('what do you think about') ||
        lowerMessage.includes('thoughts on') ||
        lowerMessage.includes('look at') ||
        lowerMessage.includes('dodgers') ||
        lowerMessage.includes('yankees') ||
        lowerMessage.includes('lakers') ||
        lowerMessage.includes('warriors') ||
        lowerMessage.includes('celtics') ||
        lowerMessage.includes('heat') ||
        lowerMessage.includes('vs') ||
        lowerMessage.includes(' v ') ||
        lowerMessage.includes('@') ||
        lowerMessage.includes('game') && (lowerMessage.includes('tonight') || lowerMessage.includes('today'))) {
      return { useTools: true, intent: 'analyze_game' };
    }

    // News/injury patterns
    if (lowerMessage.includes('news') ||
        lowerMessage.includes('injury') ||
        lowerMessage.includes('lineup') ||
        lowerMessage.includes('roster')) {
      return { useTools: true, intent: 'news_inquiry' };
    }

    return { useTools: false, intent: 'conversational' };
  }

  /**
   * Check if message mentions specific teams/games
   */
  private mentionsSpecificGame(message: string): boolean {
    const teamKeywords = ['lakers', 'warriors', 'yankees', 'dodgers', 'patriots', 'chiefs', 'heat', 'celtics', 'rangers', 'devils', 'brewers', 'padres', 'cardinals'];
    const lowerMessage = message.toLowerCase();
    return teamKeywords.some(team => lowerMessage.includes(team));
  }

  /**
   * Handle responses that need tool usage
   */
  private async handleToolBasedResponse(
    request: ChatRequest, 
    streamCallback: StreamingCallback, 
    toolsUsed: ChatToolCall[], 
    startTime: number
  ): Promise<ChatResponse> {
    
    const analysis = this.shouldUseTools(request.message);
    
    if (analysis.intent === 'get_games') {
      const lowerMessage = request.message.toLowerCase();
      
      // If user asks for "picks" specifically, use our database-stored predictions
      if (lowerMessage.includes('picks') || lowerMessage.includes('good') || lowerMessage.includes('recommend')) {
        streamCallback({
          type: 'action',
          content: '🔍 Checking my latest AI predictions from the database...'
        });
        
        // Get the best stored predictions from database
        const storedPicks = await this.getStoredPredictions(request.userId, 5);
        
        if (storedPicks.length > 0) {
          streamCallback({
            type: 'action',
            content: `📊 Found ${storedPicks.length} quality predictions ready for you!`
          });
          
          const picksAnalysis = this.formatStoredPicksForChat(storedPicks);
          
          streamCallback({
            type: 'content',
            content: picksAnalysis
          });
          
          toolsUsed.push({
            name: 'get_stored_predictions',
            args: { userId: request.userId, limit: 5 },
            result: storedPicks,
            executionTime: Date.now() - startTime
          });
          
          return {
            response: `🎯 Here are my top AI picks from today:\n\n${picksAnalysis}`,
            toolsUsed,
            confidence: 'High',
            processingTime: Date.now() - startTime,
            modelVersion: this.modelVersion
          };
        } else {
          // No stored picks, suggest generating new ones
          streamCallback({
            type: 'content',
            content: `🤔 I don't have any fresh picks ready right now. This might be because:\n\n• It's off-season for some sports\n• I filtered out low-quality or outdated predictions\n• No games scheduled for today\n\nWould you like me to generate some new predictions? Just let me know which sport interests you most! 🎯`
          });
          
          return {
            response: `🤔 I don't have any fresh picks ready right now. Would you like me to generate some new predictions? Just let me know which sport interests you most!`,
            toolsUsed: [],
            confidence: 'Medium',
            processingTime: Date.now() - startTime,
            modelVersion: this.modelVersion
          };
        }
      }
      
      // If they ask about games/schedule without wanting picks
      streamCallback({
        type: 'action',
        content: '📅 Checking what games are available today...'
      });
      
      const realGames = await this.getRealGamesToday('MLB');
      
      if (realGames.success && realGames.gamesCount > 0) {
        const gamesInfo = this.formatGamesForChat(realGames);
        
        streamCallback({
          type: 'content',
          content: gamesInfo
        });
        
        toolsUsed.push({
          name: 'get_real_games_today',
          args: { sport: 'MLB' },
          result: realGames,
          executionTime: Date.now() - startTime
        });
        
        return {
          response: gamesInfo,
          toolsUsed,
          confidence: 'High',
          processingTime: Date.now() - startTime,
          modelVersion: this.modelVersion
        };
      }
    }
    
    // Handle specific game analysis requests
    if (analysis.intent === 'analyze_game') {
      streamCallback({
        type: 'action',
        content: '🎯 Let me check if I have analysis on that game...'
      });
      
      // Check if we have stored analysis for this game
      const gameAnalysis = await this.getGameAnalysis(request.message, request.userId);
      
      if (gameAnalysis) {
        const formattedAnalysis = this.formatGameAnalysisForChat(gameAnalysis);
        
        streamCallback({
          type: 'content',
          content: formattedAnalysis
        });
        
        toolsUsed.push({
          name: 'get_game_analysis',
          args: { query: request.message, userId: request.userId },
          result: gameAnalysis,
          executionTime: Date.now() - startTime
        });
        
        return {
          response: formattedAnalysis,
          toolsUsed,
          confidence: gameAnalysis.confidence || 'Medium',
          processingTime: Date.now() - startTime,
          modelVersion: this.modelVersion
        };
      }
    }

    // Fallback to conversational response
    return await this.handleConversationalResponse(request, streamCallback, startTime);
  }

  /**
   * Handle conversational responses without tools
   */
  private async handleConversationalResponse(
    request: ChatRequest, 
    streamCallback: StreamingCallback, 
    startTime: number
  ): Promise<ChatResponse> {
    
    // Use DeepSeek for natural conversation
    const systemPrompt = this.createProChatSystemPrompt(request);
    
    try {
      const stream = await this.openai.chat.completions.create({
        model: this.modelVersion,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request.message }
        ],
        stream: true,
        max_tokens: 800,
        temperature: 0.7
      });

      let fullResponse = '';
      
      for await (const chunk of stream) {
        if (chunk.choices[0]?.delta?.content) {
          const content = chunk.choices[0].delta.content;
          fullResponse += content;
          
          streamCallback({
            type: 'content',
            content: content
          });
        }
      }

      return {
        response: fullResponse,
        toolsUsed: [],
        confidence: 'High',
        processingTime: Date.now() - startTime,
        modelVersion: this.modelVersion
      };
      
    } catch (error) {
      logger.error(`Error in conversational response: ${error}`);
      throw error;
    }
  }

  /**
   * Get real games for today using SportRadar
   */
  private async getRealGamesToday(sport: string, date?: string): Promise<any> {
    try {
      const today = date || new Date().toISOString().split('T')[0];
      logger.info(`🏟️ Fetching real ${sport} games for ${today}`);
      
      if (sport === 'MLB') {
        const year = today.split('-')[0];
        const month = today.split('-')[1];
        const day = today.split('-')[2];
        const games = await sportRadarService.getMlbDailySchedule(year, month, day);
        
        if (games && games.games && games.games.length > 0) {
          const gamesList = games.games.map((game: any, index: number) => {
            const awayTeam = game.away?.name || game.away?.market || 'Away Team';
            const homeTeam = game.home?.name || game.home?.market || 'Home Team';
            const gameTime = game.scheduled ? new Date(game.scheduled).toLocaleTimeString() : 'TBD';
            return `${index + 1}. ${awayTeam} @ ${homeTeam} (${gameTime})`;
          }).join('\n');
          
          return {
            success: true,
            response: gamesList,
            gamesCount: games.games.length,
            date: today
          };
        }
      }
      
      return {
        success: false,
        response: "No games found for today. Check back later or ask about a specific matchup!",
        gamesCount: 0,
        date: today
      };
      
    } catch (error) {
      logger.error(`Error fetching real games: ${error}`);
      return {
        success: false,
        response: "Having trouble accessing live game data. Try asking about a specific team or matchup!",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Extract game information from user message
   */
  private extractGameInfo(message: string): any {
    // Simple extraction - in production you'd want more sophisticated NLP
    const lowerMessage = message.toLowerCase();
    
    // Look for team patterns
    const teamMentions = {
      'lakers': { team: 'Lakers', sport: 'NBA' },
      'warriors': { team: 'Warriors', sport: 'NBA' },
      'yankees': { team: 'Yankees', sport: 'MLB' },
      'dodgers': { team: 'Dodgers', sport: 'MLB' },
      'brewers': { team: 'Brewers', sport: 'MLB' },
      'padres': { team: 'Padres', sport: 'MLB' },
      'cardinals': { team: 'Cardinals', sport: 'MLB' }
    };
    
    for (const [keyword, info] of Object.entries(teamMentions)) {
      if (lowerMessage.includes(keyword)) {
        return {
          gameId: `${info.sport.toLowerCase()}_real_1`,
          sport: info.sport,
          teams: { home: info.team, away: 'Opponent' },
          betType: lowerMessage.includes('spread') ? 'spread' : 
                   lowerMessage.includes('over') || lowerMessage.includes('under') ? 'total' : 'moneyline'
        };
      }
    }
    
    // Default case
    return {
      gameId: 'mlb_real_1',
      sport: 'MLB',
      teams: { home: 'Home Team', away: 'Away Team' },
      betType: 'moneyline'
    };
  }

  /**
   * Use the working orchestrator for deep analysis
   */
  private async analyzeSpecificGame(gameInfo: any, userId: string): Promise<any> {
    try {
      logger.info(`🎯 Running deep analysis using working orchestrator for ${gameInfo.sport}`);
      
      // Use the existing working orchestrator
      const result = await generateBettingRecommendationDeepSeek({
        userId,
        gameId: gameInfo.gameId,
        betType: gameInfo.betType,
        sport: gameInfo.sport,
        teams: gameInfo.teams,
        odds: {
          homeOdds: -110,
          awayOdds: 105
        }
      });
      
      logger.info(`✅ Orchestrator analysis complete with ${result.metadata?.toolsUsed?.length || 0} tools used`);
      return result;
      
    } catch (error) {
      logger.error(`Error in deep analysis: ${error}`);
      return {
        recommendation: {
          pick: 'Analysis temporarily unavailable',
          confidence: 'Low',
          reasoning: 'Having trouble accessing my prediction models right now. Try again in a moment!',
          factors: {
            predictiveAnalytics: 'Models temporarily offline',
            recentNews: 'News feeds unavailable', 
            userContext: 'User data unavailable',
            valueAssessment: 'Value calculation unavailable'
          }
        },
        metadata: {
          toolsUsed: [],
          processingTime: 0,
          modelVersion: this.modelVersion
        }
      };
    }
  }

  /**
   * Format orchestrator analysis for conversational chat
   */
  private formatAnalysisForChat(analysis: any): string {
    if (!analysis?.recommendation) {
      return '\n\n🔧 My analysis hit a snag. Try asking about a specific team or game!';
    }
    
    const rec = analysis.recommendation;
    const meta = analysis.metadata || {};
    
    const toolsUsedText = meta.toolsUsed && meta.toolsUsed.length > 0 
      ? `\n\n🔧 Tools used: ${meta.toolsUsed.join(', ')}`
      : '';
    
    const confidenceEmoji = rec.confidence === 'High' ? '🔥' : 
                           rec.confidence === 'Medium' ? '⚡' : '⚠️';
    
    return `\n\n${confidenceEmoji} **My ${rec.confidence} confidence pick**: ${rec.pick}

💭 **Why I like this bet**: ${rec.reasoning}

📊 **Key factors**:
• **Stats**: ${rec.factors?.predictiveAnalytics || 'Statistical models analyzed'}
• **News**: ${rec.factors?.recentNews || 'No major news impact'}
• **Value**: ${rec.factors?.valueAssessment || 'Value assessed'}${toolsUsedText}

Remember brotha - I analyze, you decide! Always bet responsibly. 🎯`;
  }

  /**
   * Create conversational system prompt
   */
  private createProChatSystemPrompt(request: ChatRequest): string {
    return `You are ParleyAI Pro - a sharp but friendly AI betting analyst. Think of yourself as that knowledgeable friend who really knows the numbers.

Your personality:
- Conversational and approachable ("brotha", casual language)
- Confident but never arrogant
- Explain things clearly and briefly
- Professional but personable

When users ask about betting:
- If they mention specific teams/games, offer to run your "prediction models"
- If they ask general questions, give helpful guidance
- Keep responses 2-3 sentences unless they need more detail
- Use 1-2 emojis max per response
- Suggest checking real games when they ask for picks

User context: ${JSON.stringify(request.context || { isPro: true })}

Example responses:
"Hey brotha! I can analyze any real game for you. Which matchup are you looking at?"
"Need me to run my models on a specific game? Just tell me the teams!"
"For the best analysis, I'll need to know which game interests you - then I can break it down!"

Keep it conversational and helpful!`;
  }

  /**
   * Get stored predictions from database (fast database lookup)
   */
  private async getStoredPredictions(userId: string, limit: number = 5): Promise<any[]> {
    try {
      const { supabase } = require('../../services/supabase/client');
      
      // Calculate date ranges for filtering
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrowEnd = new Date(todayStart);
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 2); // Include tomorrow's games
      
      // Get recent high-quality predictions with better filtering
      const { data: predictions, error } = await supabase
        .from('ai_predictions')
        .select('*')
        .eq('status', 'pending') // Only active predictions
        .gte('confidence', 70) // Higher confidence threshold
        .gte('event_time', todayStart.toISOString()) // Only current/future games
        .lte('event_time', tomorrowEnd.toISOString()) // Not too far in future
        .not('match_teams', 'ilike', '%sample%') // Exclude sample data
        .not('match_teams', 'ilike', '%demo%') // Exclude demo data
        .not('match_teams', 'ilike', '%test%') // Exclude test data
        .not('pick', 'ilike', '%curry%') // Exclude outdated player props
        .not('pick', 'ilike', '%lebron%') // Exclude potentially stale props
        .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Only picks from last 7 days
        .order('confidence', { ascending: false })
        .order('value_percentage', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        logger.error(`Error fetching stored predictions: ${error.message}`);
        return [];
      }

      if (!predictions || predictions.length === 0) {
        logger.info(`📊 No quality predictions found in database`);
        return [];
      }

      // Additional filtering for duplicates and quality
      const filteredPicks = this.filterAndDeduplicatePicks(predictions);
      const finalPicks = filteredPicks.slice(0, limit);

      logger.info(`📊 Retrieved ${finalPicks.length} high-quality predictions for chat (filtered from ${predictions.length})`);
      return finalPicks;
    } catch (error) {
      logger.error(`Error in getStoredPredictions: ${error}`);
      return [];
    }
  }

  /**
   * Filter duplicates and ensure pick quality
   */
  private filterAndDeduplicatePicks(predictions: any[]): any[] {
    const seen = new Set();
    const validSports = ['MLB', 'NBA', 'NFL', 'NHL'];
    const currentMonth = new Date().getMonth();
    
    return predictions.filter(pick => {
      // Skip if invalid sport
      if (!validSports.includes(pick.sport)) {
        return false;
      }
      
      // Skip NBA picks if it's not NBA season (roughly Oct-June)
      if (pick.sport === 'NBA' && (currentMonth >= 6 && currentMonth <= 9)) {
        logger.info(`🏀 Filtering out NBA pick (off-season): ${pick.match_teams}`);
        return false;
      }
      
      // Skip if looks like player prop for inactive players
      const lowerPick = pick.pick.toLowerCase();
      if (lowerPick.includes('points') || lowerPick.includes('assists') || lowerPick.includes('rebounds')) {
        // This is a player prop - be more cautious
        if (lowerPick.includes('curry') || lowerPick.includes('lebron') || lowerPick.includes('durant')) {
          logger.info(`👤 Filtering out potentially stale player prop: ${pick.pick}`);
          return false;
        }
      }
      
      // Create unique key for deduplication
      const uniqueKey = `${pick.match_teams}-${pick.pick}`;
      
      if (seen.has(uniqueKey)) {
        logger.info(`🔄 Filtering duplicate pick: ${uniqueKey}`);
        return false;
      }
      
      seen.add(uniqueKey);
      return true;
    });
  }

  /**
   * Get specific game analysis from stored predictions
   */
  private async getGameAnalysis(query: string, userId: string): Promise<any | null> {
    try {
      const { supabase } = require('../../services/supabase/client');
      
      // Extract team names from the query
      const teamKeywords = this.extractTeamKeywords(query);
      
      if (teamKeywords.length === 0) {
        return null;
      }

      // Search for predictions matching the teams mentioned
      let searchQuery = supabase
        .from('ai_predictions')
        .select('*')
        .eq('status', 'pending');

      // Build search for team names in match_teams field
      for (const keyword of teamKeywords) {
        searchQuery = searchQuery.ilike('match_teams', `%${keyword}%`);
      }

      const { data: predictions, error } = await searchQuery
        .order('confidence', { ascending: false })
        .limit(1);

      if (error || !predictions || predictions.length === 0) {
        return null;
      }

      const prediction = predictions[0];
      logger.info(`🎯 Found game analysis for: ${prediction.match_teams}`);
      
      return {
        prediction,
        confidence: prediction.confidence >= 75 ? 'High' : prediction.confidence >= 60 ? 'Medium' : 'Low'
      };
    } catch (error) {
      logger.error(`Error in getGameAnalysis: ${error}`);
      return null;
    }
  }

  /**
   * Extract team keywords from user message
   */
  private extractTeamKeywords(message: string): string[] {
    const lowerMessage = message.toLowerCase();
    
    // Common team names and abbreviations to search for
    const teamPatterns = [
      // MLB teams
      'dodgers', 'yankees', 'red sox', 'astros', 'braves', 'mets', 'phillies',
      'padres', 'giants', 'cardinals', 'cubs', 'brewers', 'reds', 'pirates',
      'marlins', 'nationals', 'orioles', 'rays', 'blue jays', 'tigers',
      'twins', 'white sox', 'guardians', 'royals', 'angels', 'athletics',
      'mariners', 'rangers', 'rockies', 'diamondbacks',
      
      // NBA teams
      'lakers', 'warriors', 'celtics', 'heat', 'knicks', 'nets', 'sixers',
      'bucks', 'raptors', 'bulls', 'cavaliers', 'pistons', 'pacers',
      'hawks', 'hornets', 'magic', 'wizards', 'spurs', 'mavericks',
      'rockets', 'grizzlies', 'pelicans', 'thunder', 'jazz', 'nuggets',
      'timberwolves', 'trail blazers', 'kings', 'suns', 'clippers',
      
      // NFL teams (for future)
      'patriots', 'bills', 'dolphins', 'jets', 'steelers', 'ravens',
      'browns', 'bengals', 'titans', 'colts', 'texans', 'jaguars'
    ];
    
    const foundTeams = teamPatterns.filter(team => lowerMessage.includes(team));
    return foundTeams.slice(0, 2); // Max 2 teams for a matchup
  }

  /**
   * Format stored picks for conversational chat
   */
  private formatStoredPicksForChat(picks: any[]): string {
    if (picks.length === 0) {
      return "🤔 I don't have any picks ready right now. Would you like me to generate some fresh predictions?";
    }

    let response = `🎯 Here are my top ${picks.length} AI picks for today:\n\n`;
    
    picks.forEach((pick, index) => {
      const confidence = pick.confidence >= 80 ? '🔥 High' : pick.confidence >= 70 ? '📊 Medium' : '⚠️ Low';
      const value = pick.value_percentage ? ` (${pick.value_percentage.toFixed(1)}% value)` : '';
      
      // Format event time if available
      let timeInfo = '';
      if (pick.event_time) {
        const eventDate = new Date(pick.event_time);
        const now = new Date();
        const isToday = eventDate.toDateString() === now.toDateString();
        const isTomorrow = eventDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
        
        if (isToday) {
          timeInfo = ` • Today ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        } else if (isTomorrow) {
          timeInfo = ` • Tomorrow ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        }
      }
      
      // Add sport emoji
      const sportEmoji = pick.sport === 'MLB' ? '⚾' : 
                        pick.sport === 'NBA' ? '🏀' : 
                        pick.sport === 'NFL' ? '🏈' : 
                        pick.sport === 'NHL' ? '🏒' : '🎯';
      
      response += `**${index + 1}. ${sportEmoji} ${pick.match_teams}**${timeInfo}\n`;
      response += `🎯 **Pick:** ${pick.pick} @ ${pick.odds}\n`;
      response += `📈 **Confidence:** ${confidence} (${pick.confidence}%)${value}\n`;
      
      // Truncate reasoning intelligently
      if (pick.reasoning) {
        let reasoning = pick.reasoning;
        if (reasoning.length > 150) {
          reasoning = reasoning.substring(0, 147) + '...';
        }
        response += `💡 **Analysis:** ${reasoning}\n\n`;
      } else {
        response += `💡 **Analysis:** AI models identified value in this matchup\n\n`;
      }
    });

    response += `💬 Want deeper analysis on any specific game? Just ask! 🎯`;
    return response;
  }

  /**
   * Format game analysis for conversational chat
   */
  private formatGameAnalysisForChat(analysis: any): string {
    const pick = analysis.prediction;
    const confidence = pick.confidence >= 75 ? '🔥 High' : pick.confidence >= 60 ? '📊 Medium' : '⚠️ Low';
    
    let response = `🎯 **${pick.match_teams} Analysis**\n\n`;
    response += `**My Pick:** ${pick.pick} @ ${pick.odds}\n`;
    response += `**Confidence:** ${confidence} (${pick.confidence}%)\n`;
    
    if (pick.value_percentage) {
      response += `**Value:** ${pick.value_percentage.toFixed(1)}% edge detected\n`;
    }
    
    response += `\n**Analysis:**\n${pick.reasoning}\n\n`;
    
    if (pick.roi_estimate) {
      response += `📊 **Expected ROI:** +${pick.roi_estimate.toFixed(1)}%\n`;
    }
    
    response += `\n💬 Questions about this pick? Ask away!`;
    return response;
  }

  /**
   * Format games info for chat
   */
  private formatGamesForChat(gamesData: any): string {
    if (!gamesData.success || gamesData.gamesCount === 0) {
      return "🤔 No games found for today. Check back tomorrow for fresh predictions!";
    }

    let response = `📅 **Today's Games:**\n\n`;
    response += `Found ${gamesData.gamesCount} games available for analysis.\n\n`;
    response += `🎯 Want me to analyze a specific matchup? Just tell me the teams!\n`;
    response += `📊 Or ask for "my best picks" to see pre-analyzed recommendations.`;
    
    return response;
  }
}

// Export functions for use in routes
export const generateProChatResponse = async (
  request: ChatRequest, 
  streamCallback: StreamingCallback
): Promise<ChatResponse> => {
  const orchestrator = new DeepSeekProChatOrchestratorService();
  return await orchestrator.generateStreamingChatResponse(request, streamCallback);
};

export { DeepSeekProChatOrchestratorService, ChatRequest, ChatResponse, StreamingCallback }; 
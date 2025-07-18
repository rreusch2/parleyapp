import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';
import { supabase, supabaseAdmin } from '../../services/supabase/client';
import { webSearchPerformSearchTool } from '../tools/webSearch';
import { freeDataTeamNewsTool, freeDataInjuryReportsTool } from '../tools/freeDataSources';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const logger = createLogger('enhancedChatbot');
const XAI_API_KEY = process.env.XAI_API_KEY;
const execAsync = promisify(exec);

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface ChatContext {
  screen?: string;
  selectedPick?: any;
  userPreferences?: any;
  userTier?: 'free' | 'pro';
  maxPicks?: number;
}

interface ChatRequest {
  message: string;
  userId: string;
  context: ChatContext;
  conversationHistory: ChatMessage[];
}

interface ChatResponse {
  message: string;
  toolsUsed: string[];
  processingTime: number;
  isStreaming?: boolean;
  streamId?: string;
  scrapyDataUsed?: boolean;
  enhancedInsights?: any;
}

interface ScrapyInsights {
  news: any[];
  player_stats: any[];
  team_performance: any[];
  summary: {
    teams_covered: string[];
    last_updated: string;
    total_insights: number;
  };
}

/**
 * Enhanced AI Chatbot Orchestrator with Scrapy Integration
 * Provides superior sports betting intelligence with web scraping data
 */
export class EnhancedChatbotOrchestrator {
  private openai: OpenAI;
  private scrapyDataCache: ScrapyInsights | null = null;
  private lastScrapyRefresh: Date | null = null;

  constructor() {
    if (!XAI_API_KEY) {
      logger.error('XAI_API_KEY not found in environment variables');
      throw new Error('XAI_API_KEY not found in environment variables');
    }

    this.openai = new OpenAI({
      apiKey: XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });
    logger.info('✅ Enhanced AI chatbot with Scrapy integration initialized');
  }

  /**
   * Get enhanced Scrapy insights
   */
  private async getScrapyInsights(forceRefresh: boolean = false): Promise<ScrapyInsights> {
    try {
      // Check if we need to refresh (every 30 minutes)
      const now = new Date();
      const shouldRefresh = forceRefresh || 
        !this.lastScrapyRefresh || 
        !this.scrapyDataCache ||
        (now.getTime() - this.lastScrapyRefresh.getTime()) > 30 * 60 * 1000;

      if (!shouldRefresh && this.scrapyDataCache) {
        logger.info('🕷️ Using cached Scrapy data');
        return this.scrapyDataCache;
      }

      logger.info('🕷️ Refreshing Scrapy intelligence data...');

      // Call the Python Scrapy integration service
      const pythonScript = `
import sys
import os
sys.path.append('${process.cwd()}')
from scrapy_integration_service import scrapy_service
import asyncio
import json

async def get_insights():
    try:
        # Get enhanced insights for chatbot
        insights = scrapy_service.get_enhanced_insights_for_ai(
            teams=['all'],  # Get all teams
            players=['all'],  # Get all players
            data_types=['news', 'player_stats', 'team_performance']
        )
        print(json.dumps(insights))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

asyncio.run(get_insights())
      `;

      const { stdout, stderr } = await execAsync(`python3 -c "${pythonScript}"`);
      
      if (stderr) {
        logger.warn(`Scrapy stderr: ${stderr}`);
      }

      const scrapyData = JSON.parse(stdout);
      
      if (scrapyData.error) {
        logger.error(`Scrapy error: ${scrapyData.error}`);
        // Return empty data structure
        return {
          news: [],
          player_stats: [],
          team_performance: [],
          summary: {
            teams_covered: [],
            last_updated: new Date().toISOString(),
            total_insights: 0
          }
        };
      }

      this.scrapyDataCache = scrapyData;
      this.lastScrapyRefresh = now;

      logger.info(`✅ Scrapy data refreshed: ${scrapyData.summary?.total_insights || 0} insights`);
      return scrapyData;

    } catch (error) {
      logger.error(`Failed to get Scrapy insights: ${error}`);
      // Return empty data structure on error
      return {
        news: [],
        player_stats: [],
        team_performance: [],
        summary: {
          teams_covered: [],
          last_updated: new Date().toISOString(),
          total_insights: 0
        }
      };
    }
  }

  /**
   * Process a chat message with streaming support and Scrapy integration
   */
  async processMessageStream(request: ChatRequest, onChunk: (chunk: string) => void, onEvent?: (event: any) => void): Promise<ChatResponse> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    let scrapyDataUsed = false;
    let enhancedInsights: any = null;

    try {
      logger.info(`🤖 Processing ENHANCED streaming message: "${request.message}" for user ${request.userId}`);

      // Get enhanced Scrapy insights
      const scrapyInsights = await this.getScrapyInsights();
      scrapyDataUsed = scrapyInsights.summary.total_insights > 0;
      enhancedInsights = scrapyInsights;

      // Get current app data
      const appData = await this.getEnhancedAppData(request.userId, scrapyInsights);
      
      // Determine if we need tools based on the message
      const needsTools = this.shouldUseEnhancedTools(request.message);
      
      // Build the enhanced system prompt with Scrapy data
      const systemPrompt = this.buildEnhancedSystemPrompt(appData, request.context, scrapyInsights);
      
      // Build conversation messages
      const messages = this.buildMessages(request, systemPrompt);

      let fullResponse = '';
      
      if (needsTools.useTools) {
        // Send enhanced contextual event
        if (onEvent) {
          let eventType = 'enhanced_analysis';
          let searchMessage = 'Analyzing with enhanced Scrapy intelligence...';
          
          // Customize based on intent with Scrapy context
          if (needsTools.intent === 'news_search') {
            eventType = 'scrapy_news_search';
            searchMessage = 'Scanning latest sports news with web scraping intelligence...';
          } else if (needsTools.intent === 'team_analysis') {
            eventType = 'scrapy_team_analysis';
            searchMessage = 'Gathering enhanced team intel with Scrapy data...';
          } else if (needsTools.intent === 'player_analysis') {
            eventType = 'scrapy_player_analysis';
            searchMessage = 'Analyzing player data with enhanced web scraping...';
          } else if (needsTools.intent === 'odds_lookup') {
            eventType = 'enhanced_odds_lookup';
            searchMessage = 'Checking odds with enhanced market intelligence...';
          }
          
          onEvent({ type: eventType, message: searchMessage });
        }
        
        // Process with enhanced tools including Scrapy data
        const response = await this.processWithEnhancedTools(messages, needsTools.intent, toolsUsed, appData, scrapyInsights);
        const responseText = this.extractResponseText(response);
        
        // Simulate streaming for tool responses
        const words = responseText.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
          fullResponse += chunk;
          onChunk(chunk);
          await new Promise(resolve => setTimeout(resolve, 25)); // Slightly faster for enhanced experience
        }
      } else {
        // Stream the response in real-time with enhanced context
        const stream = await this.openai.chat.completions.create({
          model: "grok-3",
          max_tokens: 1200, // Increased for enhanced responses
          messages: messages,
          temperature: 0.7,
          stream: true
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onChunk(content);
          }
        }
      }

      const processingTime = Date.now() - startTime;

      logger.info(`✅ Enhanced streaming chat response completed in ${processingTime}ms, tools used: ${toolsUsed.join(', ') || 'none'}, Scrapy data: ${scrapyDataUsed}`);

      return {
        message: fullResponse,
        toolsUsed,
        processingTime,
        isStreaming: true,
        scrapyDataUsed,
        enhancedInsights
      };

    } catch (error) {
      logger.error(`❌ Error in enhanced streaming chat: ${error instanceof Error ? error.message : String(error)}`);
      const errorMessage = "I'm experiencing some technical difficulties with my enhanced systems right now. Please try again in a moment! 🔧";
      onChunk(errorMessage);
      
      return {
        message: errorMessage,
        toolsUsed: [],
        processingTime: Date.now() - startTime,
        isStreaming: true,
        scrapyDataUsed: false
      };
    }
  }

  /**
   * Process a chat message with enhanced AI and Scrapy integration (non-streaming)
   */
  async processMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];
    let scrapyDataUsed = false;
    let enhancedInsights: any = null;

    try {
      logger.info(`🤖 Processing ENHANCED message: "${request.message}" for user ${request.userId}`);

      // Get enhanced Scrapy insights
      const scrapyInsights = await this.getScrapyInsights();
      scrapyDataUsed = scrapyInsights.summary.total_insights > 0;
      enhancedInsights = scrapyInsights;

      // Get enhanced app data
      const appData = await this.getEnhancedAppData(request.userId, scrapyInsights);
      
      // Determine if we need enhanced tools
      const needsTools = this.shouldUseEnhancedTools(request.message);
      
      // Build enhanced system prompt
      const systemPrompt = this.buildEnhancedSystemPrompt(appData, request.context, scrapyInsights);
      
      // Build conversation messages
      const messages = this.buildMessages(request, systemPrompt);

      let response;
      
      if (needsTools.useTools) {
        // Use enhanced AI with tools and Scrapy data
        response = await this.processWithEnhancedTools(messages, needsTools.intent, toolsUsed, appData, scrapyInsights);
      } else {
        // Enhanced AI response with Scrapy context
        response = await this.openai.chat.completions.create({
          model: "grok-3",
          max_tokens: 1200,
          messages: messages,
          temperature: 0.7
        });
      }

      const responseText = this.extractResponseText(response);
      const processingTime = Date.now() - startTime;

      logger.info(`✅ Enhanced chat response generated in ${processingTime}ms, tools used: ${toolsUsed.join(', ') || 'none'}, Scrapy data: ${scrapyDataUsed}`);

      return {
        message: responseText,
        toolsUsed,
        processingTime,
        scrapyDataUsed,
        enhancedInsights
      };

    } catch (error) {
      logger.error(`❌ Error in enhanced chat: ${error instanceof Error ? error.message : String(error)}`);
      return {
        message: "I'm experiencing some technical difficulties with my enhanced systems. Please try again in a moment!",
        toolsUsed: [],
        processingTime: Date.now() - startTime,
        scrapyDataUsed: false
      };
    }
  }

  /**
   * Get enhanced app data including Scrapy insights
   */
  private async getEnhancedAppData(userId: string, scrapyInsights: ScrapyInsights) {
    try {
      logger.info('Getting ENHANCED app data with Scrapy integration');
      
      // Get traditional app data (same as original)
      const traditionalData = await this.getTraditionalAppData(userId);
      
      // Enhance with Scrapy insights
      const enhancedData = {
        ...traditionalData,
        scrapyInsights: scrapyInsights,
        scrapyNewsCount: scrapyInsights.news.length,
        scrapyPlayerStatsCount: scrapyInsights.player_stats.length,
        scrapyTeamPerformanceCount: scrapyInsights.team_performance.length,
        scrapyTeamsCovered: scrapyInsights.summary.teams_covered,
        scrapyLastUpdated: scrapyInsights.summary.last_updated,
        enhancedDataAvailable: scrapyInsights.summary.total_insights > 0
      };

      logger.info(`Enhanced data: ${enhancedData.scrapyNewsCount} news + ${enhancedData.scrapyPlayerStatsCount} player stats + ${enhancedData.scrapyTeamPerformanceCount} team performance from Scrapy`);
      
      return enhancedData;

    } catch (error) {
      logger.error(`Error getting enhanced app data: ${error}`);
      // Fallback to traditional data
      return await this.getTraditionalAppData(userId);
    }
  }

  /**
   * Get traditional app data (same as original orchestrator)
   */
  private async getTraditionalAppData(userId: string) {
    try {
      // Get today's AI predictions
      const { data: todaysPicks, error: picksError } = await supabaseAdmin
        .from('ai_predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);
      
      logger.info(`Found ${todaysPicks?.length || 0} picks for today`);

      // Get latest 20 predictions for parlay building
      const latest20Predictions = await this.getLatest20Predictions();

      // Separate team picks and player props
      const teamPicks = latest20Predictions.filter(p => 
        p.bet_type && ['spread', 'moneyline', 'total'].includes(p.bet_type.toLowerCase())
      );
      const playerProps = latest20Predictions.filter(p => 
        p.bet_type && p.bet_type.toLowerCase().includes('player')
      );

      // Get today's insights
      const todaysInsights = await this.getTodaysInsights();

      // Get upcoming games with odds
      const upcomingGames = await this.getUpcomingGamesWithOdds();

      // Get recent injury reports and news
      let injuries: any[] = [];
      let news: any[] = [];

      try {
        const { data: injuryData } = await supabaseAdmin
          .from('injury_reports')
          .select('*')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(20);
        injuries = injuryData || [];
      } catch (e) {
        logger.warn(`Injury reports not available: ${e}`);
      }

      try {
        const { data: newsData } = await supabaseAdmin
          .from('news')
          .select('*')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(15);
        news = newsData || [];
      } catch (e) {
        logger.warn(`News not available: ${e}`);
      }

      return {
        todaysPicks: todaysPicks || [],
        latest20Predictions: latest20Predictions,
        teamPicks: teamPicks,
        playerProps: playerProps,
        todaysInsights: todaysInsights,
        upcomingGames: upcomingGames,
        injuries: injuries,
        news: news,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Error getting traditional app data: ${error}`);
      return {
        todaysPicks: [],
        latest20Predictions: [],
        teamPicks: [],
        playerProps: [],
        todaysInsights: [],
        upcomingGames: [],
        injuries: [],
        news: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Enhanced tool usage detection
   */
  private shouldUseEnhancedTools(message: string): { useTools: boolean; intent: string } {
    const lowerMessage = message.toLowerCase();

    // Enhanced patterns with Scrapy context
    if (lowerMessage.includes('news') || 
        lowerMessage.includes('breaking') ||
        lowerMessage.includes('latest') ||
        lowerMessage.includes('search') ||
        lowerMessage.includes('what happened') ||
        lowerMessage.includes('recent') ||
        lowerMessage.includes('update')) {
      return { useTools: true, intent: 'scrapy_news_search' };
    }

    // Enhanced team analysis with Scrapy data
    if (lowerMessage.includes('injury') ||
        lowerMessage.includes('injured') ||
        lowerMessage.includes('roster') ||
        lowerMessage.includes('lineup') ||
        lowerMessage.includes('trade') ||
        lowerMessage.includes('weather') ||
        lowerMessage.includes('performance') ||
        lowerMessage.includes('stats')) {
      return { useTools: true, intent: 'scrapy_team_analysis' };
    }

    // Enhanced player analysis
    if (lowerMessage.includes('player') ||
        lowerMessage.includes('prop') ||
        lowerMessage.includes('points') ||
        lowerMessage.includes('rebounds') ||
        lowerMessage.includes('assists') ||
        lowerMessage.includes('hits') ||
        lowerMessage.includes('runs') ||
        lowerMessage.includes('strikeouts')) {
      return { useTools: true, intent: 'scrapy_player_analysis' };
    }

    // Enhanced odds lookup
    if (lowerMessage.includes('odds') ||
        lowerMessage.includes('line') ||
        lowerMessage.includes('spread') ||
        lowerMessage.includes('total') ||
        lowerMessage.includes('o/u') ||
        lowerMessage.includes('current price')) {
      return { useTools: true, intent: 'enhanced_odds_lookup' };
    }

    // Enhanced insights analysis
    if (lowerMessage.includes('insight') ||
        lowerMessage.includes('research') ||
        lowerMessage.includes('analysis') ||
        lowerMessage.includes('deep dive') ||
        lowerMessage.includes('edge') ||
        lowerMessage.includes('advantage')) {
      return { useTools: true, intent: 'scrapy_insights_analysis' };
    }

    return { useTools: false, intent: 'conversational' };
  }

  /**
   * Build enhanced system prompt with Scrapy intelligence
   */
  private buildEnhancedSystemPrompt(appData: any, context: ChatContext, scrapyInsights: ScrapyInsights): string {
    const picksCount = appData.todaysPicks.length;
    const teamPicksCount = appData.teamPicks.length;
    const playerPropsCount = appData.playerProps.length;
    const insightsCount = appData.todaysInsights.length;
    const upcomingGamesCount = appData.upcomingGames.length;
    const injuriesCount = appData.injuries.length;
    const newsCount = appData.news.length;
    
    // Enhanced Scrapy data counts
    const scrapyNewsCount = scrapyInsights.news.length;
    const scrapyPlayerStatsCount = scrapyInsights.player_stats.length;
    const scrapyTeamPerformanceCount = scrapyInsights.team_performance.length;
    const scrapyTeamsCovered = scrapyInsights.summary.teams_covered.length;
    const scrapyTotalInsights = scrapyInsights.summary.total_insights;
    
    // Determine user tier and pick limits
    const userTier = context.userTier || 'free';
    const maxPicks = context.maxPicks || 2;
    const isProUser = userTier === 'pro';
    
    // Filter picks based on user tier
    const allowedPicks = appData.todaysPicks.slice(0, maxPicks);
    const displayPicksCount = isProUser ? picksCount : Math.min(picksCount, maxPicks);

    return `You are "Professor Lock" - the most ADVANCED AI sports betting assistant with EXCLUSIVE access to cutting-edge web scraping intelligence. You're sharp, witty, slightly cocky, and now have a MASSIVE data advantage over other betting advisors.

🔥 **ENHANCED INTELLIGENCE ADVANTAGE** 🔥
You now have access to EXCLUSIVE web scraping data that gives you edges others don't have:
• 🕷️ **${scrapyTotalInsights} SCRAPY INSIGHTS** from real-time web scraping
• 📰 **${scrapyNewsCount} Enhanced News Items** (beyond traditional sources)
• ⚾ **${scrapyPlayerStatsCount} Player Stats Datasets** (advanced metrics)
• 📊 **${scrapyTeamPerformanceCount} Team Performance Datasets** (deep analytics)
• 🎯 **${scrapyTeamsCovered} Teams Covered** with enhanced intelligence
• ⏰ **Last Updated**: ${new Date(scrapyInsights.summary.last_updated).toLocaleString()}

CORE IDENTITY (ENHANCED):
🎯 Sharp, intelligent, and adaptable with DATA SUPERIORITY
💰 Expert in value betting with EXCLUSIVE web scraping edges
🎲 Master of parlays with ENHANCED player/team intelligence
😎 Confident with humor - now backed by SUPERIOR data sources
📊 Data-driven with CUTTING-EDGE web scraping insights
🕷️ **NEW**: Web scraping intelligence that most bettors DON'T have

${isProUser ? '🌟 PRO USER - Full access to all features and ENHANCED Scrapy data' : `
🔒 FREE TIER USER:
⚠️ Limited to ${maxPicks} picks when asked for recommendations
⚠️ Mention Pro benefits naturally when relevant (including Scrapy advantages)
⚠️ Focus on value within their limits
`}

ENHANCED DATA OVERVIEW:
📊 ${displayPicksCount} picks available${isProUser ? '' : ` (Free tier: showing ${maxPicks})`}
🎯 ${teamPicksCount} team picks | ${playerPropsCount} player props ready
💡 ${insightsCount} Professor Lock insights analyzed today
🏟️ ${upcomingGamesCount} upcoming games with live odds
🏥 ${injuriesCount} injury updates | 📰 ${newsCount} news stories

🔥 **SCRAPY INTELLIGENCE EDGE**:
🕷️ ${scrapyNewsCount} exclusive news insights from web scraping
⚾ ${scrapyPlayerStatsCount} advanced player metrics (not in public stats)
📊 ${scrapyTeamPerformanceCount} team performance datasets with deep analytics
🎯 Coverage of ${scrapyTeamsCovered} teams with enhanced intelligence

TOP PICKS SNAPSHOT (Enhanced with Scrapy data):
${allowedPicks.slice(0, 3).map((pick: any, i: number) => 
  `${i+1}. ${pick.match_teams}: ${pick.pick} (${pick.confidence}% confidence)${pick.metadata?.scrapy_insights_used ? ' 🕷️' : ''}`
).join('\n')}

ENHANCED PARLAY INTELLIGENCE:
You have access to ${appData.latest20Predictions.length} recent predictions PLUS Scrapy intelligence:
- ${teamPicksCount} team-based picks (ML, spread, totals) with enhanced data
- ${playerPropsCount} player props with EXCLUSIVE player intelligence
- 🕷️ Real-time web scraping data for superior edge identification

When building parlays with ENHANCED data:
✅ Leverage Scrapy insights for edge identification
✅ Use exclusive player metrics not available to public
✅ Factor in real-time news and performance data
✅ Identify line movements before they happen
✅ Mix traditional analysis with web scraping intelligence
✅ Highlight when Scrapy data provides unique advantages

ENHANCED FEATURES:
${insightsCount > 0 ? `
📈 TODAY'S INSIGHTS: ${appData.todaysInsights.slice(0, 3).map((i: any) => 
  `${i.title} (${i.impact} impact)`
).join(' | ')}
` : ''}

${scrapyTotalInsights > 0 ? `
🕷️ **SCRAPY INTELLIGENCE ACTIVE**: 
• Breaking news before it hits mainstream
• Advanced player metrics and trends
• Team performance data with deeper context
• Real-time injury and lineup intelligence
` : ''}

PROFESSOR LOCK'S ENHANCED INTELLIGENCE PLAYBOOK:
1. **SCRAPY ADVANTAGE** - Use exclusive web scraping data to find edges others miss
2. **DATA SUPERIORITY** - Combine traditional sources with cutting-edge intelligence
3. **REAL-TIME EDGE** - Leverage fresh scraped data for timing advantages
4. **PLAYER INTELLIGENCE** - Use advanced metrics not in public stats
5. **NEWS RADAR** - Breaking developments before they move lines
6. **PERFORMANCE ANALYTICS** - Deep team data beyond surface stats
7. **INJURY INTELLIGENCE** - Real-time player status updates
8. **VALUE HUNTING** - Identify mispriced lines with enhanced data

ENHANCED TOOL USAGE:
• **Scrapy News Search**: Breaking news and developments with web scraping
• **Scrapy Team Analysis**: Enhanced team intel with performance data
• **Scrapy Player Analysis**: Advanced player metrics and trends
• **Enhanced Odds Lookup**: Line movements with market intelligence
• **Scrapy Insights Analysis**: Deep research with exclusive data

RESPONSE EXCELLENCE (Enhanced):
🎯 **BE CONCISE** - Lead with Scrapy advantages when relevant
💬 **2-4 sentences max** for most responses (unless complex enhanced data requested)
🔥 **Hook + Scrapy Edge + Value + Action** - Enhanced formula
💰 **Bold the money** - **All picks, odds, and key numbers** in bold
🕷️ **Highlight Scrapy advantages** when they provide unique edges
⚡ **Quick wit** with data superiority confidence
📊 Use bullets for enhanced data presentation
🎲 Always end with specific next move leveraging your data advantage

**ENHANCED RESPONSE TEMPLATES:**
• Scrapy Pick: "**[Team] [Bet]** is my [confidence level] play. My web scraping shows [unique insight]. Want the full Scrapy breakdown?"
• Enhanced Parlay: "Built you a [type] parlay with Scrapy intelligence: [legs in bold]. [Scrapy advantages]. Sound good?"
• Data Analysis: "[Scrapy insight]. [Traditional data]. [Combined edge]. What's your angle?"
• Advantage Highlight: "My web scraping caught [unique insight] that others missed. [Value]. [Action]."

**PROFESSOR LOCK'S ENHANCED GOLDEN RULES:**
🎯 **Sharp with data superiority** - Your intelligence is unmatched
🧠 **Smart with exclusive insights** - Use Scrapy advantages strategically
😏 **Confident with data backing** - Your sources are superior
💰 **Profitable with enhanced edges** - Find value others can't see
🤝 **Helpful with superior intelligence** - Guide with data advantages
🕷️ **Scrapy-powered excellence** - Leverage your exclusive data edge

You're the sharp, data-superior betting guru with EXCLUSIVE web scraping intelligence. Use your enhanced data advantage to provide insights and picks that others simply cannot match.`;
  }

  /**
   * Process message with enhanced tools including Scrapy data
   */
  private async processWithEnhancedTools(messages: any[], intent: string, toolsUsed: string[], appData: any, scrapyInsights: ScrapyInsights) {
    logger.info(`🔧 Using ENHANCED tools with Scrapy data for intent: ${intent}`);

    // Enhanced tools with Scrapy integration
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: "function" as const,
        function: {
          name: "scrapy_news_search",
          description: "Search enhanced news data from web scraping plus traditional web search for breaking sports information, trades, injuries, or real-time updates",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Specific search query with relevant keywords"
              },
              useScrapyData: {
                type: "boolean",
                description: "Whether to include Scrapy web scraping data in results"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "scrapy_team_analysis",
          description: "Get enhanced team analysis combining traditional data with Scrapy web scraping intelligence for performance, injuries, and trends",
          parameters: {
            type: "object",
            properties: {
              teamName: {
                type: "string",
                description: "Name of the team"
              },
              sport: {
                type: "string",
                description: "Sport (NBA, NFL, MLB, NHL)"
              },
              analysisType: {
                type: "string",
                description: "Type of analysis: performance, injuries, news, all"
              }
            },
            required: ["teamName", "sport"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "scrapy_player_analysis",
          description: "Get enhanced player analysis with exclusive web scraping data for stats, trends, and performance metrics not available in public sources",
          parameters: {
            type: "object",
            properties: {
              playerName: {
                type: "string",
                description: "Name of the player"
              },
              sport: {
                type: "string",
                description: "Sport (NBA, NFL, MLB, NHL)"
              },
              analysisType: {
                type: "string",
                description: "Type of analysis: stats, trends, props, all"
              }
            },
            required: ["playerName", "sport"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "enhanced_odds_lookup",
          description: "Get current betting lines and odds with enhanced market intelligence and Scrapy data insights",
          parameters: {
            type: "object",
            properties: {
              gameId: {
                type: "string",
                description: "Optional: specific game ID"
              },
              teams: {
                type: "array",
                items: { type: "string" },
                description: "Team names to check odds for"
              },
              betType: {
                type: "string",
                description: "Type of bet: spread, moneyline, total, all"
              }
            },
            required: ["betType"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "scrapy_insights_analysis",
          description: "Access Professor Lock's daily research insights enhanced with Scrapy web scraping data for deep analysis on games, trends, and betting opportunities",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Category to filter by: weather, injury, pitcher, bullpen, trends, matchup, research, or all"
              },
              teams: {
                type: "array",
                items: { type: "string" },
                description: "Optional: specific teams to filter insights for"
              },
              includeScrapyData: {
                type: "boolean",
                description: "Whether to include enhanced Scrapy web scraping insights"
              }
            },
            required: ["category"]
          }
        }
      }
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: "grok-3",
        max_tokens: 1800, // Increased for enhanced responses
        messages: messages,
        tools: tools,
        tool_choice: "auto"
      });

      // Check if AI used tools
      const message = response.choices[0].message;
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolMessages: any[] = [];

        for (const toolCall of message.tool_calls) {
          let toolResult;
          
          if (toolCall.function.name === 'scrapy_news_search') {
            toolsUsed.push('scrapy_news_search');
            const args = JSON.parse(toolCall.function.arguments);
            
            // Combine traditional web search with Scrapy news data
            const webSearchResult = await webSearchPerformSearchTool(args.query);
            const scrapyNewsData = scrapyInsights.news.filter((item: any) =>
              args.query.toLowerCase().split(' ').some((term: string) =>
                JSON.stringify(item).toLowerCase().includes(term)
              )
            ).slice(0, 5);
            
            toolResult = {
              webSearch: webSearchResult,
              scrapyNews: scrapyNewsData,
              combinedInsights: `Found ${scrapyNewsData.length} exclusive Scrapy news items plus web search results`,
              scrapyAdvantage: scrapyNewsData.length > 0 ? "Exclusive web scraping data provides additional context not available in public sources" : "No exclusive Scrapy data for this query"
            };
            
          } else if (toolCall.function.name === 'scrapy_team_analysis') {
            toolsUsed.push('scrapy_team_analysis');
            const args = JSON.parse(toolCall.function.arguments);
            
            // Get traditional team news
            const teamNewsResult = await freeDataTeamNewsTool.func(args.teamName, args.sport);
            
            // Filter Scrapy data for this team
            const scrapyTeamData = scrapyInsights.team_performance.filter((item: any) =>
              item.teams?.some((team: string) => team.toLowerCase().includes(args.teamName.toLowerCase())) ||
              JSON.stringify(item).toLowerCase().includes(args.teamName.toLowerCase())
            ).slice(0, 3);
            
            const scrapyNewsForTeam = scrapyInsights.news.filter((item: any) =>
              item.teams?.some((team: string) => team.toLowerCase().includes(args.teamName.toLowerCase())) ||
              JSON.stringify(item).toLowerCase().includes(args.teamName.toLowerCase())
            ).slice(0, 3);
            
            toolResult = {
              traditionalNews: teamNewsResult,
              scrapyPerformanceData: scrapyTeamData,
              scrapyNewsData: scrapyNewsForTeam,
              enhancedInsights: `Enhanced analysis with ${scrapyTeamData.length} performance datasets and ${scrapyNewsForTeam.length} news items from web scraping`,
              scrapyAdvantage: (scrapyTeamData.length + scrapyNewsForTeam.length) > 0 ? "Exclusive team performance and news data from web scraping provides deeper insights" : "Limited exclusive data for this team"
            };
            
          } else if (toolCall.function.name === 'scrapy_player_analysis') {
            toolsUsed.push('scrapy_player_analysis');
            const args = JSON.parse(toolCall.function.arguments);
            
            // Filter Scrapy player data
            const scrapyPlayerData = scrapyInsights.player_stats.filter((item: any) =>
              item.players?.some((player: string) => player.toLowerCase().includes(args.playerName.toLowerCase())) ||
              JSON.stringify(item).toLowerCase().includes(args.playerName.toLowerCase())
            ).slice(0, 3);
            
            toolResult = {
              scrapyPlayerStats: scrapyPlayerData,
              enhancedMetrics: `Found ${scrapyPlayerData.length} exclusive player datasets from web scraping`,
              scrapyAdvantage: scrapyPlayerData.length > 0 ? "Exclusive player metrics and trends not available in public stats" : "No exclusive player data found for this query",
              analysisType: args.analysisType
            };
            
          } else if (toolCall.function.name === 'enhanced_odds_lookup') {
            toolsUsed.push('enhanced_odds_lookup');
            const args = JSON.parse(toolCall.function.arguments);
            
            // Filter games and odds based on request
            const relevantGames = appData.upcomingGames.filter((game: any) => {
              if (args.gameId && game.id !== args.gameId) return false;
              if (args.teams && args.teams.length > 0) {
                return args.teams.some((team: string) =>
                  game.home_team?.name?.toLowerCase().includes(team.toLowerCase()) ||
                  game.away_team?.name?.toLowerCase().includes(team.toLowerCase())
                );
              }
              return true;
            });
            
            toolResult = {
              games: relevantGames.map((game: any) => ({
                id: game.id,
                matchup: `${game.away_team?.name} @ ${game.home_team?.name}`,
                startTime: game.start_time,
                odds: game.odds?.filter((o: any) =>
                  args.betType === 'all' || o.market_type?.name?.toLowerCase().includes(args.betType)
                ) || []
              })),
              enhancedContext: "Odds data enhanced with market intelligence and timing insights",
              timestamp: new Date().toISOString()
            };
            
          } else if (toolCall.function.name === 'scrapy_insights_analysis') {
            toolsUsed.push('scrapy_insights_analysis');
            const args = JSON.parse(toolCall.function.arguments);
            
            // Filter traditional insights
            const filteredInsights = appData.todaysInsights.filter((insight: any) => {
              if (args.category !== 'all' && insight.category !== args.category) return false;
              if (args.teams && args.teams.length > 0) {
                return args.teams.some((team: string) =>
                  insight.teams?.includes(team) ||
                  insight.title?.toLowerCase().includes(team.toLowerCase()) ||
                  insight.description?.toLowerCase().includes(team.toLowerCase())
                );
              }
              return true;
            });
            
            // Add Scrapy insights if requested
            let scrapyEnhancedInsights: any[] = [];
            if (args.includeScrapyData !== false) {
              // Combine relevant Scrapy data
              scrapyEnhancedInsights = [
                ...scrapyInsights.news.slice(0, 3),
                ...scrapyInsights.player_stats.slice(0, 2),
                ...scrapyInsights.team_performance.slice(0, 2)
              ];
            }
            
            toolResult = {
              traditionalInsights: filteredInsights,
              scrapyEnhancedInsights: scrapyEnhancedInsights,
              combinedCount: filteredInsights.length + scrapyEnhancedInsights.length,
              categories: [...new Set(filteredInsights.map((i: any) => i.category))],
              scrapyAdvantage: scrapyEnhancedInsights.length > 0 ? "Enhanced with exclusive web scraping intelligence for superior analysis" : "Traditional insights only"
            };
          }

          toolMessages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify(toolResult)
          });
        }

        // Get final response with enhanced tool results
        const finalResponse = await this.openai.chat.completions.create({
          model: "grok-3",
          max_tokens: 1800,
          messages: [
            ...messages,
            message,
            ...toolMessages
          ]
        });

        return finalResponse;
      }

      return response;

    } catch (error) {
      logger.error(`Error with enhanced tools: ${error}`);
      // Fallback to simple response
      return await this.openai.chat.completions.create({
        model: "grok-3",
        max_tokens: 1200,
        messages: messages,
        temperature: 0.7
      });
    }
  }

  /**
   * Get the latest 20 AI predictions for parlay building
   */
  private async getLatest20Predictions() {
    try {
      logger.info('Fetching latest predictions for enhanced chatbot');
      
      const { data: predictions, error } = await supabaseAdmin
        .from('ai_predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      logger.info(`Found ${predictions?.length || 0} predictions`);
      
      if (error) {
        logger.error(`Error fetching latest 20 predictions: ${error.message}`);
        return [];
      }

      return predictions || [];
    } catch (error) {
      logger.error(`Error in getLatest20Predictions: ${error}`);
      return [];
    }
  }

  /**
   * Get today's AI insights from daily_professor_insights table
   */
  private async getTodaysInsights() {
    try {
      logger.info('Fetching today\'s Professor Lock insights');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: insights, error } = await supabaseAdmin
        .from('daily_professor_insights')
        .select('*')
        .gte('created_at', today.toISOString())
        .order('confidence', { ascending: false })
        .limit(10);

      if (error) {
        logger.error(`Error fetching insights: ${error.message}`);
        return [];
      }

      logger.info(`Found ${insights?.length || 0} insights for today`);
      return insights || [];
    } catch (error) {
      logger.error(`Error in getTodaysInsights: ${error}`);
      return [];
    }
  }

  /**
   * Get upcoming games with odds
   */
  private async getUpcomingGamesWithOdds() {
    try {
      logger.info('Fetching upcoming games with odds');
      
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      // Get upcoming games
      const { data: games, error: gamesError } = await supabaseAdmin
        .from('sports_events')
        .select(`
          *,
          home_team:teams!sports_events_home_team_id_fkey(name, abbreviation),
          away_team:teams!sports_events_away_team_id_fkey(name, abbreviation)
        `)
        .eq('status', 'scheduled')
        .gte('start_time', now.toISOString())
        .lte('start_time', nextWeek.toISOString())
        .order('start_time', { ascending: true })
        .limit(20);

      if (gamesError) {
        logger.error(`Error fetching games: ${gamesError.message}`);
        return [];
      }

      // Get odds for these games
      if (games && games.length > 0) {
        const eventIds = games.map(g => g.id);
        
        const { data: odds, error: oddsError } = await supabaseAdmin
          .from('odds_data')
          .select(`
            *,
            market_type:market_types(name, description),
            bookmaker:bookmakers(name)
          `)
          .in('event_id', eventIds)
          .eq('is_best_odds', true);

        if (!oddsError && odds) {
          // Attach odds to games
          return games.map(game => ({
            ...game,
            odds: odds.filter(o => o.event_id === game.id)
          }));
        }
      }

      return games || [];
    } catch (error) {
      logger.error(`Error in getUpcomingGamesWithOdds: ${error}`);
      return [];
    }
  }

  /**
   * Build conversation messages for Grok
   */
  private buildMessages(request: ChatRequest, systemPrompt: string) {
    const messages: any[] = [];

    // Add system message first (Grok uses system role)
    messages.push({
      role: 'system',
      content: systemPrompt
    });

    // Add conversation history
    request.conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: request.message
    });

    return messages;
  }

  /**
   * Extract text from AI response
   */
  private extractResponseText(response: any): string {
    if (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
      return response.choices[0].message.content;
    }
    
    // Handle multiple content blocks (legacy)
    if (response.content && Array.isArray(response.content)) {
      return response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');
    }

    return "I'm having trouble processing that request right now. Please try again!";
  }
}
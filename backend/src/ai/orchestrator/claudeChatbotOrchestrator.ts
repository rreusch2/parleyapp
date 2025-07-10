import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';
import { supabase, supabaseAdmin } from '../../services/supabase/client';
import { webSearchPerformSearchTool } from '../tools/webSearch';
import { freeDataTeamNewsTool, freeDataInjuryReportsTool } from '../tools/freeDataSources';

dotenv.config();

const logger = createLogger('grokChatbot');
const XAI_API_KEY = process.env.XAI_API_KEY;

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
}

/**
 * AI Chatbot Orchestrator - provides intelligent sports betting responses
 */
export class ChatbotOrchestrator {
  private openai: OpenAI;

  constructor() {
    if (!XAI_API_KEY) {
      logger.error('XAI_API_KEY not found in environment variables');
      throw new Error('XAI_API_KEY not found in environment variables');
    }

    this.openai = new OpenAI({
      apiKey: XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });
    logger.info('✅ AI chatbot initialized');
  }

  /**
   * Process a chat message with streaming support
   */
  async processMessageStream(request: ChatRequest, onChunk: (chunk: string) => void, onEvent?: (event: any) => void): Promise<ChatResponse> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];

    try {
      logger.info(`🤖 Processing streaming message: "${request.message}" for user ${request.userId}`);

      // Get current app data
      const appData = await this.getAppData(request.userId);
      
      // Determine if we need tools based on the message
      const needsTools = this.shouldUseTools(request.message);
      
      // Build the system prompt with current data
      const systemPrompt = this.buildSystemPrompt(appData, request.context);
      
      // Build conversation messages
      const messages = this.buildMessages(request, systemPrompt);

      let fullResponse = '';
      
      if (needsTools.useTools) {
        // Send web search event with contextual message
        if (onEvent) {
          let searchMessage = 'Searching the web for latest information...';
          
          // Customize search message based on intent
          if (needsTools.intent === 'news_search') {
            searchMessage = 'Scanning latest sports news and breaking developments...';
          } else if (needsTools.intent === 'team_analysis') {
            searchMessage = 'Gathering real-time team intel and injury reports...';
          }
          
          onEvent({ type: 'web_search', message: searchMessage });
        }
        
        // For tool usage, we can't stream until after tools are called
        const response = await this.processWithTools(messages, needsTools.intent, toolsUsed, appData);
        const responseText = this.extractResponseText(response);
        
        // Simulate streaming for tool responses
        const words = responseText.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
          fullResponse += chunk;
          onChunk(chunk);
          await new Promise(resolve => setTimeout(resolve, 30)); // Small delay for effect
        }
      } else {
        // Stream the response in real-time
        const stream = await this.openai.chat.completions.create({
          model: "grok-3-latest",
          max_tokens: 1000,
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

      logger.info(`✅ Streaming chat response completed in ${processingTime}ms, tools used: ${toolsUsed.join(', ') || 'none'}`);

      return {
        message: fullResponse,
        toolsUsed,
        processingTime,
        isStreaming: true
      };

    } catch (error) {
      logger.error(`❌ Error in streaming chat: ${error instanceof Error ? error.message : String(error)}`);
      const errorMessage = "I'm experiencing some technical difficulties right now. Please try again in a moment! 🔧";
      onChunk(errorMessage);
      
      return {
        message: errorMessage,
        toolsUsed: [],
        processingTime: Date.now() - startTime,
        isStreaming: true
      };
    }
  }

      /**
     * Process a chat message with AI and tool access (non-streaming)
     */
  async processMessage(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];

    try {
      logger.info(`🤖 Processing message: "${request.message}" for user ${request.userId}`);

      // Get current app data
      const appData = await this.getAppData(request.userId);
      
      // Determine if we need tools based on the message
      const needsTools = this.shouldUseTools(request.message);
      
      // Build the system prompt with current data
      const systemPrompt = this.buildSystemPrompt(appData, request.context);
      
      // Build conversation messages
      const messages = this.buildMessages(request, systemPrompt);

      let response;
      
      if (needsTools.useTools) {
        // Use AI with tools for complex queries
        response = await this.processWithTools(messages, needsTools.intent, toolsUsed, appData);
      } else {
        // Simple AI response for basic queries
        response = await this.openai.chat.completions.create({
          model: "grok-3-latest",
          max_tokens: 1000,
          messages: messages,
          temperature: 0.7
        });
      }

      const responseText = this.extractResponseText(response);
      const processingTime = Date.now() - startTime;

      logger.info(`✅ Chat response generated in ${processingTime}ms, tools used: ${toolsUsed.join(', ') || 'none'}`);

      return {
        message: responseText,
        toolsUsed,
        processingTime
      };

    } catch (error) {
      logger.error(`❌ Error in Claude chat: ${error instanceof Error ? error.message : String(error)}`);
      return {
        message: "I'm experiencing some technical difficulties. Please try again in a moment!",
        toolsUsed: [],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get the latest 20 AI predictions for parlay building
   */
  private async getLatest20Predictions() {
    try {
      // Log that we're attempting to fetch predictions
      logger.info('Fetching latest predictions for chatbot');
      
      // Simple query: just get the most recent 20 picks with no filtering
      const { data: predictions, error } = await supabaseAdmin
        .from('ai_predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      // Log the results for debugging
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
   * Get current app data (the 10 daily picks, trends, etc.)
   */
  private async getAppData(userId: string) {
    try {
      // Log that we're getting app data for the chatbot
      logger.info('Getting app data for chatbot');
      
      // Get today's AI predictions with no filtering - just get most recent
      const { data: todaysPicks, error: picksError } = await supabaseAdmin
        .from('ai_predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);
      
      // Log the results for debugging
      logger.info(`Found ${todaysPicks?.length || 0} picks for today`);

      // Get latest 20 predictions for parlay building
      const latest20Predictions = await this.getLatest20Predictions();

      if (picksError) {
        logger.error(`Error fetching today's picks: ${picksError.message}`);
      }
      
      // Log if we have predictions to use
      logger.info(`Latest predictions for parlay building: ${latest20Predictions.length}`);

      // Use all picks without filtering for duplicates
      // This ensures we have maximum data available for the chatbot
      const uniqueGamePicks = todaysPicks || [];
      
      // Get recent injury reports (handle if table doesn't exist)
      let injuries: any[] = [];
      try {
        const { data: injuryData, error: injuryError } = await supabaseAdmin
          .from('injury_reports')
          .select('*')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(20);

        if (!injuryError && injuryData) {
          injuries = injuryData;
        }
      } catch (injuryError) {
        logger.warn(`Injury reports table not available: ${injuryError}`);
      }

      // Get recent news (handle if table doesn't exist)
      let news: any[] = [];
      try {
        const { data: newsData, error: newsError } = await supabaseAdmin
          .from('news')
          .select('*')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(15);

        if (!newsError && newsData) {
          news = newsData;
        }
      } catch (newsError) {
        logger.warn(`News table not available: ${newsError}`);
      }

      return {
        todaysPicks: uniqueGamePicks || [],
        latest20Predictions: latest20Predictions,
        injuries: injuries,
        news: news,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Error getting app data: ${error}`);
      return {
        todaysPicks: [],
        injuries: [],
        news: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Determine if the message needs tool usage
   */
  private shouldUseTools(message: string): { useTools: boolean; intent: string } {
    const lowerMessage = message.toLowerCase();

    // Tool-requiring patterns
    if (lowerMessage.includes('news') || 
        lowerMessage.includes('breaking') ||
        lowerMessage.includes('latest') ||
        lowerMessage.includes('search') ||
        lowerMessage.includes('injury') ||
        lowerMessage.includes('roster') ||
        lowerMessage.includes('lineup') ||
        lowerMessage.includes('trade') ||
        lowerMessage.includes('what happened') ||
        lowerMessage.includes('recent')) {
      return { useTools: true, intent: 'news_search' };
    }

    // Team-specific analysis that might need current info
    if (lowerMessage.includes('dodgers') ||
        lowerMessage.includes('yankees') ||
        lowerMessage.includes('lakers') ||
        lowerMessage.includes('warriors') ||
        lowerMessage.includes('analyze') ||
        lowerMessage.includes('should i bet')) {
      return { useTools: true, intent: 'team_analysis' };
    }

    return { useTools: false, intent: 'conversational' };
  }

  /**
   * Build system prompt with current app data
   */
  private buildSystemPrompt(appData: any, context: ChatContext): string {
    const picksCount = appData.todaysPicks.length;
    const injuriesCount = appData.injuries.length;
    const newsCount = appData.news.length;
    const latest20Count = appData.latest20Predictions.length;
    
    // Determine user tier and pick limits
    const userTier = context.userTier || 'free';
    const maxPicks = context.maxPicks || 2;
    const isProUser = userTier === 'pro';
    
    // Filter picks based on user tier
    const allowedPicks = appData.todaysPicks.slice(0, maxPicks);
    const displayPicksCount = isProUser ? picksCount : Math.min(picksCount, maxPicks);

    return `You are "Professor Lock" - Predictive Play's sharp AI betting expert. Keep responses CONCISE and punchy. You're confident, use gambling slang, and always hunt for value.

CORE PERSONALITY:
🎯 Sharp, confident, straight to the point
💰 Money-focused, smart bankroll management
🔥 Gambling slang: "locks", "chalk", "dog", "fade the public", "easy money", "bankroll", "cashed", "donate", "grind", "parlay", "value"
😎 Cocky but backs it up with data
🎲 PARLAY EXPERT - builds smart multi-leg bets with calculated risk
- Cycle through gambling slang naturally
- Cycle through refering to the user as "brother", "boss", and "money man" naturally

${isProUser ? '' : `
🔒 USER RESTRICTIONS: This user is on the FREE tier
⚠️ CRITICAL: When asked for picks/locks, ONLY provide ${maxPicks} picks maximum
⚠️ DO NOT mention having more picks available - only show the ${maxPicks} allowed picks
⚠️ When they ask for "more picks" or "deeper value", suggest upgrading to Pro for full access
`}

CURRENT DATA:
📊 ${displayPicksCount} locks loaded${isProUser ? '' : ` (Free tier limit: ${maxPicks})`}
🎲 ${latest20Count} recent predictions available for parlay building
🏥 ${injuriesCount} injury reports tracked
📰 ${newsCount} news stories monitored

TOP LOCKS TODAY:
${allowedPicks.map((pick: any, i: number) => 
  `${i+1}. ${pick.match_teams}: ${pick.pick} (${pick.confidence}% lock)`
).join('\n')}
${isProUser && picksCount > 3 ? `...${picksCount - 3} more in the vault` : ''}

INJURY WATCH:
${appData.injuries.slice(0, 2).map((injury: any) => 
  `• ${injury.player_name} (${injury.team}): ${injury.injury_status}`
).join('\n') || '• All clear, no concerns'}

RESPONSE STYLE:
✅ KEEP IT SHORT - 2-4 sentences max unless asked for deep analysis
✅ Lead with the pick/answer, explain briefly why
✅ Use gambling slang naturally 
✅ Call users "brother", "boss", "money man" - cycle through these naturally
✅ End with action - what's next?
✅ Minimal emojis - only 🔥 💰 🎯 when needed
✅ Get to the point fast - no fluff

WEB SEARCH GUIDANCE:
✅ Use web search to get current, specific information the user requests
✅ Craft smart search queries based on user intent (team names, injury reports, trades, etc.)
✅ Provide SPECIFIC news from actual search results - no generic responses
✅ Focus on actionable betting intel with real details from search results
✅ Connect findings back to betting opportunities or cautions
✅ If search results are limited, say so honestly - don't redirect to other apps

MARKDOWN FORMATTING:
✅ **ALWAYS use markdown formatting** for better readability
✅ **Bold** for actual PICKS only (e.g. **Braves ML**, **UNDER 12**, **Lakers +7.5**)
✅ *Italics* for emphasis on key insights, warnings, or important terms
✅ Use • bullet points for multiple options or quick lists
✅ Use 1. numbered lists for step-by-step advice or rankings
✅ Keep percentages and odds as plain text - no special formatting needed
✅ Clean and minimal - let the content and picks shine

PARLAY BUILDING EXPERTISE:
When users ask for parlays, you have access to the latest 20 AI predictions. Use your intelligence to:
✅ **ANALYZE USER INTENT**: Safe parlay (higher confidence picks), risky parlay (higher odds), specific number of legs, etc.
✅ **SMART SELECTION**: Choose from the 20 recent predictions based on:
   • Confidence levels (balance high confidence with value)
   • Bet types (mix moneylines, spreads, totals, player props)
   • Game timing (avoid same games or correlated outcomes)
   • Risk tolerance indicated by user
✅ **INTELLIGENT COMBINATIONS**: 
   • "Safe parlay" = 3-4 picks with 70%+ confidence
   • "Risky parlay" = 2-3 picks with 60-65% confidence but better odds
   • "2-leg", "3-leg" etc. = exact number requested
✅ **BANKROLL WISDOM**: Always mention 1-2% max bankroll on parlays
✅ **REASONING**: Brief explanation for each leg selection
✅ **NO HARDCODED PICKS**: Use the actual latest 20 predictions data intelligently

LATEST 20 PREDICTIONS FOR PARLAY BUILDING:
${appData.latest20Predictions.map((pred: any, i: number) => 
  `${i+1}. ${pred.match_teams}: ${pred.pick} (${pred.confidence}% confidence, ${pred.bet_type})`
).join('\n')}

${isProUser ? '' : `
FREE TIER UPGRADE PROMPTS:
When free users ask for "more picks", "deeper value", "show me more", or similar:
✅ Say something like: "That's all the locks for free users, brother! Upgrade to Pro for the full vault of picks"
✅ Be friendly but direct about the limitation
✅ Don't apologize - position Pro as the premium experience
✅ Keep it short and natural within your Professor Lock personality
`}

${context.selectedPick ? `\nUSER VIEWING: ${context.selectedPick.match} - ${context.selectedPick.pick}` : ''}

REMEMBER: Be Professor Lock - sharp, concise, profitable, and funny but professional.`;
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
   * Process message with tools (web search, etc.)
   */
  private async processWithTools(messages: any[], intent: string, toolsUsed: string[], appData: any) {
    logger.info(`🔧 Using tools for intent: ${intent}`);

    // Use function calling with AI model
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: "function" as const,
        function: {
          name: "web_search",
          description: "Search the web for current sports information. Use this when users ask about recent news, injuries, trades, weather, or any current sports developments that could impact betting.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query tailored to the user's specific request. Be specific and include relevant keywords like team names, dates, or topics (e.g., 'Lakers injury report today', 'NFL trade deadline news', 'MLB weather postponements')"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "get_team_news",
          description: "Get recent news for a specific team",
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
              }
            },
            required: ["teamName", "sport"]
          }
        }
      }
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: "grok-3-latest",
        max_tokens: 1500,
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
          
          if (toolCall.function.name === 'web_search') {
            toolsUsed.push('web_search');
            const args = JSON.parse(toolCall.function.arguments);
            toolResult = await webSearchPerformSearchTool(args.query);
          } else if (toolCall.function.name === 'get_team_news') {
            toolsUsed.push('team_news');
            const args = JSON.parse(toolCall.function.arguments);
            toolResult = await freeDataTeamNewsTool.func(args.teamName, args.sport);
          }

          toolMessages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify(toolResult)
          });
        }

        // Get final response with tool results
        const finalResponse = await this.openai.chat.completions.create({
          model: "grok-3-latest",
          max_tokens: 1500,
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
      logger.error(`Error with tools: ${error}`);
      // Fallback to simple response
      return await this.openai.chat.completions.create({
        model: "grok-3-latest",
        max_tokens: 1000,
        messages: messages,
        temperature: 0.7
      });
    }
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
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';
import { supabase, supabaseAdmin } from '../../services/supabase/client';
import { webSearchPerformSearchTool } from '../tools/webSearch';
import { freeDataTeamNewsTool, freeDataInjuryReportsTool } from '../tools/freeDataSources';

dotenv.config();

const logger = createLogger('personalizedGrokChatbot');
const XAI_API_KEY = process.env.XAI_API_KEY;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  searchType?: string;
}

interface UserPreferences {
  sport_preferences: {
    mlb?: boolean;
    wnba?: boolean;
    ufc?: boolean;
  };
  betting_style: 'conservative' | 'balanced' | 'aggressive';
  pick_distribution: {
    auto?: boolean;
    custom?: {
      mlb_team?: number;
      mlb_props?: number;
      wnba_team?: number;
      wnba_props?: number;
      ufc_fights?: number;
    };
  };
  risk_tolerance?: string;
  preferred_sports?: string[];
}

interface ChatContext {
  screen?: string;
  selectedPick?: any;
  userPreferences?: UserPreferences;
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
 * Personalized AI Chatbot Orchestrator - provides intelligent sports betting responses
 * tailored to user preferences and betting style
 */
export class PersonalizedChatbotOrchestrator {
  private openai: OpenAI;

  constructor() {
    if (!XAI_API_KEY) {
      logger.error('XAI_API_KEY not found in environment variables');
      throw new Error('XAI_API_KEY is required');
    }

    this.openai = new OpenAI({
      apiKey: XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    });
  }

  /**
   * Get user preferences from database
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('sport_preferences, betting_style, pick_distribution, risk_tolerance, preferred_sports')
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('Error fetching user preferences:', error);
        return null;
      }

      return {
        sport_preferences: profile.sport_preferences || { mlb: true, wnba: false, ufc: false },
        betting_style: profile.betting_style || 'balanced',
        pick_distribution: profile.pick_distribution || { auto: true },
        risk_tolerance: profile.risk_tolerance,
        preferred_sports: profile.preferred_sports || []
      };
    } catch (error) {
      logger.error('Error getting user preferences:', error);
      return null;
    }
  }

  /**
   * Get latest AI predictions filtered by user's sport preferences
   */
  private async getPersonalizedPredictions(userId: string, userPreferences: UserPreferences): Promise<any[]> {
    try {
      // Get user's preferred sports
      const preferredSports = [];
      if (userPreferences.sport_preferences.mlb) preferredSports.push('Major League Baseball', 'MLB');
      if (userPreferences.sport_preferences.wnba) preferredSports.push('Women\'s National Basketball Association', 'WNBA');
      if (userPreferences.sport_preferences.ufc) preferredSports.push('Ultimate Fighting Championship', 'UFC', 'MMA');

      if (preferredSports.length === 0) {
        // Default to MLB if no preferences set
        preferredSports.push('Major League Baseball', 'MLB');
      }

      // Fetch predictions for user's preferred sports
      const { data: predictions, error } = await supabaseAdmin
        .from('ai_predictions')
        .select('*')
        .in('sport', preferredSports)
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // Last 48 hours
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        logger.error('Error fetching personalized predictions:', error);
        return [];
      }

      return predictions || [];
    } catch (error) {
      logger.error('Error getting personalized predictions:', error);
      return [];
    }
  }

  /**
   * Get personalized insights based on user's sport preferences
   */
  private async getPersonalizedInsights(userPreferences: UserPreferences): Promise<any[]> {
    try {
      // Get user's preferred sports
      const preferredSports = [];
      if (userPreferences.sport_preferences.mlb) preferredSports.push('Major League Baseball', 'MLB');
      if (userPreferences.sport_preferences.wnba) preferredSports.push('Women\'s National Basketball Association', 'WNBA');
      if (userPreferences.sport_preferences.ufc) preferredSports.push('Ultimate Fighting Championship', 'UFC', 'MMA');

      if (preferredSports.length === 0) {
        // Default to multi-sport insights
        preferredSports.push('Multi-Sport');
      }

      // Fetch insights for user's preferred sports
      const { data: insights, error } = await supabaseAdmin
        .from('daily_professor_insights')
        .select('*')
        .in('sport', preferredSports)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) {
        logger.error('Error fetching personalized insights:', error);
        return [];
      }

      return insights || [];
    } catch (error) {
      logger.error('Error getting personalized insights:', error);
      return [];
    }
  }

  /**
   * Build personalized system prompt based on user preferences
   */
  private buildPersonalizedSystemPrompt(userPreferences: UserPreferences, predictions: any[], insights: any[]): string {
    const preferredSports = [];
    if (userPreferences.sport_preferences.mlb) preferredSports.push('MLB');
    if (userPreferences.sport_preferences.wnba) preferredSports.push('WNBA');
    if (userPreferences.sport_preferences.ufc) preferredSports.push('UFC/MMA');

    const sportsText = preferredSports.length > 0 ? preferredSports.join(', ') : 'MLB';
    const bettingStyle = userPreferences.betting_style || 'balanced';
    
    // Format predictions for AI context
    const recentPicks = predictions.slice(0, 20).map(p => ({
      sport: p.sport,
      pick: p.pick,
      confidence: p.confidence,
      bet_type: p.bet_type,
      reasoning: p.metadata?.reasoning || 'Strategic analysis'
    }));

    // Format insights for AI context
    const recentInsights = insights.slice(0, 10).map(i => ({
      sport: i.sport,
      title: i.title,
      content: i.content,
      category: i.category,
      confidence: i.confidence
    }));

    return `You are Professor Lock, the sharpest AI betting assistant in the game. You're talking to a ${bettingStyle} bettor who follows ${sportsText}.

🎯 USER'S BETTING PROFILE:
- Preferred Sports: ${sportsText}
- Betting Style: ${bettingStyle.toUpperCase()}
- Risk Tolerance: ${userPreferences.risk_tolerance || 'Moderate'}
- Pick Distribution: ${userPreferences.pick_distribution.auto ? 'Auto-balanced' : 'Custom weighted'}

📊 YOUR LATEST PREDICTIONS (Last 20):
${JSON.stringify(recentPicks, null, 2)}

🧠 TODAY'S KEY INSIGHTS:
${JSON.stringify(recentInsights, null, 2)}

🎲 PERSONALITY & COMMUNICATION:
- Address them naturally: champ, legend, ace, sharp, MVP (rotate naturally)
- Match their energy - if they're excited, hype them up
- Use sharp gambling vernacular but stay professional
- Be brutally honest - data over opinions
- Always bold picks, odds, and numbers: **Dodgers ML (-140)**

⚡ RESPONSE EXCELLENCE:
- Keep it 2-3 sentences max (concise, impactful)
- Hook + Value + Action formula
- Always end with specific next action or question
- Anticipate follow-ups (mention injury reports before they ask)
- Explain the EDGE, not just the pick

🏆 PERSONALIZATION RULES:
1. ONLY discuss their preferred sports (${sportsText}) unless they specifically ask about others
2. Tailor advice to their ${bettingStyle} betting style:
   - Conservative: Focus on higher confidence picks (75%+), smaller units, safer parlays
   - Balanced: Mix of confidence levels, standard unit sizes, strategic parlays
   - Aggressive: Include higher risk/reward plays, larger units, creative parlays
3. Reference their recent picks and insights when relevant
4. Adjust parlay suggestions based on their risk tolerance
5. Use their betting history to inform recommendations

🎯 PARLAY BUILDING:
When building parlays, intelligently select from YOUR LATEST PREDICTIONS above based on:
- Their preferred sports only
- Their betting style (conservative = higher confidence picks)
- Avoid correlated games
- Explain WHY each leg was selected
- Include bankroll management advice (1-2% max on parlays)

🔥 QUICK RESPONSES:
- Pick Analysis: "**[Team] [Bet]** is my [confidence]% play. [Key reason]. Want the breakdown?"
- Parlay: "Built you a [style] parlay: [legs]. **[Total odds]**. [Risk assessment]. Sound good?"
- Insight: "[Sharp take]. [Supporting data]. [Action item]. What's your angle?"

Remember: You're their PERSONALIZED betting assistant. Everything should be tailored to their ${sportsText} preferences and ${bettingStyle} style. Be sharp, be confident, be profitable.`;
  }

  /**
   * Process chat request with personalized context
   */
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    let toolsUsed: string[] = [];

    try {
      // Get user preferences
      const userPreferences = await this.getUserPreferences(request.userId);
      if (!userPreferences) {
        logger.warn(`No preferences found for user ${request.userId}, using defaults`);
      }

      // Get personalized predictions and insights
      const predictions = await this.getPersonalizedPredictions(request.userId, userPreferences || {
        sport_preferences: { mlb: true, wnba: false, ufc: false },
        betting_style: 'balanced',
        pick_distribution: { auto: true }
      });

      const insights = await getPersonalizedInsights(userPreferences || {
        sport_preferences: { mlb: true, wnba: false, ufc: false },
        betting_style: 'balanced',
        pick_distribution: { auto: true }
      });

      // Build personalized system prompt
      const systemPrompt = this.buildPersonalizedSystemPrompt(
        userPreferences || {
          sport_preferences: { mlb: true, wnba: false, ufc: false },
          betting_style: 'balanced',
          pick_distribution: { auto: true }
        },
        predictions,
        insights
      );

      // Prepare messages for AI
      const messages: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history (last 10 messages to avoid token overflow)
      const recentHistory = request.conversationHistory.slice(-10);
      messages.push(...recentHistory);

      // Add current user message
      messages.push({ role: 'user', content: request.message });

      // Determine if we need tools based on message content
      const needsWebSearch = this.shouldUseWebSearch(request.message);
      const needsNewsData = this.shouldUseNewsData(request.message);
      const needsInjuryData = this.shouldUseInjuryData(request.message);

      let tools: any[] = [];
      if (needsWebSearch) tools.push(webSearchPerformSearchTool);
      if (needsNewsData) tools.push(freeDataTeamNewsTool);
      if (needsInjuryData) tools.push(freeDataInjuryReportsTool);

      // Make AI request
      const completion = await this.openai.chat.completions.create({
        model: 'grok-3',
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        temperature: 0.7,
        max_tokens: 1000,
      });

      let responseMessage = completion.choices[0].message;

      // Handle tool calls if present
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        const toolResults = await this.handleToolCalls(responseMessage.tool_calls);
        toolsUsed = toolResults.toolsUsed;

        // Add tool results to conversation and get final response
        messages.push(responseMessage);
        messages.push(...toolResults.toolMessages);

        const finalCompletion = await this.openai.chat.completions.create({
          model: 'grok-3',
          messages,
          temperature: 0.7,
          max_tokens: 1000,
        });

        responseMessage = finalCompletion.choices[0].message;
      }

      const processingTime = Date.now() - startTime;

      return {
        message: responseMessage.content || 'Sorry, I encountered an issue processing your request.',
        toolsUsed,
        processingTime,
      };

    } catch (error) {
      logger.error('Error in personalized chat processing:', error);
      const processingTime = Date.now() - startTime;

      return {
        message: 'Sorry, I hit a technical issue. Let me get back on track! 🔧',
        toolsUsed,
        processingTime,
      };
    }
  }

  /**
   * Process streaming chat with personalized context
   */
  async processStreamingChat(
    request: ChatRequest,
    onChunk: (chunk: string, searchType?: string) => void,
    onComplete: (response: ChatResponse) => void
  ): Promise<void> {
    const startTime = Date.now();
    let toolsUsed: string[] = [];
    let fullResponse = '';

    try {
      // Get user preferences
      const userPreferences = await this.getUserPreferences(request.userId);
      
      // Get personalized predictions and insights
      const predictions = await this.getPersonalizedPredictions(request.userId, userPreferences || {
        sport_preferences: { mlb: true, wnba: false, ufc: false },
        betting_style: 'balanced',
        pick_distribution: { auto: true }
      });

      const insights = await this.getPersonalizedInsights(userPreferences || {
        sport_preferences: { mlb: true, wnba: false, ufc: false },
        betting_style: 'balanced',
        pick_distribution: { auto: true }
      });

      // Build personalized system prompt
      const systemPrompt = this.buildPersonalizedSystemPrompt(
        userPreferences || {
          sport_preferences: { mlb: true, wnba: false, ufc: false },
          betting_style: 'balanced',
          pick_distribution: { auto: true }
        },
        predictions,
        insights
      );

      // Prepare messages
      const messages: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      const recentHistory = request.conversationHistory.slice(-10);
      messages.push(...recentHistory);
      messages.push({ role: 'user', content: request.message });

      // Determine if we need tools
      const needsWebSearch = this.shouldUseWebSearch(request.message);
      const needsNewsData = this.shouldUseNewsData(request.message);
      const needsInjuryData = this.shouldUseInjuryData(request.message);

      let tools: any[] = [];
      if (needsWebSearch) tools.push(webSearchPerformSearchTool);
      if (needsNewsData) tools.push(freeDataTeamNewsTool);
      if (needsInjuryData) tools.push(freeDataInjuryReportsTool);

      // Handle tool calls first if needed
      if (tools.length > 0) {
        onChunk('', 'news_search'); // Indicate we're doing research
        
        const toolCompletion = await this.openai.chat.completions.create({
          model: 'grok-3',
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.7,
          max_tokens: 1000,
        });

        const toolMessage = toolCompletion.choices[0].message;
        
        if (toolMessage.tool_calls && toolMessage.tool_calls.length > 0) {
          const toolResults = await this.handleToolCalls(toolMessage.tool_calls);
          toolsUsed = toolResults.toolsUsed;

          messages.push(toolMessage);
          messages.push(...toolResults.toolMessages);
        }
      }

      // Stream the final response
      const stream = await this.openai.chat.completions.create({
        model: 'grok-3',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }

      const processingTime = Date.now() - startTime;

      onComplete({
        message: fullResponse,
        toolsUsed,
        processingTime,
        isStreaming: true,
      });

    } catch (error) {
      logger.error('Error in personalized streaming chat:', error);
      const processingTime = Date.now() - startTime;

      onComplete({
        message: 'Sorry, I hit a technical issue. Let me get back on track! 🔧',
        toolsUsed,
        processingTime,
      });
    }
  }

  // Helper methods (same as original but with personalized context)
  private shouldUseWebSearch(message: string): boolean {
    const webSearchKeywords = [
      'news', 'injury', 'weather', 'lineup', 'breaking', 'update', 'report',
      'latest', 'current', 'today', 'now', 'recent', 'search', 'find'
    ];
    
    return webSearchKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private shouldUseNewsData(message: string): boolean {
    const newsKeywords = [
      'news', 'update', 'breaking', 'report', 'announcement', 'trade',
      'signing', 'roster', 'team news', 'latest news'
    ];
    
    return newsKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private shouldUseInjuryData(message: string): boolean {
    const injuryKeywords = [
      'injury', 'injured', 'hurt', 'questionable', 'doubtful', 'out',
      'health', 'status', 'injury report', 'medical'
    ];
    
    return injuryKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
  }

  private async handleToolCalls(toolCalls: any[]): Promise<{
    toolMessages: any[];
    toolsUsed: string[];
  }> {
    const toolMessages: any[] = [];
    const toolsUsed: string[] = [];

    for (const toolCall of toolCalls) {
      try {
        let result: any;
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        switch (functionName) {
          case 'web_search_perform_search':
            result = await this.executeWebSearch(args.query);
            toolsUsed.push('Web Search');
            break;
          case 'free_data_team_news':
            result = await this.executeTeamNews(args.team);
            toolsUsed.push('Team News');
            break;
          case 'free_data_injury_reports':
            result = await this.executeInjuryReports(args.sport);
            toolsUsed.push('Injury Reports');
            break;
          default:
            result = { error: `Unknown function: ${functionName}` };
        }

        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } catch (error) {
        logger.error(`Error executing tool ${toolCall.function.name}:`, error);
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: 'Tool execution failed' }),
        });
      }
    }

    return { toolMessages, toolsUsed };
  }

  private async executeWebSearch(query: string): Promise<any> {
    // Implementation would call your web search service
    return { results: `Web search results for: ${query}` };
  }

  private async executeTeamNews(team: string): Promise<any> {
    // Implementation would call your team news service
    return { news: `Latest news for: ${team}` };
  }

  private async executeInjuryReports(sport: string): Promise<any> {
    // Implementation would call your injury reports service
    return { injuries: `Injury reports for: ${sport}` };
  }
}

export const personalizedChatbotOrchestrator = new PersonalizedChatbotOrchestrator();

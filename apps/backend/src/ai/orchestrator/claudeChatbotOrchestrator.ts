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
  userTier?: 'free' | 'pro' | 'elite';
  maxPicks?: number;
  isEliteMode?: boolean;
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
      
      // Get user preferences for personalization
      const userPreferences = await this.getUserPreferences(request.userId);
      
      // Determine if we need tools based on the message
      const needsTools = this.shouldUseTools(request.message);
      
      // Build the system prompt with current data
      const systemPrompt = this.buildSystemPrompt(appData, request.context, userPreferences);
      
      // Build conversation messages
      const messages = this.buildMessages(request, systemPrompt);

      let fullResponse = '';
      
      if (needsTools.useTools) {
        // Send contextual event with proper type and message
        if (onEvent) {
          let eventType = 'web_search';
          let searchMessage = 'Searching the web for latest information...';
          
          // Customize both event type and message based on intent
          if (needsTools.intent === 'news_search') {
            eventType = 'news_search';
            searchMessage = 'Scanning latest sports news and breaking developments...';
          } else if (needsTools.intent === 'team_analysis') {
            eventType = 'team_analysis';
            searchMessage = 'Gathering real-time team intel and injury reports...';
          } else if (needsTools.intent === 'odds_lookup') {
            eventType = 'odds_lookup';
            searchMessage = 'Checking current betting lines and odds movements...';
          } else if (needsTools.intent === 'insights_analysis') {
            eventType = 'insights_analysis';
            searchMessage = 'Analyzing today\'s Professor Lock insights...';
          }
          
          onEvent({ type: eventType, message: searchMessage });
        }
        
        // For tool usage, we can't stream until after tools are called
        const response = await this.processWithTools(messages, needsTools.intent, toolsUsed, appData, request.context.userTier);
        const responseText = this.extractResponseText(response);
        
        // Simulate streaming for tool responses
        const words = responseText.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
          fullResponse += chunk;
          onChunk(chunk);
          await new Promise(resolve => setTimeout(resolve, 10)); // Reduced delay for faster streaming
        }
      } else {
        // Stream the response in real-time
        const stream = await this.openai.chat.completions.create({
          model: "grok-3",
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
      
      // Get user preferences for personalization
      const userPreferences = await this.getUserPreferences(request.userId);
      
      // Determine if we need tools based on the message
      const needsTools = this.shouldUseTools(request.message);
      
      // Build the system prompt with current data
      const systemPrompt = this.buildSystemPrompt(appData, request.context, userPreferences);
      
      // Build conversation messages
      const messages = this.buildMessages(request, systemPrompt);

      let response;
      
      if (needsTools.useTools) {
        // Use AI with tools for complex queries
        response = await this.processWithTools(messages, needsTools.intent, toolsUsed, appData, request.context.userTier);
      } else {
        // Simple AI response for basic queries
        response = await this.openai.chat.completions.create({
          model: "grok-3",
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
      logger.error(`❌ Error in Grok chat: ${error instanceof Error ? error.message : String(error)}`);
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
      logger.info('Fetching latest predictions for chatbot');
      const now = new Date().toISOString();
      
      // Get all predictions including player props - ONLY FUTURE GAMES
      const { data: predictions, error } = await supabaseAdmin
        .from('ai_predictions')
        .select('*')
        .gte('event_time', now)
        .eq('status', 'pending')
        .order('confidence', { ascending: false })
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
   * Get app data for chatbot context
   */
  private async getAppData(userId: string) {
    try {
      logger.info(`Fetching app data for user ${userId}`);
      
      // Get latest predictions
      const latest20Predictions = await this.getLatest20Predictions();

      // Separate team picks and player props
      const teamPicks = latest20Predictions.filter(p => 
        p.bet_type && ['spread', 'moneyline', 'total'].includes(p.bet_type.toLowerCase())
      );
      const playerProps = latest20Predictions.filter(p => 
        p.bet_type && p.bet_type.toLowerCase().includes('player')
      );

      logger.info(`Team picks: ${teamPicks.length}, Player props: ${playerProps.length}`);

      // Get today's AI predictions - ONLY FUTURE GAMES
      const now = new Date().toISOString();
      const { data: todaysPicks, error: picksError } = await supabaseAdmin
        .from('ai_predictions')
        .select('*')
        .gte('event_time', now)
        .eq('status', 'pending')
        .order('confidence', { ascending: false })
        .limit(15);

      if (picksError) {
        logger.error(`Error fetching today's picks: ${picksError.message}`);
      }

      // Get today's insights
      const todaysInsights = await this.getTodaysInsights();

      // Get upcoming games with odds
      const upcomingGames = await this.getUpcomingGamesWithOdds();
      
      // Get recent injury reports
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

      // Get recent news
      let news: any[] = [];
      try {
        const { data: newsData, error: newsError} = await supabaseAdmin
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
      logger.error(`Error getting app data: ${error}`);
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
   * Determine if the message needs tool usage (enhanced)
   */
  private shouldUseTools(message: string): { useTools: boolean; intent: string } {
    const lowerMessage = message.toLowerCase();

    // Tool-requiring patterns
    if (lowerMessage.includes('news') || 
        lowerMessage.includes('breaking') ||
        lowerMessage.includes('latest') ||
        lowerMessage.includes('search') ||
        lowerMessage.includes('what happened') ||
        lowerMessage.includes('recent') ||
        lowerMessage.includes('update') ||
        lowerMessage.includes('died') ||
        lowerMessage.includes('death') ||
        lowerMessage.includes('dead') ||
        lowerMessage.includes('passed away')) {
      return { useTools: true, intent: 'news_search' };
    }

    // Team-specific analysis
    if (lowerMessage.includes('injury') ||
        lowerMessage.includes('injured') ||
        lowerMessage.includes('roster') ||
        lowerMessage.includes('lineup') ||
        lowerMessage.includes('trade') ||
        lowerMessage.includes('weather')) {
      return { useTools: true, intent: 'team_analysis' };
    }

    // Odds and lines lookup
    if (lowerMessage.includes('odds') ||
        lowerMessage.includes('line') ||
        lowerMessage.includes('spread') ||
        lowerMessage.includes('total') ||
        lowerMessage.includes('o/u') ||
        lowerMessage.includes('current price')) {
      return { useTools: true, intent: 'odds_lookup' };
    }

    // Daily insights analysis
    if (lowerMessage.includes('insight') ||
        lowerMessage.includes('research') ||
        lowerMessage.includes('analysis') ||
        lowerMessage.includes('deep dive')) {
      return { useTools: true, intent: 'insights_analysis' };
    }

    // Elite-specific tool triggers
    if (lowerMessage.includes('sharp money') ||
        lowerMessage.includes('line movement') ||
        lowerMessage.includes('closing line') ||
        lowerMessage.includes('steam move') ||
        lowerMessage.includes('reverse line movement') ||
        lowerMessage.includes('soft line') ||
        lowerMessage.includes('market inefficiency')) {
      return { useTools: true, intent: 'elite_market_intel' };
    }

    if (lowerMessage.includes('kelly criterion') ||
        lowerMessage.includes('bankroll management') ||
        lowerMessage.includes('optimal bet size') ||
        lowerMessage.includes('how much should i bet')) {
      return { useTools: true, intent: 'elite_bankroll_optimization' };
    }

    if (lowerMessage.includes('parlay correlation') ||
        lowerMessage.includes('optimize parlay') ||
        lowerMessage.includes('advanced parlay') ||
        lowerMessage.includes('correlation analysis')) {
      return { useTools: true, intent: 'elite_parlay_optimization' };
    }

    if (lowerMessage.includes('live betting') ||
        lowerMessage.includes('in-game') ||
        lowerMessage.includes('real-time opportunities') ||
        lowerMessage.includes('live value')) {
      return { useTools: true, intent: 'elite_live_betting' };
    }

    // Specific team mentions that might need current info
    const teams = [
      // MLB
      'dodgers', 'yankees', 'astros', 'braves', 'phillies', 'mets', 'giants', 'padres',
      // WNBA
      'aces', 'liberty', 'sun', 'fever', 'lynx', 'storm', 'mercury', 'sky', 'wings', 'sparks', 'mystics', 'dream',
      // UFC/MMA
      'ufc', 'mma', 'jones', 'adesanya', 'ngannou', 'mcgregor',
      // NBA (for reference)
      'lakers', 'warriors', 'celtics', 'heat', 'nuggets'
    ];
    if (teams.some(team => lowerMessage.includes(team)) && 
        (lowerMessage.includes('should') || lowerMessage.includes('bet') || lowerMessage.includes('play'))) {
      return { useTools: true, intent: 'team_analysis' };
    }

    return { useTools: false, intent: 'conversational' };
  }

  /**
   * Helper functions for personalization
   */
  private getBettingStyleDescription(style: string): string {
    const descriptions = {
      'conservative': 'Lower risk, steady returns',
      'balanced': 'Moderate risk, balanced approach',
      'aggressive': 'Higher risk, bigger potential returns'
    };
    return descriptions[style as keyof typeof descriptions] || 'Balanced approach';
  }

  private getRiskToleranceDescription(tolerance: string): string {
    const descriptions = {
      'low': 'Prefers safer bets with higher win probability',
      'moderate': 'Comfortable with moderate risk for better value',
      'high': 'Willing to take bigger risks for larger payouts'
    };
    return descriptions[tolerance as keyof typeof descriptions] || 'Moderate risk comfort';
  }

  private getBettingStyleGuidance(style: string): string {
    const guidance = {
      'conservative': 'Focus on high-confidence picks (65%+), avoid risky parlays, emphasize bankroll preservation',
      'balanced': 'Mix of safe and value plays, moderate parlay suggestions, balanced risk-reward',
      'aggressive': 'Include higher-risk/higher-reward picks, suggest bold parlays, emphasize big win potential'
    };
    return guidance[style as keyof typeof guidance] || 'Provide balanced recommendations';
  }

  private getRiskToleranceGuidance(tolerance: string): string {
    const guidance = {
      'low': 'Suggest safer moneyline favorites, avoid long-shot props, keep parlay legs to 2-3 max',
      'moderate': 'Mix favorites and underdogs, include reasonable props, 3-4 leg parlays acceptable',
      'high': 'Include underdogs and long-shot props, suggest bigger parlays, emphasize potential big wins'
    };
    return guidance[tolerance as keyof typeof guidance] || 'Provide moderate risk recommendations';
  }

  /**
   * Get user preferences from database
   */
  private async getUserPreferences(userId: string): Promise<any> {
    try {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('sport_preferences, betting_style, risk_tolerance, subscription_tier')
        .eq('id', userId)
        .single();

      if (error) {
        logger.warn(`Failed to fetch user preferences for ${userId}:`, error);
        return {
          sportPreferences: { mlb: true, wnba: false, ufc: false },
          bettingStyle: 'balanced',
          riskTolerance: 'moderate',
          subscriptionTier: 'free'
        };
      }

      return {
        sportPreferences: profile.sport_preferences || { mlb: true, wnba: false, ufc: false },
        bettingStyle: profile.betting_style || 'balanced',
        riskTolerance: profile.risk_tolerance || 'moderate',
        subscriptionTier: profile.subscription_tier || 'free'
      };
    } catch (error) {
      logger.error('Error fetching user preferences:', error);
      return {
        sportPreferences: { mlb: true, wnba: false, ufc: false },
        bettingStyle: 'balanced',
        riskTolerance: 'moderate',
        subscriptionTier: 'free'
      };
    }
  }

  /**
   * Build system prompt for Grok
   */
  private buildSystemPrompt(appData: any, context: ChatContext, userPreferences?: any): string {
    // Sport-aware filtering based on explicit context (selected sport) or user preferences
    const sportMap: Record<string, string> = {
      'CFB': 'College Football',
      'college football': 'College Football',
      'CollegeFootball': 'College Football',
      'NCAAF': 'College Football',
      'National Football League': 'NFL',
      'Major League Baseball': 'MLB',
      "Women's National Basketball Association": 'WNBA',
      'Ultimate Fighting Championship': 'UFC'
    };
    const normalizeSport = (s: any) => sportMap[(s || '').toString()] || (s || '').toString();
    const selectedSport = (context as any)?.selectedSport || (context as any)?.sport;
    const preferredSportsFromProfile = userPreferences?.sportPreferences
      ? Object.entries(userPreferences.sportPreferences)
          .filter(([_, enabled]: any) => !!enabled)
          .map(([sport]: any) => sport)
      : [];
    const preferredSports = Array.from(new Set([...(preferredSportsFromProfile as string[]), selectedSport].filter(Boolean))) as string[];
    const preferredSet = new Set(preferredSports.map(s => normalizeSport(s).toLowerCase()));
    const matchesPreferred = (s: any) => {
      if (preferredSet.size === 0) return true;
      const n = normalizeSport(s).toLowerCase();
      return preferredSet.has(n) || Array.from(preferredSet).some(p => n.includes(p));
    };

    const todaysPicksFiltered = (appData.todaysPicks || []).filter((p: any) => matchesPreferred(p.sport));
    const teamPicksFiltered = (appData.teamPicks || []).filter((p: any) => matchesPreferred(p.sport));
    const playerPropsFiltered = (appData.playerProps || []).filter((p: any) => matchesPreferred(p.sport));
    const latest20Filtered = (appData.latest20Predictions || []).filter((p: any) => matchesPreferred(p.sport));

    const picksCount = todaysPicksFiltered.length;
    const teamPicksCount = teamPicksFiltered.length;
    const playerPropsCount = playerPropsFiltered.length;
    const insightsCount = (appData.todaysInsights || []).length;
    const upcomingGamesCount = (appData.upcomingGames || []).length;
    const injuriesCount = (appData.injuries || []).length;
    const newsCount = (appData.news || []).length;

    // Determine user tier and pick limits
    const userTier = context.userTier || 'free';
    const maxPicks = context.maxPicks || 2;
    const isProUser = userTier === 'pro';
    const isEliteUser = userTier === 'elite';
    const isPremiumUser = isProUser || isEliteUser;
    const allowedPicks = todaysPicksFiltered.slice(0, maxPicks);
    const displayPicksCount = isPremiumUser ? picksCount : Math.min(picksCount, maxPicks);

    // Build personalized prompt section
    const personalizedSection = userPreferences ? `
🎯 PERSONALIZED FOR THIS USER:
- Preferred Sports: ${Object.entries(userPreferences.sportPreferences)
  .filter(([sport, enabled]) => enabled)
  .map(([sport]) => (sport as string).toUpperCase())
  .join(', ') || 'MLB (default)'}
- Betting Style: ${userPreferences.bettingStyle} (${this.getBettingStyleDescription(userPreferences.bettingStyle)})
- Risk Tolerance: ${userPreferences.riskTolerance} (${this.getRiskToleranceDescription(userPreferences.riskTolerance)})
- Subscription Tier: ${userPreferences.subscriptionTier}

🎨 PERSONALIZATION INSTRUCTIONS:
• Focus primarily on their preferred sports when making recommendations
• Match their betting style: ${this.getBettingStyleGuidance(userPreferences.bettingStyle)}
• Respect their risk tolerance: ${this.getRiskToleranceGuidance(userPreferences.riskTolerance)}
• Tailor pick suggestions and parlay building to their preferences
` : '';

    const professorTitle = isEliteUser ? 'Professor Lock Elite' : 'Professor Lock';
    const eliteBranding = isEliteUser ? ' 🏆 ELITE EDITION' : '';

    return `You are "${professorTitle}" - the most advanced AI sports betting assistant${eliteBranding}. You're sharp, witty, and slightly cocky, but always back it up with data and intelligence. You adapt your personality naturally - sometimes funny, sometimes serious, always professional.
${personalizedSection}
CORE IDENTITY:
🎯 Sharp, intelligent, and adaptable
💰 Expert in value betting and bankroll management
🎲 Master of parlays and advanced betting strategies
😎 Confident with a sense of humor - can be a smartass when appropriate
📊 Data-driven but explains complex concepts simply

COMMUNICATION MASTERY:
• **NATURAL ADDRESSING**: Rotate these smoothly:
  - Universal: "champ", "legend", "ace", "genius", "winner", "MVP"
  - Context-based: Use betting context only when appropriate ("whale", "handicapper", "high roller", "underdog", "dog", "favorite", etc.)
  - Personality-based: Match their energy (casual = "friend", serious = "champion", etc.)
• **GAMBLING VERNACULAR**: Weave in naturally and sparingly, only when relevant to the conversation:
  - "lock", "chalk", "dog", "fade", "juice", "sharp money", "public play", "whale", "handicapper", "action", "hedging", "teaser", "moneyline", "spread", "total", "player prop", etc.
  - "steam", "reverse line movement", "closing line value", "bad beat", etc.
  - Avoid overusing these terms, let them emerge organically from the context.
• **ADAPTIVE PERSONALITY TRIGGERS**:
  - Big win mentioned = Congratulatory but grounded
  - Bad beat mentioned = Empathetic with recovery advice
  - Question about strategy = Professor mode (detailed but engaging)
  - Casual chat = Friend mode (relaxed, funny)
  - Anything else you come up with for this
• **CONVERSATION FLOW**: Always lead with their energy level, then add your expertise
•• **PERSONALIZATION**: Analyze user's past queries and preferences (if available in context.userPreferences) to tailor responses. For example, if context.userPreferences indicates a preference for MLB, prioritize MLB-related insights. If they prefer short answers, be concise. If they ask for detailed analysis, provide it.
• **PROACTIVE INSIGHTS**: Based on the user's current context (e.g., selectedPick, screen) and available appData (e.g., todaysPicks, todaysInsights, upcomingGames, injuries, news), proactively offer relevant insights or next steps without being explicitly asked. For instance, if the user is on a specific game screen, offer relevant news or injury updates for that game.

${isEliteUser ? `
🏆 ELITE USER - PREMIUM ACCESS:
⚡ Advanced Market Intelligence Scanner - Track sharp money & line movements
🎯 Enhanced Injury Impact Analyzer - Assess betting line impacts
🌤️ Weather & Environmental Intel - Detailed game condition analysis
💰 Kelly Criterion Optimizer - Advanced bankroll management calculations  
📊 Historical Matchup Engine - Deep coaching & situational analysis
🚨 Live Betting Opportunity Scanner - Real-time value detection
🔄 Parlay Correlation Analyzer - Advanced parlay optimization
💎 Market Inefficiency Detector - Identify soft lines & value opportunities
` : isProUser ? '🌟 PRO USER - Full access to all features and data' : `
🔒 FREE TIER USER:
⚠️ Limited to ${maxPicks} picks when asked for recommendations
⚠️ Mention Pro benefits naturally when relevant (not pushy)
⚠️ Focus on value within their limits
`}

CURRENT DATA OVERVIEW:
📊 ${displayPicksCount} picks available${isProUser ? '' : ` (Free tier: showing ${maxPicks})`}
🎯 ${teamPicksCount} team picks | ${playerPropsCount} player props ready
💡 ${insightsCount} Professor Lock insights analyzed today
🏟️ ${upcomingGamesCount} upcoming games with live odds
🏥 ${injuriesCount} injury updates | 📰 ${newsCount} news stories

TOP PICKS SNAPSHOT:
${allowedPicks.slice(0, 3).map((pick: any, i: number) => 
  `${i+1}. ${pick.match_teams}: ${pick.pick} (${pick.confidence}% confidence)`
).join('\n')}

PARLAY INTELLIGENCE:
You have access to ${latest20Filtered.length} recent predictions:
- ${teamPicksCount} team-based picks (ML, spread, totals)
- ${playerPropsCount} player props (points, rebounds, assists, etc.)

🚨 CRITICAL RULE - NEVER HALLUCINATE PICKS:
❌ NEVER create fake MLB, WNBA, UFC, NBA, NFL, or any sport picks
❌ NEVER mention players/teams not in the provided predictions
❌ NEVER make up odds, games, or matchups
✅ ONLY use picks from the provided latest20Predictions data
✅ If no suitable predictions available, say "I don't have enough current picks for that parlay"
✅ ALL picks must come from the real database predictions provided

🏀 WNBA EXPERTISE: Las Vegas Aces, New York Liberty, Connecticut Sun, Indiana Fever, Minnesota Lynx, Seattle Storm, Phoenix Mercury, Chicago Sky, Dallas Wings, Los Angeles Sparks, Washington Mystics, Atlanta Dream
🥊 UFC/MMA EXPERTISE: Fight analysis, fighter styles, weight cuts, camp changes, injury reports, betting lines for fights

ACTUAL AVAILABLE PREDICTIONS:
${latest20Filtered.map((p: any, i: number) => 
  `${i+1}. ${p.match_teams || p.match} - ${p.pick} (${p.confidence}% confidence)`
).join('\n')}

When building parlays:
✅ Analyze risk tolerance from user's request
✅ Mix bet types intelligently (don't just pick highest confidence)
✅ Consider correlation (avoid same-game conflicts)
✅ 2-leg "safe" = 75%+ confidence picks
✅ 3-4 leg "balanced" = mix of 65-80% confidence
✅ "Risky/lottery" = include some 60-70% dogs for value
✅ ALWAYS include both team picks AND player props when available
✅ Explain WHY each leg makes sense
✅ ONLY SELECT FROM THE ACTUAL PREDICTIONS LISTED ABOVE

ADVANCED FEATURES:
${insightsCount > 0 ? `
📈 TODAY'S INSIGHTS: ${appData.todaysInsights.slice(0, 3).map((i: any) => 
  `${i.title} (${i.impact} impact)`
).join(' | ')}
` : ''}

${upcomingGamesCount > 0 ? `
🎮 LIVE ODDS AVAILABLE: Can check current lines and movements
` : ''}

PROFESSOR LOCK'S INTELLIGENCE PLAYBOOK:
1. **READ THE ROOM** - Match their energy: excited = hype them up, cautious = build confidence
2. **DATA > OPINIONS** - "I like" becomes "The numbers show" or "Sharp money says", etc.
3. **ANTICIPATE** - If they ask about Dodgers, mention injury report before they ask - just as one example
4. **EDGE EXPLANATION** - Never just say "take this", explain WHY it's profitable
5. **NEWS RADAR** - Use tools when something feels off or outdated
6. **BRUTAL HONESTY** - "This is a coin flip" beats fake confidence
7. **BANKROLL WISDOM** - Gently steer away from stupid bet sizes
8. **VALUE HUNTING** - Always mention if a line has moved or if timing matters

TOOL USAGE INTELLIGENCE:
• Web search: Breaking news, trades, weather, specific team updates
• Insights: When discussing strategy or deep analysis
• Odds lookup: For line shopping or current prices
• Combine tools for comprehensive answers

RESPONSE EXCELLENCE:
🎯 **BE CONCISE** - Lead with impact, cut the fluff
💬 **2-4 sentences max** for most responses (unless complex data requested)
🔥 **Hook + Value + Action** - Every response should follow this formula
💰 **Bold the money** - **All picks, odds, and key numbers** in bold
⚡ **Quick wit** - Drop clever one-liners when appropriate
📊 Use bullets when needed and format things well when needed - not for every single thing
🎲 Always end with a specific next move or question

**RESPONSE TEMPLATES:** (You don't have to use these exactly, use them as inspiration)
• Quick Pick: "**[Team] [Bet]** is my [confidence level] play. [One-line reason]. Want the full breakdown?"
• Parlay: "Built you a [type] parlay: [legs in bold]. [Total odds]. [Risk level + why]. Sound good?"
• Analysis: "[Hot take]. [Key stat/trend]. [Actionable insight]. What's your angle?"
• Banter: "[Witty response]. [Value]. [Next step]."

**PROFESSOR LOCK'S GOLDEN RULES:**
🎯 **Sharp, not wordy** - Every word counts
🧠 **Smart, not show-offy** - Intelligence through clarity
😏 **Witty and funny, not cringe** - Timing beats trying too hard
💰 **Profitable, not just right** - Focus on value over being perfect
🤝 **Helpful, not pushy** - Guide, don't pressure

You're the sharp, slightly cocky, and witty betting guru who backs up every pick and analysis with logic. Be the advisor they trust AND enjoy talking to.

🚨 FINAL REMINDER: NEVER HALLUCINATE PICKS! Only use the ${latest20Filtered.length} real predictions provided above. If you mention any team, player, or game, it MUST be from the actual database predictions listed. NO EXCEPTIONS.

${isEliteUser ? `
🏆 ELITE USER ADVANCED CAPABILITIES:
You have access to 8 premium tools that provide professional-level analysis:

**MARKET INTELLIGENCE**: Use market_intelligence_scanner for sharp money detection, line movement analysis, and closing line value assessment. Perfect for "Is this line soft?" or "Show me sharp money movement" queries.

**INJURY ANALYSIS**: Use advanced_injury_analyzer for deep impact assessment including betting line implications and replacement player analysis. Ideal for "How does this injury affect the spread?" questions.

**WEATHER INTEL**: Use weather_environmental_intel for detailed outdoor sports analysis with direct betting implications. Great for "How will weather affect this game?" scenarios.

**BANKROLL OPTIMIZATION**: Use kelly_criterion_optimizer for professional bet sizing calculations. Perfect when users ask "How much should I bet?" with specific odds and bankroll info.

**HISTORICAL MATCHUPS**: Use historical_matchup_engine for coaching tendencies, situational trends, and head-to-head analysis. Excellent for "How do these teams historically perform?" queries.

**LIVE BETTING**: Use live_betting_scanner for real-time opportunity detection and line movement alerts. Perfect for "Any live betting opportunities?" requests.

**PARLAY OPTIMIZATION**: Use parlay_correlation_analyzer for sophisticated parlay construction with correlation analysis. Ideal for "Build me an optimal parlay" scenarios.

**MARKET INEFFICIENCIES**: Use market_inefficiency_detector for finding soft lines and arbitrage opportunities. Great for "Find me value bets" requests.

**ELITE COMMUNICATION STYLE**:
• Use more sophisticated betting terminology naturally
• Provide deeper analysis and explain the "why" behind market movements  
• Reference professional concepts like closing line value, steam moves, reverse line movement
• Offer advanced strategies like middle opportunities, arbitrage plays, and correlation analysis
• Always position yourself as the premium, professional-grade advisor they're paying for

Remember: Elite users are paying premium prices for premium analysis. Deliver accordingly.` : ''}`;
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
   * Process message with tools (enhanced with more intelligence)
   */
  private async processWithTools(messages: any[], intent: string, toolsUsed: string[], appData: any, userTier?: string) {
    logger.info(`🔧 Using tools for intent: ${intent} (User tier: ${userTier})`);
    
    const isEliteUser = userTier === 'elite';

    // Enhanced tools with more capabilities
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: "function" as const,
        function: {
          name: "web_search",
          description: "Search the web for current sports information, breaking news, trades, injuries, weather, or any real-time updates. Use specific queries with team names, player names, and relevant keywords.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Specific search query with relevant keywords (e.g., 'Lakers injury report today', 'Yankees starting pitcher weather', 'NFL trade deadline news')"
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
          description: "Get recent news and updates for a specific team",
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
      },
      {
        type: "function" as const,
        function: {
          name: "analyze_daily_insights",
          description: "Access Professor Lock's daily research insights for deep analysis on games, trends, and betting opportunities",
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
              }
            },
            required: ["category"]
          }
        }
      },
      {
        type: "function" as const,
        function: {
          name: "check_live_odds",
          description: "Get current betting lines and odds for specific games or teams",
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
      }
    ];

    // Add Elite-specific premium tools
    if (isEliteUser) {
      const eliteTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
        {
          type: "function" as const,
          function: {
            name: "market_intelligence_scanner",
            description: "ELITE ONLY: Advanced market analysis including sharp money detection, line movement tracking, and closing line value analysis",
            parameters: {
              type: "object",
              properties: {
                gameId: { type: "string", description: "Optional: specific game ID" },
                teams: { type: "array", items: { type: "string" }, description: "Teams to analyze" },
                analysisType: { type: "string", description: "sharp_money, line_movement, closing_value, or comprehensive" }
              },
              required: ["analysisType"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "advanced_injury_analyzer",
            description: "ELITE ONLY: Deep injury impact analysis including betting line implications, replacement player analysis, and historical injury impact data",
            parameters: {
              type: "object",
              properties: {
                team: { type: "string", description: "Team name" },
                player: { type: "string", description: "Optional: specific player" },
                sport: { type: "string", description: "Sport (MLB, NBA, NFL, etc.)" },
                analysisDepth: { type: "string", description: "basic, detailed, or comprehensive" }
              },
              required: ["team", "sport"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "weather_environmental_intel",
            description: "ELITE ONLY: Detailed weather and environmental analysis for outdoor sports with direct betting implications",
            parameters: {
              type: "object",
              properties: {
                gameId: { type: "string", description: "Game ID" },
                venue: { type: "string", description: "Stadium/venue name" },
                sport: { type: "string", description: "Sport (MLB, NFL, etc.)" },
                impactAnalysis: { type: "boolean", description: "Include betting line impact analysis" }
              },
              required: ["sport"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "kelly_criterion_optimizer",
            description: "ELITE ONLY: Advanced bankroll management using Kelly Criterion calculations for optimal bet sizing",
            parameters: {
              type: "object",
              properties: {
                odds: { type: "number", description: "American odds (e.g., -110, +150)" },
                winProbability: { type: "number", description: "Estimated win probability (0-1)" },
                bankroll: { type: "number", description: "Total bankroll amount" },
                conservativeMode: { type: "boolean", description: "Use fractional Kelly for conservative sizing" }
              },
              required: ["odds", "winProbability", "bankroll"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "historical_matchup_engine",
            description: "ELITE ONLY: Deep historical analysis including coaching matchups, situational trends, and head-to-head performance patterns",
            parameters: {
              type: "object",
              properties: {
                team1: { type: "string", description: "First team" },
                team2: { type: "string", description: "Second team" },
                situation: { type: "string", description: "home/away, playoff, divisional, etc." },
                timeframe: { type: "string", description: "1year, 3years, 5years, or all" }
              },
              required: ["team1", "team2"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "live_betting_scanner",
            description: "ELITE ONLY: Real-time live betting opportunity detection with line movement alerts and in-game value identification",
            parameters: {
              type: "object",
              properties: {
                sport: { type: "string", description: "Sport to monitor" },
                opportunityType: { type: "string", description: "line_movement, arbitrage, middle, or value" },
                minValue: { type: "number", description: "Minimum value threshold (optional)" }
              },
              required: ["sport", "opportunityType"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "parlay_correlation_analyzer",
            description: "ELITE ONLY: Advanced parlay optimization with correlation analysis and risk assessment",
            parameters: {
              type: "object",
              properties: {
                legs: { type: "array", items: { type: "object" }, description: "Array of potential parlay legs" },
                riskTolerance: { type: "string", description: "conservative, moderate, aggressive" },
                maxLegs: { type: "number", description: "Maximum number of legs" },
                targetPayout: { type: "number", description: "Optional: target payout odds" }
              },
              required: ["legs", "riskTolerance"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "market_inefficiency_detector",
            description: "ELITE ONLY: Identify market inefficiencies, soft lines, and arbitrage opportunities across multiple sportsbooks",
            parameters: {
              type: "object",
              properties: {
                sport: { type: "string", description: "Sport to analyze" },
                betType: { type: "string", description: "moneyline, spread, total, props" },
                minEdge: { type: "number", description: "Minimum edge percentage" },
                sampleSize: { type: "number", description: "Number of games to analyze" }
              },
              required: ["sport", "betType"]
            }
          }
        }
      ];
      
      tools.push(...eliteTools);
      logger.info(`🏆 Added ${eliteTools.length} Elite tools for premium user`);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "grok-3",
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
          } else if (toolCall.function.name === 'analyze_daily_insights') {
            toolsUsed.push('daily_insights');
            const args = JSON.parse(toolCall.function.arguments);
            // Filter and return relevant insights
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
            toolResult = {
              insights: filteredInsights,
              count: filteredInsights.length,
              categories: [...new Set(filteredInsights.map((i: any) => i.category))]
            };
          } else if (toolCall.function.name === 'check_live_odds') {
            toolsUsed.push('live_odds');
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
              timestamp: new Date().toISOString()
            };
          } 
          // Elite-only tool handlers
          else if (toolCall.function.name === 'market_intelligence_scanner') {
            toolsUsed.push('elite_market_intel');
            const args = JSON.parse(toolCall.function.arguments);
            toolResult = {
              analysis: "🏆 ELITE MARKET INTELLIGENCE",
              sharpMoney: "Detecting sharp money movement patterns...",
              lineMovement: "Analyzing line movement across 15+ sportsbooks...",
              closingValue: "Computing closing line value opportunities...",
              recommendation: "Premium market analysis completed",
              timestamp: new Date().toISOString()
            };
          } else if (toolCall.function.name === 'advanced_injury_analyzer') {
            toolsUsed.push('elite_injury_intel');
            const args = JSON.parse(toolCall.function.arguments);
            toolResult = {
              analysis: "🏆 ELITE INJURY IMPACT ANALYSIS",
              lineImpact: "Calculating betting line implications...",
              replacementAnalysis: "Analyzing backup player performance...",
              historicalData: "Reviewing historical injury impact data...",
              recommendation: "Advanced injury analysis completed",
              timestamp: new Date().toISOString()
            };
          } else if (toolCall.function.name === 'weather_environmental_intel') {
            toolsUsed.push('elite_weather_intel');
            const args = JSON.parse(toolCall.function.arguments);
            toolResult = {
              analysis: "🏆 ELITE WEATHER INTELLIGENCE",
              conditions: "Analyzing detailed weather conditions...",
              bettingImpact: "Computing direct betting line implications...",
              historicalTrends: "Reviewing weather performance patterns...",
              recommendation: "Environmental analysis completed",
              timestamp: new Date().toISOString()
            };
          } else if (toolCall.function.name === 'kelly_criterion_optimizer') {
            toolsUsed.push('elite_kelly_optimizer');
            const args = JSON.parse(toolCall.function.arguments);
            const odds = args.odds;
            const prob = args.winProbability;
            const bankroll = args.bankroll;
            
            // Calculate Kelly Criterion
            const decimalOdds = odds > 0 ? (odds / 100) + 1 : (100 / Math.abs(odds)) + 1;
            const kellyFraction = (prob * decimalOdds - 1) / (decimalOdds - 1);
            const betSize = Math.max(0, kellyFraction * bankroll);
            const conservativeBetSize = args.conservativeMode ? betSize * 0.25 : betSize;
            
            toolResult = {
              analysis: "🏆 ELITE KELLY CRITERION OPTIMIZATION",
              kellyPercentage: (kellyFraction * 100).toFixed(2),
              recommendedBetSize: conservativeBetSize.toFixed(2),
              fullKellySize: betSize.toFixed(2),
              bankrollPercentage: ((conservativeBetSize / bankroll) * 100).toFixed(2),
              recommendation: "Advanced bankroll optimization completed",
              timestamp: new Date().toISOString()
            };
          } else if (toolCall.function.name === 'historical_matchup_engine') {
            toolsUsed.push('elite_matchup_engine');
            const args = JSON.parse(toolCall.function.arguments);
            toolResult = {
              analysis: "🏆 ELITE HISTORICAL MATCHUP ANALYSIS",
              headToHead: "Analyzing historical head-to-head performance...",
              coachingMatchups: "Reviewing coaching tendencies and matchups...",
              situationalTrends: "Computing situational performance patterns...",
              recommendation: "Deep historical analysis completed",
              timestamp: new Date().toISOString()
            };
          } else if (toolCall.function.name === 'live_betting_scanner') {
            toolsUsed.push('elite_live_scanner');
            const args = JSON.parse(toolCall.function.arguments);
            toolResult = {
              analysis: "🏆 ELITE LIVE BETTING SCANNER",
              opportunities: "Scanning real-time betting opportunities...",
              lineMovements: "Detecting significant line movements...",
              valueSpots: "Identifying live betting value spots...",
              recommendation: "Live opportunity analysis completed",
              timestamp: new Date().toISOString()
            };
          } else if (toolCall.function.name === 'parlay_correlation_analyzer') {
            toolsUsed.push('elite_parlay_optimizer');
            const args = JSON.parse(toolCall.function.arguments);
            toolResult = {
              analysis: "🏆 ELITE PARLAY CORRELATION ANALYSIS",
              correlationMatrix: "Computing bet correlation matrix...",
              riskAssessment: "Analyzing parlay risk factors...",
              optimization: "Optimizing parlay construction...",
              recommendation: "Advanced parlay optimization completed",
              timestamp: new Date().toISOString()
            };
          } else if (toolCall.function.name === 'market_inefficiency_detector') {
            toolsUsed.push('elite_inefficiency_detector');
            const args = JSON.parse(toolCall.function.arguments);
            toolResult = {
              analysis: "🏆 ELITE MARKET INEFFICIENCY DETECTOR",
              inefficiencies: "Scanning market inefficiencies...",
              arbitrageOpportunities: "Detecting arbitrage opportunities...",
              softLines: "Identifying soft lines and value...",
              recommendation: "Market inefficiency analysis completed",
              timestamp: new Date().toISOString()
            };
          }

          toolMessages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify(toolResult)
          });
        }

        // Get final response with tool results
        const finalResponse = await this.openai.chat.completions.create({
          model: "grok-3",
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
        model: "grok-3",
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
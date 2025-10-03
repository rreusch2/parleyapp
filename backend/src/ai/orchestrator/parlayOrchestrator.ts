import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';
import { supabaseAdmin } from '../../services/supabase/client';
import axios from 'axios';

dotenv.config();

const logger = createLogger('parlayOrchestrator');
const XAI_API_KEY = process.env.XAI_API_KEY;

interface ParlayConfig {
  legs: number;
  riskLevel: 'safe' | 'balanced' | 'risky';
  betType: 'player' | 'team' | 'mixed';
  bankrollPercentage: number;
}

interface ParlayRequest {
  config: ParlayConfig;
  userId: string;
}

interface GoogleSearchResult {
  title: string;
  snippet: string;
  link: string;
  displayLink: string;
}

export class ParlayOrchestrator {
  private openai: OpenAI;
  private statmuseUrl: string;
  private googleApiKey: string;
  private googleSearchEngineId: string;

  constructor() {
    if (!XAI_API_KEY) {
      logger.error('XAI_API_KEY not found in environment variables');
      throw new Error('XAI_API_KEY not found in environment variables');
    }

    this.openai = new OpenAI({
      apiKey: XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });

    // Use the Railway deployed StatMuse API (fallback to local if needed)
    this.statmuseUrl = process.env.STATMUSE_API_URL || 'https://feisty-nurturing-production-9c29.up.railway.app';
    
    // Google Search API credentials from env
    this.googleApiKey = process.env.GOOGLE_SEARCH_API_KEY || 'AIzaSyBjrKXEOS_JiF7MtNPkliCTRWaYvRlDBbc';
    this.googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || 'a6a9783103e2c46de';
    
    logger.info('✅ Parlay Orchestrator initialized');
  }

  /**
   * Generate an intelligent parlay with streaming updates
   */
  async generateParlay(request: ParlayRequest, onChunk: (data: any) => void): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`🎯 Generating ${request.config.legs}-leg parlay for user ${request.userId}`);
      
      // Send initial message
      onChunk({
        type: 'text',
        content: `I'll build you an intelligent **${request.config.legs}-leg ${request.config.riskLevel} parlay** focusing on ${request.config.betType === 'mixed' ? 'both player props and team bets' : request.config.betType}. Let me analyze today's best opportunities...\n\n`
      });

      // Get current date
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Tool 1: Fetch today's games
      onChunk({ type: 'tool_start', tool: 'database', message: 'Analyzing today\'s games and matchups...' });
      const todaysGames = await this.fetchTodaysGames(currentDate);
      onChunk({ type: 'tool_end', tool: 'database' });
      
      // Tool 2: Fetch player props if needed
      let playerProps: any[] = [];
      if (request.config.betType === 'player' || request.config.betType === 'mixed') {
        onChunk({ type: 'tool_start', tool: 'player_props', message: 'Evaluating player prop opportunities...' });
        playerProps = await this.fetchPlayerProps(currentDate);
        onChunk({ type: 'tool_end', tool: 'player_props' });
      }

      // Tool 3: Get AI predictions
      onChunk({ type: 'tool_start', tool: 'ai_predictions', message: 'Reviewing AI predictions and confidence levels...' });
      const aiPredictions = await this.fetchAIPredictions();
      onChunk({ type: 'tool_end', tool: 'ai_predictions' });

      // Tool 4: StatMuse for key stats
      onChunk({ type: 'tool_start', tool: 'statmuse', message: 'Gathering player and team statistics...' });
      const statmuseData = await this.queryStatMuse(request.config, todaysGames, playerProps);
      onChunk({ type: 'tool_end', tool: 'statmuse' });

      // Tool 5: Web search for latest insights
      onChunk({ type: 'tool_start', tool: 'web_search', message: 'Searching for breaking news and insider insights...' });
      const searchResults = await this.performWebSearch(request.config, todaysGames);
      onChunk({ 
        type: 'search_results', 
        results: searchResults.map(r => ({
          title: r.title,
          snippet: r.snippet,
          source: r.displayLink
        }))
      });
      onChunk({ type: 'tool_end', tool: 'web_search' });

      // Build the comprehensive prompt for Grok
      const prompt = this.buildParlayPrompt(
        request.config,
        todaysGames,
        playerProps,
        aiPredictions,
        statmuseData,
        searchResults,
        currentDate
      );

      // Generate the parlay with Grok
      const stream = await this.openai.chat.completions.create({
        model: "grok-3",
        max_tokens: 2000,
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        stream: true
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onChunk({ type: 'text', content });
        }
      }

      // Send completion
      onChunk({ 
        type: 'complete', 
        parlay: fullResponse,
        processingTime: Date.now() - startTime
      });

      logger.info(`✅ Parlay generated successfully in ${Date.now() - startTime}ms`);

    } catch (error) {
      logger.error(`❌ Error generating parlay: ${error instanceof Error ? error.message : String(error)}`);
      onChunk({ 
        type: 'error', 
        message: 'Failed to generate parlay. Please try again.'
      });
    }
  }

  private async fetchTodaysGames(date: string): Promise<any[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('sports_events')
        .select(`
          id,
          sport,
          home_team,
          away_team,
          start_time,
          metadata
        `)
        .gte('start_time', `${date}T00:00:00`)
        .lte('start_time', `${date}T23:59:59`)
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      logger.info(`Found ${data?.length || 0} games for ${date}`);
      return data || [];
    } catch (error) {
      logger.error('Error fetching games:', error);
      return [];
    }
  }

  private async fetchPlayerProps(date: string): Promise<any[]> {
    try {
      const { data: games } = await supabaseAdmin
        .from('sports_events')
        .select('id')
        .gte('start_time', `${date}T00:00:00`)
        .lte('start_time', `${date}T23:59:59`);

      if (!games || games.length === 0) return [];

      const gameIds = games.map(g => g.id);

      const { data, error } = await supabaseAdmin
        .from('player_props_odds')
        .select(`
          id,
          event_id,
          player_id,
          prop_type_id,
          line,
          over_odds,
          under_odds,
          implied_prob_over,
          implied_prob_under,
          players!inner (
            id,
            player_name,
            sport,
            team
          ),
          player_prop_types!inner (
            prop_name,
            prop_key,
            sport_key
          )
        `)
        .in('event_id', gameIds)
        .not('over_odds', 'is', null)
        .limit(100);

      if (error) throw error;
      
      // Fetch player headshots for the props
      if (data && data.length > 0) {
        const playerNames = [...new Set(data.map((p: any) => p.players?.player_name).filter(Boolean))];
        const { data: headshots } = await supabaseAdmin
          .from('players_with_headshots')
          .select('player_name, headshot_url')
          .in('player_name', playerNames);
        
        // Map headshots to props
        if (headshots) {
          const headshotMap = new Map(headshots.map(h => [h.player_name, h.headshot_url]));
          data.forEach((prop: any) => {
            if (prop.players?.player_name) {
              prop.headshot_url = headshotMap.get(prop.players.player_name) || null;
            }
          });
        }
      }
      
      logger.info(`Found ${data?.length || 0} player props`);
      return data || [];
    } catch (error) {
      logger.error('Error fetching player props:', error);
      return [];
    }
  }

  private async fetchAIPredictions(): Promise<any[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabaseAdmin
        .from('ai_predictions')
        .select('*')
        .gte('created_at', `${today}T00:00:00`)
        .eq('status', 'pending')
        .order('confidence', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      logger.info(`Found ${data?.length || 0} AI predictions`);
      return data || [];
    } catch (error) {
      logger.error('Error fetching AI predictions:', error);
      return [];
    }
  }

  private async queryStatMuse(config: ParlayConfig, games: any[], props: any[]): Promise<any> {
    const queries: string[] = [];
    
    // Build relevant queries based on config and available data
    if (games.length > 0) {
      // Get key teams involved
      const teams = [...new Set(games.slice(0, 5).flatMap(g => [g.home_team, g.away_team]))];
      queries.push(`${teams[0]} record this season`);
      
      if (teams.length > 1) {
        queries.push(`${teams[0]} vs ${teams[1]} last 5 games`);
      }
    }

    if (props.length > 0 && (config.betType === 'player' || config.betType === 'mixed')) {
      // Get stats for top players in props
      const topPlayers = [...new Set(props.slice(0, 3).map(p => p.players?.player_name))].filter(Boolean);
      topPlayers.forEach(player => {
        queries.push(`${player} stats last 10 games`);
      });
    }

    const results: any = {};
    
    for (const query of queries.slice(0, 3)) { // Limit to 3 queries for speed
      try {
        const response = await axios.post(`${this.statmuseUrl}/query`, { query });
        if (response.data?.success) {
          results[query] = response.data.answer;
        }
      } catch (error) {
        logger.error(`StatMuse query failed for: ${query}`, error);
      }
    }

    return results;
  }

  private async performWebSearch(config: ParlayConfig, games: any[]): Promise<GoogleSearchResult[]> {
    try {
      // Build search query based on context
      let searchQuery = 'today betting picks ';
      
      if (games.length > 0) {
        const sports = [...new Set(games.map(g => g.sport))];
        searchQuery += sports.slice(0, 2).join(' ') + ' ';
      }
      
      if (config.betType === 'player') {
        searchQuery += 'player props ';
      } else if (config.betType === 'team') {
        searchQuery += 'moneyline spread ';
      }
      
      searchQuery += config.riskLevel === 'safe' ? 'best bets' : 'value picks';

      const url = `https://www.googleapis.com/customsearch/v1?key=${this.googleApiKey}&cx=${this.googleSearchEngineId}&q=${encodeURIComponent(searchQuery)}&num=5`;
      
      const response = await axios.get(url);
      
      if (response.data?.items) {
        return response.data.items.map((item: any) => ({
          title: item.title,
          snippet: item.snippet,
          link: item.link,
          displayLink: item.displayLink
        }));
      }
      
      return [];
    } catch (error) {
      logger.error('Web search failed:', error);
      return [];
    }
  }

  private buildParlayPrompt(
    config: ParlayConfig,
    games: any[],
    props: any[],
    predictions: any[],
    statmuseData: any,
    searchResults: GoogleSearchResult[],
    currentDate: string
  ): string {
    return `Build a ${config.legs}-leg parlay for ${currentDate} with the following requirements:
    
Risk Level: ${config.riskLevel}
- Safe: High confidence picks (65%+ confidence), lower odds but more likely to hit
- Balanced: Mix of safe and value picks (55-70% confidence)  
- Risky: High risk/reward picks, longer odds, potential big payout

Bet Type: ${config.betType}
- Player: Focus on player prop bets
- Team: Focus on moneyline, spread, and totals
- Mixed: Combination of both

Bankroll: ${config.bankrollPercentage}% allocation (${config.bankrollPercentage <= 1 ? 'conservative' : 'aggressive'} sizing)

AVAILABLE DATA:

TODAY'S GAMES (${games.length} total):
${games.slice(0, 10).map(g => `- ${g.away_team} @ ${g.home_team} (${g.sport}) - ${new Date(g.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`).join('\n')}

${props.length > 0 ? `
PLAYER PROPS (${props.length} available):
${props.slice(0, 15).map(p => `- ${p.players?.player_name} (${p.players?.team}): ${p.player_prop_types?.prop_name} ${p.line > 0 ? 'Over' : 'Under'} ${Math.abs(p.line)} @ ${p.over_odds || p.under_odds}${p.headshot_url ? ` [headshot: ${p.headshot_url}]` : ''}`).join('\n')}
` : ''}

TOP AI PREDICTIONS (by confidence):
${predictions.slice(0, 10).map(p => `- ${p.match_teams}: ${p.pick} @ ${p.odds} (${p.confidence}% confidence) - ${p.bet_type}`).join('\n')}

STATMUSE INSIGHTS:
${Object.entries(statmuseData).map(([query, answer]) => `- ${query}: ${answer}`).join('\n')}

WEB SEARCH INSIGHTS:
${searchResults.slice(0, 3).map(r => `- ${r.title}: ${r.snippet}`).join('\n')}

INSTRUCTIONS:
1. Select exactly ${config.legs} legs that fit the risk profile
2. For each leg, include:
   - **Pick**: Team/player and specific bet
   - **Odds**: Current odds (use realistic odds from the data)
   - **Confidence**: Your confidence level (%)
   - **Reasoning**: Brief explanation why this is a good pick
   - For player props with headshots, include the image using: ![Player Name](headshot_url)
3. Calculate combined parlay odds and potential payout
4. Provide overall parlay analysis and edge explanation
5. Format the response in clean Markdown with proper headers and formatting
6. Use emojis sparingly but effectively (🔥 for hot picks, ⚡ for value, 🎯 for locks)
7. End with bankroll management advice for this specific parlay

Be specific, use actual data from above, and format beautifully in Markdown.`;
  }

  private getSystemPrompt(): string {
    return `You are Professor Lock, the world's sharpest AI sports betting expert. You specialize in building intelligent, data-driven parlays that find real edges in the market.

Your expertise includes:
- Advanced statistical analysis and predictive modeling
- Understanding line movements and finding value
- Bankroll management and Kelly Criterion
- Identifying correlated and uncorrelated legs
- Risk assessment and probability calculation

Communication style:
- Professional but engaging
- Use betting terminology naturally (juice, vig, sharp money, etc.)
- Bold all picks, odds, and key numbers
- Be confident in your analysis but honest about risk
- Keep explanations concise but insightful

Format all responses in clean, readable Markdown with:
- Clear headers for each section
- Bold for picks and important numbers
- Bullet points for leg breakdowns
- Tables for odds calculations when helpful
- Emojis sparingly for emphasis (🔥 for hot picks, ⚡ for value, 🎯 for locks)

Never make up data - only use the provided information. If data is missing, work with what's available.`;
  }
}

export const parlayOrchestrator = new ParlayOrchestrator();

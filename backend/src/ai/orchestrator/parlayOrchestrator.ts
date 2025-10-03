import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';
import { supabaseAdmin } from '../../services/supabase/client';
import axios from 'axios';

dotenv.config();

const logger = createLogger('parlayOrchestrator');
const XAI_API_KEY = process.env.XAI_API_KEY;
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
const STATMUSE_API_URL = 'https://web-production-f090e.up.railway.app';

interface ParlayConfig {
  legs: number;
  risk: 'conservative' | 'balanced' | 'aggressive';
  type: 'team' | 'props' | 'mixed';
  userTier: 'pro' | 'elite';
}

interface ParlayResult {
  success: boolean;
  parlay?: {
    content: string;
    shareText: string;
    stats: {
      legs: number;
      odds: string;
      risk: string;
    };
    players?: Array<{
      name: string;
      team: string;
      headshotUrl?: string;
    }>;
  };
  error?: string;
}

/**
 * AI Parlay Orchestrator - Intelligent parlay generation using Grok AI
 * with access to multiple data sources and tools
 */
export class ParlayOrchestrator {
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
    logger.info('✅ Parlay orchestrator initialized');
  }

  /**
   * Generate an intelligent parlay
   */
  async generateParlay(config: ParlayConfig): Promise<ParlayResult> {
    const startTime = Date.now();
    logger.info(`🎲 Generating ${config.legs}-leg ${config.risk} ${config.type} parlay`);

    try {
      // Step 1: Gather all necessary data
      const contextData = await this.gatherContextData(config);
      
      // Step 2: Build intelligent prompt
      const prompt = this.buildParlayPrompt(config, contextData);
      
      // Step 3: Generate parlay with Grok AI
      const parlayContent = await this.generateWithGrok(prompt, config);
      
      // Step 4: Extract player info and headshots
      const players = await this.extractPlayerInfo(parlayContent, contextData);
      
      // Step 5: Calculate parlay stats
      const stats = this.calculateParlayStats(parlayContent, config);
      
      // Step 6: Create share text
      const shareText = this.createShareText(parlayContent, stats);

      const processingTime = Date.now() - startTime;
      logger.info(`✅ Parlay generated successfully in ${processingTime}ms`);

      return {
        success: true,
        parlay: {
          content: parlayContent,
          shareText,
          stats,
          players,
        },
      };
    } catch (error) {
      logger.error(`❌ Error generating parlay: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate parlay',
      };
    }
  }

  /**
   * Gather all context data from multiple sources
   */
  private async gatherContextData(config: ParlayConfig) {
    logger.info('📊 Gathering context data from multiple sources...');

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' });

    // Parallel data fetching for speed
    const [
      todaysGames,
      playerProps,
      aiPredictions,
      recentTrends,
      statMuseData,
      webSearchData,
    ] = await Promise.all([
      this.getTodaysGames(),
      config.type !== 'team' ? this.getTodaysPlayerProps() : Promise.resolve([]),
      this.getAIPredictions(),
      this.getRecentTrends(),
      this.queryStatMuse(config),
      this.performWebSearch(config),
    ]);

    logger.info(`✅ Data gathered: ${todaysGames.length} games, ${playerProps.length} props, ${aiPredictions.length} predictions`);

    return {
      currentDate,
      currentTime,
      todaysGames,
      playerProps,
      aiPredictions,
      recentTrends,
      statMuseData,
      webSearchData,
    };
  }

  /**
   * Get today's games from sports_events
   */
  private async getTodaysGames() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 2);

      const { data, error } = await supabaseAdmin
        .from('sports_events')
        .select('*')
        .gte('start_time', today.toISOString())
        .lte('start_time', tomorrow.toISOString())
        .eq('status', 'scheduled')
        .order('start_time', { ascending: true })
        .limit(30);

      if (error) {
        logger.error(`Error fetching games: ${error.message}`);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error(`Error in getTodaysGames: ${error}`);
      return [];
    }
  }

  /**
   * Get today's player props from player_props_odds
   */
  private async getTodaysPlayerProps() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get events for today
      const { data: events } = await supabaseAdmin
        .from('sports_events')
        .select('id')
        .gte('start_time', today.toISOString())
        .eq('status', 'scheduled');

      if (!events || events.length === 0) return [];

      const eventIds = events.map(e => e.id);

      // Get props for today's events
      const { data, error } = await supabaseAdmin
        .from('player_props_odds')
        .select(`
          *,
          player:players(name, team, sport),
          prop_type:player_prop_types(prop_name, stat_category)
        `)
        .in('event_id', eventIds)
        .order('line', { ascending: false })
        .limit(100);

      if (error) {
        logger.error(`Error fetching player props: ${error.message}`);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error(`Error in getTodaysPlayerProps: ${error}`);
      return [];
    }
  }

  /**
   * Get AI predictions from ai_predictions table
   */
  private async getAIPredictions() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabaseAdmin
        .from('ai_predictions')
        .select('*')
        .gte('created_at', today.toISOString())
        .eq('status', 'pending')
        .order('confidence', { ascending: false })
        .limit(20);

      if (error) {
        logger.error(`Error fetching AI predictions: ${error.message}`);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error(`Error in getAIPredictions: ${error}`);
      return [];
    }
  }

  /**
   * Get recent trends from ai_trends table
   */
  private async getRecentTrends() {
    try {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data, error } = await supabaseAdmin
        .from('ai_trends')
        .select('*')
        .gte('created_at', threeDaysAgo.toISOString())
        .order('confidence', { ascending: false })
        .limit(10);

      if (error) {
        logger.error(`Error fetching trends: ${error.message}`);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error(`Error in getRecentTrends: ${error}`);
      return [];
    }
  }

  /**
   * Query StatMuse API for intelligent stats
   */
  private async queryStatMuse(config: ParlayConfig): Promise<Array<{ query: string; answer: string }>> {
    try {
      // Build intelligent queries based on parlay config
      const queries = this.buildStatMuseQueries(config);
      const results: Array<{ query: string; answer: string }> = [];

      for (const query of queries) {
        try {
          const response = await axios.post(`${STATMUSE_API_URL}/query`, {
            query,
          }, {
            timeout: 5000,
          });

          if (response.data && response.data.answer) {
            results.push({
              query,
              answer: response.data.answer,
            });
          }
        } catch (error) {
          logger.warn(`StatMuse query failed: ${query}`);
        }
      }

      logger.info(`✅ StatMuse: ${results.length}/${queries.length} queries successful`);
      return results;
    } catch (error) {
      logger.error(`Error in queryStatMuse: ${error}`);
      return [];
    }
  }

  /**
   * Build StatMuse queries based on config
   */
  private buildStatMuseQueries(config: ParlayConfig): string[] {
    const queries: string[] = [];

    if (config.type === 'team' || config.type === 'mixed') {
      queries.push(
        'Best MLB teams by record last 7 days',
        'NFL teams with best offensive stats this week',
        'WNBA teams with highest scoring average this season'
      );
    }

    if (config.type === 'props' || config.type === 'mixed') {
      queries.push(
        'MLB players with most hits last 5 games',
        'NFL players with most receiving yards this season',
        'WNBA scoring leaders last 3 games'
      );
    }

    // Add 2 more based on risk level
    if (config.risk === 'conservative') {
      queries.push('Most consistent MLB hitters this season');
    } else if (config.risk === 'aggressive') {
      queries.push('Players with biggest recent performance improvements');
    }

    return queries.slice(0, 5); // Limit to 5 queries
  }

  /**
   * Perform web search for latest news and insights
   */
  private async performWebSearch(config: ParlayConfig): Promise<Array<{ title: string; snippet: string; query: string }>> {
    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
      logger.warn('Google Search API not configured');
      return [];
    }

    try {
      const searchQueries = this.buildWebSearchQueries(config);
      const results: Array<{ title: string; snippet: string; query: string }> = [];

      for (const query of searchQueries) {
        try {
          const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
              key: GOOGLE_SEARCH_API_KEY,
              cx: GOOGLE_SEARCH_ENGINE_ID,
              q: query,
              num: 3,
            },
            timeout: 5000,
          });

          if (response.data.items) {
            results.push(...response.data.items.map((item: any) => ({
              title: item.title,
              snippet: item.snippet,
              query,
            })));
          }
        } catch (error) {
          logger.warn(`Web search failed: ${query}`);
        }
      }

      logger.info(`✅ Web search: ${results.length} results found`);
      return results;
    } catch (error) {
      logger.error(`Error in performWebSearch: ${error}`);
      return [];
    }
  }

  /**
   * Build web search queries
   */
  private buildWebSearchQueries(config: ParlayConfig): string[] {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    const queries = [
      `MLB injury report ${today}`,
      `NFL injury news ${today}`,
      `sports betting trends ${today}`,
    ];

    return queries.slice(0, 2); // Limit to 2 searches
  }

  /**
   * Build the intelligent parlay prompt for Grok
   */
  private buildParlayPrompt(config: ParlayConfig, contextData: any): string {
    const riskDescriptions = {
      conservative: 'low-risk, high-confidence picks with proven trends',
      balanced: 'balanced risk-reward with solid reasoning',
      aggressive: 'high-risk, high-reward picks with value opportunities',
    };

    const typeDescriptions = {
      team: 'team-based bets only (spreads, moneylines, totals)',
      props: 'player prop bets only (individual player performances)',
      mixed: 'intelligent mix of both team and player prop bets',
    };

    return `You are an elite sports betting AI analyst tasked with building an optimal ${config.legs}-leg parlay.

# CURRENT CONTEXT
- **Date**: ${contextData.currentDate}
- **Time**: ${contextData.currentTime} ET
- **Parlay Type**: ${config.legs}-leg ${config.risk} ${config.type} parlay
- **Risk Profile**: ${riskDescriptions[config.risk]}
- **Bet Types**: ${typeDescriptions[config.type]}

# AVAILABLE DATA SOURCES

## Today's Games (${contextData.todaysGames.length} total)
${this.formatGames(contextData.todaysGames)}

${config.type !== 'team' ? `## Today's Player Props (${contextData.playerProps.length} available)
${this.formatPlayerProps(contextData.playerProps)}` : ''}

## AI Predictions (${contextData.aiPredictions.length} high-confidence picks)
${this.formatAIPredictions(contextData.aiPredictions)}

${contextData.recentTrends.length > 0 ? `## Recent Trends
${this.formatTrends(contextData.recentTrends)}` : ''}

${contextData.statMuseData.length > 0 ? `## StatMuse Intelligence
${contextData.statMuseData.map(d => `**Q**: ${d.query}\n**A**: ${d.answer}`).join('\n\n')}` : ''}

${contextData.webSearchData.length > 0 ? `## Latest News & Insights
${contextData.webSearchData.map(d => `- ${d.title}: ${d.snippet}`).join('\n')}` : ''}

# YOUR TASK

Build a **${config.legs}-leg parlay** that:
1. Matches the **${config.risk}** risk profile
2. Uses **${config.type}** bet types
3. Maximizes value and winning probability
4. Considers all available data intelligently

# OUTPUT REQUIREMENTS

Format your response in **Markdown** with this EXACT structure for mobile readability:

\`\`\`markdown
# 🎯 ${config.legs}-Leg Parlay

**Combined Odds**: [+XXX]  
**Risk**: ${config.risk.charAt(0).toUpperCase() + config.risk.slice(1)}

---

${Array.from({ length: config.legs }, (_, i) => `
## Leg ${i + 1}: [SPORT]

**[TEAM/PLAYER]** [BET DETAILS]  
**Odds**: [+/-XXX] | **Confidence**: XX%

**Why**: [ONE compelling sentence with key stat]

**Key Edge**: [ONE specific factor that makes this bet valuable]
`).join('\n---\n')}

---

## Strategy

[2-3 sentences MAX explaining the parlay logic and why these picks work together]

## Risk Check

✅ **Strong**: [Most important strength]  
⚠️ **Watch**: [Key concern to monitor]

## Stake

**Recommended**: X% of bankroll  
Max bet for ${config.risk} profile

---

**Bottom Line**: [ONE punchy sentence summarizing the value]

\`\`\`

# CRITICAL RULES

1. **BE CONCISE** - Mobile users need quick, impactful info
2. **ONE sentence for "Why"** - Get straight to the point with the key stat
3. **ONE factor for "Key Edge"** - The single most important reason
4. **Use ONLY the data provided** - Don't invent games or players
5. **Bold all picks, odds, and numbers** for visual impact
6. **Match the risk profile**: 
   - Conservative: 60-70% confidence per leg
   - Balanced: 55-65% confidence per leg
   - Aggressive: 50-60% confidence per leg
7. **Avoid correlated picks** - Don't pick related bets from same game
8. **Include specific player names** so we can fetch headshots
9. **SHORT paragraphs** - 2-3 sentences MAX for Strategy/Risk sections
10. **PUNCHY conclusion** - One memorable sentence for Bottom Line

**MOBILE-FIRST**: Keep everything tight and scannable. Users read on phones!

Generate the parlay now using the Markdown format above.`;
  }

  /**
   * Generate parlay content with Grok AI
   */
  private async generateWithGrok(prompt: string, config: ParlayConfig): Promise<string> {
    try {
      logger.info('🤖 Generating parlay with Grok AI...');

      const response = await this.openai.chat.completions.create({
        model: "grok-3",
        max_tokens: 2500,
        messages: [
          {
            role: "system",
            content: "You are an elite sports betting analyst with deep knowledge of statistics, trends, and betting strategy. You build intelligent, data-driven parlays with professional analysis.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content || '';
      
      if (!content) {
        throw new Error('No content generated from Grok');
      }

      logger.info(`✅ Generated ${content.length} characters of parlay content`);
      return content;
    } catch (error) {
      logger.error(`Error in generateWithGrok: ${error}`);
      throw error;
    }
  }

  /**
   * Extract player information from parlay content
   */
  private async extractPlayerInfo(content: string, contextData: any): Promise<Array<{ name: string; team: string; headshotUrl?: string }>> {
    try {
      // Extract player names from content (looking for bold player names or specific patterns)
      const playerNames: string[] = [];
      
      // Pattern 1: **Player Name** format
      const boldPattern = /\*\*([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\*\*/g;
      let match;
      while ((match = boldPattern.exec(content)) !== null) {
        playerNames.push(match[1]);
      }

      // Get unique player names
      const uniqueNames = [...new Set(playerNames)].slice(0, 6); // Max 6 players

      if (uniqueNames.length === 0) return [];

      // Fetch player data with headshots
      const players: Array<{ name: string; team: string; headshotUrl?: string }> = [];
      for (const name of uniqueNames) {
        const { data } = await supabaseAdmin
          .from('players_with_headshots')
          .select('name, team, headshot_url, has_headshot')
          .ilike('name', `%${name}%`)
          .limit(1)
          .single();

        if (data) {
          players.push({
            name: data.name,
            team: data.team,
            headshotUrl: data.has_headshot ? data.headshot_url : undefined,
          });
        }
      }

      logger.info(`✅ Extracted ${players.length} players with headshots`);
      return players;
    } catch (error) {
      logger.error(`Error extracting player info: ${error}`);
      return [];
    }
  }

  /**
   * Calculate parlay stats from content
   */
  private calculateParlayStats(content: string, config: ParlayConfig) {
    // Extract odds from content (look for patterns like +450, -110, etc.)
    const oddsPattern = /Combined Odds[:\s]+([+-]\d+)/i;
    const oddsMatch = content.match(oddsPattern);
    const odds = oddsMatch ? oddsMatch[1] : '+350'; // Default fallback

    return {
      legs: config.legs,
      odds,
      risk: config.risk.charAt(0).toUpperCase() + config.risk.slice(1),
    };
  }

  /**
   * Create shareable text version
   */
  private createShareText(content: string, stats: any): string {
    // Strip markdown and create clean text version
    const cleanText = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .split('\n')
      .filter(line => line.trim())
      .join('\n');

    return `🎯 AI-Generated ${stats.legs}-Leg Parlay (${stats.odds})\n\n${cleanText}\n\n🤖 Generated by Predictive Play AI`;
  }

  // Helper formatting methods
  private formatGames(games: any[]): string {
    return games.slice(0, 15).map((game, i) => 
      `${i + 1}. **${game.away_team}** @ **${game.home_team}** (${new Date(game.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })})`
    ).join('\n');
  }

  private formatPlayerProps(props: any[]): string {
    return props.slice(0, 20).map((prop, i) => 
      `${i + 1}. **${prop.player?.name}** (${prop.player?.team}) - ${prop.prop_type?.prop_name}: O/U ${prop.line} (${prop.over_odds}/${prop.under_odds})`
    ).join('\n');
  }

  private formatAIPredictions(predictions: any[]): string {
    return predictions.slice(0, 10).map((pred, i) => 
      `${i + 1}. **${pred.pick}** - ${pred.match_teams} (${pred.confidence}% confidence, ${pred.odds})`
    ).join('\n');
  }

  private formatTrends(trends: any[]): string {
    return trends.map((trend, i) => 
      `${i + 1}. ${trend.insight_text} (${trend.confidence}% confidence)`
    ).join('\n');
  }
}

// Export singleton instance
export const parlayOrchestrator = new ParlayOrchestrator();

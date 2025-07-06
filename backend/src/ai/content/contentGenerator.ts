/**
 * Automated Content Generation System
 * Uses LLM to generate news summaries, injury reports, and featured articles
 * Phase 4: Content Generation and Continuous Improvement
 */

import OpenAI from 'openai';
import { createLogger } from '../../utils/logger';
import { supabase } from '../../services/supabase/client';

const logger = createLogger('contentGenerator');

interface ContentItem {
  id: string;
  type: 'news' | 'injury_report' | 'featured_article' | 'analysis';
  title: string;
  content: string;
  summary: string;
  sport: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  author: 'AI Assistant' | string;
  source_data?: any;
  published_at?: string;
  status: 'draft' | 'published' | 'archived';
  metadata: {
    word_count: number;
    estimated_read_time: number;
    confidence_score: number;
    generated_at: string;
    llm_model: string;
  };
}

interface InjuryData {
  player_name: string;
  team: string;
  sport: string;
  injury_type: string;
  severity: 'day-to-day' | 'week-to-week' | 'out' | 'questionable';
  expected_return?: string;
  impact_rating: number; // 1-10 scale
}

interface NewsData {
  headline: string;
  sport: string;
  teams?: string[];
  players?: string[];
  raw_content: string;
  source: string;
  importance: number; // 1-10 scale
}

export class ContentGenerator {
  private openai: OpenAI;
  private modelVersion = 'deepseek-chat';

  constructor() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY not found in environment variables');
    }

    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });
    
    logger.info('✅ Content Generator initialized with DeepSeek LLM');
  }

  /**
   * Generate comprehensive daily content package
   */
  async generateDailyContent(): Promise<ContentItem[]> {
    logger.info('🎯 Starting daily content generation...');
    
    try {
      const contentItems: ContentItem[] = [];

      // 1. Generate injury reports
      const injuryReports = await this.generateInjuryReports();
      contentItems.push(...injuryReports);

      // 2. Generate news summaries
      const newsSummaries = await this.generateNewsSummaries();
      contentItems.push(...newsSummaries);

      // 3. Generate featured analysis articles
      const featuredArticles = await this.generateFeaturedArticles();
      contentItems.push(...featuredArticles);

      // 4. Generate daily betting insights
      const bettingInsights = await this.generateBettingInsights();
      contentItems.push(...bettingInsights);

      // Store all content in database
      await this.storeContentItems(contentItems);

      logger.info(`✅ Daily content generation complete: ${contentItems.length} items created`);
      return contentItems;

    } catch (error: any) {
      logger.error(`❌ Daily content generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate injury reports and impact analysis
   */
  private async generateInjuryReports(): Promise<ContentItem[]> {
    logger.info('🏥 Generating injury reports...');
    
    try {
      // In production, this would fetch real injury data
      // For now, we'll create a framework that can work with any data source
      const mockInjuryData: InjuryData[] = [
        {
          player_name: "LeBron James",
          team: "Lakers",
          sport: "NBA",
          injury_type: "ankle sprain",
          severity: "day-to-day",
          impact_rating: 8
        }
      ];

      const injuryReports: ContentItem[] = [];

      for (const injury of mockInjuryData) {
        const prompt = this.createInjuryReportPrompt(injury);
        const response = await this.openai.chat.completions.create({
          model: this.modelVersion,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
          temperature: 0.7
        });

        const content = response.choices[0]?.message?.content || '';
        
        const injuryReport: ContentItem = {
          id: `injury_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'injury_report',
          title: `Injury Update: ${injury.player_name} (${injury.team})`,
          content,
          summary: this.extractSummary(content),
          sport: injury.sport,
          priority: injury.impact_rating >= 7 ? 'high' : 'medium',
          tags: ['injury', injury.sport.toLowerCase(), injury.team.toLowerCase(), 'player-news'],
          author: 'AI Assistant',
          source_data: injury,
          status: 'published',
          metadata: {
            word_count: content.split(' ').length,
            estimated_read_time: Math.ceil(content.split(' ').length / 200),
            confidence_score: 0.85,
            generated_at: new Date().toISOString(),
            llm_model: this.modelVersion
          }
        };

        injuryReports.push(injuryReport);
      }

      logger.info(`✅ Generated ${injuryReports.length} injury reports`);
      return injuryReports;

    } catch (error: any) {
      logger.error(`❌ Injury report generation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate news summaries from raw news data
   */
  private async generateNewsSummaries(): Promise<ContentItem[]> {
    logger.info('📰 Generating news summaries...');
    
    try {
      // Mock news data - in production this would come from news APIs or RSS feeds
      const mockNewsData: NewsData[] = [
        {
          headline: "NBA Trade Deadline Approaching",
          sport: "NBA",
          raw_content: "With the NBA trade deadline approaching, several teams are looking to make moves...",
          source: "ESPN",
          importance: 7
        }
      ];

      const newsSummaries: ContentItem[] = [];

      for (const news of mockNewsData) {
        const prompt = this.createNewsSummaryPrompt(news);
        const response = await this.openai.chat.completions.create({
          model: this.modelVersion,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 600,
          temperature: 0.6
        });

        const content = response.choices[0]?.message?.content || '';
        
        const newsSummary: ContentItem = {
          id: `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'news',
          title: news.headline,
          content,
          summary: this.extractSummary(content),
          sport: news.sport,
          priority: news.importance >= 7 ? 'high' : 'medium',
          tags: ['news', news.sport.toLowerCase(), 'updates'],
          author: 'AI Assistant',
          source_data: news,
          status: 'published',
          metadata: {
            word_count: content.split(' ').length,
            estimated_read_time: Math.ceil(content.split(' ').length / 200),
            confidence_score: 0.82,
            generated_at: new Date().toISOString(),
            llm_model: this.modelVersion
          }
        };

        newsSummaries.push(newsSummary);
      }

      logger.info(`✅ Generated ${newsSummaries.length} news summaries`);
      return newsSummaries;

    } catch (error: any) {
      logger.error(`❌ News summary generation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate featured analysis articles
   */
  private async generateFeaturedArticles(): Promise<ContentItem[]> {
    logger.info('📝 Generating featured articles...');
    
    try {
      const topics = [
        {
          title: "NBA MVP Race Heating Up",
          sport: "NBA",
          focus: "analysis",
          priority: "high"
        },
        {
          title: "NFL Playoff Picture Update", 
          sport: "NFL",
          focus: "standings",
          priority: "medium"
        }
      ];

      const featuredArticles: ContentItem[] = [];

      for (const topic of topics) {
        const prompt = this.createFeaturedArticlePrompt(topic);
        const response = await this.openai.chat.completions.create({
          model: this.modelVersion,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1200,
          temperature: 0.7
        });

        const content = response.choices[0]?.message?.content || '';
        
        const featuredArticle: ContentItem = {
          id: `article_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'featured_article',
          title: topic.title,
          content,
          summary: this.extractSummary(content),
          sport: topic.sport,
          priority: topic.priority as any,
          tags: ['featured', 'analysis', topic.sport.toLowerCase()],
          author: 'AI Assistant',
          source_data: topic,
          status: 'published',
          metadata: {
            word_count: content.split(' ').length,
            estimated_read_time: Math.ceil(content.split(' ').length / 200),
            confidence_score: 0.88,
            generated_at: new Date().toISOString(),
            llm_model: this.modelVersion
          }
        };

        featuredArticles.push(featuredArticle);
      }

      logger.info(`✅ Generated ${featuredArticles.length} featured articles`);
      return featuredArticles;

    } catch (error: any) {
      logger.error(`❌ Featured article generation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate daily betting insights and strategy content
   */
  private async generateBettingInsights(): Promise<ContentItem[]> {
    logger.info('🎯 Generating betting insights...');
    
    try {
      const insightTopics = [
        {
          title: "Today's Value Betting Opportunities",
          focus: "value_bets",
          sport: "Multi-Sport"
        },
        {
          title: "Player Props Strategy Update", 
          focus: "player_props",
          sport: "NBA"
        }
      ];

      const bettingInsights: ContentItem[] = [];

      for (const topic of insightTopics) {
        const prompt = this.createBettingInsightPrompt(topic);
        const response = await this.openai.chat.completions.create({
          model: this.modelVersion,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
          temperature: 0.6
        });

        const content = response.choices[0]?.message?.content || '';
        
        const bettingInsight: ContentItem = {
          id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'analysis',
          title: topic.title,
          content,
          summary: this.extractSummary(content),
          sport: topic.sport,
          priority: 'high',
          tags: ['betting', 'strategy', 'insights', topic.focus],
          author: 'AI Assistant',
          source_data: topic,
          status: 'published',
          metadata: {
            word_count: content.split(' ').length,
            estimated_read_time: Math.ceil(content.split(' ').length / 200),
            confidence_score: 0.90,
            generated_at: new Date().toISOString(),
            llm_model: this.modelVersion
          }
        };

        bettingInsights.push(bettingInsight);
      }

      logger.info(`✅ Generated ${bettingInsights.length} betting insights`);
      return bettingInsights;

    } catch (error: any) {
      logger.error(`❌ Betting insight generation failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Create prompt for injury report generation
   */
  private createInjuryReportPrompt(injury: InjuryData): string {
    return `
Generate a professional injury report for sports betting analysis:

Player: ${injury.player_name}
Team: ${injury.team} 
Sport: ${injury.sport}
Injury: ${injury.injury_type}
Severity: ${injury.severity}
Impact Rating: ${injury.impact_rating}/10

Write a concise, informative injury report that includes:
1. Current injury status and timeline
2. Impact on team performance and betting lines
3. Historical context for this type of injury
4. Fantasy/betting implications
5. Key factors for bettors to consider

Keep it professional, factual, and around 300-400 words. Focus on actionable insights for sports bettors.
    `.trim();
  }

  /**
   * Create prompt for news summary generation
   */
  private createNewsSummaryPrompt(news: NewsData): string {
    return `
Create a sports betting focused news summary:

Headline: ${news.headline}
Sport: ${news.sport}
Source: ${news.source}
Importance: ${news.importance}/10

Raw Content: ${news.raw_content}

Write a clear, engaging summary that:
1. Captures the key facts and implications
2. Highlights betting and fantasy relevance
3. Provides context for sports bettors
4. Identifies potential line movement factors
5. Keeps readers informed and engaged

Target length: 200-300 words. Write in an informative but accessible tone.
    `.trim();
  }

  /**
   * Create prompt for featured article generation
   */
  private createFeaturedArticlePrompt(topic: any): string {
    return `
Write a comprehensive featured article for sports bettors:

Title: ${topic.title}
Sport: ${topic.sport}
Focus: ${topic.focus}

Create an in-depth analysis article that includes:
1. Current situation overview
2. Key statistics and trends
3. Betting implications and opportunities
4. Expert analysis and insights
5. Forward-looking predictions
6. Actionable takeaways for bettors

Target length: 600-800 words. Use data-driven insights and maintain a professional, analytical tone. Include specific examples and betting angles.
    `.trim();
  }

  /**
   * Create prompt for betting insight generation
   */
  private createBettingInsightPrompt(topic: any): string {
    return `
Generate strategic betting insights:

Title: ${topic.title}
Focus: ${topic.focus}
Sport: ${topic.sport}

Create actionable betting content that includes:
1. Current market analysis
2. Value betting opportunities
3. Risk assessment and bankroll management
4. Strategy recommendations
5. Key metrics to track
6. Common mistakes to avoid

Target length: 400-500 words. Focus on practical, actionable advice that helps bettors make informed decisions.
    `.trim();
  }

  /**
   * Extract summary from content (first 150 characters)
   */
  private extractSummary(content: string): string {
    const summary = content.substring(0, 150).trim();
    const lastSpace = summary.lastIndexOf(' ');
    return lastSpace > 0 ? summary.substring(0, lastSpace) + '...' : summary + '...';
  }

  /**
   * Store content items in database
   */
  private async storeContentItems(contentItems: ContentItem[]): Promise<void> {
    try {
      logger.info(`💾 Storing ${contentItems.length} content items...`);

      for (const item of contentItems) {
        const { data, error } = await supabase
          .from('content_items')
          .insert({
            id: item.id,
            type: item.type,
            title: item.title,
            content: item.content,
            summary: item.summary,
            sport: item.sport,
            priority: item.priority,
            tags: item.tags,
            author: item.author,
            source_data: item.source_data,
            published_at: new Date().toISOString(),
            status: item.status,
            metadata: item.metadata
          });

        if (error) {
          logger.error(`❌ Failed to store content item ${item.id}: ${error.message}`);
        } else {
          logger.debug(`✅ Stored content item: ${item.title}`);
        }
      }

      logger.info(`✅ Content storage completed`);

    } catch (error: any) {
      logger.error(`❌ Content storage failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get published content by type and sport
   */
  async getContent(type?: string, sport?: string, limit: number = 20): Promise<ContentItem[]> {
    try {
      let query = supabase
        .from('content_items')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(limit);

      if (type) {
        query = query.eq('type', type);
      }

      if (sport) {
        query = query.eq('sport', sport);
      }

      const { data, error } = await query;

      if (error) {
        logger.error(`❌ Failed to fetch content: ${error.message}`);
        return [];
      }

      return data || [];

    } catch (error: any) {
      logger.error(`❌ Content retrieval failed: ${error.message}`);
      return [];
    }
  }
}

// Export singleton instance
export const contentGenerator = new ContentGenerator(); 
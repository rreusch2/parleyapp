import { logger } from '../utils/logger';

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content?: string;
  type: 'injury' | 'trade' | 'lineup' | 'weather' | 'breaking' | 'analysis';
  sport: string;
  league?: string;
  team?: string;
  player?: string;
  impact: 'high' | 'medium' | 'low';
  timestamp: string;
  source: string;
  sourceUrl?: string;
  imageUrl?: string;
  gameId?: string;
  tags?: string[];
}

interface InjuryReport {
  id: string;
  playerId: string;
  playerName: string;
  team: string;
  sport: string;
  injuryType: string;
  description: string;
  status: 'questionable' | 'doubtful' | 'out' | 'day-to-day' | 'ir' | 'healthy';
  estimatedReturn?: string;
  impact: 'high' | 'medium' | 'low';
  timestamp: string;
  source: string;
  gameId?: string;
}

class NewsService {
  private readonly ESPN_BASE_URL = 'http://site.api.espn.com/apis/site/v2/sports';
  private readonly SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
  private readonly newsCache: Map<string, NewsItem[]> = new Map();
  private readonly injuryCache: Map<string, InjuryReport[]> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  /**
   * Get latest sports news and injury reports
   */
  async getLatestNews(sport?: string, limit: number = 20): Promise<NewsItem[]> {
    try {
      logger.info(`[newsService]: 📰 Fetching latest news${sport ? ` for ${sport}` : ''}`);
      
      const cacheKey = `news_${sport || 'all'}_${limit}`;
      const cached = this.newsCache.get(cacheKey);
      
      if (cached && this.isCacheValid(cacheKey)) {
        logger.info(`[newsService]: 💾 Returning cached news (${cached.length} items)`);
        return cached;
      }

      // Fetch from multiple sources
      const [espnNews, injuryReports, rssNews] = await Promise.all([
        this.fetchESPNNews(sport, limit),
        this.fetchInjuryReports(sport),
        this.fetchRSSNews(sport, limit)
      ]);

      // Combine and deduplicate
      const allNews = [...espnNews, ...injuryReports, ...rssNews];
      const deduplicatedNews = this.deduplicateNews(allNews);
      
      // Sort by timestamp (newest first) and limit
      const sortedNews = deduplicatedNews
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      // Cache the results
      this.newsCache.set(cacheKey, sortedNews);
      
      logger.info(`[newsService]: ✅ Fetched ${sortedNews.length} news items`);
      return sortedNews;
    } catch (error: any) {
      logger.error('[newsService]: Error fetching news:', error);
      return this.getFallbackNews(sport);
    }
  }

  /**
   * Fetch ESPN news
   */
  private async fetchESPNNews(sport?: string, limit: number = 10): Promise<NewsItem[]> {
    try {
      const sports = sport ? [sport.toLowerCase()] : ['nfl', 'nba', 'mlb', 'nhl'];
      const newsItems: NewsItem[] = [];

      for (const sportName of sports) {
        try {
          const url = `${this.ESPN_BASE_URL}/${this.mapSportToESPN(sportName)}/news`;
          const response = await fetch(url);
          
          if (!response.ok) continue;
          
          const data = await response.json();
          
          if (data.articles && Array.isArray(data.articles)) {
            for (const article of data.articles.slice(0, limit)) {
              // Try to get more detailed content
              let content = article.story || article.body || article.description;
              if (!content || content.length < 200) {
                // If content is too short, expand the summary with relevant context
                const baseContent = article.description || article.summary || 'Click to read more';
                content = this.expandNewsContent(baseContent, article.headline || article.title || '', sportName);
              }

              newsItems.push({
                id: `espn_${article.id || Date.now()}_${Math.random()}`,
                title: article.headline || article.title || 'Breaking News',
                summary: article.description || article.summary || 'Click to read more',
                content: content,
                type: this.categorizeNews(article.headline || article.title || ''),
                sport: sportName.toUpperCase(),
                league: sportName.toUpperCase(),
                impact: this.calculateImpact(article.headline || article.title || ''),
                timestamp: article.published || new Date().toISOString(),
                source: 'ESPN',
                sourceUrl: article.links?.web?.href || article.link,
                imageUrl: article.image?.url || article.images?.[0]?.url,
                tags: this.cleanTags(article.categories || [])
              });
            }
          }
        } catch (error: any) {
          logger.warn(`[newsService]: Failed to fetch ${sportName} news from ESPN:`, error);
        }
      }

      return newsItems;
    } catch (error: any) {
      logger.error('[newsService]: Error fetching ESPN news:', error);
      return [];
    }
  }

  /**
   * Fetch injury reports from multiple sources
   */
  private async fetchInjuryReports(sport?: string): Promise<NewsItem[]> {
    try {
      const injuries = await this.fetchESPNInjuries(sport);
      
      // Convert injury reports to news items
      return injuries.map(injury => ({
        id: `injury_${injury.id}`,
        title: `${injury.playerName} - ${injury.injuryType}`,
        summary: `${injury.description} (${injury.status})`,
        type: 'injury' as const,
        sport: injury.sport,
        team: injury.team,
        player: injury.playerName,
        impact: injury.impact,
        timestamp: injury.timestamp,
        source: injury.source,
        gameId: injury.gameId,
        tags: ['injury', injury.status, injury.team.toLowerCase()]
      }));
    } catch (error: any) {
      logger.error('[newsService]: Error fetching injury reports:', error);
      return [];
    }
  }

  /**
   * Fetch ESPN injury reports
   */
  private async fetchESPNInjuries(sport?: string): Promise<InjuryReport[]> {
    try {
      const sports = sport ? [sport.toLowerCase()] : ['nfl', 'nba', 'mlb', 'nhl'];
      const injuries: InjuryReport[] = [];

      for (const sportName of sports) {
        try {
          // ESPN doesn't have a direct injury API, so we'll look for injury-related news
          const url = `${this.ESPN_BASE_URL}/${this.mapSportToESPN(sportName)}/news`;
          const response = await fetch(url);
          
          if (!response.ok) continue;
          
          const data = await response.json();
          
          if (data.articles) {
            for (const article of data.articles) {
              const headline = article.headline || article.title || '';
              if (this.isInjuryNews(headline)) {
                injuries.push({
                  id: `espn_injury_${article.id || Date.now()}_${Math.random()}`,
                  playerId: 'unknown',
                  playerName: this.extractPlayerName(headline) || 'Unknown Player',
                  team: this.extractTeamName(headline) || 'Unknown Team',
                  sport: sportName.toUpperCase(),
                  injuryType: this.extractInjuryType(headline) || 'Injury',
                  description: article.description || headline,
                  status: this.extractInjuryStatus(headline),
                  impact: this.calculateInjuryImpact(headline),
                  timestamp: article.published || new Date().toISOString(),
                  source: 'ESPN'
                });
              }
            }
          }
        } catch (error: any) {
          logger.warn(`[newsService]: Failed to fetch ${sportName} injuries:`, error);
        }
      }

      return injuries;
    } catch (error: any) {
      logger.error('[newsService]: Error fetching ESPN injuries:', error);
      return [];
    }
  }

  /**
   * Fetch news from RSS feeds
   */
  private async fetchRSSNews(sport?: string, limit: number = 10): Promise<NewsItem[]> {
    try {
      const rssFeeds = this.getRSSFeeds(sport);
      const newsItems: NewsItem[] = [];

      // Note: In production, you'd want to use a proper RSS parser
      // For now, we'll return mock data that matches the structure
      
      return this.getMockRSSNews(sport, limit);
    } catch (error: any) {
      logger.error('[newsService]: Error fetching RSS news:', error);
      return [];
    }
  }

  /**
   * Helper methods
   */
  private mapSportToESPN(sport: string): string {
    const mapping: { [key: string]: string } = {
      'nfl': 'football/nfl',
      'nba': 'basketball/nba',
      'mlb': 'baseball/mlb',
      'nhl': 'hockey/nhl'
    };
    return mapping[sport.toLowerCase()] || sport;
  }

  private categorizeNews(headline: string): NewsItem['type'] {
    const lower = headline.toLowerCase();
    if (lower.includes('injur') || lower.includes('hurt') || lower.includes('questionable')) return 'injury';
    if (lower.includes('trade') || lower.includes('sign') || lower.includes('waive')) return 'trade';
    if (lower.includes('lineup') || lower.includes('starting')) return 'lineup';
    if (lower.includes('weather') || lower.includes('rain') || lower.includes('snow')) return 'weather';
    if (lower.includes('breaking') || lower.includes('report')) return 'breaking';
    return 'analysis';
  }

  private calculateImpact(headline: string): NewsItem['impact'] {
    const lower = headline.toLowerCase();
    if (lower.includes('star') || lower.includes('mvp') || lower.includes('playoff') || lower.includes('championship')) return 'high';
    if (lower.includes('starter') || lower.includes('key') || lower.includes('important')) return 'medium';
    return 'low';
  }

  private isInjuryNews(headline: string): boolean {
    const lower = headline.toLowerCase();
    return lower.includes('injur') || lower.includes('hurt') || lower.includes('questionable') || 
           lower.includes('doubtful') || lower.includes('out') || lower.includes('ir');
  }

  private extractPlayerName(headline: string): string | null {
    // Simple extraction - in production, use NLP or player database matching
    const words = headline.split(' ');
    // Look for capitalized words that might be names
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].match(/^[A-Z][a-z]+$/) && words[i + 1].match(/^[A-Z][a-z]+$/)) {
        return `${words[i]} ${words[i + 1]}`;
      }
    }
    return null;
  }

  private extractTeamName(headline: string): string | null {
    const teams = ['Lakers', 'Warriors', 'Celtics', 'Heat', 'Cowboys', 'Patriots', 'Yankees', 'Dodgers'];
    for (const team of teams) {
      if (headline.includes(team)) return team;
    }
    return null;
  }

  private extractInjuryType(headline: string): string | null {
    const injuries = ['ankle', 'knee', 'shoulder', 'back', 'hamstring', 'concussion', 'wrist', 'elbow'];
    const lower = headline.toLowerCase();
    for (const injury of injuries) {
      if (lower.includes(injury)) return injury;
    }
    return null;
  }

  private extractInjuryStatus(headline: string): InjuryReport['status'] {
    const lower = headline.toLowerCase();
    if (lower.includes('out')) return 'out';
    if (lower.includes('doubtful')) return 'doubtful';
    if (lower.includes('questionable')) return 'questionable';
    if (lower.includes('day-to-day')) return 'day-to-day';
    if (lower.includes('ir')) return 'ir';
    return 'questionable';
  }

  private calculateInjuryImpact(headline: string): InjuryReport['impact'] {
    const lower = headline.toLowerCase();
    if (lower.includes('star') || lower.includes('mvp') || lower.includes('key')) return 'high';
    if (lower.includes('starter') || lower.includes('important')) return 'medium';
    return 'low';
  }

  /**
   * Expand news content with relevant context when original content is too short
   */
  private expandNewsContent(baseContent: string, title: string, sport: string): string {
    const type = this.categorizeNews(title);
    let expandedContent = baseContent;

    // Add sport-specific context
    const sportContext = this.getSportContext(sport, type);
    if (sportContext) {
      expandedContent += `\n\n${sportContext}`;
    }

    // Add type-specific insights
    const typeContext = this.getTypeContext(type, title);
    if (typeContext) {
      expandedContent += `\n\n${typeContext}`;
    }

    return expandedContent;
  }

  /**
   * Get sport-specific context
   */
  private getSportContext(sport: string, type: string): string {
    const sportLower = sport.toLowerCase();
    
    switch (sportLower) {
      case 'nba':
        return 'NBA developments can significantly impact player props, team spreads, and over/under lines. Monitor injury reports and lineup changes closely.';
      case 'nfl':
        return 'NFL news affects weekly betting markets dramatically. Consider how this impacts point spreads, player props, and team totals.';
      case 'mlb':
        return 'Baseball news influences daily betting markets. Pay attention to pitching matchups, weather conditions, and lineup changes.';
      case 'nhl':
        return 'Hockey developments can affect puck lines, totals, and player prop bets. Goalie changes and injury reports are particularly important.';
      default:
        return '';
    }
  }

  /**
   * Get type-specific context
   */
  private getTypeContext(type: string, title: string): string {
    switch (type) {
      case 'injury':
        return 'Injury reports are crucial for sports betting. Key players being out can shift point spreads by several points and dramatically affect over/under totals.';
      case 'trade':
        return 'Trades can reshape team dynamics and affect betting lines. New players may need time to adjust, while departing players leave gaps in team performance.';
      case 'breaking':
        return 'Breaking news often creates immediate opportunities in betting markets. Quick line movements may occur as sportsbooks adjust to new information.';
      case 'analysis':
        return 'Statistical analysis provides valuable insights for informed betting decisions. Look for trends that might not be reflected in current betting lines.';
      case 'lineup':
        return 'Lineup changes can significantly impact game outcomes. Star players sitting out or playing different positions affects team performance metrics.';
      default:
        return 'Stay informed with the latest sports developments to make better betting decisions.';
    }
  }

  /**
   * Clean and simplify tags array
   */
  private cleanTags(tags: any[]): string[] {
    if (!Array.isArray(tags)) return [];
    
    return tags
      .map(tag => {
        if (typeof tag === 'string') return tag;
        if (tag?.name) return tag.name;
        if (tag?.description) return tag.description;
        if (tag?.type) return tag.type;
        return null;
      })
      .filter(tag => tag && typeof tag === 'string')
      .filter(tag => tag.length < 50) // Remove overly long tags
      .slice(0, 5); // Limit to 5 tags max
  }

  private deduplicateNews(news: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    return news.filter(item => {
      const key = `${item.title}_${item.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private isCacheValid(cacheKey: string): boolean {
    // Simple cache validation - in production, implement proper TTL
    return false; // Always fetch fresh for now
  }

  private getRSSFeeds(sport?: string): string[] {
    const feeds = [
      'http://www.espn.com/espn/rss/news',
      'https://www.cbssports.com/rss/headlines/nfl/',
      'https://www.cbssports.com/rss/headlines/nba/',
      'https://www.cbssports.com/rss/headlines/mlb/',
      'https://www.cbssports.com/rss/headlines/nhl/'
    ];
    return sport ? feeds.filter(feed => feed.includes(sport.toLowerCase())) : feeds;
  }

  private getMockRSSNews(sport?: string, limit: number = 5): NewsItem[] {
    const mockNews: NewsItem[] = [
      {
        id: 'rss_1',
        title: 'NBA Season Trends Shaping Playoff Picture',
        summary: 'Current team performances are creating interesting storylines as we approach the playoffs...',
        type: 'analysis',
        sport: 'NBA',
        impact: 'medium',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        source: 'CBS Sports',
        tags: ['analysis', 'playoffs']
      },
      {
        id: 'rss_2',
        title: 'MLB Spring Training Underway',
        summary: 'Teams are beginning spring preparations with key focus areas emerging for the upcoming season...',
        type: 'analysis',
        sport: 'MLB',
        impact: 'low',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        source: 'ESPN',
        tags: ['spring-training', 'analysis']
      }
    ];

    return sport ? mockNews.filter(item => item.sport.toLowerCase() === sport.toLowerCase()) : mockNews;
  }

  private getFallbackNews(sport?: string): NewsItem[] {
    return [
      {
        id: 'fallback_1',
        title: 'News Service Temporarily Unavailable',
        summary: 'We\'re working to restore the news feed. Please check back shortly.',
        type: 'analysis',
        sport: sport?.toUpperCase() || 'ALL',
        impact: 'low',
        timestamp: new Date().toISOString(),
        source: 'Predictive Play',
        tags: ['system']
      }
    ];
  }
}

export const newsService = new NewsService();
export { NewsItem, InjuryReport }; 
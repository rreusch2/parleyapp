import axios from 'axios';
import dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';

// Load environment variables
dotenv.config();

const logger = createLogger('webSearch');

// API keys for different search providers
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

// Define interface for search result
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  publishedDate?: string;
}

/**
 * Service for performing web searches to gather qualitative information
 */
class WebSearchService {
  /**
   * Perform a web search using available search APIs
   * @param query - Search query
   * @returns Array of search results
   */
  async performSearch(query: string): Promise<SearchResult[]> {
    logger.info(`Performing web search for: "${query}"`);
    
    try {
      // Try SerpAPI first if available
      if (SERPAPI_KEY) {
        return await this.searchWithSerpApi(query);
      }
      
      // Fall back to Google Custom Search if available
      if (GOOGLE_SEARCH_API_KEY && GOOGLE_SEARCH_ENGINE_ID) {
        return await this.searchWithGoogleCustomSearch(query);
      }
      
      // Fall back to a simple scraper (for development only)
      logger.warn('No search API keys found. Using fallback search method.');
      return await this.fallbackSearch(query);
    } catch (error) {
      logger.error(`Error performing web search: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Search using SerpAPI
   * @param query - Search query
   */
  private async searchWithSerpApi(query: string): Promise<SearchResult[]> {
    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          q: query,
          api_key: SERPAPI_KEY,
          engine: 'google'
        }
      });
      
      const organicResults = response.data.organic_results || [];
      
      return organicResults.map((result: any) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
        source: 'SerpAPI',
        publishedDate: result.date
      })).slice(0, 5); // Limit to top 5 results
    } catch (error) {
      logger.error(`SerpAPI search failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Search using Google Custom Search API
   * @param query - Search query
   */
  private async searchWithGoogleCustomSearch(query: string): Promise<SearchResult[]> {
    try {
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          q: query,
          key: GOOGLE_SEARCH_API_KEY,
          cx: GOOGLE_SEARCH_ENGINE_ID
        }
      });
      
      const items = response.data.items || [];
      
      return items.map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        source: 'Google Custom Search',
        publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time']
      })).slice(0, 5); // Limit to top 5 results
    } catch (error) {
      logger.error(`Google Custom Search failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Fallback search method using a simple scraper
   * Note: This is for development purposes only and should be replaced with a proper API in production
   * @param query - Search query
   */
  private async fallbackSearch(query: string): Promise<SearchResult[]> {
    // This is a simplified fallback that returns mock data
    // In a real implementation, you might use a library like cheerio to scrape search results
    logger.info('Using optimized mock search results for development');
    
    // Return relevant mock results based on query content
    const isInjuryQuery = query.toLowerCase().includes('injury');
    const isNewsQuery = query.toLowerCase().includes('news');
    
    if (isInjuryQuery) {
      return [
        {
          title: 'No significant injuries reported',
          link: 'https://espn.com/mock',
          snippet: 'Latest injury reports show no major concerns for key players.',
          source: 'Mock Sports News'
        }
      ];
    }
    
    if (isNewsQuery) {
      return [
        {
          title: 'Team performing well this season',
          link: 'https://espn.com/mock',
          snippet: 'Recent performance analysis and team updates.',
          source: 'Mock Sports News'
        }
      ];
    }
    
    return [
      {
        title: 'No significant news found',
        link: 'https://example.com/mock',
        snippet: 'No major news or updates found that would significantly impact betting predictions.',
        source: 'Mock Search'
      }
    ];
  }

  /**
   * Search specifically for sports news related to a team or player
   * @param entity - Team or player name
   * @param sport - Sport name
   */
  async searchSportsNews(entity: string, sport: string): Promise<SearchResult[]> {
    const query = `${entity} ${sport} news recent`;
    logger.info(`Searching for sports news: "${query}"`);
    
    return this.performSearch(query);
  }

  /**
   * Search for injury reports
   * @param team - Team name
   * @param sport - Sport name
   */
  async searchInjuryReports(team: string, sport: string): Promise<SearchResult[]> {
    const query = `${team} ${sport} injury report`;
    logger.info(`Searching for injury reports: "${query}"`);
    
    return this.performSearch(query);
  }
}

// Create and export service instance
export const webSearchService = new WebSearchService();

// Export tool function for the LLM orchestrator
export const webSearchPerformSearchTool = async (query: string) => {
  return await webSearchService.performSearch(query);
}; 
import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabase } from './supabase/client';
import { logger } from '../utils/logger';

interface InjuryData {
  playerName: string;
  playerId?: string;
  team: string;
  position: string;
  estimatedReturn: string;
  status: string;
  comment: string;
  sport: string;
  sourceUrl: string;
  scrapedAt: Date;
}

class InjuryScrapingService {
  private readonly baseUrl = 'https://www.espn.com';
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  
  private readonly injuryPages = {
    mlb: '/mlb/injuries'
  };

  /**
   * Scrape injuries for MLB
   */
  async scrapeInjuries(sport: 'mlb'): Promise<InjuryData[]> {
    try {
      logger.info(`[InjuryScrapingService]: 🏥 Scraping ${sport.toUpperCase()} injuries...`);
      
      const url = `${this.baseUrl}${this.injuryPages[sport]}`;
      const html = await this.fetchPage(url);
      const injuries = this.parseInjuries(html, sport, url);
      
      logger.info(`[InjuryScrapingService]: ✅ Scraped ${injuries.length} ${sport.toUpperCase()} injuries`);
      return injuries;
    } catch (error) {
      logger.error(`[InjuryScrapingService]: Error scraping ${sport} injuries:`, error);
      return [];
    }
  }

  /**
   * Scrape MLB injuries only
   */
  async scrapeMLBInjuries(): Promise<InjuryData[]> {
    // Only scrape MLB injuries from https://www.espn.com/mlb/injuries
    return await this.scrapeInjuries('mlb');
  }

  /**
   * Fetch page with proper headers and error handling
   */
  private async fetchPage(url: string): Promise<string> {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000
    });
    
    return response.data;
  }

  /**
   * Parse injuries from HTML (which may contain JSON data)
   */
  private parseInjuries(html: string, sport: string, sourceUrl: string): InjuryData[] {
    const injuries: InjuryData[] = [];

    try {
      // ESPN now returns JSON data embedded in the HTML
      // Look for the injury data in the page - try multiple patterns
      let jsonMatch = html.match(/"data":\s*({.*?"dropdownTeams".*?})/s);
      
      if (!jsonMatch) {
        // Try alternative pattern for ESPN injury data
        jsonMatch = html.match(/window\.__espnfitt__\s*=\s*({.*?});/s) ||
                   html.match(/window\.__NEXT_DATA__\s*=\s*({.*?});/s) ||
                   html.match(/({[^}]*"teams":\s*\[[^}]*"displayName"[^}]*"items"[^}]*})/s);
      }
      
      if (jsonMatch) {
        const injuryData = JSON.parse(jsonMatch[1]);
        
        if (injuryData.teams && Array.isArray(injuryData.teams)) {
          logger.info(`[InjuryScrapingService]: Found ${injuryData.teams.length} teams with injury data`);
          
          injuryData.teams.forEach((team: any) => {
            const teamName = team.displayName || 'Unknown Team';
            
            if (team.items && Array.isArray(team.items)) {
              team.items.forEach((injury: any) => {
                try {
                  const injuryRecord = this.parseESPNInjuryItem(injury, teamName, sport, sourceUrl);
                  if (injuryRecord) {
                    injuries.push(injuryRecord);
                  }
                } catch (error) {
                  logger.warn(`[InjuryScrapingService]: Error parsing injury item:`, error);
                }
              });
            }
          });
        }
      } else {
        // Fallback to HTML parsing if JSON not found
        logger.info(`[InjuryScrapingService]: JSON data not found, falling back to HTML parsing`);
        return this.parseInjuriesFromHTML(html, sport, sourceUrl);
      }
    } catch (error) {
      logger.error(`[InjuryScrapingService]: Error parsing JSON data:`, error);
      // Fallback to HTML parsing
      return this.parseInjuriesFromHTML(html, sport, sourceUrl);
    }

    return injuries;
  }

  /**
   * Parse individual ESPN injury item from JSON
   */
  private parseESPNInjuryItem(injury: any, teamName: string, sport: string, sourceUrl: string): InjuryData | null {
    try {
      if (!injury.athlete) return null;

      const playerName = injury.athlete.name || injury.athlete.shortName || '';
      const playerId = injury.athlete.href ? this.extractPlayerIdFromUrl(injury.athlete.href) : undefined;
      const position = injury.athlete.position || '';
      const status = injury.statusDesc || injury.type?.description || '';
      const estimatedReturn = injury.date || '';
      const description = injury.description || '';

      return {
        playerName,
        playerId,
        team: teamName,
        position,
        estimatedReturn,
        status,
        comment: description,
        sport: sport.toUpperCase(),
        sourceUrl,
        scrapedAt: new Date()
      };
    } catch (error) {
      logger.warn(`[InjuryScrapingService]: Error parsing ESPN injury item:`, error);
      return null;
    }
  }

  /**
   * Fallback HTML parsing method
   */
  private parseInjuriesFromHTML(html: string, sport: string, sourceUrl: string): InjuryData[] {
    const $ = cheerio.load(html);
    const injuries: InjuryData[] = [];
    let currentTeam = '';

    // ESPN structure: Look for team headers and following tables
    $('*').each((_, element) => {
      const $element = $(element);
      
      // Look for team names - they appear as headers before injury tables
      if ($element.is('img') && $element.attr('alt')) {
        const altText = $element.attr('alt') || '';
        if (altText.length > 3 && !altText.toLowerCase().includes('logo') && 
            !altText.toLowerCase().includes('espn') && !altText.toLowerCase().includes('bet')) {
          currentTeam = altText;
        }
      }
      
      // Check if it's an injury table
      if ($element.is('table')) {
        const tableRows = $element.find('tbody tr');
        if (tableRows.length > 0) {
          tableRows.each((_, row) => {
            const injury = this.parseInjuryRow($(row), currentTeam, sport, sourceUrl);
            if (injury) {
              injuries.push(injury);
            }
          });
        }
      }
    });

    return injuries;
  }

  /**
   * Parse individual injury row
   */
  private parseInjuryRow(
    $row: cheerio.Cheerio, 
    team: string, 
    sport: string, 
    sourceUrl: string
  ): InjuryData | null {
    try {
      const cells = $row.find('td');
      if (cells.length < 4) return null;

      // Extract player name and ID from link
      const playerLink = cells.eq(0).find('a');
      const playerName = playerLink.text().trim() || cells.eq(0).text().trim();
      const playerId = this.extractPlayerIdFromUrl(playerLink.attr('href'));
      
      const position = cells.eq(1).text().trim();
      const estimatedReturn = cells.eq(2).text().trim();
      const status = cells.eq(3).text().trim();
      const comment = cells.eq(4) ? cells.eq(4).text().trim() : '';

      return {
        playerName,
        playerId,
        team,
        position,
        estimatedReturn,
        status,
        comment,
        sport: sport.toUpperCase(),
        sourceUrl,
        scrapedAt: new Date()
      };
    } catch (error) {
      logger.warn('[InjuryScrapingService]: Error parsing injury row:', error);
      return null;
    }
  }

  /**
   * Extract ESPN player ID from URL
   */
  private extractPlayerIdFromUrl(url?: string): string | undefined {
    if (!url) return undefined;
    const match = url.match(/\/player\/_\/id\/(\d+)/);
    return match ? match[1] : undefined;
  }

  /**
   * Store injuries in database
   */
  async storeInjuries(injuries: InjuryData[]): Promise<void> {
    try {
      logger.info(`[InjuryScrapingService]: 💾 Storing ${injuries.length} injuries in database...`);
      
      // Clear existing scraped injuries (optional - or you could do incremental updates)
      await supabase
        .from('injury_reports')
        .delete()
        .eq('source', 'ESPN_SCRAPE');

      // Transform data for database
      const injuryRecords = injuries.map(injury => ({
        player_name: injury.playerName,
        external_player_id: injury.playerId,
        team_name: injury.team,
        position: injury.position,
        injury_status: this.normalizeStatus(injury.status),
        estimated_return_date: this.parseReturnDate(injury.estimatedReturn),
        description: injury.comment,
        sport: injury.sport,
        source: 'ESPN_SCRAPE',
        source_url: injury.sourceUrl,
        scraped_at: injury.scrapedAt.toISOString(),
        is_active: true
      }));

      // Insert in batches to avoid hitting limits
      const batchSize = 100;
      for (let i = 0; i < injuryRecords.length; i += batchSize) {
        const batch = injuryRecords.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('injury_reports')
          .insert(batch);

        if (error) {
          logger.error('[InjuryScrapingService]: Database insert error:', error);
        }
      }

      logger.info(`[InjuryScrapingService]: ✅ Stored ${injuries.length} injuries`);
    } catch (error) {
      logger.error('[InjuryScrapingService]: Error storing injuries:', error);
    }
  }

  /**
   * Normalize injury status to standard values while preserving ESPN's specific statuses
   */
  private normalizeStatus(status: string): string {
    const statusTrimmed = status.trim();
    
    // Keep ESPN's specific statuses as they are more informative
    if (statusTrimmed.includes('Day-To-Day')) return 'Day-To-Day';
    if (statusTrimmed.includes('10-Day-IL')) return '10-Day-IL';
    if (statusTrimmed.includes('15-Day-IL')) return '15-Day-IL';
    if (statusTrimmed.includes('60-Day-IL')) return '60-Day-IL';
    if (statusTrimmed.includes('7-Day-IL')) return '7-Day-IL';
    if (statusTrimmed.includes('Doubtful')) return 'Doubtful';
    if (statusTrimmed.includes('Questionable')) return 'Questionable';
    if (statusTrimmed.includes('Probable')) return 'Probable';
    if (statusTrimmed.includes('Out')) return 'Out';
    
    // Return the original status if it doesn't match our patterns
    return statusTrimmed || 'Unknown';
  }

  /**
   * Parse estimated return date
   */
  private parseReturnDate(dateStr: string): string | null {
    if (!dateStr || dateStr.toLowerCase().includes('unknown')) return null;
    
    try {
      // Handle formats like "Jun 23", "Jul 1", etc.
      const currentYear = new Date().getFullYear();
      const parsed = new Date(`${dateStr} ${currentYear}`);
      
      if (isNaN(parsed.getTime())) return null;
      
      return parsed.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch {
      return null;
    }
  }

  /**
   * Add delay between requests
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run MLB injury scraping and storage
   */
  async runInjuryUpdate(): Promise<void> {
    try {
      logger.info('[InjuryScrapingService]: 🚀 Starting MLB injury update...');
      
      const injuries = await this.scrapeMLBInjuries();
      await this.storeInjuries(injuries);
      
      logger.info('[InjuryScrapingService]: ✅ MLB injury update completed');
    } catch (error) {
      logger.error('[InjuryScrapingService]: MLB injury update failed:', error);
    }
  }
}

export const injuryScrapingService = new InjuryScrapingService();
export default InjuryScrapingService; 
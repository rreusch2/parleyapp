import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Service for interacting with the SportRadar API
 */
class SportRadarService {
  private apiKey: string;
  private baseUrl: string = 'https://api.sportradar.us';
  private cachePath: string;
  private cacheExpiration: number = 3600000; // 1 hour in milliseconds

  constructor() {
    this.apiKey = process.env.SPORTRADAR_API_KEY || '';
    if (!this.apiKey) {
      console.error('SPORTRADAR_API_KEY is not set in the environment variables');
    }
    
    // Setup cache directory
    this.cachePath = path.join(__dirname, '../../../data/cache');
    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true });
    }
  }

  /**
   * Get available sports from the Odds Comparison API (Player Props)
   */
  async getAvailableSports() {
    return this.fetchWithCache('player_props_sports', 
      `${this.baseUrl}/oddscomparison-player-props/trial/v2/en/sports.json?api_key=${this.apiKey}`);
  }

  /**
   * Get available sports from the Prematch Odds Comparison API
   */
  async getPrematchSports() {
    return this.fetchWithCache('prematch_sports', 
      `${this.baseUrl}/oddscomparison-prematch/trial/v2/en/sports.json?api_key=${this.apiKey}`);
  }

  /**
   * Get NBA league hierarchy
   */
  async getNbaHierarchy() {
    return this.fetchWithCache('nba_hierarchy', 
      `${this.baseUrl}/nba/trial/v8/en/league/hierarchy.json?api_key=${this.apiKey}`);
  }

  /**
   * Get MLB league hierarchy
   */
  async getMlbHierarchy() {
    return this.fetchWithCache('mlb_hierarchy', 
      `${this.baseUrl}/mlb/trial/v7/en/league/hierarchy.json?api_key=${this.apiKey}`);
  }

  /**
   * Get NHL league hierarchy
   */
  async getNhlHierarchy() {
    return this.fetchWithCache('nhl_hierarchy', 
      `${this.baseUrl}/nhl/trial/v7/en/league/hierarchy.json?api_key=${this.apiKey}`);
  }

  /**
   * Get NBA daily schedule
   * @param year - Year (YYYY)
   * @param month - Month (MM)
   * @param day - Day (DD)
   */
  async getNbaDailySchedule(year: string, month: string, day: string) {
    const cacheKey = `nba_schedule_${year}_${month}_${day}`;
    return this.fetchWithCache(cacheKey, 
      `${this.baseUrl}/nba/trial/v8/en/games/${year}/${month}/${day}/schedule.json?api_key=${this.apiKey}`);
  }

  /**
   * Get NBA game boxscore
   * @param gameId - SportRadar Game ID
   */
  async getNbaGameBoxscore(gameId: string) {
    return this.fetchWithCache(`nba_boxscore_${gameId}`, 
      `${this.baseUrl}/nba/trial/v8/en/games/${gameId}/boxscore.json?api_key=${this.apiKey}`);
  }

  /**
   * Get MLB daily schedule
   * @param year - Year (YYYY)
   * @param month - Month (MM)
   * @param day - Day (DD)
   */
  async getMlbDailySchedule(year: string, month: string, day: string) {
    const cacheKey = `mlb_schedule_${year}_${month}_${day}`;
    return this.fetchWithCache(cacheKey, 
      `${this.baseUrl}/mlb/trial/v7/en/games/${year}/${month}/${day}/schedule.json?api_key=${this.apiKey}`);
  }

  /**
   * Get NHL daily schedule
   * @param year - Year (YYYY)
   * @param month - Month (MM)
   * @param day - Day (DD)
   */
  async getNhlDailySchedule(year: string, month: string, day: string) {
    const cacheKey = `nhl_schedule_${year}_${month}_${day}`;
    return this.fetchWithCache(cacheKey, 
      `${this.baseUrl}/nhl/trial/v7/en/games/${year}/${month}/${day}/schedule.json?api_key=${this.apiKey}`);
  }

  /**
   * Get player props markets
   * This uses the Odds Comparison Player Props API
   */
  async getPlayerPropsMarkets() {
    return this.fetchWithCache('player_props_markets', 
      `${this.baseUrl}/oddscomparison-player-props/trial/v2/en/markets.json?api_key=${this.apiKey}`);
  }

  /**
   * Generic method to fetch data from any endpoint
   * @param endpoint - Full endpoint URL
   */
  async fetchFromEndpoint(endpoint: string) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }

  /**
   * Fetch data with caching
   * @param cacheKey - Unique key for caching
   * @param url - URL to fetch data from
   */
  private async fetchWithCache(cacheKey: string, url: string) {
    const cacheFilePath = path.join(this.cachePath, `${cacheKey}.json`);
    
    // Check if cache exists and is not expired
    if (fs.existsSync(cacheFilePath)) {
      const stats = fs.statSync(cacheFilePath);
      const fileAge = Date.now() - stats.mtimeMs;
      
      if (fileAge < this.cacheExpiration) {
        try {
          const cachedData = fs.readFileSync(cacheFilePath, 'utf8');
          return JSON.parse(cachedData);
        } catch (error) {
          console.error('Error reading cache:', error);
          // Continue to fetch fresh data if cache read fails
        }
      }
    }
    
    // Fetch fresh data
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Save to cache
      fs.writeFileSync(cacheFilePath, JSON.stringify(data, null, 2));
      
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }
}

export default new SportRadarService(); 
/**
 * The Odds API Service
 * Fetches real-time odds from The Odds API (replacement for Sportradar)
 * Free tier: 500 credits/month
 * Covers major US bookmakers: DraftKings, FanDuel, BetMGM, Caesars, etc.
 */

import axios from 'axios';
import { createLogger } from '../utils/logger';

const logger = createLogger('oddsApi');

interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

interface OddsApiMarket {
  key: string; // 'h2h' for moneyline, 'totals' for over/under
  outcomes?: OddsApiOutcome[];
  points?: number; // For totals market
}

interface OddsApiOutcome {
  name: string;
  price: number; // American odds format
  point?: number; // For totals (over/under line)
}

interface OddsApiGame {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

interface ExtractedOdds {
  moneyline?: { home: number, away: number, source: string },
  total?: { line: number, over: number, under: number, source: string },
  success: boolean,
  error?: string
}

class OddsApiService {
  private apiKey: string;
  private baseUrl: string;
  private preferredBookmakers = ['fanduel', 'draftkings', 'betmgm', 'caesars', 'bovada'];

  constructor() {
    this.apiKey = process.env.THE_ODDS_API_KEY || '';
    this.baseUrl = process.env.THE_ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';

    if (!this.apiKey) {
      logger.warn('⚠️ THE_ODDS_API_KEY not found in environment variables');
    } else {
      logger.info(`✅ The Odds API service initialized`);
    }
  }

  /**
   * Map our internal sport names to The Odds API sport keys
   */
  private mapSportToApiKey(sport: string): string {
    const sportMapping: Record<string, string> = {
      'MLB': 'baseball_mlb',
      'NBA': 'basketball_nba', 
      'NFL': 'americanfootball_nfl',
      'NHL': 'icehockey_nhl',
      'NCAAB': 'basketball_ncaab',
      'NCAAF': 'americanfootball_ncaaf'
    };

    return sportMapping[sport] || sport.toLowerCase();
  }

  /**
   * Get odds for a specific game by team names and sport
   */
  async getGameOdds(homeTeam: string, awayTeam: string, sport: string): Promise<ExtractedOdds> {
    try {
      if (!this.apiKey) {
        return { success: false, error: 'The Odds API key not configured' };
      }

      const sportKey = this.mapSportToApiKey(sport);
      
      logger.info(`🔍 Fetching odds from The Odds API for ${awayTeam} @ ${homeTeam} (${sportKey})`);

      // Fetch odds for the sport with both h2h (moneyline) and totals markets
      const response = await axios.get(`${this.baseUrl}/sports/${sportKey}/odds`, {
        params: {
          apiKey: this.apiKey,
          regions: 'us', // Focus on US bookmakers
          markets: 'h2h,totals', // Head-to-head (moneyline) and totals (over/under)
          oddsFormat: 'american', // Use American odds format
          dateFormat: 'iso'
        },
        timeout: 10000
      });

      const games: OddsApiGame[] = response.data;
      
      // Find the specific game by team names
      const game = this.findGameByTeams(games, homeTeam, awayTeam);
      
      if (!game) {
        return { 
          success: false, 
          error: `Game not found: ${awayTeam} @ ${homeTeam} in ${sportKey}` 
        };
      }

      // Extract odds from the game
      const extractedOdds = this.extractOddsFromGame(game);
      
      if (extractedOdds.moneyline || extractedOdds.total) {
        logger.info(`✅ Retrieved odds from The Odds API: ML ${extractedOdds.moneyline ? 'YES' : 'NO'}, Total ${extractedOdds.total ? 'YES' : 'NO'}`);
        return { ...extractedOdds, success: true };
      } else {
        return { 
          success: false, 
          error: 'No usable odds found for this game' 
        };
      }

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        if (status === 401) {
          logger.error(`❌ The Odds API authentication failed: Invalid API key`);
          return { success: false, error: 'Invalid API key' };
        } else if (status === 429) {
          logger.error(`❌ The Odds API rate limit exceeded`);
          return { success: false, error: 'Rate limit exceeded' };
        } else {
          logger.error(`❌ The Odds API error (${status}): ${message}`);
          return { success: false, error: `API error: ${message}` };
        }
      } else {
        logger.error(`❌ The Odds API request failed: ${error}`);
        return { success: false, error: `Request failed: ${error}` };
      }
    }
  }

  /**
   * Find a game by team names (with fuzzy matching)
   */
  private findGameByTeams(games: OddsApiGame[], homeTeam: string, awayTeam: string): OddsApiGame | null {
    // Clean team names for comparison
    const cleanTeamName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanHome = cleanTeamName(homeTeam);
    const cleanAway = cleanTeamName(awayTeam);

    for (const game of games) {
      const gameHome = cleanTeamName(game.home_team);
      const gameAway = cleanTeamName(game.away_team);

      // Exact match
      if (gameHome === cleanHome && gameAway === cleanAway) {
        return game;
      }

      // Fuzzy match - check if team names are contained within each other
      if ((gameHome.includes(cleanHome) || cleanHome.includes(gameHome)) &&
          (gameAway.includes(cleanAway) || cleanAway.includes(gameAway))) {
        logger.info(`📝 Fuzzy matched: "${awayTeam} @ ${homeTeam}" -> "${game.away_team} @ ${game.home_team}"`);
        return game;
      }
    }

    return null;
  }

  /**
   * Extract moneyline and totals odds from a game
   */
  private extractOddsFromGame(game: OddsApiGame): Omit<ExtractedOdds, 'success' | 'error'> {
    const result: Omit<ExtractedOdds, 'success' | 'error'> = {};

    // Find the best bookmaker (prefer our preferred list)
    const bookmaker = this.selectBestBookmaker(game.bookmakers);
    
    if (!bookmaker) {
      return result;
    }

    // Extract moneyline odds (h2h market)
    const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
    if (h2hMarket && h2hMarket.outcomes && h2hMarket.outcomes.length >= 2) {
      const homeOutcome = h2hMarket.outcomes.find(o => o.name === game.home_team);
      const awayOutcome = h2hMarket.outcomes.find(o => o.name === game.away_team);
      
      if (homeOutcome && awayOutcome) {
        result.moneyline = {
          home: homeOutcome.price,
          away: awayOutcome.price,
          source: bookmaker.title
        };
      }
    }

    // Extract totals odds (totals market)
    const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');
    if (totalsMarket && totalsMarket.outcomes && totalsMarket.outcomes.length >= 2) {
      const overOutcome = totalsMarket.outcomes.find(o => o.name === 'Over');
      const underOutcome = totalsMarket.outcomes.find(o => o.name === 'Under');
      
      if (overOutcome && underOutcome && overOutcome.point !== undefined) {
        result.total = {
          line: overOutcome.point,
          over: overOutcome.price,
          under: underOutcome.price,
          source: bookmaker.title
        };
      }
    }

    return result;
  }

  /**
   * Select the best bookmaker from available options
   */
  private selectBestBookmaker(bookmakers: OddsApiBookmaker[]): OddsApiBookmaker | null {
    if (!bookmakers || bookmakers.length === 0) {
      return null;
    }

    // Try to find a preferred bookmaker
    for (const preferred of this.preferredBookmakers) {
      const bookmaker = bookmakers.find(b => b.key === preferred);
      if (bookmaker && bookmaker.markets.length > 0) {
        return bookmaker;
      }
    }

    // Fallback to first available bookmaker with markets
    return bookmakers.find(b => b.markets.length > 0) || bookmakers[0];
  }

  /**
   * Get available sports from The Odds API
   */
  async getAvailableSports(): Promise<{ key: string, title: string }[]> {
    try {
      if (!this.apiKey) {
        logger.warn('⚠️ The Odds API key not configured');
        return [];
      }

      const response = await axios.get(`${this.baseUrl}/sports`, {
        params: { apiKey: this.apiKey },
        timeout: 5000
      });

      return response.data;
    } catch (error) {
      logger.error(`❌ Failed to fetch available sports: ${error}`);
      return [];
    }
  }
}

export default new OddsApiService(); 
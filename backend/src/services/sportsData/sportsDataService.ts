import { supabase, supabaseAdmin } from '../supabase/client';
// Import the new sportsDbApi client and base URL
import { sportsDbApi, THESPORTSDB_V1_BASE_URL } from './apiSportsClient';
import axios from 'axios';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define TheSportsDB specific League IDs and Sport Names
// IMPORTANT: Replace these placeholder IDs with actual IDs from TheSportsDB
const LEAGUES_TSDB = {
  NFL: { id: "4391", sportName: "NFL" },
  NBA: { id: "4387", sportName: "NBA" },
  MLB: { id: "4424", sportName: "MLB" },
  NHL: { id: "4380", sportName: "NHL" }
  // You can find these IDs on TheSportsDB website or by inspecting results from sportsDbApi.getAllLeagues()
};

// Add logging for league IDs
console.log('Configured league IDs:', LEAGUES_TSDB);

// Current season - TheSportsDB uses YYYY or YYYY-YYYY format for seasons.
// This might need adjustment based on which endpoint is used.
const CURRENT_SEASON_TSDB = new Date().getFullYear().toString(); // e.g., "2025"

// Set to true to use mock data instead of making real API calls
const USE_MOCK_DATA = false;

// Mock data for testing - this would need to be updated to TheSportsDB format if used
const MOCK_EVENTS_TSDB = {
  events: [
    {
      idEvent: "1001",
      strEvent: "Mock Home vs Mock Away",
      strHomeTeam: "Mock Home Team",
      strAwayTeam: "Mock Away Team",
      dateEvent: "2025-06-03",
      strTime: "19:00:00",
      strVenue: "Mock Stadium",
      strStatus: "Not Started",
      strLeague: "Mock League",
      strSport: "Mock Sport",
      strThumb: "url/to/thumb.jpg", // Example field for images
      // Add other relevant fields from TheSportsDB event structure
    }
  ]
};

// Removed MOCK_ODDS as TheSportsDB free tier doesn't typically provide them.

// Add type definition at the top of the file
interface TheSportsDBEvent {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  dateEvent: string;
  strTime: string;
  strStatus: string;
  strVenue: string;
  strCity: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  intSpectators: string | null;
  strThumb: string;
  strHomeTeamBadge: string;
  strAwayTeamBadge: string;
  strLeagueLogo: string;
  strProgress: string;
  strLeague: string;
  strSport: string;
}

class SportsDataService {
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
    } catch (error: any) {
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
        } catch (error: any) {
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
    } catch (error: any) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }

  async fetchAndStoreUpcomingGames(sportId?: number, sportName?: string, days: number = 7) {
    console.log("Attempting to fetch and store upcoming games...");
    const systemDate = new Date();
    const processedGames = new Set(); // Track processed games to prevent duplicates

    const fetchAndStoreForDate = async (date: Date, source: string, sportId?: number, sportName?: string) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const currentDateStr = `${year}-${month}-${day}`;

      console.log(`Using date for fetching: ${currentDateStr}`);

      if (source === 'ESPN' && sportName === 'MLB') {
        try {
          console.log('Fetching current MLB games from ESPN API...');
          const espnResponse = await fetch('http://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard');
          const espnData = await espnResponse.json();

          if (espnData && espnData.events) {
            console.log(`Found ${espnData.events.length} current MLB games from ESPN API`);

            for (const event of espnData.events) {
              const competition = event.competitions[0];
              const homeTeam = competition.competitors.find((team: any) => team.homeAway === 'home');
              const awayTeam = competition.competitors.find((team: any) => team.homeAway === 'away');
              
              const gameKey = `${awayTeam.team.displayName}@${homeTeam.team.displayName}`;
              if (processedGames.has(gameKey)) {
                console.log(`Skipping duplicate game: ${gameKey}`);
                continue;
              }
              processedGames.add(gameKey);
              
              console.log('Processing ESPN MLB game:', {
                id: event.id,
                teams: `${awayTeam.team.displayName} @ ${homeTeam.team.displayName}`,
                date: event.date,
                status: competition.status.type.name
              });

              await this.storeGameData({
                external_event_id: event.id.toString(),
                sport: 'MLB',
                league: 'MLB',
                home_team: homeTeam.team.displayName,
                away_team: awayTeam.team.displayName,
                start_time: new Date(event.date).toISOString(),
                status: this.mapESPNStatus(competition.status.type.name),
                stats: {
                  venue: competition.venue?.fullName || 'Unknown',
                  city: competition.venue?.address?.city || 'Unknown',
                  home_score: homeTeam.score ? parseInt(homeTeam.score) : null,
                  away_score: awayTeam.score ? parseInt(awayTeam.score) : null,
                  spectators: competition.attendance || null,
                  event_thumb: null,
                  home_logo: homeTeam.team.logo,
                  away_logo: awayTeam.team.logo,
                  league_logo: null,
                  status_detail: competition.status.type.detail || competition.status.type.name,
                }
              }, 'ESPN');
            }
          }
        } catch (error: any) {
          console.error('Error processing ESPN MLB games:', error);
        }
      } else if (source === 'TheSportsDB') {
        try {
          console.log(`Fetching upcoming games for ${sportName || 'all sports'} from TheSportsDB...`);
          const mlbResponse = await axios.get(`${THESPORTSDB_V1_BASE_URL}/eventsday.php`, {
            params: {
              d: currentDateStr,
              s: sportName || 'Baseball'
            }
          });

          if (mlbResponse.data && mlbResponse.data.events) {
            const mlbGames = mlbResponse.data.events.filter((event: any) => 
              event.strLeague?.toUpperCase().includes(sportName?.toUpperCase() || '') || 
              event.strSport?.toUpperCase().includes(sportName?.toUpperCase() || '')
            );
            console.log(`Found ${mlbGames.length} games for ${currentDateStr} from TheSportsDB`);

            for (const event of mlbGames) {
              const gameKey = `${event.strAwayTeam}@${event.strHomeTeam}`;
              if (processedGames.has(gameKey)) {
                console.log(`Skipping duplicate game: ${gameKey}`);
                continue;
              }
              processedGames.add(gameKey);

              console.log('Processing TheSportsDB game:', {
                id: event.idEvent,
                teams: `${event.strAwayTeam} @ ${event.strHomeTeam}`,
                date: event.dateEvent,
                time: event.strTime
              });

              await this.storeGameData({
                external_event_id: event.idEvent.toString(),
                sport: sportName || 'MLB',
                league: event.strLeague,
                home_team: event.strHomeTeam,
                away_team: event.strAwayTeam,
                start_time: (() => {
                  if (event.dateEvent && event.strTime) {
                    const [hours, minutes] = event.strTime.split(':').map(Number);
                    const gameDate = new Date(event.dateEvent);
                    gameDate.setUTCHours(hours, minutes, 0, 0);
                    return gameDate.toISOString();
                  }
                  const defaultDate = new Date(event.dateEvent);
                  defaultDate.setUTCHours(0, 0, 0, 0);
                  return defaultDate.toISOString();
                })(),
                status: mapStatus(event.strStatus || 'Scheduled'),
                stats: {
                  venue: event.strVenue || 'Unknown',
                  city: event.strCity || 'Unknown',
                  home_score: event.intHomeScore !== null ? parseInt(event.intHomeScore) : null,
                  away_score: event.intAwayScore !== null ? parseInt(event.intAwayScore) : null,
                  spectators: event.intSpectators !== null ? parseInt(event.intSpectators) : null,
                  event_thumb: event.strThumb,
                  home_logo: event.strHomeTeamBadge,
                  away_logo: event.strAwayTeamBadge,
                  league_logo: event.strLeagueLogo,
                  status_detail: event.strProgress || event.strStatus,
                }
              }, 'TheSportsDB');
            }
          }
        } catch (error: any) {
          console.error(`Error processing TheSportsDB ${sportName || 'all sports'} games:`, error);
        }
      }
    };

    if (sportId && sportName) {
      // Fetch data for a specific sport
      for (let i = 0; i < days; i++) {
        const date = new Date(systemDate);
        date.setDate(systemDate.getDate() + i);
        await fetchAndStoreForDate(date, 'TheSportsDB', sportId, sportName);
      }
    } else {
      // Fetch data for all sports (current behavior)
      for (let i = 0; i < days; i++) {
        const date = new Date(systemDate);
        date.setDate(systemDate.getDate() + i);
        await fetchAndStoreForDate(date, 'ESPN', undefined, 'MLB'); // ESPN for MLB
        await fetchAndStoreForDate(date, 'TheSportsDB', undefined, 'NBA'); // TheSportsDB for NBA
        await fetchAndStoreForDate(date, 'TheSportsDB', undefined, 'NFL'); // TheSportsDB for NFL
        await fetchAndStoreForDate(date, 'TheSportsDB', undefined, 'NHL'); // TheSportsDB for NHL
      }
    }
    console.log("Completed fetching and storing games.");
  }

  // Helper method to store game data with improved duplicate checking
  private async storeGameData(gameData: any, source: string) {
    try {
      // Create a date range around the game time (±12 hours) to account for timezone issues
      const gameDate = new Date(gameData.start_time);
      const startRange = new Date(gameDate.getTime() - 12 * 60 * 60 * 1000).toISOString();
      const endRange = new Date(gameDate.getTime() + 12 * 60 * 60 * 1000).toISOString();

      // Check for duplicates using multiple criteria
      const { data: existingGames, error: checkError } = await supabaseAdmin
        .from('sports_events')
        .select('id, external_event_id, home_team, away_team, start_time, created_at, source')
        .eq('sport', gameData.sport)
        .eq('home_team', gameData.home_team)
        .eq('away_team', gameData.away_team)
        .gte('start_time', startRange)
        .lte('start_time', endRange);

      if (checkError) {
        console.error(`Error checking for existing game ${gameData.away_team} @ ${gameData.home_team}:`, checkError);
        return;
      }

      const fullGameData = {
        ...gameData,
        odds: gameData.odds || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source: source // Track the source of this data
      };

      if (existingGames && existingGames.length > 0) {
        // Found existing game(s) - update the most recent one
        const mostRecent = existingGames.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        const { error: updateError } = await supabaseAdmin
          .from('sports_events')
          .update({
            status: fullGameData.status,
            stats: fullGameData.stats,
            start_time: fullGameData.start_time,
            updated_at: fullGameData.updated_at,
            external_event_id: fullGameData.external_event_id,
            source: `${mostRecent.source || 'unknown'};${source}` // Track multiple sources
          })
          .eq('id', mostRecent.id);
        
        if (updateError) {
          console.error(`Error updating game with teams ${gameData.away_team} @ ${gameData.home_team}:`, updateError);
        } else {
          console.log(`Updated existing game from ${source}: ${gameData.away_team} @ ${gameData.home_team} (ID: ${mostRecent.id})`);
        }

        // If there are multiple existing games (duplicates), delete the older ones
        if (existingGames.length > 1) {
          const duplicateIds = existingGames
            .filter(game => game.id !== mostRecent.id)
            .map(game => game.id);
          
          console.log(`Found ${duplicateIds.length} duplicate(s) for ${gameData.away_team} @ ${gameData.home_team}, removing...`);
          
          const { error: deleteError } = await supabaseAdmin
            .from('sports_events')
            .delete()
            .in('id', duplicateIds);
          
          if (deleteError) {
            console.error(`Error deleting duplicates:`, deleteError);
          } else {
            console.log(`Removed ${duplicateIds.length} duplicate(s)`);
          }
        }
      } else {
        // No existing game found - insert new one
        const { error: insertError } = await supabaseAdmin
          .from('sports_events')
          .insert(fullGameData);
        
        if (insertError) {
          console.error(`Error inserting game ${gameData.away_team} @ ${gameData.home_team}:`, insertError);
        } else {
          console.log(`Inserted new game from ${source}: ${gameData.away_team} @ ${gameData.home_team}`);
        }
      }
    } catch (error: any) {
      console.error(`Unexpected error in storeGameData for ${gameData.away_team} @ ${gameData.home_team}:`, error);
    }
  }

  async updateGameStatuses() {
    console.log("Starting game status updates...");
    try {
      // Get all games that are either scheduled or live
      const { data: activeGames, error: fetchError } = await supabaseAdmin
        .from('sports_events')
        .select('*')
        .in('status', ['scheduled', 'live'])
        .order('start_time', { ascending: true });

      if (fetchError) {
        console.error('Error fetching active games:', fetchError);
        return;
      }

      if (!activeGames || activeGames.length === 0) {
        console.log('No active games found to update');
        return;
      }

      console.log(`Found ${activeGames.length} active games to check for updates`);

      // Process each game in batches to respect API rate limits
      const BATCH_SIZE = 10;
      const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

      for (let i = 0; i < activeGames.length; i += BATCH_SIZE) {
        const batch = activeGames.slice(i, i + BATCH_SIZE);
        
        // Process games in current batch
        await Promise.all(batch.map(async (game) => {
          try {
            // Fetch latest event details from TheSportsDB
            const eventDetails = await sportsDbApi.getFixtureDetails(game.external_event_id);
            
            if (!eventDetails) {
              console.warn(`No details found for game ${game.external_event_id}`);
              return;
            }

            // Map the updated data
            const updatedGameData = {
              status: mapStatus(eventDetails.strStatus || 'Scheduled'),
              stats: {
                ...game.stats, // Preserve existing stats
                home_score: eventDetails.intHomeScore !== null ? parseInt(eventDetails.intHomeScore) : null,
                away_score: eventDetails.intAwayScore !== null ? parseInt(eventDetails.intAwayScore) : null,
                status_detail: eventDetails.strProgress || eventDetails.strStatus,
                // Add any additional live stats that TheSportsDB provides
              },
              updated_at: new Date().toISOString()
            };

            // Only update if there are actual changes
            if (
              updatedGameData.status !== game.status ||
              updatedGameData.stats.home_score !== game.stats.home_score ||
              updatedGameData.stats.away_score !== game.stats.away_score ||
              updatedGameData.stats.status_detail !== game.stats.status_detail
            ) {
              const { error: updateError } = await supabaseAdmin
                .from('sports_events')
                .update(updatedGameData)
                .eq('external_event_id', game.external_event_id);

              if (updateError) {
                console.error(`Error updating game ${game.external_event_id}:`, updateError);
              } else {
                console.log(`Updated game ${game.external_event_id} (${game.home_team} vs ${game.away_team})`);
                console.log(`New status: ${updatedGameData.status}, Score: ${updatedGameData.stats.home_score}-${updatedGameData.stats.away_score}`);
              }
            }
          } catch (error: any) {
            console.error(`Error processing game ${game.external_event_id}:`, error);
          }
        }));

        // If this isn't the last batch, add a delay before processing the next batch
        if (i + BATCH_SIZE < activeGames.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }

      console.log("Completed game status updates");
    } catch (error: any) {
      console.error("Error in updateGameStatuses:", error);
    }
  }
  
  async runFullUpdate() {
    try {
      console.log('Starting full sports data update with TheSportsDB...');
      await this.fetchAndStoreUpcomingGames();
      
      // await this.updateGameStatuses(); // Commented out until refactored
      
      console.log('Full sports data update with TheSportsDB completed successfully');
    } catch (error: any) {
      console.error('Error running full update with TheSportsDB:', error.response ? error.response.data : error.message);
    }
  }

  // Helper method to map ESPN status to our database status
  async fetchLeagues(sport: string, country?: string): Promise<any> {
    console.warn(`fetchLeagues not fully implemented for ${sport}, country: ${country || 'all'}. Returning mock data.`);
    return [];
  }

  private mapESPNStatus(espnStatus: string): string {
    const status = espnStatus.toLowerCase();
    if (status.includes('final') || status.includes('completed')) {
      return 'completed';
    } else if (status.includes('in progress') || status.includes('live') || status.includes('active')) {
      return 'live';
    } else if (status.includes('postponed') || status.includes('suspended')) {
      return 'postponed';
    } else if (status.includes('cancelled') || status.includes('canceled')) {
      return 'cancelled';
    } else if (status.includes('scheduled') || status.includes('pre') || status.includes('upcoming')) {
      return 'scheduled';
    }
    console.warn(`Unknown ESPN status: '${espnStatus}', defaulting to 'scheduled'.`);
    return 'scheduled';
  }
}

// Helper function to map TheSportsDB status strings to our database status values
// This is a starting point and needs to be comprehensive based on TheSportsDB's actual status strings
function mapStatus(apiStatus: string): string {
  const status = apiStatus.toLowerCase();
  if (status.includes('finished') || status.includes('ft') || status.includes('aet') || status.includes('pen')) {
    return 'completed';
  } else if (status.includes('live') || status.includes('1h') || status.includes('2h') || status.includes('ht') || status.includes('progress')) {
    return 'live';
  } else if (status.includes('postponed') || status.includes('susp')) {
    return 'postponed'; // Or a more specific status if you have one
  } else if (status.includes('cancelled') || status.includes('canceled') || status.includes('abd')) {
    return 'cancelled';
  } else if (status.includes('not started') || status.includes('scheduled') || status.includes('tbd') || status === 'ns') {
    return 'scheduled';
  }
  console.warn(`Unknown TheSportsDB status: '${apiStatus}', defaulting to 'scheduled'.`);
  return 'scheduled'; // Default for unknown statuses
}

const sportsDataService = new SportsDataService();
export { sportsDataService };
export default sportsDataService; 
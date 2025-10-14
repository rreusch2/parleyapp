import axios from 'axios';
// No longer loading from .env for this client if using the free key '123'
// import { config } from 'dotenv';
// config();

// TheSportsDB Free API Key
const THESPORTSDB_API_KEY = "123";

// TheSportsDB v1 Base URL structure
export const THESPORTSDB_V1_BASE_URL = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_API_KEY}`;

// Helper to construct full URLs
const buildUrl = (endpoint: string): string => `${THESPORTSDB_V1_BASE_URL}/${endpoint}`;

// Wrapper for TheSportsDB API endpoints
export const sportsDbApi = {
  // Fetches all leagues from TheSportsDB
  getAllLeagues: async () => {
    try {
      const endpoint = 'all_leagues.php';
      const url = buildUrl(endpoint);
      console.log(`Fetching from TheSportsDB: ${url}`);
      const response = await axios.get(url);
      // TheSportsDB wraps leagues in a "leagues" array or similar
      return response.data.leagues || response.data.countrys; // 'countrys' is a typo in their API for some league listings by country
    } catch (error: any) {
      console.error(`Error fetching all leagues from TheSportsDB:`, error.response ? error.response.data : error.message);
      throw error;
    }
  },

  // Fetches events (games) for a specific date.
  // Optional: sport (e.g., "Soccer", "Basketball") and leagueId (TheSportsDB specific league ID)
  getEventsByDate: async (date: string, sportName?: string, leagueId?: string) => {
    try {
      let endpoint = `eventsday.php?d=${date}`;
      if (sportName) {
        // Note: TheSportsDB API for eventsday.php also takes 's' for sport and 'l' for league name (not ID for free tier)
        // For simplicity, we might need a more robust way to get league-specific events later.
        // This endpoint with sport filter: eventsday.php?d=YYYY-MM-DD&s=SPORT_NAME
        endpoint += `&s=${encodeURIComponent(sportName)}`;
      }
      // Filtering by league ID with eventsday.php might be tricky if it expects league *name* for 'l' param.
      // The `eventsnextleague.php?id=LEAGUE_ID` or `eventspastleague.php?id=LEAGUE_ID` are better for specific leagues.
      // Or `eventsseason.php?id=LEAGUE_ID&s=SEASON`
      // For now, this is a basic date fetch.
      const url = buildUrl(endpoint);
      console.log(`Fetching from TheSportsDB: ${url}`);
      const response = await axios.get(url);
      // Events are typically in an "events" array or "results" for some endpoints
      return response.data.events || response.data.results; 
    } catch (error: any) {
      console.error(`Error fetching events for date ${date} from TheSportsDB:`, error.response ? error.response.data : error.message);
      throw error;
    }
  },

  // Placeholder/Simplified versions of other methods - to be implemented or removed
  // These will need to be mapped to TheSportsDB's specific endpoints and parameters

  getFixtureDetails: async (eventId: string) => { // Renamed from getFixtures, now takes eventId
    try {
      // Example: lookupevent.php?id={idEvent}
      const endpoint = `lookupevent.php?id=${eventId}`;
      const url = buildUrl(endpoint);
      console.log(`Fetching from TheSportsDB: ${url}`);
      const response = await axios.get(url);
      return response.data.events ? response.data.events[0] : null; // lookupevent returns an array with one event
    } catch (error: any) {
      console.error(`Error fetching event details for ${eventId} from TheSportsDB:`, error.response ? error.response.data : error.message);
      throw error;
    }
  },
  
  getOdds: async (params: { eventId?: string; /* other params as needed by TheSportsDB if available */ }) => {
    console.warn('getOdds for TheSportsDB is not fully implemented. Free tier might not support odds extensively.');
    // TheSportsDB free tier has limited or no direct odds endpoints. This might require a premium feature or a different source.
    // For now, returning a placeholder.
    return Promise.resolve({ response: [] }); 
  },

  // Example: lookupteam.php?id={idTeam}
  getTeamDetails: async (teamId: string) => {
    try {
      const endpoint = `lookupteam.php?id=${teamId}`;
      const url = buildUrl(endpoint);
      console.log(`Fetching from TheSportsDB: ${url}`);
      const response = await axios.get(url);
      return response.data.teams ? response.data.teams[0] : null;
    } catch (error: any) {
      console.error(`Error fetching team details for ${teamId} from TheSportsDB:`, error.response ? error.response.data : error.message);
      throw error;
    }
  },
  
  // TheSportsDB might use lookup_all_players.php?id={idTeam}
  getPlayersByTeam: async (teamId: string) => {
    try {
      const endpoint = `lookup_all_players.php?id=${teamId}`;
      const url = buildUrl(endpoint);
      console.log(`Fetching from TheSportsDB: ${url}`);
      const response = await axios.get(url);
      return response.data.player; // 'player' array
    } catch (error: any) {
      console.error(`Error fetching players for team ${teamId} from TheSportsDB:`, error.response ? error.response.data : error.message);
      throw error;
    }
  },

  // Other methods like getTeamStatistics, getH2H would need specific TheSportsDB endpoints
  // For example, eventstatistics.php?id={EVENT_ID} (if available for free)
  // H2H might not be directly available or might be part of event details.

  // Example: lookupleague.php?id={idLeague}
  getLeagueDetails: async (leagueId: string) => {
    try {
      const endpoint = `lookupleague.php?id=${leagueId}`;
      const url = buildUrl(endpoint);
      console.log(`Fetching from TheSportsDB: ${url}`);
      const response = await axios.get(url);
      // "leagues" is an array, even for a single lookup
      return response.data.leagues ? response.data.leagues[0] : null; 
    } catch (error: any) {
      console.error(`Error fetching league details for ${leagueId} from TheSportsDB:`, error.response ? error.response.data : error.message);
      throw error;
    }
  },

  // Fetches the next upcoming events for a specific league ID
  getNextEventsByLeagueId: async (leagueId: string) => {
    try {
      console.log(`Fetching next events from TheSportsDB: ${THESPORTSDB_V1_BASE_URL}/eventsnextleague.php?id=${leagueId}`);
      
      // First try to get scheduled games for today
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      console.log(`Fetching games for date: ${dateStr}`);
      
      const scheduleResponse = await axios.get(`${THESPORTSDB_V1_BASE_URL}/eventsday.php`, {
        params: {
          d: dateStr,
          s: 'Baseball' // Use sport name instead of league ID
        }
      });

      if (scheduleResponse.data && scheduleResponse.data.events) {
        // Filter for MLB games only since we're getting all baseball games
        const mlbGames = scheduleResponse.data.events.filter((event: any) => 
          event.strLeague?.toUpperCase().includes('MLB') || 
          event.strLeague?.toUpperCase().includes('MAJOR LEAGUE BASEBALL')
        );
        console.log(`Found ${mlbGames.length} MLB events for ${dateStr}`);
        return mlbGames;
      }

      // Fallback to next events if no games today
      const response = await axios.get(`${THESPORTSDB_V1_BASE_URL}/eventsnextleague.php`, {
        params: {
          id: leagueId
        }
      });

      if (response.data && response.data.events) {
        return response.data.events;
      }

      return [];
    } catch (error) {
      console.error('Error fetching events from TheSportsDB:', error);
      return [];
    }
  }
};

// Exporting with a new name to avoid confusion if old client is imported elsewhere
export default sportsDbApi; 
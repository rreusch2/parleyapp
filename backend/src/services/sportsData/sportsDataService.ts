import { supabase } from '../supabase/client';
// Import the new sportsDbApi client and base URL
import { sportsDbApi, THESPORTSDB_V1_BASE_URL } from './apiSportsClient';
import axios from 'axios';

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

export const sportsDataService = {
  fetchAndStoreUpcomingGames: async () => {
    console.log("Attempting to fetch and store upcoming games...");
    const systemDate = new Date();
    const year = systemDate.getFullYear();
    const month = String(systemDate.getMonth() + 1).padStart(2, '0');
    const day = String(systemDate.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    console.log(`Using date for fetching: ${currentDate}`);

    // For MLB games, we'll use a different approach
    try {
      console.log('Fetching MLB games...');
      const mlbResponse = await axios.get(`${THESPORTSDB_V1_BASE_URL}/eventsday.php`, {
        params: {
          d: currentDate,
          s: 'Baseball'
        }
      });

      if (mlbResponse.data && mlbResponse.data.events) {
        const mlbGames = mlbResponse.data.events.filter((event: any) => 
          event.strLeague?.toUpperCase().includes('MLB') || 
          event.strLeague?.toUpperCase().includes('MAJOR LEAGUE BASEBALL')
        );
        console.log(`Found ${mlbGames.length} MLB games for ${currentDate}`);

        // Process MLB games
        for (const event of mlbGames) {
          console.log('Processing MLB game:', {
            id: event.idEvent,
            teams: `${event.strHomeTeam} vs ${event.strAwayTeam}`,
            date: event.dateEvent,
            time: event.strTime
          });

          // Map game data and store in database
          const gameData = {
            external_event_id: event.idEvent.toString(),
            sport: 'MLB',
            league: 'MLB',
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
            odds: {},
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
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Store in database
          const { data: existingGame, error: checkError } = await supabase
            .from('sports_events')
            .select('id, external_event_id')
            .eq('external_event_id', gameData.external_event_id)
            .single();

          if (checkError && checkError.code !== 'PGRST116') {
            console.error(`Error checking for existing game with external_id ${gameData.external_event_id}:`, checkError);
            continue;
          }

          if (existingGame) {
            const { error: updateError } = await supabase
              .from('sports_events')
              .update({
                status: gameData.status,
                stats: gameData.stats,
                start_time: gameData.start_time,
                updated_at: gameData.updated_at,
                home_team: gameData.home_team,
                away_team: gameData.away_team,
                league: gameData.league,
                sport: gameData.sport,
              })
              .eq('external_event_id', gameData.external_event_id);
            if (updateError) console.error(`Error updating game with external_id ${gameData.external_event_id}:`, updateError);
            else console.log(`Updated game: ${gameData.home_team} vs ${gameData.away_team} (Ext. ID: ${gameData.external_event_id})`);
          } else {
            const { error: insertError } = await supabase
              .from('sports_events')
              .insert(gameData);
            if (insertError) console.error(`Error inserting game with external_id ${gameData.external_event_id}:`, insertError);
            else console.log(`Inserted new game: ${gameData.home_team} vs ${gameData.away_team} (Ext. ID: ${gameData.external_event_id})`);
          }
        }
      }
    } catch (error) {
      console.error('Error processing MLB games:', error);
    }

    // Process other leagues (NBA, NHL, NFL)
    for (const leagueKey in LEAGUES_TSDB) {
      if (leagueKey === 'MLB') continue; // Skip MLB as we've already handled it

      if (Object.prototype.hasOwnProperty.call(LEAGUES_TSDB, leagueKey)) {
        const leagueInfo = LEAGUES_TSDB[leagueKey as keyof typeof LEAGUES_TSDB];
        try {
          console.log(`Fetching upcoming games for league: ${leagueKey} (ID: ${leagueInfo.id}, Sport: ${leagueInfo.sportName})`);
          const events = await sportsDbApi.getNextEventsByLeagueId(leagueInfo.id);

          if (events && events.length > 0) {
            // Filter events to only include those matching the current league
            const leagueEvents = events.filter((event: TheSportsDBEvent) => 
              event.strLeague?.toUpperCase().includes(leagueKey) ||
              event.strSport?.toUpperCase().includes(leagueKey)
            );
            
            console.log(`Found ${leagueEvents.length} upcoming events for ${leagueKey}. Processing...`);
            
            for (const event of leagueEvents) {
              console.log(`Processing ${leagueKey} event:`, {
                id: event.idEvent,
                teams: `${event.strHomeTeam} vs ${event.strAwayTeam}`,
                date: event.dateEvent,
                time: event.strTime,
                league: event.strLeague
              });

              const gameData = {
                external_event_id: event.idEvent.toString(),
                sport: leagueKey,
                league: leagueKey,
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
                odds: {},
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
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              const { data: existingGame, error: checkError } = await supabase
                .from('sports_events')
                .select('id, external_event_id')
                .eq('external_event_id', gameData.external_event_id)
                .single();

              if (checkError && checkError.code !== 'PGRST116') {
                console.error(`Error checking for existing game with external_id ${gameData.external_event_id}:`, checkError);
                continue;
              }

              if (existingGame) {
                const { error: updateError } = await supabase
                  .from('sports_events')
                  .update({
                    status: gameData.status,
                    stats: gameData.stats,
                    start_time: gameData.start_time,
                    updated_at: gameData.updated_at,
                    home_team: gameData.home_team,
                    away_team: gameData.away_team,
                    league: gameData.league,
                    sport: gameData.sport,
                  })
                  .eq('external_event_id', gameData.external_event_id);
                if (updateError) console.error(`Error updating game with external_id ${gameData.external_event_id}:`, updateError);
                else console.log(`Updated game: ${gameData.home_team} vs ${gameData.away_team} (Ext. ID: ${gameData.external_event_id})`);
              } else {
                const { error: insertError } = await supabase
                  .from('sports_events')
                  .insert(gameData);
                if (insertError) console.error(`Error inserting game with external_id ${gameData.external_event_id}:`, insertError);
                else console.log(`Inserted new game: ${gameData.home_team} vs ${gameData.away_team} (Ext. ID: ${gameData.external_event_id})`);
              }
            }
          }
        } catch (error) {
          console.error(`Error processing ${leagueKey} (League ID: ${leagueInfo.id}):`, error);
        }
      }
    }
    console.log("Completed fetching and storing games using TheSportsDB.");
  },

  updateGameStatuses: async () => {
    console.log("Starting game status updates...");
    try {
      // Get all games that are either scheduled or live
      const { data: activeGames, error: fetchError } = await supabase
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
              const { error: updateError } = await supabase
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
          } catch (error) {
            console.error(`Error processing game ${game.external_event_id}:`, error);
          }
        }));

        // If this isn't the last batch, add a delay before processing the next batch
        if (i + BATCH_SIZE < activeGames.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }

      console.log("Completed game status updates");
    } catch (error) {
      console.error("Error in updateGameStatuses:", error);
    }
  },
  
  // fetchLeagues: async (sport?: string, country?: string) => {
  //   console.warn("fetchLeagues (admin utility) needs to be adapted for sportsDbApi.getAllLeagues() or specific sport/country lookups if needed.");
  //   // Use sportsDbApi.getAllLeagues() and then filter if necessary,
  //   // or implement specific lookup in the client if TheSportsDB supports it directly.
  //   // return sportsDbApi.getAllLeagues(); // Example
  // },
  
  runFullUpdate: async () => {
    try {
      console.log('Starting full sports data update with TheSportsDB...');
      // No longer iterating a sportsToUpdate array in the same way,
      // fetchAndStoreUpcomingGames now iterates through LEAGUES_TSDB internally.
      await sportsDataService.fetchAndStoreUpcomingGames();
      
      // await sportsDataService.updateGameStatuses(); // Commented out until refactored
      
      console.log('Full sports data update with TheSportsDB completed successfully');
    } catch (error: any) {
      console.error('Error running full update with TheSportsDB:', error.response ? error.response.data : error.message);
    }
  }
};

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
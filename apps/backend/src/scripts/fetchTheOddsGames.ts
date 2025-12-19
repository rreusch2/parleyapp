// filename: backend/src/scripts/fetchTheOddsGames.ts

import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { supabaseAdmin } from '../services/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { getActiveSportConfigs, BOOKMAKER_CONFIG, SUPPORTED_SPORTS } from './multiSportConfig';

// Load environment variables from backend directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Log environment variables for debugging (without sensitive values)
const envVars = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'exists' : 'missing',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'exists' : 'missing',
  THEODDS_API_KEY: (process.env.THEODDS_API_KEY || process.env.ODDS_API_KEY) ? 'exists' : 'missing'
};
console.log('Environment variables:', envVars);

// Validate required environment variables
if (!process.env.THEODDS_API_KEY && !process.env.ODDS_API_KEY) {
  console.error('❌ THEODDS_API_KEY (or ODDS_API_KEY) is required but not found in environment variables');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required but not found in environment variables');
  process.exit(1);
}

// Type definitions
interface BookmakerOdds {
  key: string;
  title: string;
  markets: Array<{
    key: string;
    outcomes: Array<{
      name: string;
      price: number;
      point?: number;
    }>
  }>
}

interface GameData {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: BookmakerOdds[];
}

const THEODDS_API_KEY = process.env.THEODDS_API_KEY || process.env.ODDS_API_KEY;
const API_BASE_URL = 'https://api.the-odds-api.com/v4';

// Multi-sport leagues dynamically loaded from configuration
const getActiveLeagues = () => {
  const activeSports = getActiveSportConfigs();
  return activeSports.map(sport => ({
    key: sport.theoddsKey,
    name: sport.sportKey
  }));
};

const ACTIVE_LEAGUES = getActiveLeagues();

// Function to fetch games for a specific sport
async function fetchGamesWithOdds(sportInfo: {key: string, name: string}, extendedRange = false): Promise<number> {
  try {
    console.log(`📊 Fetching ${sportInfo.name} games with odds from TheOdds API...`);
    
    // Calculate date range 
    const now = new Date();
    let startDate = new Date(now);
    let endDate = new Date();
    
    // Check if we should extend range for UFC events (next 14 days) or NFL week (next N days, default 7)
    if (sportInfo.key === 'mma_mixed_martial_arts') {
      const ufcDays = Number(process.env.UFC_AHEAD_DAYS || 7);
      // For UFC, start from beginning of today to catch events that already started
      startDate = new Date(now);
      startDate.setUTCHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + ufcDays);
      endDate.setUTCHours(23, 59, 59, 999);
      console.log(`🥊 UFC Mode: Extended range ${ufcDays} days ahead from start of today through ${endDate.toISOString()}`);
    } else if (extendedRange && sportInfo.key === 'americanfootball_nfl') {
      const extendedDays = Number(process.env.NFL_AHEAD_DAYS || 7);
      endDate = new Date(now);
      endDate.setUTCDate(now.getUTCDate() + extendedDays);
      endDate.setUTCHours(23, 59, 59, 999);
      console.log(`🏈 NFL Week Mode: Extended range ${extendedDays} days ahead through ${endDate.toISOString()}`);
    } else {
      // Default: today and tomorrow only
      endDate = new Date(now);
      endDate.setUTCDate(now.getUTCDate() + 1);
      endDate.setUTCHours(23, 59, 59, 999);
    }
    
    // Format dates in the required format YYYY-MM-DDTHH:MM:SSZ using UTC consistently
    const commenceTimeFrom = (sportInfo.key === 'mma_mixed_martial_arts' ? startDate : now).toISOString().split('.')[0] + 'Z';
    const commenceTimeTo = endDate.toISOString().split('T')[0] + 'T23:59:59Z';
    
    console.log(`Fetching games from ${commenceTimeFrom} to ${commenceTimeTo}`);
    
    // Get upcoming games with odds (for specified date range)
    const marketsStr = sportInfo.key === 'mma_mixed_martial_arts' ? 'h2h' : 'h2h,spreads,totals';
    const response = await axios.get(`${API_BASE_URL}/sports/${sportInfo.key}/odds`, {
      params: {
        apiKey: THEODDS_API_KEY,
        regions: 'us',
        markets: marketsStr, // MMA: h2h only; others: h2h, spreads, totals
        oddsFormat: 'american',
        dateFormat: 'iso',
        commenceTimeFrom: commenceTimeFrom,
        commenceTimeTo: commenceTimeTo
      }
    });

    const games = response.data as GameData[];
    console.log(`✅ Found ${games.length} ${sportInfo.name} games in selected window`);

    // For MMA, keep only likely UFC events by requiring coverage from multiple major US books
    let filteredGames = games;
    if (sportInfo.key === 'mma_mixed_martial_arts') {
      const majorBooks = BOOKMAKER_CONFIG.ufcFights || ['fanduel', 'draftkings', 'betmgm'];
      filteredGames = games.filter((g) => {
        const majorCount = (g.bookmakers || []).filter((b) => majorBooks.includes(b.key)).length;
        const keep = majorCount >= 2; // Heuristic: UFC cards have broader US coverage
        if (!keep) {
          console.log(`⏭️  Skipping non-UFC/low-coverage MMA event ${g.id}: majorBooks=${majorCount}`);
        }
        return keep;
      });
      console.log(`🥊 UFC filter applied: ${filteredGames.length}/${games.length} events retained`);
    }

    // Process each game
    for (const game of filteredGames) {
      // Check if game already exists
      const { data: existingGame } = await supabaseAdmin
        .from('sports_events')
        .select('id')
        .eq('external_event_id', game.id)
        .single();
      
      // Calculate local game date (Eastern Time for US sports)
      const startTime = new Date(game.commence_time);
      // Convert to ET (UTC-5 for EST or UTC-4 for EDT - JS handles DST automatically)
      const etDate = new Date(startTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const localGameDate = etDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Format the game data for insertion
      const gameData = {
        id: existingGame?.id || uuidv4(),
        external_event_id: game.id,
        sport: sportInfo.name, // Required field - set to our standard sport key (MLB, NBA, etc.)
        sport_key: sportInfo.key, // Use TheOdds API key for foreign key constraint
        league: sportInfo.key === 'mma_mixed_martial_arts' ? 'UFC' : game.sport_title,
        home_team: game.home_team,
        away_team: game.away_team,
        start_time: game.commence_time,
        local_game_date: localGameDate, // Date in Eastern Time for consistent queries
        status: 'scheduled',
        odds: {}, // Set default empty odds object (required field)
        metadata: {
          source: 'theodds_api',
          api_sport_key: sportInfo.key, // Store the API's sport key for reference
          promotion: sportInfo.key === 'mma_mixed_martial_arts' ? 'UFC' : undefined,
          full_data: game
        }
      };
      
      // Insert or update the game with proper error handling
      try {
        if (existingGame) {
          const { error } = await supabaseAdmin
            .from('sports_events')
            .update(gameData)
            .eq('id', existingGame.id);
          
          if (error) {
            console.error(`❌ Error updating game ${game.id}:`, error.message);
            continue;
          }
          console.log(`📝 Updated game: ${game.away_team} @ ${game.home_team}`);
        } else {
          const { error } = await supabaseAdmin
            .from('sports_events')
            .insert(gameData);
          
          if (error) {
            console.error(`❌ Error inserting game ${game.id}:`, error.message);
            console.error('Game data:', JSON.stringify(gameData, null, 2));
            continue;
          }
          console.log(`➕ Added new game: ${game.away_team} @ ${game.home_team}`);
        }
      } catch (insertError) {
        console.error(`❌ Database error for game ${game.id}:`, (insertError as Error).message);
        continue;
      }
      
      // Process odds for this game
      await processOddsData(game, existingGame?.id || gameData.id);
    }
    
    return games.length;
  } catch (error) {
    console.error(`❌ Error fetching ${sportInfo.name} games:`, (error as Error).message);
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error(`Status: ${axiosError.response?.status}, Data:`, axiosError.response?.data);
    }
    return 0;
  }
}

// Process odds data for a game
async function processOddsData(game: GameData, eventId: string): Promise<void> {
  try {
    console.log(`🔄 Processing odds for game: ${game.away_team} @ ${game.home_team}`);
    
    // First, delete existing odds for this game to prevent duplicates
    const { error: deleteError } = await supabaseAdmin
      .from('odds_data')
      .delete()
      .eq('event_id', eventId);
    
    if (deleteError) {
      console.log(`⚠️ Note: Could not delete existing odds for game ${eventId}: ${deleteError.message}`);
    }
    
    // Process each bookmaker's odds
    for (const bookmaker of game.bookmakers) {
      // Get bookmaker ID
      const { data: bookmakerData, error: bookmakerError } = await supabaseAdmin
        .from('bookmakers')
        .select('id')
        .eq('bookmaker_key', bookmaker.key)
        .single();
      
      if (bookmakerError || !bookmakerData) {
        console.log(`⚠️ Bookmaker '${bookmaker.key}' not found in database, skipping...`);
        continue;
      }
      
      // Process each market
      for (const market of bookmaker.markets) {
        // Get market type ID
        let marketKey = '';
        switch(market.key) {
          case 'h2h': marketKey = 'h2h'; break;
          case 'spreads': marketKey = 'spreads'; break;
          case 'totals': marketKey = 'totals'; break;
          default: 
            console.log(`⚠️ Unknown market type: ${market.key}, skipping...`);
            continue;
        }
        
        const { data: marketData, error: marketError } = await supabaseAdmin
          .from('market_types')
          .select('id')
          .eq('market_key', marketKey)
          .single();
        
        if (marketError || !marketData) {
          console.log(`⚠️ Market type '${marketKey}' not found in database, skipping...`);
          continue;
        }
        
        // Process each outcome
        for (const outcome of market.outcomes) {
          // Calculate implied probability
          const price = outcome.price;
          let impliedProbability = 0;
          
          if (price > 0) {
            impliedProbability = 100 / (price + 100);
          } else if (price < 0) {
            impliedProbability = Math.abs(price) / (Math.abs(price) + 100);
          }
          
          // Format the odds data
          const oddsData = {
            id: uuidv4(),
            event_id: eventId,
            bookmaker_id: bookmakerData.id,
            market_type_id: marketData.id,
            outcome_name: outcome.name,
            outcome_price: outcome.price,
            outcome_point: outcome.point || 0,
            implied_probability: impliedProbability,
            last_update: new Date().toISOString(),
            created_at: new Date().toISOString()
          };
          
          // Insert the odds data
          const { error: oddsInsertError } = await supabaseAdmin
            .from('odds_data')
            .insert(oddsData);
          
          if (oddsInsertError) {
            console.error(`❌ Error inserting odds data:`, oddsInsertError.message);
            console.error('Odds data:', JSON.stringify(oddsData, null, 2));
          }
        }
      }
    }
    
    console.log(`💰 Processed odds for game: ${game.away_team} @ ${game.home_team}`);
  } catch (error) {
    console.error(`❌ Error processing odds for game ${game.id}:`, (error as Error).message);
  }
}

// Main function to run the script
export async function fetchAllGameData(extendedNflWeek = false, sportFilters?: string[]): Promise<number> {
  console.log('🚀 Starting TheOdds API data fetch...');
  if (extendedNflWeek) {
    const days = Number(process.env.NFL_AHEAD_DAYS || 7);
    console.log(`🏈 NFL Week Mode: Will fetch NFL games for the next ${days} days`);
  }
  
  let totalGames = 0;
  
  // Import centralized multi-sport configuration
  const { getActiveSportConfigs } = await import('./multiSportConfig');
  let activeSports = getActiveSportConfigs();
  
  // Apply sport filters if provided
  if (sportFilters && sportFilters.length > 0) {
    let filtered = activeSports.filter(sport => 
      sportFilters.includes(sport.sportKey.toUpperCase()) ||
      sportFilters.includes(sport.sportName.toUpperCase())
    );

    // Fallback: if nothing matched from activeSports, allow filtered fetch from SUPPORTED_SPORTS (ignoring isActive flags)
    if (filtered.length === 0) {
      const allSupported = Object.values(SUPPORTED_SPORTS);
      filtered = allSupported.filter(sport => 
        sportFilters.includes(sport.sportKey.toUpperCase()) ||
        sportFilters.includes(sport.sportName.toUpperCase())
      );
      if (filtered.length > 0) {
        console.warn(`⚠️  No ACTIVE sports matched filters. Falling back to SUPPORTED sports: ${filtered.map(s => s.sportKey).join(', ')}`);
      }
    }

    if (filtered.length === 0) {
      console.warn(`⚠️  No sports matched filters: ${sportFilters.join(', ')}`);
      console.warn('Available sports:', getActiveSportConfigs().map(s => s.sportKey).join(', '));
      return 0;
    }

    activeSports = filtered;
    console.log(`🎯 Filtering to ${activeSports.length} sport(s): ${activeSports.map(s => s.sportKey).join(', ')}`);
  }
  
  // Fetch games for each active sport from centralized config
  for (const sportConfig of activeSports) {
    const sportInfo = { key: sportConfig.theoddsKey, name: sportConfig.sportName };
    const count = await fetchGamesWithOdds(sportInfo, extendedNflWeek);
    totalGames += count;
  }
  
  console.log(`✅ Finished fetching data for ${totalGames} games with odds`);
  return totalGames;
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const extendedNflWeek = args.includes('--nfl-week');
  
  fetchAllGameData(extendedNflWeek)
    .then(() => console.log('Done!'))
    .catch((error: Error) => console.error('Error:', error.message));
}
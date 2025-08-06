import { supabaseAdmin } from '../services/supabase/client';
import axios from 'axios';

// Date formatting utility
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Environment variables
const THEODDS_API_KEY = process.env.THEODDS_API_KEY || 'a6f2b59beb6bdf22145a4d9c0b78b683';

// Use existing supabase client
const supabase = supabaseAdmin;

interface TheOddsGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

interface StoredGame {
  id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
  metadata: any;
}

// Removed StoredOdds interface - using direct odds_data table inserts

async function fetchNFLPreseasonGames(): Promise<TheOddsGame[]> {
  console.log('🏈 Fetching NFL preseason games from The Odds API...');
  
  try {
    const response = await axios.get('https://api.the-odds-api.com/v4/sports/americanfootball_nfl_preseason/odds/', {
      params: {
        apiKey: THEODDS_API_KEY,
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american',
        dateFormat: 'iso'
      }
    });

    console.log(`📊 Found ${response.data.length} NFL games from The Odds API`);
    
    // Show available dates for debugging
    const availableDates = [...new Set(response.data.map((game: TheOddsGame) => formatDate(new Date(game.commence_time))))];
    console.log(`📅 Available game dates: ${availableDates.slice(0, 10).join(', ')}${availableDates.length > 10 ? '...' : ''}`);
    
    // Get games for the next few days (since Aug 7-8 might not have games)
    const today = new Date();
    const nextFewDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      nextFewDays.push(formatDate(date));
    }
    
    console.log(`🎯 Looking for games in next 7 days: ${nextFewDays.join(', ')}`);
    
    const filteredGames = response.data.filter((game: TheOddsGame) => {
      const gameDate = formatDate(new Date(game.commence_time));
      return nextFewDays.includes(gameDate);
    });

    console.log(`🎯 Found ${filteredGames.length} NFL games in the next 7 days`);
    
    // Show first few games for debugging
    if (filteredGames.length > 0) {
      console.log('📋 Sample games found:');
      filteredGames.slice(0, 5).forEach((game: TheOddsGame) => {
        console.log(`   ${game.away_team} @ ${game.home_team} - ${new Date(game.commence_time).toLocaleString()}`);
      });
    }
    
    return filteredGames;
  } catch (error) {
    console.error('❌ Error fetching NFL games:', error);
    throw error;
  }
}

async function storeNFLGame(game: TheOddsGame): Promise<string> {
  console.log(`💾 Storing NFL game: ${game.away_team} @ ${game.home_team}`);
  
  const gameData: StoredGame = {
    id: game.id,
    sport: 'National Football League',
    league: 'NFL',
    home_team: game.home_team,
    away_team: game.away_team,
    start_time: game.commence_time,
    metadata: {
      source: 'theodds_api',
      full_data: {
        id: game.id,
        away_team: game.away_team,
        home_team: game.home_team,
        sport_key: game.sport_key,
        bookmakers: game.bookmakers,
        sport_title: game.sport_title,
        commence_time: game.commence_time
      },
      api_sport_key: 'americanfootball_nfl',
      sport_key: 'americanfootball_nfl_preseason',
      sport_title: game.sport_title,
      is_preseason: true,
      season_type: 'preseason'
    }
  };

  // Insert or update the game
  const { data, error } = await supabase
    .from('sports_events')
    .upsert(gameData, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error(`❌ Error storing game ${game.id}:`, error);
    throw error;
  }

  console.log(`✅ Stored NFL game: ${game.away_team} @ ${game.home_team}`);
  return data.id;
}

async function ensureNFLSportConfig(): Promise<void> {
  console.log('🔧 Ensuring NFL sport configuration exists...');
  
  const { data: existingConfig } = await supabase
    .from('sports_config')
    .select('*')
    .eq('sport_key', 'americanfootball_nfl')
    .single();

  if (!existingConfig) {
    const { error } = await supabase
      .from('sports_config')
      .insert({
        sport_key: 'americanfootball_nfl',
        name: 'National Football League',
        display_name: 'NFL',
        is_active: true,
        metadata: {
          season_type: 'preseason',
          api_sport_key: 'americanfootball_nfl'
        }
      });

    if (error) {
      console.error('❌ Error creating NFL sport config:', error);
      throw error;
    }

    console.log('✅ Created NFL sport configuration');
  } else {
    console.log('✅ NFL sport configuration already exists');
  }
}

async function main(): Promise<void> {
  console.log('🏈 Starting NFL Preseason Games Fetch for August 7-8, 2025');
  console.log('=' .repeat(60));

  try {
    // Ensure NFL sport configuration exists
    await ensureNFLSportConfig();

    // Fetch NFL preseason games
    const games = await fetchNFLPreseasonGames();

    if (games.length === 0) {
      console.log('⚠️ No NFL games found for August 7-8, 2025');
      return;
    }

    console.log(`🎯 Processing ${games.length} NFL preseason games...`);

    let successCount = 0;
    let errorCount = 0;

    for (const game of games) {
      try {
        console.log(`\n📅 Processing: ${game.away_team} @ ${game.home_team}`);
        console.log(`   Start time: ${new Date(game.commence_time).toLocaleString()}`);
        
        // Store the game with odds in metadata (like other sports)
        const sportsEventId = await storeNFLGame(game);
        
        successCount++;
        console.log(`✅ Successfully processed game ${successCount}/${games.length}`);
        
      } catch (error) {
        console.error(`❌ Error processing game: ${game.away_team} @ ${game.home_team}`, error);
        errorCount++;
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('🏈 NFL Preseason Fetch Complete!');
    console.log(`✅ Successfully processed: ${successCount} games`);
    console.log(`❌ Errors: ${errorCount} games`);
    
    if (successCount > 0) {
      console.log('\n🎉 NFL preseason games are now available in your app!');
      console.log('Users can view these games in the Games tab to get excited for football season! 🏈');
    }

  } catch (error) {
    console.error('❌ Fatal error in NFL preseason fetch:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { main as fetchNFLPreseasonGames };

import dotenv from 'dotenv';
import { supabaseAdmin } from '../services/supabase/client';

dotenv.config();

// Helper to check if games already exist for today
async function checkExistingGamesForToday(sport: string): Promise<number> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const { data, error } = await supabaseAdmin
    .from('sports_events')
    .select('id')
    .eq('sport', sport)
    .gte('start_time', startOfDay.toISOString())
    .lt('start_time', endOfDay.toISOString());

  if (error) {
    console.error(`Error checking existing ${sport} games:`, error);
    return 0;
  }

  return data?.length || 0;
}

// Fetch today's MLB games (only if not already fetched)
async function fetchMLBIfNeeded(): Promise<void> {
  const existingMLBGames = await checkExistingGamesForToday('MLB');
  
  if (existingMLBGames > 0) {
    console.log(`🔄 MLB: ${existingMLBGames} games already exist for today, skipping fetch`);
    return;
  }

  console.log('🔄 MLB: No games found for today, fetching...');
  
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    await execAsync('npm run fetch-today-mlb');
    console.log('✅ MLB: Successfully fetched today\'s games');
  } catch (error) {
    console.error('❌ MLB: Error fetching games:', error);
  }
}

// Fetch today's NBA games (only if not already fetched)
async function fetchNBAIfNeeded(): Promise<void> {
  const existingNBAGames = await checkExistingGamesForToday('NBA');
  
  if (existingNBAGames > 0) {
    console.log(`🔄 NBA: ${existingNBAGames} games already exist for today, skipping fetch`);
    return;
  }

  console.log('🔄 NBA: No games found for today, fetching...');
  
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    await execAsync('npm run fetch-today-nba');
    console.log('✅ NBA: Successfully fetched today\'s games');
  } catch (error) {
    console.error('❌ NBA: Error fetching games:', error);
  }
}

// Main function to intelligently fetch games
export async function initializeDailyGames(): Promise<void> {
  console.log('🚀 Initializing daily games (smart duplicate prevention)...\n');

  const today = new Date().toDateString();
  console.log(`📅 Checking games for: ${today}\n`);

  // Check and fetch MLB games if needed
  await fetchMLBIfNeeded();
  
  // Check and fetch NBA games if needed  
  await fetchNBAIfNeeded();

  // Summary of current state
  const mlbCount = await checkExistingGamesForToday('MLB');
  const nbaCount = await checkExistingGamesForToday('NBA');
  
  console.log('\n📊 Final Status:');
  console.log(`   MLB games for today: ${mlbCount}`);
  console.log(`   NBA games for today: ${nbaCount}`);
  console.log(`   Total games: ${mlbCount + nbaCount}`);
  
  console.log('\n✅ Daily games initialization complete');
}

// Run if called directly
if (require.main === module) {
  initializeDailyGames().catch(console.error);
} 
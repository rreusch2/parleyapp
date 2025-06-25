// Setup script for TheOdds API integration
// This script ensures all reference data is populated before fetching odds

import { supabaseAdmin } from '../services/supabase/client';
import { fetchAllGameData } from './fetchTheOddsGames';

async function checkReferenceData(): Promise<boolean> {
  console.log('🔍 Checking reference data...');
  
  try {
    // Check sports_config
    const { data: sportsData, error: sportsError } = await supabaseAdmin
      .from('sports_config')
      .select('sport_key, sport_name')
      .in('sport_key', ['MLB', 'NBA']);
    
    if (sportsError) {
      console.error('❌ Error checking sports_config:', sportsError.message);
      return false;
    }
    
    console.log(`✅ Found ${sportsData?.length || 0} sports in sports_config`);
    if (sportsData) {
      sportsData.forEach(sport => console.log(`  - ${sport.sport_key}: ${sport.sport_name}`));
    }
    
    // Check market_types
    const { data: marketData, error: marketError } = await supabaseAdmin
      .from('market_types')
      .select('market_key, market_name')
      .in('market_key', ['h2h', 'spreads', 'totals']);
    
    if (marketError) {
      console.error('❌ Error checking market_types:', marketError.message);
      return false;
    }
    
    console.log(`✅ Found ${marketData?.length || 0} market types`);
    if (marketData) {
      marketData.forEach(market => console.log(`  - ${market.market_key}: ${market.market_name}`));
    }
    
    // Check bookmakers
    const { data: bookmakerData, error: bookmakerError } = await supabaseAdmin
      .from('bookmakers')
      .select('bookmaker_key, bookmaker_name')
      .eq('is_active', true)
      .limit(5);
    
    if (bookmakerError) {
      console.error('❌ Error checking bookmakers:', bookmakerError.message);
      return false;
    }
    
    console.log(`✅ Found ${bookmakerData?.length || 0} active bookmakers`);
    if (bookmakerData) {
      bookmakerData.forEach(bm => console.log(`  - ${bm.bookmaker_key}: ${bm.bookmaker_name}`));
    }
    
    // Check if we have minimum required data
    const hasMinimumData = 
      (sportsData?.length || 0) >= 2 && // MLB and NBA
      (marketData?.length || 0) >= 3 && // h2h, spreads, totals
      (bookmakerData?.length || 0) >= 1; // At least one bookmaker
    
    if (!hasMinimumData) {
      console.log('⚠️ Missing some reference data. Please run the setup SQL script first.');
      console.log('   psql -h your-host -U your-user -d your-db -f backend/src/scripts/setupReferenceData.sql');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking reference data:', (error as Error).message);
    return false;
  }
}

async function checkCurrentGames(): Promise<void> {
  console.log('\n🎮 Checking current games in database...');
  
  try {
    const { data: gamesData, error: gamesError } = await supabaseAdmin
      .from('sports_events')
      .select('sport, home_team, away_team, start_time, status')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(5);
    
    if (gamesError) {
      console.error('❌ Error checking games:', gamesError.message);
      return;
    }
    
    console.log(`✅ Found ${gamesData?.length || 0} upcoming games`);
    if (gamesData && gamesData.length > 0) {
      gamesData.forEach(game => {
        const startTime = new Date(game.start_time).toLocaleString();
        console.log(`  - ${game.away_team} @ ${game.home_team} (${game.sport}) - ${startTime}`);
      });
    }
  } catch (error) {
    console.error('❌ Error checking games:', (error as Error).message);
  }
}

async function main(): Promise<void> {
  console.log('🚀 Setting up TheOdds API integration...\n');
  
  // Check if reference data exists
  const hasReferenceData = await checkReferenceData();
  
  if (!hasReferenceData) {
    console.log('\n❌ Setup incomplete. Please run the reference data SQL script first.');
    console.log('   psql -h your-supabase-host -U postgres -d postgres -f backend/src/scripts/setupReferenceData.sql');
    return;
  }
  
  console.log('\n✅ Reference data looks good! Proceeding with odds fetch...\n');
  
  // Check current games before fetch
  await checkCurrentGames();
  
  // Fetch new games and odds
  console.log('\n📊 Fetching games and odds from TheOdds API...');
  const gameCount = await fetchAllGameData();
  
  // Check games after fetch
  console.log('\n🔄 Checking games after fetch...');
  await checkCurrentGames();
  
  console.log(`\n✅ Setup complete! Fetched data for ${gameCount} games.`);
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => console.log('\n🎉 All done!'))
    .catch((error: Error) => {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    });
}

export { checkReferenceData, checkCurrentGames }; 
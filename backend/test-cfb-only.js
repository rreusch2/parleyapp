#!/usr/bin/env node

// CFB-only test script for faster iteration
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCFBOnly() {
  console.log('🏈 Testing College Football (CFB) integration only...\n');
  
  // Test TheOdds API directly for CFB games
  const cfbSportKey = 'americanfootball_ncaaf';
  const apiKey = process.env.THEODDS_API_KEY;
  const baseUrl = process.env.THE_ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';
  
  console.log(`🔍 Testing API call: ${baseUrl}/sports/${cfbSportKey}/odds`);
  console.log(`🔑 Using API key: ${apiKey ? `${apiKey.substring(0, 8)}...` : 'MISSING'}\n`);
  
  try {
    const response = await fetch(
      `${baseUrl}/sports/${cfbSportKey}/odds?apiKey=${apiKey}&markets=h2h,spreads,totals&bookmakers=fanduel&oddsFormat=american&dateFormat=iso`
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ API Error:', data);
      return;
    }
    
    console.log(`✅ CFB API Response: Found ${data.length} games`);
    
    if (data.length > 0) {
      console.log('\n📋 CFB Games found:');
      data.slice(0, 3).forEach((game, i) => {
        console.log(`  ${i + 1}. ${game.away_team} @ ${game.home_team}`);
        console.log(`     Start: ${game.commence_time}`);
        console.log(`     Bookmakers: ${game.bookmakers?.length || 0}\n`);
      });
    } else {
      console.log('⚠️  No CFB games found - this could be because:');
      console.log('  - CFB season hasn\'t started yet');
      console.log('  - No games scheduled for today/tomorrow');
      console.log('  - API doesn\'t have CFB data yet\n');
    }
    
    // Test our multiSportConfig
    console.log('🔧 Testing multiSportConfig...');
    
    // Import our config
    const path = require('path');
    const configPath = path.join(__dirname, 'src/scripts/multiSportConfig.ts');
    
    // Since it's TypeScript, let's just check if CFB is in our env vars
    const activeSports = process.env.ACTIVE_SPORTS?.split(',') || [];
    const enableCFB = process.env.ENABLE_CFB_DATA === 'true';
    
    console.log(`ACTIVE_SPORTS: ${activeSports.join(', ')}`);
    console.log(`ENABLE_CFB_DATA: ${enableCFB}`);
    console.log(`CFB in active sports: ${activeSports.includes('CFB')}`);
    
    if (!activeSports.includes('CFB')) {
      console.log('❌ CFB not in ACTIVE_SPORTS - this is why it\'s not being fetched!');
    }
    if (!enableCFB) {
      console.log('❌ ENABLE_CFB_DATA not set to true');
    }
    
    // Check database sports_config
    console.log('\n🗄️  Checking sports_config table...');
    const { data: sportsConfig, error } = await supabase
      .from('sports_config')
      .select('*')
      .ilike('sport_name', '%college%');
      
    if (error) {
      console.error('❌ Database error:', error);
    } else {
      console.log(`Found ${sportsConfig.length} college sports entries:`);
      sportsConfig.forEach(sport => {
        console.log(`  - ${sport.sport_name} (${sport.sport_key}) - Active: ${sport.is_active}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing CFB:', error);
  }
}

// Run the test
testCFBOnly().then(() => {
  console.log('\n🏈 CFB test complete!');
  process.exit(0);
});

#!/usr/bin/env node

// Test CFB player props availability in TheOdds API
require('dotenv').config();

async function testCFBProps() {
  console.log('🏈 Testing CFB Player Props Support...\n');
  
  const cfbSportKey = 'americanfootball_ncaaf';
  const apiKey = process.env.THEODDS_API_KEY;
  const baseUrl = process.env.THE_ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';
  
  // Our configured CFB prop markets
  const configuredMarkets = [
    'player_pass_yds',
    'player_pass_tds', 
    'player_pass_completions',
    'player_pass_attempts',
    'player_pass_interceptions',
    'player_rush_yds',
    'player_rush_attempts', 
    'player_rush_tds',
    'player_receptions',
    'player_reception_yds',
    'player_reception_tds',
    'player_kicking_points',
    'player_field_goals',
    'player_tackles_assists',
    'player_1st_td',
    'player_last_td',
    'player_anytime_td'
  ];
  
  console.log('📋 Our configured CFB prop markets:');
  configuredMarkets.forEach((market, i) => {
    console.log(`  ${i + 1}. ${market}`);
  });
  console.log('');
  
  try {
    // First get a CFB game to test props on
    console.log('🔍 Getting CFB games...');
    const gamesResponse = await fetch(
      `${baseUrl}/sports/${cfbSportKey}/odds?apiKey=${apiKey}&markets=h2h&bookmakers=fanduel&oddsFormat=american&dateFormat=iso`
    );
    
    const games = await gamesResponse.json();
    
    if (!gamesResponse.ok) {
      console.error('❌ Error getting games:', games);
      return;
    }
    
    if (games.length === 0) {
      console.log('⚠️  No CFB games available to test props');
      return;
    }
    
    const testGame = games[0];
    console.log(`🎮 Testing props for: ${testGame.away_team} @ ${testGame.home_team}\n`);
    
    // Test each prop market individually
    console.log('🧪 Testing individual prop markets...');
    
    for (const market of configuredMarkets.slice(0, 5)) { // Test first 5 to avoid rate limits
      try {
        console.log(`\n🔍 Testing ${market}...`);
        
        const propsResponse = await fetch(
          `${baseUrl}/sports/${cfbSportKey}/events/${testGame.id}/odds?apiKey=${apiKey}&markets=${market}&bookmakers=fanduel`
        );
        
        const propsData = await propsResponse.json();
        
        if (propsResponse.ok && propsData.length > 0) {
          const bookmaker = propsData[0]?.bookmakers?.[0];
          const marketData = bookmaker?.markets?.find(m => m.key === market);
          
          if (marketData && marketData.outcomes?.length > 0) {
            console.log(`  ✅ ${market} - Found ${marketData.outcomes.length} player props`);
            
            // Show sample props
            marketData.outcomes.slice(0, 3).forEach(outcome => {
              console.log(`    - ${outcome.description || outcome.name}: ${outcome.point || 'N/A'} (${outcome.price})`);
            });
          } else {
            console.log(`  ❌ ${market} - No props available`);
          }
        } else {
          console.log(`  ❌ ${market} - API error or no data`);
          if (!propsResponse.ok) {
            console.log(`    Error: ${propsData.message || 'Unknown error'}`);
          }
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.log(`  ❌ ${market} - Request failed: ${error.message}`);
      }
    }
    
    // Test combined markets (how we actually call it)
    console.log('\n🔄 Testing combined markets call (production approach)...');
    
    const combinedMarkets = configuredMarkets.slice(0, 10).join(','); // First 10 markets
    
    try {
      const combinedResponse = await fetch(
        `${baseUrl}/sports/${cfbSportKey}/events/${testGame.id}/odds?apiKey=${apiKey}&markets=${combinedMarkets}&bookmakers=fanduel`
      );
      
      const combinedData = await combinedResponse.json();
      
      if (combinedResponse.ok && combinedData.length > 0) {
        const bookmaker = combinedData[0]?.bookmakers?.[0];
        const availableMarkets = bookmaker?.markets || [];
        
        console.log(`✅ Combined call successful - Found ${availableMarkets.length} markets:`);
        availableMarkets.forEach(market => {
          console.log(`  - ${market.key}: ${market.outcomes?.length || 0} props`);
        });
      } else {
        console.log('❌ Combined call failed or no data');
        if (!combinedResponse.ok) {
          console.log(`Error: ${combinedData.message || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.log(`❌ Combined call error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing CFB props:', error);
  }
}

testCFBProps().then(() => {
  console.log('\n🏈 CFB props test complete!');
  process.exit(0);
});

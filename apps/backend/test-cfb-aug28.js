#!/usr/bin/env node

// CFB test for Thursday August 28, 2025
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCFBAug28() {
  console.log('🏈 Testing CFB for Thursday August 28, 2025...\n');
  
  const cfbSportKey = 'americanfootball_ncaaf';
  const apiKey = process.env.THEODDS_API_KEY;
  const baseUrl = process.env.THE_ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';
  
  // Fetch CFB games for Aug 28th specifically
  const aug28Start = '2025-08-28T00:00:00Z';
  const aug28End = '2025-08-28T23:59:59Z';
  
  console.log(`🔍 Fetching CFB games for August 28, 2025...`);
  console.log(`📅 Date range: ${aug28Start} to ${aug28End}\n`);
  
  try {
    const response = await fetch(
      `${baseUrl}/sports/${cfbSportKey}/odds?apiKey=${apiKey}&markets=h2h,spreads,totals&bookmakers=fanduel&oddsFormat=american&dateFormat=iso`
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ API Error:', data);
      return;
    }
    
    // Filter for Aug 28th games
    const aug28Games = data.filter(game => {
      const gameDate = new Date(game.commence_time);
      const aug28Date = new Date('2025-08-28');
      return gameDate.toDateString() === aug28Date.toDateString();
    });
    
    console.log(`✅ Total CFB games available: ${data.length}`);
    console.log(`🏈 CFB games on August 28th: ${aug28Games.length}\n`);
    
    if (aug28Games.length > 0) {
      console.log('📋 August 28th CFB Games:');
      aug28Games.slice(0, 10).forEach((game, i) => {
        const gameTime = new Date(game.commence_time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Chicago'
        });
        console.log(`  ${i + 1}. ${game.away_team} @ ${game.home_team}`);
        console.log(`     Time: ${gameTime} CT`);
        console.log(`     Bookmakers: ${game.bookmakers?.length || 0}`);
        if (game.bookmakers?.[0]?.markets) {
          const markets = game.bookmakers[0].markets.map(m => m.key).join(', ');
          console.log(`     Markets: ${markets}`);
        }
        console.log('');
      });
      
      // Test storing one game to database
      console.log('💾 Testing database storage for one CFB game...');
      const testGame = aug28Games[0];
      
      const gameData = {
        id: `cfb-test-${Date.now()}`,
        league: 'College Football',
        home_team: testGame.home_team,
        away_team: testGame.away_team,
        start_time: testGame.commence_time,
        status: 'scheduled',
        metadata: {
          sport_key: cfbSportKey,
          full_data: testGame,
          source: 'theodds_api'
        }
      };
      
      const { data: insertedGame, error } = await supabase
        .from('sports_events')
        .upsert(gameData, { onConflict: 'id' })
        .select();
        
      if (error) {
        console.error('❌ Database insert error:', error);
      } else {
        console.log(`✅ Successfully stored: ${testGame.away_team} @ ${testGame.home_team}`);
        console.log(`   Game ID: ${gameData.id}`);
      }
      
    } else {
      console.log('⚠️  No CFB games found for August 28th');
      
      // Show when games are available
      console.log('\n📅 When are CFB games available?');
      const gameDates = {};
      data.slice(0, 20).forEach(game => {
        const date = new Date(game.commence_time).toDateString();
        gameDates[date] = (gameDates[date] || 0) + 1;
      });
      
      Object.entries(gameDates).forEach(([date, count]) => {
        console.log(`  ${date}: ${count} games`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing CFB Aug 28:', error);
  }
}

testCFBAug28().then(() => {
  console.log('\n🏈 August 28th CFB test complete!');
  process.exit(0);
});

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simple implementation of the calculation logic for testing
function calculateHits(stats) {
  const hits = parseFloat(stats.hits) || 0;
  return hits;
}

async function testHistoricalStatsDebug() {
  console.log('🔍 Testing Historical Stats Debug...\n');
  
  try {
    // Get a specific player that was showing issues
    const { data: player } = await supabase
      .from('players')
      .select('id, name, team')
      .eq('name', 'Brendan Donovan')
      .single();
    
    if (!player) {
      console.log('❌ Player not found');
      return;
    }
    
    console.log(`Found player: ${player.name} (${player.team})`);
    
    // Get their historical stats using direct query
    const { data: gameStats } = await supabase
      .from('player_game_stats')
      .select('stats, fantasy_points, created_at, event_id')
      .eq('player_id', player.id)
      .not('stats', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!gameStats || gameStats.length === 0) {
      console.log('❌ No stats found');
      return;
    }
    
    console.log(`\n📊 Found ${gameStats.length} stat records`);
    
    // Get event info for these games
    const eventIds = gameStats.map(stat => stat.event_id);
    const { data: eventsData } = await supabase
      .from('sports_events')
      .select('id, home_team, away_team, start_time, sport')
      .in('id', eventIds);
    
    // Combine and analyze
    let validGames = 0;
    let zeroHitGames = 0;
    let totalHits = 0;
    
    for (let i = 0; i < Math.min(gameStats.length, 5); i++) {
      const game = gameStats[i];
      const event = eventsData?.find(e => e.id === game.event_id);
      
      if (!event) {
        console.log(`Game ${i + 1}: No event data found`);
        continue;
      }
      
      const hits = calculateHits(game.stats);
      const isHome = event.home_team === player.team;
      const opponent = isHome ? event.away_team : event.home_team;
      
      console.log(`\n Game ${i + 1}:`);
      console.log(`   Date: ${event.start_time}`);
      console.log(`   Matchup: ${event.away_team} @ ${event.home_team}`);
      console.log(`   Player team: "${player.team}"`);
      console.log(`   Is home: ${isHome}`);
      console.log(`   Opponent: ${opponent}`);
      console.log(`   Raw stats: ${JSON.stringify(game.stats)}`);
      console.log(`   Calculated hits: ${hits}`);
      
      if (hits === 0) zeroHitGames++;
      totalHits += hits;
      validGames++;
    }
    
    const avgHits = validGames > 0 ? totalHits / validGames : 0;
    
    console.log(`\n📈 Analysis:`);
    console.log(`   Valid games: ${validGames}`);
    console.log(`   Games with 0 hits: ${zeroHitGames}`);
    console.log(`   Total hits: ${totalHits}`);
    console.log(`   Average hits: ${avgHits.toFixed(2)}`);
    console.log(`   Zero hit percentage: ${((zeroHitGames / validGames) * 100).toFixed(1)}%`);
    
    // Test if the issue is team matching
    console.log(`\n🔍 Team Matching Analysis:`);
    for (const event of eventsData.slice(0, 3)) {
      console.log(`   Game: ${event.away_team} @ ${event.home_team}`);
      console.log(`   Player team: "${player.team}"`);
      console.log(`   Exact home match: ${event.home_team === player.team}`);
      console.log(`   Exact away match: ${event.away_team === player.team}`);
      console.log(`   Home contains player team: ${event.home_team.toLowerCase().includes(player.team.toLowerCase())}`);
      console.log(`   Away contains player team: ${event.away_team.toLowerCase().includes(player.team.toLowerCase())}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testHistoricalStatsDebug(); 
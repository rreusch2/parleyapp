const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testPlayerPropsFixes() {
  console.log('🧪 Testing Player Props Fixes...\n');
  
  try {
    // Test 1: Check player props odds availability
    console.log('📊 Test 1: Player Props Odds Availability');
    const { data: props, error } = await supabase
      .from('player_props_odds')
      .select(`
        id,
        line,
        over_odds,
        under_odds,
        players (name, team),
        player_prop_types (prop_name, prop_key)
      `)
      .limit(10);
    
    if (error) {
      console.error('❌ Error fetching props:', error);
    } else {
      console.log(`✅ Found ${props.length} props`);
      props.forEach(prop => {
        const hasOver = prop.over_odds !== null;
        const hasUnder = prop.under_odds !== null;
        console.log(`  - ${prop.players.name} ${prop.player_prop_types.prop_name}: Over=${hasOver}, Under=${hasUnder}`);
      });
    }
    
    // Test 2: Check upcoming games with props
    console.log('\n🏟️ Test 2: Upcoming Games with Props');
    const { data: games } = await supabase
      .from('sports_events')
      .select('id, home_team, away_team, start_time')
      .gt('start_time', new Date().toISOString())
      .limit(5);
    
    if (games && games.length > 0) {
      console.log(`✅ Found ${games.length} upcoming games`);
      
      for (const game of games) {
        const { count } = await supabase
          .from('player_props_odds')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', game.id);
        
        console.log(`  - ${game.away_team} @ ${game.home_team}: ${count || 0} props`);
      }
    }
    
    // Test 3: Check historical stats for a known player
    console.log('\n📈 Test 3: Historical Stats Test');
    const { data: mikeTrout } = await supabase
      .from('players')
      .select('id, name, team')
      .eq('name', 'Mike Trout')
      .single();
    
    if (mikeTrout) {
      console.log(`✅ Found player: ${mikeTrout.name} (${mikeTrout.team})`);
      
      const { data: stats } = await supabase
        .from('player_game_stats')
        .select('stats, event_id, created_at')
        .eq('player_id', mikeTrout.id)
        .not('stats', 'is', null)
        .limit(3);
      
      if (stats && stats.length > 0) {
        console.log(`✅ Found ${stats.length} historical stats for ${mikeTrout.name}`);
        stats.forEach((stat, index) => {
          const hits = stat.stats?.hits || 0;
          const hrs = stat.stats?.home_runs || 0;
          console.log(`  - Game ${index + 1}: ${hits} hits, ${hrs} HRs`);
        });
      } else {
        console.log(`❌ No historical stats found for ${mikeTrout.name}`);
      }
    }
    
    // Test 4: Test the new odds calculation logic
    console.log('\n🎯 Test 4: Odds Calculation Logic');
    
    // Test implied odds calculation
    function calculateImpliedOdds(knownOdds, side) {
      if (!knownOdds) return -110;
      
      const odds = parseFloat(knownOdds);
      const impliedProb = odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
      const oppositeProb = 1 - impliedProb + 0.05;
      
      if (oppositeProb > 0.5) {
        return -Math.round((oppositeProb / (1 - oppositeProb)) * 100);
      } else {
        return Math.round((1 - oppositeProb) / oppositeProb * 100);
      }
    }
    
    // Test with sample odds
    const testOdds = ['+130', '-160', '+240', '-110'];
    testOdds.forEach(odds => {
      const calculatedOpposite = calculateImpliedOdds(odds, 'opposite');
      console.log(`  - Known odds: ${odds} → Calculated opposite: ${calculatedOpposite > 0 ? '+' : ''}${calculatedOpposite}`);
    });
    
    // Test 5: Validate RBI and Total Bases estimation
    console.log('\n🔢 Test 5: Stats Estimation Logic');
    
    const sampleStats = [
      { hits: 2, home_runs: 1 },
      { hits: 1, home_runs: 0 },
      { hits: 0, home_runs: 0 },
      { hits: 3, home_runs: 2 }
    ];
    
    sampleStats.forEach((stats, index) => {
      const estimatedRBIs = (stats.hits * 0.35) + stats.home_runs;
      const estimatedTotalBases = (stats.hits * 1.4) + (stats.home_runs * 3);
      
      console.log(`  - Sample ${index + 1}: ${stats.hits} hits, ${stats.home_runs} HR → Est. RBIs: ${estimatedRBIs.toFixed(2)}, Est. TB: ${estimatedTotalBases.toFixed(2)}`);
    });
    
    console.log('\n🎉 Player Props Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPlayerPropsFixes().then(() => {
  console.log('\n✅ All tests completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
}); 
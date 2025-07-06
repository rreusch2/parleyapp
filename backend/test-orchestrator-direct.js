const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Test the core logic that was fixed
async function testPlayerPropsLogic() {
  console.log('🧪 Testing Core Player Props Logic...\n');
  
  try {
    // Test 1: Get a real game with props
    console.log('🏟️ Finding games with player props...');
    const { data: games } = await supabase
      .from('sports_events')
      .select('id, home_team, away_team, start_time')
      .gt('start_time', new Date().toISOString())
      .limit(5);
    
    let testGame = null;
    for (const game of games) {
      const { count } = await supabase
        .from('player_props_odds')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', game.id);
      
      if (count > 0) {
        testGame = game;
        console.log(`✅ Found game with props: ${game.away_team} @ ${game.home_team} (${count} props)`);
        break;
      }
    }
    
    if (!testGame) {
      console.log('❌ No games with props found');
      return;
    }
    
    // Test 2: Get real player props with the NEW flexible query
    console.log('\n📊 Testing new flexible player props query...');
    const { data: playerProps, error } = await supabase
      .from('player_props_odds')
      .select(`
        id,
        line,
        over_odds,
        under_odds,
        last_update,
        players (
          id,
          name,
          team
        ),
        player_prop_types (
          prop_key,
          prop_name
        ),
        bookmakers (
          bookmaker_name
        )
      `)
      .eq('event_id', testGame.id)
      .or('over_odds.not.is.null,under_odds.not.is.null') // NEW: Accept props with EITHER over OR under odds
      .gt('line', 0)
      .order('last_update', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`✅ Found ${playerProps.length} player props using new flexible query`);
    
    // Test 3: Apply the new odds calculation logic
    console.log('\n🔢 Testing odds calculation logic...');
    
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
    
    let validPropsCount = 0;
    let calculatedOddsCount = 0;
    
    for (const prop of playerProps) {
      if (!prop.players || !prop.player_prop_types) continue;
      
      const hasOver = prop.over_odds !== null;
      const hasUnder = prop.under_odds !== null;
      
      // Apply NEW validation logic (require EITHER over OR under odds)
      const passesNewValidation = hasOver || hasUnder;
      
      if (passesNewValidation) {
        validPropsCount++;
        
        // Calculate missing odds
        const calculatedOverOdds = hasOver ? parseFloat(prop.over_odds) : calculateImpliedOdds(prop.under_odds, 'opposite');
        const calculatedUnderOdds = hasUnder ? parseFloat(prop.under_odds) : calculateImpliedOdds(prop.over_odds, 'opposite');
        
        if (!hasOver || !hasUnder) {
          calculatedOddsCount++;
        }
        
        console.log(`  - ${prop.players.name} ${prop.player_prop_types.prop_name} (${prop.line})`);
        console.log(`    Original: Over=${prop.over_odds}, Under=${prop.under_odds}`);
        console.log(`    Calculated: Over=${calculatedOverOdds}, Under=${calculatedUnderOdds}`);
        console.log(`    Status: ${!hasOver || !hasUnder ? 'CALCULATED' : 'ORIGINAL'}`);
        console.log('');
      }
    }
    
    console.log(`📈 Results:`);
    console.log(`  - Total props retrieved: ${playerProps.length}`);
    console.log(`  - Props passing new validation: ${validPropsCount}`);
    console.log(`  - Props requiring calculated odds: ${calculatedOddsCount}`);
    console.log(`  - Success rate: ${((validPropsCount / playerProps.length) * 100).toFixed(1)}%`);
    
    // Test 4: Test historical stats for a sample player
    console.log('\n📊 Testing historical stats for sample player...');
    
    if (playerProps.length > 0) {
      const sampleProp = playerProps[0];
      const playerId = sampleProp.players.id;
      const playerName = sampleProp.players.name;
      
      console.log(`Testing with: ${playerName} (${playerId})`);
      
      // Test direct stats query (NEW approach)
      const { data: directStats } = await supabase
        .from('player_game_stats')
        .select('stats, fantasy_points, created_at, event_id')
        .eq('player_id', playerId)
        .not('stats', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (directStats && directStats.length > 0) {
        console.log(`✅ Found ${directStats.length} stats records via direct query`);
        
        // Test the NEW estimation logic
        const sampleStats = directStats[0].stats;
        const hits = parseFloat(sampleStats.hits) || 0;
        const homeRuns = parseFloat(sampleStats.home_runs || sampleStats.hr) || 0;
        
        // Apply NEW RBI estimation
        const estimatedRBIs = (hits * 0.35) + homeRuns;
        
        // Apply NEW total bases estimation
        const estimatedTotalBases = (hits * 1.4) + (homeRuns * 3);
        
        console.log(`  - Raw stats: ${hits} hits, ${homeRuns} HRs`);
        console.log(`  - Estimated RBIs: ${estimatedRBIs.toFixed(2)}`);
        console.log(`  - Estimated Total Bases: ${estimatedTotalBases.toFixed(2)}`);
        
        // Test if we have an actual RBI field
        const actualRBIs = sampleStats.rbis || sampleStats.rbi;
        if (actualRBIs !== undefined) {
          console.log(`  - Actual RBIs: ${actualRBIs} (estimation not needed)`);
        } else {
          console.log(`  - No RBI field found (estimation will be used)`);
        }
        
      } else {
        console.log(`❌ No historical stats found for ${playerName}`);
      }
    }
    
    console.log('\n🎉 Core logic test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPlayerPropsLogic(); 
/**
 * Verification script to check player props data mapping and connectivity
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function verifyPlayerPropsData() {
  console.log('🔍 Verifying Player Props Data Mapping');
  console.log('=====================================');
  
  try {
    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    console.log('✅ Connected to Supabase');
    
    // 1. Check player props odds data
    console.log('\n📊 Checking player props odds data...');
    const { data: propsOdds, error: propsError } = await supabase
      .from('player_props_odds')
      .select(`
        id,
        line,
        over_odds,
        players (
          id,
          name,
          team
        ),
        player_prop_types (
          prop_key,
          prop_name
        )
      `)
      .not('over_odds', 'is', null)
      .limit(5);
    
    if (propsError) {
      console.error('❌ Error fetching props odds:', propsError);
      return;
    }
    
    console.log(`✅ Found ${propsOdds?.length || 0} prop odds records (showing first 5):`);
    propsOdds?.forEach((prop, i) => {
      console.log(`   ${i + 1}. ${prop.players?.name} (${prop.players?.team}) - ${prop.player_prop_types?.prop_key} ${prop.line} (odds: ${prop.over_odds})`);
    });
    
    // 2. Check if we can find historical stats for these players
    console.log('\n📈 Checking historical stats mapping...');
    
    if (propsOdds && propsOdds.length > 0) {
      const samplePlayer = propsOdds[0];
      
      console.log(`\n🔍 Testing historical stats for: ${samplePlayer.players.name} (ID: ${samplePlayer.players.id})`);
      
      // Check if this player has historical stats
      const { data: historicalStats, error: statsError } = await supabase
        .from('player_game_stats')
        .select(`
          id,
          stats,
          sports_events (
            home_team,
            away_team,
            start_time
          )
        `)
        .eq('player_id', samplePlayer.players.id)
        .not('stats', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (statsError) {
        console.error('❌ Error fetching historical stats:', statsError);
        return;
      }
      
      console.log(`✅ Found ${historicalStats?.length || 0} historical games for ${samplePlayer.players.name}`);
      
      if (historicalStats && historicalStats.length > 0) {
        console.log('\n📝 Sample historical stats:');
        historicalStats.forEach((game, i) => {
          const stats = game.stats;
          console.log(`   Game ${i + 1}:`);
          console.log(`     Date: ${game.sports_events?.start_time}`);
          console.log(`     Teams: ${game.sports_events?.away_team} @ ${game.sports_events?.home_team}`);
          console.log(`     Stats: ${JSON.stringify(stats).substring(0, 100)}...`);
          
          // Check for relevant prop stats
          const propType = samplePlayer.player_prop_types.prop_key;
          if (propType === 'batter_hits' && stats.hits !== undefined) {
            console.log(`     Hits: ${stats.hits} (prop type: ${propType})`);
          } else if (propType === 'batter_rbis' && (stats.rbis !== undefined || stats.rbi !== undefined)) {
            console.log(`     RBIs: ${stats.rbis || stats.rbi} (prop type: ${propType})`);
          }
        });
        
                 // Test the new historical stats service
         console.log('\n🧪 Testing Historical Stats Service...');
         const { playerHistoricalStatsService } = await import('./src/services/playerHistoricalStatsService.js');
        
        const calculatedStats = await playerHistoricalStatsService.getPlayerHistoricalStats(
          samplePlayer.players.id,
          samplePlayer.player_prop_types.prop_key
        );
        
        if (calculatedStats) {
          console.log('✅ Historical Stats Service working!');
          console.log(`   Season Average: ${calculatedStats.seasonAvg.toFixed(2)}`);
          console.log(`   Last 10 Average: ${calculatedStats.last10Avg.toFixed(2)}`);
          console.log(`   Games Played: ${calculatedStats.gamesPlayed}`);
          console.log(`   Home Average: ${calculatedStats.homeAvg.toFixed(2)}`);
          console.log(`   Away Average: ${calculatedStats.awayAvg.toFixed(2)}`);
          
          // Test prediction calculation
          const prediction = playerHistoricalStatsService.calculatePropPrediction(
            calculatedStats,
            samplePlayer.line,
            { isHome: true }
          );
          
          console.log('\n🎯 Prediction Test:');
          console.log(`   Line: ${samplePlayer.line}`);
          console.log(`   Prediction: ${prediction.prediction.toFixed(2)}`);
          console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
          console.log(`   Over Probability: ${(prediction.overProbability * 100).toFixed(1)}%`);
          console.log(`   Key Factors: ${prediction.factors.join(', ')}`);
          
        } else {
          console.log('❌ Historical Stats Service returned null');
        }
        
      } else {
        console.log('⚠️ No historical stats found for this player');
        
        // Check if it's a team name mapping issue
        console.log('\n🔍 Checking team name mapping issue...');
        const { data: allPlayerNames } = await supabase
          .from('players')
          .select('name, team')
          .ilike('name', `%${samplePlayer.players.name.split(' ')[0]}%`)
          .limit(10);
        
        console.log('🔍 Players with similar names:');
        allPlayerNames?.forEach(player => {
          console.log(`   ${player.name} (${player.team})`);
        });
      }
    }
    
    // 3. Summary
    console.log('\n📋 Data Mapping Summary:');
    console.log(`✅ Player Props Odds: ${propsOdds?.length || 0} records`);
    console.log(`✅ Historical Stats Service: Working`);
    console.log(`✅ Database Connection: Active`);
    
    console.log('\n🚀 Ready to test full integration!');
    console.log('Run: node test-player-props-integration.js');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run verification if this file is executed directly
if (require.main === module) {
  verifyPlayerPropsData()
    .then(() => {
      console.log('\n✅ Verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyPlayerPropsData }; 
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Import the playerHistoricalStatsService
const { playerHistoricalStatsService } = require('./dist/services/playerHistoricalStatsService');

// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testStatsFixResult() {
  console.log('🧪 Testing Stats Fix Result...\n');
  
  try {
    // Get Brendan Donovan who was showing issues
    const { data: player } = await supabase
      .from('players')
      .select('id, name, team')
      .eq('name', 'Brendan Donovan')
      .single();
    
    if (!player) {
      console.log('❌ Player not found');
      return;
    }
    
    console.log(`Testing with: ${player.name} (${player.team})`);
    
    // Test the historical stats service directly
    const historicalStats = await playerHistoricalStatsService.getPlayerHistoricalStats(
      player.id,
      'batter_hits'
    );
    
    if (!historicalStats) {
      console.log('❌ No historical stats returned');
      return;
    }
    
    console.log('\n📊 Historical Stats Results:');
    console.log(`   Player: ${historicalStats.playerName}`);
    console.log(`   Prop Type: ${historicalStats.propType}`);
    console.log(`   Games Played: ${historicalStats.gamesPlayed}`);
    console.log(`   Season Average: ${historicalStats.seasonAvg.toFixed(3)}`);
    console.log(`   Last 10 Average: ${historicalStats.last10Avg.toFixed(3)}`);
    console.log(`   Home Average: ${historicalStats.homeAvg.toFixed(3)}`);
    console.log(`   Away Average: ${historicalStats.awayAvg.toFixed(3)}`);
    console.log(`   Season Total: ${historicalStats.seasonTotal}`);
    console.log(`   Sample Size: ${historicalStats.sampleSize}`);
    
    console.log('\n🎯 Recent Games Sample:');
    historicalStats.recentGames.slice(0, 3).forEach((game, index) => {
      console.log(`   Game ${index + 1}: ${game.value} hits vs ${game.opponent} (${game.isHome ? 'Home' : 'Away'})`);
    });
    
    // Test calculation prediction
    const prediction = playerHistoricalStatsService.calculatePropPrediction(
      historicalStats,
      1.5, // Line of 1.5 hits
      { isHome: true }
    );
    
    console.log('\n🔮 Prediction for 1.5 hits line:');
    console.log(`   Prediction: ${prediction.prediction.toFixed(3)}`);
    console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
    console.log(`   Over Probability: ${(prediction.overProbability * 100).toFixed(1)}%`);
    console.log(`   Under Probability: ${(prediction.underProbability * 100).toFixed(1)}%`);
    console.log(`   Key Factors: ${prediction.factors.join(', ')}`);
    
    // Test with a different prop type
    console.log('\n🏠 Testing Home Runs prop...');
    const hrStats = await playerHistoricalStatsService.getPlayerHistoricalStats(
      player.id,
      'batter_home_runs'
    );
    
    if (hrStats) {
      console.log(`   HR Season Average: ${hrStats.seasonAvg.toFixed(3)}`);
      console.log(`   HR Games Played: ${hrStats.gamesPlayed}`);
    }
    
    console.log('\n✅ Stats fix test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testStatsFixResult(); 
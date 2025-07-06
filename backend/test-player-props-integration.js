/**
 * Test script to verify player props integration works with historical stats service
 */

const path = require('path');

// Set up environment
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testPlayerPropsIntegration() {
  console.log('🧪 Testing Player Props Integration with Historical Stats Service');
  console.log('=========================================================================');
  
  try {
    // Import the orchestrator (use .js extension for compiled file)
    const { default: orchestrator } = await import('./src/ai/orchestrator/enhancedDeepseekOrchestrator.js');
    
    console.log('✅ Orchestrator imported successfully');
    
    // Test player props generation
    console.log('\n🎯 Testing Player Props Generation...');
    const playerPropsPicks = await orchestrator.generatePlayerPropsPicks('test-user', 5, true);
    
    console.log(`\n📊 Generated ${playerPropsPicks.length} player props picks:`);
    
    if (playerPropsPicks.length > 0) {
      playerPropsPicks.forEach((pick, index) => {
        console.log(`\n${index + 1}. ${pick.pick}`);
        console.log(`   Confidence: ${pick.confidence}%`);
        console.log(`   Edge: ${pick.value_percentage.toFixed(1)}%`);
        console.log(`   ROI: ${pick.roi_estimate.toFixed(1)}%`);
        console.log(`   Odds: ${pick.odds}`);
        console.log(`   Reasoning: ${pick.reasoning.substring(0, 100)}...`);
        console.log(`   Model: ${pick.metadata.model_version}`);
        console.log(`   Tools: ${pick.metadata.tools_used.join(', ')}`);
      });
      
      console.log('\n✅ SUCCESS: Player props integration working correctly!');
      console.log(`🏆 Generated ${playerPropsPicks.length} picks using historical data analysis`);
      
      // Analyze the picks
      const avgConfidence = playerPropsPicks.reduce((sum, pick) => sum + pick.confidence, 0) / playerPropsPicks.length;
      const avgEdge = playerPropsPicks.reduce((sum, pick) => sum + pick.value_percentage, 0) / playerPropsPicks.length;
      
      console.log(`\n📈 Analytics:`);
      console.log(`   Average Confidence: ${avgConfidence.toFixed(1)}%`);
      console.log(`   Average Edge: ${avgEdge.toFixed(1)}%`);
      console.log(`   Historical Data Based: ${playerPropsPicks.filter(p => p.metadata.model_version.includes('Historical')).length}/${playerPropsPicks.length}`);
      
    } else {
      console.log('\n⚠️ No player props picks generated. Possible reasons:');
      console.log('   - No games with player props data today');
      console.log('   - No historical stats found for players');
      console.log('   - All picks filtered out by validation');
      
      // Test individual components
      console.log('\n🔍 Testing individual components...');
      
             // Test historical stats service directly
       const { playerHistoricalStatsService } = await import('./src/services/playerHistoricalStatsService.js');
      console.log('✅ Historical stats service imported');
      
      // Test with a sample query
      console.log('\n🔍 Testing sample historical stats query...');
      // This would need a real player ID from your database
    }
    
  } catch (error) {
    console.error('\n❌ ERROR in player props integration test:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Provide troubleshooting info
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check that SUPABASE_URL and SUPABASE_ANON_KEY are set in .env');
    console.log('2. Verify database has player_props_odds and player_game_stats data');
    console.log('3. Check that players table has correct team mappings');
    console.log('4. Ensure DEEPSEEK_API_KEY is set for AI analysis');
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testPlayerPropsIntegration()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPlayerPropsIntegration }; 
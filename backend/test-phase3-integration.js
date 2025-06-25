#!/usr/bin/env node

/**
 * Phase 3 Integration Testing Script
 * Tests the complete enhanced LLM orchestrator and Phase 2 model integration
 */

const axios = require('axios');
const fs = require('fs');

console.log('🎯 PHASE 3: Enhanced LLM Orchestrator Integration Testing');
console.log('=' .repeat(70));

async function testPhase3Integration() {
  const results = {
    start_time: new Date().toISOString(),
    tests: {},
    summary: {}
  };

  try {
    // Test 1: Python API Health Check
    console.log('\n1. Testing Python API Health (Port 5001)...');
    try {
      const healthResponse = await axios.get('http://localhost:5001/health', { timeout: 5000 });
      console.log('✅ Python API is running');
      console.log(`   Version: ${healthResponse.data.version || 'Unknown'}`);
      results.tests.python_api_health = { status: 'pass', data: healthResponse.data };
    } catch (error) {
      console.log('❌ Python API is not running');
      console.log('   Error:', error.message);
      console.log('   💡 To start: cd python-services/sports-betting-api && python parley_predictor.py');
      results.tests.python_api_health = { status: 'fail', error: error.message };
    }

    // Test 2: Enhanced Model Status
    console.log('\n2. Testing Enhanced Model Status...');
    try {
      const modelsResponse = await axios.get('http://localhost:5001/api/v2/models/status', { timeout: 10000 });
      console.log('✅ Enhanced models status endpoint working');
      console.log(`   Framework Available: ${modelsResponse.data.enhanced_framework_available}`);
      console.log(`   Models Loaded: ${Object.keys(modelsResponse.data.models_trained || {}).length}`);
      results.tests.enhanced_models = { status: 'pass', data: modelsResponse.data };
    } catch (error) {
      console.log('❌ Enhanced models status failed');
      console.log('   Error:', error.message);
      results.tests.enhanced_models = { status: 'fail', error: error.message };
    }

    // Test 3: Enhanced Player Props Prediction
    console.log('\n3. Testing Enhanced Player Props Prediction...');
    try {
      const playerPropData = {
        sport: 'NBA',
        prop_type: 'points',
        player_id: 'test_player_123',
        line: 25.5,
        game_context: {
          is_home: true,
          rest_days: 2,
          opponent: 'Lakers',
          minutes_expected: 35
        }
      };
      
      const propResponse = await axios.post('http://localhost:5001/api/v2/predict/player-prop', 
        playerPropData, { timeout: 15000 });
      
      console.log('✅ Enhanced player props prediction working');
      console.log(`   Prediction: ${propResponse.data.prediction}`);
      console.log(`   Confidence: ${(propResponse.data.confidence * 100).toFixed(1)}%`);
      console.log(`   Enhanced: ${propResponse.data.enhanced}`);
      results.tests.enhanced_player_props = { status: 'pass', data: propResponse.data };
    } catch (error) {
      console.log('❌ Enhanced player props prediction failed');
      console.log('   Error:', error.message);
      results.tests.enhanced_player_props = { status: 'fail', error: error.message };
    }

    // Test 4: Enhanced Spread Prediction
    console.log('\n4. Testing Enhanced Spread Prediction...');
    try {
      const spreadData = {
        sport: 'NBA',
        game_id: 'test_game_123',
        spread_line: -5.5
      };
      
      const spreadResponse = await axios.post('http://localhost:5001/api/v2/predict/spread', 
        spreadData, { timeout: 15000 });
      
      console.log('✅ Enhanced spread prediction working');
      console.log(`   Prediction: ${spreadResponse.data.prediction}`);
      console.log(`   Confidence: ${(spreadResponse.data.confidence * 100).toFixed(1)}%`);
      console.log(`   Enhanced: ${spreadResponse.data.enhanced}`);
      results.tests.enhanced_spread = { status: 'pass', data: spreadResponse.data };
    } catch (error) {
      console.log('❌ Enhanced spread prediction failed');
      console.log('   Error:', error.message);
      results.tests.enhanced_spread = { status: 'fail', error: error.message };
    }

    // Test 5: Enhanced Total Prediction
    console.log('\n5. Testing Enhanced Total Prediction...');
    try {
      const totalData = {
        sport: 'NBA',
        game_id: 'test_game_123',
        total_line: 215.5
      };
      
      const totalResponse = await axios.post('http://localhost:5001/api/v2/predict/total', 
        totalData, { timeout: 15000 });
      
      console.log('✅ Enhanced total prediction working');
      console.log(`   Prediction: ${totalResponse.data.prediction}`);
      console.log(`   Confidence: ${(totalResponse.data.confidence * 100).toFixed(1)}%`);
      console.log(`   Enhanced: ${totalResponse.data.enhanced}`);
      results.tests.enhanced_total = { status: 'pass', data: totalResponse.data };
    } catch (error) {
      console.log('❌ Enhanced total prediction failed');
      console.log('   Error:', error.message);
      results.tests.enhanced_total = { status: 'fail', error: error.message };
    }

    // Test 6: Enhanced Parlay Analysis
    console.log('\n6. Testing Enhanced Parlay Analysis...');
    try {
      const parlayData = {
        legs: [
          {
            type: 'player_prop',
            sport: 'NBA',
            prop_type: 'points',
            player_id: 'test_player_123',
            line: 25.5,
            game_context: { is_home: true }
          },
          {
            type: 'spread',
            sport: 'NBA',
            game_id: 'test_game_123',
            line: -5.5
          }
        ]
      };
      
      const parlayResponse = await axios.post('http://localhost:5001/api/v2/analyze/parlay-enhanced', 
        parlayData, { timeout: 20000 });
      
      console.log('✅ Enhanced parlay analysis working');
      console.log(`   Combined Confidence: ${(parlayResponse.data.parlay_analysis?.combined_confidence * 100).toFixed(1)}%`);
      console.log(`   Enhanced: ${parlayResponse.data.enhanced}`);
      results.tests.enhanced_parlay = { status: 'pass', data: parlayResponse.data };
    } catch (error) {
      console.log('❌ Enhanced parlay analysis failed');
      console.log('   Error:', error.message);
      results.tests.enhanced_parlay = { status: 'fail', error: error.message };
    }

    // Test 7: Backend API Health (Node.js)
    console.log('\n7. Testing Backend API Health (Port 3001)...');
    try {
      const backendHealthResponse = await axios.get('http://localhost:3001/api/health', { timeout: 5000 });
      console.log('✅ Backend API is running');
      results.tests.backend_api_health = { status: 'pass', data: backendHealthResponse.data };
    } catch (error) {
      console.log('❌ Backend API is not running');
      console.log('   Error:', error.message);
      console.log('   💡 To start: cd backend && npm run dev');
      results.tests.backend_api_health = { status: 'fail', error: error.message };
    }

    // Test 8: Enhanced Daily Automation Test
    console.log('\n8. Testing Enhanced Daily Automation Script...');
    try {
      const automationScript = '../python-services/sports-betting-api/enhanced_daily_automation.py';
      if (fs.existsSync(automationScript)) {
        console.log('✅ Enhanced daily automation script exists');
        console.log(`   Location: ${automationScript}`);
        results.tests.automation_script = { status: 'pass', location: automationScript };
      } else {
        console.log('❌ Enhanced daily automation script not found');
        results.tests.automation_script = { status: 'fail', error: 'Script not found' };
      }
    } catch (error) {
      console.log('❌ Error checking automation script');
      results.tests.automation_script = { status: 'fail', error: error.message };
    }

    // Test 9: Frontend Enhanced Components Test
    console.log('\n9. Testing Frontend Enhanced Components...');
    try {
      const enhancedCard = '../app/components/EnhancedPredictionCard.tsx';
      if (fs.existsSync(enhancedCard)) {
        console.log('✅ Enhanced prediction card component exists');
        console.log(`   Location: ${enhancedCard}`);
        results.tests.frontend_components = { status: 'pass', location: enhancedCard };
      } else {
        console.log('❌ Enhanced prediction card component not found');
        results.tests.frontend_components = { status: 'fail', error: 'Component not found' };
      }
    } catch (error) {
      console.log('❌ Error checking frontend components');
      results.tests.frontend_components = { status: 'fail', error: error.message };
    }

    // Calculate Summary
    const totalTests = Object.keys(results.tests).length;
    const passedTests = Object.values(results.tests).filter(test => test.status === 'pass').length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);

    results.summary = {
      total_tests: totalTests,
      passed: passedTests,
      failed: failedTests,
      success_rate: `${successRate}%`,
      end_time: new Date().toISOString()
    };

    // Print Summary
    console.log('\n' + '=' .repeat(70));
    console.log('🎯 PHASE 3 INTEGRATION TEST SUMMARY');
    console.log('=' .repeat(70));
    
    Object.entries(results.tests).forEach(([testName, result]) => {
      const status = result.status === 'pass' ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${testName.replace(/_/g, ' ').toUpperCase()}`);
      if (result.status === 'fail' && result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });

    console.log(`\nOverall: ${passedTests}/${totalTests} tests passed (${successRate}%)`);

    if (successRate >= '90') {
      console.log('\n🎉 Phase 3 Enhanced Integration is working excellently!');
    } else if (successRate >= '70') {
      console.log('\n✅ Phase 3 Enhanced Integration is mostly working!');
    } else {
      console.log('\n⚠️ Phase 3 Enhanced Integration needs attention.');
    }

    console.log('\n📋 Next Steps:');
    if (results.tests.python_api_health?.status === 'fail') {
      console.log('  1. Start Python API: cd python-services/sports-betting-api && python parley_predictor.py');
    }
    if (results.tests.backend_api_health?.status === 'fail') {
      console.log('  2. Start Backend API: cd backend && npm run dev');
    }
    if (passedTests === totalTests) {
      console.log('  ✅ All systems operational! Ready for Phase 4 or production deployment.');
    }

    // Save results to file
    fs.writeFileSync('phase3-test-results.json', JSON.stringify(results, null, 2));
    console.log('\n💾 Test results saved to: phase3-test-results.json');

    return results;

  } catch (error) {
    console.error('❌ Critical error in Phase 3 testing:', error.message);
    return { error: error.message };
  }
}

// Run the test
testPhase3Integration().then(results => {
  process.exit(results.error ? 1 : 0);
}).catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}); 
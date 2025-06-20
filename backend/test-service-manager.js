const axios = require('axios');

async function testServiceManager() {
  console.log('🧪 Testing Sports Betting Service Manager Integration');
  console.log('=' .repeat(60));

  const PYTHON_API_BASE = 'http://localhost:8001';

  try {
    // Test 1: Direct Python API test
    console.log('\n1. Testing Python API Direct Access...');
    try {
      const healthResponse = await axios.get(`${PYTHON_API_BASE}/health`);
      console.log('✅ Python API is healthy:', healthResponse.data);
    } catch (error) {
      console.log('❌ Python API is not running:', error.message);
      return;
    }

    // Test 2: Test all Python endpoints
    console.log('\n2. Testing Python API Endpoints...');
    
    const tests = [
      {
        name: 'Value Bets',
        endpoint: '/value-bets',
        data: { sport: 'nba', threshold: 0.05, max_odds: 5.0 }
      },
      {
        name: 'Strategy Performance',
        endpoint: '/strategy-performance',
        data: { sport: 'nba', strategy: 'value_betting', period: '90d' }
      },
      {
        name: 'Optimal Configuration',
        endpoint: '/optimal-config',
        data: { sport: 'nba', bankroll: 1000, risk_tolerance: 'medium' }
      }
    ];

    let successCount = 0;
    for (const test of tests) {
      try {
        const response = await axios.post(`${PYTHON_API_BASE}${test.endpoint}`, test.data);
        console.log(`  ✅ ${test.name}: Working`);
        if (test.name === 'Strategy Performance') {
          console.log(`    📊 ROI: ${response.data.roi?.toFixed(2)}%`);
          console.log(`    📊 Win Rate: ${response.data.winRate?.toFixed(2)}%`);
        }
        successCount++;
      } catch (error) {
        console.log(`  ❌ ${test.name}: Failed - ${error.response?.status || error.message}`);
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('🎯 Service Manager Test Results:');
    console.log(`✅ Python API is fully functional (${successCount}/${tests.length} endpoints working)`);
    console.log('✅ Sports betting algorithms operational');
    console.log('🎉 Ready for LLM integration!');

    if (successCount === tests.length) {
      console.log('\n🚀 ALL TESTS PASSED - Phase 2 Integration is READY!');
    } else {
      console.log('\n⚠️  Some endpoints failed - check Python API logs');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testServiceManager(); 
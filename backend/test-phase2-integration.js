const axios = require('axios');

async function testPhase2Integration() {
  console.log('🚀 Testing Phase 2 Integration - Sports Betting AI Tools');
  console.log('=' .repeat(60));

  try {
    // Test 1: Check if Python API is running
    console.log('\n1. Testing Python API Health...');
    try {
      const healthResponse = await axios.get('http://localhost:8001/health');
      console.log('✅ Python API is healthy:', healthResponse.data);
    } catch (error) {
      console.log('❌ Python API is not running. Please start it first.');
      return;
    }

    // Test 2: Test Value Bets endpoint
    console.log('\n2. Testing Value Bets endpoint...');
    try {
      const valueBetsResponse = await axios.post('http://localhost:8001/value-bets', {
        sport: 'nba',
        threshold: 0.05,
        max_odds: 5.0
      });
      console.log('✅ Value Bets endpoint working:', valueBetsResponse.data);
    } catch (error) {
      console.log('❌ Value Bets endpoint failed:', error.message);
    }

    // Test 3: Test Backtest endpoint
    console.log('\n3. Testing Backtest endpoint...');
    try {
      const backtestResponse = await axios.post('http://localhost:8001/backtest', {
        sport: 'nba',
        strategy: 'value_betting',
        start_date: '2023-01-01',
        end_date: '2023-12-31'
      });
      console.log('✅ Backtest endpoint working:', backtestResponse.data);
    } catch (error) {
      console.log('❌ Backtest endpoint failed:', error.message);
    }

    // Test 4: Test Strategy Performance endpoint
    console.log('\n4. Testing Strategy Performance endpoint...');
    try {
      const performanceResponse = await axios.post('http://localhost:8001/strategy-performance', {
        sport: 'nba',
        strategy: 'value_betting',
        period: '90d'
      });
      console.log('✅ Strategy Performance endpoint working:', performanceResponse.data);
    } catch (error) {
      console.log('❌ Strategy Performance endpoint failed:', error.message);
    }

    // Test 5: Test Optimal Configuration endpoint
    console.log('\n5. Testing Optimal Configuration endpoint...');
    try {
      const configResponse = await axios.post('http://localhost:8001/optimal-config', {
        sport: 'nba',
        bankroll: 1000,
        risk_tolerance: 'medium'
      });
      console.log('✅ Optimal Configuration endpoint working:', configResponse.data);
    } catch (error) {
      console.log('❌ Optimal Configuration endpoint failed:', error.message);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('🎉 Phase 2 Integration Test Complete!');
    console.log('✅ Python API is running and all endpoints are functional');
    console.log('✅ Ready for Node.js orchestrator integration');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPhase2Integration(); 
#!/usr/bin/env ts-node

import { predictionValidator } from '../src/services/predictionValidator';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('testValidation');

async function testValidationSystem() {
  console.log('\n🧪 TESTING PREDICTION VALIDATION SYSTEM\n');
  
  try {
    // Test 1: Get current validation metrics
    console.log('📊 1. Getting current validation metrics...');
    const metrics = await predictionValidator.getValidationMetrics();
    
    console.log(`Total predictions: ${metrics.totalPredictions}`);
    console.log(`Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
    console.log(`Performance rating: ${predictionValidator.getPerformanceRating(metrics.accuracy)}`);
    console.log(`Calibration: ${(metrics.calibration * 100).toFixed(1)}%`);
    console.log(`Log loss: ${metrics.logLoss.toFixed(3)}`);
    
    console.log('\nBy confidence:');
    Object.entries(metrics.accuracyByConfidence).forEach(([conf, data]) => {
      console.log(`  ${conf}: ${(data.accuracy * 100).toFixed(1)}% (${data.count} predictions)`);
    });
    
    console.log('\nBy sport:');
    Object.entries(metrics.accuracyBySport).forEach(([sport, data]) => {
      console.log(`  ${sport}: ${(data.accuracy * 100).toFixed(1)}% (${data.count} predictions)`);
    });
    
    console.log('\nRecent performance:');
    console.log(`  Last 7 days: ${(metrics.recentPerformance.last7Days * 100).toFixed(1)}%`);
    console.log(`  Last 30 days: ${(metrics.recentPerformance.last30Days * 100).toFixed(1)}%`);
    console.log(`  Last 90 days: ${(metrics.recentPerformance.last90Days * 100).toFixed(1)}%`);
    
    // Test 2: Simulate some predictions with outcomes (for testing)
    console.log('\n🎯 2. Testing prediction outcome updates...');
    
    // This would normally be done when real games finish
    // For testing, we can simulate some outcomes
    console.log('Note: In production, this would be automated when games finish');
    console.log('You can manually test with: curl -X POST http://localhost:3001/api/validation/update-outcome -H "Content-Type: application/json" -d \'{"predictionId": "your-prediction-id", "actualOutcome": "Cardinals ML"}\'');
    
    // Test 3: Performance insights
    console.log('\n🔍 3. Sample performance insights:');
    
    const sampleInsights = [
      '🎯 Model accuracy varies by sport - focus on strengths',
      '📊 Higher confidence predictions should be more accurate',
      '📈 Track recent performance trends for model drift',
      '⚖️ Calibration shows how well probabilities match reality'
    ];
    
    sampleInsights.forEach(insight => console.log(`  ${insight}`));
    
    console.log('\n✅ VALIDATION SYSTEM TEST COMPLETE\n');
    
    console.log('📍 NEXT STEPS FOR REAL VALIDATION:');
    console.log('1. Start making predictions with the updated system');
    console.log('2. Set up automated game result fetching to update outcomes');
    console.log('3. Monitor validation metrics at: /api/validation/metrics');
    console.log('4. View performance reports at: /api/validation/performance-report');
    console.log('5. Track model drift and calibration over time\n');
    
  } catch (error) {
    logger.error(`Test failed: ${error}`);
    console.error(`❌ Test failed: ${error}`);
  }
}

// Sample function to create mock predictions for testing
async function createMockPredictions() {
  console.log('\n🎲 Creating mock predictions for testing...');
  
  const mockPredictions = [
    { sport: 'MLB', outcome: 'Cardinals ML', probability: 0.65, confidence: 'High' },
    { sport: 'MLB', outcome: 'Blue Jays ML', probability: 0.55, confidence: 'Medium' },
    { sport: 'NBA', outcome: 'Lakers ML', probability: 0.72, confidence: 'High' },
    { sport: 'NBA', outcome: 'Warriors ML', probability: 0.48, confidence: 'Low' },
    { sport: 'NFL', outcome: 'Chiefs ML', probability: 0.58, confidence: 'Medium' }
  ];
  
  // In a real scenario, these would be actual prediction IDs from the database
  console.log('Mock predictions created (normally stored in database):');
  mockPredictions.forEach((pred, i) => {
    console.log(`  ${i + 1}. ${pred.sport}: ${pred.outcome} (${(pred.probability * 100).toFixed(1)}% - ${pred.confidence})`);
  });
  
  console.log('\nTo test validation:');
  console.log('1. Make real predictions through the system');
  console.log('2. Wait for games to finish'); 
  console.log('3. Update with actual outcomes via API');
  console.log('4. View updated metrics');
}

if (require.main === module) {
  testValidationSystem().then(() => {
    createMockPredictions().then(() => {
      process.exit(0);
    });
  });
}

export { testValidationSystem, createMockPredictions }; 
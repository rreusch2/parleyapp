#!/bin/bash

# Test Orchestrator Integration Script
# This script tests the full integration between DeepSeek orchestrator and ML server

echo "🚀 Predictive Play Orchestrator Integration Test"
echo "=========================================="

# Check if ML server is running with improved error handling
echo "✅ Checking ML server health..."
ML_HEALTH_RAW=$(curl -s http://localhost:8001/health)
ML_SERVER_EXIT_CODE=$?

if [ $ML_SERVER_EXIT_CODE -eq 0 ] && [ -n "$ML_HEALTH_RAW" ]; then
    # Try to parse JSON, with fallback if it fails
    ML_STATUS=$(echo "$ML_HEALTH_RAW" | jq -r '.status' 2>/dev/null)
    ML_MODELS=$(echo "$ML_HEALTH_RAW" | jq -r '.models_loaded' 2>/dev/null)
    
    if [ "$ML_STATUS" != "null" ] && [ "$ML_STATUS" != "" ]; then
        echo "ML Server Status: $ML_STATUS"
        echo "Models Loaded: $ML_MODELS"
    else
        echo "ML Server Response (raw): $ML_HEALTH_RAW"
        echo "⚠️ ML Server responded but JSON parsing failed - may still work"
    fi
else
    echo "❌ ML Server is not running or not responding properly!"
    echo "Response: $ML_HEALTH_RAW"
    echo "Please start it with: cd python-services/sports-betting-api && python3 ml_prediction_server.py"
    exit 1
fi

# Test MLB moneyline prediction
echo ""
echo "🔍 Testing MLB moneyline prediction..."
curl -s -X POST http://localhost:8001/api/v2/predict/moneyline-real \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "MLB",
    "home_team": "Los Angeles Dodgers",
    "away_team": "San Francisco Giants"
  }' | jq '.'

# Test MLB spread prediction
echo ""
echo "🔍 Testing MLB spread prediction..."
curl -s -X POST http://localhost:8001/api/v2/predict/spread-real \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "MLB",
    "home_team": "New York Yankees",
    "away_team": "Boston Red Sox",
    "spread_line": -1.5
  }' | jq '.'

# Test MLB total prediction
echo ""
echo "🔍 Testing MLB total prediction..."
curl -s -X POST http://localhost:8001/api/v2/predict/total-real \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "MLB",
    "home_team": "Houston Astros",
    "away_team": "Texas Rangers",
    "total_line": 8.5
  }' | jq '.'

# Run orchestrator in test mode
echo ""
echo "🎯 Running orchestrator in test mode..."
echo "This will generate picks without saving to database..."
echo ""

cd backend
npx ts-node src/scripts/run-orchestrator.ts --test --max-picks=5

echo ""
echo "✅ Integration test complete!"
echo ""
echo "To run orchestrator in production mode (saves to DB):"
echo "cd backend && npx ts-node src/scripts/run-orchestrator.ts" 
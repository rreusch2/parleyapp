#!/bin/bash

# Master Integration Script
# Runs all three integration commands in sequence

echo "🚀 ParleyApp Complete Integration Setup"
echo "======================================"

# Change to project root
cd "$(dirname "$0")"

echo ""
echo "📊 Step 1: Setting up odds integration with player props..."
echo "========================================================="
cd backend
npm run setup-odds-integration

echo ""
echo "🧪 Step 2: Testing orchestrator integration..."
echo "============================================="
cd ..
bash test-orchestrator-integration.sh

echo ""
echo "🏥 Step 3: Running MLB injury scraper..."
echo "======================================"
cd backend
npx ts-node src/scripts/dailyInjuryUpdate.ts

echo ""
echo "✅ All integrations complete!"
echo "=============================="
echo ""
echo "🎯 Summary:"
echo "  • Fetched upcoming games + basic odds + player props"
echo "  • Tested ML prediction server integration"  
echo "  • Updated MLB injury reports from ESPN"
echo ""
echo "🚀 Ready to run your orchestrator!" 
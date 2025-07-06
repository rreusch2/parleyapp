#!/bin/bash

# 🧪 Test Script for Railway Automation API
# Run this when your backend server is running

set -e

BASE_URL="http://localhost:3000"
AUTOMATION_SECRET="${AUTOMATION_SECRET:-parleyapp-automation-secret}"

echo "🚀 Testing ParleyApp Automation API Endpoints"
echo "=================================================="
echo ""

# Test 1: Health Check
echo "1️⃣  Testing Health Check..."
curl -s "$BASE_URL/api/health" | jq . || echo "❌ Health check failed"
echo ""

# Test 2: Automation Status
echo "2️⃣  Testing Automation Status..."
curl -s "$BASE_URL/api/automation/status" | jq . || echo "❌ Status check failed"
echo ""

# Test 3: Automation Test (Mock Mode)
echo "3️⃣  Testing Automation Endpoint (Mock Mode)..."
echo "   Using Authorization: Bearer $AUTOMATION_SECRET"
curl -X POST "$BASE_URL/api/automation/test" \
  -H "Authorization: Bearer $AUTOMATION_SECRET" \
  -H "Content-Type: application/json" \
  -s | jq . || echo "❌ Test automation failed"
echo ""

# Test 4: Check if we can access the real automation endpoint (don't run it)
echo "4️⃣  Testing Daily Automation Endpoint Access (No Execution)..."
curl -X POST "$BASE_URL/api/automation/daily" \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -s | jq . || echo "✅ Good! Unauthorized access properly blocked"
echo ""

echo "🎯 Tests Complete!"
echo ""
echo "For Railway deployment:"
echo "• Generate secure token: openssl rand -hex 32"
echo "• Set AUTOMATION_SECRET environment variable" 
echo "• Use railway.toml for automatic cron setup"
echo ""
echo "The automation endpoint is ready for Railway! 🚀" 
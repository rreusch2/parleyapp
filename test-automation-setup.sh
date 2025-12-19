#!/bin/bash

# Test Script for Automation Setup
# Run this before deploying to verify everything works

set -e

echo "🧪 Testing ParleyApp Automation Setup"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    echo -e "${BLUE}🧪 Test $TESTS_RUN: $test_name${NC}"
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}   ❌ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Test 1: Check if scripts exist
echo -e "${YELLOW}📂 Testing File Existence${NC}"
run_test "daily-automation-complete.sh exists" "test -f daily-automation-complete.sh"
run_test "daily-automation-complete.sh is executable" "test -x daily-automation-complete.sh"
run_test "GitHub Actions workflow exists" "test -f .github/workflows/daily-predictions.yml"
run_test "Railway cron script exists" "test -f railway-cron.js"
run_test "Health check script exists" "test -f check-automation-health.sh"
echo ""

# Test 2: Check Python environment
echo -e "${YELLOW}🐍 Testing Python Environment${NC}"
run_test "Python is installed" "command -v python"
run_test "Python version >= 3.10" "python -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'"
run_test "supabase package installed" "python -c 'import supabase'"
run_test "openai package installed" "python -c 'import openai'"
run_test "requests package installed" "python -c 'import requests'"
run_test "httpx package installed" "python -c 'import httpx'"
echo ""

# Test 3: Check Node.js environment
echo -e "${YELLOW}📦 Testing Node.js Environment${NC}"
run_test "Node.js is installed" "command -v node"
run_test "Node.js version >= 18" "node -e 'process.exit(parseInt(process.version.slice(1)) >= 18 ? 0 : 1)'"
run_test "npm is installed" "command -v npm"
run_test "Backend node_modules exists" "test -d apps/backend/node_modules"
echo ""

# Test 4: Check environment variables
echo -e "${YELLOW}🔐 Testing Environment Variables${NC}"
if [ -f ".env" ]; then
    source .env
    run_test "SUPABASE_URL is set" "test ! -z '$SUPABASE_URL'"
    run_test "SUPABASE_SERVICE_ROLE_KEY is set" "test ! -z '$SUPABASE_SERVICE_ROLE_KEY'"
    run_test "OPENAI_API_KEY is set" "test ! -z '$OPENAI_API_KEY'"
    run_test "THEODDSAPI_KEY is set" "test ! -z '$THEODDSAPI_KEY'"
else
    echo -e "${RED}   ❌ .env file not found${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 4))
fi
echo ""

# Test 5: Check script files exist
echo -e "${YELLOW}📜 Testing Python Scripts${NC}"
run_test "teams_enhanced.py exists" "test -f teams_enhanced.py"
run_test "props_intelligent_v3.py exists" "test -f props_intelligent_v3.py"
run_test "statmuse_api_server.py exists" "test -f statmuse_api_server.py"
echo ""

# Test 6: Test script syntax
echo -e "${YELLOW}🔍 Testing Script Syntax${NC}"
run_test "daily-automation-complete.sh syntax" "bash -n daily-automation-complete.sh"
run_test "check-automation-health.sh syntax" "bash -n check-automation-health.sh"
run_test "teams_enhanced.py syntax" "python -m py_compile teams_enhanced.py"
run_test "props_intelligent_v3.py syntax" "python -m py_compile props_intelligent_v3.py"
echo ""

# Test 7: Test GitHub configuration
echo -e "${YELLOW}🤖 Testing GitHub Configuration${NC}"
run_test "Git repository initialized" "test -d .git"
run_test "GitHub Actions directory exists" "test -d .github/workflows"
run_test "Workflow file is valid YAML" "python -c 'import yaml; yaml.safe_load(open(\".github/workflows/daily-predictions.yml\"))'"
echo ""

# Test 8: Test Railway configuration
echo -e "${YELLOW}🚂 Testing Railway Configuration${NC}"
run_test "railway.toml exists" "test -f railway.toml"
run_test "railway-cron.js syntax valid" "node -c railway-cron.js"
run_test "node-cron package installed" "node -e 'require(\"node-cron\")'"
echo ""

# Test 9: Test database connection
echo -e "${YELLOW}🗄️  Testing Database Connection${NC}"
if [ ! -z "$SUPABASE_URL" ] && [ ! -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    run_test "Supabase URL is reachable" "curl -s -f -H 'apikey: $SUPABASE_SERVICE_ROLE_KEY' '$SUPABASE_URL/rest/v1/'"
else
    echo -e "${YELLOW}   ⏭️  Skipping (credentials not set)${NC}"
fi
echo ""

# Test 10: Test odds script
echo -e "${YELLOW}🎲 Testing Odds Script${NC}"
run_test "Odds script exists" "test -f apps/backend/src/scripts/runOddsV2.ts"
run_test "TypeScript is available" "command -v ts-node || command -v tsc"
echo ""

# Summary
echo ""
echo "======================================"
echo -e "${BLUE}📊 Test Summary${NC}"
echo "======================================"
echo -e "Total tests run: ${BLUE}$TESTS_RUN${NC}"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo ""
    echo "✅ Your automation setup is ready to deploy!"
    echo ""
    echo "Next steps:"
    echo "1. Follow QUICK_START_AUTOMATION.md to deploy"
    echo "2. Run a manual test first"
    echo "3. Monitor the first few scheduled runs"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Please fix the failed tests before deploying."
    echo "Check the error messages above for details."
    echo ""
    echo "Common fixes:"
    echo "- Install missing Python packages: pip install <package>"
    echo "- Install missing Node packages: npm install"
    echo "- Set missing environment variables in .env"
    echo "- Make scripts executable: chmod +x <script>"
    echo ""
    exit 1
fi

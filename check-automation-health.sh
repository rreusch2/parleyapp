#!/bin/bash

# Health Check Script for ParleyApp Automation
# Checks if all services are running properly

set -e

echo "🔍 ParleyApp Automation Health Check"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

# 1. Check if StatMuse API is running
echo "📡 Checking StatMuse API Server..."
if pgrep -f "statmuse_api_server.py" > /dev/null; then
    check_pass "StatMuse API server is running"
else
    check_warn "StatMuse API server is not running"
    echo "   Start with: python statmuse_api_server.py"
fi
echo ""

# 2. Check if required Python packages are installed
echo "🐍 Checking Python Dependencies..."
PYTHON_PACKAGES=("supabase" "openai" "requests" "httpx" "python-dotenv")
ALL_INSTALLED=true

for package in "${PYTHON_PACKAGES[@]}"; do
    if python -c "import $package" 2>/dev/null; then
        check_pass "$package is installed"
    else
        check_fail "$package is not installed"
        ALL_INSTALLED=false
    fi
done
echo ""

# 3. Check if Node.js dependencies are installed
echo "📦 Checking Node.js Dependencies..."
if [ -d "apps/backend/node_modules" ]; then
    check_pass "Backend node_modules exists"
else
    check_fail "Backend node_modules missing"
    echo "   Run: cd apps/backend && npm install"
fi
echo ""

# 4. Check if environment variables are set
echo "🔐 Checking Environment Variables..."
ENV_VARS=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "OPENAI_API_KEY" "THEODDSAPI_KEY")
source .env 2>/dev/null || true

for var in "${ENV_VARS[@]}"; do
    if [ ! -z "${!var}" ]; then
        check_pass "$var is set"
    else
        check_fail "$var is not set"
        echo "   Add to .env file"
    fi
done
echo ""

# 5. Check recent automation logs
echo "📝 Checking Recent Logs..."
if [ -d "logs" ]; then
    LATEST_LOG=$(ls -t logs/daily-automation-*.log 2>/dev/null | head -1)
    if [ ! -z "$LATEST_LOG" ]; then
        check_pass "Found recent log: $LATEST_LOG"
        
        # Check for errors in latest log
        if grep -q "ERROR" "$LATEST_LOG" 2>/dev/null; then
            check_warn "Errors found in latest log"
            echo "   Last 5 errors:"
            grep "ERROR" "$LATEST_LOG" | tail -5 | sed 's/^/   /'
        else
            check_pass "No errors in latest log"
        fi
    else
        check_warn "No automation logs found"
    fi
else
    check_warn "Logs directory does not exist"
fi
echo ""

# 6. Check database connectivity
echo "🗄️  Checking Supabase Connection..."
if [ ! -z "$SUPABASE_URL" ] && [ ! -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    # Try to ping Supabase
    if curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" "${SUPABASE_URL}/rest/v1/" > /dev/null; then
        check_pass "Supabase connection successful"
    else
        check_fail "Cannot connect to Supabase"
    fi
else
    check_warn "Supabase credentials not set, skipping test"
fi
echo ""

# 7. Check GitHub Actions status (if git repo)
echo "🤖 Checking GitHub Actions..."
if [ -d ".git" ]; then
    if [ -f ".github/workflows/daily-predictions.yml" ]; then
        check_pass "GitHub Actions workflow file exists"
    else
        check_warn "GitHub Actions workflow file not found"
    fi
else
    check_warn "Not a git repository"
fi
echo ""

# 8. Check Railway configuration
echo "🚂 Checking Railway Configuration..."
if [ -f "railway.toml" ]; then
    check_pass "railway.toml exists"
    if [ -f "railway-cron.js" ]; then
        check_pass "railway-cron.js exists"
    else
        check_warn "railway-cron.js not found"
    fi
else
    check_warn "railway.toml not found"
fi
echo ""

# 9. Test script syntax
echo "📜 Checking Script Syntax..."
if [ -f "daily-automation-complete.sh" ]; then
    if bash -n daily-automation-complete.sh 2>/dev/null; then
        check_pass "daily-automation-complete.sh syntax is valid"
    else
        check_fail "daily-automation-complete.sh has syntax errors"
    fi
else
    check_fail "daily-automation-complete.sh not found"
fi
echo ""

# Summary
echo "======================================"
echo "✨ Health Check Complete"
echo ""
echo "📊 Next Steps:"
echo "   1. Fix any FAIL items above"
echo "   2. Review WARN items if applicable"
echo "   3. Test with: ./daily-automation-complete.sh"
echo "   4. Monitor: GitHub Actions or Railway logs"
echo ""

#!/bin/bash

# ParleyApp Daily Automation Script
# Runs all prediction pipelines in the correct order
# Time: 10:30 PM daily for next day's games

set -e  # Exit on any error

# Configuration
PROJECT_ROOT="/home/reid/Desktop/parleyapp"
BACKEND_DIR="$PROJECT_ROOT/backend"
LOG_DIR="$PROJECT_ROOT/logs"
DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/daily-automation-$DATE.log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling function
handle_error() {
    log "❌ ERROR: $1"
    log "❌ Daily automation failed at step: $2"
    exit 1
}

log "🚀 Starting ParleyApp Daily Automation for $(date -d tomorrow '+%Y-%m-%d')"
log "📝 Log file: $LOG_FILE"

# Change to project root
cd "$PROJECT_ROOT"

# Ensure correct shell environment for cron (Node via nvm/asdf/volta)
# We tolerate failures in this block to avoid stopping the pipeline
{
    # Load common user profiles that may initialize version managers
    [ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc"
    [ -f "$HOME/.profile" ] && . "$HOME/.profile"

    # Prefer NVM if available
    if [ -d "$HOME/.nvm" ]; then
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        [ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"
        if command -v nvm >/dev/null 2>&1; then
            nvm install 18 >/dev/null 2>&1 || true
            nvm use 18 >/dev/null 2>&1 || true
        fi
    fi

    # Fallback to asdf if present
    if command -v asdf >/dev/null 2>&1; then
        asdf shell nodejs 18.20.3 >/dev/null 2>&1 || true
    fi

    # Fallback to Volta if present
    if command -v volta >/dev/null 2>&1; then
        volta install node@18 >/dev/null 2>&1 || true
        volta pin node@18 >/dev/null 2>&1 || true
    fi

    NODE_VER=$(node -v 2>/dev/null || true)
    NPM_VER=$(npm -v 2>/dev/null || true)
    NODE_PATH_BIN=$(command -v node 2>/dev/null || true)
    NPM_PATH_BIN=$(command -v npm 2>/dev/null || true)
    log "🧰 Node runtime: ${NODE_PATH_BIN:-not found} ${NODE_VER:+($NODE_VER)}"
    log "🧰 NPM binary: ${NPM_PATH_BIN:-not found} ${NPM_VER:+($NPM_VER)}"

    # Optional diagnostics
    if command -v ts-node >/dev/null 2>&1; then
        TS_NODE_VER=$(ts-node --version 2>/dev/null || true)
        log "🧰 ts-node: ${TS_NODE_VER:-not found}"
    fi
    if command -v tsc >/dev/null 2>&1; then
        TSC_VER=$(tsc -v 2>/dev/null || true)
        log "🧰 tsc: ${TSC_VER:-not found}"
    fi

    # Enforce Node >= 18 for backend per package.json engines
    if [ -n "$NODE_VER" ]; then
        NODE_MAJOR=$(echo "$NODE_VER" | sed -E 's/^v([0-9]+).*$/\1/')
        if [ "$NODE_MAJOR" -lt 18 ]; then
            log "⚠️  Detected Node $NODE_VER, attempting to switch to Node 18 via nvm/asdf/volta..."
            if command -v nvm >/dev/null 2>&1; then nvm use 18 >/dev/null 2>&1 || true; fi
            if command -v asdf >/dev/null 2>&1; then asdf shell nodejs 18.20.3 >/dev/null 2>&1 || true; fi
            if command -v volta >/dev/null 2>&1; then volta pin node@18 >/dev/null 2>&1 || true; fi
            NODE_VER=$(node -v 2>/dev/null || true)
            log "🔁 After switch, Node: ${NODE_VER:-unavailable}"
        fi
    fi
} || true

# Step 1: Check/Start StatMuse API Server
log "📡 Step 1/6: Checking StatMuse API Server..."

# Check if StatMuse server is running (look for process)
if ! pgrep -f "statmuse_api_server.py" > /dev/null; then
    log "⚠️  StatMuse API server not running, starting it..."
    
    # Start StatMuse API server in background
    nohup python3 statmuse_api_server.py > "$LOG_DIR/statmuse-server-$DATE.log" 2>&1 &
    
    # Give it time to start
    sleep 10
    
    # Verify it started
    if pgrep -f "statmuse_api_server.py" > /dev/null; then
        log "✅ StatMuse API server started successfully"
    else
        handle_error "Failed to start StatMuse API server" "StatMuse startup"
    fi
else
    log "✅ StatMuse API server already running"
fi

# Step 2: Fetch Odds and Games Data
log "🎲 Step 2/6: Fetching odds and games data..."

cd "$BACKEND_DIR"

# Try multiple approaches to run the odds script
if npm run odds >> "$LOG_FILE" 2>&1; then
    log "✅ Odds integration completed successfully"
elif npx ts-node --transpile-only src/scripts/setupOddsIntegration.ts >> "$LOG_FILE" 2>&1; then
    log "✅ Odds integration completed successfully (fallback method)"
elif node -r ts-node/register src/scripts/setupOddsIntegration.ts >> "$LOG_FILE" 2>&1; then
    log "✅ Odds integration completed successfully (alternative method)"
else
    log "⚠️ All TypeScript methods failed, trying to build and run compiled version..."
    if npm run build >> "$LOG_FILE" 2>&1 && node dist/scripts/setupOddsIntegration.js >> "$LOG_FILE" 2>&1; then
        log "✅ Odds integration completed successfully (compiled version)"
    else
        handle_error "Odds integration failed with all methods" "Odds fetching"
    fi
fi

cd "$PROJECT_ROOT"

# Step 3: Generate Personalized Enhanced Insights
log "💡 Step 3/6: Generating personalized enhanced insights..."

if python3 enhanced_insights.py --tomorrow >> "$LOG_FILE" 2>&1; then
    log "✅ Personalized enhanced insights completed successfully"
else
    handle_error "Personalized enhanced insights failed" "Insights generation"
fi

# Step 4: Generate Enhanced Props Predictions
log "🏈 Step 4/6: Generating enhanced props predictions..."

if python3 props_enhanced.py --tomorrow --picks 25 >> "$LOG_FILE" 2>&1; then
    log "✅ Enhanced props predictions completed successfully (25 picks for Elite tier support)"
else
    handle_error "Enhanced props predictions failed" "Props generation"
fi

# Step 5: Generate Enhanced Teams Predictions  
log "🏆 Step 5/6: Generating enhanced teams predictions..."

if python3 teams_enhanced.py --tomorrow --picks 25 >> "$LOG_FILE" 2>&1; then
    log "✅ Enhanced teams predictions completed successfully (25 picks for Elite tier support)"  
else
    handle_error "Enhanced teams predictions failed" "Teams generation"
fi

# Step 6: Generate Daily Trends
log "📈 Step 6/6: Generating daily trends..."

cd "$PROJECT_ROOT/python-scripts-service"
if python3 trendsnew.py >> "$LOG_FILE" 2>&1; then
    log "✅ Daily trends completed successfully"
else
    handle_error "Daily trends failed" "Trends generation"
fi

cd "$PROJECT_ROOT"

# Success summary
log ""
log "🎉 === ParleyApp Daily Automation Completed Successfully ==="
log "📊 Check your Supabase ai_predictions table for new picks"
log "📝 Full log: $LOG_FILE"
log "⏰ Next run: $(date -d 'tomorrow 22:30' '+%Y-%m-%d %H:%M:%S')"
log ""

# Optional: Clean up old logs (keep last 7 days)
find "$LOG_DIR" -name "daily-automation-*.log" -mtime +7 -delete

exit 0
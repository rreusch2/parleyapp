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
if npm run odds >> "$LOG_FILE" 2>&1; then
    log "✅ Odds integration completed successfully"
else
    handle_error "Odds integration failed" "Odds fetching"
fi

cd "$PROJECT_ROOT"

# Step 3: Generate Enhanced Props Predictions
log "🏈 Step 3/6: Generating enhanced props predictions..."

if python3 props_enhanced.py --tomorrow >> "$LOG_FILE" 2>&1; then
    log "✅ Enhanced props predictions completed successfully"
else
    handle_error "Enhanced props predictions failed" "Props generation"
fi

# Step 4: Generate Enhanced Teams Predictions  
log "🏆 Step 4/6: Generating enhanced teams predictions..."

if python3 teams_enhanced.py --tomorrow >> "$LOG_FILE" 2>&1; then
    log "✅ Enhanced teams predictions completed successfully"  
else
    handle_error "Enhanced teams predictions failed" "Teams generation"
fi

# Step 5: Generate Enhanced Insights
log "💡 Step 5/6: Generating enhanced insights..."

if python3 enhanced_insights.py --tomorrow >> "$LOG_FILE" 2>&1; then
    log "✅ Enhanced insights completed successfully"
else
    handle_error "Enhanced insights failed" "Insights generation"
fi

# Step 6: Run Daily Injury Update
log "🏥 Step 6/6: Running daily injury update..."

cd "$BACKEND_DIR"
if npx ts-node src/scripts/dailyInjuryUpdate.ts >> "$LOG_FILE" 2>&1; then
    log "✅ Daily injury update completed successfully"
else
    handle_error "Daily injury update failed" "Injury update"
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
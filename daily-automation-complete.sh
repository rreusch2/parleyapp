#!/bin/bash

# ParleyApp Complete Daily Automation
# Runs all prediction pipelines for all sports
# Time: 10:00 PM daily for next day's games

set -e  # Exit on any error

# Configuration
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
BACKEND_DIR="$PROJECT_ROOT/apps/backend"
LOG_DIR="$PROJECT_ROOT/logs"
DATE=$(date +%Y-%m-%d)
LOG_FILE="$LOG_DIR/daily-automation-$DATE.log"

# Active sports list
ACTIVE_SPORTS=("NBA" "NFL" "CFB" "NHL" "MLB" "WNBA")

# Create logs directory
mkdir -p "$LOG_DIR"

# Logging functions
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1" | tee -a "$LOG_FILE"
}

# Error handling
handle_error() {
    log_error "$1"
    log_error "Failed at step: $2"
    # Don't exit - continue with other sports
}

log "🚀 Starting ParleyApp Daily Automation"
log "📅 Target date: $(date -d tomorrow '+%Y-%m-%d' 2>/dev/null || date -v+1d '+%Y-%m-%d')"
log "📝 Log file: $LOG_FILE"

# Change to project root
cd "$PROJECT_ROOT"

# ============================================
# STEP 1: Start StatMuse API Server
# ============================================
log "📡 Step 1/4: Checking StatMuse API Server..."

# Check if StatMuse server is running
if ! pgrep -f "statmuse_api_server.py" > /dev/null; then
    log "⚠️  StatMuse API server not running, starting it..."
    
    # Start StatMuse API server in background
    nohup python statmuse_api_server.py > "$LOG_DIR/statmuse-server-$DATE.log" 2>&1 &
    STATMUSE_PID=$!
    
    # Give it time to start
    sleep 15
    
    # Verify it started
    if pgrep -f "statmuse_api_server.py" > /dev/null; then
        log_success "StatMuse API server started (PID: $STATMUSE_PID)"
    else
        handle_error "Failed to start StatMuse API server" "StatMuse startup"
        log "⚠️  Continuing without StatMuse - some features may be limited"
    fi
else
    log_success "StatMuse API server already running"
fi

# ============================================
# STEP 2: Fetch Odds and Games Data (v2)
# ============================================
log "🎲 Step 2/4: Fetching odds and games data (odds:v2)..."

cd "$BACKEND_DIR"

if npm run odds:v2 >> "$LOG_FILE" 2>&1; then
    log_success "Odds v2 integration completed successfully"
else
    handle_error "Odds v2 integration failed" "Odds fetching"
    log "⚠️  Continuing - will use existing odds data if available"
fi

cd "$PROJECT_ROOT"

# ============================================
# STEP 3: Generate Team Picks for All Sports
# ============================================
log "🏆 Step 3/4: Generating team picks for all sports..."

for SPORT in "${ACTIVE_SPORTS[@]}"; do
    log "🏅 Processing team picks for $SPORT..."
    
    if python teams_enhanced.py --tomorrow --sport "$SPORT" >> "$LOG_FILE" 2>&1; then
        log_success "Team picks completed for $SPORT"
    else
        handle_error "Team picks failed for $SPORT" "Teams $SPORT"
    fi
done

log_success "All team picks processing complete"

# ============================================
# STEP 4: Generate Prop Picks for All Sports
# ============================================
log "🎯 Step 4/4: Generating prop picks for all sports..."

for SPORT in "${ACTIVE_SPORTS[@]}"; do
    log "📊 Processing prop picks for $SPORT..."
    
    if python props_intelligent_v3.py --sport "$SPORT" --tomorrow >> "$LOG_FILE" 2>&1; then
        log_success "Prop picks completed for $SPORT"
    else
        handle_error "Prop picks failed for $SPORT" "Props $SPORT"
    fi
done

log_success "All prop picks processing complete"

# ============================================
# Summary
# ============================================
log ""
log "🎉 =============================================="
log "🎉 ParleyApp Daily Automation Completed"
log "🎉 =============================================="
log "📊 Check your Supabase tables for new predictions"
log "📝 Full log: $LOG_FILE"
log "⏰ Next run: Tomorrow at 10:00 PM"
log ""

# Clean up old logs (keep last 14 days)
find "$LOG_DIR" -name "daily-automation-*.log" -mtime +14 -delete 2>/dev/null || true

exit 0

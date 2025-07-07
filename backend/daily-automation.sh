#!/bin/bash

# ParleyApp Daily MLB Predictions Automation
# Runs all daily scripts in the correct dependency order
# Author: ParleyApp AI System
# Last Updated: 2025-07-06

set -e  # Exit on any error

# Configuration
PROJECT_ROOT="/home/reid/Desktop/parleyapp"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/daily-automation-$(date +%Y%m%d).log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling function
handle_error() {
    log "ERROR: Script failed at step: $1"
    log "Check the logs above for details"
    exit 1
}

log "=== ParleyApp Daily Automation Started ==="
log "Project Root: $PROJECT_ROOT"

# Step 1: Daily Game and Odds Fetch (MUST RUN FIRST - populates base data)
log "Step 1/4: Fetching daily games and odds..."
cd "$PROJECT_ROOT/backend"
if npx ts-node src/scripts/setupOddsIntegration.ts >> "$LOG_FILE" 2>&1; then
    log "✅ Daily odds integration completed successfully"
else
    handle_error "Odds integration (setupOddsIntegration.ts)"
fi

# Step 2: Daily Insights (depends on fresh game/odds data)
log "Step 2/4: Running Daily Insights..."
cd "$PROJECT_ROOT"
if python insights.py >> "$LOG_FILE" 2>&1; then
    log "✅ Daily insights completed successfully"
else
    handle_error "Daily insights (insights.py)"
fi

# Step 3: Generate 10 Team Picks
log "Step 3/4: Generating team predictions..."
cd "$PROJECT_ROOT/backend"
if npx ts-node src/scripts/run-orchestrator.ts >> "$LOG_FILE" 2>&1; then
    log "✅ Team predictions completed successfully"
else
    handle_error "Team predictions (run-orchestrator.ts)"
fi

# Step 4: Generate 10 Player Props Picks
log "Step 4/4: Generating player props predictions..."
cd "$PROJECT_ROOT"
if python props.py >> "$LOG_FILE" 2>&1; then
    log "✅ Player props predictions completed successfully"
else
    handle_error "Player props predictions (props.py)"
fi

log "=== ParleyApp Daily Automation Completed Successfully ==="
log "All 4 prediction pipelines executed successfully"
log "Check Supabase ai_predictions table for today's picks"

# Optional: Clean up old log files (keep last 30 days)
find "$LOG_DIR" -name "daily-automation-*.log" -mtime +30 -delete 2>/dev/null || true

log "Daily automation script finished at $(date)"

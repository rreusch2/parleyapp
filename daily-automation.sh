#!/bin/bash
# ParleyApp Daily Automation Script
# This script automates the daily workflow for the ParleyApp sports betting application

# Exit on error
set -e

# Set up logging
LOG_DIR="/home/reid/Desktop/parleyapp/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily-automation-$(date +%Y-%m-%d).log"

# Function to log messages
log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "========================================"
log "🚀 Starting ParleyApp Daily Automation"
log "========================================"

# Set working directory to the project root
cd /home/reid/Desktop/parleyapp

# Function to check if a process is running
is_process_running() {
  local process_name="$1"
  pgrep -f "$process_name" > /dev/null
}

# Step 1: Check if statmuse API server is running, start it if not
log "🔍 Checking if StatMuse API server is running..."
if is_process_running "statmuse_api_server.py"; then
  log "✅ StatMuse API server is already running"
else
  log "⚙️ Starting StatMuse API server in background"
  nohup python3 statmuse_api_server.py > "$LOG_DIR/statmuse-server.log" 2>&1 &
  
  # Wait a moment for the server to start
  sleep 5
  
  # Verify that it started successfully
  if is_process_running "statmuse_api_server.py"; then
    log "✅ StatMuse API server started successfully"
  else
    log "❌ Failed to start StatMuse API server"
    exit 1
  fi
fi

# Step 2: Run the setupOddsIntegration.ts script
log "⚙️ Setting up odds integration..."
cd backend
npx ts-node src/scripts/setupOddsIntegration.ts >> "$LOG_DIR/odds-integration.log" 2>&1
if [ $? -ne 0 ]; then
  log "❌ Failed to run setupOddsIntegration.ts"
  exit 1
fi
log "✅ Odds integration completed successfully"
cd ..

# Step 3: Run teams.py, props.py and plockinsights.py simultaneously
log "⚙️ Running AI predictions and insights generation..."

# Create a temporary directory for process IDs
TMP_DIR=$(mktemp -d)

# Function to run a command in the background and save its PID
run_background() {
  local cmd="$1"
  local name="$2"
  local log_file="$3"
  
  log "⚙️ Starting $name process..."
  $cmd > "$log_file" 2>&1 &
  local pid=$!
  echo $pid > "$TMP_DIR/$name.pid"
  log "✅ $name process started with PID $pid"
}

# Run teams.py in background
run_background "python3 teams.py" "teams" "$LOG_DIR/teams-py.log"

# Run props.py in background
run_background "python3 props.py" "props" "$LOG_DIR/props-py.log"

# Run plockinsights.py in background
run_background "python3 plockinsights.py" "plockinsights" "$LOG_DIR/plockinsights.log"

# Step 4: Run the injury report scraper
log "⚙️ Running injury report scraper..."
cd backend
npx ts-node src/scripts/dailyInjuryUpdate.ts >> "$LOG_DIR/injury-update.log" 2>&1
if [ $? -ne 0 ]; then
  log "⚠️ Warning: Injury report scraping failed, but continuing with other processes"
fi
log "✅ Injury report scraping completed"
cd ..

# Wait for background processes to finish
log "⏳ Waiting for AI prediction and insights processes to complete..."

wait_for_process() {
  local name="$1"
  local timeout=3600  # 1 hour timeout
  local counter=0
  local interval=10   # Check every 10 seconds
  
  if [ ! -f "$TMP_DIR/$name.pid" ]; then
    log "❌ PID file for $name not found"
    return 1
  fi
  
  local pid=$(cat "$TMP_DIR/$name.pid")
  
  while kill -0 $pid 2>/dev/null; do
    sleep $interval
    counter=$((counter + interval))
    
    if [ $counter -ge $timeout ]; then
      log "⚠️ $name process (PID $pid) timed out after 1 hour"
      kill $pid 2>/dev/null || true
      return 1
    fi
  done
  
  # Check exit status (if possible)
  wait $pid 2>/dev/null || {
    log "⚠️ $name process (PID $pid) exited with error"
    return 1
  }
  
  log "✅ $name process completed successfully"
  return 0
}

wait_for_process "teams"
teams_status=$?

wait_for_process "props"
props_status=$?

wait_for_process "plockinsights"
insights_status=$?

# Clean up
rm -rf "$TMP_DIR"

# Summary
log ""
log "========================================"
log "📋 Daily Automation Summary"
log "========================================"
log "📊 Odds Integration: ✅ Complete"
log "🏈 Team Predictions: $([ $teams_status -eq 0 ] && echo "✅ Complete" || echo "⚠️ Completed with issues")"
log "🎲 Player Props Predictions: $([ $props_status -eq 0 ] && echo "✅ Complete" || echo "⚠️ Completed with issues")"
log "🔮 Professor Lock Insights: $([ $insights_status -eq 0 ] && echo "✅ Complete" || echo "⚠️ Completed with issues")"
log "🏥 Injury Reports: ✅ Complete"

if [ $teams_status -eq 0 ] && [ $props_status -eq 0 ] && [ $insights_status -eq 0 ]; then
  log "✅ All processes completed successfully!"
  exit_code=0
else
  log "⚠️ Some processes completed with issues, check logs for details."
  exit_code=1
fi

log "📝 Logs available in: $LOG_DIR"
log "========================================"

exit $exit_code

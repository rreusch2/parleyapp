#!/bin/bash

#######################################################################
# Daily Player Props Automation Script
# Runs the intelligent AI agent to generate player prop predictions
#######################################################################

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/home/reid/Desktop/parleyapp/logs"
DATE_STAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/player_props_$DATE_STAMP.log"

# Number of picks to generate
NUM_PICKS=15

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Start logging
echo "========================================" | tee -a "$LOG_FILE"
echo "Player Props Agent Automation" | tee -a "$LOG_FILE"
echo "Started: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Navigate to agent directory
cd "$SCRIPT_DIR" || exit 1

# Activate virtual environment
if [ -f ".venv/bin/activate" ]; then
    echo "Activating virtual environment..." | tee -a "$LOG_FILE"
    source .venv/bin/activate
else
    echo "ERROR: Virtual environment not found at .venv" | tee -a "$LOG_FILE"
    echo "Please run: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" | tee -a "$LOG_FILE"
    exit 1
fi

# Check if StatMuse server is running (optional but recommended)
echo "Checking StatMuse server..." | tee -a "$LOG_FILE"
STATMUSE_URL="${STATMUSE_API_URL:-http://127.0.0.1:5001}"
if curl -s -o /dev/null -w "%{http_code}" "$STATMUSE_URL/health" | grep -q "200"; then
    echo "✓ StatMuse server is running" | tee -a "$LOG_FILE"
else
    echo "⚠ WARNING: StatMuse server may not be running" | tee -a "$LOG_FILE"
    echo "  Agent will proceed but StatMuse queries may fail" | tee -a "$LOG_FILE"
fi

# Run the player props specialist agent
echo "" | tee -a "$LOG_FILE"
echo "Starting Player Props Specialist Agent..." | tee -a "$LOG_FILE"
echo "Target: Tomorrow's games, $NUM_PICKS picks" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

python player_props_specialist.py --tomorrow --picks "$NUM_PICKS" 2>&1 | tee -a "$LOG_FILE"

# Capture exit code
EXIT_CODE=${PIPESTATUS[0]}

# Log completion
echo "" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ SUCCESS: Agent completed successfully" | tee -a "$LOG_FILE"
else
    echo "❌ ERROR: Agent failed with exit code $EXIT_CODE" | tee -a "$LOG_FILE"
fi
echo "Finished: $(date)" | tee -a "$LOG_FILE"
echo "Log saved to: $LOG_FILE" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Keep only last 30 days of logs
find "$LOG_DIR" -name "player_props_*.log" -mtime +30 -delete 2>/dev/null

exit $EXIT_CODE

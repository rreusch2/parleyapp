#!/bin/bash
# Script to update player recent stats for all active sports
# Run this script via cron daily or hourly

# Change to project root directory
cd "$(dirname "$0")/.." || exit 1

# Set up log file
LOG_DIR="./logs/player-stats"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/player-stats-$(date +%Y-%m-%d_%H%M%S).log"

# Log start
echo "[$(date)] 🚀 Starting player stats update" | tee -a "$LOG_FILE"

# Run the player stats ingestion script
echo "[$(date)] Running player stats ingestion..." | tee -a "$LOG_FILE"
node backend/dist/scripts/playerStatsIngestion.js 2>&1 | tee -a "$LOG_FILE"

# Check result
if [ $? -eq 0 ]; then
  echo "[$(date)] ✅ Player stats update completed successfully" | tee -a "$LOG_FILE"
else
  echo "[$(date)] ❌ Player stats update failed" | tee -a "$LOG_FILE"
  exit 1
fi

# Cleanup old logs (keep last 7 days)
find "$LOG_DIR" -name "player-stats-*.log" -type f -mtime +7 -delete

exit 0

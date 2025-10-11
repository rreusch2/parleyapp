#!/bin/bash
#
# Automated Bet Result Checker - Runs every hour to check completed games
# Add to crontab: 0 * * * * /home/reid/Desktop/parleyapp/check-results-cron.sh
#

# Configuration
PROJECT_DIR="/home/reid/Desktop/parleyapp"
PYTHON_CMD="python3"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/bet_results_$(date +%Y%m%d).log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Activate virtual environment if you have one
# source "$PROJECT_DIR/venv/bin/activate"

echo "========================================" >> "$LOG_FILE"
echo "Bet Result Check: $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Run the checker for last 6 hours (catches games that just finished)
cd "$PROJECT_DIR" || exit 1
$PYTHON_CMD check_bet_results.py --hours 6 >> "$LOG_FILE" 2>&1

# Check exit status
if [ $? -eq 0 ]; then
    echo "✅ Result check completed successfully" >> "$LOG_FILE"
else
    echo "❌ Result check failed with error code $?" >> "$LOG_FILE"
fi

echo "" >> "$LOG_FILE"

# Clean up old logs (keep last 30 days)
find "$LOG_DIR" -name "bet_results_*.log" -mtime +30 -delete

exit 0

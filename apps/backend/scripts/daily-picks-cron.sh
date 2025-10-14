#!/bin/bash

# Daily ParleyApp Picks Generation Script
# Run this via cron job daily at 8 AM
# Uses the orchestrator to generate 20 picks (10 team + 10 player props)

LOG_FILE="/home/reid/Desktop/parleyapp/backend/logs/daily-picks-$(date +%Y-%m-%d).log"
BACKEND_DIR="/home/reid/Desktop/parleyapp/backend"

echo "$(date): Starting daily picks generation with orchestrator..." >> "$LOG_FILE"

# Change to backend directory
cd "$BACKEND_DIR" || {
    echo "$(date): ❌ Failed to change to backend directory" >> "$LOG_FILE"
    exit 1
}

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs) 2>/dev/null || true
fi

# Run the orchestrator to generate daily picks
npx ts-node src/scripts/run-orchestrator.ts >> "$LOG_FILE" 2>&1

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo "$(date): ✅ Daily picks generated successfully" >> "$LOG_FILE"
    echo "$(date): 📊 Generated 20 picks (10 team + 10 player props)" >> "$LOG_FILE"
    echo "$(date): 📱 Push notifications sent to users" >> "$LOG_FILE"
else
    echo "$(date): ❌ Failed to generate daily picks (exit code $exit_code)" >> "$LOG_FILE"
    
    # Send notification (optional - could add email/slack notification here)
    echo "Daily picks generation failed" | logger -t parleyapp-cron
fi

echo "$(date): Daily picks generation completed" >> "$LOG_FILE"
echo "---" >> "$LOG_FILE" 
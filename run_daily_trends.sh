#!/bin/bash

# Daily Trends Generator Cron Script
# Run daily at 06:00 ET to generate fresh trends

# Set up logging
LOG_DIR="/home/reid/Desktop/parleyapp/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/daily_trends_$(date +%Y%m%d).log"

# Change to script directory
cd /home/reid/Desktop/parleyapp

echo "$(date): Starting Daily Trends Generation" >> "$LOG_FILE"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "$(date): Activated virtual environment" >> "$LOG_FILE"
fi

# Run the daily trends generator
python3 daily_trends_generator.py --sport MLB >> "$LOG_FILE" 2>&1

# Check exit status
if [ $? -eq 0 ]; then
    echo "$(date): Daily trends generation completed successfully" >> "$LOG_FILE"
else
    echo "$(date): Daily trends generation failed with exit code $?" >> "$LOG_FILE"
fi

# Clean up old log files (keep last 7 days)
find "$LOG_DIR" -name "daily_trends_*.log" -mtime +7 -delete

echo "$(date): Script finished" >> "$LOG_FILE"

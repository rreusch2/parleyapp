#!/bin/bash
# Script to install crontab entries for player stats updates

# Get absolute path to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Create temporary crontab file
TEMP_CRONTAB=$(mktemp)

# Export current crontab
crontab -l > "$TEMP_CRONTAB" 2>/dev/null || echo "# New crontab" > "$TEMP_CRONTAB"

# Check if our entry already exists
if grep -q "update-player-stats.sh" "$TEMP_CRONTAB"; then
  echo "⚠️ Player stats cron job already exists. Skipping."
else
  # Add our cron job - runs daily at 6 AM and 6 PM
  echo "# ParleyApp - Update player stats twice daily (6 AM and 6 PM)" >> "$TEMP_CRONTAB"
  echo "0 6,18 * * * cd $PROJECT_ROOT && $PROJECT_ROOT/scripts/update-player-stats.sh" >> "$TEMP_CRONTAB"
  
  # Install the new crontab
  crontab "$TEMP_CRONTAB"
  echo "✅ Player stats cron job installed successfully!"
fi

# Clean up
rm "$TEMP_CRONTAB"

echo "Current crontab:"
crontab -l

#!/bin/bash
"""
Setup Cron Jobs for ParleyApp Daily Automation
This script sets up automated daily picks generation
"""

echo "🏀 ParleyApp Daily Automation Setup"
echo "================================="

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOMATION_SCRIPT="$SCRIPT_DIR/daily_automation.py"

echo "📍 Script location: $AUTOMATION_SCRIPT"

# Make the automation script executable
chmod +x "$AUTOMATION_SCRIPT"

echo "⏰ Setting up cron jobs..."

# Create a temporary cron file
TEMP_CRON_FILE="/tmp/parleyapp_cron"

# Get existing cron jobs (if any)
crontab -l > "$TEMP_CRON_FILE" 2>/dev/null || echo "" > "$TEMP_CRON_FILE"

# Add ParleyApp automation jobs
cat << EOF >> "$TEMP_CRON_FILE"

# ParleyApp Daily Automation Jobs
# Daily picks generation at 9:00 AM
0 9 * * * cd $SCRIPT_DIR && python3 daily_automation.py >> daily_automation.log 2>&1

# Weekly model retraining on Sundays at 2:00 AM
0 2 * * 0 cd $SCRIPT_DIR && python3 -c "import requests; requests.post('http://localhost:5001/api/models/retrain')" >> weekly_retrain.log 2>&1

# Health check every 6 hours
0 */6 * * * curl -s http://localhost:5001/health > /dev/null || echo "$(date): Python service down" >> service_health.log

EOF

# Install the new cron jobs
crontab "$TEMP_CRON_FILE"

# Clean up
rm "$TEMP_CRON_FILE"

echo "✅ Cron jobs installed successfully!"
echo ""
echo "📋 Scheduled Jobs:"
echo "• Daily Analysis: 9:00 AM every day"
echo "• Model Retraining: 2:00 AM every Sunday"
echo "• Health Checks: Every 6 hours"
echo ""
echo "📂 Log Files:"
echo "• Daily automation: $SCRIPT_DIR/daily_automation.log"
echo "• Weekly retraining: $SCRIPT_DIR/weekly_retrain.log"
echo "• Service health: $SCRIPT_DIR/service_health.log"
echo ""
echo "🔧 To view current cron jobs: crontab -l"
echo "🗑️ To remove cron jobs: crontab -r"
echo ""
echo "🚀 ParleyApp automation is now active!" 
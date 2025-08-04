#!/bin/bash

# Setup script for ParleyApp Daily Automation
# This script sets up the cron job and makes everything executable

set -e

PROJECT_ROOT="/home/reid/Desktop/parleyapp"
SCRIPT_NAME="daily-automation-new.sh"
CRON_TIME="30 22 * * *"  # 10:30 PM daily

echo "🔧 Setting up ParleyApp Daily Automation..."

# Change to project directory
cd "$PROJECT_ROOT"

# Make the automation script executable
chmod +x "$SCRIPT_NAME"
echo "✅ Made $SCRIPT_NAME executable"

# Create logs directory
mkdir -p logs
echo "✅ Created logs directory"

# Backup current crontab
crontab -l > crontab-backup-$(date +%Y%m%d-%H%M%S).txt 2>/dev/null || echo "No existing crontab to backup"

# Create the cron job entry
CRON_JOB="$CRON_TIME cd $PROJECT_ROOT && ./$SCRIPT_NAME"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$SCRIPT_NAME"; then
    echo "⚠️  Cron job already exists. Removing old entry..."
    crontab -l 2>/dev/null | grep -v "$SCRIPT_NAME" | crontab -
fi

# Add the new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Added cron job: $CRON_JOB"

# Test the script (dry run)
echo "🧪 Testing automation script..."
if ./"$SCRIPT_NAME"; then
    echo "✅ Automation script test completed"
else
    echo "❌ Automation script test failed - check the output above"
    exit 1
fi

# Display final status
echo ""
echo "🎉 Daily Automation Setup Complete!"
echo ""
echo "📅 Schedule: Every day at 10:30 PM"
echo "📝 Script: $PROJECT_ROOT/$SCRIPT_NAME"
echo "📂 Logs: $PROJECT_ROOT/logs/"
echo ""
echo "🔍 View current cron jobs:"
echo "   crontab -l"
echo ""
echo "📊 Monitor automation:"
echo "   tail -f $PROJECT_ROOT/logs/daily-automation-\$(date +%Y-%m-%d).log"
echo ""
echo "🚨 If you need to disable:"
echo "   crontab -e  # then comment out or remove the line"
echo ""

exit 0
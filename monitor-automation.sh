#!/bin/bash

# ParleyApp Daily Automation Monitor
# Use this script to check automation status and logs

PROJECT_ROOT="/home/reid/Desktop/parleyapp"
LOG_DIR="$PROJECT_ROOT/logs"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎯 ParleyApp Daily Automation Monitor${NC}"
echo "=================================================="

# Check if automation script exists
if [[ -f "$PROJECT_ROOT/daily-automation-new.sh" ]]; then
    echo -e "${GREEN}✅ Automation script exists${NC}"
else
    echo -e "${RED}❌ Automation script missing${NC}"
    exit 1
fi

# Check cron job
echo ""
echo -e "${BLUE}📅 Cron Job Status:${NC}"
if crontab -l 2>/dev/null | grep -q "daily-automation-new.sh"; then
    echo -e "${GREEN}✅ Cron job is active${NC}"
    echo "   Schedule: $(crontab -l 2>/dev/null | grep daily-automation-new.sh | cut -d' ' -f1-5)"
    echo "   Next run: $(date -d 'today 22:30' '+%Y-%m-%d %H:%M:%S')"
else
    echo -e "${RED}❌ Cron job not found${NC}"
fi

# Check StatMuse API server status
echo ""
echo -e "${BLUE}📡 StatMuse API Server:${NC}"
if pgrep -f "statmuse_api_server.py" > /dev/null; then
    echo -e "${GREEN}✅ StatMuse API server is running${NC}"
    echo "   PID: $(pgrep -f statmuse_api_server.py)"
else
    echo -e "${YELLOW}⚠️  StatMuse API server not running${NC}"
fi

# Check recent logs
echo ""
echo -e "${BLUE}📝 Recent Automation Logs:${NC}"
if [[ -d "$LOG_DIR" ]]; then
    # Find the most recent log file
    LATEST_LOG=$(find "$LOG_DIR" -name "daily-automation-*.log" -type f -exec ls -t {} + | head -n1)
    
    if [[ -n "$LATEST_LOG" ]]; then
        echo "   Latest log: $(basename "$LATEST_LOG")"
        echo ""
        echo -e "${BLUE}Last 10 lines:${NC}"
        tail -n 10 "$LATEST_LOG"
    else
        echo -e "${YELLOW}⚠️  No automation logs found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Logs directory doesn't exist${NC}"
fi

# Check Supabase predictions (if we can)
echo ""
echo -e "${BLUE}🎲 Quick Stats:${NC}"
echo "   Log files: $(find "$LOG_DIR" -name "daily-automation-*.log" -type f 2>/dev/null | wc -l)"
echo "   Disk usage: $(du -sh "$LOG_DIR" 2>/dev/null | cut -f1) in logs"

# Options menu
echo ""
echo -e "${BLUE}📋 Quick Actions:${NC}"
echo "1. View today's full log"
echo "2. View yesterday's full log"  
echo "3. Follow live log (tail -f)"
echo "4. Test automation script now"
echo "5. View all log files"
echo "6. Check cron job details"
echo ""

read -p "Choose an action (1-6) or press Enter to exit: " choice

case $choice in
    1)
        TODAY_LOG="$LOG_DIR/daily-automation-$(date +%Y-%m-%d).log"
        if [[ -f "$TODAY_LOG" ]]; then
            less "$TODAY_LOG"
        else
            echo -e "${YELLOW}No log file for today${NC}"
        fi
        ;;
    2)
        YESTERDAY_LOG="$LOG_DIR/daily-automation-$(date -d yesterday +%Y-%m-%d).log"
        if [[ -f "$YESTERDAY_LOG" ]]; then
            less "$YESTERDAY_LOG"
        else
            echo -e "${YELLOW}No log file for yesterday${NC}"
        fi
        ;;
    3)
        TODAY_LOG="$LOG_DIR/daily-automation-$(date +%Y-%m-%d).log"
        echo "Following live log... (Ctrl+C to exit)"
        tail -f "$TODAY_LOG"
        ;;
    4)
        echo "Running automation script..."
        cd "$PROJECT_ROOT"
        ./daily-automation-new.sh
        ;;
    5)
        echo "All automation log files:"
        ls -la "$LOG_DIR"/daily-automation-*.log 2>/dev/null || echo "No log files found"
        ;;
    6)
        echo "Current cron jobs:"
        crontab -l
        ;;
    *)
        echo "Exiting..."
        ;;
esac

exit 0
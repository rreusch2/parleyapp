#!/bin/bash

# ParleyApp Workflow Monitor
# This script helps monitor the daily automation workflow

PROJECT_ROOT="/home/reid/Desktop/parleyapp"
LOG_DIR="$PROJECT_ROOT/logs/daily-workflow"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "📊 ParleyApp Workflow Monitor"
echo "============================="

# Check if workflow is currently running
if [ -f "/tmp/parleyapp-daily-workflow.lock" ]; then
    PID=$(cat /tmp/parleyapp-daily-workflow.lock)
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${YELLOW}🔄 Workflow is currently RUNNING (PID: $PID)${NC}"
        RUNNING=true
    else
        echo -e "${RED}⚠️ Stale lock file found (PID: $PID not running)${NC}"
        RUNNING=false
    fi
else
    echo -e "${GREEN}✅ No workflow currently running${NC}"
    RUNNING=false
fi

echo ""

# Check recent logs
if [ -d "$LOG_DIR" ]; then
    echo "📋 Recent Workflow Logs:"
    echo "========================"
    
    # Find the most recent log file
    RECENT_LOG=$(ls -t "$LOG_DIR"/workflow-*.log 2>/dev/null | head -1)
    
    if [ -n "$RECENT_LOG" ]; then
        echo "📄 Latest log: $(basename "$RECENT_LOG")"
        echo ""
        
        # Show last 10 lines of the log
        echo "📝 Last 10 log entries:"
        tail -10 "$RECENT_LOG" | while read line; do
            if echo "$line" | grep -q "ERROR"; then
                echo -e "${RED}$line${NC}"
            elif echo "$line" | grep -q "✅"; then
                echo -e "${GREEN}$line${NC}"
            elif echo "$line" | grep -q "⚠️"; then
                echo -e "${YELLOW}$line${NC}"
            else
                echo "$line"
            fi
        done
        
        echo ""
        
        # Check if the last run was successful
        if tail -20 "$RECENT_LOG" | grep -q "Daily workflow completed successfully"; then
            echo -e "${GREEN}✅ Last workflow run: SUCCESSFUL${NC}"
        elif tail -20 "$RECENT_LOG" | grep -q "Daily workflow completed with errors"; then
            echo -e "${RED}❌ Last workflow run: FAILED${NC}"
        elif [ "$RUNNING" = true ]; then
            echo -e "${BLUE}🔄 Last workflow run: IN PROGRESS${NC}"
        else
            echo -e "${YELLOW}⚠️ Last workflow run: UNKNOWN STATUS${NC}"
        fi
    else
        echo "📄 No log files found in $LOG_DIR"
    fi
else
    echo "📁 Log directory not found: $LOG_DIR"
fi

echo ""

# Check cron status
echo "⏰ Cron Job Status:"
echo "==================="

if crontab -l 2>/dev/null | grep -q "daily-automated-workflow.sh"; then
    echo -e "${GREEN}✅ Cron job is configured${NC}"
    echo "📅 Cron entry:"
    crontab -l | grep "daily-automated-workflow.sh" | sed 's/^/   /'
else
    echo -e "${RED}❌ No cron job found${NC}"
fi

echo ""

# Check systemd timer (if available)
echo "🔧 Systemd Timer Status:"
echo "========================"

if systemctl list-timers parleyapp-daily.timer 2>/dev/null | grep -q "parleyapp-daily.timer"; then
    echo -e "${GREEN}✅ Systemd timer is available${NC}"
    
    if systemctl is-enabled parleyapp-daily.timer >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Timer is enabled${NC}"
    else
        echo -e "${YELLOW}⚠️ Timer is disabled${NC}"
    fi
    
    if systemctl is-active parleyapp-daily.timer >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Timer is active${NC}"
        
        # Show next run time
        NEXT_RUN=$(systemctl list-timers parleyapp-daily.timer | grep "parleyapp-daily.timer" | awk '{print $1, $2}')
        if [ -n "$NEXT_RUN" ]; then
            echo "📅 Next run: $NEXT_RUN"
        fi
    else
        echo -e "${RED}❌ Timer is inactive${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Systemd timer not configured${NC}"
fi

echo ""

# Check service health
echo "🏥 Service Health Check:"
echo "========================"

# Check backend
if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend service (port 3000): HEALTHY${NC}"
else
    echo -e "${RED}❌ Backend service (port 3000): UNAVAILABLE${NC}"
fi

# Check ML server
if curl -s http://localhost:8001/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ ML server (port 8001): HEALTHY${NC}"
else
    echo -e "${RED}❌ ML server (port 8001): UNAVAILABLE${NC}"
fi

echo ""

# Show disk usage for logs
echo "💾 Log Directory Usage:"
echo "======================="

if [ -d "$LOG_DIR" ]; then
    USAGE=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)
    FILE_COUNT=$(find "$LOG_DIR" -name "*.log" 2>/dev/null | wc -l)
    echo "📊 Total size: $USAGE"
    echo "📄 Log files: $FILE_COUNT"
    
    # Warn if logs are getting large
    USAGE_MB=$(du -sm "$LOG_DIR" 2>/dev/null | cut -f1)
    if [ "$USAGE_MB" -gt 100 ]; then
        echo -e "${YELLOW}⚠️ Log directory is large (${USAGE_MB}MB). Consider cleaning old logs.${NC}"
    fi
else
    echo "📁 Log directory not found"
fi

echo ""

# Show helpful commands
echo "🔧 Useful Commands:"
echo "=================="
echo "View live logs:     tail -f $LOG_DIR/workflow-\$(date +%Y-%m-%d).log"
echo "Test workflow:      $PROJECT_ROOT/scripts/daily-automated-workflow.sh --skip-delays"
echo "Check cron logs:    grep CRON /var/log/syslog | tail -10"
echo "Manual run:         $PROJECT_ROOT/scripts/daily-automated-workflow.sh"
echo "Remove lock:        rm /tmp/parleyapp-daily-workflow.lock"

# Show options for actions
echo ""
echo "🎯 Quick Actions:"
echo "================="

if [ "$RUNNING" = true ]; then
    echo "1. View live log"
    echo "2. Stop running workflow (kill process)"
    echo ""
    echo "Enter choice (1-2) or press Enter to exit:"
    read -r choice
    
    case $choice in
        1)
            echo "📄 Following live log (Ctrl+C to exit)..."
            tail -f "$RECENT_LOG"
            ;;
        2)
            echo "⚠️ Stopping workflow process $PID..."
            kill "$PID" 2>/dev/null && echo "✅ Process stopped" || echo "❌ Failed to stop process"
            rm -f /tmp/parleyapp-daily-workflow.lock
            ;;
        *)
            echo "👋 Goodbye!"
            ;;
    esac
else
    echo "1. View latest log"
    echo "2. Test workflow (reduced delays)"
    echo "3. Run workflow now"
    echo "4. Clean old logs (keep last 7 days)"
    echo ""
    echo "Enter choice (1-4) or press Enter to exit:"
    read -r choice
    
    case $choice in
        1)
            if [ -n "$RECENT_LOG" ]; then
                echo "📄 Viewing latest log:"
                less "$RECENT_LOG"
            else
                echo "❌ No log file found"
            fi
            ;;
        2)
            echo "🧪 Running test workflow..."
            cd "$PROJECT_ROOT"
            ./scripts/daily-automated-workflow.sh --skip-delays
            ;;
        3)
            echo "🚀 Running workflow now..."
            cd "$PROJECT_ROOT"
            ./scripts/daily-automated-workflow.sh
            ;;
        4)
            echo "🧹 Cleaning old logs..."
            find "$LOG_DIR" -name "workflow-*.log" -mtime +7 -delete 2>/dev/null
            echo "✅ Old logs cleaned"
            ;;
        *)
            echo "👋 Goodbye!"
            ;;
    esac
fi 
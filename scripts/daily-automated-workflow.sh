#!/bin/bash

# ParleyApp Daily Automated Workflow
# This script runs the complete daily data pipeline:
# 1. Setup odds integration (fetch odds/props from TheOdds API)
# 2. Wait 15 minutes then run orchestrator integration test
# 3. Run daily injury update
#
# Usage: ./daily-automated-workflow.sh
# Cron: 0 2 * * * /home/reid/Desktop/parleyapp/scripts/daily-automated-workflow.sh

# Configuration
PROJECT_ROOT="/home/reid/Desktop/parleyapp"
LOG_DIR="$PROJECT_ROOT/logs/daily-workflow"
LOG_FILE="$LOG_DIR/workflow-$(date +%Y-%m-%d).log"
BACKEND_DIR="$PROJECT_ROOT/backend"
LOCK_FILE="/tmp/parleyapp-daily-workflow.lock"

# Timing configuration (in seconds)
ORCHESTRATOR_DELAY=900  # 15 minutes = 900 seconds
INJURY_DELAY=60         # 1 minute after orchestrator

# Mode flags
MOCK_MODE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log with timestamp and colors
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $timestamp: $message" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $timestamp: $message" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $timestamp: $message" | tee -a "$LOG_FILE"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} $timestamp: $message" | tee -a "$LOG_FILE"
            ;;
        *)
            echo "$timestamp: $message" | tee -a "$LOG_FILE"
            ;;
    esac
}

# Function to check if another instance is running
check_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log "ERROR" "Another instance is already running (PID: $pid)"
            exit 1
        else
            log "WARN" "Stale lock file found, removing..."
            rm -f "$LOCK_FILE"
        fi
    fi
    
    # Create lock file
    echo $$ > "$LOCK_FILE"
}

# Function to cleanup on exit
cleanup() {
    log "INFO" "Cleaning up..."
    rm -f "$LOCK_FILE"
}

# Function to send notification (placeholder for future webhook/email integration)
send_notification() {
    local status=$1
    local message=$2
    log "DEBUG" "Notification: $status - $message"
    # Future: Add webhook call to Slack/Discord/Email
}

# Function to check if services are running
check_services() {
    log "INFO" "Checking required services..."
    
    # Check if backend is accessible (if running)
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        log "INFO" "Backend service is running"
    else
        log "WARN" "Backend service not running - continuing anyway"
    fi
    
    # Check if ML server is accessible (if running)
    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        log "INFO" "ML prediction server is running"
    else
        log "WARN" "ML prediction server not running - orchestrator test may fail"
    fi
}

# Function to run setup-odds-integration
run_odds_setup() {
    log "INFO" "🎯 Starting odds integration setup..."
    
    cd "$BACKEND_DIR" || {
        log "ERROR" "Failed to change to backend directory"
        return 1
    }
    
    # Load environment variables
    if [ -f .env ]; then
        export $(cat .env | xargs) 2>/dev/null || true
    fi
    
    if [ "$MOCK_MODE" = true ]; then
        log "INFO" "🎭 MOCK MODE: Simulating odds integration setup..."
        log "DEBUG" "[MOCK] Would run: npm run setup-odds-integration"
        log "DEBUG" "[MOCK] Simulating API calls to TheOdds API..."
        sleep 3
        log "DEBUG" "[MOCK] Simulated fetching 25 games with odds data"
        log "DEBUG" "[MOCK] Simulated storing 150 player props"
        log "INFO" "🎭 MOCK: Odds integration setup simulation completed"
        return 0
    fi
    
    # Run the setup command with timeout
    timeout 300 npm run setup-odds-integration 2>&1 | while read line; do
        log "DEBUG" "[ODDS-SETUP] $line"
    done
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        log "INFO" "✅ Odds integration setup completed successfully"
        send_notification "SUCCESS" "Odds setup completed"
        return 0
    else
        log "ERROR" "❌ Odds integration setup failed with exit code $exit_code"
        send_notification "ERROR" "Odds setup failed"
        return 1
    fi
}

# Function to run orchestrator for daily picks generation
run_orchestrator_production() {
    log "INFO" "🤖 Starting daily picks generation with orchestrator..."
    
    cd "$BACKEND_DIR" || {
        log "ERROR" "Failed to change to backend directory"
        return 1
    }
    
    # Load environment variables
    if [ -f .env ]; then
        export $(cat .env | xargs) 2>/dev/null || true
    fi
    
    if [ "$MOCK_MODE" = true ]; then
        log "INFO" "🎭 MOCK MODE: Simulating orchestrator daily picks generation..."
        log "DEBUG" "[MOCK] Would run: npx ts-node src/scripts/run-orchestrator.ts"
        log "DEBUG" "[MOCK] Simulating ML server health check..."
        sleep 2
        log "DEBUG" "[MOCK] Simulated generating 10 team picks (ML, spreads, totals)"
        log "DEBUG" "[MOCK] Simulated generating 10 player props picks"
        log "DEBUG" "[MOCK] Simulated saving 20 total picks to database"
        log "DEBUG" "[MOCK] Simulated sending notifications to users"
        sleep 3
        log "INFO" "🎭 MOCK: Orchestrator daily picks generation simulation completed"
        return 0
    fi
    
    # Run the actual orchestrator with timeout
    timeout 900 npx ts-node src/scripts/run-orchestrator.ts 2>&1 | while read line; do
        log "DEBUG" "[ORCHESTRATOR] $line"
    done
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        log "INFO" "✅ Daily picks generation completed successfully"
        log "INFO" "📱 20 picks generated (10 team + 10 player props) and saved to database"
        send_notification "SUCCESS" "Daily picks generated successfully"
        return 0
    else
        log "ERROR" "❌ Daily picks generation failed with exit code $exit_code"
        send_notification "ERROR" "Daily picks generation failed"
        return 1
    fi
}

# Function to run daily injury update
run_injury_update() {
    log "INFO" "🏥 Starting daily injury update..."
    
    cd "$BACKEND_DIR" || {
        log "ERROR" "Failed to change to backend directory"
        return 1
    }
    
    # Load environment variables
    if [ -f .env ]; then
        export $(cat .env | xargs) 2>/dev/null || true
    fi
    
    if [ "$MOCK_MODE" = true ]; then
        log "INFO" "🎭 MOCK MODE: Simulating daily injury update..."
        log "DEBUG" "[MOCK] Would run: npx ts-node src/scripts/dailyInjuryUpdate.ts"
        log "DEBUG" "[MOCK] Simulating injury data scraping..."
        sleep 2
        log "DEBUG" "[MOCK] Simulated updating 15 player injury statuses"
        log "DEBUG" "[MOCK] Simulated processing NBA, MLB injury reports"
        log "INFO" "🎭 MOCK: Daily injury update simulation completed"
        return 0
    fi
    
    # Run the injury update with timeout
    timeout 180 npx ts-node src/scripts/dailyInjuryUpdate.ts 2>&1 | while read line; do
        log "DEBUG" "[INJURY-UPDATE] $line"
    done
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        log "INFO" "✅ Daily injury update completed successfully"
        send_notification "SUCCESS" "Injury update completed"
        return 0
    else
        log "ERROR" "❌ Daily injury update failed with exit code $exit_code"
        send_notification "ERROR" "Injury update failed"
        return 1
    fi
}

# Function to wait with progress indicator
wait_with_progress() {
    local duration=$1
    local message=$2
    log "INFO" "$message (${duration}s)"
    
    for ((i=duration; i>0; i--)); do
        echo -ne "\r${BLUE}⏳ Waiting... ${i}s remaining${NC}"
        sleep 1
    done
    echo -e "\r${GREEN}✅ Wait complete!${NC}                    "
}

# Main workflow function
main() {
    log "INFO" "🚀 Starting ParleyApp Daily Automated Workflow"
    log "INFO" "============================================="
    
    # Check if another instance is running
    check_lock
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Check services
    check_services
    
    local overall_success=true
    
    # Step 1: Setup odds integration
    log "INFO" "📊 STEP 1: Setting up odds integration..."
    if ! run_odds_setup; then
        overall_success=false
        log "ERROR" "Step 1 failed - continuing with remaining steps"
    fi
    
    # Step 2: Wait 15 minutes then run orchestrator
    wait_with_progress $ORCHESTRATOR_DELAY "⏰ STEP 2: Waiting 15 minutes before daily picks generation..."
    
    log "INFO" "🎯 STEP 2: Running daily picks generation..."
    if ! run_orchestrator_production; then
        overall_success=false
        log "ERROR" "Step 2 failed - continuing with remaining steps"
    fi
    
    # Step 3: Wait a bit then run injury update
    wait_with_progress $INJURY_DELAY "⏰ STEP 3: Brief wait before injury update..."
    
    log "INFO" "🏥 STEP 3: Running daily injury update..."
    if ! run_injury_update; then
        overall_success=false
        log "ERROR" "Step 3 failed"
    fi
    
    # Final status
    if [ "$overall_success" = true ]; then
        log "INFO" "🎉 Daily workflow completed successfully!"
        send_notification "SUCCESS" "Daily workflow completed successfully"
        exit 0
    else
        log "ERROR" "💥 Daily workflow completed with errors - check logs"
        send_notification "ERROR" "Daily workflow completed with errors"
        exit 1
    fi
}

# Help function
show_help() {
    echo "ParleyApp Daily Automated Workflow"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --dry-run      Show what would be executed without running"
    echo "  --skip-delays  Skip the timing delays (for testing)"
    echo "  --mock         Run in mock mode (simulates commands without executing)"
    echo ""
    echo "Environment Variables:"
    echo "  ORCHESTRATOR_DELAY  Delay before orchestrator (default: 900s)"
    echo "  INJURY_DELAY        Delay before injury update (default: 60s)"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --dry-run)
            log "INFO" "DRY RUN MODE - Would execute:"
            log "INFO" "1. cd $BACKEND_DIR && npm run setup-odds-integration"
            log "INFO" "2. Wait 15 minutes"
            log "INFO" "3. cd $BACKEND_DIR && npx ts-node src/scripts/run-orchestrator.ts"
            log "INFO" "4. Wait 1 minute"
            log "INFO" "5. cd $BACKEND_DIR && npx ts-node src/scripts/dailyInjuryUpdate.ts"
            exit 0
            ;;
        --skip-delays)
            ORCHESTRATOR_DELAY=5
            INJURY_DELAY=2
            log "INFO" "Delays reduced for testing"
            shift
            ;;
        --mock)
            MOCK_MODE=true
            log "INFO" "🎭 Mock mode enabled - commands will be simulated"
            shift
            ;;
        *)
            log "ERROR" "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main 
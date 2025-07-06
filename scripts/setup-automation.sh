#!/bin/bash

# ParleyApp Automation Setup Script
# This script helps you quickly set up the daily automation workflow

set -e

echo "🚀 ParleyApp Daily Automation Setup"
echo "===================================="

PROJECT_ROOT="/home/reid/Desktop/parleyapp"
cd "$PROJECT_ROOT"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the ParleyApp root directory"
    exit 1
fi

echo "✅ Project directory confirmed: $PROJECT_ROOT"

# Make scripts executable
echo "📝 Making scripts executable..."
chmod +x scripts/daily-automated-workflow.sh
chmod +x test-orchestrator-integration.sh

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs/daily-workflow

# Check for required environment variables
echo "🔍 Checking environment variables..."

missing_vars=()

if [ -z "$THEODDS_API_KEY" ]; then
    missing_vars+=("THEODDS_API_KEY")
fi

if [ -z "$SUPABASE_URL" ]; then
    missing_vars+=("SUPABASE_URL")
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    missing_vars+=("SUPABASE_SERVICE_KEY")
fi

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "⚠️ Missing environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please set these in your .env file or environment before proceeding."
    echo "Example .env file:"
    echo ""
    echo "THEODDS_API_KEY=your_api_key_here"
    echo "SUPABASE_URL=your_supabase_url"
    echo "SUPABASE_SERVICE_KEY=your_service_key"
    echo "DEEPSEEK_API_KEY=your_deepseek_key"
    echo "XAI_API_KEY=your_grok_key"
    echo ""
else
    echo "✅ Required environment variables found"
fi

# Test the workflow script
echo ""
echo "🧪 Testing workflow script..."
if ./scripts/daily-automated-workflow.sh --dry-run; then
    echo "✅ Workflow script test passed"
else
    echo "❌ Workflow script test failed"
    exit 1
fi

echo ""
echo "🎯 Setup Options:"
echo "=================="
echo ""
echo "1. Cron Job (Simple - Recommended for Development)"
echo "   Run: crontab -e"
echo "   Add: 0 2 * * * $PROJECT_ROOT/scripts/daily-automated-workflow.sh"
echo ""
echo "2. Systemd Service (Robust - Recommended for Production)"
echo "   Run the following commands:"
echo "   sudo cp scripts/parleyapp-daily.service /etc/systemd/system/"
echo "   sudo cp scripts/parleyapp-daily.timer /etc/systemd/system/"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable parleyapp-daily.timer"
echo "   sudo systemctl start parleyapp-daily.timer"
echo ""
echo "3. Docker Production (Full Stack - Recommended for Deployment)"
echo "   Run: docker compose -f docker-compose.production.yml up -d"
echo ""

# Interactive setup
echo "Would you like to set up the cron job now? (y/n)"
read -r setup_cron

if [ "$setup_cron" = "y" ] || [ "$setup_cron" = "Y" ]; then
    echo "Setting up cron job..."
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "daily-automated-workflow.sh"; then
        echo "⚠️ Cron job already exists. Skipping..."
    else
        # Add cron job
        (crontab -l 2>/dev/null; echo "0 2 * * * $PROJECT_ROOT/scripts/daily-automated-workflow.sh") | crontab -
        echo "✅ Cron job added successfully!"
        echo "📅 The workflow will run daily at 2:00 AM"
    fi
fi

echo ""
echo "Would you like to test the workflow with reduced delays? (y/n)"
read -r test_workflow

if [ "$test_workflow" = "y" ] || [ "$test_workflow" = "Y" ]; then
    echo "🧪 Running test workflow with reduced delays..."
    echo "This will take about 2-3 minutes..."
    ./scripts/daily-automated-workflow.sh --skip-delays
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Monitor logs in: logs/daily-workflow/"
echo "2. Check workflow status with: systemctl status parleyapp-daily.timer (if using systemd)"
echo "3. View cron logs with: grep CRON /var/log/syslog"
echo ""
echo "🔧 Useful Commands:"
echo "==================="
echo "Test workflow:     ./scripts/daily-automated-workflow.sh --skip-delays"
echo "Dry run:          ./scripts/daily-automated-workflow.sh --dry-run"
echo "View logs:        tail -f logs/daily-workflow/workflow-\$(date +%Y-%m-%d).log"
echo "Check cron:       crontab -l"
echo ""
echo "📖 For detailed documentation, see: SETUP_AUTOMATION.md" 
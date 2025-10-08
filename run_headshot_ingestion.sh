#!/bin/bash

# Quick Start Script for Player Headshot Ingestion
# This script runs the headshot ingestion process

echo "=================================="
echo "Player Headshot Ingestion"
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found!"
    echo ""
    echo "Please create a .env file with your Supabase credentials:"
    echo "  cp .env.example.headshots .env"
    echo "  # Then edit .env with your actual SUPABASE_SERVICE_KEY"
    echo ""
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

# Check if dependencies are installed
if ! python3 -c "import requests" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip3 install -r requirements_headshots.txt
fi

# Run test first
echo "🧪 Running connection test..."
echo ""
python3 test_headshot_ingestion.py

if [ $? -eq 0 ]; then
    echo ""
    echo "=================================="
    echo "Test passed! Ready to proceed."
    echo "=================================="
    echo ""
    read -p "Start full headshot ingestion? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "🚀 Starting headshot ingestion..."
        echo "   This may take 30-60 minutes depending on your connection."
        echo ""
        
        # Run the main ingestion script
        python3 ingest_player_headshots.py
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "=================================="
            echo "✅ Phase 1 Complete!"
            echo "=================================="
            echo ""
            read -p "Run Phase 2 (ESPN API fallback)? (y/n) " -n 1 -r
            echo ""
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                python3 ingest_headshots_espn_api.py
                echo ""
                echo "=================================="
                echo "✅ All Phases Complete!"
                echo "=================================="
            fi
        fi
    else
        echo ""
        echo "Cancelled. You can run manually with:"
        echo "  python3 ingest_player_headshots.py"
    fi
else
    echo ""
    echo "❌ Test failed. Please check your .env configuration."
    exit 1
fi


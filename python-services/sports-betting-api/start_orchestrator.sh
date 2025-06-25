#!/bin/bash

# Start Orchestrator Setup Script

echo "🚀 ParleyApp Orchestrator Startup Script"
echo "========================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ No .env file found. Copying from data-ingestion..."
    cp ../data-ingestion/.env .
fi

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use"
        return 1
    else
        echo "✅ Port $1 is available"
        return 0
    fi
}

# Start ML Server
echo ""
echo "📊 Starting ML Prediction Server..."
if check_port 8001; then
    python3 ml_prediction_server.py &
    ML_PID=$!
    echo "✅ ML Server started (PID: $ML_PID)"
    sleep 3
else
    echo "⚠️  ML Server might already be running"
fi

# Run orchestrator
echo ""
echo "🎯 Starting Manual Orchestrator..."
echo "This will fetch games and generate predictions"
echo ""

python3 run_orchestrator.py

# Cleanup
echo ""
echo "🔧 Cleanup..."
if [ ! -z "$ML_PID" ]; then
    echo "Stopping ML Server (PID: $ML_PID)..."
    kill $ML_PID 2>/dev/null
fi

echo "✅ Done!" 
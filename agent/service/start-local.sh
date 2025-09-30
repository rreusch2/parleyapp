#!/bin/bash
# Quick start script for local development

set -e

echo "🚀 Starting Professor Lock Agent Service..."
echo ""

# Check if .env exists
if [ ! -f "service/.env" ]; then
    echo "⚠️  No .env file found. Creating from example..."
    cp service/.env.example service/.env
    echo "✅ Created service/.env - Please edit it with your keys!"
    echo ""
    exit 1
fi

# Check if venv exists
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate venv
source .venv/bin/activate

# Install deps if needed
if ! python -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
fi

# Check playwright
if ! python -c "from playwright.sync_api import sync_playwright" 2>/dev/null; then
    echo "🎭 Installing Playwright browsers..."
    python -m playwright install --with-deps
fi

# Load env
export $(cat service/.env | grep -v '^#' | xargs)

echo "✅ Environment loaded"
echo "📍 SUPABASE_URL: ${SUPABASE_URL}"
echo "📍 WEB_API_BASE_URL: ${WEB_API_BASE_URL}"
echo ""
echo "🌐 Starting server on http://localhost:${PORT:-8000}"
echo "🔍 Health check: http://localhost:${PORT:-8000}/healthz"
echo ""

# Start server
uvicorn service.server:app --host 0.0.0.0 --port ${PORT:-8000} --reload

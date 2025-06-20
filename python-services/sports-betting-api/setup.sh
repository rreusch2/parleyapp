#!/bin/bash

# Sports Betting API Setup Script
echo "🚀 Setting up Sports Betting API Microservice..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip first."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📥 Installing requirements..."
pip install -r requirements.txt

# Install sports-betting library
echo "🏈 Installing sports-betting library..."
pip install sports-betting

# Install additional dependencies that might be missing
echo "🔧 Installing additional dependencies..."
pip install openpyxl xlrd lxml beautifulsoup4

echo "✅ Setup complete!"
echo ""
echo "🎯 To start the API server, run:"
echo "   source venv/bin/activate"
echo "   python app.py"
echo ""
echo "🔗 The API will be available at: http://localhost:8001"
echo "📊 Health check: http://localhost:8001/health" 
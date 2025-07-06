#!/bin/bash

echo "🚀 Predictive Play - The Odds API Setup"
echo "=================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or later."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install requirements
echo "📚 Installing required packages..."
pip install --upgrade pip
pip install httpx psycopg2-binary redis apscheduler python-dotenv backoff

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo ""
    echo "📝 Creating .env configuration file..."
    cat > .env << EOL
# The Odds API Configuration
THEODDS_API_KEY=YOUR_API_KEY_HERE
API_PROVIDER=theodds
SPORTS_API_KEY=YOUR_API_KEY_HERE

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Predictive Play
DB_USER=postgres
DB_PASSWORD=your_password_here

# Redis Configuration (optional, for caching)
REDIS_URL=redis://localhost:6379

# Sports to track
ENABLED_SPORTS=NFL,NBA,MLB,NHL

# Logging
LOG_LEVEL=INFO
EOL
    echo "✅ Created .env file - Please update it with your API key and database credentials"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Edit the .env file and add your The Odds API key"
echo "2. Update the database credentials in .env"
echo "3. Run the test script: python3 test_theodds_api.py"
echo "4. Start the data ingestion service: python3 data_ingestor.py"
echo ""
echo "📋 Quick Commands:"
echo "   export THEODDS_API_KEY='your_api_key_here'"
echo "   python3 test_theodds_api.py"
echo "" 
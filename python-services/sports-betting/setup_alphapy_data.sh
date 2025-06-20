#!/bin/bash

echo "🚀 AlphaPy Data Collection Setup"
echo "================================"

# Navigate to the sports-betting directory
cd "$(dirname "$0")"

echo "📁 Current directory: $(pwd)"

# Install required Python packages
echo "📦 Installing required packages..."
pip install pandas numpy requests beautifulsoup4 lxml kaggle

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/training/kaggle
mkdir -p data/training/alphapy

# Make the collection script executable
chmod +x scripts/collect_training_data.py

echo ""
echo "🎯 QUICK START OPTIONS:"
echo "======================="
echo ""
echo "1. 📥 Download FREE Kaggle datasets (500k+ games):"
echo "   python scripts/collect_training_data.py --kaggle-only"
echo ""
echo "2. 📊 Collect MLB data (5 years):"
echo "   python scripts/collect_training_data.py --sport mlb --years 5"
echo ""
echo "3. 🚀 Collect ALL sports data:"
echo "   python scripts/collect_training_data.py --all"
echo ""
echo "💡 RECOMMENDED: Start with Kaggle datasets first!"
echo "   They're FREE and give you 500k+ training examples immediately."
echo ""
echo "🔑 For Kaggle datasets, you'll need API credentials:"
echo "   1. Go to https://www.kaggle.com/account"
echo "   2. Create API token"
echo "   3. Save kaggle.json to ~/.kaggle/"
echo ""
echo "✅ Setup complete! Ready to collect massive training data." 
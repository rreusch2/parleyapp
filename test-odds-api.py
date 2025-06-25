#!/usr/bin/env python3
"""
Quick Test Script for The Odds API
Run this after adding your API key to verify it's working
"""

import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

API_KEY = os.getenv('SPORTS_API_KEY')
BASE_URL = "https://api.the-odds-api.com/v4"

def test_api_connection():
    """Test basic API connection"""
    print("🔑 Testing The Odds API Connection...")
    print("=" * 50)
    
    if not API_KEY or API_KEY == 'YOUR_THEODDS_API_KEY_HERE':
        print("❌ API key not configured!")
        print("   Please replace 'YOUR_THEODDS_API_KEY_HERE' in backend/.env")
        return False
    
    print(f"🔐 API Key: {API_KEY[:8]}...{API_KEY[-4:] if len(API_KEY) > 12 else API_KEY}")
    
    try:
        # Test basic sports endpoint
        url = f"{BASE_URL}/sports"
        params = {'apiKey': API_KEY}
        
        print(f"🌐 Testing endpoint: {url}")
        response = requests.get(url, params=params, timeout=10)
        
        print(f"📊 Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS! Found {len(data)} sports available")
            print("\n📋 Available sports:")
            for sport in data[:5]:  # Show first 5
                print(f"   • {sport.get('title', 'Unknown')} ({sport.get('key', 'Unknown')})")
            if len(data) > 5:
                print(f"   ... and {len(data) - 5} more")
            return True
        elif response.status_code == 401:
            print("❌ AUTHENTICATION FAILED!")
            print("   Your API key might be invalid or expired")
            return False
        elif response.status_code == 402:
            print("❌ PAYMENT REQUIRED!")
            print("   Your API usage limit might be exceeded")
            return False
        else:
            print(f"❌ REQUEST FAILED: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ REQUEST TIMEOUT!")
        print("   The API might be slow or unreachable")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_live_odds():
    """Test fetching live odds for NBA"""
    print("\n🏀 Testing Live NBA Odds...")
    print("=" * 30)
    
    try:
        url = f"{BASE_URL}/sports/basketball_nba/odds"
        params = {
            'apiKey': API_KEY,
            'regions': 'us',
            'markets': 'h2h,spreads,totals',
            'oddsFormat': 'american'
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Found {len(data)} NBA games with odds")
            
            if data:
                game = data[0]  # Show first game
                print(f"\n📋 Sample game:")
                print(f"   🏠 Home: {game.get('home_team', 'Unknown')}")
                print(f"   ✈️ Away: {game.get('away_team', 'Unknown')}")
                print(f"   📅 Start: {game.get('commence_time', 'Unknown')}")
                
                if 'bookmakers' in game and game['bookmakers']:
                    bookmaker = game['bookmakers'][0]
                    print(f"   📚 Bookmaker: {bookmaker.get('title', 'Unknown')}")
                    
                    if 'markets' in bookmaker:
                        for market in bookmaker['markets']:
                            market_key = market.get('key', 'Unknown')
                            print(f"   💰 {market_key}: Available")
            
            return True
        else:
            print(f"❌ Failed to get odds: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 THE ODDS API INTEGRATION TEST")
    print("=" * 50)
    
    # Test basic connection
    if test_api_connection():
        # Test live odds
        test_live_odds()
        
        print("\n🎉 API INTEGRATION SUCCESSFUL!")
        print("✅ Your Odds API key is working correctly")
        print("🚀 Ready to activate data ingestion services")
    else:
        print("\n❌ API INTEGRATION FAILED!")
        print("🔧 Please check your API key configuration")
    
    print("\n" + "=" * 50) 
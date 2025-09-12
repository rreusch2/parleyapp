#!/usr/bin/env python3
"""
Test TheOdds API for NFL 2025 Week 1 data availability
"""

import os
import sys
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

def test_theodds_api():
    """Test TheOdds API endpoints for NFL data"""
    
    api_key = os.getenv("THEODDS_API_KEY")
    base_url = "https://api.the-odds-api.com/v4"
    
    if not api_key:
        print("❌ THEODDS_API_KEY not found in environment")
        return
    
    print("🏈 Testing TheOdds API for NFL 2025 Data")
    print("=" * 60)
    print(f"API Key: {api_key[:10]}...")
    print(f"Base URL: {base_url}")
    
    # Test 1: Get available sports
    print("\n🔍 Testing available sports...")
    try:
        response = requests.get(f"{base_url}/sports", params={"apiKey": api_key})
        if response.status_code == 200:
            sports = response.json()
            nfl_sports = [s for s in sports if 'nfl' in s.get('key', '').lower()]
            print(f"✅ Found {len(nfl_sports)} NFL-related sports:")
            for sport in nfl_sports:
                print(f"  - {sport.get('key')}: {sport.get('title')}")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 2: Get NFL odds/games
    print("\n🔍 Testing NFL games...")
    try:
        # Try americanfootball_nfl which is the main NFL sport key
        params = {
            "apiKey": api_key,
            "regions": "us",
            "markets": "h2h,spreads,totals",
            "oddsFormat": "american"
        }
        
        response = requests.get(f"{base_url}/sports/americanfootball_nfl/odds", params=params)
        if response.status_code == 200:
            games = response.json()
            print(f"✅ Found {len(games)} NFL games:")
            
            for game in games[:3]:  # Show first 3 games
                home_team = game.get('home_team')
                away_team = game.get('away_team')
                commence_time = game.get('commence_time')
                print(f"  - {away_team} @ {home_team} ({commence_time})")
                
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 3: Check for player props/stats endpoints
    print("\n🔍 Testing player props...")
    try:
        params = {
            "apiKey": api_key,
            "regions": "us", 
            "markets": "player_pass_yds,player_rush_yds,player_receptions",
            "oddsFormat": "american"
        }
        
        response = requests.get(f"{base_url}/sports/americanfootball_nfl/odds", params=params)
        if response.status_code == 200:
            games = response.json()
            print(f"✅ Found {len(games)} games with player props")
            
            for game in games[:2]:  # Show first 2 games with props
                home_team = game.get('home_team')
                away_team = game.get('away_team')
                bookmakers = game.get('bookmakers', [])
                
                print(f"  - {away_team} @ {home_team}")
                
                for bookmaker in bookmakers[:1]:  # Show first bookmaker
                    markets = bookmaker.get('markets', [])
                    for market in markets:
                        market_key = market.get('key')
                        outcomes = market.get('outcomes', [])
                        print(f"    {market_key}: {len(outcomes)} player outcomes")
                        
                        # Show sample player outcomes
                        for outcome in outcomes[:2]:
                            player_name = outcome.get('description')
                            point = outcome.get('point')
                            price = outcome.get('price')
                            print(f"      {player_name} O/U {point} ({price})")
        else:
            print(f"❌ Player props error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Player props error: {e}")
    
    # Test 4: Check historical/completed games
    print("\n🔍 Testing historical games...")
    try:
        # Check for historical endpoint or recent completed games
        params = {
            "apiKey": api_key,
            "regions": "us",
            "markets": "h2h",
            "oddsFormat": "american",
            "dateFormat": "iso"
        }
        
        response = requests.get(f"{base_url}/sports/americanfootball_nfl/odds/history", params=params)
        if response.status_code == 200:
            print("✅ Historical endpoint available!")
        else:
            print(f"❌ Historical endpoint: {response.status_code}")
            
        # Try events endpoint
        response = requests.get(f"{base_url}/sports/americanfootball_nfl/events", params=params)
        if response.status_code == 200:
            events = response.json()
            print(f"✅ Events endpoint: {len(events)} events found")
        else:
            print(f"❌ Events endpoint: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Historical data error: {e}")
    
    # Test 5: API usage check
    print("\n🔍 Checking API usage...")
    try:
        response = requests.get(f"{base_url}/sports", params={"apiKey": api_key})
        remaining = response.headers.get('x-requests-remaining')
        used = response.headers.get('x-requests-used')
        
        if remaining or used:
            print(f"✅ API Usage - Remaining: {remaining}, Used: {used}")
        else:
            print("ℹ️ No usage info in headers")
    except Exception as e:
        print(f"❌ Usage check error: {e}")

if __name__ == "__main__":
    test_theodds_api()

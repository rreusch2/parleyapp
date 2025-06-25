#!/usr/bin/env python3
"""
Check what markets are actually supported by TheOdds API for MLB
"""

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('THEODDS_API_KEY')
if not api_key:
    print("❌ THEODDS_API_KEY not found")
    exit(1)

base_url = "https://api.the-odds-api.com/v4"

def check_supported_markets():
    """Check what markets are supported for MLB"""
    print("🧪 CHECKING SUPPORTED MARKETS FOR MLB")
    print("=" * 60)
    
    # First, get current games to see what markets are available
    url = f"{base_url}/sports/baseball_mlb/odds"
    params = {
        'apiKey': api_key,
        'regions': 'us'
    }
    
    try:
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Found {len(data)} current MLB games")
            
            if data:
                # Check what markets are available in the first game
                first_game = data[0]
                print(f"🏟️  Sample game: {first_game.get('away_team')} @ {first_game.get('home_team')}")
                
                all_markets = set()
                for bookmaker in first_game.get('bookmakers', []):
                    for market in bookmaker.get('markets', []):
                        all_markets.add(market.get('key'))
                
                print(f"📊 Available markets in this game:")
                for market in sorted(all_markets):
                    print(f"   - {market}")
                
                print()
                
                # Try to get a game with more markets
                print("🔍 Checking all games for market variety...")
                all_markets_across_games = set()
                
                for game in data:
                    for bookmaker in game.get('bookmakers', []):
                        for market in bookmaker.get('markets', []):
                            all_markets_across_games.add(market.get('key'))
                
                print(f"📊 All markets across {len(data)} games:")
                for market in sorted(all_markets_across_games):
                    print(f"   - {market}")
                    
            else:
                print("❌ No current games found")
        else:
            print(f"❌ HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def test_player_props_endpoints():
    """Test different endpoints that might have player props"""
    print("\n🧪 TESTING DIFFERENT PLAYER PROPS ENDPOINTS")
    print("=" * 60)
    
    # Test different possible endpoints
    endpoints_to_test = [
        "/sports/baseball_mlb/odds",
        "/sports/baseball_mlb/odds/player_props", 
        "/sports/baseball_mlb/player_props",
        "/sports/baseball_mlb/props"
    ]
    
    for endpoint in endpoints_to_test:
        print(f"🔍 Testing: {endpoint}")
        
        url = f"{base_url}{endpoint}"
        params = {
            'apiKey': api_key,
            'regions': 'us'
        }
        
        try:
            response = requests.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ SUCCESS: Found {len(data)} results")
                
                if data and isinstance(data, list):
                    # Check for player props markets
                    sample_game = data[0]
                    markets = set()
                    
                    for bookmaker in sample_game.get('bookmakers', []):
                        for market in bookmaker.get('markets', []):
                            market_key = market.get('key')
                            if any(prop in market_key for prop in ['batter', 'pitcher', 'player']):
                                markets.add(market_key)
                    
                    if markets:
                        print(f"   🎯 Player prop markets found:")
                        for market in sorted(markets):
                            print(f"      - {market}")
                    else:
                        print(f"   ❌ No player prop markets found")
                        
            elif response.status_code == 404:
                print(f"   ❌ Endpoint not found (404)")
            else:
                print(f"   ❌ HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        print()

if __name__ == "__main__":
    check_supported_markets()
    test_player_props_endpoints() 
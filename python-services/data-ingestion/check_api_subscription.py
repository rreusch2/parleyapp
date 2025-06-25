#!/usr/bin/env python3
"""
Check TheOdds API subscription details and available markets
"""

import os
import requests
from dotenv import load_dotenv
import json

load_dotenv()

api_key = os.getenv('THEODDS_API_KEY')
if not api_key:
    print("❌ THEODDS_API_KEY not found")
    exit(1)

print(f"🔑 API Key: {api_key[:10]}...")

# Check available sports
print("\n📊 Checking available sports...")
sports_url = "https://api.the-odds-api.com/v4/sports"
sports_params = {'apiKey': api_key}

sports_response = requests.get(sports_url, params=sports_params)
print(f"Status: {sports_response.status_code}")
print(f"Remaining requests: {sports_response.headers.get('x-requests-remaining', 'Unknown')}")
print(f"Used requests: {sports_response.headers.get('x-requests-used', 'Unknown')}")

if sports_response.status_code == 200:
    sports = sports_response.json()
    
    # Group by active/inactive
    active_sports = [s for s in sports if s.get('active', False)]
    print(f"\n✅ Active sports ({len(active_sports)}):")
    
    # Check for MLB specifically
    mlb_found = False
    for sport in active_sports:
        if sport['key'] == 'baseball_mlb':
            mlb_found = True
            print(f"  ⚾ {sport['key']} - {sport['title']} ✅")
        else:
            print(f"  • {sport['key']} - {sport['title']}")
    
    if not mlb_found:
        print("\n⚠️ MLB is not in your active sports list!")

# Test specifically documented MLB prop markets
print("\n📊 Testing documented MLB prop markets...")
mlb_event_url = "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds"
mlb_params = {
    'apiKey': api_key,
    'regions': 'us',
    'markets': 'h2h',
    'oddsFormat': 'american'
}

mlb_response = requests.get(mlb_event_url, params=mlb_params)
if mlb_response.status_code == 200 and mlb_response.json():
    event = mlb_response.json()[0]
    event_id = event['id']
    
    # Test markets that are documented in API docs
    documented_markets = {
        # These are from the API documentation
        'batter_home_runs': 'Batter Home Runs O/U',
        'batter_hits': 'Batter Hits O/U', 
        'batter_runs_scored': 'Batter Runs Scored O/U',
        'batter_rbis': 'Batter RBIs O/U',
        'batter_total_bases': 'Batter Total Bases O/U',
        'batter_singles': 'Batter Singles O/U',
        'batter_doubles': 'Batter Doubles O/U',
        'batter_triples': 'Batter Triples O/U',
        'batter_walks': 'Batter Walks O/U',
        'batter_strikeouts': 'Batter Strikeouts O/U',
        'batter_stolen_bases': 'Batter Stolen Bases O/U',
        'pitcher_strikeouts': 'Pitcher Strikeouts O/U',
        'pitcher_hits_allowed': 'Pitcher Hits Allowed O/U',
        'pitcher_walks': 'Pitcher Walks O/U',
        'pitcher_earned_runs': 'Pitcher Earned Runs O/U',
        'pitcher_outs': 'Pitcher Outs O/U'
    }
    
    print(f"\nTesting event: {event['away_team']} @ {event['home_team']}")
    
    # Try each market individually
    working_markets = []
    for market_key, market_name in documented_markets.items():
        props_url = f"https://api.the-odds-api.com/v4/sports/baseball_mlb/events/{event_id}/odds"
        props_params = {
            'apiKey': api_key,
            'regions': 'us',
            'markets': market_key,
            'oddsFormat': 'american',
            'bookmakers': 'draftkings,fanduel'
        }
        
        props_response = requests.get(props_url, params=props_params)
        
        if props_response.status_code == 200:
            data = props_response.json()
            has_data = bool(data.get('bookmakers', []))
            if has_data:
                # Check if bookmakers actually have this market
                market_found = False
                for bm in data['bookmakers']:
                    for mkt in bm.get('markets', []):
                        if mkt['key'] == market_key:
                            market_found = True
                            working_markets.append(market_key)
                            break
                
                if market_found:
                    print(f"  ✅ {market_key}: Available with data")
                else:
                    print(f"  ⚠️  {market_key}: Accepted but no data")
            else:
                print(f"  ❌ {market_key}: No bookmaker data")
        else:
            print(f"  ❌ {market_key}: Error {props_response.status_code}")
    
    if working_markets:
        print(f"\n✅ Working MLB prop markets: {', '.join(working_markets)}")
    else:
        print("\n⚠️ No MLB prop markets are returning data!")
        print("\nPossible reasons:")
        print("1. Your API subscription tier might not include player props")
        print("2. Player props might not be available for current MLB games") 
        print("3. The bookmakers you're querying might not offer these props")
        print("\nContact TheOdds API support to confirm your subscription includes player props")

# Try a simple test with all markets unfiltered
print("\n📊 Final test - all markets for first MLB game...")
if mlb_response.status_code == 200 and mlb_response.json():
    all_url = f"https://api.the-odds-api.com/v4/sports/baseball_mlb/events/{event_id}/odds"
    all_params = {
        'apiKey': api_key,
        'regions': 'us',
        'oddsFormat': 'american'
    }
    
    all_response = requests.get(all_url, params=all_params)
    if all_response.status_code == 200:
        all_data = all_response.json()
        if all_data.get('bookmakers'):
            found_markets = set()
            for bm in all_data['bookmakers']:
                for mkt in bm.get('markets', []):
                    found_markets.add(mkt['key'])
            
            print(f"Markets available for this game: {', '.join(sorted(found_markets))}")
            
            # Save full response for debugging
            with open('mlb_markets_debug.json', 'w') as f:
                json.dump(all_data, f, indent=2)
            print("\n💾 Full response saved to mlb_markets_debug.json for inspection") 
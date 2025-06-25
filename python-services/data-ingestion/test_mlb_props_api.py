#!/usr/bin/env python3
"""
Quick test script to verify MLB player props API access
"""

import os
import requests
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

api_key = os.getenv('THEODDS_API_KEY')
if not api_key:
    print("❌ THEODDS_API_KEY not found in environment")
    exit(1)

print(f"✅ API Key found: {api_key[:10]}...")

# Test 1: Get MLB events
print("\n📋 TEST 1: Getting MLB events...")
events_url = "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds"
events_params = {
    'apiKey': api_key,
    'regions': 'us', 
    'markets': 'h2h',
    'oddsFormat': 'american'
}

events_response = requests.get(events_url, params=events_params)
print(f"Status: {events_response.status_code}")

if events_response.status_code == 200:
    events = events_response.json()
    print(f"Found {len(events)} MLB events")
    
    # Show current time
    current_time = datetime.now(timezone.utc)
    print(f"\n⏰ Current time: {current_time.strftime('%Y-%m-%d %H:%M UTC')}")
    
    # Find upcoming games (not started yet)
    upcoming_games = []
    for event in events:
        game_time = datetime.fromisoformat(event['commence_time'].replace('Z', '+00:00'))
        time_diff = (game_time - current_time).total_seconds() / 3600  # hours until game
        
        status = "✅ UPCOMING" if time_diff > 0 else "❌ STARTED/FINISHED"
        print(f"\n{status} {event['away_team']} @ {event['home_team']}")
        print(f"  Start time: {game_time.strftime('%Y-%m-%d %H:%M UTC')} ({time_diff:.1f} hours from now)")
        
        if time_diff > 0:
            upcoming_games.append(event)
            # Check for Red Sox vs Giants
            if ('Red Sox' in event['away_team'] or 'Red Sox' in event['home_team']) and \
               ('Giants' in event['away_team'] or 'Giants' in event['home_team']):
                print(f"  🎯 Found Red Sox vs Giants game!")
    
    print(f"\n📊 Found {len(upcoming_games)} upcoming games out of {len(events)} total")
    
    if upcoming_games:
        # Test 2: Try player props for first UPCOMING game
        event = upcoming_games[0]
        event_id = event['id']
        print(f"\n📋 TEST 2: Testing props for UPCOMING game: {event['away_team']} @ {event['home_team']}")
        print(f"Event ID: {event_id}")
        
        # Test different market combinations
        test_markets = [
            'batter_hits',
            'pitcher_strikeouts',
            'batter_home_runs',
            'batter_rbis',
            'batter_hits,pitcher_strikeouts,batter_home_runs,batter_rbis'  # Multiple at once
        ]
        
        props_url = f"https://api.the-odds-api.com/v4/sports/baseball_mlb/events/{event_id}/odds"
        
        for markets in test_markets:
            print(f"\n🧪 Testing markets: {markets}")
            props_params = {
                'apiKey': api_key,
                'regions': 'us',
                'markets': markets,
                'oddsFormat': 'american',
                'bookmakers': 'draftkings,fanduel,betmgm,caesars'
            }
            
            props_response = requests.get(props_url, params=props_params)
            print(f"  Status: {props_response.status_code}")
            
            if props_response.status_code == 200:
                data = props_response.json()
                if 'bookmakers' in data and data['bookmakers']:
                    print(f"  ✅ SUCCESS! Found {len(data['bookmakers'])} bookmakers with data")
                    # Show first bookmaker's markets
                    for bm in data['bookmakers'][:2]:
                        print(f"  Bookmaker: {bm['key']}")
                        for mkt in bm.get('markets', []):
                            print(f"    Market: {mkt['key']} - {len(mkt.get('outcomes', []))} outcomes")
                            # Show first few player names
                            for outcome in mkt.get('outcomes', [])[:3]:
                                print(f"      - {outcome.get('name', 'Unknown')} {outcome.get('description', '')}")
                    break  # Found working props, no need to test more
                else:
                    print(f"  ⚠️ Empty response - no bookmaker data")
            else:
                print(f"  ❌ Error: {props_response.text[:200]}")
        
        # Test 3: Get all available markets (no filter) for upcoming game
        print(f"\n📋 TEST 3: Getting ALL available markets for upcoming game...")
        all_params = {
            'apiKey': api_key,
            'regions': 'us',
            'oddsFormat': 'american'
        }
        
        all_response = requests.get(props_url, params=all_params)
        print(f"Status: {all_response.status_code}")
        
        if all_response.status_code == 200:
            all_data = all_response.json()
            
            if 'bookmakers' in all_data and all_data['bookmakers']:
                all_markets = set()
                for bm in all_data['bookmakers']:
                    for mkt in bm.get('markets', []):
                        all_markets.add(mkt['key'])
                
                print(f"✅ All available markets: {', '.join(sorted(all_markets))}")
                
                # Filter for player/batter/pitcher markets
                prop_markets = [m for m in all_markets if any(x in m for x in ['batter', 'pitcher', 'player'])]
                if prop_markets:
                    print(f"⚾ Player prop markets: {', '.join(sorted(prop_markets))}")
                else:
                    print("⚠️ No player prop markets found in available markets")
            else:
                print("⚠️ No bookmaker data available for this game")
    else:
        print("\n❌ No upcoming games found! All games may have already started.")
                
else:
    print(f"❌ Failed to get events: {events_response.text[:500]}")

# Show remaining quota
print(f"\n📊 Remaining requests: {events_response.headers.get('x-requests-remaining', 'Unknown')}")
print(f"📊 Used requests: {events_response.headers.get('x-requests-used', 'Unknown')}") 
#!/usr/bin/env python3
"""
Debug script to see actual API response structure for player props
"""

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('THEODDS_API_KEY')
print(f"✅ API Key: {api_key[:10]}...")

# Get first upcoming MLB game
events_url = "https://api.the-odds-api.com/v4/sports/baseball_mlb/odds"
events_params = {
    'apiKey': api_key,
    'regions': 'us',
    'markets': 'h2h',
    'oddsFormat': 'american'
}

events_response = requests.get(events_url, params=events_params)
events = events_response.json()

if events:
    # Find first upcoming game
    from datetime import datetime, timezone
    current_time = datetime.now(timezone.utc)
    
    upcoming_events = []
    for event in events:
        game_time = datetime.fromisoformat(event['commence_time'].replace('Z', '+00:00'))
        if (game_time - current_time).total_seconds() > 0:
            upcoming_events.append(event)
    
    if upcoming_events:
        event = upcoming_events[0]
        event_id = event['id']
        print(f"\n🎯 Testing: {event['away_team']} @ {event['home_team']}")
        print(f"Event ID: {event_id}")
        
        # Get player props for this event
        props_url = f"https://api.the-odds-api.com/v4/sports/baseball_mlb/events/{event_id}/odds"
        props_params = {
            'apiKey': api_key,
            'regions': 'us',
            'markets': 'batter_hits',  # Just one market for cleaner output
            'oddsFormat': 'american',
            'bookmakers': 'fanduel'  # Just one bookmaker for cleaner output
        }
        
        props_response = requests.get(props_url, params=props_params)
        if props_response.status_code == 200:
            props_data = props_response.json()
            
            # Save full response to file for inspection
            with open('debug_props_response.json', 'w') as f:
                json.dump(props_data, f, indent=2)
            
            print("\n📋 FULL API RESPONSE STRUCTURE:")
            print("="*50)
            
            if 'bookmakers' in props_data and props_data['bookmakers']:
                for bm in props_data['bookmakers']:
                    print(f"\n📊 Bookmaker: {bm['key']}")
                    
                    for market in bm.get('markets', []):
                        print(f"\n  Market: {market['key']}")
                        print(f"  Outcomes count: {len(market.get('outcomes', []))}")
                        
                        # Show first 5 outcomes with ALL fields
                        for i, outcome in enumerate(market.get('outcomes', [])[:5]):
                            print(f"\n    Outcome {i+1}:")
                            for key, value in outcome.items():
                                print(f"      {key}: {value}")
                        
                        if len(market.get('outcomes', [])) > 5:
                            print(f"    ... and {len(market.get('outcomes', [])) - 5} more outcomes")
            
            print("\n💾 Full response saved to debug_props_response.json")
            
        else:
            print(f"❌ Props request failed: {props_response.status_code}")
            print(f"Response: {props_response.text}")
    else:
        print("❌ No upcoming games found")
else:
    print("❌ No events found") 
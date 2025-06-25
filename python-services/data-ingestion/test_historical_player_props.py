#!/usr/bin/env python3
"""
Test TheOdds API for historical MLB player props from past 2 weeks
"""

import os
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('THEODDS_API_KEY')
if not api_key:
    print("❌ THEODDS_API_KEY not found")
    exit(1)

base_url = "https://api.the-odds-api.com/v4"

def test_historical_player_props():
    """Test if we can get historical player props for specific dates"""
    print("🧪 TESTING HISTORICAL MLB PLAYER PROPS")
    print("=" * 60)
    
    # Test dates from past 2 weeks
    test_dates = []
    for i in range(14):
        date = datetime.now() - timedelta(days=i+1)
        test_dates.append(date.strftime('%Y-%m-%d'))
    
    print(f"📅 Testing dates: {test_dates[0]} to {test_dates[-1]}")
    print()
    
    # Player props markets we want to test
    target_markets = [
        'batter_hits',
        'batter_home_runs', 
        'batter_rbis',
        'batter_runs_scored',
        'batter_strikeouts',
        'pitcher_strikeouts'
    ]
    
    for date in test_dates[:3]:  # Test first 3 dates
        print(f"🗓️  TESTING DATE: {date}")
        print("-" * 40)
        
        # Try to get historical odds for this date
        for market in target_markets[:2]:  # Test first 2 markets
            url = f"{base_url}/sports/baseball_mlb/odds/history"
            params = {
                'apiKey': api_key,
                'regions': 'us',
                'markets': market,
                'date': date,
                'dateFormat': 'iso'
            }
            
            try:
                print(f"   📊 Testing market: {market}")
                response = requests.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    if data:
                        print(f"   ✅ SUCCESS: Found {len(data)} events with {market} props")
                        
                        # Show sample data
                        for event in data[:2]:  # Show first 2 events
                            print(f"      🏟️  {event.get('away_team')} @ {event.get('home_team')}")
                            
                            for bookmaker in event.get('bookmakers', [])[:1]:  # Show first bookmaker
                                print(f"         📚 {bookmaker.get('title')}")
                                
                                for market_data in bookmaker.get('markets', []):
                                    if market_data.get('key') == market:
                                        print(f"         🎯 {market} outcomes:")
                                        for outcome in market_data.get('outcomes', [])[:3]:  # Show first 3
                                            print(f"            {outcome.get('description', outcome.get('name'))}: {outcome.get('price')}")
                                        break
                            print()
                        break
                    else:
                        print(f"   ❌ No data found for {market} on {date}")
                else:
                    print(f"   ❌ HTTP {response.status_code}: {response.text}")
                    
            except Exception as e:
                print(f"   ❌ Error testing {market}: {e}")
            
            print()
        
        print()

def test_current_player_props():
    """Test current player props to see data structure"""
    print("🧪 TESTING CURRENT MLB PLAYER PROPS")
    print("=" * 60)
    
    url = f"{base_url}/sports/baseball_mlb/odds"
    params = {
        'apiKey': api_key,
        'regions': 'us',
        'markets': 'batter_hits,batter_home_runs',
        'oddsFormat': 'american'
    }
    
    try:
        response = requests.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Found {len(data)} current games with player props")
            
            # Show sample current data
            for event in data[:1]:  # Show first event
                print(f"🏟️  {event.get('away_team')} @ {event.get('home_team')}")
                print(f"📅 Game time: {event.get('commence_time')}")
                
                for bookmaker in event.get('bookmakers', [])[:1]:  # Show first bookmaker
                    print(f"📚 {bookmaker.get('title')}")
                    
                    for market in bookmaker.get('markets', []):
                        print(f"🎯 Market: {market.get('key')}")
                        
                        for outcome in market.get('outcomes', [])[:5]:  # Show first 5
                            print(f"   {outcome.get('description', outcome.get('name'))}: {outcome.get('price')}")
                        print()
                break
        else:
            print(f"❌ HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_historical_player_props()
    print("\n" + "="*60 + "\n")
    test_current_player_props() 
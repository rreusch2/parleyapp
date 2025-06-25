#!/usr/bin/env python3
"""
Test script for The Odds API
Verifies API key and basic functionality
"""

import os
import sys
import json
import asyncio
import httpx
from datetime import datetime, timedelta
from typing import Dict, List

# Add your API key here or set it as environment variable
API_KEY = os.getenv('THEODDS_API_KEY', 'YOUR_API_KEY_HERE')
BASE_URL = "https://api.the-odds-api.com/v4"

async def test_api_connection():
    """Test basic API connection and key validity"""
    print("\n🔧 Testing The Odds API Connection...")
    print("=" * 50)
    
    async with httpx.AsyncClient() as client:
        try:
            # Test API key validity
            response = await client.get(
                f"{BASE_URL}/sports",
                params={'apiKey': API_KEY}
            )
            response.raise_for_status()
            
            sports = response.json()
            remaining_requests = response.headers.get('x-requests-remaining', 'N/A')
            used_requests = response.headers.get('x-requests-used', 'N/A')
            
            print(f"✅ API Key is valid!")
            print(f"📊 API Usage: {used_requests} used / {remaining_requests} remaining")
            print(f"🏈 Available sports: {len(sports)}")
            
            # Show some available sports
            print("\n📋 Sample sports available:")
            for sport in sports[:5]:
                print(f"  - {sport['title']} ({sport['key']})")
            
            return True
            
        except httpx.HTTPStatusError as e:
            print(f"❌ API Error: {e.response.status_code}")
            print(f"   Message: {e.response.text}")
            return False
        except Exception as e:
            print(f"❌ Connection Error: {str(e)}")
            return False

async def test_live_games():
    """Test fetching live games"""
    print("\n🏀 Testing Live Games Endpoint...")
    print("=" * 50)
    
    sports_to_test = [
        'basketball_nba',
        'americanfootball_nfl', 
        'baseball_mlb',
        'icehockey_nhl'
    ]
    
    async with httpx.AsyncClient() as client:
        for sport in sports_to_test:
            try:
                response = await client.get(
                    f"{BASE_URL}/sports/{sport}/events",
                    params={'apiKey': API_KEY}
                )
                
                if response.status_code == 200:
                    events = response.json()
                    print(f"\n{sport}:")
                    print(f"  📅 Total games: {len(events)}")
                    
                    # Show next game
                    if events:
                        next_game = events[0]
                        print(f"  🎮 Next game: {next_game['home_team']} vs {next_game['away_team']}")
                        start_time = datetime.fromisoformat(next_game['commence_time'].replace('Z', '+00:00'))
                        print(f"  ⏰ Start time: {start_time.strftime('%Y-%m-%d %H:%M')}")
                else:
                    print(f"\n{sport}: No active season or games")
                    
            except Exception as e:
                print(f"\n{sport}: Error - {str(e)}")

async def test_odds_data():
    """Test fetching odds data"""
    print("\n💰 Testing Odds Data Endpoint...")
    print("=" * 50)
    
    # Try to get odds for NBA
    sport = 'basketball_nba'
    
    async with httpx.AsyncClient() as client:
        try:
            # First get events
            events_response = await client.get(
                f"{BASE_URL}/sports/{sport}/events",
                params={'apiKey': API_KEY}
            )
            
            if events_response.status_code == 200:
                events = events_response.json()
                
                if events:
                    # Get odds for the first event
                    event = events[0]
                    
                    response = await client.get(
                        f"{BASE_URL}/sports/{sport}/odds",
                        params={
                            'apiKey': API_KEY,
                            'eventIds': event['id'],
                            'regions': 'us',
                            'markets': 'h2h,spreads,totals'
                        }
                    )
                    
                    if response.status_code == 200:
                        odds_data = response.json()
                        
                        if odds_data:
                            game = odds_data[0]
                            print(f"\n🏀 Game: {game['home_team']} vs {game['away_team']}")
                            
                            # Show odds from different bookmakers
                            print("\n📊 Sample Odds:")
                            for bookmaker in game.get('bookmakers', [])[:3]:
                                print(f"\n  {bookmaker['title']}:")
                                
                                for market in bookmaker['markets']:
                                    print(f"    {market['key']}:")
                                    for outcome in market['outcomes']:
                                        print(f"      {outcome['name']}: {outcome['price']}")
                        else:
                            print("  No odds available for this game yet")
                else:
                    print(f"  No {sport} games available")
                    
        except Exception as e:
            print(f"  Error fetching odds: {str(e)}")

async def test_player_props():
    """Test fetching player props"""
    print("\n🎯 Testing Player Props Endpoint...")
    print("=" * 50)
    
    sport = 'basketball_nba'
    
    async with httpx.AsyncClient() as client:
        try:
            # Get events first
            events_response = await client.get(
                f"{BASE_URL}/sports/{sport}/events",
                params={'apiKey': API_KEY}
            )
            
            if events_response.status_code == 200:
                events = events_response.json()
                
                if events:
                    event = events[0]
                    
                    # Get player props
                    response = await client.get(
                        f"{BASE_URL}/sports/{sport}/events/{event['id']}/odds",
                        params={
                            'apiKey': API_KEY,
                            'regions': 'us',
                            'markets': 'player_points,player_rebounds,player_assists'
                        }
                    )
                    
                    if response.status_code == 200:
                        props_data = response.json()
                        print(f"\n🏀 Game: {event['home_team']} vs {event['away_team']}")
                        
                        if props_data.get('bookmakers'):
                            bookmaker = props_data['bookmakers'][0]
                            print(f"\n📚 Bookmaker: {bookmaker['title']}")
                            
                            for market in bookmaker.get('markets', [])[:3]:
                                if 'player_' in market['key']:
                                    print(f"\n  {market['key']}:")
                                    for outcome in market.get('outcomes', [])[:2]:
                                        print(f"    {outcome.get('description', 'N/A')}: {outcome['price']}")
                        else:
                            print("  No player props available for this game")
                    else:
                        print(f"  Player props not available: {response.status_code}")
                else:
                    print("  No games available")
                    
        except Exception as e:
            print(f"  Error fetching player props: {str(e)}")

async def main():
    """Run all tests"""
    print("🚀 The Odds API Test Suite")
    print("=" * 70)
    print(f"API Key: {'*' * 20}{API_KEY[-4:] if len(API_KEY) > 4 else 'NOT SET'}")
    
    # Test connection first
    if await test_api_connection():
        # Run other tests
        await test_live_games()
        await test_odds_data()
        await test_player_props()
    else:
        print("\n⚠️  Please check your API key and try again.")
        print("Set it as environment variable: export THEODDS_API_KEY='your_key_here'")

if __name__ == "__main__":
    asyncio.run(main()) 
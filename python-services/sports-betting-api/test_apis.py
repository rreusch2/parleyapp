#!/usr/bin/env python3
"""
Test script to verify Reid's API keys and endpoints
"""

import requests
import os
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

def test_odds_api():
    """Test The Odds API"""
    print("🎯 Testing The Odds API...")
    
    odds_key = os.getenv('ODDS_API_KEY')
    if not odds_key:
        print("❌ ODDS_API_KEY not found")
        return False
    
    try:
        # Test available sports
        url = 'https://api.the-odds-api.com/v4/sports'
        params = {'api_key': odds_key}
        response = requests.get(url, params=params, timeout=10)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Found {len(data)} available sports")
            
            # Show active sports
            active_sports = [s for s in data if s.get('active')]
            print(f"📊 Active sports: {len(active_sports)}")
            
            for sport in active_sports[:5]:
                print(f"   - {sport.get('title', 'Unknown')} ({sport.get('key', 'N/A')})")
            
            # Test getting odds for NBA if available
            nba_sports = [s for s in data if 'nba' in s.get('key', '').lower()]
            if nba_sports:
                sport_key = nba_sports[0]['key']
                print(f"\n🏀 Testing NBA odds ({sport_key})...")
                
                odds_url = f'https://api.the-odds-api.com/v4/sports/{sport_key}/odds'
                odds_params = {
                    'api_key': odds_key,
                    'regions': 'us',
                    'markets': 'h2h',
                    'oddsFormat': 'american'
                }
                
                odds_response = requests.get(odds_url, params=odds_params, timeout=10)
                if odds_response.status_code == 200:
                    odds_data = odds_response.json()
                    print(f"✅ Found odds for {len(odds_data)} NBA games")
                else:
                    print(f"❌ NBA odds error: {odds_response.status_code}")
            
            return True
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Odds API Error: {e}")
        return False

def test_thesportsdb():
    """Test TheSportsDB API"""
    print("\n🏟️ Testing TheSportsDB API...")
    
    try:
        # Test basic endpoint
        url = 'https://www.thesportsdb.com/api/v1/json/1/all_leagues.php'
        response = requests.get(url, timeout=10)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            leagues = data.get('leagues', [])
            print(f"✅ Found {len(leagues)} leagues")
            
            # Find NBA
            nba_leagues = [l for l in leagues if 'NBA' in l.get('strLeague', '')]
            if nba_leagues:
                nba_id = nba_leagues[0].get('idLeague')
                print(f"🏀 NBA League ID: {nba_id}")
                
                # Test NBA teams
                teams_url = f'https://www.thesportsdb.com/api/v1/json/1/lookup_all_teams.php?id={nba_id}'
                teams_response = requests.get(teams_url, timeout=10)
                if teams_response.status_code == 200:
                    teams_data = teams_response.json()
                    teams = teams_data.get('teams', [])
                    print(f"✅ Found {len(teams)} NBA teams")
                    
                    if teams:
                        # Test getting players for first team
                        team_name = teams[0].get('strTeam')
                        print(f"🔍 Testing players for {team_name}...")
                        
                        players_url = f'https://www.thesportsdb.com/api/v1/json/1/searchplayers.php?t={team_name}'
                        players_response = requests.get(players_url, timeout=10)
                        if players_response.status_code == 200:
                            players_data = players_response.json()
                            players = players_data.get('player', [])
                            print(f"✅ Found {len(players)} players for {team_name}")
                        else:
                            print(f"❌ Players error: {players_response.status_code}")
                
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ TheSportsDB Error: {e}")
        return False

def test_sportsradar():
    """Test SportsRadar API"""
    print("\n📡 Testing SportsRadar API...")
    
    sportsradar_key = os.getenv('SPORTRADAR_API_KEY')
    if not sportsradar_key:
        print("❌ SPORTRADAR_API_KEY not found")
        return False
    
    try:
        # Test with current NBA season endpoint
        # Try different URL patterns for SportsRadar
        test_urls = [
            f"https://api.sportradar.us/nba/trial/v8/en/seasons.json?api_key={sportsradar_key}",
            f"https://api.sportradar.us/nba/official/trial/v7/en/seasons.json?api_key={sportsradar_key}",
            f"https://api.sportradar.us/nba/trial/v7/en/seasons.json?api_key={sportsradar_key}"
        ]
        
        for url in test_urls:
            print(f"🔍 Trying: {url.split('?')[0]}...")
            response = requests.get(url, timeout=10)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ SportsRadar API working!")
                print(f"   Response keys: {list(data.keys()) if isinstance(data, dict) else 'List response'}")
                return True
            elif response.status_code == 401:
                print("❌ Unauthorized - check API key")
                return False
            elif response.status_code == 403:
                print("❌ Forbidden - check API permissions")
                return False
                
        print("❌ All SportsRadar endpoints failed")
        return False
        
    except Exception as e:
        print(f"❌ SportsRadar Error: {e}")
        return False

def main():
    """Run all API tests"""
    print("🔑 Testing Reid's Sports APIs...")
    print(f"Environment file: {os.path.exists('.env')}")
    
    # Test each API
    odds_working = test_odds_api()
    thesportsdb_working = test_thesportsdb()
    sportsradar_working = test_sportsradar()
    
    print(f"\n📊 API Test Results:")
    print(f"   Odds API: {'✅ Working' if odds_working else '❌ Failed'}")
    print(f"   TheSportsDB: {'✅ Working' if thesportsdb_working else '❌ Failed'}")
    print(f"   SportsRadar: {'✅ Working' if sportsradar_working else '❌ Failed'}")
    
    if any([odds_working, thesportsdb_working, sportsradar_working]):
        print("\n🎉 At least one API is working! Ready for integration.")
    else:
        print("\n⚠️ No APIs are responding. Check your keys and endpoints.")

if __name__ == "__main__":
    main() 
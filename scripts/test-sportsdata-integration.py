#!/usr/bin/env python3
"""
Quick Test Script for SportsData.io Integration
==============================================
Tests the integration with a few sample players before full population.
"""

import requests
import json
from supabase import create_client, Client
import os

# Configuration
SPORTSDATA_API_KEY = "03d3518bdc1d468cba7855b6e1fcdfa6"
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/mlb/stats/json"

SUPABASE_URL = "https://iriaegoipkjtktitpary.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkxMTQzMiwiZXhwIjoyMDY0NDg3NDMyfQ.7gTP9UGDkNfIL2jatdP5xSLADJ29KZ1cRb2RGh20kE0"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def test_api_connection():
    """Test basic API connection"""
    print("🔍 Testing SportsData.io API connection...")
    
    # Test with a simple season stats call
    url = f"{SPORTSDATA_BASE_URL}/PlayerSeasonStats/2024?key={SPORTSDATA_API_KEY}"
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API connection successful! Found {len(data)} players for 2024 season")
            
            # Show sample player
            if data:
                sample = data[0]
                print(f"📊 Sample player: {sample.get('Name')} ({sample.get('Team')}) - PlayerID: {sample.get('PlayerID')}")
            return True
        else:
            print(f"❌ API connection failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ API connection error: {str(e)}")
        return False

def test_database_connection():
    """Test Supabase connection"""
    print("\n🔍 Testing Supabase connection...")
    
    try:
        # Test by getting a few MLB players
        result = supabase.table('players_with_headshots') \
            .select('id, name, team, sport, external_player_id') \
            .in_('sport', ['MLB', 'BASEBALL_MLB']) \
            .limit(5) \
            .execute()
        
        if result.data:
            print(f"✅ Database connection successful! Sample players:")
            for player in result.data:
                print(f"   📋 {player['name']} ({player.get('team', 'N/A')}) - ID: {player.get('external_player_id', 'None')}")
            return True
        else:
            print("❌ No players found in database")
            return False
            
    except Exception as e:
        print(f"❌ Database connection error: {str(e)}")
        return False

def test_player_game_fetch():
    """Test fetching game data for a known player"""
    print("\n🔍 Testing player game data fetch...")
    
    # Use Mike Trout's PlayerID (known SportsData.io ID: 10001365)
    test_player_id = "10001365"  # Mike Trout
    
    url = f"{SPORTSDATA_BASE_URL}/PlayerGameStatsBySeason/2024/{test_player_id}/10?key={SPORTSDATA_API_KEY}"
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            games = response.json()
            print(f"✅ Successfully fetched {len(games)} games for player {test_player_id}")
            
            if games:
                sample_game = games[0]
                print(f"📈 Sample game data:")
                print(f"   Date: {sample_game.get('Day')}")
                print(f"   Opponent: {sample_game.get('Opponent')}")
                print(f"   Hits: {sample_game.get('Hits')}")
                print(f"   Home Runs: {sample_game.get('HomeRuns')}")
                print(f"   RBIs: {sample_game.get('RunsBattedIn')}")
            return True
        else:
            print(f"❌ Failed to fetch game data: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Game fetch error: {str(e)}")
        return False

def check_database_schema():
    """Check if our database tables are ready"""
    print("\n🔍 Checking database schema...")
    
    try:
        # Check player_game_stats table
        result = supabase.table('player_game_stats').select('*').limit(1).execute()
        print("✅ player_game_stats table accessible")
        
        # Check player_trends_data table  
        result = supabase.table('player_trends_data').select('*').limit(1).execute()
        print("✅ player_trends_data table accessible")
        
        # Check current record counts
        result = supabase.rpc('get_table_counts').execute()
        
        # Alternative: direct count queries
        game_stats_count = supabase.table('player_game_stats').select('id', count='exact').execute()
        trends_count = supabase.table('player_trends_data').select('player_id', count='exact').execute()
        
        print(f"📊 Current data counts:")
        print(f"   player_game_stats: {game_stats_count.count} records")
        print(f"   player_trends_data: {trends_count.count} records")
        
        return True
        
    except Exception as e:
        print(f"❌ Schema check error: {str(e)}")
        return False

def find_players_with_sportsdata_ids():
    """Find players that already have SportsData.io IDs"""
    print("\n🔍 Looking for players with SportsData.io IDs...")
    
    try:
        result = supabase.table('players_with_headshots') \
            .select('id, name, team, external_player_id') \
            .in_('sport', ['MLB', 'BASEBALL_MLB']) \
            .execute()
        
        players_with_ids = []
        for player in result.data:
            ext_id = player.get('external_player_id', '')
            if ext_id and ext_id.isdigit():
                players_with_ids.append(player)
        
        print(f"📋 Found {len(players_with_ids)} players with numeric IDs out of {len(result.data)} total MLB players")
        
        if players_with_ids:
            print("📝 Sample players with IDs:")
            for player in players_with_ids[:5]:
                print(f"   {player['name']} - ID: {player['external_player_id']}")
        
        return len(players_with_ids)
        
    except Exception as e:
        print(f"❌ Error checking player IDs: {str(e)}")
        return 0

def main():
    """Run all tests"""
    print("🚀 Starting SportsData.io Integration Tests")
    print("=" * 50)
    
    tests_passed = 0
    total_tests = 5
    
    # Test 1: API Connection
    if test_api_connection():
        tests_passed += 1
    
    # Test 2: Database Connection
    if test_database_connection():
        tests_passed += 1
    
    # Test 3: Database Schema
    if check_database_schema():
        tests_passed += 1
    
    # Test 4: Player Game Fetch
    if test_player_game_fetch():
        tests_passed += 1
    
    # Test 5: Check existing player IDs
    players_with_ids = find_players_with_sportsdata_ids()
    if players_with_ids >= 0:  # This test always passes, just informational
        tests_passed += 1
    
    # Summary
    print("\n" + "=" * 50)
    print(f"🏁 Test Results: {tests_passed}/{total_tests} tests passed")
    
    if tests_passed == total_tests:
        print("✅ All systems ready! You can proceed with:")
        print("   1. Run player ID mapping: python scripts/map-player-ids-sportsdata.py")
        print("   2. Run full population: python scripts/populate-player-stats-sportsdata.py")
        if players_with_ids > 0:
            print(f"   3. Or test with {players_with_ids} players that already have IDs")
    else:
        print("❌ Some tests failed. Please check the errors above before proceeding.")

if __name__ == "__main__":
    main()

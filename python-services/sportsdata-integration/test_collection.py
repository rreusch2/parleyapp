#!/usr/bin/env python3
"""
Test SportsData.io Integration
Quick test to verify API connectivity and database access before full collection
"""

import os
import sys
from dotenv import load_dotenv
from streamlined_collector import StreamlinedSportsCollector

def test_environment():
    """Test environment variables and dependencies"""
    print("🧪 Testing environment setup...")
    
    # Load environment variables
    load_dotenv('/home/reid/Desktop/parleyapp/backend/.env')
    
    required_vars = [
        'SPORTSDATA_API_KEY',
        'SUPABASE_URL', 
        'SUPABASE_SERVICE_ROLE_KEY'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var) or os.getenv(var) == 'your_sportsdata_api_key_here':
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        print("\n📝 Please update your .env file with:")
        print("   - Get SportsData.io API key from: https://sportsdata.io")
        print("   - Update SPORTSDATA_API_KEY in backend/.env")
        return False
    
    print("✅ Environment variables configured")
    return True

def test_api_connection():
    """Test SportsData.io API connection"""
    print("\n🌐 Testing SportsData.io API connection...")
    
    try:
        collector = StreamlinedSportsCollector()
        
        # Try to fetch a simple endpoint
        import requests
        test_url = "https://api.sportsdata.io/v3/nfl/scores/json/AllTeams"
        response = requests.get(test_url, headers=collector.headers, timeout=10)
        
        if response.status_code == 200:
            teams = response.json()
            print(f"✅ API connected successfully - found {len(teams)} NFL teams")
            return True
        elif response.status_code == 401:
            print("❌ API authentication failed - check your SPORTSDATA_API_KEY")
            return False
        else:
            print(f"❌ API error: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ API connection error: {e}")
        return False

def test_database_connection():
    """Test Supabase database connection"""
    print("\n🗄️ Testing Supabase database connection...")
    
    try:
        collector = StreamlinedSportsCollector()
        
        # Test basic query
        result = collector.supabase.table('teams').select('id').limit(1).execute()
        
        if result.data is not None:
            print("✅ Database connected successfully")
            
            # Check existing NFL teams
            nfl_teams = collector.supabase.table('teams').select('*')\
                .eq('sport_key', 'NFL').execute()
            
            print(f"📊 Current NFL teams in database: {len(nfl_teams.data)}")
            return True
        else:
            print("❌ Database query failed")
            return False
            
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False

def run_mini_collection():
    """Run a small test collection (just NFL teams)"""
    print("\n⚡ Running mini test collection...")
    
    try:
        collector = StreamlinedSportsCollector()
        
        # Just collect NFL teams as a test
        success = collector.collect_nfl_teams()
        
        if success:
            print("✅ Mini collection completed successfully!")
            
            # Check results
            nfl_teams = collector.supabase.table('teams').select('*')\
                .eq('sport_key', 'NFL').execute()
            
            print(f"📈 NFL teams now in database: {len(nfl_teams.data)}")
            
            if nfl_teams.data:
                sample_team = nfl_teams.data[0]
                print(f"📝 Sample team: {sample_team.get('team_name')} ({sample_team.get('team_abbreviation')})")
            
            return True
        else:
            print("❌ Mini collection failed")
            return False
            
    except Exception as e:
        print(f"❌ Collection error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 SportsData.io Integration Test Suite")
    print("=" * 50)
    
    tests = [
        ("Environment Setup", test_environment),
        ("API Connection", test_api_connection), 
        ("Database Connection", test_database_connection),
        ("Mini Collection", run_mini_collection)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🔍 Running: {test_name}")
        try:
            success = test_func()
            results.append((test_name, success))
            
            if not success:
                print(f"⏹️ Stopping tests due to {test_name} failure")
                break
                
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
            results.append((test_name, False))
            break
    
    # Print final results
    print("\n" + "=" * 50)
    print("📊 Test Results:")
    
    passed = 0
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status} {test_name}")
        if success:
            passed += 1
    
    total = len(results)
    print(f"\n🎯 Score: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🏆 ALL TESTS PASSED! Ready for full data collection")
        print("\n📋 Next steps:")
        print("  1. Run: python streamlined_collector.py")
        print("  2. This will collect full NFL 2024 season data")
        print("  3. Check your Supabase dashboard for new data")
    else:
        print("\n⚠️ Some tests failed. Please fix issues before proceeding.")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    exit(main())

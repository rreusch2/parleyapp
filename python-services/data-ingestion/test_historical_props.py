#!/usr/bin/env python3
"""
Test script to check if TheOdds API provides historical player props
"""

import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('THEODDS_API_KEY')
if not api_key:
    print("❌ THEODDS_API_KEY not found")
    exit(1)

base_url = "https://api.the-odds-api.com/v4"

def test_historical_endpoint():
    """Test if historical endpoint exists"""
    print("🧪 TESTING HISTORICAL ENDPOINT AVAILABILITY")
    print("=" * 50)
    
    # Try different historical endpoints that might exist
    historical_endpoints = [
        f"{base_url}/sports/baseball_mlb/odds/history",
        f"{base_url}/historical/sports/baseball_mlb/odds",
        f"{base_url}/sports/baseball_mlb/odds?date=2025-06-23",
        f"{base_url}/sports/baseball_mlb/events/odds/history"
    ]
    
    for endpoint in historical_endpoints:
        print(f"\n🔗 Testing: {endpoint}")
        
        params = {
            'apiKey': api_key,
            'regions': 'us',
            'markets': 'batter_hits',
            'oddsFormat': 'american'
        }
        
        try:
            response = requests.get(endpoint, params=params, timeout=10)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ SUCCESS! Data type: {type(data)}")
                if isinstance(data, list):
                    print(f"   Found {len(data)} items")
                elif isinstance(data, dict):
                    print(f"   Keys: {list(data.keys())}")
                return True
            else:
                print(f"❌ Failed: {response.text[:200]}")
                
        except Exception as e:
            print(f"❌ Error: {str(e)[:100]}")
    
    return False

def test_date_parameters():
    """Test if we can query specific dates"""
    print("\n🧪 TESTING DATE PARAMETER SUPPORT")
    print("=" * 50)
    
    # Test dates from last 2 weeks
    test_dates = []
    for i in range(14):
        date = datetime.now() - timedelta(days=i+1)
        test_dates.append(date.strftime('%Y-%m-%d'))
    
    endpoint = f"{base_url}/sports/baseball_mlb/odds"
    
    for date_str in test_dates[:3]:  # Test first 3 dates
        print(f"\n📅 Testing date: {date_str}")
        
        params = {
            'apiKey': api_key,
            'regions': 'us',
            'markets': 'h2h',
            'date': date_str,
            'oddsFormat': 'american'
        }
        
        try:
            response = requests.get(endpoint, params=params, timeout=10)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Found {len(data)} events for {date_str}")
                return True
            else:
                print(f"❌ Failed: {response.text[:150]}")
                
        except Exception as e:
            print(f"❌ Error: {str(e)[:100]}")
    
    return False

def check_api_documentation():
    """Check what the API documentation says about historical data"""
    print("\n📚 API CAPABILITIES CHECK")
    print("=" * 50)
    
    # Check API status and remaining calls
    status_url = f"{base_url}/sports"
    params = {'apiKey': api_key}
    
    try:
        response = requests.get(status_url, params=params)
        print(f"API Status: {response.status_code}")
        print(f"Remaining calls: {response.headers.get('x-requests-remaining', 'Unknown')}")
        
        if response.status_code == 200:
            sports = response.json()
            for sport in sports:
                if sport['key'] == 'baseball_mlb':
                    print(f"\n⚾ MLB Sport Details:")
                    for key, value in sport.items():
                        print(f"   {key}: {value}")
                    break
    except Exception as e:
        print(f"❌ Error checking API status: {e}")

def main():
    print("🔍 THEODDS API HISTORICAL DATA INVESTIGATION")
    print("=" * 60)
    
    # Test 1: Historical endpoints
    has_historical = test_historical_endpoint()
    
    # Test 2: Date parameters
    has_date_params = test_date_parameters()
    
    # Test 3: API documentation
    check_api_documentation()
    
    print("\n🎯 CONCLUSION")
    print("=" * 60)
    print(f"Historical endpoints: {'✅ Available' if has_historical else '❌ Not available'}")
    print(f"Date parameters: {'✅ Available' if has_date_params else '❌ Not available'}")
    
    if not has_historical and not has_date_params:
        print("\n💡 RECOMMENDATION:")
        print("   TheOdds API appears to only provide current/future odds")
        print("   For historical betting results, we should:")
        print("   1. Use typical betting lines for backfill estimation")
        print("   2. Start collecting real lines going forward")
        print("   3. Consider alternative historical data sources")

if __name__ == "__main__":
    main() 
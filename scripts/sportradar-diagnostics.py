#!/usr/bin/env python3
"""
Sportradar API Diagnostics - Determine which APIs your key has access to
"""

import os
import requests

def test_sportradar_endpoints():
    """Test various Sportradar endpoints to determine API access"""
    
    api_key = os.getenv('SPORTRADAR_COLLEGE_API_KEY')
    
    if not api_key:
        print("❌ API key not found")
        return
    
    print(f"🔍 Testing API key: {api_key[:10]}...")
    print("=" * 60)
    
    # Test different Sportradar APIs
    endpoints_to_test = [
        # College Football Data API (most likely what your key is for)
        {
            "name": "College Football Data API",
            "url": f"https://api.sportradar.us/ncaaf/trial/v7/en/games/2024/09/05/schedule.json?api_key={api_key}",
            "expected": "sports data"
        },
        
        # NFL Images API (to test Images API access pattern)
        {
            "name": "NFL Images API (test pattern)",
            "url": "https://api.sportradar.us/nfl-images-t3/usat/headshots/players/manifest.xml",
            "expected": "images"
        },
        
        # College Images API (what we want)
        {
            "name": "College Images API (USAT)",
            "url": "https://api.sportradar.us/ncaaf-images-t3/usat/headshots/players/manifest.xml",
            "expected": "images"
        },
        
        # Alternative college data endpoint
        {
            "name": "College Teams API",
            "url": f"https://api.sportradar.us/ncaaf/trial/v7/en/league/teams.json?api_key={api_key}",
            "expected": "sports data"
        }
    ]
    
    working_endpoints = []
    
    for endpoint in endpoints_to_test:
        print(f"\n🔍 Testing: {endpoint['name']}")
        print(f"URL: {endpoint['url']}")
        
        try:
            response = requests.get(endpoint['url'], timeout=10)
            status = response.status_code
            
            print(f"Status: {status}")
            
            if status == 200:
                print(f"✅ SUCCESS! You have access to {endpoint['expected']}")
                working_endpoints.append(endpoint)
                
                # Show sample of response
                content = response.text[:200] + "..." if len(response.text) > 200 else response.text
                print(f"Sample response: {content}")
                
            elif status == 401:
                print("❌ UNAUTHORIZED - Invalid API key")
            elif status == 403:
                print(f"❌ FORBIDDEN - No access to {endpoint['expected']} API")
            elif status == 404:
                print("❌ NOT FOUND - Endpoint doesn't exist")
            else:
                print(f"❌ ERROR {status}")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ REQUEST FAILED: {e}")
    
    print("\n" + "=" * 60)
    print("🎯 DIAGNOSIS:")
    
    if not working_endpoints:
        print("❌ No working endpoints found. Check your API key.")
    else:
        print(f"✅ Found {len(working_endpoints)} working endpoint(s):")
        for ep in working_endpoints:
            print(f"   - {ep['name']} ({ep['expected']})")
        
        # Determine what type of access user has
        has_sports_data = any(ep['expected'] == 'sports data' for ep in working_endpoints)
        has_images = any(ep['expected'] == 'images' for ep in working_endpoints)
        
        if has_sports_data and not has_images:
            print("\n💡 RECOMMENDATION:")
            print("Your API key works for Sports Data API but NOT Images API.")
            print("Options:")
            print("1. Contact Sportradar to add Images API access to your trial")
            print("2. Use alternative headshot sources (ESPN, CBS Sports, etc.)")
            print("3. Use Sports Data API to get player info, then web scrape headshots")
        elif has_images:
            print("\n🎉 You have Images API access! Check endpoint format.")
        else:
            print("\n❓ Unclear API access. Contact Sportradar support.")

if __name__ == "__main__":
    print("🏈 Sportradar API Diagnostics")
    test_sportradar_endpoints()

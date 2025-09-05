#!/usr/bin/env python3
"""
Test different Sportradar API key formats
"""

import os
import requests

def test_key_formats():
    """Test different ways to pass the API key"""
    
    api_key = os.getenv('SPORTRADAR_COLLEGE_API_KEY')
    
    if not api_key:
        print("❌ API key not found")
        return
    
    print(f"🔍 Testing API key formats: {api_key[:10]}...")
    print("=" * 50)
    
    base_url = "https://api.sportradar.us/ncaaf-images-t3/usat/headshots/players/manifest.xml"
    
    # Test different formats
    test_formats = [
        {
            "name": "Query Parameter",
            "url": f"{base_url}?api_key={api_key}",
            "headers": {}
        },
        {
            "name": "Authorization Header", 
            "url": base_url,
            "headers": {"Authorization": f"Bearer {api_key}"}
        },
        {
            "name": "X-API-Key Header",
            "url": base_url, 
            "headers": {"X-API-Key": api_key}
        },
        {
            "name": "Sportradar-API-Key Header",
            "url": base_url,
            "headers": {"Sportradar-API-Key": api_key}
        }
    ]
    
    for test in test_formats:
        print(f"\n🔍 Testing: {test['name']}")
        print(f"URL: {test['url']}")
        if test['headers']:
            print(f"Headers: {test['headers']}")
        
        try:
            response = requests.get(test['url'], headers=test['headers'], timeout=10)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                print("✅ SUCCESS! This format works!")
                return True
            elif response.status_code == 401:
                print("❌ UNAUTHORIZED")
            elif response.status_code == 403:
                print("❌ FORBIDDEN")
            else:
                print(f"❌ ERROR {response.status_code}")
                
        except Exception as e:
            print(f"❌ REQUEST FAILED: {e}")
    
    return False

if __name__ == "__main__":
    test_key_formats()

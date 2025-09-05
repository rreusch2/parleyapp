#!/usr/bin/env python3
"""
Quick test script to verify Sportradar API access for college football headshots
"""

import os
import requests
import xml.etree.ElementTree as ET

def test_sportradar_api():
    """Test Sportradar API access"""
    
    # Get API key from environment
    api_key = os.getenv('SPORTRADAR_COLLEGE_API_KEY')
    
    if not api_key:
        print("❌ SPORTRADAR_COLLEGE_API_KEY environment variable not set")
        print("Set it with: export SPORTRADAR_COLLEGE_API_KEY='your_key_here'")
        return False
    
    print(f"✅ Found API key: {api_key[:10]}...")
    
    # Test endpoints
    base_url = "https://api.sportradar.us"
    access_level = "t"  # trial
    
    # Test both providers
    providers = ["usat", "pressbox"]
    
    for provider in providers:
        print(f"\n🔍 Testing {provider.upper()} provider...")
        
        url = f"{base_url}/ncaaf-images-{access_level}3/{provider}/headshots/players/manifest.xml"
        print(f"URL: {url}")
        
        try:
            response = requests.get(url, timeout=10)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                # Parse XML to check content
                root = ET.fromstring(response.content)
                assets = root.findall('.//asset')
                print(f"✅ SUCCESS! Found {len(assets)} headshot assets")
                
                # Show sample asset info
                if assets:
                    sample = assets[0]
                    asset_id = sample.get('id')
                    title_elem = sample.find('title')
                    title = title_elem.text if title_elem is not None else "No title"
                    
                    print(f"Sample: {asset_id} - {title}")
                    
                    # Check for player refs
                    player_refs = sample.findall('.//ref[@type="profile"]')
                    if player_refs:
                        player_name = player_refs[0].get('name', 'Unknown')
                        print(f"Player: {player_name}")
                
                return True
                
            elif response.status_code == 401:
                print("❌ UNAUTHORIZED - Check your API key")
            elif response.status_code == 403:
                print("❌ FORBIDDEN - API key may not have access to this endpoint")
            elif response.status_code == 404:
                print("❌ NOT FOUND - Endpoint may not exist or be available")
            else:
                print(f"❌ ERROR {response.status_code}: {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ REQUEST FAILED: {e}")
        except ET.ParseError as e:
            print(f"❌ XML PARSE ERROR: {e}")
    
    return False

if __name__ == "__main__":
    print("🏈 Sportradar College Football Headshots API Test")
    print("=" * 50)
    
    success = test_sportradar_api()
    
    if success:
        print("\n🎉 API test successful! Ready to run full headshots sync.")
        print("Next: python sportradar-college-headshots.py")
    else:
        print("\n❌ API test failed. Check your configuration and try again.")

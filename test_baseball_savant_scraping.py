#!/usr/bin/env python3
"""
Test Baseball Savant Scraping
Debug script to see what we're actually getting from Baseball Savant
"""

import requests
from bs4 import BeautifulSoup
import json
import time

def test_baseball_savant_scraping():
    """Test what we can actually scrape from Baseball Savant"""
    
    # Headers to avoid being blocked
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    savant_base_url = 'https://baseballsavant.mlb.com'
    
    print("🧪 Testing Baseball Savant Scraping...")
    print("="*50)
    
    # Test 1: Main page
    print("\n1️⃣ Testing main page...")
    try:
        response = requests.get(f"{savant_base_url}/", headers=headers, timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Check what we can actually find
            print(f"   Page Title: {soup.title.text if soup.title else 'No title'}")
            
            # Look for any trending/top performer sections
            print("\n   🔍 Looking for trending/performer sections...")
            
            # Check for various possible selectors
            selectors_to_try = [
                {'name': 'trending-players class', 'selector': '.trending-players'},
                {'name': 'top-performer class', 'selector': '.top-performer'},
                {'name': 'trending text', 'selector': '*:contains("trending")'},
                {'name': 'performer text', 'selector': '*:contains("performer")'},
                {'name': 'top text', 'selector': '*:contains("Top")'},
                {'name': 'leaderboard links', 'selector': 'a[href*="leaderboard"]'},
                {'name': 'any divs with IDs', 'selector': 'div[id]'},
                {'name': 'any divs with classes', 'selector': 'div[class]'}
            ]
            
            for test in selectors_to_try:
                try:
                    elements = soup.select(test['selector'])[:5]  # First 5 matches
                    print(f"     {test['name']}: {len(elements)} found")
                    if elements:
                        for i, elem in enumerate(elements):
                            text = elem.get_text(strip=True)[:100]
                            if text:
                                print(f"       {i+1}. {text}")
                except Exception as e:
                    print(f"     {test['name']}: Error - {e}")
            
            # Look for any section with useful content
            print("\n   📋 Looking for sections with baseball data...")
            sections = soup.find_all(['section', 'div'], limit=10)
            for i, section in enumerate(sections):
                if section.get_text(strip=True):
                    text = section.get_text(strip=True)[:150]
                    if any(keyword in text.lower() for keyword in ['batting', 'pitching', 'player', 'stats', 'leaderboard']):
                        print(f"     Section {i+1}: {text}")
                        
        else:
            print(f"   ❌ Failed to fetch main page: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error fetching main page: {e}")
    
    # Test 2: Leaderboards page
    print("\n2️⃣ Testing leaderboards page...")
    try:
        leaderboard_url = f"{savant_base_url}/leaderboard/custom"
        response = requests.get(leaderboard_url, headers=headers, timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            print(f"   Page Title: {soup.title.text if soup.title else 'No title'}")
            
            # Look for tables or data structures
            tables = soup.find_all('table', limit=3)
            print(f"   Tables found: {len(tables)}")
            
            if tables:
                for i, table in enumerate(tables):
                    rows = table.find_all('tr', limit=5)
                    print(f"     Table {i+1}: {len(rows)} rows")
                    if rows:
                        for j, row in enumerate(rows[:3]):
                            text = row.get_text(strip=True)[:100]
                            if text:
                                print(f"       Row {j+1}: {text}")
                                
        else:
            print(f"   ❌ Failed to fetch leaderboards: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error fetching leaderboards: {e}")
    
    # Test 3: Check for APIs or JSON data
    print("\n3️⃣ Looking for JSON/API endpoints...")
    try:
        # Try to find if there are any API calls in the page source
        response = requests.get(f"{savant_base_url}/", headers=headers, timeout=10)
        if response.status_code == 200:
            content = response.text
            
            # Look for API endpoints in the source
            api_indicators = ['api/', '/api', '.json', 'ajax', 'endpoint']
            found_apis = []
            
            for indicator in api_indicators:
                if indicator in content.lower():
                    # Extract potential API URLs
                    lines = content.split('\n')
                    for line in lines:
                        if indicator in line.lower():
                            found_apis.append(line.strip()[:200])
                            if len(found_apis) >= 3:
                                break
            
            if found_apis:
                print("   Potential API endpoints found:")
                for api in found_apis[:5]:
                    print(f"     {api}")
            else:
                print("   No obvious API endpoints found")
                
    except Exception as e:
        print(f"   ❌ Error looking for APIs: {e}")
    
    # Test 4: Alternative - Check what MLB.com stats API offers
    print("\n4️⃣ Testing MLB Stats API (alternative)...")
    try:
        # MLB has a public stats API
        mlb_api_url = "https://statsapi.mlb.com/api/v1/people"
        response = requests.get(f"{mlb_api_url}?stats&season=2025&group=hitting", headers=headers, timeout=10)
        print(f"   MLB API Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   MLB API Response Type: {type(data)}")
            if isinstance(data, dict):
                print(f"   MLB API Keys: {list(data.keys())[:5]}")
        
    except Exception as e:
        print(f"   ❌ Error testing MLB API: {e}")
    
    print("\n🏁 Test Complete!")
    print("="*50)

if __name__ == "__main__":
    test_baseball_savant_scraping() 
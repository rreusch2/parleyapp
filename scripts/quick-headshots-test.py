#!/usr/bin/env python3
"""
Quick test to fetch a few college football headshots from ESPN
Uses Supabase MCP instead of direct database connection
"""

import requests
import json
import time
import re

def test_espn_search(player_name, team_name):
    """Test ESPN player search for headshots"""
    
    print(f"🔍 Searching ESPN for: {player_name} ({team_name})")
    
    try:
        # ESPN API search
        search_url = "https://site-api.espn.com/apis/site/v2/search"
        params = {
            'query': f"{player_name} {team_name} college football",
            'section': 'college-football',
            'limit': 5
        }
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(search_url, params=params, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"   Status: {response.status_code}")
            print(f"   Results found: {len(data.get('results', []))}")
            
            # Look for athlete results
            if 'results' in data:
                for i, result in enumerate(data['results']):
                    print(f"   Result {i+1}: {result.get('type')} - {result.get('name', 'N/A')}")
                    
                    if result.get('type') == 'athlete':
                        athlete_id = result.get('id')
                        if athlete_id:
                            headshot_url = f"https://a.espncdn.com/i/headshots/college-football/players/full/{athlete_id}.png"
                            
                            # Test if image exists
                            img_response = requests.head(headshot_url, timeout=5)
                            print(f"      Headshot URL: {headshot_url}")
                            print(f"      Image status: {img_response.status_code}")
                            
                            if img_response.status_code == 200:
                                print(f"   ✅ Found working headshot!")
                                return headshot_url
        else:
            print(f"   ❌ Search failed: {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    return None

def test_cbs_sports_search(player_name, team_name):
    """Test CBS Sports roster search"""
    
    print(f"🔍 Searching CBS Sports for: {player_name} ({team_name})")
    
    try:
        # Try to find CBS team page
        team_search = team_name.lower().replace(' ', '-').replace('state', 'st')
        roster_url = f"https://www.cbssports.com/college-football/teams/{team_search}/roster/"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        print(f"   Trying URL: {roster_url}")
        
        response = requests.get(roster_url, headers=headers, timeout=10)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            # Check if player name appears in page
            if player_name.lower() in response.text.lower():
                print(f"   ✅ Found {player_name} on roster page!")
                
                # Look for image URLs
                img_patterns = [
                    r'https://[^"]*(?:headshots?|players?)[^"]*\.(?:jpg|jpeg|png|gif)',
                    r'https://[^"]*sportline[^"]*\.(?:jpg|jpeg|png|gif)',
                ]
                
                for pattern in img_patterns:
                    matches = re.findall(pattern, response.text, re.IGNORECASE)
                    for match in matches:
                        print(f"      Found image: {match}")
                        
                        # Test if accessible
                        img_response = requests.head(match, timeout=5)
                        if img_response.status_code == 200:
                            print(f"   ✅ Working image found!")
                            return match
            else:
                print(f"   ❌ Player not found on roster")
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    return None

def main():
    """Test headshot fetching with sample players"""
    
    print("🏈 Testing College Football Headshot Sources")
    print("=" * 60)
    
    # Test with some sample players (you can replace with actual players from your DB)
    test_players = [
        ("Quinn Ewers", "Texas"),
        ("Caleb Williams", "USC"),
        ("J.J. McCarthy", "Michigan"),
        ("Bo Nix", "Oregon"),
        ("Drake Maye", "North Carolina")
    ]
    
    found_count = 0
    
    for player_name, team_name in test_players:
        print(f"\n{'='*50}")
        print(f"Testing: {player_name} - {team_name}")
        print('='*50)
        
        # Try ESPN first
        espn_result = test_espn_search(player_name, team_name)
        if espn_result:
            found_count += 1
            print(f"✅ ESPN SUCCESS: {espn_result}")
        else:
            # Try CBS Sports if ESPN fails
            cbs_result = test_cbs_sports_search(player_name, team_name)
            if cbs_result:
                found_count += 1
                print(f"✅ CBS SPORTS SUCCESS: {cbs_result}")
            else:
                print("❌ No headshot found from either source")
        
        # Rate limiting
        time.sleep(1)
    
    print(f"\n{'='*60}")
    print(f"🎯 RESULTS: Found headshots for {found_count}/{len(test_players)} test players")
    print(f"Success rate: {(found_count/len(test_players)*100):.1f}%")
    
    if found_count > 0:
        print("\n✅ Headshot sources are working! Ready to process your database.")
        print("Next steps:")
        print("1. Fix database connection in main script")
        print("2. Run full headshot sync on your 10,739 college football players")
    else:
        print("\n❌ No headshot sources working. May need different approach.")

if __name__ == "__main__":
    main()

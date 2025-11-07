#!/usr/bin/env python3
"""
Test ESPN NFL API for 2025 current season player stats
"""

import requests
import json
from datetime import datetime

def test_espn_2025_nfl():
    print("Testing ESPN NFL API for 2025 season data...")
    
    # Test URLs
    urls_to_test = [
        "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/athletes",
        "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/14876/gamelog",  # Josh Allen example
        "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/types/2/athletes",
        "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/leaders"
    ]
    
    for url in urls_to_test:
        try:
            print(f"\n=== Testing: {url} ===")
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success! Response size: ~{len(str(data))} chars")
                
                # Check for 2025 season data indicators
                data_str = str(data).lower()
                if '2025' in data_str:
                    print("✅ Contains 2025 season references")
                else:
                    print("⚠️  No obvious 2025 season references found")
                    
                # Check if it has current week/game data
                if any(term in data_str for term in ['week', 'game', 'statistics', 'stats']):
                    print("✅ Contains game/stats data")
                
                # Sample some keys if it's a dict
                if isinstance(data, dict) and data:
                    sample_keys = list(data.keys())[:5]
                    print(f"   Sample keys: {sample_keys}")
                    
            else:
                print(f"❌ HTTP {response.status_code}: {response.reason}")
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")
    
    print(f"\n=== Test completed at {datetime.now()} ===")

if __name__ == "__main__":
    test_espn_2025_nfl()

#!/usr/bin/env python3
"""
Test single ESPN player to see data structure
"""

import requests
import json

def test_single_player():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
    
    # Test with Nelson Agholor (ESPN ID: 2971618)
    url = "http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/2971618?lang=en&region=us"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        print("🔍 ESPN Player Data Structure:")
        print(json.dumps(data, indent=2))
        
        print(f"\n📊 Key Information:")
        print(f"ID: {data.get('id')}")
        print(f"Name: {data.get('displayName')}")
        print(f"Position: {data.get('position', {}).get('abbreviation', 'N/A')}")
        print(f"Team field: {data.get('team')}")
        
        # Try to extract team info
        if 'team' in data and data['team']:
            team_url = data['team']
            print(f"Team URL: {team_url}")
            
            # Fetch team data
            team_response = requests.get(team_url, headers=headers, timeout=10)
            team_response.raise_for_status()
            team_data = team_response.json()
            
            print(f"Team Name: {team_data.get('displayName')}")
            print(f"Team Abbreviation: {team_data.get('abbreviation')}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_single_player()
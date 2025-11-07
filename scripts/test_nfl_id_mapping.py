#!/usr/bin/env python3
"""
Test if our NFL player external_player_id values match ESPN athlete IDs
"""

import requests
import json

def test_player_id_mapping():
    # Test players from our database
    test_players = [
        {"name": "Josh Allen", "our_id": "19801", "team": "BUF"},
        {"name": "Patrick Mahomes", "our_id": "18890", "team": "KC"},
        {"name": "Lamar Jackson", "our_id": "19781", "team": "BAL"},
        {"name": "Dak Prescott", "our_id": "18055", "team": "DAL"},
        {"name": "Aaron Rodgers", "our_id": "2593", "team": "NYJ"}
    ]
    
    print("Testing NFL player ID mapping with ESPN API...")
    
    for player in test_players:
        print(f"\n=== Testing {player['name']} (Our ID: {player['our_id']}) ===")
        
        # Test ESPN athlete endpoint with our ID
        espn_url = f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/{player['our_id']}"
        
        try:
            response = requests.get(espn_url, timeout=10)
            
            if response.status_code == 200:
                athlete_data = response.json()
                espn_name = athlete_data.get('displayName', 'Unknown')
                espn_team = 'Unknown'
                
                # Get team info
                if 'team' in athlete_data:
                    team_response = requests.get(athlete_data['team']['$ref'], timeout=10)
                    if team_response.status_code == 200:
                        team_data = team_response.json()
                        espn_team = team_data.get('abbreviation', 'Unknown')
                
                print(f"✅ ESPN API Response:")
                print(f"   Name: {espn_name}")
                print(f"   Team: {espn_team}")
                print(f"   Expected: {player['name']} ({player['team']})")
                
                # Check if it's a match
                name_match = player['name'].lower() in espn_name.lower()
                team_match = player['team'] == espn_team
                
                if name_match and team_match:
                    print("🎯 PERFECT MATCH!")
                elif name_match:
                    print("⚠️  Name matches, team different")
                else:
                    print("❌ No match")
                
                # Test gamelog endpoint
                gamelog_url = f"https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{player['our_id']}/gamelog"
                gamelog_response = requests.get(gamelog_url, timeout=10)
                
                if gamelog_response.status_code == 200:
                    gamelog_data = gamelog_response.json()
                    print(f"✅ Gamelog available (~{len(str(gamelog_data))} chars)")
                    
                    # Check for 2025 data
                    if '2025' in str(gamelog_data):
                        print("🎯 Contains 2025 season data!")
                else:
                    print(f"❌ Gamelog not available: {gamelog_response.status_code}")
                    
            else:
                print(f"❌ ESPN API Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_player_id_mapping()

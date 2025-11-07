#!/usr/bin/env python3
"""
Test ESPN API search and roster capabilities to map our NFL players
"""

import requests
import json
import time

def test_espn_search_capabilities():
    print("Testing ESPN search and roster capabilities...")
    
    # Test different ESPN endpoints for finding players
    test_urls = [
        "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/athletes?limit=50",
        "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams",
        "https://sports.core.api.espn.com/v3/sports/football/nfl/athletes?limit=20"
    ]
    
    for url in test_urls:
        print(f"\n=== Testing: {url.split('/')[-1]} ===")
        try:
            response = requests.get(url, timeout=15)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Success! Keys: {list(data.keys())}")
                
                # If it has items/athletes, check a few
                if 'items' in data:
                    items = data['items'][:3]  # First 3
                    for i, item in enumerate(items):
                        try:
                            if '$ref' in item:
                                athlete_response = requests.get(item['$ref'], timeout=10)
                                if athlete_response.status_code == 200:
                                    athlete_data = athlete_response.json()
                                    name = athlete_data.get('displayName', 'Unknown')
                                    position = athlete_data.get('position', {}).get('abbreviation', 'Unknown')
                                    
                                    # Get team
                                    team_abbr = 'Unknown'
                                    if 'team' in athlete_data:
                                        team_resp = requests.get(athlete_data['team']['$ref'], timeout=10)
                                        if team_resp.status_code == 200:
                                            team_data = team_resp.json()
                                            team_abbr = team_data.get('abbreviation', 'Unknown')
                                    
                                    espn_id = item['$ref'].split('/')[-1]
                                    print(f"   Player {i+1}: {name} ({position}) - {team_abbr} [ESPN ID: {espn_id}]")
                                    
                                    # Check if this is a known player
                                    known_players = ['Josh Allen', 'Patrick Mahomes', 'Lamar Jackson', 'Dak Prescott']
                                    if any(known in name for known in known_players):
                                        print(f"      🎯 Found known player! ESPN ID: {espn_id}")
                                
                                time.sleep(0.5)  # Rate limiting
                                
                        except Exception as e:
                            print(f"   Error processing item {i}: {str(e)}")
                            
            else:
                print(f"❌ HTTP {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")

def test_team_roster_approach():
    """Test getting players via team rosters"""
    print(f"\n=== Testing Team Roster Approach ===")
    
    # Get Bills roster (Josh Allen's team)
    try:
        # First get team ID for Buffalo Bills
        teams_url = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams"
        teams_response = requests.get(teams_url, timeout=10)
        
        if teams_response.status_code == 200:
            teams_data = teams_response.json()
            
            # Find Bills team
            for team_ref in teams_data.get('items', [])[:5]:  # Check first 5 teams
                team_response = requests.get(team_ref['$ref'], timeout=10)
                if team_response.status_code == 200:
                    team_data = team_response.json()
                    team_abbr = team_data.get('abbreviation', '')
                    team_name = team_data.get('displayName', '')
                    
                    print(f"Team: {team_name} ({team_abbr})")
                    
                    if team_abbr == 'BUF':
                        print("🎯 Found Buffalo Bills!")
                        
                        # Get roster
                        if 'athletes' in team_data:
                            athletes_url = team_data['athletes']['$ref']
                            roster_response = requests.get(athletes_url, timeout=10)
                            
                            if roster_response.status_code == 200:
                                roster_data = roster_response.json()
                                print(f"   Roster has {len(roster_data.get('items', []))} players")
                                
                                # Check first few players
                                for player_ref in roster_data.get('items', [])[:3]:
                                    player_response = requests.get(player_ref['$ref'], timeout=10)
                                    if player_response.status_code == 200:
                                        player_data = player_response.json()
                                        name = player_data.get('displayName', 'Unknown')
                                        position = player_data.get('position', {}).get('abbreviation', 'Unknown')
                                        espn_id = player_ref['$ref'].split('/')[-1]
                                        
                                        print(f"      {name} ({position}) [ESPN ID: {espn_id}]")
                                        
                                        if 'Josh Allen' in name:
                                            print(f"         🎯🎯 FOUND JOSH ALLEN! ESPN ID: {espn_id}")
                                    
                                    time.sleep(0.3)
                        break
                
                time.sleep(0.5)
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_espn_search_capabilities()
    test_team_roster_approach()

#!/usr/bin/env python3
"""
Detailed test of ESPN NFL API for current 2025 season player game stats
"""

import requests
import json
from datetime import datetime

def get_espn_current_players():
    """Get current NFL players from ESPN API and test their game logs"""
    
    print("=== Getting 2025 NFL Athletes ===")
    
    try:
        # Get athletes for 2025 season
        athletes_url = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/athletes?limit=10"
        response = requests.get(athletes_url, timeout=10)
        
        if response.status_code != 200:
            print(f"❌ Failed to get athletes: {response.status_code}")
            return
            
        athletes_data = response.json()
        print(f"✅ Found {athletes_data.get('count', 0)} total athletes")
        
        # Test a few athletes
        for i, athlete_ref in enumerate(athletes_data.get('items', [])[:3]):
            try:
                athlete_id = athlete_ref['$ref'].split('/')[-1]
                print(f"\n--- Testing Athlete ID: {athlete_id} ---")
                
                # Get athlete details
                athlete_response = requests.get(athlete_ref['$ref'], timeout=10)
                if athlete_response.status_code == 200:
                    athlete_info = athlete_response.json()
                    name = athlete_info.get('displayName', 'Unknown')
                    position = athlete_info.get('position', {}).get('abbreviation', 'Unknown')
                    team = 'Unknown'
                    if 'team' in athlete_info:
                        team_response = requests.get(athlete_info['team']['$ref'], timeout=10)
                        if team_response.status_code == 200:
                            team_info = team_response.json()
                            team = team_info.get('abbreviation', 'Unknown')
                    
                    print(f"Player: {name} ({position}) - {team}")
                
                # Test different gamelog endpoints for this player
                gamelog_urls = [
                    f"https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{athlete_id}/gamelog",
                    f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/athletes/{athlete_id}/eventlog",
                    f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/{athlete_id}/statisticslog"
                ]
                
                for url in gamelog_urls:
                    try:
                        log_response = requests.get(url, timeout=10)
                        if log_response.status_code == 200:
                            log_data = log_response.json()
                            print(f"  ✅ {url.split('/')[-1]}: Found data (~{len(str(log_data))} chars)")
                            
                            # Check for recent games/stats
                            data_str = str(log_data)
                            if '2025' in data_str and any(term in data_str.lower() for term in ['week', 'game', 'statistics']):
                                print("    🎯 Contains 2025 game data!")
                                
                                # Try to extract some sample stats
                                if 'categories' in log_data:
                                    categories = log_data.get('categories', [])
                                    if categories:
                                        print(f"    Categories found: {len(categories)}")
                                        
                        else:
                            print(f"  ❌ {url.split('/')[-1]}: {log_response.status_code}")
                            
                    except Exception as e:
                        print(f"  ❌ {url.split('/')[-1]}: Error - {str(e)}")
                
            except Exception as e:
                print(f"❌ Error processing athlete {i}: {str(e)}")
                
    except Exception as e:
        print(f"❌ Error getting athletes: {str(e)}")

if __name__ == "__main__":
    get_espn_current_players()

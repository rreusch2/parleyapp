#!/usr/bin/env python3
"""
ESPN Player ID Discovery Script
ONLY finds and stores ESPN player IDs - does NOT fetch stats
"""

import requests
import json
import time
from datetime import datetime
import logging
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/Users/rreusch2/parleyapp/.env')

# Add the parent directory to the Python path to import Supabase client
sys.path.append('/Users/rreusch2/parleyapp/python-services/player-stats')

try:
    from supabase_client import SupabasePlayerStatsClient
    print("✅ Successfully imported Supabase client")
except ImportError as e:
    print(f"❌ Failed to import Supabase client: {e}")
    print("Make sure you have the supabase-py package installed: pip install supabase")
    sys.exit(1)

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ESPNPlayerIDDiscovery:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        self.supabase = SupabasePlayerStatsClient()
        
        # ESPN team ID mapping
        self.espn_teams = {
            'ARI': 22, 'ATL': 1, 'BAL': 33, 'BUF': 2, 'CAR': 29, 'CHI': 3,
            'CIN': 4, 'CLE': 5, 'DAL': 6, 'DEN': 7, 'DET': 8, 'GB': 9,
            'HOU': 34, 'IND': 11, 'JAX': 30, 'KC': 12, 'LV': 13, 'LAC': 24,
            'LAR': 14, 'MIA': 15, 'MIN': 16, 'NE': 17, 'NO': 18, 'NYG': 19,
            'NYJ': 20, 'PHI': 21, 'PIT': 23, 'SF': 25, 'SEA': 26, 'TB': 27,
            'TEN': 10, 'WAS': 28
        }

    def get_test_players(self):
        """Get a few test players with known teams"""
        try:
            response = self.supabase.client.table('players').select(
                'id, name, external_player_id, position, team, sport'
            ).eq('sport', 'NFL').in_('name', [
                'Aaron Jones', 'Aaron Rodgers', 'Alvin Kamara', 'Adam Thielen', 'A.J. Brown'
            ]).execute()
            
            return response.data
        except Exception as e:
            logger.error(f"Failed to get test players: {e}")
            return []

    def discover_espn_id_multiple_strategies(self, player_name, position, team):
        """Try multiple strategies to find ESPN player ID"""
        logger.info(f"🔍 Discovering ESPN ID for {player_name} ({position}, {team})")
        
        strategies = [
            self.strategy_team_roster,
            self.strategy_player_search,
            self.strategy_alternate_roster_format
        ]
        
        for i, strategy in enumerate(strategies, 1):
            logger.info(f"  Strategy {i}: {strategy.__name__}")
            try:
                espn_id = strategy(player_name, position, team)
                if espn_id:
                    logger.info(f"✅ Found ESPN ID {espn_id} using {strategy.__name__}")
                    return espn_id
                else:
                    logger.info(f"❌ No result from {strategy.__name__}")
            except Exception as e:
                logger.error(f"❌ Strategy {strategy.__name__} failed: {e}")
        
        logger.warning(f"🚫 All strategies failed for {player_name}")
        return None

    def strategy_team_roster(self, player_name, position, team):
        """Strategy 1: Team roster lookup"""
        team_id = self.espn_teams.get(team)
        if not team_id:
            logger.warning(f"Unknown team: {team}")
            return None
        
        roster_url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{team_id}/roster"
        
        try:
            response = requests.get(roster_url, headers=self.headers, timeout=10)
            response.raise_for_status()
            roster_data = response.json()
            
            logger.info(f"  Got roster for {team} (team_id: {team_id})")
            
            if 'athletes' in roster_data:
                athletes = roster_data['athletes']
                logger.info(f"  Found {len(athletes)} athletes in roster")
                
                for athlete in athletes:
                    # ESPN returns athlete URLs, need to fetch each one
                    if isinstance(athlete, str):
                        # athlete is a URL - need to fetch it
                        try:
                            athlete_response = requests.get(athlete, headers=self.headers, timeout=5)
                            athlete_response.raise_for_status()
                            athlete_data = athlete_response.json()
                        except:
                            continue
                    else:
                        # athlete is already an object
                        athlete_data = athlete
                    
                    athlete_name = athlete_data.get('displayName', athlete_data.get('name', ''))
                    athlete_id = athlete_data.get('id', '')
                    athlete_pos = athlete_data.get('position', {})
                    if isinstance(athlete_pos, dict):
                        athlete_pos = athlete_pos.get('abbreviation', '')
                    
                    logger.info(f"    Checking: {athlete_name} (ID: {athlete_id}, Pos: {athlete_pos})")
                    
                    if self.names_match(player_name, athlete_name):
                        logger.info(f"✅ Name match found: {athlete_name}")
                        return str(athlete_id)
                    
                    # Rate limit when fetching individual athlete URLs
                    if isinstance(athlete, str):
                        time.sleep(0.5)
                
                logger.warning(f"  Player {player_name} not found in {team} roster")
            else:
                logger.warning(f"  No 'athletes' key in roster response")
                
        except Exception as e:
            logger.error(f"Team roster strategy failed: {e}")
            
        return None

    def strategy_player_search(self, player_name, position, team):
        """Strategy 2: ESPN player search"""
        # Try ESPN search endpoint (if it exists)
        search_urls = [
            f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes?search={player_name.replace(' ', '%20')}",
            f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes?search={player_name.replace(' ', '%20')}"
        ]
        
        for url in search_urls:
            try:
                logger.info(f"  Trying search URL: {url}")
                response = requests.get(url, headers=self.headers, timeout=10)
                response.raise_for_status()
                search_data = response.json()
                
                logger.info(f"  Search response keys: {list(search_data.keys())}")
                
                # Process search results based on response structure
                if 'athletes' in search_data:
                    for athlete in search_data['athletes']:
                        if self.names_match(player_name, athlete.get('displayName', '')):
                            return str(athlete.get('id', ''))
                
            except Exception as e:
                logger.info(f"  Search URL failed: {e}")
                continue
        
        return None

    def strategy_alternate_roster_format(self, player_name, position, team):
        """Strategy 3: Alternate roster format"""
        team_id = self.espn_teams.get(team)
        if not team_id:
            return None
        
        alt_urls = [
            f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams/{team_id}/athletes",
            f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{team_id}",
        ]
        
        for url in alt_urls:
            try:
                logger.info(f"  Trying alternate URL: {url}")
                response = requests.get(url, headers=self.headers, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                logger.info(f"  Alt response keys: {list(data.keys())}")
                
                # Try to find athletes in different data structures
                athletes = []
                if 'athletes' in data:
                    athletes = data['athletes']
                elif 'team' in data and 'athletes' in data['team']:
                    athletes = data['team']['athletes']
                elif 'items' in data:
                    athletes = data['items']
                
                for athlete in athletes[:10]:  # Check first 10
                    athlete_name = athlete.get('displayName', athlete.get('name', ''))
                    athlete_id = athlete.get('id', '')
                    if self.names_match(player_name, athlete_name):
                        return str(athlete_id)
                        
            except Exception as e:
                logger.info(f"  Alt URL failed: {e}")
                continue
        
        return None

    def names_match(self, name1, name2):
        """Enhanced name matching"""
        if not name1 or not name2:
            return False
        
        # Normalize names
        def normalize(name):
            return name.lower().replace('.', '').replace(' jr', '').replace(' sr', '').replace(' ii', '').replace(' iii', '').strip()
        
        norm1 = normalize(name1)
        norm2 = normalize(name2)
        
        # Exact match
        if norm1 == norm2:
            return True
        
        # Handle common variations
        # A.J. Brown -> AJ Brown, etc.
        norm1_no_periods = norm1.replace('a.j.', 'aj').replace('d.j.', 'dj').replace('j.j.', 'jj')
        norm2_no_periods = norm2.replace('a.j.', 'aj').replace('d.j.', 'dj').replace('j.j.', 'jj')
        
        if norm1_no_periods == norm2_no_periods:
            return True
        
        # Last name + first initial match (for common cases)
        name1_parts = norm1.split()
        name2_parts = norm2.split()
        
        if len(name1_parts) >= 2 and len(name2_parts) >= 2:
            # Compare last name + first initial
            if (name1_parts[-1] == name2_parts[-1] and 
                name1_parts[0][0] == name2_parts[0][0]):
                return True
        
        return False

    def store_espn_id(self, player_name, team, espn_id):
        """Store discovered ESPN ID in database"""
        try:
            response = self.supabase.client.table('players').update({
                'espn_player_id': espn_id,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('name', player_name).eq('sport', 'NFL').execute()
            
            if response.data:
                logger.info(f"✅ Stored ESPN ID {espn_id} for {player_name}")
                return True
            else:
                logger.error(f"❌ Failed to store ESPN ID - no rows updated")
                return False
                
        except Exception as e:
            logger.error(f"❌ Database error storing ESPN ID for {player_name}: {e}")
            return False

    def run_discovery(self):
        """Run ESPN ID discovery on test players"""
        logger.info("🏈 Starting ESPN Player ID Discovery")
        
        test_players = self.get_test_players()
        if not test_players:
            logger.error("No test players found")
            return
        
        logger.info(f"Found {len(test_players)} test players")
        
        success_count = 0
        
        for player in test_players:
            player_name = player['name']
            position = player['position']
            team = player['team']
            
            logger.info(f"\n🔍 Processing: {player_name} ({position}, {team})")
            
            # Discover ESPN ID
            espn_id = self.discover_espn_id_multiple_strategies(player_name, position, team)
            
            if espn_id:
                # Store in database
                if self.store_espn_id(player_name, team, espn_id):
                    success_count += 1
                    logger.info(f"🎯 SUCCESS: {player_name} -> ESPN ID: {espn_id}")
                else:
                    logger.error(f"❌ Failed to store ESPN ID for {player_name}")
            else:
                logger.warning(f"🚫 No ESPN ID found for {player_name}")
            
            # Rate limiting
            time.sleep(2)
        
        logger.info(f"\n✅ Discovery complete: {success_count}/{len(test_players)} players mapped")

def main():
    discovery = ESPNPlayerIDDiscovery()
    discovery.run_discovery()

if __name__ == "__main__":
    main()
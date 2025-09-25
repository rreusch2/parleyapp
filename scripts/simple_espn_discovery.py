#!/usr/bin/env python3
"""
Simple ESPN Player ID Discovery
Based on actual ESPN API documentation research
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
    sys.exit(1)

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SimpleESPNDiscovery:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        self.supabase = SupabasePlayerStatsClient()
        self.offensive_positions = {'QB', 'RB', 'WR', 'TE', 'K', 'FB'}
        self.processed = 0
        self.matched = 0
        self.stored = 0

    def stream_espn_athletes_and_store(self, our_players_map):
        """Stream ESPN athletes with pagination and store matches immediately"""
        try:
            base = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes?active=true"
            page_size = 1000
            offset = 0
            total_count = None
            logger.info("🔍 Fetching all active NFL athletes from ESPN...")
            
            while True:
                url = f"{base}&limit={page_size}&offset={offset}"
                response = requests.get(url, headers=self.headers, timeout=30)
                response.raise_for_status()
                data = response.json()
                
                if total_count is None:
                    total_count = data.get('count', 0)
                    logger.info(f"📊 Found {total_count} active NFL athletes")
                
                items = data.get('items', [])
                if not items:
                    break
                
                for athlete_ref in items:
                    try:
                        # Extract URL from $ref
                        if isinstance(athlete_ref, dict) and '$ref' in athlete_ref:
                            athlete_url = athlete_ref['$ref']
                        else:
                            athlete_url = athlete_ref
                        
                        athlete_response = requests.get(athlete_url, headers=self.headers, timeout=10)
                        athlete_response.raise_for_status()
                        athlete_data = athlete_response.json()
                        
                        name = athlete_data.get('displayName', '')
                        pos = athlete_data.get('position', {}).get('abbreviation', '') if athlete_data.get('position') else ''
                        if not name or pos not in self.offensive_positions:
                            continue
                        espn_id = athlete_data.get('id')
                        team = self.get_team_from_athlete(athlete_data)
                        
                        # Log discovery (kept since you liked seeing these)
                        logger.info(f"✅ {name} ({pos}, {team}) -> ESPN ID: {espn_id}")
                        
                        # Attempt immediate store via name+position map
                        key = f"{self.normalize_name(name)}|{pos}"
                        if key in our_players_map:
                            for our_player in list(our_players_map[key]):
                                if self.store_espn_id_immediately(our_player['id'], our_player['name'], espn_id):
                                    self.matched += 1
                                    self.stored += 1
                                    our_players_map[key].remove(our_player)
                            if not our_players_map[key]:
                                del our_players_map[key]
                        
                        self.processed += 1
                        if self.processed % 50 == 0:
                            logger.info(f"📈 Progress: {self.processed} processed, {self.matched} matched, {self.stored} stored")
                        
                        time.sleep(0.1)
                    except Exception as e:
                        logger.warning(f"Failed to process athlete: {e}")
                        continue
                
                # Next page
                offset += page_size
        except Exception as e:
            logger.error(f"Failed during ESPN streaming: {e}")

    def get_team_from_athlete(self, athlete_data):
        """Extract team abbreviation from athlete data"""
        try:
            # Team is not needed for matching; avoid extra network calls for speed/reliability
            return ''
        except Exception as e:
            # Skip free agents and other edge cases
            return ''

    def find_matching_players(self, espn_athletes):
        """Find players in our database that match ESPN athletes"""
        matches = []
        
        try:
            # Get our NFL players
            response = self.supabase.client.table('players').select(
                'id, name, position, team, espn_player_id'
            ).eq('sport', 'NFL').in_('position', ['QB', 'RB', 'WR', 'TE', 'K', 'FB']).execute()
            
            our_players = response.data
            logger.info(f"📋 Found {len(our_players)} players in our database")
            
            for our_player in our_players:
                # Skip if already has ESPN ID
                if our_player.get('espn_player_id'):
                    continue
                
                our_name = our_player['name'].lower().strip()
                our_position = our_player['position']
                our_team = our_player['team']
                
                for espn_athlete in espn_athletes:
                    espn_name = espn_athlete['name'].lower().strip()
                    espn_position = espn_athlete['position']
                    espn_team = espn_athlete['team']
                    
                    # Debug logging for first few matches only
                    if len(matches) < 3:
                        logger.info(f"🔍 Comparing: {our_player['name']} ({our_position}, {our_team}) vs {espn_athlete['name']} ({espn_position}, {espn_team})")
                    
                    # Match by name and position only (ignore team since many DB players missing team info)
                    if (self.names_match(our_name, espn_name) and 
                        our_position == espn_position):
                        
                        matches.append({
                            'our_player': our_player,
                            'espn_athlete': espn_athlete
                        })
                        logger.info(f"🎯 MATCH: {our_player['name']} -> ESPN ID: {espn_athlete['espn_id']}")
                        break
            
            return matches
            
        except Exception as e:
            logger.error(f"Error finding matches: {e}")
            return []

    def names_match(self, name1, name2):
        """Simple name matching"""
        # Remove common variations
        def normalize(name):
            return (name.lower()
                   .replace('.', '')
                   .replace(' jr', '')
                   .replace(' sr', '')
                   .replace(' ii', '')
                   .replace(' iii', '')
                   .replace('a.j.', 'aj')
                   .replace('d.j.', 'dj')
                   .replace('j.j.', 'jj')
                   .strip())
        
        return normalize(name1) == normalize(name2)

    def normalize_name(self, name):
        return (name.lower()
                .replace('.', '')
                .replace(' jr', '')
                .replace(' sr', '')
                .replace(' ii', '')
                .replace(' iii', '')
                .replace(' iv', '')
                .replace('a.j.', 'aj')
                .replace('d.j.', 'dj')
                .replace('j.j.', 'jj')
                .replace(' ', '')
                .strip())

    def load_our_players_map(self):
        """Load ALL NFL offensive players without ESPN IDs (paginate to avoid 1000-row cap)"""
        players_map = {}
        try:
            page_size = 1000
            start = 0
            total_loaded = 0
            while True:
                query = (self.supabase.client.table('players')
                         .select('id, name, position, team, espn_player_id')
                         .eq('sport', 'NFL')
                         .in_('position', list(self.offensive_positions))
                         .is_('espn_player_id', 'null')
                         .range(start, start + page_size - 1))
                resp = query.execute()
                batch = resp.data or []
                if not batch:
                    break
                for p in batch:
                    key = f"{self.normalize_name(p['name'])}|{p['position']}"
                    players_map.setdefault(key, []).append(p)
                total_loaded += len(batch)
                if len(batch) < page_size:
                    break
                start += page_size
            logger.info(f"📋 Loaded {total_loaded} players needing ESPN IDs (map keys: {len(players_map)})")
            return players_map
        except Exception as e:
            logger.error(f"Failed to load our players: {e}")
            return {}

    def store_espn_id_immediately(self, player_id, player_name, espn_id):
        """Store ESPN ID immediately with basic retry logic"""
        for attempt in range(3):
            try:
                resp = self.supabase.client.table('players').update({
                    'espn_player_id': str(espn_id),
                    'updated_at': datetime.utcnow().isoformat()
                }).eq('id', player_id).execute()
                if resp.data:
                    logger.info(f"✅ STORED {espn_id} for {player_name}")
                    return True
            except Exception as e:
                logger.warning(f"Store attempt {attempt+1} failed for {player_name}: {e}")
                time.sleep(0.5)
        logger.error(f"❌ Failed to store ESPN ID for {player_name}")
        return False

    def store_espn_mappings(self, matches):
        """Store ESPN player IDs in database"""
        success_count = 0
        
        for match in matches:
            try:
                our_player = match['our_player']
                espn_athlete = match['espn_athlete']
                
                response = self.supabase.client.table('players').update({
                    'espn_player_id': str(espn_athlete['espn_id']),
                    'updated_at': datetime.utcnow().isoformat()
                }).eq('id', our_player['id']).execute()
                
                if response.data:
                    logger.info(f"✅ Stored ESPN ID {espn_athlete['espn_id']} for {our_player['name']}")
                    success_count += 1
                else:
                    logger.error(f"❌ Failed to store ESPN ID for {our_player['name']}")
                    
            except Exception as e:
                logger.error(f"❌ Database error storing ESPN ID for {our_player['name']}: {e}")
        
        return success_count

    def run_discovery(self):
        """Run the complete ESPN ID discovery process"""
        logger.info("🏈 Starting Simple ESPN Player ID Discovery")
        
        # Load our players map once
        our_players_map = self.load_our_players_map()
        if not our_players_map:
            logger.warning("🎉 Nothing to do: all targeted players already have ESPN IDs or none found")
        
        # Stream ESPN athletes and store immediately
        self.stream_espn_athletes_and_store(our_players_map)
        
        logger.info(f"✅ Done. Stored {self.stored} IDs (processed {self.processed}, matched {self.matched}).")

def main():
    discovery = SimpleESPNDiscovery()
    discovery.run_discovery()

if __name__ == "__main__":
    main()
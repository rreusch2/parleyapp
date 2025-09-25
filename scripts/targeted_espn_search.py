#!/usr/bin/env python3

"""
Targeted ESPN Player Search
Instead of going through all ESPN athletes, search directly for our players
Much more efficient - targets only the players we need
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

class TargetedESPNSearch:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        self.supabase = SupabasePlayerStatsClient()
        self.offensive_positions = {'QB','RB','WR','TE','K','FB'}
        # Minimal alias map for frequent nicknames/variants
        self.name_aliases = {
            'hollywood brown': 'marquise brown',
            'odell beckham jr': 'odell beckham jr',
            'aj brown': 'aj brown',
            'dk metcalf': 'dk metcalf',
            'kj hamler': 'kj hamler',
        }
        
        # Stats tracking
        self.processed_count = 0
        self.found_count = 0
        self.stored_count = 0
        self.error_count = 0
        
        logger.info(f"✅ Connected to Supabase: {self.supabase.url[:50]}...")

    def search_espn_for_player(self, player_name, position):
        """Search ESPN directly for a specific player"""
        q = requests.utils.quote(player_name)
        search_strategies = [
            f"http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes?displayName={q}",
            f"http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes?name={q}"
        ]
        
        for search_url in search_strategies:
            try:
                response = requests.get(search_url, headers=self.headers, timeout=10)
                if response.status_code != 200:
                    continue
                    
                data = response.json()
                
                # Check different response formats
                athletes = []
                if 'items' in data:
                    athletes = data['items']
                elif 'athletes' in data:
                    athletes = data['athletes']
                elif 'results' in data:
                    athletes = data['results']
                
                # Process found athletes
                for athlete_ref in athletes[:5]:  # Check first 5 results
                    try:
                        # Get athlete details
                        if isinstance(athlete_ref, dict) and '$ref' in athlete_ref:
                            athlete_url = athlete_ref['$ref']
                        elif isinstance(athlete_ref, dict) and 'id' in athlete_ref:
                            athlete_url = f"http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/{athlete_ref['id']}"
                        elif isinstance(athlete_ref, str):
                            athlete_url = athlete_ref
                        else:
                            continue
                        
                        athlete_response = requests.get(athlete_url, headers=self.headers, timeout=8)
                        if athlete_response.status_code != 200:
                            continue
                            
                        athlete_data = athlete_response.json()
                        
                        espn_name = athlete_data.get('displayName', '')
                        espn_position = athlete_data.get('position', {}).get('abbreviation', '') if athlete_data.get('position') else ''
                        espn_id = athlete_data.get('id')
                        
                        # Check if this matches our player
                        if (self.names_match(player_name, espn_name) and self.positions_match(position, espn_position) and espn_id):
                            logger.info(f"🎯 FOUND: {player_name} -> ESPN ID: {espn_id}")
                            return espn_id
                            
                    except Exception as e:
                        logger.debug(f"Error processing athlete result: {e}")
                        continue
                        
            except Exception as e:
                logger.debug(f"Search strategy failed: {e}")
                continue
        
        return None

    def names_match(self, name1, name2):
        """Enhanced name matching with aliases and token-set comparison"""
        n1 = self.normalize_name(name1)
        n2 = self.normalize_name(name2)
        if n1 == n2:
            return True
        # Alias substitution
        a1 = self.name_aliases.get(n1, n1)
        a2 = self.name_aliases.get(n2, n2)
        if a1 == a2:
            return True
        # Token-set match (order-insensitive)
        t1 = set(n1.split())
        t2 = set(n2.split())
        if t1 and (t1 == t2 or (len(t1.intersection(t2)) >= max(len(t1), len(t2)) - 1)):
            return True
        return False

    def normalize_name(self, name):
        return (name.lower()
                .replace('.', ' ')
                .replace("'", '')
                .replace('-', ' ')
                .replace(' jr', '').replace(' sr', '')
                .replace(' ii', '').replace(' iii', '').replace(' iv', '')
                .replace('a.j.', 'aj').replace('d.j.', 'dj').replace('j.j.', 'jj').replace('t.j.', 'tj')
                .replace('kj', 'kj').replace('dk', 'dk')
                .strip())

    def positions_match(self, ours, espn):
        if not espn:
            return False
        ours_norm = 'K' if ours == 'PK' else ours
        return ours_norm == espn

    def store_espn_id(self, player_id, player_name, espn_id):
        """Store ESPN ID in database"""
        try:
            response = self.supabase.client.table('players').update({
                'espn_player_id': str(espn_id)
            }).eq('id', player_id).execute()
            
            if response.data:
                logger.info(f"✅ STORED ESPN ID {espn_id} for {player_name}")
                self.stored_count += 1
                return True
            else:
                logger.error(f"❌ Failed to store ESPN ID for {player_name}")
                
        except Exception as e:
            logger.error(f"❌ Database error for {player_name}: {e}")
        
        self.error_count += 1
        return False

    def get_our_players_without_espn_ids(self, start=0, page_size=200):
        """Paginate NFL players without ESPN IDs to avoid large payloads"""
        try:
            response = (self.supabase.client.table('players')
                        .select('id, name, position, team')
                        .eq('sport', 'NFL')
                        .in_('position', list(self.offensive_positions))
                        .is_('espn_player_id', 'null')
                        .order('name')
                        .range(start, start + page_size - 1)
                        .execute())
            return response.data or []
        except Exception as e:
            logger.error(f"Error fetching our players: {e}")
            return []

    def run_targeted_search(self, page_size=200):
        """Run targeted search across all players without IDs (paginated)"""
        logger.info("🎯 Starting Targeted ESPN Player Search (paginated)")
        start_time = time.time()
        offset = 0
        total_seen = 0
        while True:
            batch = self.get_our_players_without_espn_ids(start=offset, page_size=page_size)
            if not batch:
                break
            logger.info(f"📋 Processing {len(batch)} players (offset {offset})")
            for player in batch:
                self.processed_count += 1
                total_seen += 1
                logger.info(f"\n🔍 Searching: {player['name']} ({player['position']}, {player.get('team','')})")
                espn_id = self.search_espn_for_player(player['name'], player['position'])
                if espn_id:
                    self.found_count += 1
                    self.store_espn_id(player['id'], player['name'], espn_id)
                else:
                    logger.warning(f"❌ No ESPN ID found for {player['name']}")
                if self.processed_count % 20 == 0:
                    elapsed = time.time() - start_time
                    rate = self.processed_count / elapsed if elapsed > 0 else 0
                    logger.info(f"📈 Progress: {self.processed_count} processed, {self.found_count} found, {self.stored_count} stored (Rate: {rate:.1f}/sec)")
                time.sleep(0.2)
            # Move to next page
            offset += page_size
        # Summary
        elapsed = time.time() - start_time
        logger.info(f"\n🎉 DONE: processed {self.processed_count}, found {self.found_count}, stored {self.stored_count}. Time {elapsed:.1f}s")

def main():
    logger.info("🎯 Targeted ESPN Search - More efficient approach!")
    logger.info("   Instead of scanning all ESPN athletes, we search for our specific players")
    
    search = TargetedESPNSearch()
    search.run_targeted_search(page_size=200)

if __name__ == "__main__":
    main()
#!/usr/bin/env python3

"""
Improved ESPN Player ID Discovery Script
- Real-time storage (stores immediately as matches are found)
- Network error handling with retries
- Resumes from where it left off
- Optimized for speed
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

class ImprovedESPNDiscovery:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        self.supabase = SupabasePlayerStatsClient()
        logger.info(f"✅ Connected to Supabase: {self.supabase.url[:50]}...")
        
        # Stats tracking
        self.processed_count = 0
        self.matched_count = 0
        self.stored_count = 0
        self.error_count = 0

    def get_team_from_athlete(self, athlete_data):
        """Extract team abbreviation from athlete data"""
        try:
            if 'team' in athlete_data and athlete_data['team']:
                if isinstance(athlete_data['team'], dict) and '$ref' in athlete_data['team']:
                    # It's a $ref object, fetch the team data
                    team_response = requests.get(athlete_data['team']['$ref'], headers=self.headers, timeout=5)
                    team_response.raise_for_status()
                    team_data = team_response.json()
                    return team_data.get('abbreviation', '')
                elif isinstance(athlete_data['team'], dict):
                    return athlete_data['team'].get('abbreviation', '')
            return ''
        except:
            return ''

    def names_match(self, name1, name2):
        """Enhanced name matching with common variations"""
        def normalize(name):
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
                   .replace('t.j.', 'tj')
                   .replace('d.k.', 'dk')
                   .replace(' ', '')
                   .strip())
        
        return normalize(name1) == normalize(name2)

    def store_espn_id_immediately(self, player_id, player_name, espn_id):
        """Store ESPN ID immediately with retry logic"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = self.supabase.client.table('players').update({
                    'espn_player_id': str(espn_id)
                }).eq('id', player_id).execute()
                
                if response.data:
                    logger.info(f"✅ STORED ESPN ID {espn_id} for {player_name}")
                    self.stored_count += 1
                    return True
                else:
                    logger.error(f"❌ Failed to store ESPN ID for {player_name} (no data returned)")
                    
            except Exception as e:
                logger.error(f"❌ Database error storing ESPN ID for {player_name} (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)  # Wait before retry
        
        self.error_count += 1
        return False

    def get_our_players_without_espn_ids(self):
        """Get all NFL players without ESPN IDs with retry logic"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = self.supabase.client.table('players').select(
                    'id, name, position, team'
                ).eq('sport', 'NFL').in_(
                    'position', ['QB', 'RB', 'WR', 'TE', 'K', 'FB']
                ).is_('espn_player_id', 'null').execute()
                
                return response.data
                
            except Exception as e:
                logger.error(f"Error fetching our players (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
        
        return []

    def process_espn_athletes_batch(self, start_index=0, batch_size=100):
        """Process ESPN athletes in batches for faster processing"""
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                # Get active NFL athletes
                url = f"http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes?active=true&limit={batch_size}&offset={start_index}"
                
                response = requests.get(url, headers=self.headers, timeout=15)
                response.raise_for_status()
                data = response.json()
                
                if 'items' not in data:
                    logger.warning(f"No items found in ESPN response for offset {start_index}")
                    return 0, True  # processed_count, is_complete
                
                logger.info(f"📊 Processing ESPN athletes {start_index} to {start_index + len(data['items'])}")
                
                # Get our players without ESPN IDs (fresh each batch to account for updates)
                our_players = self.get_our_players_without_espn_ids()
                logger.info(f"📋 Found {len(our_players)} players without ESPN IDs")
                
                batch_processed = 0
                
                # Process each ESPN athlete
                for athlete_ref in data['items']:
                    try:
                        # Extract URL from $ref
                        if isinstance(athlete_ref, dict) and '$ref' in athlete_ref:
                            athlete_url = athlete_ref['$ref']
                        else:
                            athlete_url = athlete_ref
                        
                        # Fetch individual athlete data
                        athlete_response = requests.get(athlete_url, headers=self.headers, timeout=10)
                        athlete_response.raise_for_status()
                        athlete_data = athlete_response.json()
                        
                        # Extract athlete info
                        espn_name = athlete_data.get('displayName', '')
                        espn_position = athlete_data.get('position', {}).get('abbreviation', '') if athlete_data.get('position') else ''
                        espn_team = self.get_team_from_athlete(athlete_data)
                        espn_id = athlete_data.get('id')
                        
                        if not espn_name or not espn_position or not espn_id:
                            continue
                        
                        # Only check offensive positions
                        if espn_position not in ['QB', 'RB', 'WR', 'TE', 'K', 'FB']:
                            continue
                        
                        batch_processed += 1
                        self.processed_count += 1
                        
                        # Try to match with our players
                        for our_player in our_players:
                            our_name = our_player['name'].lower().strip()
                            our_position = our_player['position']
                            
                            # Match by name and position
                            if (self.names_match(our_name, espn_name) and our_position == espn_position):
                                logger.info(f"🎯 MATCH: {our_player['name']} ({our_position}) -> ESPN ID: {espn_id}")
                                self.matched_count += 1
                                
                                # Store immediately
                                if self.store_espn_id_immediately(our_player['id'], our_player['name'], espn_id):
                                    # Remove this player from our list since it now has an ESPN ID
                                    our_players.remove(our_player)
                                break
                        
                        # Progress update every 50 processed
                        if batch_processed % 50 == 0:
                            logger.info(f"📈 Progress: {self.processed_count} processed, {self.matched_count} matched, {self.stored_count} stored")
                        
                        # Small delay to avoid rate limiting
                        time.sleep(0.1)
                        
                    except Exception as e:
                        logger.error(f"Error processing individual athlete: {e}")
                        continue
                
                # Check if we've reached the end
                is_complete = len(data['items']) < batch_size
                return batch_processed, is_complete
                
            except Exception as e:
                logger.error(f"Error in batch processing (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(5)
        
        return 0, True  # If all retries failed, consider it complete

    def run_improved_discovery(self):
        """Run the improved ESPN ID discovery process"""
        logger.info("🚀 Starting Improved ESPN Player ID Discovery")
        
        start_time = time.time()
        batch_size = 100
        current_offset = 0
        
        while True:
            logger.info(f"\n🔄 Processing batch starting at offset {current_offset}")
            
            batch_processed, is_complete = self.process_espn_athletes_batch(current_offset, batch_size)
            
            if is_complete or batch_processed == 0:
                logger.info("✅ Discovery process complete!")
                break
            
            current_offset += batch_size
            
            # Status update
            elapsed = time.time() - start_time
            rate = self.processed_count / elapsed if elapsed > 0 else 0
            logger.info(f"📊 Overall Progress: {self.processed_count} processed, {self.matched_count} matched, {self.stored_count} stored")
            logger.info(f"⚡ Processing rate: {rate:.1f} athletes/second")
            
            # Brief pause between batches
            time.sleep(1)
        
        # Final summary
        elapsed = time.time() - start_time
        logger.info(f"\n🎉 FINAL RESULTS:")
        logger.info(f"   • Total processed: {self.processed_count}")
        logger.info(f"   • Total matched: {self.matched_count}")
        logger.info(f"   • Total stored: {self.stored_count}")
        logger.info(f"   • Errors: {self.error_count}")
        logger.info(f"   • Time elapsed: {elapsed:.1f} seconds")
        logger.info(f"   • Success rate: {(self.stored_count/self.matched_count*100):.1f}%" if self.matched_count > 0 else "")

def main():
    discovery = ImprovedESPNDiscovery()
    discovery.run_improved_discovery()

if __name__ == "__main__":
    main()
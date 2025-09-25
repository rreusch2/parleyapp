#!/usr/bin/env python3

"""
Resumable ESPN Player ID Discovery Script
- Can resume from a specific offset
- Real-time storage and progress tracking
- Optimized for continuous operation
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

class ResumableESPNDiscovery:
    def __init__(self, start_offset=0):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        self.supabase = SupabasePlayerStatsClient()
        self.start_offset = start_offset
        
        # Stats tracking
        self.processed_count = 0
        self.matched_count = 0
        self.stored_count = 0
        self.error_count = 0
        
        logger.info(f"✅ Connected to Supabase: {self.supabase.url[:50]}...")
        logger.info(f"🚀 Starting from offset: {start_offset}")

    def get_team_from_athlete(self, athlete_data):
        """Extract team abbreviation from athlete data"""
        try:
            if 'team' in athlete_data and athlete_data['team']:
                if isinstance(athlete_data['team'], dict) and '$ref' in athlete_data['team']:
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
        """Enhanced name matching"""
        def normalize(name):
            return (name.lower()
                   .replace('.', '')
                   .replace(' jr', '').replace(' sr', '').replace(' ii', '').replace(' iii', '').replace(' iv', '')
                   .replace('a.j.', 'aj').replace('d.j.', 'dj').replace('j.j.', 'jj').replace('t.j.', 'tj')
                   .replace(' ', '').strip())
        
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
                    
            except Exception as e:
                logger.error(f"❌ Database error storing ESPN ID for {player_name} (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)
        
        self.error_count += 1
        return False

    def get_our_players_without_espn_ids(self):
        """Get all NFL players without ESPN IDs"""
        try:
            response = self.supabase.client.table('players').select(
                'id, name, position, team'
            ).eq('sport', 'NFL').in_(
                'position', ['QB', 'RB', 'WR', 'TE', 'K', 'FB']
            ).is_('espn_player_id', 'null').execute()
            
            return response.data
        except Exception as e:
            logger.error(f"Error fetching our players: {e}")
            return []

    def process_espn_athletes_batch(self, start_index=0, batch_size=100):
        """Process ESPN athletes in batches"""
        try:
            # Get active NFL athletes
            url = f"http://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes?active=true&limit={batch_size}&offset={start_index}"
            
            response = requests.get(url, headers=self.headers, timeout=15)
            response.raise_for_status()
            data = response.json()
            
            if 'items' not in data or not data['items']:
                logger.info(f"No more ESPN athletes found at offset {start_index}")
                return 0, True  # processed_count, is_complete
            
            logger.info(f"📊 Processing ESPN athletes {start_index} to {start_index + len(data['items'])}")
            
            # Get our players without ESPN IDs
            our_players = self.get_our_players_without_espn_ids()
            logger.info(f"📋 Found {len(our_players)} players still needing ESPN IDs")
            
            if not our_players:
                logger.info("🎉 All players now have ESPN IDs!")
                return 0, True
            
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
                    for our_player in our_players[:]:  # Use slice copy to allow removal
                        our_name = our_player['name'].lower().strip()
                        our_position = our_player['position']
                        
                        # Match by name and position
                        if (self.names_match(our_name, espn_name) and our_position == espn_position):
                            logger.info(f"🎯 MATCH: {our_player['name']} ({our_position}) -> ESPN ID: {espn_id}")
                            self.matched_count += 1
                            
                            # Store immediately
                            if self.store_espn_id_immediately(our_player['id'], our_player['name'], espn_id):
                                our_players.remove(our_player)
                            break
                    
                    # Brief delay to avoid rate limiting
                    time.sleep(0.05)  # Even faster - 0.05s delay
                    
                except Exception as e:
                    logger.error(f"Error processing individual athlete: {e}")
                    continue
            
            # Check if we've reached the end
            is_complete = len(data['items']) < batch_size
            return batch_processed, is_complete
            
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
            return 0, True

    def run_discovery(self):
        """Run the discovery process"""
        logger.info("🚀 Starting Resumable ESPN Player ID Discovery")
        
        start_time = time.time()
        batch_size = 100
        current_offset = self.start_offset
        
        # Show current progress first
        our_players = self.get_our_players_without_espn_ids()
        logger.info(f"📊 Current status: {len(our_players)} players still need ESPN IDs")
        
        while True:
            logger.info(f"\n🔄 Processing batch starting at offset {current_offset}")
            
            batch_processed, is_complete = self.process_espn_athletes_batch(current_offset, batch_size)
            
            if is_complete or batch_processed == 0:
                logger.info("✅ Discovery process complete!")
                break
            
            current_offset += batch_size
            
            # Status update every batch
            elapsed = time.time() - start_time
            rate = self.processed_count / elapsed if elapsed > 0 else 0
            logger.info(f"📊 Progress: {self.processed_count} processed, {self.matched_count} matched, {self.stored_count} stored (Rate: {rate:.1f}/sec)")
            
            # Very brief pause between batches
            time.sleep(0.5)
        
        # Final summary
        elapsed = time.time() - start_time
        logger.info(f"\n🎉 SESSION RESULTS:")
        logger.info(f"   • Processed: {self.processed_count}")
        logger.info(f"   • Matched: {self.matched_count}")
        logger.info(f"   • Stored: {self.stored_count}")
        logger.info(f"   • Errors: {self.error_count}")
        logger.info(f"   • Time: {elapsed:.1f} seconds")
        logger.info(f"   • Final offset: {current_offset}")

def main():
    # Start from offset 400 since we processed 0-399 already
    START_OFFSET = 400  
    
    logger.info(f"🎯 Resuming ESPN ID discovery from offset {START_OFFSET}")
    logger.info("   (Skipping already processed ESPN athletes 0-399)")
    
    discovery = ResumableESPNDiscovery(start_offset=START_OFFSET)
    discovery.run_discovery()

if __name__ == "__main__":
    main()
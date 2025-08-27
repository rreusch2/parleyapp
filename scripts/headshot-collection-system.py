#!/usr/bin/env python
"""
MLB Player Headshot Collection System
Downloads and matches SportsDataIO headshots with existing database players
Creates visually appealing player trend pages with professional headshots
"""

import os
import sys
import asyncio
import aiohttp
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import json
from supabase import create_client, Client
from difflib import SequenceMatcher
from pathlib import Path
from dotenv import load_dotenv

# Determine project root (repo root is parent of this scripts/ dir)
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Auto-load .env from project root
dotenv_path = PROJECT_ROOT / ".env"
if dotenv_path.exists():
    load_dotenv(dotenv_path)

# Ensure logs directory exists and configure logging
logs_dir = PROJECT_ROOT / "logs"
logs_dir.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(str(logs_dir / 'headshot-collection.log')),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Initialize Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://iriaegoipkjtktitpary.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_SERVICE_KEY:
    logger.error("SUPABASE_SERVICE_ROLE_KEY not found in environment")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# SportsDataIO Configuration
SPORTSDATA_API_KEY = "03d3518bdc1d468cba7855b6e1fcdfa6"
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/mlb"

class HeadshotCollectionSystem:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.processed_headshots = 0
        self.matched_players = 0
        self.failed_matches = 0
        self.existing_players = {}
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def collect_and_match_headshots(self):
        """Main function to collect and match MLB player headshots"""
        try:
            logger.info("📸 Starting MLB player headshot collection and matching...")
            
            # Step 1: Load existing players from database
            await self.load_existing_players()
            
            # Step 2: Fetch headshots from SportsDataIO
            headshots = await self.fetch_sportsdata_headshots()
            
            # Step 3: Match and store headshots
            await self.match_and_store_headshots(headshots)
            
            # Step 4: Generate headshot statistics
            await self.generate_headshot_stats()
            
            logger.info(f"✅ Headshot collection completed!")
            logger.info(f"📊 Processed: {self.processed_headshots}, Matched: {self.matched_players}, Failed: {self.failed_matches}")
            
        except Exception as e:
            logger.error(f"❌ Headshot collection failed: {e}")
            raise

    async def load_existing_players(self):
        """Load all existing MLB players from database"""
        try:
            logger.info("👥 Loading existing MLB players from database...")
            
            response = supabase.table('players').select(
                'id, name, team, sport, position, external_player_id'
            ).eq('sport', 'MLB').eq('active', True).execute()
            
            self.existing_players = {}
            for player in response.data:
                # Create multiple lookup keys for flexible matching
                name_key = (player.get('name') or '').lower().strip()
                team_key = (player.get('team') or '').upper().strip()
                
                # Store by name for primary lookup
                if name_key not in self.existing_players:
                    self.existing_players[name_key] = []
                self.existing_players[name_key].append(player)
                
                # Also store by external_player_id if available
                if player.get('external_player_id'):
                    ext_key = f"ext_{player['external_player_id']}"
                    self.existing_players[ext_key] = [player]
            
            logger.info(f"📝 Loaded {len(response.data)} existing MLB players")
            
        except Exception as e:
            logger.error(f"Error loading existing players: {e}")
            raise

    async def fetch_sportsdata_headshots(self) -> List[Dict]:
        """Fetch headshots from SportsDataIO API"""
        try:
            logger.info("🌐 Fetching headshots from SportsDataIO API...")
            
            url = f"{SPORTSDATA_BASE_URL}/headshots/json/Headshots"
            params = {'key': SPORTSDATA_API_KEY}
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    headshots = await response.json()
                    logger.info(f"📸 Fetched {len(headshots)} headshots from SportsDataIO")
                    return headshots
                else:
                    logger.error(f"SportsDataIO API error: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching headshots: {e}")
            return []

    async def match_and_store_headshots(self, headshots: List[Dict]):
        """Match SportsDataIO headshots with database players and store"""
        try:
            logger.info("🔗 Matching and storing headshots...")
            
            for headshot in headshots:
                await self.process_individual_headshot(headshot)
                
        except Exception as e:
            logger.error(f"Error matching headshots: {e}")

    async def process_individual_headshot(self, headshot: Dict):
        """Process and match individual headshot"""
        try:
            sportsdata_id = headshot.get('PlayerID')
            name = (headshot.get('Name') or '').strip()
            team = (headshot.get('Team') or '').strip()
            headshot_url = (headshot.get('PreferredHostedHeadshotUrl') or '').strip()
            
            if not headshot_url or not name:
                return
                
            self.processed_headshots += 1
            
            # Try multiple matching strategies
            matched_player = await self.find_matching_player(name, team, sportsdata_id)
            
            if matched_player:
                success = await self.store_player_headshot(
                    matched_player['id'],
                    headshot_url,
                    sportsdata_id,
                    matched_player['name'],
                    team
                )
                
                if success:
                    self.matched_players += 1
                    logger.debug(f"✅ Matched headshot: {name} ({team})")
                else:
                    self.failed_matches += 1
            else:
                self.failed_matches += 1
                logger.debug(f"❌ No match found: {name} ({team})")
                
        except Exception as e:
            logger.error(f"Error processing headshot for {headshot.get('Name', 'unknown')}: {e}")
            self.failed_matches += 1

    async def find_matching_player(self, name: str, team: str, sportsdata_id: int) -> Optional[Dict]:
        """Find matching player using multiple strategies"""
        try:
            # Strategy 1: Exact external_player_id match
            ext_key = f"ext_{sportsdata_id}"
            if ext_key in self.existing_players:
                return self.existing_players[ext_key][0]
            
            # Strategy 2: Exact name match (case insensitive)
            name_key = name.lower().strip()
            if name_key in self.existing_players:
                candidates = self.existing_players[name_key]
                
                # If only one candidate, use it
                if len(candidates) == 1:
                    return candidates[0]
                
                # Multiple candidates - match by team
                for candidate in candidates:
                    if self.teams_match(team, candidate.get('team', '')):
                        return candidate
                        
                # If no team match, return first candidate
                return candidates[0]
            
            # Strategy 3: Fuzzy name matching
            best_match = None
            best_score = 0.8  # Minimum similarity threshold
            
            for player_name, candidates in self.existing_players.items():
                if player_name.startswith('ext_'):
                    continue
                    
                similarity = SequenceMatcher(None, name.lower(), player_name).ratio()
                
                if similarity > best_score:
                    # Check if team matches to increase confidence
                    for candidate in candidates:
                        if self.teams_match(team, candidate.get('team', '')):
                            best_match = candidate
                            best_score = similarity
                            break
                    
                    # If no team match but high name similarity, still consider
                    if similarity > 0.9 and not best_match:
                        best_match = candidates[0]
                        best_score = similarity
            
            return best_match
            
        except Exception as e:
            logger.error(f"Error finding matching player: {e}")
            return None

    def teams_match(self, team1: str, team2: str) -> bool:
        """Check if two team names/abbreviations match"""
        if not team1 or not team2:
            return False
            
        team1 = team1.upper().strip()
        team2 = team2.upper().strip()
        
        # Exact match
        if team1 == team2:
            return True
            
        # Common abbreviation mappings
        team_mappings = {
            'WSH': ['WAS', 'WASHINGTON'],
            'SF': ['SFG', 'SAN FRANCISCO'],
            'TB': ['TAM', 'TAMPA BAY'],
            'SD': ['SDP', 'SAN DIEGO'],
            'KC': ['KCR', 'KANSAS CITY'],
            'CWS': ['CHW', 'CHICAGO WHITE SOX'],
            'LAA': ['ANA', 'ANGELS'],
            'ARI': ['AZ', 'ARIZONA'],
            'CLE': ['CLEVELAND'],
            'MIA': ['FLA', 'FLORIDA']
        }
        
        # Check mappings
        for standard, alternatives in team_mappings.items():
            if (team1 == standard and team2 in alternatives) or \
               (team2 == standard and team1 in alternatives) or \
               (team1 in alternatives and team2 in alternatives):
                return True
        
        return False

    async def store_player_headshot(self, player_id: str, headshot_url: str,
                                  sportsdata_id: int, player_name: str, team: str) -> bool:
        """Store headshot for matched player via upsert to player_headshots"""
        try:
            payload = [{
                'player_id': player_id,
                'sportsdata_player_id': sportsdata_id,
                'headshot_url': headshot_url,
                'thumbnail_url': None,
                'source': 'sportsdata_io',
                'is_active': True,
                'last_updated': datetime.now().isoformat()
            }]
            response = supabase.table('player_headshots').upsert(payload, on_conflict='player_id,source').execute()
            if response.data is not None:
                logger.debug(f"📸 Stored headshot for {player_name} ({team})")
                return True
            logger.error(f"Failed to store headshot for {player_name}")
            return False
        except Exception as e:
            logger.error(f"Error storing headshot for {player_name}: {e}")
            return False

    async def generate_headshot_stats(self):
        """Generate and display headshot collection statistics"""
        try:
            logger.info("📊 Generating headshot statistics...")
            
            # Refresh the materialized view
            supabase.rpc('refresh_headshot_stats').execute()
            
            # Get statistics
            stats_response = supabase.table('headshot_stats').select('*').execute()
            
            if stats_response.data:
                for stat in stats_response.data:
                    logger.info(f"🏈 {stat['sport']}: {stat['players_with_headshots']}/{stat['total_players']} players have headshots ({stat['headshot_coverage_percentage']}%)")
            
            # Get players still missing headshots
            missing_response = supabase.rpc('get_players_missing_headshots', {
                'p_sport': 'MLB',
                'p_limit': 10
            }).execute()
            
            if missing_response.data:
                logger.info(f"❗ {len(missing_response.data)} players still missing headshots:")
                for player in missing_response.data[:5]:  # Show first 5
                    logger.info(f"   - {player['name']} ({player['team']})")
            
        except Exception as e:
            logger.error(f"Error generating stats: {e}")

    async def create_missing_players_from_headshots(self, headshots: List[Dict]):
        """Create player records for headshots that don't match existing players"""
        try:
            logger.info("➕ Creating missing player records from headshots...")
            
            created_count = 0
            
            for headshot in headshots:
                name = headshot.get('Name', '').strip()
                team = headshot.get('Team', '').strip()
                sportsdata_id = headshot.get('PlayerID')
                headshot_url = headshot.get('PreferredHostedHeadshotUrl', '')
                
                if not name or not headshot_url:
                    continue
                
                # Check if we can find this player
                matched_player = await self.find_matching_player(name, team, sportsdata_id)
                
                if not matched_player:
                    # Create new player record
                    new_player = {
                        'name': name,
                        'team': team,
                        'sport': 'MLB',
                        'position': 'Unknown',
                        'active': True,
                        'external_player_id': str(sportsdata_id),
                        'created_at': datetime.now().isoformat(),
                        'updated_at': datetime.now().isoformat()
                    }
                    
                    create_response = supabase.table('players').insert(new_player).execute()
                    
                    if create_response.data:
                        created_count += 1
                        logger.info(f"➕ Created player: {name} ({team})")
            
            logger.info(f"✅ Created {created_count} new player records")
            
        except Exception as e:
            logger.error(f"Error creating missing players: {e}")

async def main():
    """Main execution function"""
    try:
        async with HeadshotCollectionSystem() as collector:
            # Collect and match headshots
            await collector.collect_and_match_headshots()
            
        logger.info("🎉 Headshot collection system completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Headshot collection failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

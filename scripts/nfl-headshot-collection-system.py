#!/usr/bin/env python
"""
NFL Player Headshot Collection System
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
        logging.FileHandler(str(logs_dir / 'nfl-headshot-collection.log')),
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

# SportsDataIO Configuration for NFL
SPORTSDATA_API_KEY = "03d3518bdc1d468cba7855b6e1fcdfa6"
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/nfl"

class NFLHeadshotCollectionSystem:
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
        """Main function to collect and match NFL player headshots"""
        try:
            logger.info("🏈 Starting NFL player headshot collection and matching...")
            
            # Step 1: Load existing players from database
            await self.load_existing_players()
            
            # Step 2: Fetch headshots from SportsDataIO
            headshots = await self.fetch_sportsdata_headshots()
            
            # Step 3: Match and store headshots
            await self.match_and_store_headshots(headshots)
            
            # Step 4: Generate headshot statistics
            await self.generate_headshot_stats()
            
            logger.info(f"✅ NFL headshot collection completed!")
            logger.info(f"📊 Processed: {self.processed_headshots}, Matched: {self.matched_players}, Failed: {self.failed_matches}")
            
        except Exception as e:
            logger.error(f"❌ NFL headshot collection failed: {e}")
            raise

    async def load_existing_players(self):
        """Load all existing NFL players from database"""
        try:
            logger.info("👥 Loading existing NFL players from database...")
            
            response = supabase.table('players').select(
                'id, name, team, sport, position, external_player_id'
            ).eq('sport', 'NFL').eq('active', True).execute()
            
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
            
            logger.info(f"📝 Loaded {len(response.data)} existing NFL players")
            
        except Exception as e:
            logger.error(f"Error loading existing players: {e}")
            raise

    async def fetch_sportsdata_headshots(self) -> List[Dict]:
        """Fetch headshots from SportsDataIO NFL API"""
        try:
            logger.info("🌐 Fetching NFL headshots from SportsDataIO API...")
            
            url = f"{SPORTSDATA_BASE_URL}/headshots/json/Headshots"
            params = {'key': SPORTSDATA_API_KEY}
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    headshots = await response.json()
                    logger.info(f"🏈 Fetched {len(headshots)} NFL headshots from SportsDataIO")
                    return headshots
                else:
                    logger.error(f"SportsDataIO NFL API error: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching NFL headshots: {e}")
            return []

    async def match_and_store_headshots(self, headshots: List[Dict]):
        """Match SportsDataIO headshots with database players and store"""
        try:
            logger.info("🔗 Matching and storing NFL headshots...")
            
            for headshot in headshots:
                await self.process_individual_headshot(headshot)
                
        except Exception as e:
            logger.error(f"Error matching NFL headshots: {e}")

    async def process_individual_headshot(self, headshot: Dict):
        """Process and match individual NFL headshot"""
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
                    logger.debug(f"✅ Matched NFL headshot: {name} ({team})")
                else:
                    self.failed_matches += 1
            else:
                self.failed_matches += 1
                logger.debug(f"❌ No NFL match found: {name} ({team})")
                
        except Exception as e:
            logger.error(f"Error processing NFL headshot for {headshot.get('Name', 'unknown')}: {e}")
            self.failed_matches += 1

    async def find_matching_player(self, name: str, team: str, sportsdata_id: int) -> Optional[Dict]:
        """Find matching NFL player using multiple strategies"""
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
                    if self.nfl_teams_match(team, candidate.get('team', '')):
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
                        if self.nfl_teams_match(team, candidate.get('team', '')):
                            best_match = candidate
                            best_score = similarity
                            break
                    
                    # If no team match but high name similarity, still consider
                    if similarity > 0.9 and not best_match:
                        best_match = candidates[0]
                        best_score = similarity
            
            return best_match
            
        except Exception as e:
            logger.error(f"Error finding matching NFL player: {e}")
            return None

    def nfl_teams_match(self, team1: str, team2: str) -> bool:
        """Check if two NFL team names/abbreviations match"""
        if not team1 or not team2:
            return False
            
        team1 = team1.upper().strip()
        team2 = team2.upper().strip()
        
        # Exact match
        if team1 == team2:
            return True
            
        # NFL team abbreviation mappings
        nfl_team_mappings = {
            'ARI': ['ARIZONA', 'ARIZONA CARDINALS'],
            'ATL': ['ATLANTA', 'ATLANTA FALCONS'],
            'BAL': ['BALTIMORE', 'BALTIMORE RAVENS'],
            'BUF': ['BUFFALO', 'BUFFALO BILLS'],
            'CAR': ['CAROLINA', 'CAROLINA PANTHERS'],
            'CHI': ['CHICAGO', 'CHICAGO BEARS'],
            'CIN': ['CINCINNATI', 'CINCINNATI BENGALS'],
            'CLE': ['CLEVELAND', 'CLEVELAND BROWNS'],
            'DAL': ['DALLAS', 'DALLAS COWBOYS'],
            'DEN': ['DENVER', 'DENVER BRONCOS'],
            'DET': ['DETROIT', 'DETROIT LIONS'],
            'GB': ['GREEN BAY', 'GREEN BAY PACKERS', 'GBP'],
            'HOU': ['HOUSTON', 'HOUSTON TEXANS'],
            'IND': ['INDIANAPOLIS', 'INDIANAPOLIS COLTS'],
            'JAX': ['JACKSONVILLE', 'JACKSONVILLE JAGUARS', 'JAC'],
            'KC': ['KANSAS CITY', 'KANSAS CITY CHIEFS', 'KAN'],
            'LV': ['LAS VEGAS', 'LAS VEGAS RAIDERS', 'LVR', 'RAI'],
            'LAC': ['LOS ANGELES CHARGERS', 'LAC', 'SD', 'SAN DIEGO'],
            'LAR': ['LOS ANGELES RAMS', 'LA', 'STL', 'ST. LOUIS'],
            'MIA': ['MIAMI', 'MIAMI DOLPHINS'],
            'MIN': ['MINNESOTA', 'MINNESOTA VIKINGS'],
            'NE': ['NEW ENGLAND', 'NEW ENGLAND PATRIOTS', 'NEP'],
            'NO': ['NEW ORLEANS', 'NEW ORLEANS SAINTS', 'NOR'],
            'NYG': ['NEW YORK GIANTS', 'NYG', 'NY GIANTS'],
            'NYJ': ['NEW YORK JETS', 'NY JETS'],
            'PHI': ['PHILADELPHIA', 'PHILADELPHIA EAGLES'],
            'PIT': ['PITTSBURGH', 'PITTSBURGH STEELERS'],
            'SF': ['SAN FRANCISCO', 'SAN FRANCISCO 49ERS', 'SFO'],
            'SEA': ['SEATTLE', 'SEATTLE SEAHAWKS'],
            'TB': ['TAMPA BAY', 'TAMPA BAY BUCCANEERS', 'TAM'],
            'TEN': ['TENNESSEE', 'TENNESSEE TITANS'],
            'WAS': ['WASHINGTON', 'WASHINGTON COMMANDERS', 'WSH']
        }
        
        # Check mappings
        for standard, alternatives in nfl_team_mappings.items():
            if (team1 == standard and team2 in alternatives) or \
               (team2 == standard and team1 in alternatives) or \
               (team1 in alternatives and team2 in alternatives):
                return True
        
        return False

    async def store_player_headshot(self, player_id: str, headshot_url: str,
                                  sportsdata_id: int, player_name: str, team: str) -> bool:
        """Store headshot for matched NFL player via upsert to player_headshots"""
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
                logger.debug(f"🏈 Stored headshot for {player_name} ({team})")
                return True
            logger.error(f"Failed to store headshot for {player_name}")
            return False
        except Exception as e:
            logger.error(f"Error storing headshot for {player_name}: {e}")
            return False

    async def generate_headshot_stats(self):
        """Generate and display NFL headshot collection statistics"""
        try:
            logger.info("📊 Generating NFL headshot statistics...")
            
            # Get NFL-specific statistics
            nfl_total_response = supabase.table('players').select('id', count='exact').eq('sport', 'NFL').eq('active', True).execute()
            total_nfl_players = nfl_total_response.count or 0
            
            nfl_headshots_response = supabase.table('player_headshots').select('player_id', count='exact').in_('player_id', 
                [p['id'] for p in supabase.table('players').select('id').eq('sport', 'NFL').eq('active', True).execute().data]
            ).execute()
            nfl_with_headshots = nfl_headshots_response.count or 0
            
            coverage_percentage = (nfl_with_headshots / total_nfl_players * 100) if total_nfl_players > 0 else 0
            
            logger.info(f"🏈 NFL: {nfl_with_headshots}/{total_nfl_players} players have headshots ({coverage_percentage:.1f}%)")
            
            # Get players still missing headshots
            players_with_headshots = [h['player_id'] for h in nfl_headshots_response.data] if nfl_headshots_response.data else []
            missing_response = supabase.table('players').select('name, team').eq('sport', 'NFL').eq('active', True).not_.in_('id', players_with_headshots).limit(10).execute()
            
            if missing_response.data:
                logger.info(f"❗ {len(missing_response.data)} NFL players still missing headshots:")
                for player in missing_response.data[:5]:  # Show first 5
                    logger.info(f"   - {player['name']} ({player['team']})")
            
        except Exception as e:
            logger.error(f"Error generating NFL stats: {e}")

async def main():
    """Main execution function"""
    try:
        async with NFLHeadshotCollectionSystem() as collector:
            # Collect and match headshots
            await collector.collect_and_match_headshots()
            
        logger.info("🎉 NFL headshot collection system completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ NFL headshot collection failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

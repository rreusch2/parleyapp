#!/usr/bin/env python3
"""
NFL 2024 Historical Stats Ingestion Script
Uses custom StatMuse API server to collect accurate historical player stats
"""

import os
import sys
import json
import requests
import time
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import logging

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Supabase imports
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('nfl_stats_ingestion.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class NFLStatsIngestionManager:
    """Manages NFL historical stats ingestion using StatMuse API"""
    
    def __init__(self):
        """Initialize the ingestion manager"""
        # Supabase client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not supabase_url or not supabase_service_key:
            raise ValueError("Missing Supabase credentials in environment variables")
            
        self.supabase: Client = create_client(supabase_url, supabase_service_key)
        
        # StatMuse API server configuration
        self.statmuse_api_url = "http://localhost:5001"
        
        # NFL 2024 season configuration
        self.season_weeks = list(range(1, 19))  # Regular season weeks 1-18
        self.playoff_weeks = ["wildcard", "divisional", "conference", "super bowl"]
        
        # Stats tracking
        self.stats_collected = 0
        self.players_processed = 0
        self.errors_encountered = 0
        
        logger.info("🏈 NFL Stats Ingestion Manager initialized")
        logger.info(f"📊 Target: Weeks 1-18 + Playoffs for 2024 season")
    
    def test_statmuse_connection(self) -> bool:
        """Test connection to StatMuse API server"""
        try:
            response = requests.get(f"{self.statmuse_api_url}/health", timeout=10)
            if response.status_code == 200:
                logger.info("✅ StatMuse API server connection successful")
                return True
            else:
                logger.error(f"❌ StatMuse API server returned {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"❌ Failed to connect to StatMuse API server: {e}")
            return False
    
    def get_nfl_players(self, position_filter: Optional[List[str]] = None) -> List[Dict]:
        """Get NFL players from database"""
        try:
            query = self.supabase.table('players').select('id, name, position, team').eq('sport', 'NFL')
            
            if position_filter:
                query = query.in_('position', position_filter)
                
            response = query.execute()
            
            if response.data:
                logger.info(f"📋 Found {len(response.data)} NFL players")
                return response.data
            else:
                logger.warning("⚠️ No NFL players found in database")
                return []
                
        except Exception as e:
            logger.error(f"❌ Error fetching NFL players: {e}")
            return []
    
    def query_statmuse_for_player_week(self, player_name: str, week: str) -> Optional[Dict]:
        """Query StatMuse API for specific player's week stats"""
        try:
            # Format player name for StatMuse (handle common name variations)
            formatted_name = self.format_player_name_for_statmuse(player_name)
            
            # Create query based on your working example
            if isinstance(week, int):
                query = f"{formatted_name} stats week {week}"
            else:
                query = f"{formatted_name} stats {week}"
            
            logger.info(f"🔍 Querying StatMuse: {query}")
            
            # Make request to StatMuse API server
            response = requests.post(
                f"{self.statmuse_api_url}/query",
                json={"query": query},
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    logger.info(f"✅ StatMuse result: {result.get('answer', '')[:100]}...")
                    return result
                else:
                    logger.warning(f"⚠️ StatMuse query failed: {result.get('error', 'Unknown error')}")
                    return None
            else:
                logger.error(f"❌ StatMuse API returned {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error querying StatMuse for {player_name} week {week}: {e}")
            return None
    
    def format_player_name_for_statmuse(self, name: str) -> str:
        """Format player name for StatMuse queries"""
        # Handle common database name formats
        # "J.Burrow" -> "Joe Burrow"
        # "P.Mahomes" -> "Patrick Mahomes"
        
        name_mapping = {
            "J.Burrow": "Joe Burrow",
            "P.Mahomes": "Patrick Mahomes", 
            "J.Allen": "Josh Allen",
            "L.Jackson": "Lamar Jackson",
            "A.Rodgers": "Aaron Rodgers",
            "T.Brady": "Tom Brady",
            "D.Prescott": "Dak Prescott",
            "R.Wilson": "Russell Wilson",
            "J.Herbert": "Justin Herbert",
            "T.Tagovailoa": "Tua Tagovailoa",
            "K.Murray": "Kyler Murray",
            "J.Hurts": "Jalen Hurts",
            "D.Henry": "Derrick Henry",
            "J.Taylor": "Jonathan Taylor",
            "N.Chubb": "Nick Chubb",
            "D.Cook": "Dalvin Cook",
            "C.McCaffrey": "Christian McCaffrey",
            "A.Kamara": "Alvin Kamara",
            "E.Elliott": "Ezekiel Elliott",
            "S.Barkley": "Saquon Barkley",
            "D.Adams": "Davante Adams",
            "T.Hill": "Tyreek Hill",
            "S.Diggs": "Stefon Diggs",
            "D.Hopkins": "DeAndre Hopkins",
            "C.Ridley": "Calvin Ridley",
            "M.Evans": "Mike Evans",
            "C.Godwin": "Chris Godwin",
            "K.Allen": "Keenan Allen",
            "T.Kelce": "Travis Kelce",
            "G.Kittle": "George Kittle",
            "M.Andrews": "Mark Andrews",
            "D.Waller": "Darren Waller"
        }
        
        # Check if we have a mapping for this name
        if name in name_mapping:
            return name_mapping[name]
        
        # Otherwise, try to expand common abbreviations
        # J.Smith -> Joe Smith (guess)
        if '.' in name and len(name.split('.')[0]) == 1:
            parts = name.split('.')
            if len(parts) == 2:
                first_initial = parts[0]
                last_name = parts[1]
                
                # Common first name expansions
                first_name_expansions = {
                    'J': 'Josh',  # Most common for NFL
                    'D': 'Derek',
                    'M': 'Mike',
                    'C': 'Chris',
                    'T': 'Tony',
                    'A': 'Aaron',
                    'R': 'Ryan',
                    'B': 'Brandon',
                    'K': 'Kyle',
                    'N': 'Nick',
                    'S': 'Steve'
                }
                
                if first_initial in first_name_expansions:
                    return f"{first_name_expansions[first_initial]} {last_name}"
        
        # Return original name if no modifications needed
        return name
    
    def parse_statmuse_stats(self, statmuse_response: Dict, player_position: str) -> Optional[Dict]:
        """Parse StatMuse response and extract individual stats"""
        try:
            answer = statmuse_response.get('answer', '')
            if not answer:
                return None
            
            logger.info(f"📝 Parsing stats from: {answer}")
            
            # Initialize stats dictionary based on position
            stats = self.initialize_stats_by_position(player_position)
            
            # Parse common NFL stats from the answer text
            # Example: "Joe Burrow completed 37 passes in 46 attempts for 277 yards with 1 touchdown and 1 interception"
            
            # Quarterback stats
            if player_position == 'QB':
                stats.update(self.parse_qb_stats(answer))
            
            # Running back stats  
            elif player_position == 'RB':
                stats.update(self.parse_rb_stats(answer))
            
            # Wide receiver / Tight end stats
            elif player_position in ['WR', 'TE']:
                stats.update(self.parse_receiver_stats(answer))
            
            # Defensive stats
            elif player_position in ['LB', 'DB', 'DL', 'CB', 'S', 'OLB', 'ILB', 'DE', 'DT', 'NT']:
                stats.update(self.parse_defensive_stats(answer))
            
            # Add metadata
            stats['raw_statmuse_response'] = answer
            stats['position'] = player_position
            stats['parsing_timestamp'] = datetime.now().isoformat()
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Error parsing StatMuse stats: {e}")
            return None
    
    def initialize_stats_by_position(self, position: str) -> Dict:
        """Initialize stats dictionary based on player position"""
        base_stats = {
            'games_played': 0,
            'snaps': 0,
            'fantasy_points': 0.0
        }
        
        if position == 'QB':
            base_stats.update({
                'passing_attempts': 0,
                'passing_completions': 0,
                'passing_yards': 0,
                'passing_touchdowns': 0,
                'interceptions': 0,
                'rushing_attempts': 0,
                'rushing_yards': 0,
                'rushing_touchdowns': 0,
                'sacks_taken': 0,
                'fumbles': 0
            })
        elif position == 'RB':
            base_stats.update({
                'rushing_attempts': 0,
                'rushing_yards': 0,
                'rushing_touchdowns': 0,
                'receptions': 0,
                'receiving_yards': 0,
                'receiving_touchdowns': 0,
                'fumbles': 0,
                'targets': 0
            })
        elif position in ['WR', 'TE']:
            base_stats.update({
                'receptions': 0,
                'receiving_yards': 0,
                'receiving_touchdowns': 0,
                'targets': 0,
                'rushing_attempts': 0,
                'rushing_yards': 0,
                'rushing_touchdowns': 0,
                'fumbles': 0
            })
        elif position in ['LB', 'DB', 'DL', 'CB', 'S', 'OLB', 'ILB', 'DE', 'DT', 'NT']:
            base_stats.update({
                'tackles': 0,
                'assists': 0,
                'sacks': 0.0,
                'quarterback_hits': 0,
                'tackles_for_loss': 0,
                'interceptions': 0,
                'passes_defended': 0,
                'forced_fumbles': 0,
                'fumble_recoveries': 0,
                'defensive_touchdowns': 0
            })
        
        return base_stats
    
    def parse_qb_stats(self, text: str) -> Dict:
        """Parse quarterback stats from StatMuse text"""
        stats = {}
        
        # Passing stats
        # "completed 37 passes in 46 attempts for 277 yards"
        passing_match = re.search(r'completed (\d+) passes in (\d+) attempts for (\d+) yards', text, re.IGNORECASE)
        if passing_match:
            stats['passing_completions'] = int(passing_match.group(1))
            stats['passing_attempts'] = int(passing_match.group(2))
            stats['passing_yards'] = int(passing_match.group(3))
        
        # Touchdowns and interceptions
        # "with 1 touchdown and 1 interception"
        td_int_match = re.search(r'with (\d+) touchdown(?:s)? and (\d+) interception(?:s)?', text, re.IGNORECASE)
        if td_int_match:
            stats['passing_touchdowns'] = int(td_int_match.group(1))
            stats['interceptions'] = int(td_int_match.group(2))
        
        # Rushing stats for QBs
        rushing_match = re.search(r'(\d+) rushing yards', text, re.IGNORECASE)
        if rushing_match:
            stats['rushing_yards'] = int(rushing_match.group(1))
        
        rushing_attempts_match = re.search(r'(\d+) rushing attempts', text, re.IGNORECASE)
        if rushing_attempts_match:
            stats['rushing_attempts'] = int(rushing_attempts_match.group(1))
        
        return stats
    
    def parse_rb_stats(self, text: str) -> Dict:
        """Parse running back stats from StatMuse text"""
        stats = {}
        
        # Rushing stats
        # "20 carries for 85 yards and 1 touchdown"
        rushing_match = re.search(r'(\d+) carries for (\d+) yards(?:.+?(\d+) touchdown)?', text, re.IGNORECASE)
        if rushing_match:
            stats['rushing_attempts'] = int(rushing_match.group(1))
            stats['rushing_yards'] = int(rushing_match.group(2))
            if rushing_match.group(3):
                stats['rushing_touchdowns'] = int(rushing_match.group(3))
        
        # Receiving stats
        # "3 receptions for 25 yards"
        receiving_match = re.search(r'(\d+) receptions for (\d+) yards', text, re.IGNORECASE)
        if receiving_match:
            stats['receptions'] = int(receiving_match.group(1))
            stats['receiving_yards'] = int(receiving_match.group(2))
        
        return stats
    
    def parse_receiver_stats(self, text: str) -> Dict:
        """Parse wide receiver/tight end stats from StatMuse text"""
        stats = {}
        
        # Receiving stats
        # "8 receptions for 75 yards and 1 touchdown"
        receiving_match = re.search(r'(\d+) receptions for (\d+) yards(?:.+?(\d+) touchdown)?', text, re.IGNORECASE)
        if receiving_match:
            stats['receptions'] = int(receiving_match.group(1))
            stats['receiving_yards'] = int(receiving_match.group(2))
            if receiving_match.group(3):
                stats['receiving_touchdowns'] = int(receiving_match.group(3))
        
        # Targets
        targets_match = re.search(r'(\d+) targets', text, re.IGNORECASE)
        if targets_match:
            stats['targets'] = int(targets_match.group(1))
        
        return stats
    
    def parse_defensive_stats(self, text: str) -> Dict:
        """Parse defensive player stats from StatMuse text"""
        stats = {}
        
        # Tackles
        tackles_match = re.search(r'(\d+) tackles', text, re.IGNORECASE)
        if tackles_match:
            stats['tackles'] = int(tackles_match.group(1))
        
        # Sacks
        sacks_match = re.search(r'(\d+(?:\.\d+)?) sacks?', text, re.IGNORECASE)
        if sacks_match:
            stats['sacks'] = float(sacks_match.group(1))
        
        # Interceptions
        int_match = re.search(r'(\d+) interceptions?', text, re.IGNORECASE)
        if int_match:
            stats['interceptions'] = int(int_match.group(1))
        
        return stats
    
    def store_player_game_stats(self, player_id: str, week: str, stats: Dict) -> bool:
        """Store player stats in player_game_stats table"""
        try:
            # Create event_id based on week (you might want to link to actual game events)
            event_id = f"nfl_2024_week_{week}_{player_id}"
            
            data = {
                'player_id': player_id,
                'event_id': None,  # Set to None for now, or create event records separately
                'stats': stats,
                'fantasy_points': stats.get('fantasy_points', 0),
                'created_at': datetime.now().isoformat()
            }
            
            response = self.supabase.table('player_game_stats').insert(data).execute()
            
            if response.data:
                logger.info(f"✅ Stored stats for player {player_id} week {week}")
                return True
            else:
                logger.error(f"❌ Failed to store stats for player {player_id} week {week}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error storing stats for player {player_id} week {week}: {e}")
            return False
    
    def process_player_season(self, player: Dict) -> int:
        """Process entire 2024 season for a single player"""
        player_id = player['id']
        player_name = player['name']
        player_position = player['position']
        
        logger.info(f"🏈 Processing {player_name} ({player_position}) - {player['team']}")
        
        stats_collected = 0
        
        # Process regular season weeks
        for week in self.season_weeks:
            try:
                # Query StatMuse for this week
                statmuse_result = self.query_statmuse_for_player_week(player_name, week)
                
                if statmuse_result and statmuse_result.get('success'):
                    # Parse the stats
                    parsed_stats = self.parse_statmuse_stats(statmuse_result, player_position)
                    
                    if parsed_stats:
                        # Store in database
                        if self.store_player_game_stats(player_id, str(week), parsed_stats):
                            stats_collected += 1
                            self.stats_collected += 1
                
                # Rate limiting - be nice to StatMuse
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"❌ Error processing {player_name} week {week}: {e}")
                self.errors_encountered += 1
        
        # Process playoff weeks for relevant players
        # (You might want to be more selective here)
        for playoff_week in self.playoff_weeks:
            try:
                statmuse_result = self.query_statmuse_for_player_week(player_name, playoff_week)
                
                if statmuse_result and statmuse_result.get('success'):
                    parsed_stats = self.parse_statmuse_stats(statmuse_result, player_position)
                    
                    if parsed_stats:
                        if self.store_player_game_stats(player_id, playoff_week, parsed_stats):
                            stats_collected += 1
                            self.stats_collected += 1
                
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"❌ Error processing {player_name} {playoff_week}: {e}")
                self.errors_encountered += 1
        
        logger.info(f"✅ Completed {player_name}: {stats_collected} stat records collected")
        return stats_collected
    
    def run_full_ingestion(self, position_filter: Optional[List[str]] = None, max_players: Optional[int] = None):
        """Run full NFL 2024 historical stats ingestion"""
        logger.info("🚀 Starting NFL 2024 Historical Stats Ingestion")
        
        # Test StatMuse connection first
        if not self.test_statmuse_connection():
            logger.error("❌ Cannot connect to StatMuse API server. Please start it first.")
            return
        
        # Get NFL players
        players = self.get_nfl_players(position_filter)
        
        if not players:
            logger.error("❌ No players found to process")
            return
        
        # Limit players if specified
        if max_players:
            players = players[:max_players]
            logger.info(f"🎯 Limited to first {max_players} players for testing")
        
        logger.info(f"📊 Processing {len(players)} NFL players")
        
        start_time = datetime.now()
        
        # Process each player
        for i, player in enumerate(players, 1):
            try:
                logger.info(f"📈 Progress: {i}/{len(players)} players")
                
                stats_for_player = self.process_player_season(player)
                self.players_processed += 1
                
                # Progress update every 10 players
                if i % 10 == 0:
                    elapsed = datetime.now() - start_time
                    logger.info(f"⏱️ Progress Update: {i}/{len(players)} players, {self.stats_collected} stats collected, {elapsed}")
                
            except Exception as e:
                logger.error(f"❌ Critical error processing player {player.get('name', 'Unknown')}: {e}")
                self.errors_encountered += 1
        
        # Final summary
        end_time = datetime.now()
        duration = end_time - start_time
        
        logger.info("🎉 NFL 2024 Historical Stats Ingestion Complete!")
        logger.info(f"📊 Final Summary:")
        logger.info(f"   - Players Processed: {self.players_processed}")
        logger.info(f"   - Stats Records Collected: {self.stats_collected}")
        logger.info(f"   - Errors Encountered: {self.errors_encountered}")
        logger.info(f"   - Duration: {duration}")
        logger.info(f"   - Average Stats per Player: {self.stats_collected / max(self.players_processed, 1):.1f}")

def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='NFL 2024 Historical Stats Ingestion')
    parser.add_argument('--positions', nargs='+', help='Filter by positions (QB, RB, WR, TE)', default=None)
    parser.add_argument('--max-players', type=int, help='Limit number of players for testing', default=None)
    parser.add_argument('--test-mode', action='store_true', help='Run in test mode with limited players')
    
    args = parser.parse_args()
    
    if args.test_mode:
        args.max_players = 5
        args.positions = ['QB']
        logger.info("🧪 Running in test mode: 5 QBs only")
    
    try:
        ingestion_manager = NFLStatsIngestionManager()
        ingestion_manager.run_full_ingestion(
            position_filter=args.positions,
            max_players=args.max_players
        )
        
    except KeyboardInterrupt:
        logger.info("⏹️ Ingestion stopped by user")
    except Exception as e:
        logger.error(f"❌ Critical error: {e}")
        raise

if __name__ == "__main__":
    main()

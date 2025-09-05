#!/usr/bin/env python3
"""
NFL Data Ingestion Script using SportsData.io API
Ingests players, game stats, and headshots for accurate NFL trends data
"""

import os
import sys
import requests
import json
import uuid
from datetime import datetime, timedelta
import time
from typing import Dict, List, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Installing required packages...")
    os.system("pip install supabase python-dotenv requests")
    from supabase import create_client, Client

class NFLDataIngestion:
    def __init__(self):
        self.api_key = "62fa3caa1fcd47eb99a2b737973a46be"
        self.base_url = "https://api.sportsdata.io/v3/nfl"
        
        # Supabase configuration
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not self.supabase_url or not self.supabase_service_key:
            print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
            sys.exit(1)
            
        # Initialize Supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_service_key)
        
        # NFL-specific stat mappings for different positions
        self.position_stat_mapping = {
            'QB': {
                'passing_yards': 'PassingYards',
                'passing_tds': 'PassingTouchdowns', 
                'interceptions': 'PassingInterceptions',
                'rushing_yards': 'RushingYards',
                'rushing_tds': 'RushingTouchdowns',
                'completions': 'PassingCompletions',
                'attempts': 'PassingAttempts'
            },
            'RB': {
                'rushing_yards': 'RushingYards',
                'rushing_tds': 'RushingTouchdowns',
                'receptions': 'Receptions',
                'receiving_yards': 'ReceivingYards',
                'receiving_tds': 'ReceivingTouchdowns',
                'fumbles': 'Fumbles'
            },
            'WR': {
                'receptions': 'Receptions',
                'receiving_yards': 'ReceivingYards',
                'receiving_tds': 'ReceivingTouchdowns',
                'targets': 'ReceivingTargets',
                'rushing_yards': 'RushingYards',
                'rushing_tds': 'RushingTouchdowns'
            },
            'TE': {
                'receptions': 'Receptions',
                'receiving_yards': 'ReceivingYards', 
                'receiving_tds': 'ReceivingTouchdowns',
                'targets': 'ReceivingTargets'
            },
            'K': {
                'field_goals_made': 'FieldGoalsMade',
                'field_goals_attempted': 'FieldGoalsAttempted',
                'extra_points_made': 'ExtraPointsMade'
            },
            'DEF': {
                'sacks': 'Sacks',
                'interceptions': 'Interceptions',
                'fumbles_recovered': 'FumblesRecovered',
                'tackles': 'Tackles',
                'tackles_for_loss': 'TacklesForLoss'
            }
        }

    def connect_db(self):
        """Test Supabase database connection"""
        try:
            # Test connection by querying a simple table
            result = self.supabase.table('players').select('id').limit(1).execute()
            print("✅ Connected to Supabase database")
            return True
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            return False

    def make_api_request(self, endpoint: str, params: Dict = None) -> Optional[Dict]:
        """Make API request to SportsData.io with rate limiting"""
        url = f"{self.base_url}/{endpoint}"
        
        if params is None:
            params = {}
        params['key'] = self.api_key
        
        try:
            print(f"🔄 API Request: {url}")
            response = requests.get(url, params=params)
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                print("⚠️ Rate limit hit, waiting 60 seconds...")
                time.sleep(60)
                return self.make_api_request(endpoint, params)
            else:
                print(f"❌ API Error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Request failed: {e}")
            return None
        
        # Rate limiting - 1 request per minute for most endpoints
        time.sleep(1)

    def get_all_nfl_players(self, season: str = "2024") -> List[Dict]:
        """Get all NFL players from 2024 season"""
        print(f"🔍 Fetching all NFL players for {season} season...")
        
        players_data = self.make_api_request(f"stats/json/PlayerSeasonStats/{season}")
        
        if not players_data:
            print("❌ Failed to fetch player season stats")
            return []
            
        print(f"✅ Found {len(players_data)} NFL players")
        return players_data

    def store_nfl_players(self, players_data: List[Dict]) -> Dict[int, str]:
        """Store NFL players in database and return mapping of sportsdata_id -> our_uuid"""
        player_mapping = {}
        stored_count = 0
        
        print("💾 Storing NFL players in database...")
        
        for player in players_data:
            try:
                # Extract player info
                sportsdata_player_id = player.get('PlayerID')
                name = player.get('Name', '').strip()
                position = player.get('Position', '').strip()
                team = player.get('Team', '').strip()
                jersey_number = player.get('Number')
                
                if not name or not sportsdata_player_id:
                    continue
                
                # Create unique player_key
                player_key = f"nfl_{name.lower().replace(' ', '_')}_{sportsdata_player_id}"
                
                # Check if player already exists
                existing_result = self.supabase.table('players').select('id').eq('external_player_id', str(sportsdata_player_id)).eq('sport', 'NFL').execute()
                
                if existing_result.data:
                    player_mapping[sportsdata_player_id] = existing_result.data[0]['id']
                    continue
                
                # Insert new player
                player_uuid = str(uuid.uuid4())
                
                player_data = {
                    'id': player_uuid,
                    'external_player_id': str(sportsdata_player_id),
                    'name': name,
                    'position': position,
                    'team': team,
                    'sport': 'NFL',
                    'jersey_number': jersey_number,
                    'player_key': player_key,
                    'player_name': name,
                    'sport_key': 'nfl',
                    'active': True,
                    'metadata': {
                        'sportsdata_id': sportsdata_player_id,
                        'season': '2024',
                        'source': 'sportsdata_io'
                    },
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                
                result = self.supabase.table('players').insert(player_data).execute()
                
                if result.data:
                    player_mapping[sportsdata_player_id] = player_uuid
                    stored_count += 1
                    
                    if stored_count % 50 == 0:
                        print(f"📦 Stored {stored_count} players...")
                    
            except Exception as e:
                print(f"❌ Error storing player {player.get('Name', 'Unknown')}: {e}")
                continue
        
        print(f"✅ Successfully stored {stored_count} NFL players")
        return player_mapping

    def get_player_game_logs(self, sportsdata_player_id: int, season: str = "2024", games: int = 10) -> List[Dict]:
        """Get last N game logs for a specific player"""
        endpoint = f"stats/json/PlayerGameStatsBySeason/{season}/{sportsdata_player_id}/{games}"
        return self.make_api_request(endpoint)

    def extract_position_stats(self, game_data: Dict, position: str) -> Dict:
        """Extract position-appropriate stats from game data"""
        stats = {
            'sport': 'NFL',
            'game_date': game_data.get('Date', '').split('T')[0] if game_data.get('Date') else None,
            'opponent': game_data.get('Opponent', ''),
            'home_or_away': 'home' if game_data.get('HomeOrAway') == 'HOME' else 'away'
        }
        
        # Map position-specific stats
        position_mapping = self.position_stat_mapping.get(position, {})
        
        for our_stat, api_field in position_mapping.items():
            value = game_data.get(api_field, 0)
            stats[our_stat] = value if value is not None else 0
            
        # Add fantasy points if available
        if 'FantasyPoints' in game_data:
            stats['fantasy_points'] = game_data['FantasyPoints']
            
        return stats

    def store_player_game_stats(self, player_mapping: Dict[int, str]) -> int:
        """Store last 10 game stats for all NFL players"""
        total_stored = 0
        
        print("🎮 Fetching and storing player game statistics...")
        
        for sportsdata_id, player_uuid in player_mapping.items():
            try:
                # Get player info for position
                player_result = self.supabase.table('players').select('name, position').eq('id', player_uuid).execute()
                
                if not player_result.data:
                    continue
                    
                name = player_result.data[0]['name']
                position = player_result.data[0]['position']
                
                # Check if player already has game stats
                existing_stats = self.supabase.table('player_game_stats').select('id').eq('player_id', player_uuid).execute()
                
                if existing_stats.data:
                    print(f"⏭️ Skipping {name} ({position}) - already has {len(existing_stats.data)} game records")
                    continue
                
                print(f"📊 Processing {name} ({position})...")
                
                # Get game logs
                game_logs = self.get_player_game_logs(sportsdata_id, "2024", 10)
                
                if not game_logs:
                    print(f"⚠️ No game logs found for {name}")
                    continue
                
                # Store each game
                games_stored = 0
                for game in game_logs:
                    try:
                        # Extract position-appropriate stats
                        stats = self.extract_position_stats(game, position or 'FLEX')
                        
                        # Create game stat record
                        game_stat_uuid = str(uuid.uuid4())
                        
                        game_stat_data = {
                            'id': game_stat_uuid,
                            'player_id': player_uuid,
                            'stats': stats,
                            'fantasy_points': stats.get('fantasy_points'),
                            'created_at': datetime.now().isoformat(),
                            'betting_results': {}
                        }
                        
                        result = self.supabase.table('player_game_stats').insert(game_stat_data).execute()
                        
                        if result.data:
                            games_stored += 1
                            total_stored += 1
                        
                    except Exception as e:
                        print(f"❌ Error storing game for {name}: {e}")
                        continue
                
                print(f"✅ Stored {games_stored} games for {name}")
                
                if total_stored % 100 == 0:
                    print(f"📦 Total games stored: {total_stored}")
                    
                # Rate limiting
                time.sleep(0.5)
                
            except Exception as e:
                print(f"❌ Error processing player {sportsdata_id}: {e}")
                continue
        
        print(f"✅ Successfully stored {total_stored} total game records")
        return total_stored

    def get_and_store_headshots(self, player_mapping: Dict[int, str]) -> int:
        """Get and store NFL player headshots"""
        print("📷 Fetching NFL player headshots...")
        
        headshots_data = self.make_api_request("headshots/json/Headshots")
        
        if not headshots_data:
            print("❌ Failed to fetch headshots")
            return 0
            
        stored_count = 0
        
        print(f"💾 Processing {len(headshots_data)} headshots...")
        
        for headshot in headshots_data:
            try:
                sportsdata_player_id = headshot.get('PlayerID')
                
                if sportsdata_player_id not in player_mapping:
                    continue
                    
                player_uuid = player_mapping[sportsdata_player_id]
                headshot_url = headshot.get('PreferredHostedHeadshotUrl')
                
                if not headshot_url:
                    continue
                
                # Check if headshot already exists
                existing_result = self.supabase.table('player_headshots').select('id').eq('player_id', player_uuid).eq('sportsdata_player_id', sportsdata_player_id).execute()
                
                if existing_result.data:
                    continue
                
                # Insert headshot
                headshot_uuid = str(uuid.uuid4())
                
                headshot_data = {
                    'id': headshot_uuid,
                    'player_id': player_uuid,
                    'sportsdata_player_id': sportsdata_player_id,
                    'headshot_url': headshot_url,
                    'source': 'sportsdata_io',
                    'is_active': True,
                    'created_at': datetime.now().isoformat(),
                    'last_updated': datetime.now().isoformat()
                }
                
                result = self.supabase.table('player_headshots').insert(headshot_data).execute()
                
                if result.data:
                    stored_count += 1
                    
                    if stored_count % 50 == 0:
                        print(f"📦 Stored {stored_count} headshots...")
                    
            except Exception as e:
                print(f"❌ Error storing headshot: {e}")
                continue
        
        print(f"✅ Successfully stored {stored_count} headshots")
        return stored_count

    def get_existing_nfl_players(self) -> Dict[int, str]:
        """Get existing NFL players from database to continue where we left off"""
        print("🔍 Checking for existing NFL players in database...")
        
        try:
            result = self.supabase.table('players').select('id, external_player_id, name').eq('sport', 'NFL').execute()
            
            if not result.data:
                print("📭 No existing NFL players found")
                return {}
                
            player_mapping = {}
            for player in result.data:
                external_id = player.get('external_player_id')
                if external_id and external_id.isdigit():
                    player_mapping[int(external_id)] = player['id']
                    
            print(f"✅ Found {len(player_mapping)} existing NFL players")
            return player_mapping
            
        except Exception as e:
            print(f"❌ Error checking existing players: {e}")
            return {}

    def run_full_ingestion(self):
        """Run complete NFL data ingestion process"""
        print("🏈 Starting NFL Data Ingestion Process...")
        print("=" * 50)
        
        # Connect to database
        if not self.connect_db():
            return False
            
        try:
            # Step 1: Check for existing players first
            player_mapping = self.get_existing_nfl_players()
            
            if not player_mapping:
                print("🔄 No existing players found, fetching from API...")
                # Get all NFL players
                players_data = self.get_all_nfl_players("2024")
                if not players_data:
                    print("❌ Failed to get players data")
                    return False
                    
                # Store players in database
                player_mapping = self.store_nfl_players(players_data)
                if not player_mapping:
                    print("❌ Failed to store players")
                    return False
                    
            print(f"✅ Player mapping ready for {len(player_mapping)} players")
            
            # Step 2: Store game statistics (continue from where we left off)
            total_games = self.store_player_game_stats(player_mapping)
            print(f"✅ Stored {total_games} game records")
            
            # Step 3: Store headshots
            headshots_count = self.get_and_store_headshots(player_mapping)
            print(f"✅ Stored {headshots_count} headshots")
            
            print("\n" + "=" * 50)
            print("🎉 NFL Data Ingestion Complete!")
            print(f"📊 Summary:")
            print(f"   - Players: {len(player_mapping)}")
            print(f"   - Game Records: {total_games}")
            print(f"   - Headshots: {headshots_count}")
            
            return True
            
        except Exception as e:
            print(f"❌ Ingestion failed: {e}")
            return False
            
        finally:
            print("🔌 NFL ingestion process completed")

if __name__ == "__main__":
    ingestion = NFLDataIngestion()
    success = ingestion.run_full_ingestion()
    
    if success:
        print("\n✅ NFL data ready for trends analysis!")
    else:
        print("\n❌ Ingestion failed. Check logs for details.")

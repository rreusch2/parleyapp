#!/usr/bin/env python3
"""
MLB Current Data Refresh Script
Updates ALL MLB players with the most recent 10-15 games through September 5, 2025
Fixes date inconsistencies and ensures all players have current data
"""

import os
import sys
import time
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import pandas as pd

# Add the project root to Python path for imports
project_root = '/home/reid/Desktop/parleyapp'
sys.path.append(project_root)

# Import required modules
try:
    import pybaseball as pb
    from supabase import create_client, Client
except ImportError as e:
    print(f"Missing required packages: {e}")
    print("Please install: pip install pybaseball supabase")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/mlb-current-refresh.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MLBCurrentDataRefresh:
    def __init__(self):
        """Initialize the MLB data refresh system"""
        self.supabase = self._initialize_supabase()
        self.today = datetime(2025, 9, 5)  # Current date: September 5, 2025
        self.start_date = self.today - timedelta(days=20)  # Get last 20 days to ensure 15 games
        
        # Disable pybaseball cache for fresh data
        pb.cache.disable()
        
        logger.info("MLB Current Data Refresh initialized")
        logger.info(f"Target date range: {self.start_date.date()} to {self.today.date()}")
    
    def _initialize_supabase(self) -> Client:
        """Initialize Supabase client"""
        try:
            # Load environment variables
            supabase_url = os.getenv('SUPABASE_URL')
            supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
            
            if not supabase_url or not supabase_service_key:
                raise ValueError("Missing Supabase credentials in environment variables")
            
            return create_client(supabase_url, supabase_service_key)
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            raise

    def get_all_mlb_players(self) -> List[Dict[str, Any]]:
        """Get all MLB players from the database"""
        try:
            logger.info("Fetching all MLB players from database...")
            
            response = self.supabase.table('players').select(
                'id, name, team, position'
            ).eq('sport', 'MLB').execute()
            
            players = response.data
            logger.info(f"Found {len(players)} MLB players")
            return players
            
        except Exception as e:
            logger.error(f"Error fetching MLB players: {e}")
            return []

    def clear_old_mlb_data(self, player_id: str) -> bool:
        """Clear old MLB game stats for a specific player"""
        try:
            # Delete existing real data for this player
            self.supabase.table('player_game_stats').delete().eq(
                'player_id', player_id
            ).execute()
            
            logger.info(f"Cleared old data for player {player_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error clearing data for player {player_id}: {e}")
            return False

    def lookup_player_mlbam_id(self, player_name: str) -> Optional[int]:
        """Look up player's MLBAM ID using pybaseball"""
        try:
            # Clean player name and try lookup
            clean_name = player_name.strip()
            name_parts = clean_name.split()
            
            if len(name_parts) >= 2:
                first_name = name_parts[0]
                last_name = ' '.join(name_parts[1:])  # Handle compound last names
                
                # Use pybaseball's playerid_lookup
                player_lookup = pb.playerid_lookup(last_name, first_name)
                
                if not player_lookup.empty:
                    # Get the most recent entry (highest key_mlbam)
                    player_lookup = player_lookup.dropna(subset=['key_mlbam'])
                    if not player_lookup.empty:
                        mlbam_id = int(player_lookup.iloc[0]['key_mlbam'])
                        logger.info(f"Found MLBAM ID {mlbam_id} for {player_name}")
                        return mlbam_id
            
            logger.warning(f"No MLBAM ID found for {player_name}")
            return None
            
        except Exception as e:
            logger.error(f"Error looking up MLBAM ID for {player_name}: {e}")
            return None

    def get_player_recent_stats(self, mlbam_id: int, player_name: str) -> List[Dict[str, Any]]:
        """Get recent game stats for a player using pybaseball StatCast data"""
        try:
            logger.info(f"Fetching recent stats for {player_name} (MLBAM: {mlbam_id})")
            
            # Get StatCast batter data for the date range
            statcast_data = pb.statcast_batter(
                start_dt=self.start_date.strftime('%Y-%m-%d'),
                end_dt=self.today.strftime('%Y-%m-%d'),
                player_id=mlbam_id
            )
            
            if statcast_data.empty:
                logger.warning(f"No StatCast data found for {player_name}")
                return []
            
            # Ensure game_date is properly formatted
            statcast_data['game_date'] = pd.to_datetime(statcast_data['game_date']).dt.date
            
            # Group by game_date and aggregate stats
            game_stats = []
            games_grouped = statcast_data.groupby('game_date')
            
            # Process each game (limit to most recent 15 games)
            game_dates = sorted(games_grouped.groups.keys(), reverse=True)[:15]
            
            for game_date in game_dates:
                game_data = games_grouped.get_group(game_date)
                
                # Calculate game-level stats
                at_bats = len(game_data[game_data['type'] == 'X'])  # Balls in play
                hits = len(game_data[game_data['events'].isin(['single', 'double', 'triple', 'home_run'])])
                home_runs = len(game_data[game_data['events'] == 'home_run'])
                doubles = len(game_data[game_data['events'] == 'double'])
                triples = len(game_data[game_data['events'] == 'triple'])
                singles = hits - doubles - triples - home_runs
                walks = len(game_data[game_data['events'] == 'walk'])
                strikeouts = len(game_data[game_data['events'] == 'strikeout'])
                hit_by_pitch = len(game_data[game_data['events'] == 'hit_by_pitch'])
                
                # Total bases calculation
                total_bases = singles + (doubles * 2) + (triples * 3) + (home_runs * 4)
                
                # Calculate percentages
                batting_avg = hits / at_bats if at_bats > 0 else 0
                on_base_pct = (hits + walks + hit_by_pitch) / (at_bats + walks + hit_by_pitch) if (at_bats + walks + hit_by_pitch) > 0 else 0
                slugging_pct = total_bases / at_bats if at_bats > 0 else 0
                ops = on_base_pct + slugging_pct
                
                # Get opponent team info
                home_team = game_data.iloc[0]['home_team'] if not game_data.empty else 'UNK'
                away_team = game_data.iloc[0]['away_team'] if not game_data.empty else 'UNK'
                
                # Determine opponent (if player's team is home, opponent is away and vice versa)
                player_team = game_data.iloc[0]['home_team'] if game_data.iloc[0]['inning_topbot'] == 'Bot' else game_data.iloc[0]['away_team']
                opponent_team = away_team if player_team == home_team else home_team
                
                # Format date consistently
                formatted_date = str(game_date)
                
                game_stats.append({
                    'at_bats': at_bats,
                    'hits': hits,
                    'home_runs': home_runs,
                    'doubles': doubles,
                    'triples': triples,
                    'singles': singles,
                    'walks': walks,
                    'strikeouts': strikeouts,
                    'hit_by_pitch': hit_by_pitch,
                    'total_bases': total_bases,
                    'batting_average': round(batting_avg, 3),
                    'on_base_percentage': round(on_base_pct, 3),
                    'slugging_percentage': round(slugging_pct, 3),
                    'ops': round(ops, 3),
                    'game_date': formatted_date,
                    'opponent_team': opponent_team,
                    'home_team': home_team,
                    'away_team': away_team,
                    'player_name': player_name,
                    'data_source': 'pybaseball_statcast',
                    'is_real_data': True
                })
            
            logger.info(f"Generated {len(game_stats)} game records for {player_name}")
            return game_stats
            
        except Exception as e:
            logger.error(f"Error fetching stats for {player_name}: {e}")
            return []

    def store_player_stats(self, player_id: str, game_stats: List[Dict[str, Any]]) -> bool:
        """Store player game stats in the database"""
        try:
            if not game_stats:
                logger.warning(f"No stats to store for player {player_id}")
                return True
            
            # Prepare records for insertion
            records = []
            for stats in game_stats:
                records.append({
                    'player_id': player_id,
                    'stats': stats,
                    'created_at': datetime.now().isoformat()
                })
            
            # Insert in batches of 10
            batch_size = 10
            for i in range(0, len(records), batch_size):
                batch = records[i:i+batch_size]
                self.supabase.table('player_game_stats').insert(batch).execute()
                time.sleep(0.1)  # Small delay between batches
            
            logger.info(f"Stored {len(records)} game records for player {player_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing stats for player {player_id}: {e}")
            return False

    def refresh_player_data(self, player: Dict[str, Any]) -> bool:
        """Refresh data for a single player"""
        try:
            player_id = player['id']
            player_name = player['name']
            
            logger.info(f"Processing {player_name}...")
            
            # Step 1: Clear old data
            if not self.clear_old_mlb_data(player_id):
                return False
            
            # Step 2: Look up MLBAM ID
            mlbam_id = self.lookup_player_mlbam_id(player_name)
            if not mlbam_id:
                logger.warning(f"Skipping {player_name} - no MLBAM ID found")
                return False
            
            # Step 3: Get recent stats
            game_stats = self.get_player_recent_stats(mlbam_id, player_name)
            if not game_stats:
                logger.warning(f"No recent stats found for {player_name}")
                return False
            
            # Step 4: Store in database
            if not self.store_player_stats(player_id, game_stats):
                return False
            
            logger.info(f"Successfully refreshed data for {player_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error refreshing data for {player.get('name', 'Unknown')}: {e}")
            return False

    def run_refresh(self):
        """Run the complete data refresh process"""
        logger.info("Starting MLB current data refresh process...")
        start_time = time.time()
        
        # Get all MLB players
        players = self.get_all_mlb_players()
        if not players:
            logger.error("No MLB players found. Exiting.")
            return
        
        total_players = len(players)
        successful_refreshes = 0
        failed_refreshes = 0
        
        # Process each player
        for i, player in enumerate(players, 1):
            logger.info(f"Processing player {i}/{total_players}: {player['name']}")
            
            try:
                if self.refresh_player_data(player):
                    successful_refreshes += 1
                else:
                    failed_refreshes += 1
                    
                # Rate limiting - pause between players
                time.sleep(1.0)
                
                # Progress update every 25 players
                if i % 25 == 0:
                    elapsed = time.time() - start_time
                    logger.info(f"Progress: {i}/{total_players} players processed in {elapsed:.1f}s")
                    logger.info(f"Success rate: {successful_refreshes}/{i} ({100*successful_refreshes/i:.1f}%)")
                
            except Exception as e:
                logger.error(f"Unexpected error processing {player['name']}: {e}")
                failed_refreshes += 1
                continue
        
        # Final summary
        elapsed_time = time.time() - start_time
        logger.info("=" * 60)
        logger.info("MLB CURRENT DATA REFRESH COMPLETE")
        logger.info("=" * 60)
        logger.info(f"Total players processed: {total_players}")
        logger.info(f"Successful refreshes: {successful_refreshes}")
        logger.info(f"Failed refreshes: {failed_refreshes}")
        logger.info(f"Success rate: {100 * successful_refreshes / total_players:.1f}%")
        logger.info(f"Total execution time: {elapsed_time:.1f} seconds")
        logger.info(f"Data current through: {self.today.strftime('%Y-%m-%d')}")

if __name__ == "__main__":
    # Load environment variables
    import subprocess
    import sys
    
    # Try to load .env file
    env_path = '/home/reid/Desktop/parleyapp/.env'
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#') and '=' in line:
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value.strip('"').strip("'")
    
    try:
        refresher = MLBCurrentDataRefresh()
        refresher.run_refresh()
    except KeyboardInterrupt:
        logger.info("Process interrupted by user")
    except Exception as e:
        logger.error(f"Script failed with error: {e}")
        sys.exit(1)

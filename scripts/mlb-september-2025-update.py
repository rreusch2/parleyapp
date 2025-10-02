#!/usr/bin/env python3
"""
MLB September 2025 Data Update
Updates ALL MLB players with games through September 30, 2025
Uses pybaseball for reliable MLB StatCast data
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
    from dotenv import load_dotenv
except ImportError as e:
    print(f"Missing required packages: {e}")
    print("Please install: pip install pybaseball supabase python-dotenv")
    sys.exit(1)

# Load environment variables
load_dotenv(os.path.join(project_root, 'backend/.env'))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/mlb-september-2025-update.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MLBSeptember2025Update:
    def __init__(self):
        """Initialize the MLB data update system"""
        self.supabase = self._initialize_supabase()
        self.today = datetime(2025, 9, 30)  # Current date: September 30, 2025
        self.start_date = datetime(2025, 9, 1)  # Get all of September
        
        # Disable pybaseball cache for fresh data
        pb.cache.disable()
        
        logger.info("MLB September 2025 Update initialized")
        logger.info(f"Target date range: {self.start_date.date()} to {self.today.date()}")
    
    def _initialize_supabase(self) -> Client:
        """Initialize Supabase client"""
        try:
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

    def get_existing_game_dates(self, player_id: str) -> set:
        """Get existing game dates for a player to avoid duplicates"""
        try:
            response = self.supabase.table('player_game_stats').select(
                'stats'
            ).eq('player_id', player_id).execute()
            
            existing_dates = set()
            for record in response.data:
                if 'game_date' in record.get('stats', {}):
                    existing_dates.add(record['stats']['game_date'])
            
            return existing_dates
            
        except Exception as e:
            logger.error(f"Error fetching existing dates for player {player_id}: {e}")
            return set()

    def lookup_player_mlbam_id(self, player_name: str) -> Optional[int]:
        """Look up player's MLBAM ID using pybaseball"""
        try:
            clean_name = player_name.strip()
            name_parts = clean_name.split()
            
            if len(name_parts) >= 2:
                first_name = name_parts[0]
                last_name = ' '.join(name_parts[1:])
                
                player_lookup = pb.playerid_lookup(last_name, first_name)
                
                if not player_lookup.empty:
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

    def get_player_september_stats(self, mlbam_id: int, player_name: str, existing_dates: set) -> List[Dict[str, Any]]:
        """Get September game stats for a player using pybaseball StatCast data"""
        try:
            logger.info(f"Fetching September stats for {player_name} (MLBAM: {mlbam_id})")
            
            # Get StatCast batter data for September
            statcast_data = pb.statcast_batter(
                start_dt=self.start_date.strftime('%Y-%m-%d'),
                end_dt=self.today.strftime('%Y-%m-%d'),
                player_id=mlbam_id
            )
            
            if statcast_data.empty:
                logger.warning(f"No StatCast data found for {player_name} in September")
                return []
            
            # Ensure game_date is properly formatted
            statcast_data['game_date'] = pd.to_datetime(statcast_data['game_date']).dt.date
            
            # Group by game_date and aggregate stats
            game_stats = []
            games_grouped = statcast_data.groupby('game_date')
            
            for game_date in sorted(games_grouped.groups.keys()):
                # Skip if we already have this game
                game_date_str = str(game_date)
                if game_date_str in existing_dates:
                    logger.debug(f"Skipping existing game date: {game_date_str}")
                    continue
                
                game_data = games_grouped.get_group(game_date)
                
                # Calculate game-level stats
                at_bats = len(game_data[game_data['type'] == 'X'])
                hits = len(game_data[game_data['events'].isin(['single', 'double', 'triple', 'home_run'])])
                home_runs = len(game_data[game_data['events'] == 'home_run'])
                doubles = len(game_data[game_data['events'] == 'double'])
                triples = len(game_data[game_data['events'] == 'triple'])
                singles = hits - doubles - triples - home_runs
                walks = len(game_data[game_data['events'] == 'walk'])
                strikeouts = len(game_data[game_data['events'] == 'strikeout'])
                hit_by_pitch = len(game_data[game_data['events'] == 'hit_by_pitch'])
                rbis = game_data['events'].apply(lambda x: 1 if x in ['single', 'double', 'triple', 'home_run'] else 0).sum()
                
                # Total bases calculation
                total_bases = singles + (doubles * 2) + (triples * 3) + (home_runs * 4)
                
                # Calculate percentages
                batting_avg = hits / at_bats if at_bats > 0 else 0
                on_base_pct = (hits + walks + hit_by_pitch) / (at_bats + walks + hit_by_pitch) if (at_bats + walks + hit_by_pitch) > 0 else 0
                slugging_pct = total_bases / at_bats if at_bats > 0 else 0
                ops = on_base_pct + slugging_pct
                
                # Get team info
                home_team = game_data.iloc[0]['home_team'] if not game_data.empty else 'UNK'
                away_team = game_data.iloc[0]['away_team'] if not game_data.empty else 'UNK'
                
                # Determine player's team and opponent
                player_team = game_data.iloc[0]['home_team'] if game_data.iloc[0]['inning_topbot'] == 'Bot' else game_data.iloc[0]['away_team']
                opponent_team = away_team if player_team == home_team else home_team
                is_home = player_team == home_team
                
                game_stats.append({
                    'league': 'MLB',
                    'season': 2025,
                    'game_date': game_date_str,
                    'team': str(player_team),
                    'opponent_team': str(opponent_team),
                    'is_home': bool(is_home),
                    'at_bats': int(at_bats),
                    'hits': int(hits),
                    'runs': 0,  # Not available in StatCast per-game
                    'rbis': int(rbis),
                    'home_runs': int(home_runs),
                    'doubles': int(doubles),
                    'triples': int(triples),
                    'singles': int(singles),
                    'walks': int(walks),
                    'strikeouts': int(strikeouts),
                    'hit_by_pitch': int(hit_by_pitch),
                    'total_bases': int(total_bases),
                    'stolen_bases': 0,  # Not available in StatCast
                    'batting_average': float(round(batting_avg, 3)),
                    'on_base_percentage': float(round(on_base_pct, 3)),
                    'slugging_percentage': float(round(slugging_pct, 3)),
                    'ops': float(round(ops, 3)),
                    'data_source': 'pybaseball_statcast',
                    'is_real_data': True,
                    'updated_at': datetime.now().isoformat()
                })
            
            logger.info(f"Generated {len(game_stats)} new game records for {player_name}")
            return game_stats
            
        except Exception as e:
            logger.error(f"Error fetching stats for {player_name}: {e}")
            return []

    def store_player_stats(self, player_id: str, game_stats: List[Dict[str, Any]]) -> bool:
        """Store player game stats in the database"""
        try:
            if not game_stats:
                logger.debug(f"No new stats to store for player {player_id}")
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
                time.sleep(0.1)
            
            logger.info(f"✅ Stored {len(records)} new game records for player {player_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing stats for player {player_id}: {e}")
            return False

    def update_player_data(self, player: Dict[str, Any]) -> bool:
        """Update September data for a single player"""
        try:
            player_id = player['id']
            player_name = player['name']
            
            logger.info(f"[{player_name}] Processing...")
            
            # Step 1: Get existing game dates to avoid duplicates
            existing_dates = self.get_existing_game_dates(player_id)
            logger.info(f"[{player_name}] Found {len(existing_dates)} existing games")
            
            # Step 2: Look up MLBAM ID
            mlbam_id = self.lookup_player_mlbam_id(player_name)
            if not mlbam_id:
                logger.warning(f"[{player_name}] Skipping - no MLBAM ID found")
                return False
            
            # Step 3: Get September stats (only new games)
            game_stats = self.get_player_september_stats(mlbam_id, player_name, existing_dates)
            if not game_stats:
                logger.info(f"[{player_name}] No new games to add")
                return True  # Not a failure, just no new data
            
            # Step 4: Store in database
            if not self.store_player_stats(player_id, game_stats):
                return False
            
            logger.info(f"✅ [{player_name}] Successfully updated with {len(game_stats)} new games")
            return True
            
        except Exception as e:
            logger.error(f"Error updating data for {player.get('name', 'Unknown')}: {e}")
            return False

    def run_update(self, limit: Optional[int] = None):
        """Run the complete data update process"""
        logger.info("=" * 80)
        logger.info("Starting MLB September 2025 Update Process")
        logger.info(f"Date Range: {self.start_date.date()} to {self.today.date()}")
        logger.info("=" * 80)
        start_time = time.time()
        
        # Get all MLB players
        players = self.get_all_mlb_players()
        if not players:
            logger.error("No MLB players found. Exiting.")
            return
        
        # Apply limit if specified
        if limit:
            players = players[:limit]
            logger.info(f"Processing limited to first {limit} players")
        
        total_players = len(players)
        successful_updates = 0
        failed_updates = 0
        no_new_data = 0
        
        for idx, player in enumerate(players, 1):
            logger.info(f"\n[{idx}/{total_players}] Processing {player['name']}...")
            
            try:
                result = self.update_player_data(player)
                if result:
                    successful_updates += 1
                else:
                    failed_updates += 1
                
                # Rate limiting
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Unexpected error processing {player['name']}: {e}")
                failed_updates += 1
            
            # Progress update every 10 players
            if idx % 10 == 0:
                elapsed = time.time() - start_time
                logger.info(f"\n{'='*60}")
                logger.info(f"Progress: {idx}/{total_players} players processed")
                logger.info(f"Successful: {successful_updates} | Failed: {failed_updates}")
                logger.info(f"Elapsed time: {elapsed/60:.1f} minutes")
                logger.info(f"{'='*60}\n")
        
        # Final summary
        elapsed_time = time.time() - start_time
        logger.info("\n" + "=" * 80)
        logger.info("MLB SEPTEMBER 2025 UPDATE COMPLETE")
        logger.info("=" * 80)
        logger.info(f"Total players processed: {total_players}")
        logger.info(f"✅ Successful updates: {successful_updates}")
        logger.info(f"❌ Failed updates: {failed_updates}")
        logger.info(f"⏱️  Total time: {elapsed_time/60:.1f} minutes")
        logger.info(f"⚡ Average time per player: {elapsed_time/total_players:.1f} seconds")
        logger.info("=" * 80)

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Update MLB player stats for September 2025')
    parser.add_argument('--limit', type=int, help='Limit number of players to process (for testing)')
    parser.add_argument('--player', type=str, help='Process specific player by name')
    
    args = parser.parse_args()
    
    try:
        updater = MLBSeptember2025Update()
        
        if args.player:
            # Process single player
            players = updater.get_all_mlb_players()
            target_player = next((p for p in players if p['name'].lower() == args.player.lower()), None)
            
            if target_player:
                logger.info(f"Processing single player: {target_player['name']}")
                updater.update_player_data(target_player)
            else:
                logger.error(f"Player '{args.player}' not found")
        else:
            # Process all players (or limited set)
            updater.run_update(limit=args.limit)
            
    except KeyboardInterrupt:
        logger.info("\n\nProcess interrupted by user. Exiting gracefully...")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

if __name__ == '__main__':
    main()

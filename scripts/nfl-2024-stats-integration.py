#!/usr/bin/env python3
"""
NFL 2024 Season Stats Integration Script
Fetches individual game stats for all NFL players from the 2024 season using nfl_data_py
and integrates them into the ParleyApp player_game_stats table.
"""

import os
import sys
import logging
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import pandas as pd

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Third-party imports
import nfl_data_py as nfl
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class NFLStatsIntegrator:
    """Integrates NFL player stats from nfl_data_py into Supabase player_game_stats table."""
    
    def __init__(self):
        """Initialize the integrator with Supabase connection."""
        self.supabase: Client = self._init_supabase()
        self.logger = self._setup_logger()
        self.player_mapping: Dict[str, str] = {}  # Maps nfl_data_py player IDs to our UUIDs
        self.stats_processed = 0
        self.stats_inserted = 0
        
    def _init_supabase(self) -> Client:
        """Initialize Supabase client."""
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
            
        return create_client(url, key)
    
    def _setup_logger(self) -> logging.Logger:
        """Set up logging configuration."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('nfl_stats_integration.log'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        return logging.getLogger(__name__)
    
    def load_existing_players(self) -> None:
        """Load existing NFL players from the database to create mapping."""
        self.logger.info("Loading existing NFL players from database...")
        
        try:
            response = self.supabase.table("players").select("*").eq("sport", "NFL").execute()
            players = response.data
            
            self.logger.info(f"Loaded {len(players)} NFL players from database")
            
            # Create mapping from name/team to UUID
            for player in players:
                # Create multiple mapping keys for flexible matching
                name = player.get("name", "").strip()
                team = player.get("team", "").strip()
                player_id = player.get("id")
                external_id = player.get("external_player_id")
                
                if name and team:
                    # Primary mapping: name_team
                    key = f"{name}_{team}".lower()
                    self.player_mapping[key] = player_id
                    
                    # Alternative mapping: external_id if available
                    if external_id:
                        self.player_mapping[str(external_id)] = player_id
                        
                    self.logger.debug(f"Mapped {name} ({team}) -> {player_id}")
            
            self.logger.info(f"Created {len(self.player_mapping)} player mappings")
            
        except Exception as e:
            self.logger.error(f"Error loading players: {e}")
            raise
    
    def fetch_nfl_weekly_data(self) -> pd.DataFrame:
        """Fetch NFL weekly/game-by-game data for 2024 season."""
        self.logger.info("Fetching NFL weekly data for 2024 season...")
        
        try:
            # Fetch weekly data for 2024 season
            weekly_data = nfl.import_weekly_data([2024])
            
            self.logger.info(f"Fetched {len(weekly_data)} weekly stat records")
            
            # Filter for regular season and playoffs
            weekly_data = weekly_data[weekly_data['season_type'].isin(['REG', 'POST'])]
            
            self.logger.info(f"After filtering: {len(weekly_data)} records (REG + POST)")
            
            return weekly_data
            
        except Exception as e:
            self.logger.error(f"Error fetching NFL weekly data: {e}")
            raise
    
    def fetch_nfl_roster_data(self) -> pd.DataFrame:
        """Fetch NFL roster data for 2024 to get additional player info."""
        self.logger.info("Fetching NFL roster data for 2024...")
        
        try:
            roster_data = nfl.import_weekly_rosters([2024])
            
            self.logger.info(f"Fetched roster data for {len(roster_data)} player-week records")
            
            return roster_data
            
        except Exception as e:
            self.logger.error(f"Error fetching roster data: {e}")
            raise
    
    def map_player_to_uuid(self, player_name: str, team: str, player_id: str = None) -> Optional[str]:
        """Map nfl_data_py player to our database UUID."""
        
        # Try different mapping strategies
        mapping_keys = [
            f"{player_name}_{team}".lower(),
            player_name.lower(),
        ]
        
        if player_id:
            mapping_keys.append(str(player_id))
        
        for key in mapping_keys:
            if key in self.player_mapping:
                return self.player_mapping[key]
        
        # If no exact match, try fuzzy matching on name
        clean_name = player_name.lower().strip()
        for mapped_key, uuid in self.player_mapping.items():
            if clean_name in mapped_key or any(part in mapped_key for part in clean_name.split()):
                return uuid
        
        return None
    
    def transform_weekly_stats(self, row: pd.Series) -> Dict[str, Any]:
        """Transform nfl_data_py weekly stats to our schema format."""
        
        stats = {
            # Game info
            "season": int(row.get('season', 2024)),
            "week": int(row.get('week', 0)),
            "season_type": str(row.get('season_type', 'REG')),
            "game_date": str(row.get('game_date', '')),
            "opponent_team": str(row.get('opponent_team', '')),
            "team": str(row.get('recent_team', row.get('team', ''))),
            "is_home": bool(row.get('home_away') == 'HOME' if pd.notna(row.get('home_away')) else False),
            "position": str(row.get('position', '')),
            "games_played": int(row.get('games_played', 1)),
            
            # Fantasy points
            "fantasy_points": float(row.get('fantasy_points', 0)),
            "fantasy_points_ppr": float(row.get('fantasy_points_ppr', 0)),
            
            # Passing stats
            "passing_attempts": float(row.get('passing_attempts', 0)),
            "passing_completions": float(row.get('passing_completions', 0)),
            "passing_yards": float(row.get('passing_yards', 0)),
            "passing_touchdowns": float(row.get('passing_touchdowns', 0)),
            "passing_interceptions": float(row.get('passing_interceptions', 0)),
            "passing_rating": float(row.get('passing_rating', 0)),
            "passing_yards_per_attempt": float(row.get('passing_yards_per_attempt', 0)),
            "passing_completion_percentage": float(row.get('passing_completion_percentage', 0)),
            
            # Rushing stats
            "rushing_attempts": float(row.get('rushing_attempts', 0)),
            "rushing_yards": float(row.get('rushing_yards', 0)),
            "rushing_touchdowns": float(row.get('rushing_touchdowns', 0)),
            "rushing_yards_per_attempt": float(row.get('rushing_yards_per_attempt', 0)),
            "rushing_long": float(row.get('rushing_long', 0)),
            
            # Receiving stats
            "receptions": float(row.get('receptions', 0)),
            "receiving_yards": float(row.get('receiving_yards', 0)),
            "receiving_touchdowns": float(row.get('receiving_touchdowns', 0)),
            "receiving_yards_per_reception": float(row.get('receiving_yards_per_reception', 0)),
            "receiving_long": float(row.get('receiving_long', 0)),
            "targets": float(row.get('targets', 0)),
            "target_share": float(row.get('target_share', 0)),
            
            # Defensive stats
            "sacks": float(row.get('sacks', 0)),
            "tackles": float(row.get('tackles', 0)),
            "solo_tackles": float(row.get('solo_tackles', 0)),
            "assisted_tackles": float(row.get('assisted_tackles', 0)),
            "tackles_for_loss": float(row.get('tackles_for_loss', 0)),
            "quarterback_hurries": float(row.get('quarterback_hurries', 0)),
            "interceptions": float(row.get('interceptions', 0)),
            "interception_return_yards": float(row.get('interception_return_yards', 0)),
            "interception_return_touchdowns": float(row.get('interception_return_touchdowns', 0)),
            "passes_defended": float(row.get('passes_defended', 0)),
            "fumbles_recovered": float(row.get('fumbles_recovered', 0)),
            "fumble_return_touchdowns": float(row.get('fumble_return_touchdowns', 0)),
            
            # Special teams
            "field_goals_made": float(row.get('field_goals_made', 0)),
            "field_goals_attempted": float(row.get('field_goals_attempted', 0)),
            "field_goal_percentage": float(row.get('field_goal_percentage', 0)),
            "field_goals_longest_made": float(row.get('field_goals_longest_made', 0)),
            "extra_points_made": float(row.get('extra_points_made', 0)),
            "extra_points_attempted": float(row.get('extra_points_attempted', 0)),
            
            # Return stats
            "punt_returns": float(row.get('punt_returns', 0)),
            "punt_return_yards": float(row.get('punt_return_yards', 0)),
            "punt_return_touchdowns": float(row.get('punt_return_touchdowns', 0)),
            "punt_return_long": float(row.get('punt_return_long', 0)),
            "kick_returns": float(row.get('kick_returns', 0)),
            "kick_return_yards": float(row.get('kick_return_yards', 0)),
            "kick_return_touchdowns": float(row.get('kick_return_touchdowns', 0)),
            "kick_return_long": float(row.get('kick_return_long', 0)),
            
            # Miscellaneous
            "fumbles": float(row.get('fumbles', 0)),
            "fumbles_lost": float(row.get('fumbles_lost', 0)),
            "punts": float(row.get('punts', 0)),
            "punt_yards": float(row.get('punt_yards', 0)),
            "punt_average": float(row.get('punt_average', 0)),
            "punt_long": float(row.get('punt_long', 0)),
            
            # Salary data if available
            "draftkings_salary": float(row.get('draftkings_salary', 0)) if pd.notna(row.get('draftkings_salary')) else None,
            "fanduel_salary": float(row.get('fanduel_salary', 0)) if pd.notna(row.get('fanduel_salary')) else None,
            "yahoo_salary": float(row.get('yahoo_salary', 0)) if pd.notna(row.get('yahoo_salary')) else None,
        }
        
        return stats
    
    def calculate_fantasy_points(self, stats: Dict[str, Any]) -> str:
        """Calculate fantasy points using standard scoring."""
        
        points = 0.0
        
        # Passing: 1 point per 25 yards, 6 points per TD, -2 per INT
        points += stats.get('passing_yards', 0) / 25
        points += stats.get('passing_touchdowns', 0) * 6
        points -= stats.get('passing_interceptions', 0) * 2
        
        # Rushing: 1 point per 10 yards, 6 points per TD
        points += stats.get('rushing_yards', 0) / 10
        points += stats.get('rushing_touchdowns', 0) * 6
        
        # Receiving: 1 point per 10 yards, 6 points per TD, 1 point per reception (PPR)
        points += stats.get('receiving_yards', 0) / 10
        points += stats.get('receiving_touchdowns', 0) * 6
        points += stats.get('receptions', 0)
        
        # Defensive: 2 points per sack, 1 point per tackle, 6 points per defensive TD
        points += stats.get('sacks', 0) * 2
        points += stats.get('tackles', 0) * 1
        points += stats.get('interception_return_touchdowns', 0) * 6
        points += stats.get('fumble_return_touchdowns', 0) * 6
        
        # Special teams: 3 points per FG, 1 point per XP
        points += stats.get('field_goals_made', 0) * 3
        points += stats.get('extra_points_made', 0) * 1
        points += stats.get('punt_return_touchdowns', 0) * 6
        points += stats.get('kick_return_touchdowns', 0) * 6
        
        # Penalties
        points -= stats.get('fumbles_lost', 0) * 2
        
        return f"{points:.2f}"
    
    def process_weekly_data(self, weekly_data: pd.DataFrame) -> None:
        """Process weekly data and insert into database."""
        
        self.logger.info(f"Processing {len(weekly_data)} weekly stat records...")
        
        batch_size = 100
        batch_data = []
        
        for idx, row in weekly_data.iterrows():
            try:
                self.stats_processed += 1
                
                # Get player info
                player_name = str(row.get('player_display_name', row.get('player_name', '')))
                team = str(row.get('recent_team', row.get('team', '')))
                
                if not player_name or not team:
                    self.logger.warning(f"Missing player name or team for record {idx}")
                    continue
                
                # Map to our database UUID
                player_uuid = self.map_player_to_uuid(player_name, team, str(row.get('player_id', '')))
                
                if not player_uuid:
                    self.logger.warning(f"Could not map player {player_name} ({team}) to database UUID")
                    continue
                
                # Transform stats
                stats = self.transform_weekly_stats(row)
                
                # Calculate fantasy points
                fantasy_points = self.calculate_fantasy_points(stats)
                
                # Prepare record for insertion
                record = {
                    "player_id": player_uuid,
                    "stats": stats,
                    "fantasy_points": fantasy_points,
                    "betting_results": {},
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                batch_data.append(record)
                
                # Insert in batches
                if len(batch_data) >= batch_size:
                    self._insert_batch(batch_data)
                    batch_data = []
                
                if self.stats_processed % 1000 == 0:
                    self.logger.info(f"Processed {self.stats_processed} records, inserted {self.stats_inserted}")
                
            except Exception as e:
                self.logger.error(f"Error processing record {idx}: {e}")
                continue
        
        # Insert remaining records
        if batch_data:
            self._insert_batch(batch_data)
    
    def _insert_batch(self, batch_data: List[Dict]) -> None:
        """Insert a batch of records into the database."""
        
        try:
            response = self.supabase.table("player_game_stats").insert(batch_data).execute()
            
            if response.data:
                self.stats_inserted += len(response.data)
                self.logger.debug(f"Inserted batch of {len(batch_data)} records")
            else:
                self.logger.warning(f"Batch insert returned no data: {response}")
                
        except Exception as e:
            self.logger.error(f"Error inserting batch: {e}")
            # Try inserting one by one to identify problematic records
            for record in batch_data:
                try:
                    response = self.supabase.table("player_game_stats").insert([record]).execute()
                    if response.data:
                        self.stats_inserted += 1
                except Exception as individual_error:
                    self.logger.error(f"Error inserting individual record: {individual_error}")
                    self.logger.debug(f"Problematic record: {record}")
    
    def run_integration(self) -> None:
        """Run the complete NFL stats integration process."""
        
        self.logger.info("Starting NFL 2024 stats integration...")
        
        try:
            # Step 1: Load existing players
            self.load_existing_players()
            
            # Step 2: Fetch NFL data
            weekly_data = self.fetch_nfl_weekly_data()
            
            # Step 3: Process and insert data
            self.process_weekly_data(weekly_data)
            
            # Final summary
            self.logger.info("NFL stats integration completed successfully!")
            self.logger.info(f"Total records processed: {self.stats_processed}")
            self.logger.info(f"Total records inserted: {self.stats_inserted}")
            self.logger.info(f"Success rate: {(self.stats_inserted/max(self.stats_processed, 1)*100):.2f}%")
            
        except Exception as e:
            self.logger.error(f"Integration failed: {e}")
            raise

def main():
    """Main execution function."""
    
    print("🏈 NFL 2024 Stats Integration Starting...")
    print("=" * 50)
    
    try:
        integrator = NFLStatsIntegrator()
        integrator.run_integration()
        
        print("\n✅ NFL stats integration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
NFL 2024 Season Stats Integration Script - FIXED VERSION
Fetches ALL individual game stats for NFL players from 2024 season using nfl_data_py
with proper duplicate prevention and comprehensive data capture.
"""

import os
import sys
import logging
import json
import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Set
import pandas as pd

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Third-party imports
import nfl_data_py as nfl
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class NFLStatsIntegratorFixed:
    """Fixed integrator for NFL player stats with comprehensive coverage and duplicate prevention."""
    
    def __init__(self):
        """Initialize the integrator with Supabase connection."""
        self.supabase: Client = self._init_supabase()
        self.logger = self._setup_logger()
        self.player_mapping: Dict[str, str] = {}  # Maps nfl_data_py player names to our UUIDs
        self.existing_records: Set[str] = set()  # Track existing player-week combinations
        self.stats_processed = 0
        self.stats_inserted = 0
        self.stats_skipped = 0
        
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
                logging.FileHandler('nfl_stats_integration_fixed.log'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        return logging.getLogger(__name__)
    
    def load_existing_players(self) -> None:
        """Load existing NFL players from database and create comprehensive mappings."""
        self.logger.info("Loading existing NFL players from database...")
        
        try:
            response = self.supabase.table("players").select("*").eq("sport", "NFL").execute()
            players = response.data
            
            self.logger.info(f"Loaded {len(players)} NFL players from database")
            
            # Create multiple mapping strategies for robust matching
            for player in players:
                name = player.get("name", "").strip()
                team = player.get("team", "").strip()
                player_id = player.get("id")
                external_id = player.get("external_player_id")
                
                if name and player_id:
                    # Primary mappings
                    self.player_mapping[name.lower()] = player_id
                    self.player_mapping[f"{name}_{team}".lower()] = player_id
                    
                    # Handle name variations (first.last, first last, etc.)
                    if "." in name:
                        clean_name = name.replace(".", " ")
                        self.player_mapping[clean_name.lower()] = player_id
                    
                    # External ID mapping
                    if external_id:
                        self.player_mapping[str(external_id)] = player_id
            
            self.logger.info(f"Created {len(self.player_mapping)} player mappings")
            
        except Exception as e:
            self.logger.error(f"Error loading players: {e}")
            raise
    
    def load_existing_records(self) -> None:
        """Load existing NFL stats records to prevent duplicates."""
        self.logger.info("Loading existing NFL stats records...")
        
        try:
            response = self.supabase.table("player_game_stats").select("player_id, stats").execute()
            records = response.data
            
            for record in records:
                player_id = record.get("player_id")
                stats = record.get("stats", {})
                
                # Check if this is a 2024 NFL record
                if stats.get("season") == 2024 or stats.get("season") == "2024":
                    week = stats.get("week")
                    if player_id and week:
                        key = f"{player_id}_{week}"
                        self.existing_records.add(key)
            
            self.logger.info(f"Found {len(self.existing_records)} existing 2024 NFL records")
            
        except Exception as e:
            self.logger.error(f"Error loading existing records: {e}")
            raise
    
    def fetch_nfl_weekly_data(self) -> pd.DataFrame:
        """Fetch complete NFL weekly data for 2024 season."""
        self.logger.info("Fetching complete NFL weekly data for 2024 season...")
        
        try:
            # Get all weekly data - this includes regular season AND playoffs
            weekly_data = nfl.import_weekly_data([2024])
            
            self.logger.info(f"Fetched {len(weekly_data)} total weekly stat records")
            self.logger.info(f"Week range: {weekly_data['week'].min()} to {weekly_data['week'].max()}")
            self.logger.info(f"Season types: {weekly_data['season_type'].unique()}")
            self.logger.info(f"Position breakdown:")
            
            position_counts = weekly_data['position'].value_counts()
            for pos, count in position_counts.head(10).items():
                self.logger.info(f"  {pos}: {count} records")
            
            return weekly_data
            
        except Exception as e:
            self.logger.error(f"Error fetching NFL weekly data: {e}")
            raise
    
    def map_player_to_uuid(self, player_name: str, team: str, player_id: str = None) -> Optional[str]:
        """Enhanced player mapping with multiple strategies."""
        
        # Try different mapping strategies in order of preference
        mapping_keys = [
            f"{player_name}_{team}".lower(),
            player_name.lower(),
            player_name.replace(".", " ").lower(),
            player_name.replace(" ", ".").lower(),
        ]
        
        if player_id:
            mapping_keys.insert(0, str(player_id))
        
        for key in mapping_keys:
            if key in self.player_mapping:
                return self.player_mapping[key]
        
        # Fuzzy matching as last resort
        clean_name = player_name.lower().strip()
        for mapped_key, uuid in self.player_mapping.items():
            # Check if names are similar (handle initials, nicknames, etc.)
            if self._names_similar(clean_name, mapped_key):
                return uuid
        
        return None
    
    def _names_similar(self, name1: str, name2: str) -> bool:
        """Check if two names are similar enough to be the same player."""
        # Simple similarity check - can be enhanced
        name1_parts = set(name1.split())
        name2_parts = set(name2.split())
        
        # If they share at least 2 parts or one exact match, consider similar
        intersection = name1_parts.intersection(name2_parts)
        return len(intersection) >= 1 and (len(intersection) >= 2 or any(len(part) > 3 for part in intersection))
    
    def safe_float(self, value: Any) -> float:
        """Safely convert value to float, handling NaN and None."""
        if pd.isna(value) or value is None:
            return 0.0
        try:
            val = float(value)
            return 0.0 if math.isnan(val) or math.isinf(val) else val
        except (ValueError, TypeError):
            return 0.0
    
    def transform_weekly_stats(self, row: pd.Series) -> Dict[str, Any]:
        """Transform nfl_data_py weekly stats to our schema with proper field mappings."""
        
        stats = {
            # Game/season info
            "league": "NFL",  # Fixed: Add missing league field
            "season": int(row.get('season', 2024)),
            "week": int(row.get('week', 0)),
            "season_type": str(row.get('season_type', 'REG')),
            "opponent_team": str(row.get('opponent_team', '')),
            "team": str(row.get('recent_team', '')),
            "position": str(row.get('position', '')),
            
            # Fantasy points
            "fantasy_points": self.safe_float(row.get('fantasy_points')),
            "fantasy_points_ppr": self.safe_float(row.get('fantasy_points_ppr')),
            
            # Passing stats (corrected field names)
            "passing_attempts": self.safe_float(row.get('attempts')),
            "passing_completions": self.safe_float(row.get('completions')),
            "passing_yards": self.safe_float(row.get('passing_yards')),
            "passing_touchdowns": self.safe_float(row.get('passing_tds')),  # Fixed: was passing_touchdowns
            "passing_interceptions": self.safe_float(row.get('interceptions')),
            "passing_first_downs": self.safe_float(row.get('passing_first_downs')),
            "passing_epa": self.safe_float(row.get('passing_epa')),
            "passing_air_yards": self.safe_float(row.get('passing_air_yards')),
            "passing_yards_after_catch": self.safe_float(row.get('passing_yards_after_catch')),
            "passing_2pt_conversions": self.safe_float(row.get('passing_2pt_conversions')),
            
            # Rushing stats
            "rushing_attempts": self.safe_float(row.get('carries')),  # Fixed: carries not rushing_attempts
            "rushing_yards": self.safe_float(row.get('rushing_yards')),
            "rushing_touchdowns": self.safe_float(row.get('rushing_tds')),  # Fixed: was rushing_touchdowns
            "rushing_first_downs": self.safe_float(row.get('rushing_first_downs')),
            "rushing_epa": self.safe_float(row.get('rushing_epa')),
            "rushing_fumbles": self.safe_float(row.get('rushing_fumbles')),
            "rushing_fumbles_lost": self.safe_float(row.get('rushing_fumbles_lost')),
            "rushing_2pt_conversions": self.safe_float(row.get('rushing_2pt_conversions')),
            
            # Receiving stats
            "receptions": self.safe_float(row.get('receptions')),
            "targets": self.safe_float(row.get('targets')),
            "receiving_yards": self.safe_float(row.get('receiving_yards')),
            "receiving_touchdowns": self.safe_float(row.get('receiving_tds')),  # Fixed: was receiving_touchdowns
            "receiving_first_downs": self.safe_float(row.get('receiving_first_downs')),
            "receiving_epa": self.safe_float(row.get('receiving_epa')),
            "receiving_air_yards": self.safe_float(row.get('receiving_air_yards')),
            "receiving_yards_after_catch": self.safe_float(row.get('receiving_yards_after_catch')),
            "receiving_fumbles": self.safe_float(row.get('receiving_fumbles')),
            "receiving_fumbles_lost": self.safe_float(row.get('receiving_fumbles_lost')),
            "receiving_2pt_conversions": self.safe_float(row.get('receiving_2pt_conversions')),
            "target_share": self.safe_float(row.get('target_share')),
            "air_yards_share": self.safe_float(row.get('air_yards_share')),
            "wopr": self.safe_float(row.get('wopr')),
            
            # Defensive/special teams
            "sacks": self.safe_float(row.get('sacks')),
            "sack_yards": self.safe_float(row.get('sack_yards')),
            "special_teams_tds": self.safe_float(row.get('special_teams_tds')),
            
            # Advanced metrics
            "pacr": self.safe_float(row.get('pacr')),
            "racr": self.safe_float(row.get('racr')),
            "dakota": self.safe_float(row.get('dakota')),
        }
        
        return stats
    
    def calculate_fantasy_points_standard(self, stats: Dict[str, Any]) -> str:
        """Calculate fantasy points using standard scoring (non-PPR)."""
        
        points = 0.0
        
        # Passing: 1 point per 25 yards, 6 points per TD, -2 per INT
        points += stats.get('passing_yards', 0) / 25
        points += stats.get('passing_touchdowns', 0) * 6
        points -= stats.get('passing_interceptions', 0) * 2
        
        # Rushing: 1 point per 10 yards, 6 points per TD
        points += stats.get('rushing_yards', 0) / 10
        points += stats.get('rushing_touchdowns', 0) * 6
        
        # Receiving: 1 point per 10 yards, 6 points per TD (no PPR here)
        points += stats.get('receiving_yards', 0) / 10
        points += stats.get('receiving_touchdowns', 0) * 6
        
        # Special teams: 6 points per TD
        points += stats.get('special_teams_tds', 0) * 6
        
        # Fumbles: -2 points per lost fumble
        points -= stats.get('rushing_fumbles_lost', 0) * 2
        points -= stats.get('receiving_fumbles_lost', 0) * 2
        
        # 2-point conversions: 2 points each
        points += stats.get('passing_2pt_conversions', 0) * 2
        points += stats.get('rushing_2pt_conversions', 0) * 2
        points += stats.get('receiving_2pt_conversions', 0) * 2
        
        return f"{points:.2f}"
    
    def process_weekly_data(self, weekly_data: pd.DataFrame) -> None:
        """Process weekly data with comprehensive coverage and duplicate prevention."""
        
        self.logger.info(f"Processing {len(weekly_data)} weekly stat records...")
        
        batch_size = 50  # Smaller batches for more reliable processing
        batch_data = []
        
        for idx, row in weekly_data.iterrows():
            try:
                self.stats_processed += 1
                
                # Get player info from nfl_data_py
                player_name = str(row.get('player_display_name', row.get('player_name', '')))
                team = str(row.get('recent_team', ''))
                week = int(row.get('week', 0))
                
                if not player_name or not team:
                    self.logger.warning(f"Missing player name or team for record {idx}")
                    continue
                
                # Map to our database UUID
                player_uuid = self.map_player_to_uuid(player_name, team, str(row.get('player_id', '')))
                
                if not player_uuid:
                    self.logger.debug(f"Could not map player {player_name} ({team}) to database UUID")
                    continue
                
                # Check for duplicates
                duplicate_key = f"{player_uuid}_{week}"
                if duplicate_key in self.existing_records:
                    self.stats_skipped += 1
                    continue
                
                # Transform stats with proper field mappings
                stats = self.transform_weekly_stats(row)
                
                # Use the fantasy points from nfl_data_py (they're more accurate)
                fantasy_points_from_source = self.safe_float(row.get('fantasy_points_ppr', row.get('fantasy_points', 0)))
                fantasy_points = f"{fantasy_points_from_source:.2f}" if fantasy_points_from_source > 0 else self.calculate_fantasy_points_standard(stats)
                
                # Prepare record for insertion
                record = {
                    "player_id": player_uuid,
                    "stats": stats,
                    "fantasy_points": fantasy_points,
                    "betting_results": {},
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                batch_data.append(record)
                self.existing_records.add(duplicate_key)  # Prevent intra-batch duplicates
                
                # Insert in batches
                if len(batch_data) >= batch_size:
                    self._insert_batch(batch_data)
                    batch_data = []
                
                if self.stats_processed % 500 == 0:
                    self.logger.info(f"Processed {self.stats_processed} records, inserted {self.stats_inserted}, skipped {self.stats_skipped}")
                
            except Exception as e:
                self.logger.error(f"Error processing record {idx} ({player_name}): {e}")
                continue
        
        # Insert remaining records
        if batch_data:
            self._insert_batch(batch_data)
    
    def _insert_batch(self, batch_data: List[Dict]) -> None:
        """Insert batch with improved error handling."""
        
        try:
            response = self.supabase.table("player_game_stats").insert(batch_data).execute()
            
            if response.data:
                self.stats_inserted += len(response.data)
                self.logger.debug(f"Inserted batch of {len(batch_data)} records")
            
        except Exception as e:
            self.logger.warning(f"Batch insert failed, trying individual inserts: {e}")
            # Fall back to individual inserts
            for record in batch_data:
                try:
                    response = self.supabase.table("player_game_stats").insert([record]).execute()
                    if response.data:
                        self.stats_inserted += 1
                except Exception as individual_error:
                    self.logger.debug(f"Individual record failed: {individual_error}")
    
    def run_integration(self) -> None:
        """Run the complete NFL stats integration process."""
        
        self.logger.info("Starting comprehensive NFL 2024 stats integration...")
        
        try:
            # Step 1: Load existing players and records
            self.load_existing_players()
            self.load_existing_records()
            
            # Step 2: Fetch complete NFL data
            weekly_data = self.fetch_nfl_weekly_data()
            
            # Step 3: Focus on offensive players primarily (but include all)
            offensive_positions = ['QB', 'RB', 'WR', 'TE', 'FB']
            priority_data = weekly_data[weekly_data['position'].isin(offensive_positions)]
            other_data = weekly_data[~weekly_data['position'].isin(offensive_positions)]
            
            self.logger.info(f"Priority offensive players: {len(priority_data)} records")
            self.logger.info(f"Other positions: {len(other_data)} records")
            
            # Process priority data first
            self.logger.info("Processing offensive players first...")
            self.process_weekly_data(priority_data)
            
            self.logger.info("Processing remaining positions...")
            self.process_weekly_data(other_data)
            
            # Final summary
            self.logger.info("NFL stats integration completed successfully!")
            self.logger.info(f"Total records processed: {self.stats_processed}")
            self.logger.info(f"Total records inserted: {self.stats_inserted}")
            self.logger.info(f"Total records skipped (duplicates): {self.stats_skipped}")
            self.logger.info(f"Success rate: {(self.stats_inserted/(max(self.stats_processed - self.stats_skipped, 1))*100):.2f}%")
            
        except Exception as e:
            self.logger.error(f"Integration failed: {e}")
            raise

def main():
    """Main execution function."""
    
    print("🏈 NFL 2024 Stats Integration - COMPREHENSIVE VERSION")
    print("=" * 60)
    
    try:
        integrator = NFLStatsIntegratorFixed()
        integrator.run_integration()
        
        print("\n✅ Comprehensive NFL stats integration completed!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

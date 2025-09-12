#!/usr/bin/env python3
"""
NFL 2025 Week 1 Stats Integration via StatMuse API
Queries StatMuse for each NFL player's position-specific stats and stores in database.
"""

import os
import sys
import logging
import json
import re
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import requests

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

class NFLStatMuseIntegrator:
    """Integrator for NFL 2025 Week 1 stats using StatMuse API."""
    
    def __init__(self):
        """Initialize the integrator with Supabase and StatMuse connections."""
        self.supabase: Client = self._init_supabase()
        self.logger = self._setup_logger()
        self.statmuse_url = os.getenv("STATMUSE_API_URL", "https://web-production-f090e.up.railway.app")
        
        self.stats_processed = 0
        self.stats_inserted = 0
        self.stats_updated = 0
        self.stats_failed = 0
        
        # Position-specific stat queries
        self.position_queries = {
            'QB': [
                ('passing_yards', '{player} passing yards Week 1 2025'),
                ('passing_touchdowns', '{player} passing touchdowns Week 1 2025'),
                ('passing_completions', '{player} completions Week 1 2025'),
                ('passing_attempts', '{player} passing attempts Week 1 2025'),
                ('passing_interceptions', '{player} interceptions Week 1 2025'),
                ('rushing_yards', '{player} rushing yards Week 1 2025'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week 1 2025')
            ],
            'RB': [
                ('rushing_yards', '{player} rushing yards Week 1 2025'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week 1 2025'),
                ('rushing_attempts', '{player} carries Week 1 2025'),
                ('receptions', '{player} receptions Week 1 2025'),
                ('receiving_yards', '{player} receiving yards Week 1 2025'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week 1 2025'),
                ('targets', '{player} targets Week 1 2025')
            ],
            'WR': [
                ('receptions', '{player} receptions Week 1 2025'),
                ('receiving_yards', '{player} receiving yards Week 1 2025'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week 1 2025'),
                ('targets', '{player} targets Week 1 2025'),
                ('rushing_yards', '{player} rushing yards Week 1 2025'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week 1 2025')
            ],
            'TE': [
                ('receptions', '{player} receptions Week 1 2025'),
                ('receiving_yards', '{player} receiving yards Week 1 2025'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week 1 2025'),
                ('targets', '{player} targets Week 1 2025')
            ],
            'K': [
                ('field_goals_made', '{player} field goals made Week 1 2025'),
                ('field_goals_attempted', '{player} field goal attempts Week 1 2025'),
                ('extra_points_made', '{player} extra points Week 1 2025')
            ]
        }
        
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
                logging.FileHandler('nfl_2025_statmuse_integration.log'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        return logging.getLogger(__name__)
    
    def load_nfl_players(self) -> List[Dict]:
        """Load NFL players from database with position filtering."""
        self.logger.info("Loading NFL players from database...")
        
        try:
            response = self.supabase.table("players").select("*").eq("sport", "NFL").execute()
            players = response.data
            
            # Filter to key offensive positions for trends
            key_positions = ['QB', 'RB', 'WR', 'TE', 'K']
            filtered_players = [p for p in players if p.get('position') in key_positions]
            
            self.logger.info(f"Loaded {len(players)} total NFL players")
            self.logger.info(f"Filtered to {len(filtered_players)} key position players")
            
            # Log position breakdown
            position_counts = {}
            for player in filtered_players:
                pos = player.get('position', 'Unknown')
                position_counts[pos] = position_counts.get(pos, 0) + 1
            
            for pos, count in position_counts.items():
                self.logger.info(f"  {pos}: {count} players")
            
            return filtered_players
            
        except Exception as e:
            self.logger.error(f"Error loading players: {e}")
            raise
    
    def query_statmuse(self, query: str) -> Optional[str]:
        """Query StatMuse API and return the answer."""
        try:
            payload = {"query": query}
            response = requests.post(f"{self.statmuse_url}/query", json=payload, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    return result.get('answer', '')
            
            self.logger.debug(f"StatMuse query failed: {query} - {response.status_code}")
            return None
            
        except Exception as e:
            self.logger.debug(f"StatMuse query error: {query} - {e}")
            return None
    
    def extract_stat_value(self, answer: str, stat_name: str) -> float:
        """Extract numerical stat value from StatMuse answer."""
        if not answer:
            return 0.0
        
        # Common patterns for stat extraction
        patterns = [
            r'(\d+(?:\.\d+)?)',  # Any number
            r'has (\d+(?:\.\d+)?)',  # "has X"
            r'(\d+(?:\.\d+)?) ' + stat_name.replace('_', ' '),  # "X stat_name"
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, answer.lower())
            if matches:
                try:
                    return float(matches[0])
                except ValueError:
                    continue
        
        return 0.0
    
    def get_player_stats(self, player: Dict) -> Dict[str, Any]:
        """Get all stats for a player from StatMuse."""
        player_name = player.get('name', '')
        position = player.get('position', '')
        team = player.get('team', '')
        
        self.logger.info(f"Querying stats for {player_name} ({position}, {team})")
        
        stats = {
            # Base info
            "league": "NFL",
            "season": 2025,
            "week": 1,
            "season_type": "REG",
            "team": team,
            "position": position,
            
            # Initialize all stats to 0
            "fantasy_points": 0.0,
            "fantasy_points_ppr": 0.0,
            "passing_attempts": 0.0,
            "passing_completions": 0.0,
            "passing_yards": 0.0,
            "passing_touchdowns": 0.0,
            "passing_interceptions": 0.0,
            "rushing_attempts": 0.0,
            "rushing_yards": 0.0,
            "rushing_touchdowns": 0.0,
            "receptions": 0.0,
            "targets": 0.0,
            "receiving_yards": 0.0,
            "receiving_touchdowns": 0.0,
            "field_goals_made": 0.0,
            "field_goals_attempted": 0.0,
            "extra_points_made": 0.0,
            
            # Advanced stats
            "rushing_fumbles": 0.0,
            "receiving_fumbles": 0.0,
            "rushing_fumbles_lost": 0.0,
            "receiving_fumbles_lost": 0.0,
            "passing_first_downs": 0.0,
            "rushing_first_downs": 0.0,
            "receiving_first_downs": 0.0,
            "passing_2pt_conversions": 0.0,
            "rushing_2pt_conversions": 0.0,
            "receiving_2pt_conversions": 0.0,
            "sacks": 0.0,
            "special_teams_tds": 0.0
        }
        
        # Get position-specific queries
        queries = self.position_queries.get(position, [])
        
        for stat_key, query_template in queries:
            query = query_template.format(player=player_name)
            answer = self.query_statmuse(query)
            
            if answer:
                value = self.extract_stat_value(answer, stat_key)
                stats[stat_key] = value
                self.logger.debug(f"  {stat_key}: {value} (from: {answer[:50]}...)")
            
            # Small delay to avoid overwhelming the API
            time.sleep(0.1)
        
        # Calculate fantasy points
        stats["fantasy_points"] = self.calculate_fantasy_points(stats)
        stats["fantasy_points_ppr"] = self.calculate_fantasy_points_ppr(stats)
        
        return stats
    
    def calculate_fantasy_points(self, stats: Dict[str, Any]) -> float:
        """Calculate standard fantasy points."""
        points = 0.0
        
        # Passing: 1 point per 25 yards, 6 points per TD, -2 per INT
        points += stats.get('passing_yards', 0) / 25
        points += stats.get('passing_touchdowns', 0) * 6
        points -= stats.get('passing_interceptions', 0) * 2
        
        # Rushing: 1 point per 10 yards, 6 points per TD
        points += stats.get('rushing_yards', 0) / 10
        points += stats.get('rushing_touchdowns', 0) * 6
        
        # Receiving: 1 point per 10 yards, 6 points per TD
        points += stats.get('receiving_yards', 0) / 10
        points += stats.get('receiving_touchdowns', 0) * 6
        
        # Kicking: 3 points per FG, 1 point per XP
        points += stats.get('field_goals_made', 0) * 3
        points += stats.get('extra_points_made', 0) * 1
        
        # Special teams TDs: 6 points
        points += stats.get('special_teams_tds', 0) * 6
        
        return round(points, 2)
    
    def calculate_fantasy_points_ppr(self, stats: Dict[str, Any]) -> float:
        """Calculate PPR fantasy points."""
        points = self.calculate_fantasy_points(stats)
        points += stats.get('receptions', 0)  # 1 point per reception
        return round(points, 2)
    
    def store_player_stats(self, player: Dict, stats: Dict[str, Any]) -> bool:
        """Store player stats in database."""
        player_id = player.get('id')
        player_name = player.get('name', '')
        
        try:
            # Check if Week 1 2025 record already exists
            existing_response = self.supabase.table("player_game_stats").select("id").match({
                "player_id": player_id
            }).execute()
            
            existing_records = existing_response.data
            week1_exists = False
            
            # Check if any existing record is for 2025 Week 1
            for record in existing_records:
                record_data = self.supabase.table("player_game_stats").select("stats").eq("id", record["id"]).execute()
                if record_data.data:
                    existing_stats = record_data.data[0].get("stats", {})
                    if existing_stats.get("season") == 2025 and existing_stats.get("week") == 1:
                        week1_exists = True
                        break
            
            record_data = {
                "player_id": player_id,
                "stats": stats,
                "fantasy_points": str(stats["fantasy_points"]),
                "betting_results": {},
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            if week1_exists:
                # Update existing record
                self.supabase.table("player_game_stats").update(record_data).match({
                    "player_id": player_id
                }).execute()
                self.stats_updated += 1
                self.logger.debug(f"Updated Week 1 2025 record for {player_name}")
            else:
                # Insert new record
                self.supabase.table("player_game_stats").insert([record_data]).execute()
                self.stats_inserted += 1
                self.logger.debug(f"Inserted Week 1 2025 record for {player_name}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error storing stats for {player_name}: {e}")
            self.stats_failed += 1
            return False
    
    def run_integration(self) -> None:
        """Run the complete StatMuse integration process."""
        
        self.logger.info("Starting NFL 2025 Week 1 StatMuse integration...")
        
        try:
            # Load NFL players
            players = self.load_nfl_players()
            
            if not players:
                self.logger.warning("No NFL players found!")
                return
            
            # Process each player
            for i, player in enumerate(players):
                self.stats_processed += 1
                player_name = player.get('name', '')
                position = player.get('position', '')
                
                self.logger.info(f"Processing player {i+1}/{len(players)}: {player_name} ({position})")
                
                # Get stats from StatMuse
                stats = self.get_player_stats(player)
                
                # Store in database
                self.store_player_stats(player, stats)
                
                # Progress logging
                if self.stats_processed % 10 == 0:
                    self.logger.info(f"Progress: {self.stats_processed}/{len(players)} players processed")
                
                # Rate limiting
                time.sleep(0.2)
            
            # Final summary
            self.logger.info("NFL 2025 Week 1 StatMuse integration completed!")
            self.logger.info(f"Total players processed: {self.stats_processed}")
            self.logger.info(f"New records inserted: {self.stats_inserted}")
            self.logger.info(f"Existing records updated: {self.stats_updated}")
            self.logger.info(f"Failed records: {self.stats_failed}")
            
            success_rate = ((self.stats_inserted + self.stats_updated) / max(self.stats_processed, 1)) * 100
            self.logger.info(f"Success rate: {success_rate:.2f}%")
            
        except Exception as e:
            self.logger.error(f"Integration failed: {e}")
            raise

def main():
    """Main execution function."""
    
    print("🏈 NFL 2025 Week 1 StatMuse Integration")
    print("=" * 50)
    print("Fetching current NFL player stats via StatMuse API")
    print(f"Target: Week 1 2025 - Date: {datetime.now().strftime('%Y-%m-%d')}")
    print("=" * 50)
    
    try:
        integrator = NFLStatMuseIntegrator()
        integrator.run_integration()
        
        print("\n✅ NFL Week 1 2025 StatMuse integration completed!")
        print("Your trends search functionality now has current season data!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

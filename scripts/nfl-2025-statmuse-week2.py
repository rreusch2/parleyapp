#!/usr/bin/env python3
"""
NFL 2025 Week 2 Stats Integration via StatMuse API (Offense Only)
Queries your StatMuse server for each NFL player's position-specific Week 2 2025 stats
and stores them in the player_game_stats table.
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

WEEK = 2
SEASON = 2025

class NFLStatMuseWeek2Integrator:
    """Integrator for NFL 2025 Week 2 stats using StatMuse API (offense only)."""

    def __init__(self):
        self.supabase: Client = self._init_supabase()
        self.logger = self._setup_logger()
        self.statmuse_url = os.getenv("STATMUSE_API_URL", "https://web-production-f090e.up.railway.app")

        self.stats_processed = 0
        self.stats_inserted = 0
        self.stats_updated = 0
        self.stats_failed = 0

        # Position-specific stat queries for Week 2
        self.position_queries = {
            'QB': [
                ('passing_yards', '{player} passing yards Week 2 2025'),
                ('passing_touchdowns', '{player} passing touchdowns Week 2 2025'),
                ('passing_completions', '{player} completions Week 2 2025'),
                ('passing_attempts', '{player} passing attempts Week 2 2025'),
                ('passing_interceptions', '{player} interceptions Week 2 2025'),
                ('rushing_yards', '{player} rushing yards Week 2 2025'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week 2 2025')
            ],
            'RB': [
                ('rushing_yards', '{player} rushing yards Week 2 2025'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week 2 2025'),
                ('rushing_attempts', '{player} carries Week 2 2025'),
                ('receptions', '{player} receptions Week 2 2025'),
                ('receiving_yards', '{player} receiving yards Week 2 2025'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week 2 2025'),
                ('targets', '{player} targets Week 2 2025')
            ],
            'WR': [
                ('receptions', '{player} receptions Week 2 2025'),
                ('receiving_yards', '{player} receiving yards Week 2 2025'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week 2 2025'),
                ('targets', '{player} targets Week 2 2025'),
                ('rushing_yards', '{player} rushing yards Week 2 2025'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week 2 2025')
            ],
            'TE': [
                ('receptions', '{player} receptions Week 2 2025'),
                ('receiving_yards', '{player} receiving yards Week 2 2025'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week 2 2025'),
                ('targets', '{player} targets Week 2 2025')
            ],
            'K': [
                ('field_goals_made', '{player} field goals made Week 2 2025'),
                ('field_goals_attempted', '{player} field goal attempts Week 2 2025'),
                ('extra_points_made', '{player} extra points Week 2 2025')
            ]
        }

    def _init_supabase(self) -> Client:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        return create_client(url, key)

    def _setup_logger(self) -> logging.Logger:
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('nfl_2025_statmuse_week2_integration.log'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        return logging.getLogger(__name__)

    def load_offensive_players(self) -> List[Dict]:
        self.logger.info("Loading NFL offensive players from database...")
        try:
            # Fetch in a large range to avoid default 1000-row limit
            response = (
                self.supabase
                .table("players")
                .select("*")
                .eq("sport", "NFL")
                .range(0, 9999)
                .execute()
            )
            players = response.data or []
            offensive_positions = ['QB', 'RB', 'WR', 'TE', 'K']  # K included as non-defense
            filtered = [p for p in players if (p.get('position') in offensive_positions)]

            self.logger.info(f"Loaded {len(players)} total NFL players; filtered to {len(filtered)} offense players")
            return filtered
        except Exception as e:
            self.logger.error(f"Error loading players: {e}")
            raise

    def load_week1_player_ids(self) -> set:
        """Return set of player_id values that already have a 2025 Week 1 record."""
        self.logger.info("Loading player_ids with existing Week 1 2025 records...")
        try:
            resp = (
                self.supabase
                .table("player_game_stats")
                .select("player_id, stats")
                .filter("stats->>season", "eq", str(SEASON))
                .filter("stats->>week", "eq", "1")
                .range(0, 9999)
                .execute()
            )
            ids = {row.get("player_id") for row in (resp.data or []) if row.get("player_id")}
            self.logger.info(f"Found {len(ids)} players with Week 1 2025 records")
            return ids
        except Exception as e:
            self.logger.error(f"Error loading Week 1 player ids: {e}")
            return set()

    def query_statmuse(self, query: str) -> Optional[str]:
        try:
            payload = {"query": query}
            resp = requests.post(f"{self.statmuse_url}/query", json=payload, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if data.get('success'):
                    return data.get('answer', '')
            self.logger.debug(f"StatMuse query non-200 or failed: {query} -> {resp.status_code}")
            return None
        except Exception as e:
            self.logger.debug(f"StatMuse query error: {query} -> {e}")
            return None

    def extract_stat_value(self, answer: str, stat_name: str) -> float:
        if not answer:
            return 0.0
        # Try simple numeric extraction first
        patterns = [
            r'(\d+(?:\.\d+)?)',
            rf'(\d+(?:\.\d+)?)\s+{re.escape(stat_name).replace("_", " ")}',
            r'has\s+(\d+(?:\.\d+)?)',
        ]
        lower = answer.lower()
        for pat in patterns:
            m = re.search(pat, lower)
            if m:
                try:
                    return float(m.group(1))
                except ValueError:
                    continue
        return 0.0

    def build_base_stats(self, player: Dict) -> Dict[str, Any]:
        position = player.get('position', '')
        team = player.get('team', '')
        base = {
            "league": "NFL",
            "season": SEASON,
            "week": WEEK,
            "season_type": "REG",
            "team": team,
            "position": position,

            # Initialize to zeros
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
            "special_teams_tds": 0.0,
        }
        return base

    def calc_fp_standard(self, s: Dict[str, Any]) -> float:
        pts = 0.0
        pts += s.get('passing_yards', 0) / 25
        pts += s.get('passing_touchdowns', 0) * 6
        pts -= s.get('passing_interceptions', 0) * 2
        pts += s.get('rushing_yards', 0) / 10
        pts += s.get('rushing_touchdowns', 0) * 6
        pts += s.get('receiving_yards', 0) / 10
        pts += s.get('receiving_touchdowns', 0) * 6
        pts += s.get('field_goals_made', 0) * 3
        pts += s.get('extra_points_made', 0) * 1
        pts += s.get('special_teams_tds', 0) * 6
        return round(pts, 2)

    def calc_fp_ppr(self, s: Dict[str, Any]) -> float:
        return round(self.calc_fp_standard(s) + s.get('receptions', 0), 2)

    def get_player_week2_stats(self, player: Dict) -> Dict[str, Any]:
        stats = self.build_base_stats(player)
        player_name = player.get('name', '')
        position = player.get('position', '')

        queries = self.position_queries.get(position, [])
        for stat_key, template in queries:
            q = template.format(player=player_name)
            ans = self.query_statmuse(q)
            if ans:
                val = self.extract_stat_value(ans, stat_key)
                stats[stat_key] = val
            time.sleep(0.1)

        stats["fantasy_points"] = self.calc_fp_standard(stats)
        stats["fantasy_points_ppr"] = self.calc_fp_ppr(stats)
        return stats

    def store_player_stats(self, player: Dict, stats: Dict[str, Any]) -> bool:
        player_id = player.get('id')
        player_name = player.get('name', '')
        try:
            # Check if Week 2 2025 record exists for this player
            existing_resp = self.supabase.table("player_game_stats").select("id, stats").eq("player_id", player_id).execute()
            week2_id = None
            for rec in existing_resp.data or []:
                st = rec.get("stats") or {}
                if str(st.get("season")) == str(SEASON) and str(st.get("week")) == str(WEEK):
                    week2_id = rec.get("id")
                    break

            payload = {
                "player_id": player_id,
                "stats": stats,
                "fantasy_points": str(stats.get("fantasy_points", 0.0)),
                "betting_results": {},
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            if week2_id:
                self.supabase.table("player_game_stats").update(payload).eq("id", week2_id).execute()
                self.stats_updated += 1
                self.logger.debug(f"Updated Week 2 2025 record for {player_name}")
            else:
                self.supabase.table("player_game_stats").insert([payload]).execute()
                self.stats_inserted += 1
                self.logger.debug(f"Inserted Week 2 2025 record for {player_name}")

            return True
        except Exception as e:
            self.logger.error(f"Error storing stats for {player_name}: {e}")
            self.stats_failed += 1
            return False

    def run(self) -> None:
        self.logger.info("Starting NFL 2025 Week 2 StatMuse integration (offense only)...")
        players = self.load_offensive_players()
        week1_ids = self.load_week1_player_ids()
        if week1_ids:
            players = [p for p in players if p.get('id') in week1_ids]
            self.logger.info(f"Filtered to {len(players)} offensive players who have Week 1 records")
        if not players:
            self.logger.warning("No offensive NFL players found!")
            return

        for i, player in enumerate(players):
            self.stats_processed += 1
            pname = player.get('name', '')
            pos = player.get('position', '')
            self.logger.info(f"Processing {i+1}/{len(players)}: {pname} ({pos})")

            stats = self.get_player_week2_stats(player)
            self.store_player_stats(player, stats)

            if self.stats_processed % 10 == 0:
                self.logger.info(f"Progress: {self.stats_processed}/{len(players)} processed | inserted {self.stats_inserted} | updated {self.stats_updated}")
            time.sleep(0.2)

        self.logger.info("NFL 2025 Week 2 StatMuse integration completed!")
        self.logger.info(f"Total processed: {self.stats_processed}")
        self.logger.info(f"Inserted: {self.stats_inserted}")
        self.logger.info(f"Updated: {self.stats_updated}")
        self.logger.info(f"Failed: {self.stats_failed}")
        success_rate = ((self.stats_inserted + self.stats_updated) / max(self.stats_processed, 1)) * 100
        self.logger.info(f"Success rate: {success_rate:.2f}%")


def main():
    print("\n🏈 NFL 2025 Week 2 StatMuse Integration (Offense Only)")
    print("=" * 50)
    print("Fetching Week 2 2025 NFL offensive player stats via StatMuse API")
    print(f"Run date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)

    try:
        integrator = NFLStatMuseWeek2Integrator()
        integrator.run()
        print("\n✅ NFL Week 2 2025 StatMuse integration completed!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

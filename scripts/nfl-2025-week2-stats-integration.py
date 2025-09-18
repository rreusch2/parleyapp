#!/usr/bin/env python3
"""
NFL 2025 Week 2 Stats Integration Script
Fetches Week 2 2025 NFL offensive player stats using nfl_data_py to update trends data.
Modeled after the Week 1 integrator with offense-only processing and safe updates.
"""

import os
import sys
import logging
import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Set

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Third-party imports
import pandas as pd
import nfl_data_py as nfl
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables from project root
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

WEEK = 2
SEASON = 2025

class NFL2025Week2StatsIntegrator:
    """Integrator for NFL 2025 Week 2 offensive player stats."""

    def __init__(self):
        self.supabase: Client = self._init_supabase()
        self.logger = self._setup_logger()
        self.player_mapping: Dict[str, str] = {}
        self.existing_records: Set[str] = set()  # keys: f"{player_id}_{week}"
        self.stats_processed = 0
        self.stats_inserted = 0
        self.stats_updated = 0
        self.stats_skipped = 0

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
                logging.FileHandler('nfl_2025_week2_stats_integration.log'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        return logging.getLogger(__name__)

    def load_existing_players(self) -> None:
        """Load existing NFL players and build robust name/team/external mappings."""
        self.logger.info("Loading existing NFL players from database...")
        try:
            response = self.supabase.table("players").select("*").eq("sport", "NFL").execute()
            players = response.data or []
            self.logger.info(f"Loaded {len(players)} NFL players from database")

            for player in players:
                name = (player.get("name") or "").strip()
                team = (player.get("team") or "").strip()
                player_id = player.get("id")
                external_id = player.get("external_player_id")

                if name and player_id:
                    self.player_mapping[name.lower()] = player_id
                    self.player_mapping[f"{name}_{team}".lower()] = player_id
                    if "." in name:
                        clean_name = name.replace(".", " ")
                        self.player_mapping[clean_name.lower()] = player_id
                    if external_id:
                        self.player_mapping[str(external_id)] = player_id

            self.logger.info(f"Created {len(self.player_mapping)} player mappings")
        except Exception as e:
            self.logger.error(f"Error loading players: {e}")
            raise

    def load_existing_2025_records(self) -> None:
        """Load existing 2025 records to avoid duplicates and to switch to update mode."""
        self.logger.info("Loading existing 2025 NFL stats records (any week)...")
        try:
            response = self.supabase.table("player_game_stats").select("player_id, stats").execute()
            for record in (response.data or []):
                pid = record.get("player_id")
                stats = record.get("stats") or {}
                season = stats.get("season")
                week = stats.get("week")
                # Season may be int or str in legacy rows
                if str(season) == str(SEASON) and pid and week:
                    self.existing_records.add(f"{pid}_{week}")
            self.logger.info(f"Found {len(self.existing_records)} existing 2025 player-week records")
        except Exception as e:
            self.logger.error(f"Error loading existing records: {e}")
            raise

    def fetch_nfl_week2_2025_data(self) -> pd.DataFrame:
        """Fetch Week 2 2025 NFL weekly data."""
        self.logger.info("Fetching NFL Week 2 2025 data...")
        try:
            weekly = nfl.import_weekly_data([SEASON])
            week_data = weekly[(weekly['week'] == WEEK) & (weekly['season_type'] == 'REG')].copy()
            self.logger.info(f"Fetched {len(week_data)} Week {WEEK} {SEASON} records")
            if not week_data.empty:
                self.logger.info(f"Teams represented: {len(week_data['recent_team'].unique())}")
                pos_counts = (week_data['position'].value_counts() if 'position' in week_data.columns else pd.Series(dtype=int))
                self.logger.info("Position breakdown (top):")
                for pos, cnt in pos_counts.head(10).items():
                    self.logger.info(f"  {pos}: {cnt}")
            return week_data
        except Exception as e:
            self.logger.error(f"Error fetching Week 2 data: {e}")
            raise

    def map_player_to_uuid(self, player_name: str, team: str, player_id: Optional[str] = None) -> Optional[str]:
        keys = [f"{player_name}_{team}".lower(), player_name.lower(), player_name.replace(".", " ").lower(), player_name.replace(" ", ".").lower()]
        if player_id:
            keys.insert(0, str(player_id))
        for k in keys:
            if k in self.player_mapping:
                return self.player_mapping[k]
        # Fallback fuzzy: substring part intersection
        clean = player_name.lower().strip()
        clean_parts = set(clean.split())
        for mapped_key, uuid in self.player_mapping.items():
            parts = set(str(mapped_key).split())
            if len(clean_parts.intersection(parts)) >= 1:
                return uuid
        return None

    def safe_float(self, value: Any) -> float:
        if pd.isna(value) or value is None:
            return 0.0
        try:
            v = float(value)
            if math.isnan(v) or math.isinf(v):
                return 0.0
            return v
        except (ValueError, TypeError):
            return 0.0

    def transform_weekly_stats(self, row: pd.Series) -> Dict[str, Any]:
        stats: Dict[str, Any] = {
            "league": "NFL",
            "season": SEASON,
            "week": WEEK,
            "season_type": str(row.get('season_type', 'REG')),
            "opponent_team": str(row.get('opponent_team', '')),
            "team": str(row.get('recent_team', '')),
            "position": str(row.get('position', '')),

            # Fantasy points
            "fantasy_points": self.safe_float(row.get('fantasy_points')),
            "fantasy_points_ppr": self.safe_float(row.get('fantasy_points_ppr')),

            # Passing
            "passing_attempts": self.safe_float(row.get('attempts')),
            "passing_completions": self.safe_float(row.get('completions')),
            "passing_yards": self.safe_float(row.get('passing_yards')),
            "passing_touchdowns": self.safe_float(row.get('passing_tds')),
            "passing_interceptions": self.safe_float(row.get('interceptions')),
            "passing_first_downs": self.safe_float(row.get('passing_first_downs')),
            "passing_epa": self.safe_float(row.get('passing_epa')),
            "passing_air_yards": self.safe_float(row.get('passing_air_yards')),
            "passing_yards_after_catch": self.safe_float(row.get('passing_yards_after_catch')),
            "passing_2pt_conversions": self.safe_float(row.get('passing_2pt_conversions')),

            # Rushing
            "rushing_attempts": self.safe_float(row.get('carries')),
            "rushing_yards": self.safe_float(row.get('rushing_yards')),
            "rushing_touchdowns": self.safe_float(row.get('rushing_tds')),
            "rushing_first_downs": self.safe_float(row.get('rushing_first_downs')),
            "rushing_epa": self.safe_float(row.get('rushing_epa')),
            "rushing_fumbles": self.safe_float(row.get('rushing_fumbles')),
            "rushing_fumbles_lost": self.safe_float(row.get('rushing_fumbles_lost')),
            "rushing_2pt_conversions": self.safe_float(row.get('rushing_2pt_conversions')),

            # Receiving
            "receptions": self.safe_float(row.get('receptions')),
            "targets": self.safe_float(row.get('targets')),
            "receiving_yards": self.safe_float(row.get('receiving_yards')),
            "receiving_touchdowns": self.safe_float(row.get('receiving_tds')),
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

            # Limited defense/special to keep schema parity (will be mostly zero for offense-only set)
            "sacks": self.safe_float(row.get('sacks')),
            "sack_yards": self.safe_float(row.get('sack_yards')),
            "special_teams_tds": self.safe_float(row.get('special_teams_tds')),

            # Advanced
            "pacr": self.safe_float(row.get('pacr')),
            "racr": self.safe_float(row.get('racr')),
            "dakota": self.safe_float(row.get('dakota')),
        }
        return stats

    def calculate_fantasy_points_standard(self, stats: Dict[str, Any]) -> str:
        points = 0.0
        points += stats.get('passing_yards', 0) / 25
        points += stats.get('passing_touchdowns', 0) * 6
        points -= stats.get('passing_interceptions', 0) * 2
        points += stats.get('rushing_yards', 0) / 10
        points += stats.get('rushing_touchdowns', 0) * 6
        points += stats.get('receiving_yards', 0) / 10
        points += stats.get('receiving_touchdowns', 0) * 6
        points += stats.get('special_teams_tds', 0) * 6
        points -= stats.get('rushing_fumbles_lost', 0) * 2
        points -= stats.get('receiving_fumbles_lost', 0) * 2
        points += stats.get('passing_2pt_conversions', 0) * 2
        points += stats.get('rushing_2pt_conversions', 0) * 2
        points += stats.get('receiving_2pt_conversions', 0) * 2
        return f"{points:.2f}"

    def process_week2_data(self, df: pd.DataFrame) -> None:
        self.logger.info(f"Processing {len(df)} Week {WEEK} {SEASON} offensive stat records...")

        batch_size = 50
        batch: List[Dict[str, Any]] = []

        for idx, row in df.iterrows():
            try:
                self.stats_processed += 1
                player_name = str(row.get('player_display_name', row.get('player_name', '')))
                team = str(row.get('recent_team', ''))
                if not player_name or not team:
                    self.logger.debug(f"Missing name or team at row {idx}")
                    continue

                player_uuid = self.map_player_to_uuid(player_name, team, str(row.get('player_id', '')))
                if not player_uuid:
                    # Unmapped player: skip to avoid orphan rows
                    continue

                duplicate_key = f"{player_uuid}_{WEEK}"

                stats = self.transform_weekly_stats(row)
                source_fp = self.safe_float(row.get('fantasy_points_ppr', row.get('fantasy_points', 0)))
                fantasy_points = f"{source_fp:.2f}" if source_fp > 0 else self.calculate_fantasy_points_standard(stats)

                record = {
                    "player_id": player_uuid,
                    "stats": stats,
                    "fantasy_points": fantasy_points,
                    "betting_results": {},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }

                if duplicate_key in self.existing_records:
                    # Update only the Week 2 2025 row for this player
                    try:
                        self.supabase.table("player_game_stats") \
                            .update(record) \
                            .eq("player_id", player_uuid) \
                            .filter("stats->>season", "eq", str(SEASON)) \
                            .filter("stats->>week", "eq", str(WEEK)) \
                            .execute()
                        self.stats_updated += 1
                    except Exception as e:
                        self.logger.debug(f"Update failed for {player_name}: {e}")
                else:
                    batch.append(record)
                    self.existing_records.add(duplicate_key)

                if len(batch) >= batch_size:
                    self._insert_batch(batch)
                    batch = []

                if self.stats_processed % 100 == 0:
                    self.logger.info(f"Processed {self.stats_processed} | inserted {self.stats_inserted} | updated {self.stats_updated}")

            except Exception as e:
                self.logger.debug(f"Error processing row {idx} ({player_name}): {e}")
                continue

        if batch:
            self._insert_batch(batch)

    def _insert_batch(self, payload: List[Dict[str, Any]]) -> None:
        try:
            resp = self.supabase.table("player_game_stats").insert(payload).execute()
            if resp.data:
                self.stats_inserted += len(resp.data)
        except Exception as e:
            # Fallback to individual inserts
            for rec in payload:
                try:
                    self.supabase.table("player_game_stats").insert([rec]).execute()
                    self.stats_inserted += 1
                except Exception:
                    pass

    def run_integration(self) -> None:
        self.logger.info(f"Starting NFL Week {WEEK} {SEASON} offensive stats integration...")
        self.load_existing_players()
        self.load_existing_2025_records()

        week_data = self.fetch_nfl_week2_2025_data()
        if week_data.empty:
            self.logger.warning("No Week 2 data found. Exiting.")
            return

        offensive_positions = ['QB', 'RB', 'WR', 'TE', 'FB']
        offense_df = week_data[week_data['position'].isin(offensive_positions)] if 'position' in week_data.columns else week_data
        self.logger.info(f"Offensive player rows: {len(offense_df)}")
        self.process_week2_data(offense_df)

        self.logger.info("NFL Week 2 2025 offensive stats integration completed!")
        self.logger.info(f"Total processed: {self.stats_processed}")
        self.logger.info(f"Inserted: {self.stats_inserted}")
        self.logger.info(f"Updated: {self.stats_updated}")
        self.logger.info(f"Skipped: {self.stats_skipped}")
        success = ((self.stats_inserted + self.stats_updated) / max(self.stats_processed, 1)) * 100
        self.logger.info(f"Success rate: {success:.2f}%")


def main():
    print("\n🏈 NFL 2025 Week 2 Stats Integration")
    print("=" * 50)
    print("Updating NFL offensive player stats for Week 2 of the 2025 season")
    print(f"Run date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)

    try:
        integrator = NFL2025Week2StatsIntegrator()
        integrator.run_integration()
        print("\n✅ NFL Week 2 2025 offensive stats integration completed!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

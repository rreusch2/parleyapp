#!/usr/bin/env python3
"""
NFL 2025 Week 1 & Week 2 Offensive Game Logs Refresh via StatMuse
Covers all offensive players, detects missing player-week records, and upserts accurate per-game stats.
- Uses your custom StatMuse server with position-specific week prompts
- Avoids writing zero-only rows (likely no game / no data) to keep accuracy high
- Writes to player_game_stats with season=2025 and week in {1,2}
"""

import os
import sys
import logging
import re
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple, Set
import requests

# Add project root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client
from dotenv import load_dotenv

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

SEASON = 2025
WEEKS = [1, 2]
OFFENSIVE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K']

class NFL2025Week12Refresh:
    def __init__(self):
        self.supabase: Client = self._init_supabase()
        self.logger = self._setup_logger()
        self.statmuse_url = os.getenv("STATMUSE_API_URL", "https://web-production-f090e.up.railway.app")
        self.processed = 0
        self.inserted = 0
        self.updated = 0
        self.skipped = 0
        self.failed = 0

        # Position → [(stat_key, query_template)]
        self.position_queries: Dict[str, List[Tuple[str, str]]] = {
            'QB': [
                ('passing_yards', '{player} passing yards Week {week} 2025'),
                ('passing_touchdowns', '{player} passing touchdowns Week {week} 2025'),
                ('passing_completions', '{player} completions Week {week} 2025'),
                ('passing_attempts', '{player} passing attempts Week {week} 2025'),
                ('passing_interceptions', '{player} interceptions Week {week} 2025'),
                ('rushing_yards', '{player} rushing yards Week {week} 2025'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week {week} 2025'),
            ],
            'RB': [
                ('rushing_yards', '{player} rushing yards Week {week} 2025'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week {week} 2025'),
                ('rushing_attempts', '{player} carries Week {week} 2025'),
                ('receptions', '{player} receptions Week {week} 2025'),
                ('receiving_yards', '{player} receiving yards Week {week} 2025'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week {week} 2025'),
                ('targets', '{player} targets Week {week} 2025'),
            ],
            'WR': [
                ('receptions', '{player} receptions Week {week} 2025'),
                ('receiving_yards', '{player} receiving yards Week {week} 2025'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week {week} 2025'),
                ('targets', '{player} targets Week {week} 2025'),
                ('rushing_yards', '{player} rushing yards Week {week} 2025'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week {week} 2025'),
            ],
            'TE': [
                ('receptions', '{player} receptions Week {week} 2025'),
                ('receiving_yards', '{player} receiving yards Week {week} 2025'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week {week} 2025'),
                ('targets', '{player} targets Week {week} 2025'),
            ],
            'K': [
                ('field_goals_made', '{player} field goals made Week {week} 2025'),
                ('field_goals_attempted', '{player} field goal attempts Week {week} 2025'),
                ('extra_points_made', '{player} extra points Week {week} 2025'),
            ],
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
                logging.FileHandler('nfl_2025_statmuse_week1_2_refresh.log'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        return logging.getLogger(__name__)

    def fetch_offensive_players(self) -> List[Dict[str, Any]]:
        self.logger.info("Loading NFL offensive players from players table...")
        resp = (
            self.supabase
            .table('players')
            .select('*')
            .eq('sport', 'NFL')
            .range(0, 9999)
            .execute()
        )
        all_players = resp.data or []
        filtered = [p for p in all_players if p.get('position') in OFFENSIVE_POSITIONS]
        self.logger.info(f"Loaded {len(all_players)} players; offense-only = {len(filtered)}")
        return filtered

    def fetch_existing_player_weeks(self, season: int, weeks: List[int]) -> Set[Tuple[str, str]]:
        self.logger.info("Fetching existing player-week keys for 2025 weeks 1-2...")
        keys: Set[Tuple[str, str]] = set()
        # Pull a large page
        resp = (
            self.supabase
            .table('player_game_stats')
            .select('player_id, stats')
            .range(0, 20000)
            .execute()
        )
        for row in (resp.data or []):
            pid = row.get('player_id')
            st = row.get('stats') or {}
            if str(st.get('season')) == str(season):
                wk = str(st.get('week'))
                if wk in {str(w) for w in weeks}:
                    if pid:
                        keys.add((pid, wk))
        self.logger.info(f"Found {len(keys)} existing 2025 week1/2 records")
        return keys

    def query_statmuse(self, query: str) -> Optional[str]:
        try:
            r = requests.post(f"{self.statmuse_url}/query", json={"query": query}, timeout=15)
            if r.status_code == 200:
                js = r.json()
                if js.get('success'):
                    return js.get('answer', '')
            return None
        except Exception:
            return None

    def extract_number(self, answer: Optional[str], stat_name: str) -> float:
        if not answer:
            return 0.0
        low = answer.lower()
        # Prefer direct numeric
        pats = [
            r'(\d+(?:\.\d+)?)',
            rf'(\d+(?:\.\d+)?)\s+{re.escape(stat_name).replace('_',' ')}',
            r'has\s+(\d+(?:\.\d+)?)',
        ]
        for pat in pats:
            m = re.search(pat, low)
            if m:
                try:
                    return float(m.group(1))
                except ValueError:
                    continue
        return 0.0

    def build_base_stats(self, player: Dict[str, Any], week: int) -> Dict[str, Any]:
        return {
            'league': 'NFL',
            'season': SEASON,
            'week': week,
            'season_type': 'REG',
            'team': player.get('team', ''),
            'position': player.get('position', ''),
            # initialize
            'fantasy_points': 0.0,
            'fantasy_points_ppr': 0.0,
            'passing_attempts': 0.0,
            'passing_completions': 0.0,
            'passing_yards': 0.0,
            'passing_touchdowns': 0.0,
            'passing_interceptions': 0.0,
            'rushing_attempts': 0.0,
            'rushing_yards': 0.0,
            'rushing_touchdowns': 0.0,
            'receptions': 0.0,
            'targets': 0.0,
            'receiving_yards': 0.0,
            'receiving_touchdowns': 0.0,
            'field_goals_made': 0.0,
            'field_goals_attempted': 0.0,
            'extra_points_made': 0.0,
            'rushing_fumbles': 0.0,
            'receiving_fumbles': 0.0,
            'rushing_fumbles_lost': 0.0,
            'receiving_fumbles_lost': 0.0,
            'passing_first_downs': 0.0,
            'rushing_first_downs': 0.0,
            'receiving_first_downs': 0.0,
            'passing_2pt_conversions': 0.0,
            'rushing_2pt_conversions': 0.0,
            'receiving_2pt_conversions': 0.0,
            'sacks': 0.0,
            'special_teams_tds': 0.0,
        }

    def calc_fp(self, s: Dict[str, Any]) -> float:
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
        return round(self.calc_fp(s) + s.get('receptions', 0), 2)

    def should_store(self, stats: Dict[str, Any], position: str) -> bool:
        # Avoid storing rows that are 100% zeros (likely no game / bad answer)
        if position == 'QB':
            keys = ['passing_attempts', 'passing_completions', 'passing_yards', 'passing_touchdowns', 'passing_interceptions']
        elif position in ('RB', 'WR', 'TE'):
            keys = ['receptions', 'targets', 'receiving_yards', 'receiving_touchdowns', 'rushing_attempts', 'rushing_yards', 'rushing_touchdowns']
        elif position == 'K':
            keys = ['field_goals_attempted', 'field_goals_made', 'extra_points_made']
        else:
            keys = ['passing_yards', 'rushing_yards', 'receiving_yards']
        return any(float(stats.get(k, 0)) > 0 for k in keys)

    def get_player_week_stats(self, player: Dict[str, Any], week: int) -> Dict[str, Any]:
        stats = self.build_base_stats(player, week)
        name = player.get('name', '')
        position = player.get('position', '')
        qset = self.position_queries.get(position, [])
        for stat_key, tmpl in qset:
            q = tmpl.format(player=name, week=week)
            ans = self.query_statmuse(q)
            val = self.extract_number(ans, stat_key)
            stats[stat_key] = val
            time.sleep(0.08)
        stats['fantasy_points'] = self.calc_fp(stats)
        stats['fantasy_points_ppr'] = self.calc_fp_ppr(stats)
        return stats

    def upsert_player_week(self, player_id: str, stats: Dict[str, Any]) -> None:
        week = str(stats.get('week'))
        # Find existing
        existing = (
            self.supabase
            .table('player_game_stats')
            .select('id, stats')
            .eq('player_id', player_id)
            .execute()
        )
        target_id = None
        for r in (existing.data or []):
            st = r.get('stats') or {}
            if str(st.get('season')) == str(SEASON) and str(st.get('week')) == week:
                target_id = r.get('id')
                break
        payload = {
            'player_id': player_id,
            'stats': stats,
            'fantasy_points': str(stats.get('fantasy_points', 0.0)),
            'betting_results': {},
            'created_at': datetime.now(timezone.utc).isoformat(),
        }
        if target_id:
            self.supabase.table('player_game_stats').update(payload).eq('id', target_id).execute()
            self.updated += 1
        else:
            self.supabase.table('player_game_stats').insert([payload]).execute()
            self.inserted += 1

    def run(self) -> None:
        self.logger.info("Starting NFL 2025 Week 1 & 2 offensive refresh via StatMuse...")
        players = self.fetch_offensive_players()
        existing_keys = self.fetch_existing_player_weeks(SEASON, WEEKS)
        target_pairs: List[Tuple[Dict[str, Any], int]] = []
        for p in players:
            pid = p.get('id')
            if not pid:
                continue
            for wk in WEEKS:
                if (pid, str(wk)) not in existing_keys:
                    target_pairs.append((p, wk))
        self.logger.info(f"Missing player-week records to backfill: {len(target_pairs)}")

        for idx, (player, week) in enumerate(target_pairs, start=1):
            try:
                self.processed += 1
                name = player.get('name', '')
                pos = player.get('position', '')
                self.logger.info(f"[{idx}/{len(target_pairs)}] {name} ({pos}) - Week {week}")
                stats = self.get_player_week_stats(player, week)
                if self.should_store(stats, pos):
                    self.upsert_player_week(player.get('id'), stats)
                else:
                    self.skipped += 1
                if self.processed % 25 == 0:
                    self.logger.info(f"Progress: processed {self.processed} | inserted {self.inserted} | updated {self.updated} | skipped {self.skipped}")
            except Exception as e:
                self.failed += 1
                self.logger.debug(f"Failed for {player.get('name','?')} week {week}: {e}")
            time.sleep(0.1)

        self.logger.info("Refresh complete!")
        self.logger.info(f"Processed: {self.processed}")
        self.logger.info(f"Inserted: {self.inserted}")
        self.logger.info(f"Updated: {self.updated}")
        self.logger.info(f"Skipped (zero-only): {self.skipped}")
        self.logger.info(f"Failed: {self.failed}")


def main():
    print("\n🏈 NFL 2025 Week 1 & 2 Offensive Refresh (StatMuse)")
    print("=" * 60)
    print("Backfilling accurate per-game stats for offensive players (Weeks 1-2)")
    print(f"Run at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    try:
        r = NFL2025Week12Refresh()
        r.run()
        print("\n✅ Refresh completed!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()

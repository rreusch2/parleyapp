#!/usr/bin/env python3
"""
NFL 2024-2025 Last-10 Games Backfill via StatMuse (Offense Only)
- Prioritizes accurate per-game logs for trends pages
- Queries your StatMuse server with robust parsing and stat synonyms
- Walks backwards from 2025 W2 -> W1, then 2024 W18 -> W1 until 10 valid games found per player
- Skips zero-only results (likely no game / DNP / bad parse)
- Upserts into player_game_stats keyed by (player_id, season, week)

CLI options:
  --positions "QB,WR"   Limit by positions (default: QB,RB,WR,TE,K)
  --limit N              Max players to process
  --force                Update even if a row already exists for a given week
"""

import os
import sys
import time
import re
import argparse
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple, Set

import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Load env
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(project_root, '.env')
load_dotenv(env_path)

DEFAULT_POSITIONS = ['QB', 'WR', 'RB', 'TE', 'K']
SEASONS_WEEKS = [
    (2025, [2, 1]),
    (2024, list(range(18, 0, -1))),
]

class Last10Backfill:
    def __init__(self, positions: List[str], limit: Optional[int], force: bool):
        self.positions = [p.strip().upper() for p in positions if p.strip()]
        self.limit = limit
        self.force = force
        self.supabase: Client = self._init_supabase()
        self.logger = self._setup_logger()
        self.statmuse_url = os.getenv("STATMUSE_API_URL", "https://web-production-f090e.up.railway.app")

        self.processed_players = 0
        self.total_inserts = 0
        self.total_updates = 0
        self.total_skipped = 0
        self.total_failed = 0

        # Position → [(stat_key, query_template)]
        self.position_queries: Dict[str, List[Tuple[str, str]]] = {
            'QB': [
                ('passing_yards', '{player} passing yards Week {week} {season}'),
                ('passing_touchdowns', '{player} passing touchdowns Week {week} {season}'),
                ('passing_completions', '{player} completions Week {week} {season}'),
                ('passing_attempts', '{player} passing attempts Week {week} {season}'),
                ('passing_interceptions', '{player} interceptions Week {week} {season}'),
                ('rushing_yards', '{player} rushing yards Week {week} {season}'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week {week} {season}'),
            ],
            'RB': [
                ('rushing_yards', '{player} rushing yards Week {week} {season}'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week {week} {season}'),
                ('rushing_attempts', '{player} carries Week {week} {season}'),
                ('receptions', '{player} receptions Week {week} {season}'),
                ('receiving_yards', '{player} receiving yards Week {week} {season}'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week {week} {season}'),
                ('targets', '{player} targets Week {week} {season}'),
            ],
            'WR': [
                ('receptions', '{player} receptions Week {week} {season}'),
                ('receiving_yards', '{player} receiving yards Week {week} {season}'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week {week} {season}'),
                ('targets', '{player} targets Week {week} {season}'),
                ('rushing_yards', '{player} rushing yards Week {week} {season}'),
                ('rushing_touchdowns', '{player} rushing touchdowns Week {week} {season}'),
            ],
            'TE': [
                ('receptions', '{player} receptions Week {week} {season}'),
                ('receiving_yards', '{player} receiving yards Week {week} {season}'),
                ('receiving_touchdowns', '{player} receiving touchdowns Week {week} {season}'),
                ('targets', '{player} targets Week {week} {season}'),
            ],
            'K': [
                ('field_goals_made', '{player} field goals made Week {week} {season}'),
                ('field_goals_attempted', '{player} field goal attempts Week {week} {season}'),
                ('extra_points_made', '{player} extra points Week {week} {season}'),
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
                logging.FileHandler('nfl_last10_statmuse.log'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        return logging.getLogger(__name__)

    def fetch_players(self) -> List[Dict[str, Any]]:
        self.logger.info(f"Fetching NFL offensive players for positions: {','.join(self.positions)}")
        result: List[Dict[str, Any]] = []
        page_size = 1000
        for i in range(20):
            start, end = i*page_size, i*page_size + page_size - 1
            resp = (
                self.supabase
                .table('players')
                .select('*')
                .eq('sport', 'NFL')
                .range(start, end)
                .execute()
            )
            batch = resp.data or []
            if not batch:
                break
            for p in batch:
                if p.get('position') in self.positions:
                    result.append(p)
            if len(batch) < page_size:
                break
        if self.limit:
            result = result[:self.limit]
        self.logger.info(f"Loaded {len(result)} players for processing")
        return result

    def query_statmuse(self, query: str) -> Optional[str]:
        try:
            r = requests.post(f"{self.statmuse_url}/query", json={"query": query}, timeout=15)
            if r.status_code == 200:
                js = r.json()
                if js.get('success'):
                    return js.get('answer') or js.get('response', '')
            return None
        except Exception:
            return None

    def extract_number(self, answer: Optional[str], stat_name: str) -> float:
        if not answer:
            return 0.0
        txt = str(answer).lower()
        # Ranges
        ranges = {
            'passing_yards': (0, 700), 'passing_touchdowns': (0, 10), 'passing_completions': (0, 60), 'passing_attempts': (0, 80), 'passing_interceptions': (0, 7),
            'rushing_yards': (0, 300), 'rushing_touchdowns': (0, 6),
            'receptions': (0, 20), 'targets': (0, 30),
            'receiving_yards': (0, 300), 'receiving_touchdowns': (0, 6),
            'field_goals_made': (0, 10), 'field_goals_attempted': (0, 10), 'extra_points_made': (0, 10),
        }
        synonyms = {
            'passing_yards': ['passing yards','pass yards','yards passing'],
            'passing_touchdowns': ['passing touchdowns','pass tds','touchdown passes','td passes'],
            'passing_completions': ['completions','completed passes'],
            'passing_attempts': ['attempts','pass attempts'],
            'passing_interceptions': ['interceptions','ints','interception'],
            'rushing_yards': ['rushing yards','rush yards','yards rushing'],
            'rushing_touchdowns': ['rushing touchdowns','rush tds'],
            'receptions': ['receptions','catches'],
            'targets': ['targets'],
            'receiving_yards': ['receiving yards','rec yards','yards receiving'],
            'receiving_touchdowns': ['receiving touchdowns','rec tds'],
            'field_goals_made': ['field goals made','fg made'],
            'field_goals_attempted': ['field goal attempts','fg attempts'],
            'extra_points_made': ['extra points','xp made'],
        }
        lo, hi = ranges.get(stat_name, (0, 10000))
        # Specific labels
        for label in synonyms.get(stat_name, [stat_name.replace('_',' ')]):
            for pat in [rf"{re.escape(label)}\s*[:\-]?\s*(\d+(?:\.\d+)?)", rf"(\d+(?:\.\d+)?)\s*{re.escape(label)}"]:
                m = re.search(pat, txt)
                if m:
                    try:
                        v = float(m.group(1))
                        if lo <= v <= hi:
                            return v
                    except ValueError:
                        pass
        # Generic
        m = re.search(r"has\s+(\d+(?:\.\d+)?)", txt)
        if m:
            try:
                v = float(m.group(1))
                if lo <= v <= hi:
                    return v
            except ValueError:
                pass
        # Last resort first number
        m = re.search(r"(\d+(?:\.\d+)?)", txt)
        if m:
            try:
                v = float(m.group(1))
                if lo <= v <= hi:
                    return v
            except ValueError:
                pass
        return 0.0

    def build_base_stats(self, player: Dict[str, Any], season: int, week: int) -> Dict[str, Any]:
        return {
            'league': 'NFL', 'season': season, 'week': week, 'season_type': 'REG',
            'team': player.get('team',''), 'position': player.get('position',''),
            'fantasy_points': 0.0, 'fantasy_points_ppr': 0.0,
            'passing_attempts': 0.0, 'passing_completions': 0.0, 'passing_yards': 0.0, 'passing_touchdowns': 0.0, 'passing_interceptions': 0.0,
            'rushing_attempts': 0.0, 'rushing_yards': 0.0, 'rushing_touchdowns': 0.0,
            'receptions': 0.0, 'targets': 0.0, 'receiving_yards': 0.0, 'receiving_touchdowns': 0.0,
            'field_goals_made': 0.0, 'field_goals_attempted': 0.0, 'extra_points_made': 0.0,
            'rushing_fumbles': 0.0, 'receiving_fumbles': 0.0, 'rushing_fumbles_lost': 0.0, 'receiving_fumbles_lost': 0.0,
            'passing_first_downs': 0.0, 'rushing_first_downs': 0.0, 'receiving_first_downs': 0.0,
            'passing_2pt_conversions': 0.0, 'rushing_2pt_conversions': 0.0, 'receiving_2pt_conversions': 0.0,
            'sacks': 0.0, 'special_teams_tds': 0.0,
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

    def should_store(self, stats: Dict[str, Any], position: str) -> bool:
        if position == 'QB':
            keys = ['passing_attempts','passing_completions','passing_yards','passing_touchdowns','passing_interceptions']
        elif position in ('RB','WR','TE'):
            keys = ['receptions','targets','receiving_yards','receiving_touchdowns','rushing_attempts','rushing_yards','rushing_touchdowns']
        elif position == 'K':
            keys = ['field_goals_attempted','field_goals_made','extra_points_made']
        else:
            keys = ['passing_yards','rushing_yards','receiving_yards']
        return any(float(stats.get(k, 0)) > 0 for k in keys)

    def get_week_stats(self, player: Dict[str, Any], season: int, week: int) -> Dict[str, Any]:
        stats = self.build_base_stats(player, season, week)
        name = player.get('name','')
        pos = player.get('position','')
        qset = self.position_queries.get(pos, [])
        for stat_key, tmpl in qset:
            q = tmpl.format(player=name, week=week, season=season)
            ans = self.query_statmuse(q)
            val = self.extract_number(ans, stat_key)
            stats[stat_key] = val
            time.sleep(0.075)
        # Fallback all-in-one
        fallback = self.query_statmuse(f"{name} stats Week {week} {season}")
        if fallback:
            for stat_key, _ in qset:
                if float(stats.get(stat_key, 0)) <= 0:
                    v2 = self.extract_number(fallback, stat_key)
                    if v2 > 0:
                        stats[stat_key] = v2
        stats['fantasy_points'] = self.calc_fp(stats)
        stats['fantasy_points_ppr'] = round(stats['fantasy_points'] + stats.get('receptions', 0), 2)
        return stats

    def upsert_week(self, player_id: str, stats: Dict[str, Any]) -> Tuple[bool, str]:
        week = str(stats.get('week'))
        season = str(stats.get('season'))
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
            if str(st.get('season')) == season and str(st.get('week')) == week:
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
            if self.force:
                self.supabase.table('player_game_stats').update(payload).eq('id', target_id).execute()
                return True, 'updated'
            return False, 'skipped'
        else:
            self.supabase.table('player_game_stats').insert([payload]).execute()
            return True, 'inserted'

    def run(self) -> None:
        players = self.fetch_players()
        for idx, p in enumerate(players, start=1):
            name = p.get('name','')
            pos = p.get('position','')
            pid = p.get('id')
            if not pid:
                continue
            found = 0
            self.logger.info(f"[{idx}/{len(players)}] {name} ({pos}) — collecting last 10 games")
            for season, weeks in SEASONS_WEEKS:
                for wk in weeks:
                    try:
                        stats = self.get_week_stats(p, season, wk)
                        if not self.should_store(stats, pos):
                            self.total_skipped += 1
                            continue
                        ok, action = self.upsert_week(pid, stats)
                        if ok and action == 'inserted':
                            self.total_inserts += 1
                            found += 1
                        elif ok and action == 'updated':
                            self.total_updates += 1
                            found += 1  # counts toward last-10 coverage
                        else:
                            self.total_skipped += 1
                        if found >= 10:
                            break
                    except Exception as e:
                        self.total_failed += 1
                        continue
                    finally:
                        time.sleep(0.08)
                if found >= 10:
                    break
            self.processed_players += 1
            if self.processed_players % 10 == 0:
                self.logger.info(f"Progress: players {self.processed_players}/{len(players)} | inserts {self.total_inserts} | updates {self.total_updates} | skipped {self.total_skipped}")
        self.logger.info("Last-10 backfill complete!")
        self.logger.info(f"Players processed: {self.processed_players}")
        self.logger.info(f"Inserted: {self.total_inserts}")
        self.logger.info(f"Updated: {self.total_updates}")
        self.logger.info(f"Skipped: {self.total_skipped}")
        self.logger.info(f"Failed: {self.total_failed}")


def main():
    print("\n🏈 NFL Last-10 Backfill (StatMuse)")
    print("=" * 60)
    print("Populating last-10 game logs for offensive players (2025 W2→W1, then 2024 W18→W1)")
    print(f"Run at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    parser = argparse.ArgumentParser(description='NFL Last-10 backfill via StatMuse')
    parser.add_argument('--positions', type=str, help='Comma-separated positions (QB,RB,WR,TE,K)')
    parser.add_argument('--limit', type=int, help='Max players to process')
    parser.add_argument('--force', action='store_true', help='Update existing rows if present')
    args = parser.parse_args()

    positions = DEFAULT_POSITIONS
    if args.positions:
        positions = [p.strip().upper() for p in args.positions.split(',') if p.strip()]

    force = bool(args.force)
    limit = args.limit

    try:
        job = Last10Backfill(positions=positions, limit=limit, force=force)
        job.run()
        print("\n✅ Last-10 backfill completed!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()

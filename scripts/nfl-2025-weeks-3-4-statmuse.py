#!/usr/bin/env python3
"""
NFL 2025 Weeks 3 & 4 Offensive Game Logs via StatMuse
Extends the Week 1-2 refresh script to support Weeks 3 & 4.
- Uses your custom StatMuse server with position-specific week prompts
- Resolves event_id from sports_events (required for NFL constraint)
- Avoids writing zero-only rows (likely no game / no data) to keep accuracy high
- Writes to player_game_stats with season=2025 and week in {3,4}
"""

import os
import sys
import logging
import re
import time
import argparse
from datetime import datetime, timezone, timedelta
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
WEEKS = [1, 2, 3, 4]  # Updated to cover all weeks through Week 4
OFFENSIVE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K']

# NFL team abbreviation to full name mapping (for event_id resolution)
NFL_TEAM_MAP = {
    'ARI': 'Arizona Cardinals',
    'ATL': 'Atlanta Falcons',
    'BAL': 'Baltimore Ravens',
    'BUF': 'Buffalo Bills',
    'CAR': 'Carolina Panthers',
    'CHI': 'Chicago Bears',
    'CIN': 'Cincinnati Bengals',
    'CLE': 'Cleveland Browns',
    'DAL': 'Dallas Cowboys',
    'DEN': 'Denver Broncos',
    'DET': 'Detroit Lions',
    'GB': 'Green Bay Packers',
    'HOU': 'Houston Texans',
    'IND': 'Indianapolis Colts',
    'JAX': 'Jacksonville Jaguars',
    'KC': 'Kansas City Chiefs',
    'LAC': 'Los Angeles Chargers',
    'LAR': 'Los Angeles Rams',
    'LV': 'Las Vegas Raiders',
    'MIA': 'Miami Dolphins',
    'MIN': 'Minnesota Vikings',
    'NE': 'New England Patriots',
    'NO': 'New Orleans Saints',
    'NYG': 'New York Giants',
    'NYJ': 'New York Jets',
    'PHI': 'Philadelphia Eagles',
    'PIT': 'Pittsburgh Steelers',
    'SEA': 'Seattle Seahawks',
    'SF': 'San Francisco 49ers',
    'TB': 'Tampa Bay Buccaneers',
    'TEN': 'Tennessee Titans',
    'WAS': 'Washington Commanders',
}

class NFL2025Weeks34Refresh:
    def __init__(self):
        self.supabase: Client = self._init_supabase()
        self.logger = self._setup_logger()
        self.statmuse_url = os.getenv("STATMUSE_API_URL", "https://web-production-f090e.up.railway.app")
        self.processed = 0
        self.inserted = 0
        self.updated = 0
        self.skipped = 0
        self.failed = 0
        # Optional targeting configured by CLI
        self.target_names: Set[str] = set()  # normalized lower-case full names
        self.target_weeks: List[int] = []
        self.force: bool = False
        
        # Event index for event_id resolution
        self.event_index: Dict[str, str] = {}  # key: "team1|team2|date" -> event_id

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
                logging.FileHandler('nfl_2025_weeks_3_4_statmuse.log'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        return logging.getLogger(__name__)

    def build_event_index(self) -> None:
        """Build an index of sports_events for fast event_id lookup by team + date"""
        self.logger.info("Building event_id index from sports_events...")
        try:
            resp = (
                self.supabase
                .table('sports_events')
                .select('id, home_team, away_team, start_time')
                .eq('sport_key', 'americanfootball_nfl')
                .execute()
            )
            for evt in (resp.data or []):
                evt_id = evt.get('id')
                home = evt.get('home_team', '').strip()
                away = evt.get('away_team', '').strip()
                start = evt.get('start_time', '')
                if not evt_id or not home or not away or not start:
                    continue
                # Parse date (YYYY-MM-DD)
                try:
                    dt = datetime.fromisoformat(start.replace('Z', '+00:00'))
                    date_key = dt.date().isoformat()
                except:
                    continue
                # Store both team orderings
                key1 = f"{home.lower()}|{away.lower()}|{date_key}"
                key2 = f"{away.lower()}|{home.lower()}|{date_key}"
                self.event_index[key1] = evt_id
                self.event_index[key2] = evt_id
            self.logger.info(f"Event index built: {len(self.event_index)} keys from {len(resp.data or [])} events")
        except Exception as e:
            self.logger.error(f"Failed to build event index: {e}")

    def resolve_event_id(self, player_team_abbrev: str, week: int) -> Optional[str]:
        """
        Resolve event_id for a player's team in a given week.
        Uses sports_events index and approximate date matching.
        """
        # Approximate game date for the week (2025 season started ~Sep 5)
        # Week 1 ~Sep 5-9, Week 2 ~Sep 12-16, Week 3 ~Sep 19-23, Week 4 ~Sep 26-30
        season_start = datetime(2025, 9, 5, tzinfo=timezone.utc)
        approx_date = season_start + timedelta(days=(week - 1) * 7)
        
        # Try ±3 days around the approximate date
        team_full = NFL_TEAM_MAP.get(player_team_abbrev, player_team_abbrev)
        for offset in range(-3, 4):
            check_date = (approx_date + timedelta(days=offset)).date().isoformat()
            # Try matching as home or away
            for other_team in NFL_TEAM_MAP.values():
                if other_team == team_full:
                    continue
                key = f"{team_full.lower()}|{other_team.lower()}|{check_date}"
                if key in self.event_index:
                    return self.event_index[key]
        return None

    def fetch_offensive_players(self, page_size: int = 1000, max_pages: int = 20) -> List[Dict[str, Any]]:
        self.logger.info("Loading NFL offensive players from players table (paginated)...")
        all_players: List[Dict[str, Any]] = []
        for i in range(max_pages):
            start = i * page_size
            end = start + page_size - 1
            resp = (
                self.supabase
                .table('players')
                .select('*')
                .eq('sport', 'NFL')
                .range(start, end)
                .execute()
            )
            batch = resp.data or []
            all_players.extend(batch)
            if len(batch) < page_size:
                break
        filtered = [p for p in all_players if p.get('position') in OFFENSIVE_POSITIONS]
        self.logger.info(f"Loaded {len(all_players)} players; offense-only = {len(filtered)}")
        return filtered

    def fetch_players_by_names(self, names: Set[str]) -> List[Dict[str, Any]]:
        """Fetch players by exact name match (case-insensitive) using ILIKE, offense-only."""
        results: Dict[str, Dict[str, Any]] = {}
        for name in names:
            resp = (
                self.supabase
                .table('players')
                .select('*')
                .eq('sport', 'NFL')
                .filter('name', 'ilike', f"%{name}%")
                .range(0, 200)
                .execute()
            )
            for p in (resp.data or []):
                if p.get('position') in OFFENSIVE_POSITIONS:
                    results[p.get('id')] = p
            if not resp.data:
                exact = (
                    self.supabase
                    .table('players')
                    .select('*')
                    .eq('sport', 'NFL')
                    .eq('name', name.title())
                    .range(0, 50)
                    .execute()
                )
                for p in (exact.data or []):
                    if p.get('position') in OFFENSIVE_POSITIONS:
                        results[p.get('id')] = p
        self.logger.info(f"fetch_players_by_names matched {len(results)} offensive players for targets: {', '.join(names)}")
        return list(results.values())

    def fetch_existing_player_weeks(self, season: int, weeks: List[int]) -> Set[Tuple[str, str]]:
        self.logger.info(f"Fetching existing player-week keys for {season} weeks {weeks}...")
        keys: Set[Tuple[str, str]] = set()
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
        self.logger.info(f"Found {len(keys)} existing {season} week {weeks} records")
        return keys

    def query_statmuse(self, query: str) -> Optional[str]:
        try:
            r = requests.post(f"{self.statmuse_url}/query", json={"query": query}, timeout=15)
            if r.status_code == 200:
                js = r.json()
                if js.get('success'):
                    ans = js.get('answer')
                    if not ans:
                        ans = js.get('response', '')
                    return ans
            return None
        except Exception:
            return None

    def extract_number(self, answer: Optional[str], stat_name: str) -> float:
        """Extract a numeric value for a given stat from a free-form answer string."""
        if not answer:
            return 0.0
        txt = answer.lower()

        ranges = {
            'passing_yards': (0, 700),
            'passing_touchdowns': (0, 10),
            'passing_completions': (0, 60),
            'passing_attempts': (0, 80),
            'passing_interceptions': (0, 7),
            'rushing_yards': (0, 300),
            'rushing_touchdowns': (0, 6),
            'receptions': (0, 20),
            'targets': (0, 30),
            'receiving_yards': (0, 300),
            'receiving_touchdowns': (0, 6),
            'field_goals_made': (0, 10),
            'field_goals_attempted': (0, 10),
            'extra_points_made': (0, 10),
        }

        synonyms = {
            'passing_yards': ['passing yards', 'pass yards', 'yards passing'],
            'passing_touchdowns': ['passing touchdowns', 'pass tds', 'touchdown passes', 'td passes'],
            'passing_completions': ['completions', 'completed passes'],
            'passing_attempts': ['attempts', 'pass attempts'],
            'passing_interceptions': ['interceptions', 'ints', 'interception'],
            'rushing_yards': ['rushing yards', 'rush yards', 'yards rushing'],
            'rushing_touchdowns': ['rushing touchdowns', 'rush tds'],
            'receptions': ['receptions', 'catches'],
            'targets': ['targets'],
            'receiving_yards': ['receiving yards', 'rec yards', 'yards receiving'],
            'receiving_touchdowns': ['receiving touchdowns', 'rec tds'],
            'field_goals_made': ['field goals made', 'fg made'],
            'field_goals_attempted': ['field goal attempts', 'fg attempts'],
            'extra_points_made': ['extra points', 'xp made'],
        }

        def in_range(val: float, key: str) -> bool:
            lo, hi = ranges.get(key, (0, 10000))
            return lo <= val <= hi

        # Try stat-specific labelled patterns first
        for label in synonyms.get(stat_name, [stat_name.replace('_', ' ')]):
            pats = [
                rf"{re.escape(label)}\s*[:\-]?\s*(\d+(?:\.\d+)?)",
                rf"(\d+(?:\.\d+)?)\s*{re.escape(label)}",
            ]
            for pat in pats:
                m = re.search(pat, txt)
                if m:
                    try:
                        v = float(m.group(1))
                        if in_range(v, stat_name):
                            return v
                    except ValueError:
                        pass

        # Try generic patterns
        pats_generic = [r"has\s+(\d+(?:\.\d+)?)"]
        for pat in pats_generic:
            m = re.search(pat, txt)
            if m:
                try:
                    v = float(m.group(1))
                    if in_range(v, stat_name):
                        return v
                except ValueError:
                    pass

        # Last resort: first number that fits range
        m = re.search(r"(\d+(?:\.\d+)?)", txt)
        if m:
            try:
                v = float(m.group(1))
                if in_range(v, stat_name):
                    return v
            except ValueError:
                pass
        return 0.0

    def build_base_stats(self, player: Dict[str, Any], week: int) -> Dict[str, Any]:
        return {
            'league': 'NFL',
            'season': SEASON,
            'week': week,
            'season_type': 'REG',
            'team': player.get('team', ''),
            'position': player.get('position', ''),
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
        # Fallback: ask for overall stats line once
        fallback = self.query_statmuse(f"{name} stats Week {week} {SEASON}")
        if fallback:
            for stat_key, _ in qset:
                if float(stats.get(stat_key, 0)) <= 0:
                    v2 = self.extract_number(fallback, stat_key)
                    if v2 > 0:
                        stats[stat_key] = v2
        stats['fantasy_points'] = self.calc_fp(stats)
        stats['fantasy_points_ppr'] = self.calc_fp_ppr(stats)
        return stats

    def upsert_player_week(self, player_id: str, stats: Dict[str, Any], event_id: Optional[str]) -> None:
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
            'event_id': event_id,  # CRITICAL: set event_id for NFL
            'stats': stats,
            'fantasy_points': stats.get('fantasy_points', 0.0),
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
        self.logger.info(f"Starting NFL {SEASON} Weeks {WEEKS} offensive refresh via StatMuse...")
        
        # Build event index first
        self.build_event_index()
        
        if self.target_names:
            players = self.fetch_players_by_names(self.target_names)
        else:
            players = self.fetch_offensive_players()

        weeks = self.target_weeks if self.target_weeks else WEEKS
        existing_keys = self.fetch_existing_player_weeks(SEASON, weeks)
        target_pairs: List[Tuple[Dict[str, Any], int]] = []
        force = bool(self.target_names) or self.force
        for p in players:
            pid = p.get('id')
            if not pid:
                continue
            for wk in weeks:
                if force or (pid, str(wk)) not in existing_keys:
                    target_pairs.append((p, wk))
        self.logger.info(f"Missing player-week records to backfill: {len(target_pairs)}")

        for idx, (player, week) in enumerate(target_pairs, start=1):
            try:
                self.processed += 1
                name = player.get('name', '')
                pos = player.get('position', '')
                team = player.get('team', '')
                self.logger.info(f"[{idx}/{len(target_pairs)}] {name} ({pos}, {team}) - Week {week}")
                
                # Resolve event_id
                event_id = self.resolve_event_id(team, week)
                if not event_id:
                    self.logger.warning(f"Could not resolve event_id for {name} ({team}) Week {week}, skipping")
                    self.skipped += 1
                    continue
                
                stats = self.get_player_week_stats(player, week)
                if self.should_store(stats, pos):
                    self.upsert_player_week(player.get('id'), stats, event_id)
                    self.logger.info(f"✅ {name} Week {week}: {stats.get('fantasy_points', 0)} pts (event: {event_id[:8]}...)")
                else:
                    self.skipped += 1
                if self.processed % 25 == 0:
                    self.logger.info(f"Progress: processed {self.processed} | inserted {self.inserted} | updated {self.updated} | skipped {self.skipped}")
            except Exception as e:
                self.failed += 1
                self.logger.error(f"Failed for {player.get('name','?')} week {week}: {e}")
            time.sleep(0.1)

        self.logger.info("Refresh complete!")
        self.logger.info(f"Processed: {self.processed}")
        self.logger.info(f"Inserted: {self.inserted}")
        self.logger.info(f"Updated: {self.updated}")
        self.logger.info(f"Skipped (zero-only or no event): {self.skipped}")
        self.logger.info(f"Failed: {self.failed}")


def main():
    print("\n🏈 NFL 2025 Weeks 3 & 4 Offensive Refresh (StatMuse)")
    print("=" * 60)
    print("Backfilling accurate per-game stats for offensive players (Weeks 3-4)")
    print(f"Run at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    try:
        parser = argparse.ArgumentParser(description='NFL 2025 Weeks 3-4 Offensive Refresh via StatMuse')
        parser.add_argument('--names', type=str, help='Comma-separated list of exact player names to target (case-insensitive)')
        parser.add_argument('--weeks', type=str, help='Comma-separated list of weeks to process (e.g., 3,4)')
        parser.add_argument('--force', action='store_true', help='Force update even if a Week 3/4 row already exists')
        args = parser.parse_args()

        r = NFL2025Weeks34Refresh()
        if args.names:
            r.target_names = {n.strip().lower() for n in args.names.split(',') if n.strip()}
        if args.weeks:
            try:
                r.target_weeks = [int(w.strip()) for w in args.weeks.split(',') if w.strip()]
            except ValueError:
                r.target_weeks = []
        if args.force:
            r.force = True
        r.run()
        print("\n✅ Refresh completed!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()

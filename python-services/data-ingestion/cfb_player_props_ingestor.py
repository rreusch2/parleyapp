#!/usr/bin/env python3
"""
CFB Player Props Ingestor (TheOdds API) -> player_props_odds

- Discovers current NCAAF events from TheOdds API
- For each event, fetches available player prop markets and odds
- Links each prop to sports_events (by matching home/away + date). If not found, anchors a new sports_event with external_event_id = 'theodds:{event_id}'
- Ensures player_prop_types and bookmakers exist
- De-duplicates via DB unique constraint ON CONFLICT (event_id, player_id, prop_type_id, bookmaker_id)

Run:
  python python-services/data-ingestion/cfb_player_props_ingestor.py

Requires env (.env): THEODDS_API_KEY, DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT
"""

import os
import sys
import json
import logging
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

# Load environment variables from project root .env
if load_dotenv:
    from pathlib import Path
    ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
    load_dotenv(dotenv_path=str(ENV_PATH), override=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

SPORT_KEY = 'americanfootball_ncaaf'
SPORT_NAME = 'AMERICANFOOTBALL_NCAAF'

class CFBPropsIngestor:
    def __init__(self):
        self.api_key = os.getenv('THEODDS_API_KEY')
        if not self.api_key:
            raise ValueError('THEODDS_API_KEY not found in environment variables')
        self.base_url = 'https://api.the-odds-api.com/v4'
        self.db = {
            'host': os.getenv('DB_HOST'),
            'database': os.getenv('DB_NAME'),
            'user': os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD'),
            'port': int(os.getenv('DB_PORT', 5432)),
        }
        # Common US books
        self.bookmakers = ['fanduel', 'draftkings', 'betmgm', 'caesars']

    def conn(self):
        return psycopg2.connect(**self.db)

    # ---------- Helpers ----------
    @staticmethod
    def normalize_name(s: str) -> str:
        import unicodedata
        s = (s or '').lower()
        s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii')
        allowed = set('abcdefghijklmnopqrstuvwxyz 0123456789')
        s = ''.join(ch if ch in allowed else ' ' for ch in s)
        stop = {'university', 'college', 'the'}
        toks = [t for t in s.split() if t and t not in stop]
        return ' '.join(toks)

    def ensure_prop_type(self, cur, prop_key: str) -> str:
        # Return id for prop_key, insert if missing
        cur.execute("SELECT id FROM player_prop_types WHERE prop_key=%s", (prop_key,))
        row = cur.fetchone()
        if row:
            return row['id']
        # Create a readable name
        name = prop_key.replace('_', ' ').title()
        cur.execute(
            """
            INSERT INTO player_prop_types (prop_key, prop_name, sport_key, stat_category)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (prop_key, name, SPORT_KEY, None),
        )
        return cur.fetchone()['id']

    def ensure_bookmakers(self, cur):
        data = [
            ('fanduel', 'FanDuel'),
            ('draftkings', 'DraftKings'),
            ('betmgm', 'BetMGM'),
            ('caesars', 'Caesars'),
        ]
        for key, name in data:
            cur.execute(
                """
                INSERT INTO bookmakers (bookmaker_key, bookmaker_name, is_active)
                VALUES (%s, %s, true)
                ON CONFLICT (bookmaker_key) DO NOTHING
                """,
                (key, name),
            )

    def get_or_create_player(self, cur, player_name: str, team_name: str) -> Optional[str]:
        # Find by name+team+sport first
        cur.execute(
            """
            SELECT id FROM players
            WHERE (name ILIKE %s OR player_name ILIKE %s)
              AND (team ILIKE %s OR team_id IN (SELECT id FROM teams WHERE team_name ILIKE %s))
              AND (sport = %s OR sport_key = %s)
            LIMIT 1
            """,
            (player_name, player_name, team_name, team_name, SPORT_NAME, SPORT_KEY),
        )
        row = cur.fetchone()
        if row:
            return row['id']

        # create with minimal fields
        external_id = f"{SPORT_KEY}_{player_name.replace(' ', '_')}"
        player_key = f"{SPORT_KEY}_{player_name.replace(' ', '_').lower()}"
        cur.execute(
            """
            INSERT INTO players (external_player_id, name, player_name, team, sport, sport_key, player_key, active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, true)
            ON CONFLICT (external_player_id) DO UPDATE SET name=EXCLUDED.name, team=EXCLUDED.team, active=true
            RETURNING id
            """,
            (external_id, player_name, player_name, team_name, SPORT_NAME, SPORT_KEY, player_key),
        )
        return cur.fetchone()['id']

    def find_or_create_event(self, cur, home_team: str, away_team: str, start_iso: str, theodds_id: str) -> Optional[str]:
        # Try match existing ESPN-anchored sports_events by normalized names + date
        dt = datetime.fromisoformat(start_iso.replace('Z', '+00:00'))
        date_only = dt.date()
        cur.execute(
            """
            SELECT id, home_team, away_team FROM sports_events
            WHERE sport_key = %s AND DATE(start_time) = %s
            """,
            (SPORT_KEY, date_only),
        )
        home_n = self.normalize_name(home_team)
        away_n = self.normalize_name(away_team)
        for row in cur.fetchall():
            if self.normalize_name(row['home_team']) == home_n and self.normalize_name(row['away_team']) == away_n:
                return row['id']
        # Not found; anchor a new event with TheOdds external id
        # Attempt to resolve team ids
        cur.execute("SELECT id, team_name FROM teams WHERE sport_key=%s", (SPORT_KEY,))
        teams = cur.fetchall()
        def match_team_id(name: str) -> Optional[str]:
            nn = self.normalize_name(name)
            for t in teams:
                if self.normalize_name(t['team_name']) == nn:
                    return t['id']
            return None
        home_id = match_team_id(home_team)
        away_id = match_team_id(away_team)
        cur.execute(
            """
            INSERT INTO sports_events (
                sport, league, home_team, away_team, start_time, status,
                external_event_id, source, sport_key, home_team_id, away_team_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (external_event_id) DO UPDATE SET start_time=EXCLUDED.start_time, status=EXCLUDED.status
            RETURNING id
            """,
            (
                'Football', 'NCAAF', home_team, away_team, start_iso, 'scheduled',
                f'theodds:{theodds_id}', 'theodds', SPORT_KEY, home_id, away_id,
            ),
        )
        return cur.fetchone()['id']

    def fetch_events(self) -> List[Dict[str, Any]]:
        url = f"{self.base_url}/sports/{SPORT_KEY}/odds"
        params = {
            'apiKey': self.api_key,
            'regions': 'us',
            'markets': 'h2h',
            'oddsFormat': 'american',
        }
        r = requests.get(url, params=params, timeout=30)
        r.raise_for_status()
        return r.json()

    def fetch_props_for_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/sports/{SPORT_KEY}/events/{event_id}/odds"
        params = {
            'apiKey': self.api_key,
            'regions': 'us',
            'oddsFormat': 'american',
        }
        r = requests.get(url, params=params, timeout=30)
        if r.status_code != 200:
            logger.warning(f"  ❌ Event {event_id} props HTTP {r.status_code}")
            return None
        data = r.json()
        if not data or 'bookmakers' not in data:
            return None
        return data

    def run(self):
        logger.info('🚀 Starting CFB Player Props Ingestion...')
        with self.conn() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Ensure reference data
                self.ensure_bookmakers(cur)
                conn.commit()

                events = self.fetch_events()
                logger.info(f"📋 Found {len(events)} NCAAF events with H2H odds")

                total_rows = 0
                for ev in events:
                    home = ev.get('home_team')
                    away = ev.get('away_team')
                    commence = ev.get('commence_time')
                    eid = ev.get('id')
                    if not (home and away and commence and eid):
                        continue
                    logger.info(f"🎯 {away} @ {home}")

                    # Fetch all props for the event
                    data = self.fetch_props_for_event(eid)
                    if not data:
                        continue

                    # Anchor/find sports_event id
                    event_id = self.find_or_create_event(cur, home, away, commence, eid)
                    if not event_id:
                        logger.warning(f"  ⚠️ Could not anchor sports_event for {away} @ {home}")
                        continue

                    # Build bookmaker and prop type lookups
                    cur.execute("SELECT id, bookmaker_key FROM bookmakers")
                    bm_lookup = {row['bookmaker_key']: row['id'] for row in cur.fetchall()}

                    # Iterate bookmakers/markets/outcomes
                    for bm in data.get('bookmakers', []):
                        bm_key = bm.get('key')
                        bm_id = bm_lookup.get(bm_key)
                        if not bm_id:
                            continue
                        for mkt in bm.get('markets', []):
                            mkey = mkt.get('key')
                            if not mkey:
                                continue
                            # Only consider markets that look like player markets
                            if not any(tok in mkey for tok in ['player', 'pass', 'rush', 'rec', 'td']):
                                continue
                            prop_type_id = self.ensure_prop_type(cur, mkey)

                            # Group outcomes by player name
                            grouped: Dict[str, Dict[str, Any]] = {}
                            for out in mkt.get('outcomes', []):
                                player_name = (out.get('description') or '').strip()
                                if not player_name:
                                    continue
                                over_under = out.get('name')  # 'Over' or 'Under'
                                line = out.get('point')
                                price = out.get('price')
                                if player_name not in grouped:
                                    grouped[player_name] = {'line': line, 'over_odds': None, 'under_odds': None}
                                if over_under == 'Over':
                                    grouped[player_name]['over_odds'] = price
                                elif over_under == 'Under':
                                    grouped[player_name]['under_odds'] = price
                                if grouped[player_name]['line'] in (None, 0) and line is not None:
                                    grouped[player_name]['line'] = line

                            # Upsert odds rows
                            for player_name, od in grouped.items():
                                # Try both teams for player lookup
                                player_id = self.get_or_create_player(cur, player_name, home) or self.get_or_create_player(cur, player_name, away)
                                if not player_id:
                                    logger.warning(f"  ⚠️ No player_id for {player_name}")
                                    continue
                                cur.execute(
                                    """
                                    INSERT INTO player_props_odds (
                                        event_id, player_id, prop_type_id, bookmaker_id, line, over_odds, under_odds, last_update
                                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                                    ON CONFLICT (event_id, player_id, prop_type_id, bookmaker_id)
                                    DO UPDATE SET line=EXCLUDED.line, over_odds=EXCLUDED.over_odds, under_odds=EXCLUDED.under_odds, last_update=EXCLUDED.last_update
                                    """,
                                    (event_id, player_id, prop_type_id, bm_id, od['line'], od['over_odds'], od['under_odds'], datetime.now(timezone.utc)),
                                )
                                total_rows += 1
                    conn.commit()
                logger.info(f"🎉 Done. Upserted {total_rows} player prop odds rows.")

if __name__ == '__main__':
    try:
        CFBPropsIngestor().run()
    except Exception as e:
        logger.error(f"❌ CFB props ingestion failed: {e}")
        sys.exit(1)

import os
import json
import logging
import argparse
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI
import asyncio

# Load env from backend/.env to reuse existing settings
load_dotenv("backend/.env")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("props_enhanced_v2")

@dataclass
class FlatProp:
    event_id: str
    sport: str
    player_name: str
    stat_key: str
    prop_label: str
    line: float
    bookmaker: str
    over_odds: Optional[int]
    under_odds: Optional[int]
    is_alt: bool
    player_headshot_url: Optional[str]


def display_name_for_stat(stat_key: str) -> str:
    key = (stat_key or '').lower()
    mlb = {
        'batter_hits': 'Batter Hits O/U',
        'batter_total_bases': 'Batter Total Bases O/U',
        'batter_home_runs': 'Batter Home Runs O/U',
        'batter_rbis': 'Batter RBIs O/U',
        'batter_runs_scored': 'Batter Runs Scored O/U',
        'batter_stolen_bases': 'Batter Stolen Bases O/U',
        'batter_strikeouts': 'Batter Strikeouts O/U',
        'batter_walks': 'Batter Walks O/U',
        'pitcher_strikeouts': 'Pitcher Strikeouts O/U',
        'pitcher_hits_allowed': 'Pitcher Hits Allowed O/U',
        'pitcher_walks': 'Pitcher Walks O/U',
        'pitcher_earned_runs': 'Pitcher Earned Runs O/U',
        'pitcher_outs': 'Pitcher Outs O/U',
    }
    nba = {
        'player_points': 'Points O/U',
        'player_rebounds': 'Rebounds O/U',
        'player_assists': 'Assists O/U',
        'player_threes': '3-Pointers Made O/U',
        'player_blocks': 'Blocks O/U',
        'player_steals': 'Steals O/U',
        'player_turnovers': 'Turnovers O/U',
        'player_points_rebounds_assists': 'Pts+Reb+Ast O/U',
        'player_points_rebounds': 'Pts+Reb O/U',
        'player_points_assists': 'Pts+Ast O/U',
        'player_rebounds_assists': 'Reb+Ast O/U',
        'player_double_double': 'Double-Double (Yes/No)',
        'player_triple_double': 'Triple-Double (Yes/No)',
    }
    nfl_cfb = {
        'player_pass_yds': 'Pass Yards O/U',
        'player_pass_tds': 'Pass TDs O/U',
        'player_rush_yds': 'Rush Yards O/U',
        'player_rush_tds': 'Rush TDs O/U',
        'player_receptions': 'Receptions O/U',
        'player_reception_yds': 'Receiving Yards O/U',
        'player_reception_tds': 'Receiving TDs O/U',
        'player_rush_attempts': 'Rush Attempts O/U',
        'player_sacks': 'Sacks O/U',
        'player_tackles_assists': 'Tackles + Assists O/U',
        'player_anytime_td': 'Anytime TD (Yes/No)',
        'player_1st_td': 'First TD Scorer (Yes/No)',
        'player_last_td': 'Last TD Scorer (Yes/No)',
        'player_field_goals': 'Field Goals O/U',
        'player_kicking_points': 'Kicking Points O/U',
    }
    nhl = {
        'player_points': 'Points O/U',
        'player_goals': 'Goals O/U',
        'player_assists': 'Assists O/U',
        'player_shots_on_goal': 'Shots on Goal O/U',
        'player_total_saves': 'Total Saves O/U',
    }
    for m in (mlb, nba, nfl_cfb, nhl):
        if key in m:
            return m[key]
    pretty = key.replace('_', ' ').title()
    return pretty or stat_key


class DB:
    def __init__(self) -> None:
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        if not url or not key:
            raise RuntimeError('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
        self.client: Client = create_client(url, key)

    def get_games_for_date(self, target_date: datetime.date, sport_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        # Simple UTC window for the date
        start_dt = datetime.combine(target_date, datetime.min.time())
        end_dt = datetime.combine(target_date, datetime.max.time())
        start_iso = start_dt.isoformat()
        end_iso = end_dt.isoformat()
        sports = []
        if sport_filter:
            sports = [sport_filter]
        else:
            sports = [
                'Major League Baseball',
                "Women's National Basketball Association",
                'National Football League',
                'College Football',
                'National Hockey League',
                'National Basketball Association',
            ]
        all_games: List[Dict[str, Any]] = []
        for s in sports:
            resp = self.client.table('sports_events').select(
                'id, home_team, away_team, start_time, sport'
            ).gte('start_time', start_iso).lte('start_time', end_iso).eq('sport', s).order('start_time').execute()
            if resp.data:
                all_games.extend(resp.data)
        all_games.sort(key=lambda g: g['start_time'])
        return all_games

    def get_flat_props_for_games(self, game_ids: List[str]) -> List[FlatProp]:
        if not game_ids:
            return []
        # Use pre-filtered view to restrict odds to [-300, +300]
        sel = 'event_id, sport, stat_type, line, bookmaker, over_odds, under_odds, is_alt, player_name, player_headshot_url'
        view_used = 'player_props_v2_flat_quick_fast'
        try:
            # Fast path: materialized-view-backed endpoint if available
            resp = self.client.table(view_used).select(sel).in_('event_id', game_ids).execute()
        except Exception:
            # Fallback to lightweight view-only version
            view_used = 'player_props_v2_flat_quick_filtered'
            resp = self.client.table(view_used).select(sel).in_('event_id', game_ids).execute()
        rows = resp.data or []
        logger.info(f"Fetched {len(rows)} props from {view_used}")
        props: List[FlatProp] = []
        for r in rows:
            try:
                props.append(
                    FlatProp(
                        event_id=r['event_id'],
                        sport=(r.get('sport') or '').upper(),
                        player_name=r.get('player_name') or 'Unknown',
                        stat_key=r.get('stat_type') or '',
                        prop_label=display_name_for_stat(r.get('stat_type') or ''),
                        line=float(r.get('line') or 0.0),
                        bookmaker=r.get('bookmaker') or '',
                        over_odds=int(r['over_odds']) if r.get('over_odds') is not None else None,
                        under_odds=int(r['under_odds']) if r.get('under_odds') is not None else None,
                        is_alt=bool(r.get('is_alt')),
                        player_headshot_url=r.get('player_headshot_url')
                    )
                )
            except Exception:
                continue
        return props

    def get_bookmaker_logos(self) -> Dict[str, Dict[str, str]]:
        resp = self.client.table('bookmaker_logos').select('*').execute()
        logos: Dict[str, Dict[str, str]] = {}
        for r in (resp.data or []):
            logos[str(r['bookmaker_key']).lower()] = {
                'name': r.get('bookmaker_name') or '',
                'logo_url': r.get('logo_url') or ''
            }
        return logos

    def get_league_logos(self) -> Dict[str, Dict[str, str]]:
        resp = self.client.table('league_logos').select('*').execute()
        logos: Dict[str, Dict[str, str]] = {}
        for r in (resp.data or []):
            logos[str(r['league_key']).upper()] = {
                'name': r.get('league_name') or '',
                'logo_url': r.get('logo_url') or ''
            }
        return logos

    def store_predictions(self, picks: List[Dict[str, Any]], event_map: Dict[str, Dict[str, Any]]) -> None:
        for p in picks:
            event = event_map.get(str(p.get('event_id')))
            game_info = None
            sport = p.get('sport', 'MLB')
            if event:
                game_info = f"{event.get('away_team','Unknown')} @ {event.get('home_team','Unknown')}"
                sport = self._abbr_sport(event.get('sport', sport))
            # Build ai_predictions row
            metadata = p.pop('metadata', {})
            row = {
                'user_id': 'c19a5e12-4297-4b0f-8d21-39d2bb1a2c08',
                'confidence': p.get('confidence', 0),
                'pick': p.get('pick', ''),
                'odds': str(p.get('odds', 0)),
                'sport': sport,
                'event_time': event.get('start_time') if event else None,
                'bet_type': 'player_prop',
                'game_id': str(p.get('event_id', '')),
                'match_teams': game_info,
                'reasoning': p.get('reasoning', ''),
                'line_value': p.get('line', 0),
                'prediction_value': p.get('prediction_value'),
                'prop_market_type': p.get('prop_type', ''),
                'roi_estimate': p.get('roi_estimate', 0.0),
                'value_percentage': p.get('value_percentage', 0.0),
                'kelly_stake': p.get('kelly_stake', 0.0),
                'expected_value': p.get('expected_value', 0.0),
                'risk_level': p.get('risk_level', 'Medium'),
                'implied_probability': p.get('implied_probability', 50.0),
                'fair_odds': p.get('fair_odds', p.get('odds', 0)),
                'key_factors': p.get('key_factors', []),
                'status': 'pending',
                'metadata': metadata,
            }
            # Remove None values
            row = {k: v for k, v in row.items() if v is not None}
            self.client.table('ai_predictions').insert(row).execute()
        logger.info(f"Stored {len(picks)} predictions to ai_predictions")

    @staticmethod
    def _abbr_sport(full: str) -> str:
        m = {
            'Major League Baseball': 'MLB',
            "Women's National Basketball Association": 'WNBA',
            'National Football League': 'NFL',
            'College Football': 'CFB',
            'National Hockey League': 'NHL',
            'National Basketball Association': 'NBA',
        }
        return m.get(full, full)


class Agent:
    def __init__(self) -> None:
        self.db = DB()
        self.llm = AsyncOpenAI(api_key=os.getenv('XAI_API_KEY'), base_url='https://api.x.ai/v1')

    async def run(self, target_date: datetime.date, picks_target: int, sport_filter: Optional[str]) -> None:
        games = self.db.get_games_for_date(target_date, sport_filter)
        if not games:
            logger.warning(f"No games found for {target_date}")
            return
        event_ids = [g['id'] for g in games]
        props = self.db.get_flat_props_for_games(event_ids)
        if not props:
            logger.warning("No props found from quick views; aborting")
            return
        # Limit prompt size: take top N per game/player/market random or ordered
        # Here we just pass through; DB already filtered odds.
        # Build prompt data
        games_map = {str(g['id']): g for g in games}
        logos = self.db.get_bookmaker_logos()
        league_logos = self.db.get_league_logos()

        props_payload = []
        for pr in props[:1000]:  # safety cap
            props_payload.append({
                'event_id': pr.event_id,
                'sport': pr.sport,
                'player': pr.player_name,
                'prop_type': pr.prop_label,
                'stat_key': pr.stat_key,
                'line': pr.line,
                'bookmaker': pr.bookmaker,
                'bookmaker_logo_url': logos.get(pr.bookmaker.lower(), {}).get('logo_url'),
                'over_odds': pr.over_odds,
                'under_odds': pr.under_odds,
                'is_alt': pr.is_alt,
                'player_headshot_url': pr.player_headshot_url,
            })

        prompt = self._build_prompt(props_payload, games, picks_target)
        ai_picks = await self._call_llm(prompt)
        if not ai_picks:
            logger.warning("LLM returned no picks; will attempt deterministic fallback")

        # Validate picks and enrich metadata
        final: List[Dict[str, Any]] = []
        seen = set()
        for pk in ai_picks:
            try:
                player = pk.get('player_name')
                prop_type = pk.get('prop_type')
                rec = (pk.get('recommendation') or '').lower()
                line = float(pk.get('line'))
                odds = int(pk.get('odds'))
                event_id = str(pk.get('event_id'))
                bookmaker = (pk.get('bookmaker') or '').lower()
                key = (event_id, player, prop_type, rec, line, bookmaker)
                if key in seen:
                    continue
                # Find matching candidate from payload (for metadata)
                cand = next((c for c in props_payload if str(c['event_id']) == event_id and c['player'] == player and c['prop_type'] == prop_type and float(c['line']) == float(line) and (c['over_odds'] == odds if rec == 'over' else c['under_odds'] == odds) and (c['bookmaker'] or '').lower() == bookmaker), None)
                if not cand:
                    continue
                # Build enriched pick
                final.append({
                    'event_id': event_id,
                    'sport': cand['sport'],
                    'pick': f"{player} {rec.upper()} {line} {prop_type}",
                    'odds': odds,
                    'confidence': pk.get('confidence', 65),
                    'prop_type': prop_type,
                    'line': line,
                    'risk_level': pk.get('risk_level') or self._fallback_risk(pk.get('confidence', 65), odds),
                    'reasoning': pk.get('reasoning', ''),
                    'roi_estimate': self._pct_to_float(pk.get('roi_estimate')),
                    'value_percentage': self._pct_to_float(pk.get('value_percentage')),
                    'implied_probability': self._pct_to_float(pk.get('implied_probability'), default=50.0),
                    'fair_odds': pk.get('fair_odds', odds),
                    'key_factors': pk.get('key_factors', []),
                    'metadata': {
                        'player_name': player,
                        'prop_type': prop_type,
                        'recommendation': rec.upper(),
                        'line': line,
                        'bookmaker': bookmaker,
                        'bookmaker_logo_url': cand.get('bookmaker_logo_url'),
                        'is_alt': cand.get('is_alt', False),
                        'player_headshot_url': cand.get('player_headshot_url'),
                        'stat_key': cand.get('stat_key'),
                        'league_logo_url': league_logos.get({
                            'MAJOR LEAGUE BASEBALL': 'MLB',
                            'NATIONAL FOOTBALL LEAGUE': 'NFL',
                            'COLLEGE FOOTBALL': 'CFB',
                            'NATIONAL HOCKEY LEAGUE': 'NHL',
                            'NATIONAL BASKETBALL ASSOCIATION': 'NBA',
                            "WOMEN'S NATIONAL BASKETBALL ASSOCIATION": 'WNBA',
                            'MLB': 'MLB', 'NFL': 'NFL', 'CFB': 'CFB', 'NHL': 'NHL', 'NBA': 'NBA', 'WNBA': 'WNBA'
                        }.get(cand['sport'], cand['sport']), {}).get('logo_url'),
                    }
                })
                seen.add(key)
            except Exception:
                continue
        if not final:
            logger.warning('No valid picks after validation; building deterministic fallback from available props')
            # Build simple deterministic candidates from provided props
            cand_list = []
            for c in props_payload:
                for rec, od in (("over", c.get('over_odds')), ("under", c.get('under_odds'))):
                    if od is None:
                        continue
                    # Keep within sane range (view already filtered, but double-check)
                    if abs(int(od)) > 300:
                        continue
                    # Score: prefer odds near -120 to +120
                    score = abs(abs(int(od)) - 120)
                    cand_list.append((score, c, rec, int(od)))
            cand_list.sort(key=lambda x: x[0])

            used_keys = set()
            for _, c, rec, od in cand_list:
                if len(final) >= max(1, min(5, picks_target)):
                    break
                key = (str(c['event_id']), c['player'], c['prop_type'], rec, float(c['line']), (c['bookmaker'] or '').lower())
                if key in used_keys:
                    continue
                used_keys.add(key)
                # Build fallback pick
                final.append({
                    'event_id': str(c['event_id']),
                    'sport': c['sport'],
                    'pick': f"{c['player']} {rec.upper()} {c['line']} {c['prop_type']}",
                    'odds': od,
                    'confidence': 65 if abs(od) <= 150 else 58,
                    'prop_type': c['prop_type'],
                    'line': float(c['line']),
                    'risk_level': 'Medium' if abs(od) <= 150 else 'High',
                    'reasoning': 'Deterministic fallback selection based on available props and moderate odds range.',
                    'roi_estimate': 8.0,
                    'value_percentage': 10.0,
                    'implied_probability': 57.0 if od < 0 else round(100 / (od + 100) * 100, 1),
                    'fair_odds': od,
                    'key_factors': ['Available odds within target band', 'Simplified fallback selection'],
                    'metadata': {
                        'player_name': c['player'],
                        'prop_type': c['prop_type'],
                        'recommendation': rec.upper(),
                        'line': float(c['line']),
                        'bookmaker': (c['bookmaker'] or '').lower(),
                        'bookmaker_logo_url': c.get('bookmaker_logo_url'),
                        'is_alt': c.get('is_alt', False),
                        'player_headshot_url': c.get('player_headshot_url'),
                        'stat_key': c.get('stat_key'),
                        'league_logo_url': league_logos.get(c['sport'], {}).get('logo_url'),
                    }
                })

            if not final:
                logger.warning('Fallback also produced no picks; aborting without writes')
                return
        self.db.store_predictions(final, games_map)

    @staticmethod
    def _pct_to_float(val: Any, default: float = 0.0) -> float:
        try:
            if val is None:
                return default
            if isinstance(val, (int, float)):
                return float(val)
            s = str(val).strip()
            if s.endswith('%'):
                return float(s[:-1])
            return float(s)
        except Exception:
            return default

    @staticmethod
    def _fallback_risk(conf: float, odds: int) -> str:
        try:
            if conf >= 70 and odds <= -110:
                return 'Low'
            if conf >= 60 and -150 <= odds <= 150:
                return 'Medium'
            return 'High'
        except Exception:
            return 'Medium'

    def _build_prompt(self, props: List[Dict[str, Any]], games: List[Dict[str, Any]], picks_target: int) -> str:
        # Keep it concise but strict
        games_str = json.dumps(games[:50], default=str)
        props_str = json.dumps(props[:500])
        return f"""
You are a professional sports betting analyst. Choose profitable player prop picks from today's filtered pool.

Rules:
- Only pick from the provided props list. Do not invent players or markets.
- Respond ONLY with a JSON array [] of picks. No extra text.
- Odds must be between -300 and +300. Use the odds from the selected bookmaker.
- Include both main-line and alt-line opportunities. If an alt line is selected, keep is_alt true and the exact line.
- Balance risk categories: ~36% Low (-200 to -110, 70-85% conf), ~52% Medium (-150 to +150, 60-75%), ~12% High (+120 to +300, 55-70%).
- Quality over quantity: If you cannot find {picks_target} quality picks, return fewer.

Available Games (truncated):
{games_str}

Available Props (truncated):
{props_str}

Return JSON array with objects of the exact shape:
[
  {{
    "event_id": "uuid",
    "player_name": "Full Name",
    "prop_type": "Human label (e.g. Batter Hits O/U)",
    "recommendation": "over" | "under",
    "line": 1.5,
    "odds": -125,
    "bookmaker": "fanduel|draftkings|betmgm|caesars|fanatics",
    "confidence": 72,
    "risk_level": "Low|Medium|High",
    "reasoning": "3-5 sentences, data-backed, concise",
    "roi_estimate": "8.5%",
    "value_percentage": "12.0%",
    "implied_probability": "57.5%",
    "fair_odds": -140,
    "key_factors": ["factor1", "factor2"]
  }}
]

Generate up to {picks_target} best picks.
"""

    async def _call_llm(self, prompt: str) -> List[Dict[str, Any]]:
        try:
            resp = await self.llm.chat.completions.create(
                model='grok-4',
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=3000
            )
            text = resp.choices[0].message.content.strip()
            # Extract JSON array
            start = text.find('[')
            end = text.rfind(']')
            if start == -1 or end == -1:
                logger.error('LLM response missing JSON array')
                return []
            json_str = text[start:end+1]
            return json.loads(json_str)
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return []


def parse_args():
    p = argparse.ArgumentParser(description='Generate AI player prop picks (v2, flat view)')
    p.add_argument('--tomorrow', action='store_true', help='Use tomorrow date')
    p.add_argument('--date', type=str, help='YYYY-MM-DD explicit date')
    p.add_argument('--picks', type=int, default=25, help='Target picks (model may return fewer)')
    p.add_argument('--sport', type=str, help='Restrict to one sport (full name in sports_events)')
    return p.parse_args()


async def main():
    args = parse_args()
    if args.date:
        try:
            target = datetime.strptime(args.date, '%Y-%m-%d').date()
        except ValueError:
            logger.error('Invalid --date, use YYYY-MM-DD')
            return
    elif args.tomorrow:
        target = (datetime.now(timezone.utc) + timedelta(days=1)).date()
    else:
        target = datetime.now(timezone.utc).date()

    ag = Agent()
    await ag.run(target, args.picks, args.sport)


if __name__ == '__main__':
    asyncio.run(main())

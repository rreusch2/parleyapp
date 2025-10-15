import os
import json
import logging
import argparse
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI
import asyncio
import requests

# Load env from backend/.env to reuse existing settings
load_dotenv("backend/.env")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("props_enhanced_v2")
APP_TIMEZONE = os.getenv("APP_TIMEZONE", "America/New_York")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5")

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

class StatMuseClient:
    def __init__(self, base_url: Optional[str] = None) -> None:
        self.base_url = base_url or os.getenv('STATMUSE_API_URL', 'http://127.0.0.1:5001')
        self.session = requests.Session()
        self.timeout = 20

    def query(self, query: str, sport: Optional[str] = None) -> Dict[str, Any]:
        try:
            payload = {"query": query}
            if sport:
                payload["sport"] = str(sport).upper()
            resp = self.session.post(f"{self.base_url}/query", json=payload, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logging.warning(f"StatMuse query failed: {e}")
            return {"success": False, "error": str(e)}

class WebSearchClient:
    def __init__(self) -> None:
        self.google_api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
        self.search_engine_id = os.getenv("GOOGLE_SEARCH_ENGINE_ID")
        self.google_search_url = "https://www.googleapis.com/customsearch/v1"

    def search(self, query: str) -> Dict[str, Any]:
        try:
            if not self.google_api_key or not self.search_engine_id:
                return {"items": []}
            params = {
                "q": query,
                "key": self.google_api_key,
                "cx": self.search_engine_id,
                "num": 5,
                "safe": "off",
            }
            r = requests.get(self.google_search_url, params=params, timeout=15)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logging.warning(f"Web search failed: {e}")
            return {"items": []}


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

    @staticmethod
    def _normalize_sport_input(s: str) -> str:
        mapping_upper = {
            'MLB': 'Major League Baseball',
            'NBA': 'National Basketball Association',
            'NHL': 'National Hockey League',
            'NFL': 'National Football League',
            'CFB': 'College Football',
            'NCAAF': 'College Football',
            'WNBA': "Women's National Basketball Association",
        }
        mapping_lower = {
            'major league baseball': 'Major League Baseball',
            "women's national basketball association": "Women's National Basketball Association",
            'national football league': 'National Football League',
            'college football': 'College Football',
            'national hockey league': 'National Hockey League',
            'national basketball association': 'National Basketball Association',
        }
        if not s:
            return s
        key_upper = s.strip().upper()
        if key_upper in mapping_upper:
            return mapping_upper[key_upper]
        key_lower = s.strip().lower()
        if key_lower in mapping_lower:
            return mapping_lower[key_lower]
        return s

    def get_games_for_date(self, target_date: datetime.date, sport_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        # Local timezone midnight window converted to UTC
        tz = ZoneInfo(APP_TIMEZONE)
        start_local = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=tz)
        end_local = start_local + timedelta(days=1)
        start_iso = start_local.astimezone(timezone.utc).isoformat()
        end_iso = end_local.astimezone(timezone.utc).isoformat()
        sports = []
        if sport_filter:
            norm = self._normalize_sport_input(sport_filter)
            sports = [norm]
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
            ).gte('start_time', start_iso).lt('start_time', end_iso).eq('sport', s).order('start_time').execute()
            if resp.data:
                all_games.extend(resp.data)
        all_games.sort(key=lambda g: g['start_time'])
        return all_games

    def get_flat_props_for_games(self, game_ids: List[str]) -> List[FlatProp]:
        if not game_ids:
            return []
        # Use the comprehensive player_props_with_details view
        sel = 'event_id, sport, stat_type, main_line, best_over_odds, best_under_odds, best_over_book, best_under_book, player_name, headshot_url, player_team, position, home_team, away_team, prop_display_name, alt_lines, line_movement, num_bookmakers'
        resp = self.client.table('player_props_with_details').select(sel).in_('event_id', game_ids).execute()
        rows = resp.data or []
        props: List[FlatProp] = []
        for r in rows:
            try:
                props.append(
                    FlatProp(
                        event_id=r['event_id'],
                        sport=(r.get('sport') or '').upper(),
                        player_name=r.get('player_name') or 'Unknown',
                        stat_key=r.get('stat_type') or '',
                        prop_label=r.get('prop_display_name') or display_name_for_stat(r.get('stat_type') or ''),
                        line=float(r.get('main_line') or 0.0),
                        bookmaker=r.get('best_over_book') or r.get('best_under_book') or '',
                        over_odds=int(r['best_over_odds']) if r.get('best_over_odds') is not None else None,
                        under_odds=int(r['best_under_odds']) if r.get('best_under_odds') is not None else None,
                        is_alt=False,  # Main lines only from this view
                        player_headshot_url=r.get('headshot_url')
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
        stored_count = 0
        for p in picks:
            event = event_map.get(str(p.get('event_id')))
            game_info = None
            sport = p.get('sport', 'MLB')
            if event:
                game_info = f"{event.get('away_team','Unknown')} @ {event.get('home_team','Unknown')}"
                sport = self._abbr_sport(event.get('sport', sport))
            # Build ai_predictions row
            metadata = p.pop('metadata', {})
            
            # Enrich metadata with game info for frontend display
            if event:
                away_team = event.get('away_team', 'Unknown')
                home_team = event.get('home_team', 'Unknown')
                
                # Try to get abbreviations from teams table
                away_abbr = self._get_team_abbreviation(away_team)
                home_abbr = self._get_team_abbreviation(home_team)
                
                metadata['game_info'] = {
                    'away_team': away_team,
                    'home_team': home_team,
                    'away_team_abbr': away_abbr,
                    'home_team_abbr': home_abbr,
                    'start_time': event.get('start_time'),
                }
            
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
            try:
                self.client.table('ai_predictions').insert(row).execute()
                stored_count += 1
                logger.info(f"Stored pick {stored_count}/{len(picks)}: {row.get('pick', 'Unknown')}")
            except Exception as e:
                logger.error(f"Failed to store pick: {e}")
        logger.info(f"Successfully stored {stored_count}/{len(picks)} predictions to ai_predictions")

    def _get_team_abbreviation(self, team_name: str) -> str:
        """Get team abbreviation from teams table."""
        try:
            resp = self.client.table('teams').select('team_abbreviation').eq('team_name', team_name).limit(1).execute()
            if resp.data and len(resp.data) > 0:
                return resp.data[0].get('team_abbreviation', team_name)
        except Exception:
            pass
        return team_name

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
        # Use OpenAI by default; model configurable via OPENAI_MODEL
        self.llm = AsyncOpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.statmuse = StatMuseClient()
        self.web = WebSearchClient()

    async def run(self, target_date: datetime.date, picks_target: int, sport_filter: Optional[str]) -> None:
        games = self.db.get_games_for_date(target_date, sport_filter)
        if not games:
            if sport_filter:
                logger.warning(f"No games found for {target_date} with sport filter '{sport_filter}'")
            else:
                logger.warning(f"No games found for {target_date}")
            return
        logger.info(f"Found {len(games)} games for {target_date}")
        event_ids = [g['id'] for g in games]
        props = self.db.get_flat_props_for_games(event_ids)
        if not props:
            logger.warning(f"No props found for today's games in player_props_with_details. Checked {len(event_ids)} events.")
            return
        logger.info(f"Found {len(props)} total props across all games")
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

        research_plan_prompt = self._build_research_plan_prompt(props_payload, picks_target)
        plan_items = await self._call_llm(research_plan_prompt)
        research_map: Dict[str, Dict[str, Any]] = {}
        props_index: Dict[str, Dict[str, Any]] = {}
        for c in props_payload:
            key = f"{c['event_id']}|{c['player']}|{c['prop_type']}"
            props_index[key] = c
        selected_props: List[Dict[str, Any]] = []
        for it in (plan_items or [])[:max(5, picks_target*2)]:
            try:
                eid = str(it.get('event_id') or '')
                player = it.get('player') or it.get('player_name') or ''
                ptype = it.get('prop_type') or ''
                sport = (it.get('sport') or '').upper()
                key = f"{eid}|{player}|{ptype}"
                base = props_index.get(key)
                if not base:
                    continue
                selected_props.append(base)
                statmuse_qs = it.get('statmuse_queries') or []
                google_qs = it.get('google_queries') or []
                sm_answers: List[Dict[str, Any]] = []
                for q in statmuse_qs[:4]:
                    try:
                        r = self.statmuse.query(q, sport or base.get('sport'))
                        if r and r.get('success'):
                            sm_answers.append({'query': q, 'answer': r.get('answer'), 'url': r.get('url')})
                    except Exception:
                        continue
                web_hits: List[Dict[str, Any]] = []
                for q in google_qs[:3]:
                    try:
                        res = self.web.search(q)
                        items = (res or {}).get('items', [])[:3]
                        for it2 in items:
                            web_hits.append({'title': it2.get('title'), 'snippet': it2.get('snippet'), 'link': it2.get('link')})
                    except Exception:
                        continue
                research_map[key] = {'statmuse': sm_answers, 'web': web_hits}
            except Exception:
                continue

        final_prompt = self._build_final_prompt(selected_props or props_payload, games, research_map, picks_target)
        ai_picks = await self._call_llm(final_prompt)
        logger.info(f"AI returned {len(ai_picks) if ai_picks else 0} picks")
        if not ai_picks:
            logger.warning("AI returned no picks")
            return

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
                # Find matching candidate from payload (for metadata) - simplified matching
                cand = next((c for c in props_payload if str(c['event_id']) == event_id and c['player'] == player and c['prop_type'] == prop_type and float(c['line']) == float(line)), None)
                if not cand:
                    # More flexible matching - just match by player and prop type
                    cand = next((c for c in props_payload if c['player'] == player and c['prop_type'] == prop_type), None)
                if not cand:
                    logger.warning(f"Could not find matching prop for {player} {prop_type} {line}")
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
                        'league_logo_url': league_logos.get(cand['sport'], {}).get('logo_url'),
                    }
                })
                seen.add(key)
            except Exception:
                continue
        if not final:
            logger.warning('No valid picks after validation')
            return
        logger.info(f"Storing {len(final)} validated picks to database")
        self.db.store_predictions(final, games_map)
        logger.info(f"✅ Successfully stored {len(final)} player prop predictions")

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

    def _build_research_plan_prompt(self, props: List[Dict[str, Any]], picks_target: int) -> str:
        games_str = "[]"
        props_str = json.dumps(props[:400])
        return f"""
You are a betting research planner. From the provided props, select the most research-worthy candidates and propose concrete research queries.

Rules:
- Only consider props with odds between -300 and +300.
- Prefer props with clear value angles (line movement, strong trends, matchup edges).
- Output JSON array only. No extra text.

Each item:
{{
  "event_id": "uuid",
  "player": "Full Name",
  "prop_type": "exact display name",
  "sport": "MLB|NBA|NHL|NFL|CFB|WNBA",
  "statmuse_queries": ["..."],
  "google_queries": ["..."]
}}

Available Props:
{props_str}

Return up to {max(5, picks_target*2)} items.
"""

    def _build_final_prompt(self, props: List[Dict[str, Any]], games: List[Dict[str, Any]], research: Dict[str, Dict[str, Any]], picks_target: int) -> str:
        # Keep it concise but strict
        games_str = json.dumps(games[:50], default=str)
        props_str = json.dumps(props[:500])
        research_items: List[Dict[str, Any]] = []
        for p in props[:200]:
            key = f"{p['event_id']}|{p['player']}|{p['prop_type']}"
            if key in research:
                research_items.append({
                    'event_id': p['event_id'],
                    'player': p['player'],
                    'prop_type': p['prop_type'],
                    'research': research[key]
                })
        research_str = json.dumps(research_items[:200])
        return f"""
You are an elite professional sports bettor with deep knowledge of winning strategies. Your goal: identify ONLY props with TRUE EDGE.

🚨 CRITICAL FILTERING RULES - NEVER VIOLATE:
1. IMMEDIATELY DISCARD any prop with odds outside -300 to +300. Do not even consider these.
2. NEVER research, analyze, or mention props with extreme odds (+400, -500, etc.). Pretend they don't exist.
3. Focus on the "sweet spot": -200 to +200 odds where the most consistent profit exists.

📊 PROFESSIONAL BETTING STRATEGIES TO APPLY:
• **Line Shopping Advantage**: Look for props where you have the best available odds vs market consensus
• **Recency Bias Exploitation**: Fade public overreaction to recent performances  
• **Situational Edges**: Home/road splits, matchup advantages, weather impacts
• **Market Inefficiencies**: Props where books haven't adjusted for key information
• **Volume vs Efficiency**: Target players with consistent opportunity (touches, minutes, AB)
• **Contrarian Value**: Sometimes the less popular side offers better value
• **Injury/Rest Impact**: Fresh players vs fatigued, returning from injury bounces
• **Motivational Factors**: Contract years, revenge games, playoff implications

🎯 OPTIMAL RISK DISTRIBUTION:
• 40% Conservative (-200 to -110): High probability, steady profit
• 50% Balanced (-150 to +150): Good value with reasonable risk  
• 10% Aggressive (+120 to +200): Higher upside with calculated risk

📈 PICK QUALITY STANDARDS:
- Each pick needs MULTIPLE supporting factors
- Look for 3-5% edge minimum (your estimated probability vs implied odds)
- Prioritize props with 3+ bookmaker consensus
- Consider line movement as market intelligence

Available Games:
{games_str}

Available Props (PRE-FILTERED for odds -300 to +300 ONLY):
{props_str}

Research Findings (StatMuse, Web search):
{research_str}

🔑 CRITICAL: Use EXACT prop_type names from the data above. Examples:
- NHL: "Goals", "Assists", "Points (G+A)", "Shots on Goal", "Power play points"  
- NFL: "Passing Yards", "Rushing Yards", "Receiving Yards", "Touchdowns"
- MLB: "Hits", "Home Runs", "RBIs", "Strikeouts"
DO NOT invent or modify these names - copy them exactly from the available props.

OUTPUT FORMAT - JSON ONLY:
[
  {{
    "event_id": "uuid",
    "player_name": "Full Name",
    "prop_type": "Display name (Goals O/U, Points O/U, etc.)",
    "recommendation": "over" | "under", 
    "line": 1.5,
    "odds": -125,
    "bookmaker": "best available book",
    "confidence": 72,
    "risk_level": "Conservative|Balanced|Aggressive",
    "reasoning": "Multi-factor analysis with specific edge identification",
    "roi_estimate": "8.5%",
    "value_percentage": "12.0%",
    "implied_probability": "57.5%",
    "fair_odds": -140,
    "key_factors": ["situational_edge", "line_value", "player_form"]
  }}
]

Generate exactly {picks_target} ELITE picks with true mathematical edge.
"""

    async def _call_llm(self, prompt: str) -> List[Dict[str, Any]]:
        try:
            resp = await self.llm.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=1,
                max_completion_tokens=15000  # Increased for larger responses
            )
            text = (resp.choices[0].message.content or '').strip()
            logger.info(f"AI response length: {len(text)} chars")
            
            # Prefer code-fenced JSON if present
            json_str = ''
            if '```' in text:
                first = text.find('```')
                second = text.find('```', first + 3)
                if second != -1:
                    fenced = text[first + 3:second].strip()
                    # Strip possible language hint like 'json' or 'JSON'
                    if fenced.lower().startswith('json'):
                        fenced = fenced[4:].strip()
                    json_str = fenced
            if not json_str:
                # Fallback: extract bracketed JSON array
                start = text.find('[')
                end = text.rfind(']')
                if start == -1 or end == -1:
                    logger.error('LLM response missing JSON array')
                    logger.debug(f"Response preview: {text[:500]}")
                    return []
                json_str = text[start:end+1]
            try:
                parsed = json.loads(json_str)
                return parsed
            except json.JSONDecodeError as je:
                # Try to salvage partial JSON
                logger.warning(f"JSON decode error: {je}")
                logger.debug(f"Problematic JSON preview (first 1000 chars): {json_str[:1000]}")
                logger.debug(f"Problematic JSON preview (around error): {json_str[max(0, je.pos-100):je.pos+100]}")
                # Try to find complete objects before the error
                truncated = json_str[:je.pos]
                last_complete = truncated.rfind('}')
                if last_complete > 0:
                    salvaged = truncated[:last_complete+1] + ']'
                    try:
                        parsed = json.loads(salvaged)
                        logger.info(f"Salvaged {len(parsed)} picks from partial JSON")
                        return parsed
                    except:
                        pass
                return []
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
    else:
        tz = ZoneInfo(APP_TIMEZONE)
        now_local = datetime.now(tz)
        target = (now_local + timedelta(days=1)).date() if args.tomorrow else now_local.date()

    logger.info(f"🗓️ Using target_date={target} (timezone={APP_TIMEZONE}{' +1 day' if args.tomorrow else ''})")

    ag = Agent()
    await ag.run(target, args.picks, args.sport)


if __name__ == '__main__':
    asyncio.run(main())

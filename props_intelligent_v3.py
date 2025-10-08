import os
import json
import logging
import argparse
import requests
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import AsyncOpenAI
import asyncio

# Load env from backend/.env
load_dotenv("backend/.env")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("props_intelligent_v3")

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

@dataclass
class ResearchInsight:
    source: str
    query: str
    data: Dict[str, Any]
    confidence: float
    timestamp: datetime

class StatMuseClient:
    """Client for StatMuse API - provides recent player stats and trends"""
    def __init__(self, base_url: str = "http://127.0.0.1:5001"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def query(self, question: str) -> Dict[str, Any]:
        try:
            response = self.session.post(
                f"{self.base_url}/query",
                json={"query": question},
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"StatMuse query failed: {e}")
            return {"error": str(e)}

class WebSearchClient:
    """Client for Google Custom Search - provides injury news and trends"""
    def __init__(self):
        self.google_api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
        self.search_engine_id = os.getenv("GOOGLE_SEARCH_ENGINE_ID")
        self.google_search_url = "https://www.googleapis.com/customsearch/v1"
        
        if not self.google_api_key or not self.search_engine_id:
            logger.warning("Google Search API credentials not found. Web search will be limited.")
    
    def search(self, query: str) -> Dict[str, Any]:
        logger.info(f"🌐 Web search: {query}")
        
        try:
            if self.google_api_key and self.search_engine_id:
                return self._google_search(query)
            else:
                logger.warning("Google Search API not configured")
                return self._fallback_search(query)
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return self._fallback_search(query)
    
    def _google_search(self, query: str) -> Dict[str, Any]:
        """Perform real Google Custom Search"""
        try:
            params = {
                "q": query,
                "key": self.google_api_key,
                "cx": self.search_engine_id,
                "num": 5
            }
            
            response = requests.get(self.google_search_url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            items = data.get("items", [])
            
            results = []
            for item in items:
                results.append({
                    "title": item.get("title", ""),
                    "snippet": item.get("snippet", ""),
                    "url": item.get("link", ""),
                    "source": "Google Search"
                })
            
            summary_parts = []
            for result in results[:3]:
                if result["snippet"]:
                    summary_parts.append(f"{result['title']}: {result['snippet']}")
            
            summary = " | ".join(summary_parts) if summary_parts else "No relevant information found."
            
            web_result = {
                "query": query,
                "results": results,
                "summary": summary[:800] + "..." if len(summary) > 800 else summary
            }
            
            logger.info(f"🌐 Google search returned {len(results)} results")
            return web_result
            
        except Exception as e:
            logger.error(f"Google search failed: {e}")
            return self._fallback_search(query)
    
    def _fallback_search(self, query: str) -> Dict[str, Any]:
        """Fallback when Google Search is unavailable"""
        return {
            "query": query,
            "results": [],
            "summary": f"Web search unavailable for: {query}"
        }

class DB:
    def __init__(self):
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        self.client: Client = create_client(url, key)
    
    def get_games_for_date(self, target_date: datetime.date, sport_filter: Optional[str]) -> List[Dict[str, Any]]:
        # Sport filter mapping (abbreviated to full name)
        sport_map = {
            'MLB': 'Major League Baseball',
            'NHL': 'National Hockey League',
            'NBA': 'National Basketball Association',
            'NFL': 'National Football League',
            'WNBA': "Women's National Basketball Association",
            'CFB': 'College Football'
        }
        
        # If sport filter provided, use only that sport
        if sport_filter:
            full_sport_name = sport_map.get(sport_filter.upper())
            if full_sport_name:
                sports = [full_sport_name]
                logger.info(f"🎯 Sport filter active: {sport_filter.upper()} only")
            else:
                sports = list(sport_map.values())
        else:
            sports = list(sport_map.values())
        
        start_time = datetime.combine(target_date, datetime.min.time())
        end_time = start_time + timedelta(days=1)
        
        all_games = []
        for sport in sports:
            resp = self.client.table('sports_events').select(
                'id, home_team, away_team, start_time, sport'
            ).gte('start_time', start_time.isoformat()).lte('start_time', end_time.isoformat()).eq('sport', sport).order('start_time').execute()
            if resp.data:
                all_games.extend(resp.data)
        
        all_games.sort(key=lambda g: g['start_time'])
        return all_games
    
    def get_flat_props_for_games(self, game_ids: List[str]) -> List[FlatProp]:
        """
        Fetch props from the fast materialized view with odds filtering.
        This includes both main lines and alt lines.
        """
        if not game_ids:
            return []
        
        sel = 'event_id, sport, stat_type, line, bookmaker, over_odds, under_odds, is_alt, player_name, player_headshot_url'
        resp = self.client.table('player_props_v2_flat_quick_mat').select(sel).in_('event_id', game_ids).or_('and(over_odds.gte.-300,over_odds.lte.300),and(under_odds.gte.-300,under_odds.lte.300)').execute()
        
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
                        prop_label=display_name_for_stat(r.get('stat_type') or ''),
                        line=float(r.get('line', 0)),
                        bookmaker=(r.get('bookmaker') or 'fanduel').lower(),
                        over_odds=r.get('over_odds'),
                        under_odds=r.get('under_odds'),
                        is_alt=r.get('is_alt', False),
                        player_headshot_url=r.get('player_headshot_url')
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to parse prop: {e}")
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
            row = {k: v for k, v in row.items() if v is not None}
            try:
                self.client.table('ai_predictions').insert(row).execute()
                stored_count += 1
                logger.info(f"Stored pick {stored_count}/{len(picks)}: {row.get('pick', 'Unknown')}")
            except Exception as e:
                logger.error(f"Failed to store pick: {e}")
        logger.info(f"Successfully stored {stored_count}/{len(picks)} predictions")
    
    @staticmethod
    def _abbr_sport(full: str) -> str:
        m = {
            'Major League Baseball': 'MLB',
            'Women\'s National Basketball Association': 'WNBA',
            'National Football League': 'NFL',
            'National Hockey League': 'NHL',
            'National Basketball Association': 'NBA',
            'College Football': 'CFB',
        }
        return m.get(full, 'MLB')

def display_name_for_stat(stat_key: str) -> str:
    """Convert stat_type to human-readable label"""
    mapping = {
        'batter_hits': 'Batter Hits O/U',
        'batter_home_runs': 'Batter Home Runs O/U',
        'batter_total_bases': 'Batter Total Bases O/U',
        'batter_rbis': 'Batter RBIs O/U',
        'batter_runs_scored': 'Batter Runs Scored O/U',
        'batter_stolen_bases': 'Batter Stolen Bases O/U',
        'pitcher_strikeouts': 'Pitcher Strikeouts O/U',
        'pitcher_hits_allowed': 'Pitcher Hits Allowed O/U',
        'pitcher_walks': 'Pitcher Walks O/U',
        'pitcher_earned_runs': 'Pitcher Earned Runs O/U',
        'player_points': 'Points O/U',
        'player_rebounds': 'Rebounds O/U',
        'player_assists': 'Assists O/U',
        'player_pass_yds': 'Pass Yards O/U',
        'player_rush_yds': 'Rush Yards O/U',
        'player_reception_yds': 'Reception Yards O/U',
        'player_goals': 'Goals O/U',
        'player_shots_on_goal': 'Shots on Goal O/U',
    }
    return mapping.get(stat_key, stat_key.replace('_', ' ').title())

class Agent:
    def __init__(self) -> None:
        self.db = DB()
        self.statmuse = StatMuseClient()
        self.web_search = WebSearchClient()
        self.llm = AsyncOpenAI(api_key=os.getenv('XAI_API_KEY'), base_url='https://api.x.ai/v1')
    
    async def run(self, target_date: datetime.date, picks_target: int, sport_filter: Optional[str]) -> None:
        logger.info(f"🚀 Starting intelligent props generation for {target_date}")
        
        games = self.db.get_games_for_date(target_date, sport_filter)
        if not games:
            logger.warning(f"No games found for {target_date}")
            return
        logger.info(f"Found {len(games)} games for {target_date}")
        
        event_ids = [g['id'] for g in games]
        props = self.db.get_flat_props_for_games(event_ids)
        if not props:
            logger.warning("No props found")
            return
        logger.info(f"Found {len(props)} total props (main + alt lines) across all games")
        
        # Count main vs alt
        main_count = sum(1 for p in props if not p.is_alt)
        alt_count = sum(1 for p in props if p.is_alt)
        logger.info(f"  Main lines: {main_count}, Alt lines: {alt_count}")
        
        # INTELLIGENT PROP SELECTION
        # Instead of hardcoding, use AI to decide which props to research
        research_plan = await self.create_intelligent_research_plan(props, games, picks_target)
        
        # EXECUTE RESEARCH (StatMuse + Google Search)
        insights = await self.execute_research(research_plan)
        logger.info(f"Gathered {len(insights)} research insights")
        
        # GENERATE PICKS WITH RESEARCH
        games_map = {str(g['id']): g for g in games}
        logos = self.db.get_bookmaker_logos()
        league_logos = self.db.get_league_logos()
        
        picks = await self.generate_picks_with_research(props, games, insights, picks_target, logos, league_logos, games_map)
        logger.info(f"Generated {len(picks)} picks")
        
        if picks:
            self.db.store_predictions(picks, games_map)
            logger.info(f"✅ Successfully stored {len(picks)} player prop predictions")
    
    async def create_intelligent_research_plan(self, props: List[FlatProp], games: List[Dict], picks_target: int) -> Dict[str, Any]:
        """
        Use AI to intelligently select which props/players to research.
        NO HARDCODING - adapts based on available props.
        """
        logger.info("🧠 Creating intelligent research plan...")
        
        # Sample diverse props for AI analysis
        prop_sample = []
        seen_players = set()
        for prop in props[:200]:  # Analyze first 200 props
            if prop.player_name not in seen_players:
                prop_sample.append({
                    "player": prop.player_name,
                    "sport": prop.sport,
                    "prop_type": prop.prop_label,
                    "line": prop.line,
                    "is_alt": prop.is_alt,
                    "over_odds": prop.over_odds,
                    "under_odds": prop.under_odds,
                    "bookmaker": prop.bookmaker
                })
                seen_players.add(prop.player_name)
                if len(prop_sample) >= 50:
                    break
        
        prompt = f"""You are an elite sports betting analyst. You need to create a research plan for player props.

AVAILABLE PROPS SAMPLE ({len(prop_sample)} unique players):
{json.dumps(prop_sample, indent=2)}

YOUR TASK:
1. Analyze the available props and identify the most interesting betting opportunities
2. Select {min(15, picks_target)} players/props that deserve deep research
3. Create StatMuse queries for recent stats and trends
4. Create Google Search queries for injury/lineup news

RESEARCH ALLOCATION:
- StatMuse queries: 10-15 (recent player stats, trends, matchups)
- Web searches: 3-5 (injury news, lineup changes, weather)

SELECTION CRITERIA:
- Diversify across sports, prop types, and players
- Focus on props with reasonable odds (-300 to +300)
- Look for both main lines AND alt lines with value potential
- Avoid hardcoding the same players every time - be adaptive!

Return JSON:
{{
    "analysis": "Brief analysis of what makes these props interesting",
    "statmuse_queries": [
        {{
            "query": "Player Name stat type this season",
            "player": "Player Name",
            "prop_type": "stat type",
            "sport": "MLB|NFL|NBA|NHL|WNBA",
            "reasoning": "Why research this player"
        }}
    ],
    "web_searches": [
        {{
            "query": "Player/Team injury lineup news",
            "sport": "MLB|NFL|NBA|NHL|WNBA"
        }}
    ]
}}"""
        
        try:
            response = await self.llm.chat.completions.create(
                model='grok-4-0709',
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=3000
            )
            
            text = response.choices[0].message.content.strip()
            start = text.find('{')
            end = text.rfind('}') + 1
            plan = json.loads(text[start:end])
            logger.info(f"✅ Intelligent research plan created: {len(plan.get('statmuse_queries', []))} StatMuse + {len(plan.get('web_searches', []))} web")
            return plan
        except Exception as e:
            logger.error(f"Failed to create intelligent research plan: {e}")
            return self._fallback_research_plan(props)
    
    def _fallback_research_plan(self, props: List[FlatProp]) -> Dict[str, Any]:
        """Fallback if AI planning fails"""
        players = list(set(p.player_name for p in props))[:10]
        return {
            "analysis": "Fallback research plan",
            "statmuse_queries": [
                {"query": f"{player} stats this season", "player": player}
                for player in players[:8]
            ],
            "web_searches": [
                {"query": f"{player} injury status"}
                for player in players[:3]
            ]
        }
    
    async def execute_research(self, plan: Dict[str, Any]) -> List[ResearchInsight]:
        """Execute StatMuse queries and Google Searches"""
        insights = []
        
        # StatMuse queries
        for query_obj in plan.get('statmuse_queries', [])[:12]:
            try:
                query = query_obj.get('query', query_obj) if isinstance(query_obj, dict) else query_obj
                logger.info(f"🔍 StatMuse: {query}")
                result = self.statmuse.query(query)
                
                if result and 'error' not in result:
                    insights.append(ResearchInsight(
                        source='statmuse',
                        query=query,
                        data=result,
                        confidence=0.8,
                        timestamp=datetime.now()
                    ))
                await asyncio.sleep(1.5)  # Rate limit
            except Exception as e:
                logger.error(f"StatMuse query failed: {e}")
        
        # Web searches
        for search_obj in plan.get('web_searches', [])[:5]:
            try:
                query = search_obj.get('query', search_obj) if isinstance(search_obj, dict) else search_obj
                logger.info(f"🌐 Web search: {query}")
                result = self.web_search.search(query)
                
                insights.append(ResearchInsight(
                    source='web_search',
                    query=query,
                    data=result,
                    confidence=0.7,
                    timestamp=datetime.now()
                ))
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.error(f"Web search failed: {e}")
        
        return insights
    
    async def generate_picks_with_research(
        self,
        props: List[FlatProp],
        games: List[Dict],
        insights: List[ResearchInsight],
        picks_target: int,
        logos: Dict,
        league_logos: Dict,
        games_map: Dict
    ) -> List[Dict[str, Any]]:
        """Generate picks using research insights"""
        
        # Prepare research summary
        insights_summary = []
        for insight in insights[:30]:
            insights_summary.append({
                "source": insight.source,
                "query": insight.query,
                "data": str(insight.data)[:600],
                "confidence": insight.confidence
            })
        
        props_payload = []
        for pr in props[:500]:  # Cap for prompt size
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
        
        prompt = self._build_detailed_prompt(props_payload, games, insights_summary, picks_target)
        ai_picks = await self._call_llm(prompt)
        
        if not ai_picks:
            logger.warning("AI returned no picks")
            return []
        
        logger.info(f"AI returned {len(ai_picks)} picks")
        
        # Validate and enrich picks
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
                is_alt = pk.get('is_alt', False)
                
                key = (event_id, player, prop_type, rec, line, bookmaker)
                if key in seen:
                    continue
                
                # Find matching prop from payload
                cand = next((c for c in props_payload 
                            if str(c['event_id']) == event_id 
                            and c['player'] == player 
                            and c['prop_type'] == prop_type 
                            and float(c['line']) == float(line)
                            and (c['over_odds'] == odds if rec == 'over' else c['under_odds'] == odds)
                            and (c['bookmaker'] or '').lower() == bookmaker), None)
                
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
                        'is_alt': is_alt,
                        'player_headshot_url': cand.get('player_headshot_url'),
                        'stat_key': cand.get('stat_key'),
                        'league_logo_url': league_logos.get(cand['sport'], {}).get('logo_url'),
                    }
                })
                seen.add(key)
            except Exception as e:
                logger.error(f"Failed to process pick: {e}")
                continue
        
        if not final:
            logger.warning('No valid picks after validation')
            return []
        
        logger.info(f"Validated {len(final)} picks")
        return final
    
    def _build_detailed_prompt(self, props: List[Dict[str, Any]], games: List[Dict], research: List[Dict], picks_target: int) -> str:
        games_str = json.dumps(games[:20], default=str)
        props_str = json.dumps(props[:300])
        research_str = json.dumps(research, indent=2)
        
        return f"""You are an elite sports betting analyst with 15+ years experience.

Your job is to analyze player props using RESEARCH DATA and generate {picks_target} HIGH-VALUE picks.

# RESEARCH INSIGHTS ({len(research)} total):
{research_str}

# AVAILABLE GAMES:
{games_str}

# AVAILABLE PROPS ({len(props)} total, including MAIN and ALT lines):
{props_str}

# YOUR TASK:
Generate {picks_target} best picks using the research data above.

CRITICAL REQUIREMENTS:
1. **USE THE RESEARCH**: Reference specific stats, trends, and news from the research insights in your reasoning
2. **LONGER REASONING**: Each pick must have 6-10 sentences of detailed, data-backed analysis
3. **MIX MAIN + ALT LINES**: Include both regular lines and alt lines (marked with is_alt: true)
4. **DIVERSIFY**: Spread across different players, prop types, and sports
5. **QUALITY OVER QUANTITY**: Only pick when you see real value

REASONING REQUIREMENTS (6-10 sentences each):
- Sentence 1-2: State the pick and key edge
- Sentence 3-4: Cite SPECIFIC stats from research (e.g., "StatMuse shows he's averaging X over last Y games")
- Sentence 5-6: Discuss matchup factors, trends, or situational advantages
- Sentence 7-8: Explain why this line/odds represent value
- Sentence 9-10: Mention any injury/lineup intel from web searches

RESPOND WITH ONLY JSON ARRAY (no other text):
[
  {{
    "event_id": "uuid",
    "player_name": "Full Name",
    "prop_type": "Exact prop label from above",
    "recommendation": "over" | "under",
    "line": 1.5,
    "odds": -125,
    "bookmaker": "fanduel|draftkings|betmgm|caesars|fanatics",
    "is_alt": true or false,
    "confidence": 72,
    "risk_level": "Low|Medium|High",
    "reasoning": "6-10 sentences with specific data references from research",
    "roi_estimate": "8.5%",
    "value_percentage": "12.0%",
    "implied_probability": "57.5%",
    "fair_odds": -140,
    "key_factors": ["factor1", "factor2", "factor3"]
  }}
]

Generate {picks_target} picks maximum. Include a healthy mix of main lines and alt lines.
"""
    
    async def _call_llm(self, prompt: str) -> List[Dict[str, Any]]:
        try:
            resp = await self.llm.chat.completions.create(
                model='grok-4-0709',
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=12000  # Larger for detailed reasoning
            )
            text = resp.choices[0].message.content.strip()
            logger.info(f"AI response length: {len(text)} chars")
            
            start = text.find('[')
            end = text.rfind(']')
            if start == -1 or end == -1:
                logger.error('LLM response missing JSON array')
                return []
            
            json_str = text[start:end+1]
            try:
                parsed = json.loads(json_str)
                return parsed
            except json.JSONDecodeError as je:
                logger.warning(f"JSON decode error: {je}")
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

def parse_args():
    p = argparse.ArgumentParser(description='Generate AI player prop picks with intelligent research')
    p.add_argument('--tomorrow', action='store_true', help='Use tomorrow date')
    p.add_argument('--date', type=str, help='Specific date (YYYY-MM-DD)')
    p.add_argument('--picks', type=int, default=25, help='Target number of picks')
    p.add_argument('--sport', type=str, 
                   choices=['MLB', 'NHL', 'NBA', 'NFL', 'WNBA', 'CFB'],
                   help='Filter by sport (e.g., --sport NHL for hockey only)')
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


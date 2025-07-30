import os
import json
import logging
import asyncio
import requests
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI
import httpx
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv("backend/.env")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

@dataclass
class PlayerProp:
    player_name: str
    prop_type: str
    line: float
    over_odds: Optional[int]
    under_odds: Optional[int]
    event_id: str
    team: str
    bookmaker: str
    sport: str  # Added sport field for multi-sport support
    event_time: Optional[str] = None

@dataclass
class ResearchInsight:
    source: str
    query: str
    data: Dict[str, Any]
    confidence: float
    timestamp: datetime

class StatMuseClient:
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
            return {"error": str(e), "data": None}

class WebSearchClient:
    def __init__(self):
        # Use backend AI API for web search instead of direct Google API
        self.backend_url = os.getenv("BACKEND_URL", "https://zooming-rebirth-production-a305.up.railway.app")
        
    def search(self, query: str) -> Dict[str, Any]:
        """Perform web search using backend AI API"""
        try:
            response = requests.post(
                f"{self.backend_url}/api/ai/chat",
                json={
                    "message": f"Search the web for: {query}",
                    "userId": "props-agent",
                    "useWebSearch": True
                },
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            
            return {
                "query": query,
                "results": result.get("response", "No results found"),
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Web search failed for query '{query}': {e}")
            return {
                "query": query,
                "results": f"Search failed: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }

class DatabaseClient:
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")
            
        self.supabase: Client = create_client(supabase_url, supabase_key)

    def get_upcoming_games(self, hours_ahead: int = 48) -> List[Dict[str, Any]]:
        """Fetch upcoming games from ALL sports with proper sport identification"""
        try:
            now = datetime.now()
            end_time = now + timedelta(hours=hours_ahead)
            
            response = self.supabase.table("sports_events").select(
                "id, sport, home_team, away_team, start_time, metadata"
            ).gte("start_time", now.isoformat()).lte("start_time", end_time.isoformat()).execute()
            
            games = response.data
            logger.info(f"Found {len(games)} upcoming games across all sports")
            
            # Group by sport for logging
            sport_counts = {}
            for game in games:
                sport = game.get('sport', 'Unknown')
                sport_counts[sport] = sport_counts.get(sport, 0) + 1
            
            for sport, count in sport_counts.items():
                logger.info(f"  {sport}: {count} games")
            
            return games
        except Exception as e:
            logger.error(f"Error fetching upcoming games: {e}")
            return []

    def get_player_props_for_games(self, game_ids: List[str]) -> List[PlayerProp]:
        """Fetch player props for given games across ALL sports"""
        try:
            # Get all props for the games with player and prop type info
            response = self.supabase.table("player_props_odds").select(
                """
                id, line, over_odds, under_odds, event_id,
                players!inner(name, team, sport),
                player_prop_types!inner(prop_name, sport_key),
                sports_events!inner(sport, start_time)
                """
            ).in_("event_id", game_ids).execute()
            
            props = []
            for prop_data in response.data:
                try:
                    player_info = prop_data['players']
                    prop_type_info = prop_data['player_prop_types']
                    event_info = prop_data['sports_events']
                    
                    prop = PlayerProp(
                        player_name=player_info['name'],
                        prop_type=prop_type_info['prop_name'],
                        line=float(prop_data['line']),
                        over_odds=self._safe_int_convert(prop_data['over_odds']),
                        under_odds=self._safe_int_convert(prop_data['under_odds']),
                        event_id=prop_data['event_id'],
                        team=player_info['team'],
                        bookmaker="FanDuel",
                        sport=event_info['sport'],  # Include sport info
                        event_time=event_info.get('start_time')  # Add event time
                    )
                    props.append(prop)
                except (KeyError, TypeError, ValueError) as e:
                    logger.warning(f"Skipping malformed prop data: {e}")
                    continue
            
            # Group by sport for logging
            sport_prop_counts = {}
            for prop in props:
                sport = prop.sport
                sport_prop_counts[sport] = sport_prop_counts.get(sport, 0) + 1
            
            logger.info(f"Found {len(props)} player props across all sports:")
            for sport, count in sport_prop_counts.items():
                logger.info(f"  {sport}: {count} props")
            
            return props
        except Exception as e:
            logger.error(f"Error fetching player props: {e}")
            return []

    def _safe_int_convert(self, value) -> Optional[int]:
        """Safely convert a value to int, handling strings and None"""
        if value is None:
            return None
        try:
            if isinstance(value, str):
                return int(float(value))
            return int(value)
        except (ValueError, TypeError):
            return None

    def store_ai_predictions(self, predictions: List[Dict[str, Any]]) -> bool:
        """Store AI predictions with sport metadata in DEV table"""
        try:
            # Sort predictions: WNBA first, MLB last (so MLB shows on top in UI)
            def sport_priority(pred):
                sport = pred.get("sport", "MLB")
                if sport == "Women's National Basketball Association":
                    return 1  # Save first
                elif sport == "Major League Baseball":
                    return 3  # Save last
                else:
                    return 2  # Other sports in middle
            
            sorted_predictions = sorted(predictions, key=sport_priority)
            logger.info(f"📊 Saving predictions in UI order: WNBA first, MLB last")
            
            for pred in sorted_predictions:
                reasoning = pred.get("reasoning", "")
                if not reasoning and pred.get("metadata"):
                    reasoning = pred["metadata"].get("reasoning", "")
                
                roi_estimate_str = pred["metadata"].get("roi_estimate", "0%") if pred.get("metadata") else "0%"
                value_percentage_str = pred["metadata"].get("value_percentage", "0%") if pred.get("metadata") else "0%"
                
                try:
                    roi_estimate = float(roi_estimate_str.replace("%", "")) if roi_estimate_str else 0.0
                    value_percentage = float(value_percentage_str.replace("%", "")) if value_percentage_str else 0.0
                except (ValueError, AttributeError):
                    roi_estimate = 0.0
                    value_percentage = 0.0
                
                prediction_data = {
                    "user_id": "c19a5e12-4297-4b0f-8d21-39d2bb1a2c08",
                    "confidence": pred.get("confidence", 0),
                    "pick": pred.get("pick", ""),
                    "odds": str(pred.get("odds", 0)),
                    "sport": pred.get("sport", "MLB"),
                    "event_time": pred.get("event_time"),
                    "bet_type": pred.get("bet_type", "player_prop"),
                    "game_id": str(pred.get("event_id", "")),
                    "match_teams": pred.get("match_teams", ""),
                    "reasoning": reasoning,
                    "line_value": pred.get("line_value") or pred.get("line", 0),
                    "prediction_value": pred.get("prediction_value"),
                    "prop_market_type": pred.get("prop_market_type") or pred.get("prop_type", ""),
                    "roi_estimate": roi_estimate,
                    "value_percentage": value_percentage,
                    "status": "pending",
                    "metadata": pred.get("metadata", {})
                }
                
                # Remove None values to avoid database errors
                prediction_data = {k: v for k, v in prediction_data.items() if v is not None}
                
                result = self.supabase.table("ai_predictions_dev").insert(prediction_data).execute()
                logger.info(f"✅ Stored prediction: {pred.get('pick', 'Unknown')} (ID: {result.data[0]['id'] if result.data else 'Unknown'})")
                
            logger.info(f"Successfully stored {len(predictions)} AI predictions in DEV table")
            return True
            
        except Exception as e:
            logger.error(f"Error storing AI predictions: {e}")
            return False

class PersonalizedPlayerPropsAgent:
    def __init__(self):
        self.db = DatabaseClient()
        self.statmuse = StatMuseClient()
        self.web_search = WebSearchClient()
        self.grok_client = AsyncOpenAI(
            api_key=os.getenv("XAI_API_KEY"),
            base_url="https://api.x.ai/v1"
        )

    async def generate_personalized_picks_by_sport(self) -> Dict[str, List[Dict[str, Any]]]:
        """Generate 20 picks per sport that has active games and props"""
        logger.info("🎯 Starting personalized multi-sport player props generation...")
        
        # Fetch games and props
        games = self.db.get_upcoming_games()
        if not games:
            logger.warning("No upcoming games found")
            return {}
        
        game_ids = [game['id'] for game in games]
        all_props = self.db.get_player_props_for_games(game_ids)
        
        if not all_props:
            logger.warning("No player props found")
            return {}
        
        # Group props by sport
        props_by_sport = {}
        games_by_sport = {}
        
        for prop in all_props:
            sport = prop.sport
            if sport not in props_by_sport:
                props_by_sport[sport] = []
                games_by_sport[sport] = []
            props_by_sport[sport].append(prop)
        
        # Group games by sport
        for game in games:
            sport = game['sport']
            if sport in games_by_sport:
                games_by_sport[sport].append(game)
        
        # Generate picks for each sport
        all_picks_by_sport = {}
        
        for sport, sport_games in games_by_sport.items():
            if not sport_games:
                logger.warning(f"No games found for {sport}")
                continue
            
            # Get player props for this sport's games
            game_ids = [game['id'] for game in sport_games]
            sport_props = [prop for prop in all_props if prop.sport == sport]
            
            if not sport_props:
                logger.warning(f"No player props found for {sport}")
                continue
            
            logger.info(f"🎯 Generating 15 PROPS picks for {sport} ({len(sport_props)} props available)")
            
            picks = await self._generate_picks_for_sport(sport, sport_props, sport_games, target_picks=15)
            
            if picks:
                all_picks_by_sport[sport] = picks
                logger.info(f"✅ Generated {len(picks)} picks for {sport}")
        
        return all_picks_by_sport

    async def _generate_picks_for_sport(self, sport: str, props: List[PlayerProp], games: List[Dict], target_picks: int = 20) -> List[Dict[str, Any]]:
        """Generate picks for a specific sport"""
        try:
            # Create research plan
            research_plan = await self.create_research_plan(sport, props, games)
            
            # Execute research
            insights = await self.execute_research_plan(research_plan, props)
            
            # Generate picks with reasoning
            picks = await self.generate_picks_with_reasoning(sport, insights, props, games, target_picks)
            
            return picks
        except Exception as e:
            logger.error(f"Error generating picks for {sport}: {e}")
            return []

    async def create_research_plan(self, sport: str, props: List[PlayerProp], games: List[Dict]) -> Dict[str, Any]:
        """Create intelligent research plan for specific sport"""
        try:
            # Analyze available props
            prop_analysis = self._analyze_available_props(props, games)
            
            # Create sport-specific research prompt with mandatory queries
            key_players = list(set(p.player_name for p in props[:10]))
            prop_types = list(set(p.prop_type for p in props[:15]))
            
            prompt = f"""You are an expert {sport} betting analyst. Create a comprehensive research plan for player props.

TODAY'S {sport.upper()} PROPS:
- {len(games)} games scheduled
- {len(props)} player props available
- Key players: {', '.join(key_players[:8])}
- Prop types: {', '.join(prop_types[:8])}

You MUST create research queries to find betting edges. Return EXACTLY this JSON format:

{{
  "statmuse_queries": [
    "How has [Player A] performed in their last 5 games?",
    "What is [Player B]'s average [stat type] this season?",
    "[Sport] injury report today",
    "[Sport] weather conditions affecting games today",
    "Best [Sport] player prop trends this week",
    "[Player C] vs [opposing team] matchup history",
    "[Sport] lineup changes today",
    "[Player D] recent form and statistics"
  ],
  "web_queries": [
    "{sport} injury report today",
    "{sport} weather conditions today", 
    "{sport} lineup changes today",
    "Best {sport} player props today",
    "{sport} player news today",
    "{sport} prop betting analysis today"
  ]
}}

Replace [Player A], [Player B], etc. with actual players from: {', '.join(key_players[:6])}
Replace [Sport] with {sport}.
Replace [stat type] with relevant stats like points, rebounds, assists, etc.

Return ONLY the JSON, no other text."""

            response = await self.grok_client.chat.completions.create(
                model="grok-3",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=1500
            )
            
            plan_text = response.choices[0].message.content
            
            # Try to parse JSON from response
            try:
                if '```json' in plan_text:
                    json_start = plan_text.find('```json') + 7
                    json_end = plan_text.find('```', json_start)
                    plan_text = plan_text[json_start:json_end]
                
                plan = json.loads(plan_text)
                logger.info(f"Created research plan for {sport} with {len(plan.get('statmuse_queries', []))} StatMuse queries and {len(plan.get('web_queries', []))} web queries")
                return plan
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse research plan JSON for {sport}, using fallback")
                return self._create_fallback_research_plan(sport, props)
                
        except Exception as e:
            logger.error(f"Error creating research plan for {sport}: {e}")
            return self._create_fallback_research_plan(sport, props)

    def _create_fallback_research_plan(self, sport: str, props: List[PlayerProp]) -> Dict[str, Any]:
        """Create a basic research plan if AI planning fails"""
        top_players = list(set(p.player_name for p in props[:10]))
        
        return {
            "statmuse_queries": [
                f"How has {player} performed in their last 5 games?" for player in top_players[:6]
            ] + [
                f"{sport} injury report today",
                f"Best {sport} player prop bets today"
            ],
            "web_queries": [
                f"{sport} injury report today",
                f"{sport} weather conditions today",
                f"{sport} lineup changes today",
                f"Best {sport} betting picks today"
            ]
        }

    def _analyze_available_props(self, props: List[PlayerProp], games: List[Dict]) -> Dict[str, Any]:
        """Analyze the actual props data to understand what's available"""
        prop_types = {}
        players_by_team = {}
        
        for prop in props:
            # Count prop types
            prop_types[prop.prop_type] = prop_types.get(prop.prop_type, 0) + 1
            
            # Group players by team
            if prop.team not in players_by_team:
                players_by_team[prop.team] = []
            players_by_team[prop.team].append(prop.player_name)
        
        return {
            "total_props": len(props),
            "prop_types": prop_types,
            "teams": list(players_by_team.keys()),
            "players_by_team": players_by_team
        }

    async def execute_research_plan(self, plan: Dict[str, Any], props: List[PlayerProp]) -> List[ResearchInsight]:
        """Execute the research plan and gather insights"""
        insights = []
        
        # Execute StatMuse queries
        statmuse_queries = plan.get('statmuse_queries', [])[:8]  # Limit to 8 queries
        for query in statmuse_queries:
            try:
                result = self.statmuse.query(query)
                if result and not result.get('error'):
                    insight = ResearchInsight(
                        source="StatMuse",
                        query=query,
                        data=result,
                        confidence=0.8,
                        timestamp=datetime.now()
                    )
                    insights.append(insight)
                    logger.info(f"✅ StatMuse query completed: {query[:50]}...")
                else:
                    logger.warning(f"❌ StatMuse query failed: {query}")
            except Exception as e:
                logger.error(f"StatMuse query error: {e}")
        
        # Execute web search queries
        web_queries = plan.get('web_queries', [])[:6]  # Limit to 6 queries
        for query in web_queries:
            try:
                result = self.web_search.search(query)
                insight = ResearchInsight(
                    source="WebSearch",
                    query=query,
                    data=result,
                    confidence=0.6,
                    timestamp=datetime.now()
                )
                insights.append(insight)
                logger.info(f"✅ Web search completed: {query[:50]}...")
            except Exception as e:
                logger.error(f"Web search error: {e}")
        
        logger.info(f"Research complete: {len(insights)} insights gathered")
        return insights

    async def generate_picks_with_reasoning(
        self, 
        sport: str,
        insights: List[ResearchInsight], 
        props: List[PlayerProp], 
        games: List[Dict],
        target_picks: int
    ) -> List[Dict[str, Any]]:
        """Generate picks with detailed reasoning for specific sport"""
        try:
            # Format insights for AI
            statmuse_insights = [i for i in insights if i.source == "StatMuse"]
            web_insights = [i for i in insights if i.source == "WebSearch"]
            
            insights_summary = []
            
            # Format StatMuse insights
            for insight in statmuse_insights:
                insights_summary.append({
                    "source": "StatMuse",
                    "query": insight.query,
                    "data": insight.data.get('data', 'No data available'),
                    "confidence": insight.confidence
                })
            
            # Format web insights
            for insight in web_insights:
                insights_summary.append({
                    "source": "Web Search",
                    "query": insight.query,
                    "results": insight.data.get('results', 'No results available'),
                    "confidence": insight.confidence
                })
            
            # Create comprehensive prompt
            prompt = f"""You are a professional {sport} betting analyst generating {target_picks} high-value player prop picks.

RESEARCH INSIGHTS:
{json.dumps(insights_summary, indent=2)}

AVAILABLE PROPS ({len(props)} total):
{self._format_props_for_ai(props)}

REQUIREMENTS:
1. Generate EXACTLY {target_picks} picks
2. Focus on {sport} players and props only
3. Each pick must include:
   - player_name (exact match from available props)
   - prop_type (exact match from available props) 
   - pick (over/under)
   - reasoning (2-3 sentences with specific insights)
   - confidence (55-88 range)
   - roi_estimate (percentage)
   - value_percentage (1-100)

4. Diversify across different prop types and players
5. Only pick from the EXACT props provided above
6. Use research insights to justify each pick
7. Focus on finding value and edges in the market

Return a JSON array of picks. Each pick should be profitable based on your analysis."""

            response = await self.grok_client.chat.completions.create(
                model="grok-3",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.6,
                max_tokens=3000
            )
            
            picks_text = response.choices[0].message.content
            
            # Parse picks
            try:
                if '```json' in picks_text:
                    json_start = picks_text.find('```json') + 7
                    json_end = picks_text.find('```', json_start)
                    picks_text = picks_text[json_start:json_end]
                
                picks_data = json.loads(picks_text)
                
                # Process and validate picks
                processed_picks = []
                for pick in picks_data:
                    # Find matching prop
                    matching_prop = self._find_matching_prop(pick, props)
                    if matching_prop:
                        processed_pick = {
                            'match_teams': f"{games[0].get('away_team', 'TBD')} @ {games[0].get('home_team', 'TBD')}" if games else "Multi-Game Props",
                            'pick': self._format_pick_string(pick, matching_prop),
                            'odds': self._get_odds_string(pick, matching_prop),
                            'confidence': min(88, max(55, int(pick.get('confidence', 65)))),
                            'bet_type': 'player_prop',
                            'sport': sport,  # Add sport metadata
                            'event_time': matching_prop.event_time,  # Add event time
                            'event_id': matching_prop.event_id,  # Add event ID
                            'line': matching_prop.line,  # Add line value
                            'prop_type': matching_prop.prop_type,  # Add prop type
                            'metadata': {
                                'player_name': matching_prop.player_name,
                                'prop_type': matching_prop.prop_type,
                                'team': matching_prop.team,
                                'line': matching_prop.line,
                                'reasoning': pick.get('reasoning', 'Value play based on analysis'),
                                'roi_estimate': pick.get('roi_estimate', '5-8%'),
                                'value_percentage': pick.get('value_percentage', 15),
                                'bookmaker': matching_prop.bookmaker
                            }
                        }
                        processed_picks.append(processed_pick)
                    else:
                        logger.warning(f"Could not find matching prop for: {pick.get('player_name')} - {pick.get('prop_type')}")
                
                logger.info(f"Generated {len(processed_picks)} valid {sport} picks from {len(picks_data)} AI suggestions")
                return processed_picks[:target_picks]  # Ensure we don't exceed target
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse picks JSON for {sport}: {e}")
                return []
                
        except Exception as e:
            logger.error(f"Error generating picks for {sport}: {e}")
            return []

    def _format_props_for_ai(self, props: List[PlayerProp]) -> str:
        """Format props data for AI consumption"""
        formatted = []
        for prop in props[:50]:  # Limit to avoid token overflow
            odds_info = []
            if prop.over_odds:
                odds_info.append(f"Over {prop.line}: {prop.over_odds:+d}")
            if prop.under_odds:
                odds_info.append(f"Under {prop.line}: {prop.under_odds:+d}")
            
            formatted.append(f"• {prop.player_name} ({prop.team}) - {prop.prop_type}: {', '.join(odds_info)}")
        
        if len(props) > 50:
            formatted.append(f"... and {len(props) - 50} more props available")
        
        return '\n'.join(formatted)

    def _find_matching_prop(self, pick: Dict, props: List[PlayerProp]) -> Optional[PlayerProp]:
        """Find matching prop with flexible matching for player names and prop types"""
        player_name = pick.get('player_name', '').strip()
        prop_type = pick.get('prop_type', '').strip()
        side = pick.get('side', '').strip().lower()  # over/under
        
        # Enhanced prop type mappings with more variations
        prop_type_mappings = {
            'hits': ['batter hits', 'hits o/u', 'hits', 'total hits'],
            'home runs': ['batter home runs', 'home runs o/u', 'home runs', 'total home runs', 'hrs'],
            'rbis': ['batter rbis', 'rbis o/u', 'rbis', 'total rbis', 'runs batted in'],
            'runs scored': ['batter runs scored', 'runs o/u', 'runs', 'total runs'],
            'strikeouts': ['pitcher strikeouts', 'strikeouts o/u', 'strikeouts', 'total strikeouts', 'ks'],
            'points': ['player points', 'points o/u', 'points', 'total points'],
            'rebounds': ['player rebounds', 'rebounds o/u', 'rebounds', 'total rebounds'],
            'assists': ['player assists', 'assists o/u', 'assists', 'total assists'],
            'steals': ['player steals', 'steals o/u', 'steals', 'total steals'],
            'blocks': ['player blocks', 'blocks o/u', 'blocks', 'total blocks']
        }
        
        # First try exact matches
        for prop in props:
            if (prop.player_name.lower() == player_name.lower() and 
                prop.prop_type.lower() == prop_type.lower()):
                # Accept if side matches or if we don't care about side
                if not side or prop.side.lower() == side:
                    return prop
        
        # Try partial matches for player names (handle Jr., Sr., etc.)
        for prop in props:
            prop_name_clean = prop.player_name.lower().replace('jr.', '').replace('sr.', '').replace('.', '').strip()
            pick_name_clean = player_name.lower().replace('jr.', '').replace('sr.', '').replace('.', '').strip()
            
            # Also try first/last name combinations
            prop_parts = prop_name_clean.split()
            pick_parts = pick_name_clean.split()
            
            name_match = (prop_name_clean == pick_name_clean or
                         (len(prop_parts) >= 2 and len(pick_parts) >= 2 and 
                          prop_parts[0] == pick_parts[0] and prop_parts[-1] == pick_parts[-1]))
            
            if name_match and prop.prop_type.lower() == prop_type.lower():
                if not side or prop.side.lower() == side:
                    return prop
        
        # Try prop type variations with flexible matching
        for prop in props:
            # Check player name variations
            prop_name_clean = prop.player_name.lower().replace('jr.', '').replace('sr.', '').replace('.', '').strip()
            pick_name_clean = player_name.lower().replace('jr.', '').replace('sr.', '').replace('.', '').strip()
            
            prop_parts = prop_name_clean.split()
            pick_parts = pick_name_clean.split()
            
            name_match = (prop_name_clean == pick_name_clean or
                         pick_name_clean in prop_name_clean or
                         prop_name_clean in pick_name_clean or
                         (len(prop_parts) >= 2 and len(pick_parts) >= 2 and 
                          prop_parts[0] == pick_parts[0] and prop_parts[-1] == pick_parts[-1]))
            
            if name_match:
                # Check prop type variations
                for key, variations in prop_type_mappings.items():
                    if (prop_type.lower() in variations or 
                        prop.prop_type.lower() in variations or
                        any(var in prop_type.lower() for var in variations) or
                        any(var in prop.prop_type.lower() for var in variations)):
                        # Accept available side (Over OR Under) - be flexible!
                        if not side or prop.side.lower() == side or not prop.side:
                            return prop
        
        return None

    def _format_pick_string(self, pick: Dict, matching_prop: PlayerProp) -> str:
        """Format the pick string for clarity"""
        direction = pick.get('pick', 'over').lower()
        return f"{matching_prop.player_name} {direction.title()} {matching_prop.line} {matching_prop.prop_type}"

    def _get_odds_string(self, pick: Dict, matching_prop: PlayerProp) -> str:
        """Get odds string based on pick direction"""
        direction = pick.get('pick', 'over').lower()
        if direction == 'over' and matching_prop.over_odds:
            return f"{matching_prop.over_odds:+d}"
        elif direction == 'under' and matching_prop.under_odds:
            return f"{matching_prop.under_odds:+d}"
        else:
            return "+100"  # Fallback

    async def store_all_picks(self, picks_by_sport: Dict[str, List[Dict[str, Any]]]) -> bool:
        """Store all picks from all sports"""
        all_picks = []
        for sport, picks in picks_by_sport.items():
            all_picks.extend(picks)
        
        if all_picks:
            success = self.db.store_ai_predictions(all_picks)
            logger.info(f"Stored {len(all_picks)} total picks across {len(picks_by_sport)} sports")
            return success
        return False

async def main():
    """Main execution function"""
    agent = PersonalizedPlayerPropsAgent()
    
    # Generate picks for all sports
    picks_by_sport = await agent.generate_personalized_picks_by_sport()
    
    if picks_by_sport:
        # Store all picks
        await agent.store_all_picks(picks_by_sport)
        
        # Log summary
        for sport, picks in picks_by_sport.items():
            logger.info(f"✅ {sport}: {len(picks)} picks generated")
    else:
        logger.warning("No picks generated for any sport")

if __name__ == "__main__":
    asyncio.run(main())

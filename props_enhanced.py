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
            return {"error": str(e)}
    
    def player_stats(self, player_name: str, stat_type: str = "recent") -> Dict[str, Any]:
        try:
            response = self.session.post(
                f"{self.base_url}/player-stats",
                json={"player": player_name, "stat_type": stat_type},
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"StatMuse player stats failed: {e}")
            return {"error": str(e)}

class WebSearchClient:
    def __init__(self):
        self.google_api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
        self.search_engine_id = os.getenv("GOOGLE_SEARCH_ENGINE_ID")
        self.google_search_url = "https://www.googleapis.com/customsearch/v1"
        
        if not self.google_api_key or not self.search_engine_id:
            logger.warning("Google Search API credentials not found. Web search will use fallback.")
    
    def search(self, query: str) -> Dict[str, Any]:
        logger.info(f"🌐 Web search: {query}")
        
        try:
            # Try Google Custom Search first
            if self.google_api_key and self.search_engine_id:
                return self._google_search(query)
            else:
                logger.warning("Google Search API not configured, using fallback")
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
                "num": 5  # Limit to 5 results
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
            
            # Create summary from top results
            summary_parts = []
            for result in results[:3]:  # Use top 3 results for summary
                if result["snippet"]:
                    summary_parts.append(f"{result['title']}: {result['snippet']}")
            
            summary = " | ".join(summary_parts) if summary_parts else "No relevant information found."
            
            web_result = {
                "query": query,
                "results": results,
                "summary": summary[:800] + "..." if len(summary) > 800 else summary
            }
            
            logger.info(f"🌐 Google search returned {len(results)} results for: {query}")
            return web_result
            
        except Exception as e:
            logger.error(f"Google search failed: {e}")
            return self._fallback_search(query)
    
    def _fallback_search(self, query: str) -> Dict[str, Any]:
        """Fallback when Google Search is unavailable"""
        logger.warning(f"Using fallback search for: {query}")
        return {
            "query": query,
            "results": [{
                "title": "Search Unavailable",
                "snippet": "Real-time web search is currently unavailable. Using cached data where possible.",
                "url": "N/A",
                "source": "Fallback"
            }],
            "summary": f"Web search unavailable for query: {query}. Using available data sources."
        }

class DatabaseClient:
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")
            
        self.supabase: Client = create_client(supabase_url, supabase_key)
    
    def get_upcoming_games(self, hours_ahead: int = 48) -> List[Dict[str, Any]]:
        """Fetch upcoming games from multiple sports with priority: MLB > WNBA > UFC"""
        try:
            now = datetime.now().isoformat()
            future = (datetime.now() + timedelta(hours=hours_ahead)).isoformat()
            
            # Fetch games from all supported sports
            all_games = []
            sports = ["Major League Baseball", "Women's National Basketball Association"]  # Only MLB and WNBA have player props, UFC doesn't
            
            for sport in sports:
                response = self.supabase.table("sports_events").select(
                    "id, home_team, away_team, start_time, sport, metadata"
                ).gt("start_time", now).lt("start_time", future).eq("sport", sport).order("start_time").execute()
                
                if response.data:
                    logger.info(f"Found {len(response.data)} upcoming {sport} games with potential props")
                    all_games.extend(response.data)
            
            # Sort all games by start time
            all_games.sort(key=lambda x: x['start_time'])
            logger.info(f"Total upcoming games for props: {len(all_games)}")
            
            return all_games
        except Exception as e:
            logger.error(f"Failed to fetch upcoming games: {e}")
            return []
    
    def _safe_int_convert(self, value) -> Optional[int]:
        """Safely convert a value to int, handling strings and None"""
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            logger.warning(f"Could not convert odds value to int: {value}")
            return None
    
    def get_tomorrow_games(self) -> List[Dict[str, Any]]:
        """Fetch games specifically for June 29th, 2025"""
        try:
            # Fixed date: July 29th, 2025 (today - has both MLB and WNBA games)
            target_date = datetime(2025, 7, 29).date()
            start_dt = datetime.combine(target_date, datetime.min.time())
            end_dt = start_dt + timedelta(days=1)
            start_iso = start_dt.isoformat()
            end_iso = end_dt.isoformat()
            
            logger.info(f"Fetching games for June 29th, 2025: {target_date} ({start_iso} to {end_iso})")
            
            # Fetch games from all supported sports - using correct sport names from database
            all_games = []
            sports = ["Major League Baseball", "Women's National Basketball Association"]  # Only MLB and WNBA have player props, UFC doesn't
            
            for sport in sports:
                response = self.supabase.table("sports_events").select(
                    "id, home_team, away_team, start_time, sport, metadata"
                ).gte("start_time", start_iso).lt("start_time", end_iso).eq("sport", sport).order("start_time").execute()
                
                if response.data:
                    logger.info(f"Found {len(response.data)} tomorrow {sport} games with potential props")
                    all_games.extend(response.data)
            
            # Sort all games by start time
            all_games.sort(key=lambda x: x['start_time'])
            logger.info(f"Total tomorrow games for props: {len(all_games)}")
            
            return all_games
        except Exception as e:
            logger.error(f"Failed to fetch tomorrow games: {e}")
            return []
    
    def get_player_props_for_games(self, game_ids: List[str]) -> List[PlayerProp]:
        if not game_ids:
            return []
        
        try:
            response = self.supabase.table("player_props_odds").select(
                "line, over_odds, under_odds, event_id, "
                "players(name, team), "
                "player_prop_types(prop_name)"
            ).in_("event_id", game_ids).execute()
            
            props = []
            for row in response.data:
                if (row.get("players") and 
                    row.get("player_prop_types") and 
                    row["players"].get("name") and 
                    row["player_prop_types"].get("prop_name")):
                    
                    props.append(PlayerProp(
                        player_name=row["players"]["name"],
                        prop_type=row["player_prop_types"]["prop_name"],
                        line=float(row["line"]),
                        over_odds=self._safe_int_convert(row["over_odds"]),
                        under_odds=self._safe_int_convert(row["under_odds"]),
                        event_id=row["event_id"],
                        team=row["players"]["team"] if row["players"]["team"] else "Unknown",
                        bookmaker="fanduel"
                    ))
            
            return props
        except Exception as e:
            logger.error(f"Failed to fetch player props: {e}")
            return []
    
    def store_ai_predictions(self, predictions: List[Dict[str, Any]]):
        try:
            # Sort predictions: WNBA first, MLB last (so MLB shows on top in UI)
            def sport_priority(pred):
                sport = pred.get("sport", "MLB")
                if sport == "WNBA":
                    return 1  # Save first
                elif sport == "MLB":
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
                
                self.supabase.table("ai_predictions").insert(prediction_data).execute()
                
            logger.info(f"Successfully stored {len(predictions)} AI predictions")
            
        except Exception as e:
            logger.error(f"Failed to store AI predictions: {e}")

class IntelligentPlayerPropsAgent:
    def __init__(self):
        self.db = DatabaseClient()
        self.statmuse = StatMuseClient()
        self.web_search = WebSearchClient()
        self.grok_client = AsyncOpenAI(
            api_key=os.getenv("XAI_API_KEY"),
            base_url="https://api.x.ai/v1"
        )
        # Add session for StatMuse context scraping
        self.session = requests.Session()
        self.statmuse_base_url = "http://localhost:5001"
    
    async def fetch_upcoming_games(self) -> List[Dict[str, Any]]:
        return self.db.get_upcoming_games(hours_ahead=48)
    
    async def fetch_player_props(self) -> List[PlayerProp]:
        games = self.db.get_upcoming_games(hours_ahead=48)
        if not games:
            return []
        game_ids = [game["id"] for game in games]
        return self.db.get_player_props_for_games(game_ids)
        
    def _distribute_props_by_sport(self, games: List[Dict], target_picks: int = 10) -> Dict[str, int]:
        """Distribute props across sports: EXACTLY 3 WNBA + 7 MLB as requested"""
        sport_counts = {"MLB": 0, "WNBA": 0}
        
        # Count available games by sport (map full names to abbreviations)
        for game in games:
            sport = game.get("sport", "")
            if sport == "Major League Baseball":
                sport_counts["MLB"] += 1
            elif sport == "Women's National Basketball Association":
                sport_counts["WNBA"] += 1
        
        logger.info(f"Available games by sport for props: {sport_counts}")
        
        # EXACT distribution as requested: 3 WNBA + 7 MLB = 10 total
        distribution = {
            "WNBA": 3 if sport_counts["WNBA"] > 0 else 0,  # WNBA first (saved first to DB)
            "MLB": 7 if sport_counts["MLB"] > 0 else 0     # MLB second
        }
        
        # Adjust if we don't have enough games in a sport
        if distribution["WNBA"] > sport_counts["WNBA"]:
            # If not enough WNBA games, give remaining to MLB
            remaining_wnba = distribution["WNBA"] - sport_counts["WNBA"]
            distribution["WNBA"] = sport_counts["WNBA"]
            distribution["MLB"] += remaining_wnba
            
        if distribution["MLB"] > sport_counts["MLB"]:
            # If not enough MLB games, cap at available
            distribution["MLB"] = sport_counts["MLB"]
        
        logger.info(f"Props distribution: {distribution}")
        return distribution
    
    async def generate_daily_picks(self, target_picks: int = 10) -> List[Dict[str, Any]]:
        logger.info("🚀 Starting intelligent multi-sport player props analysis...")
        
        games = self.db.get_tomorrow_games()
        logger.info(f"📅 Found {len(games)} tomorrow games across MLB and WNBA")
        
        if not games:
            logger.warning("No upcoming games found")
            return []
        
        # Get sport distribution for props
        sport_distribution = self._distribute_props_by_sport(games, target_picks)
        
        game_ids = [game["id"] for game in games]
        available_props = self.db.get_player_props_for_games(game_ids)
        logger.info(f"🎯 Found {len(available_props)} available player props across all sports")
        
        if not available_props:
            logger.warning("No player props found")
            return []
        
        research_plan = await self.create_research_plan(available_props, games)
        statmuse_count = len(research_plan.get("statmuse_queries", []))
        web_search_count = len(research_plan.get("web_searches", []))
        total_queries = statmuse_count + web_search_count
        logger.info(f"📋 Created research plan with {statmuse_count} StatMuse + {web_search_count} web queries = {total_queries} total")
        
        insights = await self.execute_research_plan(research_plan, available_props)
        logger.info(f"🔍 Gathered {len(insights)} research insights across all stages")
        
        picks = await self.generate_picks_with_reasoning(insights, available_props, games, target_picks)
        logger.info(f"🎲 Generated {len(picks)} intelligent picks")
        
        if picks:
            self.db.store_ai_predictions(picks)
            logger.info(f"💾 Stored {len(picks)} picks in database")
        
        return picks
    
    def scrape_statmuse_context(self) -> Dict[str, Any]:
        """Scrape StatMuse main pages for current context and insights"""
        try:
            logger.info("🔍 Scraping StatMuse main pages for current context...")
            response = self.session.get(
                f"{self.statmuse_base_url}/scrape-context",
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                logger.info("✅ StatMuse context scraping successful")
                return result.get('context', {})
            else:
                logger.warning(f"⚠️ StatMuse context scraping failed: {result.get('error')}")
                return {}
        except Exception as e:
            logger.error(f"❌ StatMuse context scraping error: {e}")
            return {}
    
    async def create_research_plan(self, props: List[PlayerProp], games: List[Dict]) -> Dict[str, Any]:
        """Create intelligent research plan based on actual available props data and current StatMuse context"""
        
        # STEP 1: Scrape StatMuse main pages for current context
        statmuse_context = self.scrape_statmuse_context()
        
        # STEP 2: Analyze the actual props data to understand what we're working with
        props_analysis = self._analyze_available_props(props, games)
        
        # Get sport distribution for balanced research
        sport_distribution = props_analysis.get('sport_distribution', {})
        wnba_props = sport_distribution.get('WNBA', 0)
        mlb_props = sport_distribution.get('MLB', 0)
        
        # Calculate research allocation based on PICK NEEDS, not prop counts
        # Need 7 MLB picks vs 3 WNBA picks = 70% MLB research, 30% WNBA research
        
        # Fixed allocation based on actual pick distribution needs
        if wnba_props > 0 and mlb_props > 0:
            # Both sports available - prioritize MLB since we need 7 picks vs 3 WNBA
            target_wnba_queries = 8   # 8 diverse WNBA players for 3 picks
            target_mlb_queries = 15   # 15 diverse MLB players for 7 picks
        elif mlb_props > 0:
            # Only MLB available
            target_wnba_queries = 0
            target_mlb_queries = 20
        elif wnba_props > 0:
            # Only WNBA available
            target_wnba_queries = 15
            target_mlb_queries = 0
        else:
            # No props available
            target_wnba_queries = 0
            target_mlb_queries = 0
        
        logger.info(f"🎯 Research allocation: WNBA={target_wnba_queries}, MLB={target_mlb_queries}, Total={target_wnba_queries + target_mlb_queries}")
        
        prompt = f"""You are an elite sports betting analyst creating a BALANCED DIVERSE research strategy.

# CRITICAL REQUIREMENTS - BALANCED RESEARCH STRATEGY:

## RESEARCH ALLOCATION (MUST FOLLOW EXACTLY):
- **MLB PRIORITY**: {target_mlb_queries} different MLB players (for 7 final picks - MAIN FOCUS)
- **WNBA Secondary**: {target_wnba_queries} different WNBA players (for 3 final picks - SECONDARY)
- **Total StatMuse Queries**: {target_wnba_queries + target_mlb_queries}
- **Web Searches**: 5 total (3 MLB injury/lineup, 2 WNBA injury/lineup)
- **CRITICAL**: Do MORE MLB research since we need 7 MLB picks vs only 3 WNBA picks!

## DIVERSITY REQUIREMENTS:
- **NO REPETITIVE STAR PICKS**: Avoid A'ja Wilson, Breanna Stewart every time
- **RESEARCH DIFFERENT PLAYERS**: Mix stars, role players, value plays
- **VARIED PROP TYPES**: Don't just research points - include rebounds, assists, hits, home runs, etc.
- **TEAM VARIETY**: Research players from different teams, not just popular teams

# AVAILABLE PROPS DATA:
{json.dumps(props_analysis, indent=2)}

# CURRENT STATMUSE CONTEXT:
{json.dumps(statmuse_context, indent=2)}

# YOUR TASK:
Generate a research plan that follows the EXACT allocation above and focuses on DIVERSE players from the actual props data.

**WNBA Focus**: Research {target_wnba_queries} DIFFERENT WNBA players (mix of stars, role players, value opportunities)
**MLB Focus**: Research {target_mlb_queries} DIFFERENT MLB players (variety of batters, pitchers, different teams)

Return ONLY valid JSON:
{{
    "analysis_summary": "Balanced research strategy focusing on diversity",
    "statmuse_queries": [
        // {target_wnba_queries} WNBA player queries (different players, varied prop types)
        // {target_mlb_queries} MLB player queries (different players, varied prop types)
        {{
            "query": "[Diverse Player Name] [varied stat] this season",
            "priority": "high/medium/low",
            "sport": "WNBA/MLB"
        }}
    ],
    "web_searches": [
        // 3 MLB injury/lineup searches, 2 WNBA injury/lineup searches
        {{
            "query": "[Player Name] injury status lineup news",
            "priority": "high/medium/low",
            "sport": "WNBA/MLB"
        }}
    ]
}}

**CRITICAL**: Use REAL diverse players from the props data above. NO repetitive A'ja Wilson/Breanna Stewart pattern!"""
        
        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-4-0709",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            
            plan_text = response.choices[0].message.content
            start_idx = plan_text.find("{")
            end_idx = plan_text.rfind("}") + 1
            plan_json = json.loads(plan_text[start_idx:end_idx])
            
            return plan_json
            
        except Exception as e:
            logger.error(f"Failed to create research plan: {e}")
            return self._create_fallback_research_plan(props)
    
    def _analyze_available_props(self, props: List[PlayerProp], games: List[Dict]) -> Dict[str, Any]:
        """Analyze the actual props data to understand what's available"""
        
        # Group props by sport
        props_by_sport = {}
        players_by_sport = {}
        prop_types_by_sport = {}
        
        for prop in props:
            # Determine sport from games data with better team matching
            sport = "Unknown"
            for game in games:
                home_team = game.get('home_team', '').lower()
                away_team = game.get('away_team', '').lower()
                prop_team = prop.team.lower()
                
                # Try exact match first, then partial match
                if (prop_team == home_team or prop_team == away_team or
                    prop_team in home_team or prop_team in away_team or
                    home_team in prop_team or away_team in prop_team):
                    sport = game.get('sport', 'Unknown')
                    break
            
            # Normalize sport names
            if sport == "Women's National Basketball Association":
                sport = "WNBA"
            elif sport == "Major League Baseball":
                sport = "MLB"
            
            if sport not in props_by_sport:
                props_by_sport[sport] = []
                players_by_sport[sport] = set()
                prop_types_by_sport[sport] = set()
            
            props_by_sport[sport].append({
                "player": prop.player_name,
                "prop_type": prop.prop_type,
                "line": prop.line,
                "over_odds": prop.over_odds,
                "under_odds": prop.under_odds,
                "team": prop.team
            })
            
            players_by_sport[sport].add(prop.player_name)
            prop_types_by_sport[sport].add(prop.prop_type)
        
        # Create analysis summary
        analysis = {
            "total_props": len(props),
            "sports_breakdown": {},
            "sport_distribution": {},  # Add this for research allocation
            "top_players_by_sport": {},
            "prop_types_by_sport": {},
            "sample_props_by_sport": {}
        }
        
        for sport, sport_props in props_by_sport.items():
            analysis["sports_breakdown"][sport] = len(sport_props)
            analysis["sport_distribution"][sport] = len(sport_props)  # Same as sports_breakdown for now
            analysis["top_players_by_sport"][sport] = list(players_by_sport[sport])[:15]
            analysis["prop_types_by_sport"][sport] = list(prop_types_by_sport[sport])
            analysis["sample_props_by_sport"][sport] = sport_props[:20]  # Sample for analysis
        
        return analysis
    
    def _create_fallback_research_plan(self, props: List[PlayerProp]) -> Dict[str, Any]:
        """Create a basic research plan if AI planning fails"""
        
        # Get diverse set of players and prop types
        unique_players = list(set(prop.player_name for prop in props))[:15]
        unique_prop_types = list(set(prop.prop_type for prop in props))
        
        return {
            "analysis_summary": "Fallback research plan based on available props",
            "statmuse_queries": [{
                "query": f"{player} {prop_type.replace('Batter ', '').replace('Player ', '').lower()} this season",
                "priority": "medium"
            } for player, prop_type in zip(unique_players[:8], unique_prop_types[:8])],
            "web_searches": [{
                "query": f"{player} injury status and recent news",
                "priority": "medium"
            } for player in unique_players[:3]]
        }
    
    async def execute_research_plan(self, plan: Dict[str, Any], props: List[PlayerProp]) -> List[ResearchInsight]:
        all_insights = []
        
        logger.info("🔬 STAGE 1: Initial Research")
        stage1_insights = await self._execute_initial_research(plan)
        all_insights.extend(stage1_insights)
        
        logger.info("🧠 STAGE 2: Analyzing findings and generating follow-up research")
        stage2_insights = await self._execute_adaptive_followup(stage1_insights, props)
        all_insights.extend(stage2_insights)
        
        logger.info("🎯 STAGE 3: Final Targeted Research")
        stage3_insights = await self._execute_final_research(all_insights, props)
        all_insights.extend(stage3_insights)
        
        logger.info(f"🔍 Total research insights gathered: {len(all_insights)}")
        return all_insights
    
    async def _execute_initial_research(self, plan: Dict[str, Any]) -> List[ResearchInsight]:
        insights = []
        
        statmuse_queries = plan.get("statmuse_queries", [])[:8]
        web_searches = plan.get("web_searches", [])[:3]
        
        # BALANCED LIMITS: More MLB research since 7 picks needed vs 3 WNBA picks
        max_statmuse = min(18, len(statmuse_queries))  # Reasonable limit for both sports
        max_web = min(12, len(web_searches))  # Focused web searches
        
        for query_obj in statmuse_queries[:max_statmuse]:
            try:
                query_text = query_obj.get("query", query_obj) if isinstance(query_obj, dict) else query_obj
                priority = query_obj.get("priority", "medium") if isinstance(query_obj, dict) else "medium"
                
                logger.info(f"🔍 StatMuse query ({priority}): {query_text}")
                result = self.statmuse.query(query_text)
                
                if result and "error" not in result:
                    result_preview = str(result)[:200] + "..." if len(str(result)) > 200 else str(result)
                    logger.info(f"📊 StatMuse result: {result_preview}")
                    
                    confidence = 0.9 if priority == "high" else 0.7 if priority == "medium" else 0.5
                    insights.append(ResearchInsight(
                        source="statmuse",
                        query=query_text,
                        data=result,
                        confidence=confidence,
                        timestamp=datetime.now()
                    ))
                else:
                    logger.warning(f"❌ StatMuse query failed: {result}")
                
                await asyncio.sleep(1.5)
                
            except Exception as e:
                logger.error(f"❌ StatMuse query failed for \'{query_text}\': {e}")
        
        web_searches = plan.get("web_searches", [])[:3]
        for search_obj in web_searches:
            try:
                search_query = search_obj.get("query", search_obj) if isinstance(search_obj, dict) else search_obj
                priority = search_obj.get("priority", "medium") if isinstance(search_obj, dict) else "medium"
                
                logger.info(f"🌐 Web search ({priority}): {search_query}")
                result = self.web_search.search(search_query)
                
                confidence = 0.8 if priority == "high" else 0.6 if priority == "medium" else 0.4
                insights.append(ResearchInsight(
                    source="web_search",
                    query=search_query,
                    data=result,
                    confidence=confidence,
                    timestamp=datetime.now()
                ))
                
            except Exception as e:
                logger.error(f"❌ Initial web search failed for \'{search_query}\': {e}")
        
        return insights
    
    async def _execute_adaptive_followup(self, initial_insights: List[ResearchInsight], props: List[PlayerProp]) -> List[ResearchInsight]:
        insights_summary = []
        for insight in initial_insights:
            insights_summary.append({
                "source": insight.source,
                "query": insight.query,
                "data": str(insight.data)[:600],
                "confidence": insight.confidence
            })
        
        top_props = [{
            "player": prop.player_name,
            "prop_type": prop.prop_type,
            "line": prop.line,
            "over_odds": prop.over_odds,
            "under_odds": prop.under_odds
        } for prop in props[:30]]
        
        prompt = f"""
You are analyzing initial research findings to identify gaps and generate intelligent follow-up queries.

INITIAL RESEARCH FINDINGS:
{json.dumps(insights_summary, indent=2)}

AVAILABLE PROPS TO ANALYZE:
{json.dumps(top_props, indent=2)}

Based on these findings, identify:
1. **KNOWLEDGE GAPS**: What key information is missing?
2. **SURPRISING FINDINGS**: Any results that suggest new research directions?
3. **PROP MISMATCHES**: Props that need more specific research?

Generate ADAPTIVE follow-up queries that will fill these gaps.

Return JSON with this structure:
{{
    "analysis": "Brief analysis of findings and gaps identified",
    "followup_statmuse_queries": [
        {{
            "query": "Specific StatMuse question",
            "reasoning": "Why this query is needed based on initial findings",
            "priority": "high/medium/low"
        }}
    ],
    "followup_web_searches": [
        {{
            "query": "Web search query",
            "reasoning": "Why this search is needed",
            "priority": "high/medium/low"
        }}
    ]
}}

Generate 3-6 high-value follow-up queries that will maximize our edge.
"""
        
        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-4-0709",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4
            )
            
            followup_text = response.choices[0].message.content
            start_idx = followup_text.find("{")
            end_idx = followup_text.rfind("}") + 1
            followup_plan = json.loads(followup_text[start_idx:end_idx])
            
            # Execute the follow-up queries
            followup_insights = []
            
            # Execute StatMuse follow-up queries
            for query_obj in followup_plan.get("followup_statmuse_queries", [])[:5]:
                try:
                    query_text = query_obj.get("query", query_obj) if isinstance(query_obj, dict) else query_obj
                    priority = query_obj.get("priority", "medium") if isinstance(query_obj, dict) else "medium"
                    
                    logger.info(f"🔍 Follow-up StatMuse ({priority}): {query_text}")
                    result = self.statmuse.query(query_text)
                    
                    if result and "error" not in result:
                        confidence = 0.9 if priority == "high" else 0.7 if priority == "medium" else 0.5
                        followup_insights.append(ResearchInsight(
                            source="statmuse_followup",
                            query=query_text,
                            data=result,
                            confidence=confidence,
                            timestamp=datetime.now()
                        ))
                    
                    await asyncio.sleep(1.5)
                    
                except Exception as e:
                    logger.error(f"❌ Follow-up StatMuse query failed: {e}")
            
            # Execute web follow-up searches
            for search_obj in followup_plan.get("followup_web_searches", [])[:3]:
                try:
                    search_query = search_obj.get("query", search_obj) if isinstance(search_obj, dict) else search_obj
                    priority = search_obj.get("priority", "medium") if isinstance(search_obj, dict) else "medium"
                    
                    logger.info(f"🌐 Follow-up web search ({priority}): {search_query}")
                    result = self.web_search.search(search_query)
                    
                    if result:
                        confidence = 0.8 if priority == "high" else 0.6 if priority == "medium" else 0.4
                        followup_insights.append(ResearchInsight(
                            source="web_followup",
                            query=search_query,
                            data=result,
                            confidence=confidence,
                            timestamp=datetime.now()
                        ))
                    
                    await asyncio.sleep(0.5)
                    
                except Exception as e:
                    logger.error(f"❌ Follow-up web search failed: {e}")
            
            return followup_insights
            
        except Exception as e:
            logger.error(f"Failed to generate adaptive follow-up: {e}")
            return []
    
    async def _execute_final_research(self, all_insights: List[ResearchInsight], props: List[PlayerProp]) -> List[ResearchInsight]:
        final_insights = []
        
        statmuse_count = len([i for i in all_insights if "statmuse" in i.source])
        web_count = len([i for i in all_insights if "web" in i.source])
        
        logger.info(f"📊 Research Summary: {statmuse_count} StatMuse + {web_count} Web insights")
        
        if len(all_insights) < 8:
            logger.info("🎯 Adding final broad research queries")
            # Could add more research here if needed
        
        return final_insights
    
    async def generate_picks_with_reasoning(
        self, 
        insights: List[ResearchInsight], 
        props: List[PlayerProp], 
        games: List[Dict],
        target_picks: int
    ) -> List[Dict[str, Any]]:
        insights_summary = []
        for insight in insights[:40]:
            insights_summary.append({
                "source": insight.source,
                "query": insight.query,
                "data": str(insight.data)[:800],
                "confidence": insight.confidence,
                "timestamp": insight.timestamp.isoformat()
            })
        
        MAX_ODDS = 350
        
        filtered_props = []
        long_shot_count = 0
        
        for prop in props:
            # Allow props with either over OR under odds (not requiring both)
            has_over = prop.over_odds is not None
            has_under = prop.under_odds is not None
            
            # Must have at least one side with reasonable odds
            if has_over or has_under:
                over_reasonable = not has_over or abs(prop.over_odds) <= MAX_ODDS
                under_reasonable = not has_under or abs(prop.under_odds) <= MAX_ODDS
                
                if over_reasonable and under_reasonable:
                    filtered_props.append(prop)
                else:
                    long_shot_count += 1
                    over_str = f"+{prop.over_odds}" if prop.over_odds and prop.over_odds > 0 else str(prop.over_odds) if prop.over_odds else "N/A"
                    under_str = f"+{prop.under_odds}" if prop.under_odds and prop.under_odds > 0 else str(prop.under_odds) if prop.under_odds else "N/A"
                    logger.info(f"🚫 Filtered long shot: {prop.player_name} {prop.prop_type} (Over: {over_str}, Under: {under_str})")
            else:
                long_shot_count += 1
                logger.info(f"🚫 Filtered no odds: {prop.player_name} {prop.prop_type} (no odds available)")
        
        logger.info(f"🎯 Filtered props: {len(props)} → {len(filtered_props)} (removed {long_shot_count} long shots with odds > +{MAX_ODDS})")
        
        props_data = []
        for prop in filtered_props:
            props_data.append({
                "player": prop.player_name,
                "prop_type": prop.prop_type,
                "line": prop.line,
                "over_odds": prop.over_odds,
                "under_odds": prop.under_odds,
                "team": prop.team,
                "event_id": prop.event_id,
                "bookmaker": prop.bookmaker
            })
        
        games_info = json.dumps(games[:10], indent=2, default=str)
        props_info = json.dumps(props_data, indent=2)
        research_summary = json.dumps(insights_summary, indent=2)
        
        props = filtered_props
        
        prompt = f"""
You are a professional sports betting analyst with 15+ years experience handicapping multi-sport player props (MLB, WNBA).
Your job is to find PROFITABLE betting opportunities across all sports, not just predict outcomes.

🏆 **SPORT EXPERTISE:**
- **MLB**: Batter performance trends, pitcher matchups, weather impacts, ballpark factors
- **WNBA**: Player usage rates, pace of play, defensive matchups, rest/travel factors

TODAY\'S DATA:

🏟️ UPCOMING GAMES ({len(games)}):
{games_info}

🎯 AVAILABLE PLAYER PROPS ({len(filtered_props)}) - **ONLY PICK FROM THESE FILTERED PROPS**:
{props_info}

💡 **SMART FILTERING**: Long shot props (odds > +400) have been removed to focus on PROFITABLE opportunities.

⚠️  **CRITICAL**: You MUST pick from the exact player names and prop types listed above. 
Available prop types in this data: {set(prop.prop_type for prop in filtered_props[:50])}
Available players in this data: {list(set(prop.player_name for prop in filtered_props[:30]))[:20]}

🔍 RESEARCH INSIGHTS ({len(insights_summary)}):

**STATMUSE DATA FINDINGS:**
{self._format_statmuse_insights(insights_summary)}

**WEB SEARCH INTEL:**
{self._format_web_insights(insights_summary)}

**RAW RESEARCH DATA:**
{research_summary}

TASK: Generate exactly {target_picks + 5} strategic player prop picks that maximize expected value and long-term profit.

🚨 **MANDATORY SPORT DISTRIBUTION:**
- Generate EXACTLY 5 WNBA player prop picks FIRST (extras will be filtered to 3 best)
- Generate EXACTLY 10 MLB player prop picks AFTER (extras will be filtered to 7 best)
- Total must be exactly 15 picks (5 WNBA + 10 MLB) - system will select best 10
- Generate EXTRA picks to account for filtering of picks with missing odds

🔍 **COMPREHENSIVE ANALYSIS REQUIRED:**
- You have access to {len(filtered_props)} total player props across all games
- DO NOT just pick the same star players repeatedly (Wilson, Stewart, etc.)
- ANALYZE THE ENTIRE POOL of available props before making selections
- Research data covers ALL players with props - use this broad analysis
- Look for VALUE in lesser-known players, not just popular names
- DIVERSIFY prop types: points, rebounds, assists, hits, home runs, RBIs, etc.
- Select the BEST 10 picks from your comprehensive analysis of ALL options

🚨 **BETTING DISCIPLINE REQUIREMENTS:**
1. **MANDATORY ODDS CHECK**: Before picking, check the over_odds and under_odds in the data
2. **ONLY PICK PROPS WITH BOTH ODDS**: Skip any prop where over_odds OR under_odds is null/missing
3. **NO HIGH-ODDS PICKS**: Never pick sides with odds higher than +350 (even if available)
4. **AVOID LONG SHOTS**: Props with +400, +500, +950, +1300 odds are SUCKER BETS - ignore them!
5. **FOCUS ON VALUE RANGE**: Target odds between -250 and +250 for best long-term profit
6. **DIVERSIFY PROP TYPES**: 
   - **MLB**: Hits, Home Runs, RBIs, Runs Scored, Stolen Bases, Total Bases
   - **WNBA**: Points, Rebounds, Assists (see available props below)
7. **MIX OVER/UNDER**: Don\'t just pick all overs - find spots where under has value
8. **REALISTIC CONFIDENCE**: Most picks should be 55-65% confidence (sharp betting range)
9. **VALUE HUNTING**: Focus on lines that seem mispriced based on data

PROFITABLE BETTING STRATEGY:
- **Focus on -200 to +200 odds**: This is the profitable betting sweet spot
- **0.5 Hit props**: Look for struggling hitters vs tough pitchers (UNDER value)
- **1.5 Hit props**: Target hot hitters vs weak pitching (OVER value)  
- **1.5 Total Base props**: Consider park factors, weather, matchup history
- **Fade public favorites**: Elite players often have inflated lines
- **Target situational spots**: Day games, travel, pitcher handedness
- **Avoid "lottery tickets"**: High-odds props (+500+) are designed to lose money

CONFIDENCE SCALE (BE REALISTIC):
- 52-55%: Marginal edge, small value (only if great odds)
- 56-60%: Solid spot, good value (most picks should be here)
- 61-65%: Strong conviction, clear edge
- 66-70%: Exceptional opportunity (very rare)

💰 **REMEMBER**: Professional bettors win by finding small edges consistently, NOT by chasing big payouts!
- 71%+: Only for obvious mispricing

FORMAT RESPONSE AS JSON ARRAY:
[
  {{
    "player_name": "Full Player Name",
    "prop_type": "Hits", "Home Runs", "RBIs", "Runs Scored", "Stolen Bases", "Hits Allowed", "Innings Pitched", "Strikeouts (Pitcher)", "Walks Allowed",
    "recommendation": "over" or "under",
    "line": line_value,
    "odds": american_odds_value,
    "confidence": confidence_percentage,
    "reasoning": "2-3 sentence sharp analysis. Focus on key edge found.",
    "key_factors": ["factor_1", "factor_2", "factor_3"],
    "roi_estimate": "percentage like 8.5% or 12.3%",
    "value_percentage": "percentage like 15.2% or 22.8%",
    "implied_probability": "percentage like 45.5% or 62.1%",
    "fair_odds": "what the odds should be like -140 or +165"
  }}
]

🧮 **CALCULATION REQUIREMENTS:**

**ROI Estimate:** (Expected Win Amount / Risk Amount) - 1
- Example: If you bet $100 at +150 odds with 55% win rate: ROI = (55% × $150 - 45% × $100) / $100 = 37.5%
- Target range: 5-25% for sustainable profit

**Value Percentage:** (Your Win Probability - Implied Probability) × 100
- Example: You think 60% chance, odds imply 52% = 8% value
- Positive value = good bet, negative value = bad bet

**Implied Probability:** Convert American odds to probability
- Positive odds: 100 / (odds + 100)
- Negative odds: |odds| / (|odds| + 100)

**Fair Odds:** What odds should be based on your confidence
- If you think 60% chance: Fair odds = +67 (100/40 - 1)
- If you think 45% chance: Fair odds = +122 (100/45 - 1)

THINK LIKE A SHARP: Find spots where the oddsmakers may have made mistakes or where public perception differs from reality.

REMEMBER:
- **DIVERSIFY ACROSS ALL PROP TYPES**: Use Hits, Home Runs, RBIs, Runs Scored, Stolen Bases, and Pitcher props
- Mix overs and unders based on VALUE, not bias  
- Keep confidence realistic (most picks 55-65%)
- Focus on profitable opportunities, not just likely outcomes
- Each pick should be one you\'d bet your own money on
- **Available Batter Props**: Hits, Home Runs, RBIs, Runs Scored, Stolen Bases
- **Available Pitcher Props**: Hits Allowed, Innings Pitched, Strikeouts, Walks Allowed

**CRITICAL ODDS RULES:**
- **NEVER recommend "UNDER 0.5 Home Runs"** - impossible (can't get negative home runs)
- **NEVER recommend "UNDER 0.5 Stolen Bases"** - impossible (can't get negative steals)
- **Only recommend props where both over/under make logical sense**
- **Home Runs 0.5**: Only bet OVER (under is impossible)
- **Stolen Bases 0.5**: Only bet OVER (under is impossible)
"""
        
        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-4-0709",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=4000
            )
            
            picks_text = response.choices[0].message.content.strip()
            logger.info(f"🧠 Grok raw response: {picks_text[:500]}...")
            
            start_idx = picks_text.find("[")
            end_idx = picks_text.rfind("]") + 1
            
            if start_idx == -1 or end_idx == 0:
                logger.error("No JSON array found in Grok response")
                return []
            
            json_str = picks_text[start_idx:end_idx]
            ai_picks = json.loads(json_str)
            
            formatted_picks = []
            for pick in ai_picks:
                matching_prop = self._find_matching_prop(pick, props)
                
                if matching_prop:
                    # CRITICAL: Validate that the pick has valid odds for the recommendation
                    recommendation = pick.get("recommendation", "").lower()
                    prop_type = pick.get("prop_type", "").lower()
                    line = float(pick.get("line", 0))
                    
                    # Check for impossible props that should be skipped
                    is_impossible = False
                    
                    # Home runs under 0.5 is impossible (can't get negative home runs)
                    if "home run" in prop_type and recommendation == "under" and line <= 0.5:
                        logger.warning(f"🚫 Skipping impossible prop: {pick['player_name']} {prop_type} UNDER {line} (impossible)")
                        is_impossible = True
                    
                    # Stolen bases under 0.5 is impossible
                    if "stolen base" in prop_type and recommendation == "under" and line <= 0.5:
                        logger.warning(f"🚫 Skipping impossible prop: {pick['player_name']} {prop_type} UNDER {line} (impossible)")
                        is_impossible = True
                    
                    # Check if the recommendation has valid odds
                    if not is_impossible:
                        if recommendation == "over" and matching_prop.over_odds is None:
                            logger.warning(f"🚫 Skipping pick with missing over odds: {pick['player_name']} {prop_type} OVER {line}")
                            is_impossible = True
                        elif recommendation == "under" and matching_prop.under_odds is None:
                            logger.warning(f"🚫 Skipping pick with missing under odds: {pick['player_name']} {prop_type} UNDER {line}")
                            is_impossible = True
                    
                    if is_impossible:
                        continue
                    
                    game = next((g for g in games if str(g.get("id")) == str(matching_prop.event_id)), None)
                    
                    # Determine sport from game data, not hardcoded
                    sport = "MLB"  # default
                    if game:
                        game_sport = game.get('sport', 'MLB')
                        if game_sport == "Women's National Basketball Association":
                            sport = "WNBA"
                        elif game_sport == "Major League Baseball":
                            sport = "MLB"
                        elif game_sport == "Ultimate Fighting Championship":
                            sport = "UFC"
                        
                        # Create proper game info with team matchup
                        home_team = game.get('home_team', 'Unknown')
                        away_team = game.get('away_team', 'Unknown')
                        game_info = f"{away_team} @ {home_team}"
                    else:
                        # Fallback: try to determine sport from player name patterns
                        player_name = pick.get('player_name', '').lower()
                        wnba_players = ['paige bueckers', 'arike ogunbowale', 'skylar diggins-smith', 
                                       'nneka ogwumike', 'gabby williams', 'li yueru', 'erica wheeler']
                        if any(wnba_player in player_name for wnba_player in wnba_players):
                            sport = "WNBA"
                        game_info = f"{matching_prop.team} game"
                    
                    formatted_picks.append({
                        "match_teams": game_info,
                        "pick": self._format_pick_string(pick, matching_prop),
                        "odds": pick.get("odds") or (
                            matching_prop.over_odds if pick["recommendation"] == "over" and matching_prop.over_odds is not None
                            else matching_prop.under_odds if pick["recommendation"] == "under" and matching_prop.under_odds is not None
                            else None  # Don't use wrong odds as fallback
                        ),
                        "confidence": pick.get("confidence", 75),
                        "sport": sport,
                        "event_time": game.get("start_time") if game else None,
                        "bet_type": "player_prop",
                        "bookmaker": matching_prop.bookmaker,
                        "event_id": matching_prop.event_id,
                        "team": matching_prop.team,
                        "metadata": {
                            "player_name": pick["player_name"],
                            "prop_type": pick["prop_type"],
                            "line": pick["line"],
                            "recommendation": pick["recommendation"],
                            "reasoning": pick.get("reasoning", "AI-generated pick"),
                            "roi_estimate": pick.get("roi_estimate", "0%"),
                            "value_percentage": pick.get("value_percentage", "0%"),
                            "implied_probability": pick.get("implied_probability", "50%"),
                            "fair_odds": pick.get("fair_odds", pick.get("odds", 0)),
                            "key_factors": pick.get("key_factors", []),
                            "risk_level": pick.get("risk_level", "medium"),
                            "expected_value": pick.get("expected_value", "Positive EV expected"),
                            "research_support": pick.get("research_support", "Based on comprehensive analysis"),
                            "ai_generated": True,
                            "research_insights_count": len(insights),
                            "model_used": "grok-4-0709"
                        }
                    })
                else:
                    logger.warning(f"No matching prop found for {pick.get("player_name")} {pick.get("prop_type")}")
            
            # Select best picks with proper sport distribution: 3 WNBA + 7 MLB
            wnba_picks = [p for p in formatted_picks if p["sport"] == "WNBA"]
            mlb_picks = [p for p in formatted_picks if p["sport"] == "MLB"]
            
            # Take best picks from each sport (sorted by confidence)
            wnba_picks.sort(key=lambda x: x["confidence"], reverse=True)
            mlb_picks.sort(key=lambda x: x["confidence"], reverse=True)
            
            final_picks = wnba_picks[:3] + mlb_picks[:7]  # 3 WNBA + 7 MLB = 10 total
            
            logger.info(f"🎯 Final selection: {len(wnba_picks[:3])} WNBA + {len(mlb_picks[:7])} MLB = {len(final_picks)} total picks")
            
            if final_picks:
                prop_types = {}
                recommendations = {"over": 0, "under": 0}
                confidence_ranges = {"50-60": 0, "61-70": 0, "71+": 0}
                
                for pick in final_picks:
                    prop_type = pick["metadata"]["prop_type"]
                    prop_types[prop_type] = prop_types.get(prop_type, 0) + 1
                    
                    rec = pick["metadata"]["recommendation"]
                    recommendations[rec] += 1
                    
                    conf = pick["confidence"]
                    if conf <= 60:
                        confidence_ranges["50-60"] += 1
                    elif conf <= 70:
                        confidence_ranges["61-70"] += 1
                    else:
                        confidence_ranges["71+"] += 1
                
                logger.info(f"📊 Pick Diversity Analysis:")
                logger.info(f"  Prop Types: {dict(prop_types)}")
                logger.info(f"  Over/Under: {dict(recommendations)}")
                logger.info(f"  Confidence Ranges: {dict(confidence_ranges)}")
                
                logger.info(f"📝 Generated {len(final_picks)} diverse picks:")
                for i, pick in enumerate(final_picks, 1):
                    meta = pick["metadata"]
                    logger.info(f"  {i}. {meta["player_name"]} {meta["prop_type"]} {meta["recommendation"].upper()} {meta["line"]} ({pick["confidence"]}% conf)")
            
            return final_picks
            
        except Exception as e:
            logger.error(f"Failed to generate picks: {e}")
            return []

    def _format_statmuse_insights(self, insights_summary: List[Dict]) -> str:
        statmuse_insights = [i for i in insights_summary if i.get("source") == "statmuse"]
        if not statmuse_insights:
            return "No StatMuse data available"
        
        formatted = []
        for insight in statmuse_insights[:10]:
            query = insight.get("query", "")
            data = insight.get("data", "")
            confidence = insight.get("confidence", 0.5)
            
            data_clean = str(data).replace("{", "").replace("}", "").replace("\"", "")
            if len(data_clean) > 300:
                data_clean = data_clean[:300] + "..."
            
            formatted.append(f"• Q: {query}\n  A: {data_clean} (confidence: {confidence:.1f})")
        
        return "\n\n".join(formatted)
    
    def _format_web_insights(self, insights_summary: List[Dict]) -> str:
        web_insights = [i for i in insights_summary if i.get("source") == "web_search"]
        if not web_insights:
            return "No web search data available"
        
        formatted = []
        for insight in web_insights[:5]:
            query = insight.get("query", "")
            data = insight.get("data", "")
            
            data_clean = str(data).replace("{", "").replace("}", "").replace("\"", "")
            if len(data_clean) > 200:
                data_clean = data_clean[:200] + "..."
            
            formatted.append(f"• Search: {query}\n  Result: {data_clean}")
        
        return "\n\n".join(formatted)
    
    def _find_matching_prop(self, pick: Dict, props: List[PlayerProp]) -> PlayerProp:
        player_name = pick.get("player_name", "")
        prop_type = pick.get("prop_type", "")
        
        exact_match = next(
            (p for p in props 
             if p.player_name == player_name and p.prop_type == prop_type),
            None
        )
        if exact_match:
            return exact_match
        
        name_variations = [
            player_name,
            player_name.replace(" Jr.", ""),
            player_name.replace(" Sr.", ""),
            player_name.replace(".", ""),
        ]
        
        for name_var in name_variations:
            fuzzy_match = next(
                (p for p in props 
                 if name_var.lower() in p.player_name.lower() 
                 and p.prop_type == prop_type),
                None
            )
            if fuzzy_match:
                logger.info(f"✅ Fuzzy matched \'{player_name}\' to \'{fuzzy_match.player_name}\'")
                return fuzzy_match
        
        prop_type_mappings = {
            "Batter Hits O/U": ["batter_hits", "hits"],
            "Batter Total Bases O/U": ["batter_total_bases", "total_bases"],
            "Batter Home Runs O/U": ["batter_home_runs", "home_runs"],
            "Batter RBIs O/U": ["batter_rbis", "rbis"]
        }
        
        for mapped_type, variations in prop_type_mappings.items():
            if prop_type == mapped_type:
                for var in variations:
                    prop_var_match = next(
                        (p for p in props 
                         if p.player_name == player_name and var in p.prop_type.lower()),
                        None
                    )
                    if prop_var_match:
                        logger.info(f"✅ Prop type matched \'{prop_type}\' to \'{prop_var_match.prop_type}\'")
                        return prop_var_match
        
        available_for_player = [p.prop_type for p in props if p.player_name == player_name]
        logger.warning(f"❌ No match for {player_name} {prop_type}. Available for this player: {available_for_player[:5]}")
        
        return None

    def _format_pick_string(self, pick: Dict, matching_prop: PlayerProp) -> str:
        """Formats the pick string for clarity."""
        player_name = pick.get("player_name", "")
        prop_type = pick.get("prop_type", "")
        recommendation = pick.get("recommendation", "").lower()
        line = pick.get("line")

        if prop_type in ["Hits", "Home Runs", "RBIs", "Runs Scored", "Stolen Bases"]:
            return f"{player_name} {prop_type} {recommendation.capitalize()} {line}"
        elif prop_type in ["Hits Allowed", "Innings Pitched", "Strikeouts (Pitcher)", "Walks Allowed"]:
            return f"{player_name} {prop_type} {recommendation.capitalize()} {line}"
        return f"{player_name} {prop_type} {recommendation} {line}" # Fallback

async def main():
    logger.info("🤖 Starting Intelligent Player Props Agent")
    
    agent = IntelligentPlayerPropsAgent()
    picks = await agent.generate_daily_picks(target_picks=10)
    
    if picks:
        logger.info(f"✅ Successfully generated {len(picks)} intelligent picks!")
        for i, pick in enumerate(picks, 1):
            logger.info(f"Pick {i}: {pick["pick"]} (Confidence: {pick["confidence"]}%)")
    else:
        logger.warning("❌ No picks generated")

if __name__ == "__main__":
    asyncio.run(main())


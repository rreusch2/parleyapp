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
class TeamBet:
    id: str
    home_team: str
    away_team: str
    bet_type: str
    recommendation: str
    odds: int
    line: Optional[float]
    event_id: str
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
    
    def get_tomorrow_games(self) -> List[Dict[str, Any]]:
        try:
            tomorrow_date = (datetime.now() + timedelta(days=1)).date()
            start_dt = datetime.combine(tomorrow_date, datetime.min.time())
            end_dt = start_dt + timedelta(days=1)
            start_iso = start_dt.isoformat()
            end_iso = end_dt.isoformat()
            
            # Fetch games from all supported sports
            all_games = []
            sports = ["Major League Baseball", "Women's National Basketball Association", "Ultimate Fighting Championship"]
            
            for sport in sports:
                response = self.supabase.table("sports_events").select(
                    "id, home_team, away_team, start_time, sport, metadata"
                ).gt("start_time", start_iso).lt("start_time", end_iso).eq("sport", sport).order("start_time").execute()
                
                if response.data:
                    logger.info(f"Found {len(response.data)} upcoming {sport} games")
                    all_games.extend(response.data)
            
            # Sort all games by start time
            all_games.sort(key=lambda x: x['start_time'])
            logger.info(f"Total tomorrow games across all sports: {len(all_games)}")
            return all_games
        except Exception as e:
            logger.error(f"Failed to fetch upcoming games: {e}")
            return []
    
    def get_team_odds_for_games(self, game_ids: List[str]) -> List[TeamBet]:
        if not game_ids:
            return []
        
        try:
            # Get the games with their metadata which contains the odds
            response = self.supabase.table("sports_events").select(
                "id, home_team, away_team, metadata"
            ).in_("id", game_ids).execute()
            
            bets = []
            for game in response.data:
                if not game.get("metadata") or not isinstance(game["metadata"], dict):
                    logger.warning(f"No metadata or invalid metadata for game {game['id']}")
                    continue
                
                # Extract odds from the correct metadata structure
                metadata = game["metadata"]
                full_data = metadata.get("full_data", {})
                bookmakers_data = full_data.get("bookmakers", [])
                
                if not bookmakers_data:
                    logger.warning(f"No bookmakers found for game {game['id']}")
                    continue
                
                # Prioritize FanDuel or DraftKings, otherwise use the first available bookmaker
                preferred_bookmakers = ["fanduel", "draftkings", "bovada", "betmgm"]
                selected_bookmaker = None
                
                # Try to find a preferred bookmaker
                for preferred in preferred_bookmakers:
                    for bookmaker in bookmakers_data:
                        if bookmaker.get("key") == preferred:
                            selected_bookmaker = bookmaker
                            break
                    if selected_bookmaker:
                        break
                
                # If no preferred bookmaker found, use the first one
                if not selected_bookmaker and bookmakers_data:
                    selected_bookmaker = bookmakers_data[0]
                
                if not selected_bookmaker:
                    logger.warning(f"No valid bookmaker data for game {game['id']}")
                    continue
                
                bookmaker_key = selected_bookmaker.get("key", "unknown")
                markets = selected_bookmaker.get("markets", [])
                
                # Process different bet types: h2h (moneyline), spreads, totals
                for market in markets:
                    market_key = market.get("key")
                    outcomes = market.get("outcomes", [])
                    
                    # 1. Moneyline (h2h)
                    if market_key == "h2h":
                        for outcome in outcomes:
                            team_name = outcome.get("name")
                            price = outcome.get("price")
                            
                            if team_name and price is not None:
                                is_home = team_name == game["home_team"]
                                recommendation = game["home_team"] if is_home else game["away_team"]
                                
                                bets.append(TeamBet(
                                    id=f"{game['id']}_ml_{'home' if is_home else 'away'}",
                                    home_team=game["home_team"],
                                    away_team=game["away_team"],
                                    bet_type="moneyline",
                                    recommendation=recommendation,
                                    odds=int(price),
                                    line=None,
                                    event_id=game["id"],
                                    bookmaker=bookmaker_key
                                ))
                    
                    # 2. Spread
                    elif market_key == "spreads":
                        for outcome in outcomes:
                            team_name = outcome.get("name")
                            point = outcome.get("point")
                            price = outcome.get("price")
                            
                            if team_name and point is not None and price is not None:
                                is_home = team_name == game["home_team"]
                                recommendation = game["home_team"] if is_home else game["away_team"]
                                
                                bets.append(TeamBet(
                                    id=f"{game['id']}_spread_{'home' if is_home else 'away'}",
                                    home_team=game["home_team"],
                                    away_team=game["away_team"],
                                    bet_type="spread",
                                    recommendation=recommendation,
                                    odds=int(price),
                                    line=float(point),
                                    event_id=game["id"],
                                    bookmaker=bookmaker_key
                                ))
                    
                    # 3. Totals
                    elif market_key == "totals":
                        for outcome in outcomes:
                            bet_type = outcome.get("name").lower()
                            point = outcome.get("point")
                            price = outcome.get("price")
                            
                            if bet_type and point is not None and price is not None:
                                is_over = "over" in bet_type.lower()
                                recommendation = "over" if is_over else "under"
                                
                                bets.append(TeamBet(
                                    id=f"{game['id']}_total_{recommendation}",
                                    home_team=game["home_team"],
                                    away_team=game["away_team"],
                                    bet_type="total",
                                    recommendation=recommendation,
                                    odds=int(price),
                                    line=float(point),
                                    event_id=game["id"],
                                    bookmaker=bookmaker_key
                                ))
            
            logger.info(f"🎯 Found {len(bets)} available team bets")
            return bets
        except Exception as e:
            logger.error(f"Failed to fetch team odds: {e}")
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
                # Extract reasoning from metadata if available
                reasoning = pred.get("reasoning", "")
                if not reasoning and pred.get("metadata"):
                    reasoning = pred["metadata"].get("reasoning", "")
                
                # Extract ROI and value percentages from metadata
                metadata = pred.get("metadata", {})
                roi_estimate_str = metadata.get("roi_estimate", "0%")
                value_percentage_str = metadata.get("value_percentage", "0%")
                
                # Convert percentage strings to floats
                try:
                    roi_estimate = float(str(roi_estimate_str).replace("%", "")) if roi_estimate_str else 0.0
                    value_percentage = float(str(value_percentage_str).replace("%", "")) if value_percentage_str else 0.0
                except (ValueError, AttributeError):
                    roi_estimate = 0.0
                    value_percentage = 0.0
                
                # Map to actual ai_predictions table schema
                prediction_data = {
                    "user_id": "c19a5e12-4297-4b0f-8d21-39d2bb1a2c08",  # Global AI user
                    "match_teams": pred.get("match_teams", ""),
                    "pick": pred.get("pick", ""),
                    "odds": str(pred.get("odds", 0)),
                    "confidence": pred.get("confidence", 75),
                    "sport": pred.get("sport", "MLB"),
                    "event_time": pred.get("event_time"),
                    "reasoning": reasoning,
                    "value_percentage": value_percentage,
                    "roi_estimate": roi_estimate,
                    "status": "pending",
                    "game_id": str(pred.get("event_id", "")),
                    "bet_type": pred.get("bet_type", "moneyline"),
                    "prop_market_type": pred.get("prop_market_type"),
                    "line_value": pred.get("line_value") or pred.get("line"),
                    "prediction_value": pred.get("prediction_value"),
                    "metadata": metadata
                }
                
                # Remove None values to avoid database errors
                prediction_data = {k: v for k, v in prediction_data.items() if v is not None}
                
                result = self.supabase.table("ai_predictions").insert(prediction_data).execute()
                logger.info(f"✅ Stored prediction: {pred.get('pick', 'Unknown')} (ID: {result.data[0]['id'] if result.data else 'Unknown'})")
                
            logger.info(f"Successfully stored {len(predictions)} AI predictions")
            
        except Exception as e:
            logger.error(f"Failed to store AI predictions: {e}")

class IntelligentTeamsAgent:
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
    
    def _distribute_picks_by_sport(self, games: List[Dict], target_picks: int = 10) -> Dict[str, int]:
        """Distribute picks across sports: EXACTLY 3 WNBA + 7 MLB as requested"""
        sport_counts = {"Major League Baseball": 0, "WNBA": 0, "MMA": 0}
        
        # Count available games by sport (map full names to abbreviations)
        for game in games:
            sport = game.get("sport", "")
            if sport == "Major League Baseball":
                sport_counts["Major League Baseball"] += 1
            elif sport == "Women's National Basketball Association":
                sport_counts["WNBA"] += 1
            elif sport == "Ultimate Fighting Championship":
                sport_counts["MMA"] += 1
        
        logger.info(f"Available games by sport: {sport_counts}")
        
        # EXACT distribution as requested: 3 WNBA + 7 MLB = 10 total
        distribution = {
            "WNBA": 3 if sport_counts["WNBA"] > 0 else 0,  # WNBA first (saved first to DB)
            "Major League Baseball": 7 if sport_counts["Major League Baseball"] > 0 else 0,     # MLB second
            "MMA": 0  # No MMA for now, focus on WNBA + MLB
        }
        
        # Adjust if we don't have enough games in a sport
        if distribution["WNBA"] > sport_counts["WNBA"]:
            # If not enough WNBA games, give remaining to MLB
            remaining_wnba = distribution["WNBA"] - sport_counts["WNBA"]
            distribution["WNBA"] = sport_counts["WNBA"]
            distribution["Major League Baseball"] += remaining_wnba
            
        if distribution["Major League Baseball"] > sport_counts["Major League Baseball"]:
            # If not enough MLB games, cap at available
            distribution["Major League Baseball"] = sport_counts["Major League Baseball"]
        
        logger.info(f"Pick distribution: {distribution}")
        return distribution
    
    async def generate_daily_picks(self, target_picks: int = 10) -> List[Dict[str, Any]]:
        logger.info("🚀 Starting intelligent multi-sport team analysis...")
        
        games = self.db.get_tomorrow_games()
        logger.info(f"📅 Found {len(games)} upcoming games across all sports")
        
        if not games:
            logger.warning("No upcoming games found")
            return []
        
        # Get sport distribution for picks
        sport_distribution = self._distribute_picks_by_sport(games, target_picks)
        
        game_ids = [game["id"] for game in games]
        available_bets = self.db.get_team_odds_for_games(game_ids)
        logger.info(f"🎯 Found {len(available_bets)} available team bets across all sports")
        
        if not available_bets:
            logger.warning("No team bets found")
            return []
        
        research_plan = await self.create_research_plan(available_bets, games)
        statmuse_count = len(research_plan.get("statmuse_queries", []))
        web_search_count = len(research_plan.get("web_searches", []))
        total_queries = statmuse_count + web_search_count
        logger.info(f"📋 Created research plan with {statmuse_count} StatMuse + {web_search_count} web queries = {total_queries} total")
        
        insights = await self.execute_research_plan(research_plan, available_bets)
        logger.info(f"🔍 Gathered {len(insights)} research insights across all stages")
        
        picks = await self.generate_picks_with_reasoning(insights, available_bets, games, target_picks)
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
    
    async def create_research_plan(self, bets: List[TeamBet], games: List[Dict]) -> Dict[str, Any]:
        # STEP 1: Scrape StatMuse main pages for current context
        statmuse_context = self.scrape_statmuse_context()
        
        # STEP 2: Analyze what sports are actually in the data
        sports_in_data = set(game.get('sport', 'Unknown') for game in games)
        sports_summary = ", ".join(sports_in_data)
        
        # STEP 3: Calculate balanced research allocation for team bets
        mlb_games = len([g for g in games if g.get('sport') == 'Major League Baseball'])
        wnba_games = len([g for g in games if g.get('sport') in ['WNBA', "Women's National Basketball Association"]])
        total_games = mlb_games + wnba_games
        
        if total_games > 0:
            wnba_research_ratio = min(0.4, wnba_games / total_games)  # Cap WNBA at 40%
            mlb_research_ratio = 1.0 - wnba_research_ratio
        else:
            wnba_research_ratio = 0.3
            mlb_research_ratio = 0.7
        
        # Target: 8-12 WNBA teams for 3 picks, 15-20 MLB teams for 7 picks
        target_wnba_queries = min(12, max(8, int(15 * wnba_research_ratio)))
        target_mlb_queries = min(20, max(15, int(15 * mlb_research_ratio)))
        
        prompt = f"""You are an elite sports betting analyst creating a BALANCED DIVERSE team research strategy.

# CRITICAL REQUIREMENTS - BALANCED TEAM RESEARCH STRATEGY:

## RESEARCH ALLOCATION (MUST FOLLOW EXACTLY):
- **WNBA Team Research**: {target_wnba_queries} different teams/matchups (for 3 final picks)
- **MLB Team Research**: {target_mlb_queries} different teams/matchups (for 7 final picks)
- **Total StatMuse Queries**: {target_wnba_queries + target_mlb_queries}
- **Web Searches**: 5 total (3 MLB injury/lineup/weather, 2 WNBA injury/lineup)

## DIVERSITY REQUIREMENTS FOR TEAMS:
- **NO REPETITIVE POPULAR TEAMS**: Avoid Yankees, Dodgers, Lakers-style teams every time
- **RESEARCH DIFFERENT TEAMS**: Mix contenders, underdogs, value plays, different divisions
- **VARIED BET TYPES**: Don't just research moneyline - include spreads, totals, team props
- **MATCHUP VARIETY**: Research different types of matchups (pitcher vs hitter friendly, pace, etc.)
- **AVOID BIAS**: Don't just research "sexy" teams - find value in overlooked matchups

# AVAILABLE DATA:
Games: {len(games)} across {sports_summary}
MLB Games: {mlb_games}, WNBA Games: {wnba_games}
Total Team Bets: {len(bets)}

# CURRENT STATMUSE CONTEXT:
{json.dumps(statmuse_context, indent=2)}

UPCOMING GAMES SAMPLE:
{json.dumps(games[:10], indent=2, default=str)}

AVAILABLE TEAM BETS SAMPLE:
{json.dumps([{
    "home_team": b.home_team,
    "away_team": b.away_team,
    "bet_type": b.bet_type,
    "recommendation": b.recommendation,
    "odds": b.odds,
    "line": b.line,
    "bookmaker": b.bookmaker
} for b in bets[:30]], indent=2)}

# YOUR TASK:
Generate a research plan that follows the EXACT allocation above and focuses on DIVERSE teams from the actual games data.

**WNBA Focus**: Research {target_wnba_queries} DIFFERENT WNBA teams/matchups (mix of contenders, underdogs, pace plays)
**MLB Focus**: Research {target_mlb_queries} DIFFERENT MLB teams/matchups (variety of divisions, ballparks, situations)"

# YOUR TOOLS

## StatMuse Tool
You have access to a powerful StatMuse API that can answer baseball questions with real data.

**SUCCESSFUL QUERY EXAMPLES** (these work well but dont feel limited to just these):
- "New York Yankees record vs Boston Red Sox this season" 
- "Los Angeles Dodgers home record last 10 games"
- "Atlanta Braves runs scored per game last 5 games"
- "Houston Astros bullpen ERA last 30 days"
- "Team batting average vs left handed pitching for Philadelphia Phillies"
- "Coors Field home runs allowed this season"
- "Yankee Stadium runs scored in day games"

**QUERIES THAT MAY FAIL** (avoid these patterns):
- Very specific situational stats ("with runners in scoring position")
- Complex multi-condition queries ("vs left-handed pitchers in day games")
- Obscure historical comparisons
- Real-time injury/lineup status
- Weather-dependent statistics

**BEST PRACTICES**:
- Keep queries simple and direct
- Focus on season totals, averages, recent games (last 5-15)
- Use team names exactly as they appear in MLB
- Ask about standard team stats: record, runs scored/allowed, ERA, bullpen stats
- Venue-specific queries work well for major stadiums

## Web Search Tool
You can search the web for:
- Injury reports and team news
- Weather forecasts for outdoor games
- Lineup announcements and starting pitchers
- Recent team interviews or motivation factors
- Public betting trends and sharp money movements

# RESEARCH STRATEGY:

1. **FOLLOW EXACT ALLOCATION**: Use the precise query counts specified above
2. **MAXIMIZE DIVERSITY**: Research different teams, not the same popular ones repeatedly
3. **FIND VALUE**: Focus on overlooked matchups and mispriced lines
4. **STRATEGIC DEPTH**: Consider park factors, weather, recent form, motivation, public sentiment

# RESPONSE FORMAT

Return ONLY a valid JSON object with this structure:

{{
    "research_strategy": "Balanced diverse research strategy focusing on team diversity",
    "statmuse_queries": [
        // {target_wnba_queries} WNBA team queries (different teams, varied bet types)
        // {target_mlb_queries} MLB team queries (different teams, varied bet types)
        {{
            "query": "[Diverse Team Name] [varied stat/matchup] this season",
            "priority": "high/medium/low",
            "sport": "WNBA/MLB"
        }}
    ],
    "web_searches": [
        // 3 MLB injury/lineup/weather searches, 2 WNBA injury/lineup searches
        {{
            "query": "[Team Name] injury status lineup news weather",
            "priority": "high/medium/low",
            "sport": "WNBA/MLB"
        }}
    ]
}}

**CRITICAL**: Use REAL diverse teams from the games data above. NO repetitive Yankees/Dodgers/popular teams pattern!"""
        
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
            return {
                "priority_bets": [],
                "statmuse_queries": [
                    f"{b.home_team} vs {b.away_team} recent record"
                    for b in bets[:5]
                ],
                "web_searches": [
                    f"{b.home_team} {b.away_team} injury report"
                    for b in bets[:5]
                ],
                "key_factors": ["recent_form", "head_to_head"],
                "expected_insights": "Basic team performance and injury updates"
            }
    
    async def execute_research_plan(self, plan: Dict[str, Any], bets: List[TeamBet]) -> List[ResearchInsight]:
        all_insights = []
        
        logger.info("🔬 STAGE 1: Initial Research")
        stage1_insights = await self._execute_initial_research(plan)
        all_insights.extend(stage1_insights)
        
        logger.info("🧠 STAGE 2: Analyzing findings and generating follow-up research")
        stage2_insights = await self._execute_adaptive_followup(stage1_insights, bets)
        all_insights.extend(stage2_insights)
        
        logger.info("🎯 STAGE 3: Final targeted research based on all findings")
        stage3_insights = await self._execute_final_research(all_insights, bets)
        all_insights.extend(stage3_insights)
        
        logger.info(f"🔍 Total research insights gathered: {len(all_insights)}")
        return all_insights
    
    async def _execute_initial_research(self, plan: Dict[str, Any]) -> List[ResearchInsight]:
        insights = []
        
        # BALANCED RESEARCH LIMITS: More focus on MLB since 7 picks needed vs 3 WNBA picks
        max_statmuse = min(15, len(plan.get("statmuse_queries", [])))
        max_web = min(10, len(plan.get("web_searches", [])))
        
        statmuse_queries = plan.get("statmuse_queries", [])[:max_statmuse]
        for query_obj in statmuse_queries:
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
                logger.error(f"❌ StatMuse query failed for '{query_text}': {e}")
        
        web_searches = plan.get("web_searches", [])[:max_web]
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
                logger.error(f"❌ Initial web search failed for '{search_query}': {e}")
        
        return insights
    
    async def _execute_adaptive_followup(self, initial_insights: List[ResearchInsight], bets: List[TeamBet]) -> List[ResearchInsight]:
        insights_summary = []
        for insight in initial_insights:
            insights_summary.append({
                "source": insight.source,
                "query": insight.query,
                "data": str(insight.data)[:600],
                "confidence": insight.confidence
            })
        
        top_bets = [{
            "home_team": bet.home_team,
            "away_team": bet.away_team,
            "bet_type": bet.bet_type,
            "odds": bet.odds,
            "line": bet.line
        } for bet in bets[:30]]
        
        prompt = f"""
You are analyzing initial research findings to identify gaps and generate intelligent follow-up queries.

INITIAL RESEARCH FINDINGS:
{json.dumps(insights_summary, indent=2)}

AVAILABLE BETS TO ANALYZE:
{json.dumps(top_bets, indent=2)}

Based on these findings, identify:
1. **KNOWLEDGE GAPS**: What key information is missing?
2. **SURPRISING FINDINGS**: Any results that suggest new research directions?
3. **BET MISMATCHES**: Bets that need more specific research?

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
            
            logger.info(f"🧠 Adaptive Analysis: {followup_plan.get("analysis", "No analysis provided")}")
            
            insights = []
            for query_obj in followup_plan.get("followup_statmuse_queries", [])[:5]:
                try:
                    query_text = query_obj.get("query", "")
                    reasoning = query_obj.get("reasoning", "")
                    priority = query_obj.get("priority", "medium")
                    
                    logger.info(f"🔍 Adaptive StatMuse ({priority}): {query_text}")
                    logger.info(f"   Reasoning: {reasoning}")
                    
                    result = self.statmuse.query(query_text)
                    
                    if result and "error" not in result:
                        result_preview = str(result)[:200] + "..." if len(str(result)) > 200 else str(result)
                        logger.info(f"📊 Adaptive result: {result_preview}")
                        
                        confidence = 0.95 if priority == "high" else 0.8 if priority == "medium" else 0.6
                        insights.append(ResearchInsight(
                            source="statmuse_adaptive",
                            query=query_text,
                            data=result,
                            confidence=confidence,
                            timestamp=datetime.now()
                        ))
                    
                    await asyncio.sleep(1.5)
                    
                except Exception as e:
                    logger.error(f"❌ Adaptive StatMuse query failed: {e}")
            
            for search_obj in followup_plan.get("followup_web_searches", [])[:3]:
                try:
                    search_query = search_obj.get("query", "")
                    reasoning = search_obj.get("reasoning", "")
                    priority = search_obj.get("priority", "medium")
                    
                    logger.info(f"🌐 Adaptive Web Search ({priority}): {search_query}")
                    logger.info(f"   Reasoning: {reasoning}")
                    
                    result = self.web_search.search(search_query)
                    
                    confidence = 0.85 if priority == "high" else 0.7 if priority == "medium" else 0.5
                    insights.append(ResearchInsight(
                        source="web_search_adaptive",
                        query=search_query,
                        data=result,
                        confidence=confidence,
                        timestamp=datetime.now()
                    ))
                    
                except Exception as e:
                    logger.error(f"❌ Adaptive web search failed: {e}")
            
            return insights
            
        except Exception as e:
            logger.error(f"Failed to generate adaptive follow-up: {e}")
            return []
    
    async def _execute_final_research(self, all_insights: List[ResearchInsight], bets: List[TeamBet]) -> List[ResearchInsight]:
        final_insights = []
        
        statmuse_count = len([i for i in all_insights if "statmuse" in i.source])
        web_count = len([i for i in all_insights if "web" in i.source])
        
        logger.info(f"📊 Research Summary: {statmuse_count} StatMuse + {web_count} Web insights")
        
        if len(all_insights) < 8:
            logger.info("🎯 Adding final broad research queries")
            
            top_teams = list(set([bet.home_team for bet in bets[:10]] + [bet.away_team for bet in bets[:10]]))
            
            for team in top_teams[:3]:
                try:
                    query = f"{team} recent performance"
                    logger.info(f"🔍 Final query: {query}")
                    
                    result = self.statmuse.query(query)
                    if result and "error" not in result:
                        final_insights.append(ResearchInsight(
                            source="statmuse_final",
                            query=query,
                            data=result,
                            confidence=0.7,
                            timestamp=datetime.now()
                        ))
                    
                    await asyncio.sleep(1.5)
                    
                except Exception as e:
                    logger.error(f"❌ Final query failed: {e}")
        
        return final_insights
    
    async def generate_picks_with_reasoning(
        self, 
        insights: List[ResearchInsight], 
        bets: List[TeamBet], 
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
        
        MAX_POSITIVE_ODDS = 400  # Maximum underdog price we will consider (e.g. +400)
        MAX_NEGATIVE_ODDS = -400  # Maximum favorite price we will consider (e.g. -400)

        
        filtered_bets = []
        long_shot_count = 0
        
        for bet in bets:
            # Keep bet if it is within our defined odds window
            if (bet.odds >= 0 and bet.odds <= MAX_POSITIVE_ODDS) or (bet.odds < 0 and bet.odds >= MAX_NEGATIVE_ODDS):
                filtered_bets.append(bet)
            else:
                long_shot_count += 1
                logger.info(f"🚫 Filtered long shot: {bet.home_team} vs {bet.away_team} {bet.bet_type} ({bet.odds})")
        
        logger.info(
                f"🎯 Filtered bets: {len(bets)} → {len(filtered_bets)} "
                f"(removed {long_shot_count} long shots outside {MAX_NEGATIVE_ODDS}/+{MAX_POSITIVE_ODDS})"
            )
        
        bets_data = []
        for bet in filtered_bets:
            bets_data.append({
                "home_team": bet.home_team,
                "away_team": bet.away_team,
                "bet_type": bet.bet_type,
                "recommendation": bet.recommendation,
                "odds": bet.odds,
                "line": bet.line,
                "event_id": bet.event_id,
                "bookmaker": bet.bookmaker
            })
        
        games_info = json.dumps(games[:10], indent=2, default=str)
        bets_info = json.dumps(bets_data, indent=2)
        research_summary = json.dumps(insights_summary, indent=2)
        
        bets = filtered_bets
        
        prompt = f"""
You are a professional sports betting analyst with 15+ years experience handicapping multi-sport team bets (MLB, WNBA, UFC/MMA).
Your job is to find PROFITABLE betting opportunities across all sports, not just predict outcomes.

🏆 **SPORT EXPERTISE:**
- **MLB**: Team dynamics, pitching matchups, weather, bullpen usage
- **WNBA**: Player rotations, pace of play, defensive schemes, rest advantages  
- **UFC/MMA**: Fighter styles, reach advantages, cardio, recent performance trends

TODAY'S DATA:

🏟️ UPCOMING GAMES ({len(games)}):
{games_info}

🎯 AVAILABLE TEAM BETS ({len(filtered_bets)}) - **ONLY PICK FROM THESE FILTERED BETS**:
{bets_info}

💡 **SMART FILTERING**: Long shot bets (odds > +400) have been removed to focus on PROFITABLE opportunities.

⚠️  **CRITICAL**: You MUST pick from the exact team names and bet types listed above. 
Available bet types in this data: {set(b.bet_type for b in filtered_bets[:50])}
Available teams in this data: {list(set([b.home_team for b in filtered_bets[:30]] + [b.away_team for b in filtered_bets[:30]]))[:20]}

🔍 RESEARCH INSIGHTS ({len(insights_summary)}):

**STATMUSE DATA FINDINGS:**
{self._format_statmuse_insights(insights_summary)}

**WEB SEARCH INTEL:**
{self._format_web_insights(insights_summary)}

**RAW RESEARCH DATA:**
{research_summary}

TASK: Generate {target_picks + 3} strategic team picks that maximize expected value and long-term profit. We need extra picks to compensate for potential filtering losses.

🎯 **PICK DISTRIBUTION REQUIREMENTS:**
- Generate 4-5 WNBA team picks FIRST (we need at least 3 final picks after filtering)
- Generate 8-10 MLB team picks AFTER (we need at least 7 final picks after filtering)
- TOTAL: Generate {target_picks + 3} picks to compensate for potential filtering losses
- GOAL: Ensure we get exactly {target_picks} valid picks after bet matching and filtering

🚨 **BETTING DISCIPLINE REQUIREMENTS:**
1. **MANDATORY ODDS CHECK**: Before picking, check the odds in the data
2. **NO HIGH-ODDS PICKS**: Never pick sides with odds higher than +350 (even if available)
3. **AVOID LONG SHOTS**: Bets with +400, +500, +950, +1300 odds are SUCKER BETS - ignore them!
4. **FOCUS ON VALUE RANGE**: Target odds between -250 and +250 for best long-term profit
5. **DIVERSIFY BET TYPES**: Use various bets like Moneyline, Spread, and Totals (see available bets below)
6. **MIX HOME/AWAY/OVER/UNDER**: Don't just pick all favorites - find spots where underdog or total has value
7. **REALISTIC CONFIDENCE**: Most picks should be 55-65% confidence (sharp betting range)
8. **VALUE HUNTING**: Focus on lines that seem mispriced based on data

PROFITABLE BETTING STRATEGY:
- **Focus on -200 to +200 odds**: This is the profitable betting sweet spot
- **Moneyline**: Look for undervalued underdogs or strong favorites with good odds
- **Spread**: Analyze team performance against the spread, recent form, and key matchups
- **Totals**: Consider offensive and pitching matchups, park factors, and weather
- **Fade public favorites**: Teams with high public betting often have inflated lines
- **Target situational spots**: Day games, travel, starting pitcher matchups, bullpen strength
- **Avoid "lottery tickets"**: High-odds bets (+500+) are designed to lose money

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
    "home_team": "Home Team Name",
    "away_team": "Away Team Name",
    "bet_type": "moneyline", "spread", "total",
    "recommendation": "home", "away", "over", "under",
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

🚨 **CRITICAL RECOMMENDATION FORMAT RULES:**
- For MONEYLINE bets: Use "home" or "away" ONLY
- For SPREAD bets: Use "home" or "away" ONLY  
- For TOTAL bets: Use "over" or "under" ONLY
- NEVER use team names in the recommendation field
- NEVER use "Detroit Tigers" or "Pittsburgh Pirates" - use "home"/"away" instead
- Example: If you like Detroit Tigers moneyline, use "recommendation": "away" (not "Detroit Tigers")

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
- **DIVERSIFY ACROSS ALL BET TYPES**: Use Moneyline, Spread, and Totals
- Mix home/away/over/under based on VALUE, not bias  
- Keep confidence realistic (most picks 55-65%)
- Focus on profitable opportunities, not just likely outcomes
- Each pick should be one you'd bet your own money on
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
            logger.info(f"🔍 Attempting to parse JSON: {json_str[:200]}...")
            
            try:
                ai_picks = json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing failed: {e}")
                logger.error(f"Raw JSON string: {json_str}")
                # Try to clean up common JSON issues
                cleaned_json = json_str.replace('\n', ' ').replace('\r', ' ')
                # Remove any trailing commas before closing brackets
                import re
                cleaned_json = re.sub(r',\s*([}\]])', r'\1', cleaned_json)
                try:
                    ai_picks = json.loads(cleaned_json)
                    logger.info("✅ JSON parsing succeeded after cleanup")
                except json.JSONDecodeError as e2:
                    logger.error(f"JSON parsing failed even after cleanup: {e2}")
                    return []
            
            formatted_picks = []
            for pick in ai_picks:
                try:
                    # Validate required fields are present in the pick
                    required_fields = ["home_team", "away_team", "bet_type", "recommendation"]
                    if not all(field in pick for field in required_fields):
                        missing = [f for f in required_fields if f not in pick]
                        logger.warning(f"Pick missing required fields: {missing}. Skipping pick: {pick}")
                        continue
                    
                    # Validate recommendation field has correct values
                    valid_recommendations = ["home", "away", "over", "under"]
                    recommendation = pick.get("recommendation", "").lower()
                    
                    if recommendation not in valid_recommendations:
                        logger.warning(f"Invalid recommendation '{pick.get('recommendation')}' - must be one of {valid_recommendations}. Attempting to fix...")
                        
                        # Try to fix common issues where AI puts team name instead of home/away
                        home_team = pick.get("home_team", "")
                        away_team = pick.get("away_team", "")
                        bet_type = pick.get("bet_type", "")
                        original_rec = pick.get("recommendation", "")
                        
                        # If recommendation matches home team name, change to "home"
                        if original_rec == home_team:
                            pick["recommendation"] = "home"
                            logger.info(f"Fixed recommendation from '{original_rec}' to 'home'")
                        # If recommendation matches away team name, change to "away"
                        elif original_rec == away_team:
                            pick["recommendation"] = "away"
                            logger.info(f"Fixed recommendation from '{original_rec}' to 'away'")
                        # For totals, try to infer over/under
                        elif bet_type == "total":
                            if "over" in original_rec.lower():
                                pick["recommendation"] = "over"
                                logger.info(f"Fixed recommendation from '{original_rec}' to 'over'")
                            elif "under" in original_rec.lower():
                                pick["recommendation"] = "under"
                                logger.info(f"Fixed recommendation from '{original_rec}' to 'under'")
                            else:
                                logger.warning(f"Could not fix recommendation '{original_rec}' for total bet. Skipping pick.")
                                continue
                        else:
                            logger.warning(f"Could not fix recommendation '{original_rec}'. Skipping pick.")
                            continue
                    
                    matching_bet = self._find_matching_bet(pick, bets)
                    
                    if matching_bet:
                        game = next((g for g in games if str(g.get("id")) == str(matching_bet.event_id)), None)
                        
                        # Use safer dictionary access with get() for all fields
                        # Determine sport from game data - map from database sport names to display names
                        game_sport = game.get("sport", "Major League Baseball") if game else "Major League Baseball"
                        if game_sport == "Women's National Basketball Association":
                            display_sport = "WNBA"
                        elif game_sport == "Ultimate Fighting Championship":
                            display_sport = "MMA"
                        elif game_sport == "Major League Baseball":
                            display_sport = "MLB"
                        else:
                            display_sport = "MLB"  # Default to MLB for unknown games
                        
                        formatted_picks.append({
                            "match_teams": f"{matching_bet.home_team} vs {matching_bet.away_team}",
                            "pick": self._format_pick_string(pick, matching_bet),
                            "odds": pick.get("odds", matching_bet.odds),
                            "confidence": pick.get("confidence", 75),
                            "sport": display_sport,
                            "event_time": game.get("start_time") if game else None,
                            "bet_type": pick.get("bet_type", "team_bet"),
                            "bookmaker": matching_bet.bookmaker,
                            "event_id": matching_bet.event_id,
                            "metadata": {
                                "home_team": pick.get("home_team", ""),
                                "away_team": pick.get("away_team", ""),
                                "bet_type": pick.get("bet_type", ""),
                                "recommendation": pick.get("recommendation", ""),
                                "line": pick.get("line"),
                                "reasoning": pick.get("reasoning", "AI-generated pick"),
                                "roi_estimate": pick.get("roi_estimate", "0%"),
                                "value_percentage": pick.get("value_percentage", "0%"),
                                "implied_probability": pick.get("implied_probability", "50%"),
                                "fair_odds": pick.get("fair_odds", pick.get("odds", 0)),
                                "key_factors": pick.get("key_factors", []) if isinstance(pick.get("key_factors"), list) else [],
                                "risk_level": pick.get("risk_level", "medium"),
                                "expected_value": pick.get("expected_value", "Positive EV expected"),
                                "research_support": pick.get("research_support", "Based on comprehensive analysis"),
                                "ai_generated": True,
                                "research_insights_count": len(insights),
                                "model_used": "grok-4-0709"
                            }
                        })
                    else:
                        logger.warning(f"No matching bet found for {pick.get('home_team')} vs {pick.get('away_team')} {pick.get('bet_type')}")
                
                except Exception as pick_error:
                    logger.error(f"Error processing individual pick {pick}: {pick_error}")
                    # Continue processing other picks even if one fails
            
            # Ensure we have exactly the target number of picks
            # If we have fewer than target due to filtering/matching failures, log the shortfall
            if len(formatted_picks) < target_picks:
                shortfall = target_picks - len(formatted_picks)
                logger.warning(f"⚠️  Pick shortfall: Generated {len(formatted_picks)} picks, need {target_picks}. Missing {shortfall} picks due to bet matching failures.")
                logger.info(f"💡 Tip: Some AI picks couldn't find matching odds (likely filtered as long shots or unavailable bet types)")
            
            final_picks = formatted_picks[:target_picks]
            
            if final_picks:
                bet_types = {}
                recommendations = {"home": 0, "away": 0, "over": 0, "under": 0}
                confidence_ranges = {"50-60": 0, "61-70": 0, "71+": 0}
                
                for pick in final_picks:
                    bet_type = pick["metadata"]["bet_type"]
                    bet_types[bet_type] = bet_types.get(bet_type, 0) + 1
                    
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
                logger.info(f"  Bet Types: {dict(bet_types)}")
                logger.info(f"  Recommendations: {dict(recommendations)}")
                logger.info(f"  Confidence Ranges: {dict(confidence_ranges)}")
                
                logger.info(f"📝 Generated {len(final_picks)} diverse picks:")
                for i, pick in enumerate(final_picks, 1):
                    meta = pick["metadata"]
                    logger.info(
                        f"  {i}. {meta['home_team']} vs {meta['away_team']} "
                        f"{meta['bet_type']} {meta['recommendation'].upper()} "
                        f"{pick['confidence']}% conf"
                    )
            
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
    
    def _find_matching_bet(self, pick: Dict, odds: List[TeamBet]) -> Optional[TeamBet]:
        """Find a matching bet from the available odds that corresponds to the AI pick.
        Returns None if no match is found."""
        try:
            # Safely get values with defaults to prevent KeyError
            home_team = pick.get("home_team", "") 
            away_team = pick.get("away_team", "")
            bet_type = pick.get("bet_type", "")
            
            if not home_team or not away_team or not bet_type:
                logger.warning(f"Missing required fields for matching: {pick}")
                return None
            
            # Try exact match first
            exact_match = next(
                (bet for bet in odds 
                if bet.home_team == home_team and bet.away_team == away_team and bet.bet_type == bet_type),
                None
            )
            if exact_match:
                return exact_match
            
            # Try fuzzy match as fallback
            fuzzy_match = next(
                (bet for bet in odds 
                if (home_team.lower() in bet.home_team.lower() or bet.home_team.lower() in home_team.lower()) and
                   (away_team.lower() in bet.away_team.lower() or bet.away_team.lower() in away_team.lower()) and
                   bet.bet_type == bet_type),
                None
            )
            if fuzzy_match:
                logger.info(f"✅ Fuzzy matched '{home_team} vs {away_team}' to '{fuzzy_match.home_team} vs {fuzzy_match.away_team}'")
                return fuzzy_match
            
            logger.warning(f"❌ No match found for {home_team} vs {away_team} {bet_type}")
            return None
        except Exception as e:
            logger.error(f"Error in _find_matching_bet: {e}")
            return None

    def _format_pick_string(self, pick: Dict, matching_bet: TeamBet) -> str:
        """Formats the pick string for clarity with improved error handling."""
        try:
            if not matching_bet:
                return "Unknown Pick (No matching bet found)"
                
            # Safely get values with defaults
            home_team = str(pick.get("home_team", matching_bet.home_team))
            away_team = str(pick.get("away_team", matching_bet.away_team))
            bet_type = str(pick.get("bet_type", matching_bet.bet_type))
            recommendation = str(pick.get("recommendation", "")).lower()
            line = pick.get("line", matching_bet.line)
            
            # Format the pick string based on bet type and recommendation
            if bet_type == "moneyline":
                if recommendation == "home":
                    return f"{home_team} Moneyline"
                elif recommendation == "away":
                    return f"{away_team} Moneyline"
                else:
                    return f"{'Home' if home_team else matching_bet.home_team} vs {'Away' if away_team else matching_bet.away_team} Moneyline {recommendation}"
            
            elif bet_type == "spread":
                line_str = f"{line:g}" if isinstance(line, (int, float)) else str(line) if line else ""
                if recommendation == "home":
                    return f"{home_team} {line_str}"
                elif recommendation == "away":
                    return f"{away_team} {line_str}"
                else:
                    return f"{'Home' if home_team else matching_bet.home_team} vs {'Away' if away_team else matching_bet.away_team} Spread {recommendation} {line_str}"
            
            elif bet_type == "total":
                line_str = f"{line:g}" if isinstance(line, (int, float)) else str(line) if line else ""
                rec = recommendation.capitalize() if recommendation else "Unknown"
                return f"Total {rec} {line_str}"
                
            # Fallback format
            return f"{home_team} vs {away_team} {bet_type} {recommendation}"
            
        except Exception as e:
            logger.error(f"Error formatting pick string: {e}")
            # Ultimate fallback if anything goes wrong
            try:
                return f"{matching_bet.home_team} vs {matching_bet.away_team} {matching_bet.bet_type}"
            except:
                return "Unknown Pick Format Error"

async def main():
    logger.info("🤖 Starting Intelligent Teams Agent")
    
    agent = IntelligentTeamsAgent()
    picks = await agent.generate_daily_picks(target_picks=10)
    
    if picks:
        logger.info(f"✅ Successfully generated {len(picks)} intelligent picks!")
        for i, pick in enumerate(picks, 1):
            logger.info(f"Pick {i}: {pick["pick"]} (Confidence: {pick["confidence"]}%)")
    else:
        logger.warning("❌ No picks generated")

if __name__ == "__main__":
    asyncio.run(main())



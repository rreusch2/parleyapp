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
        self.backend_url = os.getenv("BACKEND_URL", "https://zooming-rebirth-production-a305.up.railway.app")
        self.user_id = "ai_teams_agent"
    
    def search(self, query: str) -> Dict[str, Any]:
        logger.info(f"Web search: {query}")
        
        try:
            search_prompt = f"Search the web for current information about: {query}. Focus on finding recent, relevant information that would be useful for sports betting analysis. Provide a clear summary of what you found."
            
            url = f"{self.backend_url}/api/ai/chat"
            payload = {
                "message": search_prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "web_search_agent",
                    "userTier": "pro",
                    "task": "web_search"
                },
                "conversationHistory": []
            }
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                search_response = result.get("response", "No results found")
                
                web_result = {
                    "query": query,
                    "results": [{
                        "title": "AI Web Search Result",
                        "snippet": search_response[:300] + "..." if len(search_response) > 300 else search_response,
                        "url": "AI-generated"
                    }],
                    "summary": search_response[:500] + "..." if len(search_response) > 500 else search_response
                }
                
                logger.info(f"🌐 Web search result: {web_result["summary"][:150]}{"..." if len(web_result["summary"]) > 150 else ""}")
                return web_result
                
            else:
                logger.warning(f"Web search API failed: {response.status_code}")
                return {
                    "query": query,
                    "results": [],
                    "summary": f"Web search API error: {response.status_code}"
                }
                
        except Exception as e:
            logger.warning(f"Web search failed for '{query}': {e}")
            return {
                "query": query,
                "results": [],
                "summary": f"Search failed: {str(e)}"
            }

class DatabaseClient:
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")
            
        self.supabase: Client = create_client(supabase_url, supabase_key)
    
    def get_upcoming_games(self, hours_ahead: int = 48) -> List[Dict[str, Any]]:
        try:
            now = datetime.now().isoformat()
            future = (datetime.now() + timedelta(hours=hours_ahead)).isoformat()
            
            response = self.supabase.table("sports_events").select(
                "id, home_team, away_team, start_time, sport, metadata"
            ).gt("start_time", now).lt("start_time", future).eq("sport", "MLB").order("start_time").execute()
            
            return response.data
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
            for pred in predictions:
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
                    "bet_type": pred.get("bet_type", "team_bet"),
                    "game_id": str(pred.get("event_id", "")),
                    "match_teams": pred.get("match_teams", ""),
                    "reasoning": reasoning,
                    "line_value": pred.get("line_value") or pred.get("line", 0),
                    "prediction_value": pred.get("prediction_value"),
                    "prop_market_type": pred.get("prop_market_type") or pred.get("bet_type", ""),
                    "roi_estimate": roi_estimate,
                    "value_percentage": value_percentage,
                    "status": "pending",
                    "metadata": pred.get("metadata", {})
                }
                
                self.supabase.table("ai_predictions").insert(prediction_data).execute()
                
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
    
    async def generate_daily_picks(self, target_picks: int = 10) -> List[Dict[str, Any]]:
        logger.info("🚀 Starting intelligent team analysis...")
        
        games = self.db.get_upcoming_games(hours_ahead=48)
        logger.info(f"📅 Found {len(games)} upcoming games")
        
        if not games:
            logger.warning("No upcoming games found")
            return []
        
        game_ids = [game["id"] for game in games]
        available_bets = self.db.get_team_odds_for_games(game_ids)
        logger.info(f"🎯 Found {len(available_bets)} available team bets")
        
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
    
    async def create_research_plan(self, bets: List[TeamBet], games: List[Dict]) -> Dict[str, Any]:
        prompt = f"""You are an elite MLB betting analyst and data scientist with years of experience. Your mission is to create the most comprehensive research plan possible to identify the absolute BEST team bets for today.

# CONTEXT
You have access to {len(games)} upcoming MLB games and {len(bets)} team bets with live odds from multiple sportsbooks.

UPCOMING GAMES:
{json.dumps(games[:10], indent=2, default=str)}

SAMPLE AVAILABLE BETS (showing first 30 of {len(bets)}):
{json.dumps([{
    "home_team": b.home_team,
    "away_team": b.away_team,
    "bet_type": b.bet_type,
    "recommendation": b.recommendation,
    "odds": b.odds,
    "line": b.line,
    "bookmaker": b.bookmaker
} for b in bets[:30]], indent=2)}

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

# YOUR MISSION

Create an intelligent research strategy that will give you maximum edge. Think like a professional sharp bettor:

1. **IDENTIFY VALUE**: Which bets have the best odds vs true probability?
2. **FIND EDGES**: What specific situations, matchups, or trends can you exploit?
3. **BE STRATEGIC**: Focus on the most profitable research, not everything
4. **THINK DEEP**: Consider park factors, weather, recent form, motivation, public sentiment, etc.

# RESPONSE FORMAT

Return ONLY a valid JSON object with this structure:

{{
    "research_strategy": "Brief summary of your overall approach and reasoning",
    "priority_bets": [
        {{
            "home_team": "Home Team Name",
            "away_team": "Away Team Name",
            "bet_type": "moneyline",
            "reasoning": "Why this bet caught your attention",
            "edge_hypothesis": "Your theory on why this might be mispriced"
        }}
    ],
    "statmuse_queries": [
        {{
            "query": "Specific StatMuse question",
            "purpose": "What you're trying to learn",
            "priority": "high"
        }}
    ],
    "web_searches": [
        {{
            "query": "Web search query",
            "purpose": "What information you need",
            "priority": "high"
        }}
    ],
    "key_factors": ["List of the most important factors you'll analyze"],
    "expected_insights": "What you expect to discover from this research"
}}

Be strategic, be smart, and focus on finding real edges. Quality over quantity - better to research 10 bets deeply than 50 superficially."""
        
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
        
        statmuse_queries = plan.get("statmuse_queries", [])[:8]
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
        
        MAX_ODDS = 350
        
        filtered_bets = []
        long_shot_count = 0
        
        for bet in bets:
            if abs(bet.odds) <= MAX_ODDS:
                filtered_bets.append(bet)
            else:
                long_shot_count += 1
                logger.info(f"🚫 Filtered long shot: {bet.home_team} vs {bet.away_team} {bet.bet_type} ({bet.odds})")
        
        logger.info(f"🎯 Filtered bets: {len(bets)} → {len(filtered_bets)} (removed {long_shot_count} long shots with odds > +{MAX_ODDS})")
        
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
You are a professional sports betting analyst with 15+ years experience handicapping MLB team bets.
Your job is to find PROFITABLE betting opportunities, not just predict outcomes.

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

TASK: Generate exactly {target_picks} strategic team picks that maximize expected value and long-term profit.

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
            ai_picks = json.loads(json_str)
            
            formatted_picks = []
            for pick in ai_picks:
                try:
                    # Validate required fields are present in the pick
                    required_fields = ["home_team", "away_team", "bet_type", "recommendation"]
                    if not all(field in pick for field in required_fields):
                        missing = [f for f in required_fields if f not in pick]
                        logger.warning(f"Pick missing required fields: {missing}. Skipping pick: {pick}")
                        continue
                    
                    matching_bet = self._find_matching_bet(pick, bets)
                    
                    if matching_bet:
                        game = next((g for g in games if str(g.get("id")) == str(matching_bet.event_id)), None)
                        
                        # Use safer dictionary access with get() for all fields
                        formatted_picks.append({
                            "match_teams": f"{matching_bet.home_team} vs {matching_bet.away_team}",
                            "pick": self._format_pick_string(pick, matching_bet),
                            "odds": pick.get("odds", matching_bet.odds),
                            "confidence": pick.get("confidence", 75),
                            "sport": "MLB",
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
                    logger.info(f"  {i}. {meta["home_team"]} vs {meta["away_team"]} {meta["bet_type"]} {meta["recommendation"].upper()} {pick["confidence"]}% conf)")
            
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



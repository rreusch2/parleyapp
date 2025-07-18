#!/usr/bin/env python3
"""
Enhanced Props Agent with Scrapy Integration
Combines the original props.py functionality with enhanced web scraping data
Provides superior data-driven player props betting analysis
"""

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

# Import our integration service
from scrapy_integration_service import scrapy_service, ScrapedData

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
    id: str
    player_name: str
    team: str
    prop_type: str
    line: float
    over_odds: int
    under_odds: int
    event_id: str
    bookmaker: str
    market: str

@dataclass
class ResearchInsight:
    source: str
    query: str
    data: Dict[str, Any]
    confidence: float
    timestamp: datetime

@dataclass
class EnhancedPlayerInsight:
    source: str
    player_name: str
    team: str
    insight_type: str
    content: Dict[str, Any]
    confidence: float
    timestamp: datetime
    relevance_score: float

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
        self.user_id = "ai_props_agent_enhanced"
    
    def search(self, query: str) -> Dict[str, Any]:
        logger.info(f"Web search: {query}")
        
        try:
            search_prompt = f"Search the web for current information about: {query}. Focus on finding recent player statistics, injury reports, and performance data that would be useful for player props betting analysis. Provide a clear summary of what you found."
            
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
                
                logger.info(f"🌐 Web search result: {web_result['summary'][:150]}{'...' if len(web_result['summary']) > 150 else ''}")
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
    
    def get_player_props_for_games(self, game_ids: List[str]) -> List[PlayerProp]:
        if not game_ids:
            return []
        
        try:
            response = self.supabase.table("player_props_odds").select(
                "id, line, over_odds, under_odds, event_id, player_id(name, team), prop_type_id(prop_name)"
            ).in_("event_id", game_ids).execute()
            
            props = []
            for row in response.data:
                props.append(PlayerProp(
                    id=str(row["id"]),
                    player_name=row["player_id"]["name"],
                    team=row["player_id"]["team"],
                    prop_type=row["prop_type_id"]["prop_name"],
                    line=float(row["line"]),
                    over_odds=int(row["over_odds"]),
                    under_odds=int(row["under_odds"]),
                    event_id=str(row["event_id"]),  # Convert UUID to string
                    bookmaker=row["bookmaker"],
                    market=row["market"]
                ))
            return props
        except Exception as e:
            logger.error(f"Failed to fetch player props: {e}")
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

class EnhancedPropsAgent:
    """Enhanced Props Agent with Scrapy integration for superior player props analysis"""
    
    def __init__(self):
        self.db = DatabaseClient()
        self.statmuse = StatMuseClient()
        self.web_search = WebSearchClient()
        self.scrapy_service = scrapy_service
        self.grok_client = AsyncOpenAI(
            api_key=os.getenv("XAI_API_KEY"),
            base_url="https://api.x.ai/v1"
        )
    
    async def generate_daily_picks(self, target_picks: int = 10) -> List[Dict[str, Any]]:
        logger.info("🚀 Starting ENHANCED intelligent player props analysis with Scrapy integration...")
        
        # Step 1: Refresh Scrapy data
        logger.info("🕷️ Refreshing web scraping data...")
        scrapy_refresh = await self.scrapy_service.refresh_all_data()
        logger.info(f"📊 Scrapy refresh: {scrapy_refresh['scraped_data_count']} datasets available")
        
        # Step 2: Get traditional data
        games = self.db.get_upcoming_games(hours_ahead=48)
        logger.info(f"📅 Found {len(games)} upcoming games")
        
        if not games:
            logger.warning("No upcoming games found")
            return []
        
        game_ids = [game["id"] for game in games]
        available_props = self.db.get_player_props_for_games(game_ids)
        logger.info(f"🎯 Found {len(available_props)} available player props")
        
        if not available_props:
            logger.warning("No player props found")
            return []
        
        # Step 3: Get enhanced insights from Scrapy for players
        player_names = list(set([prop.player_name for prop in available_props]))
        team_names = list(set([prop.team for prop in available_props]))
        
        enhanced_insights = self.scrapy_service.get_enhanced_insights_for_ai(
            teams=team_names[:10],
            players=player_names[:20],  # Focus on key players
            data_types=['news', 'player_stats', 'team_performance']
        )
        logger.info(f"🔍 Enhanced insights: {len(enhanced_insights.get('news', []))} news + {len(enhanced_insights.get('player_stats', []))} player stats + {len(enhanced_insights.get('team_performance', []))} team data")
        
        # Step 4: Create enhanced research plan
        research_plan = await self.create_enhanced_research_plan(available_props, games, enhanced_insights)
        statmuse_count = len(research_plan.get("statmuse_queries", []))
        web_search_count = len(research_plan.get("web_searches", []))
        scrapy_insights_count = len(research_plan.get("scrapy_insights", []))
        total_queries = statmuse_count + web_search_count + scrapy_insights_count
        logger.info(f"📋 Enhanced research plan: {statmuse_count} StatMuse + {web_search_count} web + {scrapy_insights_count} scrapy = {total_queries} total")
        
        # Step 5: Execute enhanced research
        insights = await self.execute_enhanced_research_plan(research_plan, available_props, enhanced_insights)
        logger.info(f"🔍 Gathered {len(insights)} enhanced research insights")
        
        # Step 6: Generate picks with enhanced reasoning
        picks = await self.generate_enhanced_picks_with_reasoning(insights, available_props, games, enhanced_insights, target_picks)
        logger.info(f"🎲 Generated {len(picks)} enhanced intelligent picks")
        
        if picks:
            self.db.store_ai_predictions(picks)
            logger.info(f"💾 Stored {len(picks)} enhanced picks in database")
        
        return picks
    
    async def create_enhanced_research_plan(self, props: List[PlayerProp], games: List[Dict], enhanced_insights: Dict[str, Any]) -> Dict[str, Any]:
        """Create research plan enhanced with Scrapy insights for player props"""
        
        # Prepare enhanced context
        news_summary = self._summarize_news_insights(enhanced_insights.get('news', []))
        player_stats_summary = self._summarize_player_stats_insights(enhanced_insights.get('player_stats', []))
        performance_summary = self._summarize_performance_insights(enhanced_insights.get('team_performance', []))
        
        prompt = f"""You are an elite MLB player props betting analyst with access to ENHANCED real-time data sources. Your mission is to create the most comprehensive research plan possible using both traditional and cutting-edge web scraping intelligence for PLAYER PROPS betting.

# ENHANCED CONTEXT
You have access to {len(games)} upcoming MLB games and {len(props)} player props with live odds, PLUS enhanced web scraping data.

UPCOMING GAMES:
{json.dumps(games[:10], indent=2, default=str)}

SAMPLE AVAILABLE PROPS (showing first 30 of {len(props)}):
{json.dumps([{
    "player_name": p.player_name,
    "team": p.team,
    "prop_type": p.prop_type,
    "line": p.line,
    "over_odds": p.over_odds,
    "under_odds": p.under_odds,
    "market": p.market,
    "bookmaker": p.bookmaker
} for p in props[:30]], indent=2)}

🔥 ENHANCED WEB SCRAPING INTELLIGENCE:

📰 LATEST NEWS INSIGHTS ({len(enhanced_insights.get('news', []))} sources):
{news_summary}

⚾ PLAYER STATS DATA ({len(enhanced_insights.get('player_stats', []))} datasets):
{player_stats_summary}

📊 TEAM PERFORMANCE DATA ({len(enhanced_insights.get('team_performance', []))} datasets):
{performance_summary}

# RESPONSE FORMAT

Return ONLY a valid JSON object with this ENHANCED structure:

{{
    "research_strategy": "Brief summary of your enhanced approach using all data sources for player props",
    "priority_props": [
        {{
            "player_name": "Player Name",
            "team": "Team Name",
            "prop_type": "hits/runs/rbis/strikeouts/etc",
            "reasoning": "Why this prop caught your attention",
            "edge_hypothesis": "Your theory on why this might be mispriced",
            "scrapy_support": "How web scraping data supports this prop bet"
        }}
    ],
    "statmuse_queries": [
        {{
            "query": "Specific StatMuse question about player performance",
            "purpose": "What you're trying to learn about the player",
            "priority": "high"
        }}
    ],
    "web_searches": [
        {{
            "query": "Web search query about player status/performance",
            "purpose": "What information you need",
            "priority": "high"
        }}
    ],
    "scrapy_insights": [
        {{
            "insight_type": "news/player_stats/matchup_data",
            "players": ["Player1", "Player2"],
            "analysis_focus": "What specific aspect to analyze from scraped data",
            "priority": "high"
        }}
    ],
    "key_factors": ["Enhanced factors including scraped data advantages for props"],
    "expected_insights": "What you expect to discover from this ENHANCED player props research"
}}

Leverage the scraped data advantage - this is intelligence that most bettors don't have access to for player props!"""
        
        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-beta-0709",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            
            plan_text = response.choices[0].message.content
            start_idx = plan_text.find("{")
            end_idx = plan_text.rfind("}") + 1
            plan_json = json.loads(plan_text[start_idx:end_idx])
            
            return plan_json
            
        except Exception as e:
            logger.error(f"Failed to create enhanced research plan: {e}")
            return {
                "priority_props": [],
                "statmuse_queries": [
                    f"{p.player_name} recent hitting stats"
                    for p in props[:5]
                ],
                "web_searches": [
                    f"{p.player_name} injury status recent performance"
                    for p in props[:5]
                ],
                "scrapy_insights": [
                    {
                        "insight_type": "player_stats",
                        "players": [p.player_name],
                        "analysis_focus": "Recent performance trends and matchup data",
                        "priority": "medium"
                    } for p in props[:3]
                ],
                "key_factors": ["recent_form", "matchup_history", "scraped_intelligence"],
                "expected_insights": "Enhanced player performance and injury updates with web scraping advantage"
            }
    
    def _summarize_news_insights(self, news_data: List[Dict]) -> str:
        """Summarize news insights for research planning"""
        if not news_data:
            return "No recent news data available"
        
        summary_items = []
        for item in news_data[:5]:  # Top 5 news items
            content = item.get('content', {})
            if isinstance(content, list) and content:
                content = content[0]  # Take first news item
            
            title = content.get('title', 'Unknown')
            teams = item.get('teams', [])
            timestamp = item.get('timestamp', 'Unknown time')
            
            summary_items.append(f"• {title} (Teams: {', '.join(teams[:3])}) - {timestamp}")
        
        return "\n".join(summary_items)
    
    def _summarize_player_stats_insights(self, player_stats_data: List[Dict]) -> str:
        """Summarize player statistics insights"""
        if not player_stats_data:
            return "No recent player stats data available"
        
        summary_items = []
        for item in player_stats_data[:5]:  # Top 5 player stats items
            content = item.get('content', {})
            players = item.get('players', [])
            timestamp = item.get('timestamp', 'Unknown time')
            
            if isinstance(content, list) and content:
                # Summarize player stats
                stats = []
                for stat in content[:3]:  # Top 3 stat items
                    if 'player' in stat and 'avg' in stat:
                        stats.append(f"{stat['player']}: {stat.get('avg', 'N/A')}")
                
                summary_items.append(f"• Stats: {', '.join(stats)} - {timestamp}")
        
        return "\n".join(summary_items)
    
    def _summarize_performance_insights(self, performance_data: List[Dict]) -> str:
        """Summarize team performance insights"""
        if not performance_data:
            return "No recent performance data available"
        
        summary_items = []
        for item in performance_data[:5]:  # Top 5 performance items
            content = item.get('content', {})
            teams = item.get('teams', [])
            timestamp = item.get('timestamp', 'Unknown time')
            
            if isinstance(content, list) and content:
                # Summarize performance metrics
                metrics = []
                for perf in content[:3]:  # Top 3 performance items
                    if 'team' in perf and 'record' in perf:
                        metrics.append(f"{perf['team']}: {perf.get('record', 'N/A')}")
                
                summary_items.append(f"• Performance: {', '.join(metrics)} - {timestamp}")
        
        return "\n".join(summary_items)
    
    async def execute_enhanced_research_plan(self, plan: Dict[str, Any], props: List[PlayerProp], enhanced_insights: Dict[str, Any]) -> List[ResearchInsight]:
        """Execute research plan with enhanced Scrapy data integration"""
        all_insights = []
        
        logger.info("🔬 ENHANCED STAGE 1: Traditional + Scrapy Research")
        stage1_insights = await self._execute_initial_research(plan)
        all_insights.extend(stage1_insights)
        
        # NEW: Process Scrapy insights
        scrapy_insights = await self._process_scrapy_insights(plan.get("scrapy_insights", []), enhanced_insights)
        all_insights.extend(scrapy_insights)
        
        logger.info("🧠 ENHANCED STAGE 2: Adaptive Follow-up with Scrapy Intelligence")
        stage2_insights = await self._execute_adaptive_followup(stage1_insights + scrapy_insights, props)
        all_insights.extend(stage2_insights)
        
        logger.info("🎯 ENHANCED STAGE 3: Final Targeted Research")
        stage3_insights = await self._execute_final_research(all_insights, props)
        all_insights.extend(stage3_insights)
        
        logger.info(f"🔍 Total ENHANCED research insights gathered: {len(all_insights)}")
        return all_insights
    
    async def _process_scrapy_insights(self, scrapy_plan: List[Dict], enhanced_insights: Dict[str, Any]) -> List[ResearchInsight]:
        """Process Scrapy insights according to research plan"""
        insights = []
        
        for plan_item in scrapy_plan:
            insight_type = plan_item.get("insight_type", "player_stats")
            players = plan_item.get("players", [])
            analysis_focus = plan_item.get("analysis_focus", "General analysis")
            priority = plan_item.get("priority", "medium")
            
            logger.info(f"🕷️ Processing Scrapy {insight_type} for players: {players}")
            
            # Filter relevant data
            relevant_data = []
            for data_item in enhanced_insights.get(insight_type, []):
                item_players = data_item.get('players', [])
                if not players or any(player in item_players for player in players):
                    relevant_data.append(data_item)
            
            if relevant_data:
                confidence = 0.9 if priority == "high" else 0.7 if priority == "medium" else 0.5
                
                insights.append(ResearchInsight(
                    source=f"scrapy_{insight_type}",
                    query=f"{analysis_focus} for {', '.join(players)}",
                    data={
                        "analysis_focus": analysis_focus,
                        "players": players,
                        "scraped_data": relevant_data[:5],  # Top 5 most relevant
                        "data_count": len(relevant_data),
                        "priority": priority
                    },
                    confidence=confidence,
                    timestamp=datetime.now()
                ))
                
                logger.info(f"✅ Processed {len(relevant_data)} {insight_type} items for {players}")
        
        return insights
    
    async def _execute_initial_research(self, plan: Dict[str, Any]) -> List[ResearchInsight]:
        """Execute initial research (same as original but enhanced logging)"""
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
    
    async def _execute_adaptive_followup(self, initial_insights: List[ResearchInsight], props: List[PlayerProp]) -> List[ResearchInsight]:
        """Execute adaptive follow-up (enhanced with Scrapy context)"""
        insights_summary = []
        for insight in initial_insights:
            insights_summary.append({
                "source": insight.source,
                "query": insight.query,
                "data": str(insight.data)[:600],
                "confidence": insight.confidence
            })
        
        top_props = [{
            "player_name": prop.player_name,
            "team": prop.team,
            "prop_type": prop.prop_type,
            "line": prop.line,
            "over_odds": prop.over_odds,
            "under_odds": prop.under_odds
        } for prop in props[:30]]
        
        prompt = f"""
You are analyzing ENHANCED research findings that include traditional sources AND cutting-edge web scraping intelligence for PLAYER PROPS betting.

ENHANCED RESEARCH FINDINGS:
{json.dumps(insights_summary, indent=2)}

AVAILABLE PROPS TO ANALYZE:
{json.dumps(top_props, indent=2)}

Based on these ENHANCED findings, identify:
1. **KNOWLEDGE GAPS**: What key player information is still missing?
2. **SCRAPY ADVANTAGES**: How can web scraping data provide unique edges for props?
3. **SURPRISING FINDINGS**: Any results that suggest new research directions?
4. **PROP MISMATCHES**: Props that need more specific player research?

Generate ADAPTIVE follow-up queries that will maximize our enhanced data advantage for PLAYER PROPS.

Return JSON with this structure:
{{
    "analysis": "Brief analysis of enhanced findings and gaps identified for props",
    "followup_statmuse_queries": [
        {{
            "query": "Specific StatMuse question about player performance",
            "reasoning": "Why this query is needed based on enhanced findings",
            "priority": "high/medium/low"
        }}
    ],
    "followup_web_searches": [
        {{
            "query": "Web search query about player status",
            "reasoning": "Why this search is needed",
            "priority": "high/medium/low"
        }}
    ]
}}

Generate 3-6 high-value follow-up queries that will maximize our ENHANCED edge for player props.
"""
        
        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-beta-0709",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4
            )
            
            followup_text = response.choices[0].message.content
            start_idx = followup_text.find("{")
            end_idx = followup_text.rfind("}") + 1
            followup_plan = json.loads(followup_text[start_idx:end_idx])
            
            logger.info(f"🧠 Enhanced Adaptive Analysis: {followup_plan.get('analysis', 'No analysis provided')}")
            
            insights = []
            for query_obj in followup_plan.get("followup_statmuse_queries", [])[:5]:
                try:
                    query_text = query_obj.get("query", "")
                    reasoning = query_obj.get("reasoning", "")
                    priority = query_obj.get("priority", "medium")
                    
                    logger.info(f"🔍 Enhanced Adaptive StatMuse ({priority}): {query_text}")
                    logger.info(f"   Reasoning: {reasoning}")
                    
                    result = self.statmuse.query(query_text)
                    
                    if result and "error" not in result:
                        result_preview = str(result)[:200] + "..." if len(str(result)) > 200 else str(result)
                        logger.info(f"📊 Enhanced adaptive result: {result_preview}")
                        
                        confidence = 0.95 if priority == "high" else 0.8 if priority == "medium" else 0.6
                        insights.append(ResearchInsight(
                            source="statmuse_adaptive_enhanced",
                            query=query_text,
                            data=result,
                            confidence=confidence,
                            timestamp=datetime.now()
                        ))
                    
                    await asyncio.sleep(1.5)
                    
                except Exception as e:
                    logger.error(f"❌ Enhanced adaptive StatMuse query failed: {e}")
            
            for search_obj in followup_plan.get("followup_web_searches", [])[:3]:
                try:
                    search_query = search_obj.get("query", "")
                    reasoning = search_obj.get("reasoning", "")
                    priority = search_obj.get("priority", "medium")
                    
                    logger.info(f"🌐 Enhanced Adaptive Web Search ({priority}): {search_query}")
                    logger.info(f"   Reasoning: {reasoning}")
                    
                    result = self.web_search.search(search_query)
                    
                    confidence = 0.85 if priority == "high" else 0.7 if priority == "medium" else 0.5
                    insights.append(ResearchInsight(
                        source="web_search_adaptive_enhanced",
                        query=search_query,
                        data=result,
                        confidence=confidence,
                        timestamp=datetime.now()
                    ))
                    
                except Exception as e:
                    logger.error(f"❌ Enhanced adaptive web search failed: {e}")
            
            return insights
            
        except Exception as e:
            logger.error(f"Failed to generate enhanced adaptive follow-up: {e}")
            return []
    
    async def _execute_final_research(self, all_insights: List[ResearchInsight], props: List[PlayerProp]) -> List[ResearchInsight]:
        final_insights = []
        
        statmuse_count = len([i for i in all_insights if "statmuse" in i.source])
        web_count = len([i for i in all_insights if "web" in i.source])
        scrapy_count = len([i for i in all_insights if "scrapy" in i.source])
        
        logger.info(f"📊 Enhanced Research Summary: {statmuse_count} StatMuse + {web_count} Web + {scrapy_count} Scrapy insights")
        
        if len(all_insights) < 10:  # Higher threshold for enhanced system
            logger.info("🎯 Adding final enhanced research queries")
            
            top_players = list(set([prop.player_name for prop in props[:10]]))
            
            for player in top_players[:3]:
                try:
                    query = f"{player} recent performance and injury status"
                    logger.info(f"🔍 Final enhanced query: {query}")
                    
                    result = self.statmuse.query(query)
                    if result and "error" not in result:
                        final_insights.append(ResearchInsight(
                            source="statmuse_final_enhanced",
                            query=query,
                            data=result,
                            confidence=0.7,
                            timestamp=datetime.now()
                        ))
                    
                    await asyncio.sleep(1.5)
                    
                except Exception as e:
                    logger.error(f"❌ Final enhanced query failed: {e}")
        
        return final_insights
    
    async def generate_enhanced_picks_with_reasoning(
        self, 
        insights: List[ResearchInsight], 
        props: List[PlayerProp], 
        games: List[Dict],
        enhanced_insights: Dict[str, Any],
        target_picks: int
    ) -> List[Dict[str, Any]]:
        """Generate picks with enhanced reasoning using all data sources"""
        
        insights_summary = []
        for insight in insights[:50]:  # More insights for enhanced system
            insights_summary.append({
                "source": insight.source,
                "query": insight.query,
                "data": str(insight.data)[:800],
                "confidence": insight.confidence,
                "timestamp": insight.timestamp.isoformat()
            })
        
        # Enhanced filtering for props
        MAX_ODDS = 300  # Slightly lower for props
        filtered_props = []
        long_shot_count = 0
        
        for prop in props:
            # Check both over and under odds
            if abs(prop.over_odds) <= MAX_ODDS and abs(prop.under_odds) <= MAX_ODDS:
                filtered_props.append(prop)
            else:
                long_shot_count += 1
                logger.info(f"🚫 Filtered long shot prop: {prop.player_name} {prop.prop_type} (Over: {prop.over_odds}, Under: {prop.under_odds})")
        
        logger.info(f"🎯 Enhanced filtering: {len(props)} → {len(filtered_props)} (removed {long_shot_count} long shots)")
        
        # Prepare enhanced data for AI
        props_data = []
        for prop in filtered_props:
            props_data.append({
                "player_name": prop.player_name,
                "team": prop.team,
                "prop_type": prop.prop_type,
                "line": prop.line,
                "over_odds": prop.over_odds,
                "under_odds": prop.under_odds,
                "event_id": prop.event_id,
                "bookmaker": prop.bookmaker,
                "market": prop.market
            })
        
        games_info = json.dumps(games[:10], indent=2, default=str)
        props_info = json.dumps(props_data, indent=2)
        research_summary = json.dumps(insights_summary, indent=2)
        
        # Enhanced insights summary
        enhanced_summary = {
            "news_count": len(enhanced_insights.get('news', [])),
            "player_stats_count": len(enhanced_insights.get('player_stats', [])),
            "performance_count": len(enhanced_insights.get('team_performance', [])),
            "teams_covered": enhanced_insights.get('summary', {}).get('teams_covered', [])[:10],
            "last_updated": enhanced_insights.get('summary', {}).get('last_updated', 'Unknown')
        }
        
        props = filtered_props
        
        prompt = f"""
You are a professional sports betting analyst with 15+ years experience and access to CUTTING-EDGE web scraping intelligence that gives you a significant advantage over other bettors for PLAYER PROPS betting.

🔥 ENHANCED DATA ADVANTAGE:
You have exclusive access to real-time web scraping data that most bettors don't have:
- {enhanced_summary['news_count']} fresh news items
- {enhanced_summary['player_stats_count']} player statistics datasets
- {enhanced_summary['performance_count']} team performance datasets  
- Coverage of {len(enhanced_summary['teams_covered'])} teams
- Last updated: {enhanced_summary['last_updated']}

TODAY'S DATA:

🏟️ UPCOMING GAMES ({len(games)}):
{games_info}

🎯 AVAILABLE PLAYER PROPS ({len(filtered_props)}) - **ONLY PICK FROM THESE FILTERED PROPS**:
{props_info}

💡 **SMART FILTERING**: Long shot props (odds > +300) have been removed to focus on PROFITABLE opportunities.

🔍 ENHANCED RESEARCH INSIGHTS ({len(insights_summary)}):

**TRADITIONAL + SCRAPY DATA FINDINGS:**
{self._format_enhanced_insights(insights_summary)}

**RAW ENHANCED RESEARCH DATA:**
{research_summary}

TASK: Generate exactly {target_picks} strategic PLAYER PROPS picks that maximize expected value using your ENHANCED data advantage.

🚨 **ENHANCED BETTING DISCIPLINE FOR PROPS:**
1. **LEVERAGE SCRAPY ADVANTAGE**: Use web scraping insights others don't have
2. **MANDATORY ODDS CHECK**: Before picking, verify odds in the data
3. **NO HIGH-ODDS PICKS**: Never pick props with odds higher than +300
4. **FOCUS ON VALUE RANGE**: Target odds between -200 and +200
5. **DIVERSIFY PROP TYPES**: Use Hits, Runs, RBIs, Strikeouts intelligently
6. **ENHANCED CONFIDENCE**: Factor in scrapy data quality (higher confidence possible)
7. **REAL-TIME EDGE**: Use fresh scraped data for timing advantages
8. **PLAYER-SPECIFIC**: Focus on individual player trends and matchups

ENHANCED PROFITABLE STRATEGY FOR PROPS:
- **Scrapy Player News Edge**: Breaking player news before it moves lines
- **Performance Data Edge**: Advanced player metrics not in public stats
- **Injury Intelligence**: Real-time player status updates
- **Matchup Analysis**: Historical pitcher vs batter data
- **Form Analysis**: Recent hot/cold streaks from scraped data

FORMAT RESPONSE AS JSON ARRAY:
[
  {{
    "player_name": "Player Name",
    "team": "Team Name",
    "prop_type": "hits/runs/rbis/strikeouts/etc",
    "recommendation": "over" or "under",
    "line": line_value,
    "odds": recommended_odds_value,
    "confidence": confidence_percentage,
    "reasoning": "2-3 sentence analysis highlighting SCRAPY DATA ADVANTAGE",
    "key_factors": ["factor_1", "scrapy_insight", "factor_3"],
    "roi_estimate": "percentage like 8.5% or 12.3%",
    "value_percentage": "percentage like 15.2% or 22.8%",
    "implied_probability": "percentage like 45.5% or 62.1%",
    "fair_odds": "what the odds should be like -140 or +165",
    "scrapy_edge": "Specific advantage from web scraping data for this player"
  }}
]

🎯 **ENHANCED CONFIDENCE SCALE FOR PROPS:**
- 52-55%: Marginal edge with scrapy support
- 56-60%: Solid spot with enhanced player data backing
- 61-65%: Strong conviction with multiple scrapy confirmations  
- 66-70%: Exceptional opportunity with exclusive player intelligence
- 71%+: Obvious mispricing identified through scrapy advantage

REMEMBER: You have a DATA ADVANTAGE that most bettors don't have for player props. Use it to find edges they can't see!
"""
        
        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-beta-0709",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=4000
            )
            
            picks_text = response.choices[0].message.content.strip()
            logger.info(f"🧠 Enhanced Grok response: {picks_text[:500]}...")
            
            start_idx = picks_text.find("[")
            end_idx = picks_text.rfind("]") + 1
            
            if start_idx == -1 or end_idx == 0:
                logger.error("No JSON array found in enhanced Grok response")
                return []
            
            json_str = picks_text[start_idx:end_idx]
            ai_picks = json.loads(json_str)
            
            formatted_picks = []
            for pick in ai_picks:
                matching_prop = self._find_matching_prop(pick, props)
                
                if matching_prop:
                    game = next((g for g in games if str(g.get("id")) == str(matching_prop.event_id)), None)
                    
                    # Determine odds based on recommendation
                    odds = matching_prop.over_odds if pick.get("recommendation") == "over" else matching_prop.under_odds
                    
                    formatted_picks.append({
                        "match_teams": f"{matching_prop.player_name} ({matching_prop.team})",
                        "pick": self._format_prop_pick_string(pick, matching_prop),
                        "odds": pick.get("odds", odds),
                        "confidence": pick.get("confidence", 75),
                        "sport": "MLB",
                        "event_time": game.get("start_time") if game else None,
                        "bet_type": "player_prop",
                        "bookmaker": matching_prop.bookmaker,
                        "event_id": matching_prop.event_id,
                        "line_value": matching_prop.line,
                        "prop_market_type": matching_prop.prop_type,
                        "metadata": {
                            "player_name": pick["player_name"],
                            "team": pick["team"],
                            "prop_type": pick["prop_type"],
                            "recommendation": pick["recommendation"],
                            "line": pick.get("line", matching_prop.line),
                            "reasoning": pick.get("reasoning", "Enhanced AI-generated prop pick"),
                            "roi_estimate": pick.get("roi_estimate", "0%"),
                            "value_percentage": pick.get("value_percentage", "0%"),
                            "implied_probability": pick.get("implied_probability", "50%"),
                            "fair_odds": pick.get("fair_odds", pick.get("odds", 0)),
                            "key_factors": pick.get("key_factors", []),
                            "scrapy_edge": pick.get("scrapy_edge", "Enhanced player data advantage"),
                            "risk_level": pick.get("risk_level", "medium"),
                            "expected_value": pick.get("expected_value", "Positive EV expected"),
                            "research_support": pick.get("research_support", "Based on enhanced player analysis"),
                            "ai_generated": True,
                            "enhanced_system": True,
                            "research_insights_count": len(insights),
                            "scrapy_insights_used": True,
                            "model_used": "grok-beta-0709"
                        }
                    })
                else:
                    logger.warning(f"No matching prop found for {pick.get('player_name')} {pick.get('prop_type')}")
            
            final_picks = formatted_picks[:target_picks]
            
            if final_picks:
                # Enhanced analytics
                prop_types = {}
                recommendations = {"over": 0, "under": 0}
                confidence_ranges = {"50-60": 0, "61-70": 0, "71+": 0}
                scrapy_advantages = []
                
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
                    
                    scrapy_advantages.append(pick["metadata"]["scrapy_edge"])
                
                logger.info(f"📊 Enhanced Prop Pick Analysis:")
                logger.info(f"  Prop Types: {dict(prop_types)}")
                logger.info(f"  Recommendations: {dict(recommendations)}")
                logger.info(f"  Confidence Ranges: {dict(confidence_ranges)}")
                logger.info(f"  Scrapy Advantages Used: {len(set(scrapy_advantages))}")
                
                logger.info(f"📝 Generated {len(final_picks)} ENHANCED prop picks:")
                for i, pick in enumerate(final_picks, 1):
                    meta = pick["metadata"]
                    logger.info(f"  {i}. {meta['player_name']} {meta['prop_type']} {meta['recommendation'].upper()} ({pick['confidence']}% conf) - {meta['scrapy_edge'][:50]}...")
            
            return final_picks
            
        except Exception as e:
            logger.error(f"Failed to generate enhanced prop picks: {e}")
            return []

    def _format_enhanced_insights(self, insights_summary: List[Dict]) -> str:
        """Format insights with enhanced categorization"""
        statmuse_insights = [i for i in insights_summary if "statmuse" in i.get("source", "")]
        web_insights = [i for i in insights_summary if "web" in i.get("source", "")]
        scrapy_insights = [i for i in insights_summary if "scrapy" in i.get("source", "")]
        
        formatted = []
        
        if statmuse_insights:
            formatted.append("📊 STATMUSE DATA:")
            for insight in statmuse_insights[:5]:
                query = insight.get("query", "")
                data = insight.get("data", "")
                confidence = insight.get("confidence", 0.5)
                
                data_clean = str(data).replace("{", "").replace("}", "").replace("\"", "")
                if len(data_clean) > 200:
                    data_clean = data_clean[:200] + "..."
                
                formatted.append(f"• Q: {query}\n  A: {data_clean} (confidence: {confidence:.1f})")
        
        if web_insights:
            formatted.append("\n🌐 WEB SEARCH DATA:")
            for insight in web_insights[:3]:
                query = insight.get("query", "")
                data = insight.get("data", "")
                
                data_clean = str(data).replace("{", "").replace("}", "").replace("\"", "")
                if len(data_clean) > 150:
                    data_clean = data_clean[:150] + "..."
                
                formatted.append(f"• Search: {query}\n  Result: {data_clean}")
        
        if scrapy_insights:
            formatted.append("\n🕷️ SCRAPY INTELLIGENCE (EXCLUSIVE ADVANTAGE):")
            for insight in scrapy_insights[:5]:
                query = insight.get("query", "")
                data = insight.get("data", "")
                confidence = insight.get("confidence", 0.5)
                
                data_clean = str(data).replace("{", "").replace("}", "").replace("\"", "")
                if len(data_clean) > 250:
                    data_clean = data_clean[:250] + "..."
                
                formatted.append(f"• Analysis: {query}\n  Intelligence: {data_clean} (confidence: {confidence:.1f})")
        
        return "\n\n".join(formatted) if formatted else "No enhanced insights available"
    
    def _find_matching_prop(self, pick: Dict, props: List[PlayerProp]) -> PlayerProp:
        """Find matching prop"""
        player_name = pick.get("player_name", "")
        prop_type = pick.get("prop_type", "")
        
        exact_match = next(
            (prop for prop in props 
             if prop.player_name == player_name and prop.prop_type == prop_type),
            None
        )
        if exact_match:
            return exact_match
        
        fuzzy_match = next(
            (prop for prop in props 
             if (player_name.lower() in prop.player_name.lower() or prop.player_name.lower() in player_name.lower()) and
                prop.prop_type == prop_type),
            None
        )
        if fuzzy_match:
            logger.info(f"✅ Fuzzy matched '{player_name} {prop_type}' to '{fuzzy_match.player_name} {fuzzy_match.prop_type}'")
            return fuzzy_match
        
        logger.warning(f"❌ No match found for {player_name} {prop_type}")
        return None

    def _format_prop_pick_string(self, pick: Dict, matching_prop: PlayerProp) -> str:
        """Format prop pick string"""
        player_name = pick.get("player_name", "")
        prop_type = pick.get("prop_type", "")
        recommendation = pick.get("recommendation", "").lower()
        line = pick.get("line", matching_prop.line)

        return f"{player_name} {prop_type.title()} {recommendation.capitalize()} {line}"

async def main():
    """Test the enhanced props agent"""
    logger.info("🤖 Starting Enhanced Props Agent with Scrapy Integration")
    
    agent = EnhancedPropsAgent()
    picks = await agent.generate_daily_picks(target_picks=10)
    
    if picks:
        logger.info(f"✅ Successfully generated {len(picks)} ENHANCED intelligent prop picks!")
        for i, pick in enumerate(picks, 1):
            meta = pick.get('metadata', {})
            scrapy_edge = meta.get('scrapy_edge', 'No scrapy advantage listed')
            logger.info(f"Pick {i}: {pick['pick']} (Confidence: {pick['confidence']}%)")
            logger.info(f"  Scrapy Edge: {scrapy_edge}")
    else:
        logger.warning("❌ No enhanced prop picks generated")

if __name__ == "__main__":
    asyncio.run(main())
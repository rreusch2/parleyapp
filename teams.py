#!/usr/bin/env python3
"""
Intelligent Team Betting AI Agent
Uses StatMuse, web search, and intelligent reasoning to generate daily team picks
Handles: Moneyline, Spread, and Total bets
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

# Load environment variables
load_dotenv('backend/.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class TeamBet:
    """Team betting data structure"""
    home_team: str
    away_team: str
    bet_type: str  # 'moneyline', 'spread', 'total'
    line: Optional[float]  # Spread or total line
    home_odds: Optional[int]  # American odds for home team
    away_odds: Optional[int]  # American odds for away team
    over_odds: Optional[int]  # For totals
    under_odds: Optional[int]  # For totals
    event_id: str
    bookmaker: str
    game_time: str
    sport: str = "MLB"

@dataclass
class ResearchInsight:
    """Research insight from various sources"""
    source: str
    query: str
    data: Dict[str, Any]
    confidence: float
    timestamp: datetime

class StatMuseClient:
    """Client for StatMuse API server"""
    
    def __init__(self, base_url: str = "http://127.0.0.1:5001"):
        self.base_url = base_url
        self.session = requests.Session()
        
    def query(self, question: str) -> Dict[str, Any]:
        """Query StatMuse for sports data"""
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
    """Web search client using backend AI with web search tools"""
    
    def __init__(self):
        self.backend_url = os.getenv('BACKEND_URL', 'https://zooming-rebirth-production-a305.up.railway.app')
        self.user_id = "ai_teams_agent"
    
    def search(self, query: str) -> Dict[str, Any]:
        """Perform web search using backend AI with web search tools"""
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
                search_response = result.get('response', 'No results found')
                
                web_result = {
                    "query": query,
                    "results": [{
                        'title': 'AI Web Search Result',
                        'snippet': search_response[:300] + '...' if len(search_response) > 300 else search_response,
                        'url': 'AI-generated'
                    }],
                    "summary": search_response[:500] + '...' if len(search_response) > 500 else search_response
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
    """Database client for Supabase/PostgreSQL"""
    
    def __init__(self):
        # Initialize Supabase client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")
            
        self.supabase: Client = create_client(supabase_url, supabase_key)
    
    def get_upcoming_games(self, hours_ahead: int = 48) -> List[Dict[str, Any]]:
        """Get upcoming MLB games from sports_events table"""
        try:
            now = datetime.now().isoformat()
            future = (datetime.now() + timedelta(hours=hours_ahead)).isoformat()
            
            response = self.supabase.table('sports_events').select(
                'id, home_team, away_team, start_time, sport, metadata'
            ).gt('start_time', now).lt('start_time', future).eq('sport', 'MLB').order('start_time').execute()
            
            return response.data
        except Exception as e:
            logger.error(f"Failed to fetch upcoming games: {e}")
            return []
    
    def get_team_odds_for_games(self, game_ids: List[str]) -> List[TeamBet]:
        """Get team betting odds for specific games using existing odds_data table"""
        if not game_ids:
            return []
        
        try:
            # Query odds_data table with proper joins to get team betting odds
            response = self.supabase.table('odds_data').select(
                'event_id, outcome_name, outcome_price, outcome_point, '
                'sports_events(home_team, away_team, start_time), '
                'market_types(market_key, market_name), '
                'bookmakers(bookmaker_name)'
            ).in_('event_id', game_ids).in_(
                'market_types.market_key', ['h2h', 'spreads', 'totals']
            ).order('last_update', desc=True).execute()
            
            # Group odds by event and market type
            odds_by_event = {}
            for row in response.data:
                event_id = row['event_id']
                market_key = row['market_types']['market_key']
                
                if event_id not in odds_by_event:
                    odds_by_event[event_id] = {
                        'event_data': row['sports_events'],
                        'h2h': {},
                        'spreads': {},
                        'totals': {}
                    }
                
                # Store odds by market type
                odds_by_event[event_id][market_key][row['outcome_name']] = {
                    'odds': row['outcome_price'],
                    'point': row['outcome_point']
                }
            
            team_bets = []
            for event_id, data in odds_by_event.items():
                event_data = data['event_data']
                home_team = event_data['home_team']
                away_team = event_data['away_team']
                
                # Create moneyline bet
                if data['h2h']:
                    team_bets.append(TeamBet(
                        home_team=home_team,
                        away_team=away_team,
                        bet_type='moneyline',
                        line=None,
                        home_odds=int(data['h2h'].get(home_team, {}).get('odds', -110)),
                        away_odds=int(data['h2h'].get(away_team, {}).get('odds', -110)),
                        over_odds=None,
                        under_odds=None,
                        event_id=event_id,
                        bookmaker='fanduel',
                        game_time=event_data['start_time']
                    ))
                
                # Create spread bet
                if data['spreads']:
                    spread_data = list(data['spreads'].values())[0] if data['spreads'] else {}
                    team_bets.append(TeamBet(
                        home_team=home_team,
                        away_team=away_team,
                        bet_type='spread',
                        line=float(spread_data.get('point', -1.5)),
                        home_odds=int(spread_data.get('odds', -110)),
                        away_odds=int(spread_data.get('odds', -110)),
                        over_odds=None,
                        under_odds=None,
                        event_id=event_id,
                        bookmaker='fanduel',
                        game_time=event_data['start_time']
                    ))
                
                # Create total bet
                if data['totals']:
                    total_data = data['totals']
                    over_odds = int(total_data.get('Over', {}).get('odds', -110))
                    under_odds = int(total_data.get('Under', {}).get('odds', -110))
                    line = float(total_data.get('Over', {}).get('point', 8.5))
                    
                    team_bets.append(TeamBet(
                        home_team=home_team,
                        away_team=away_team,
                        bet_type='total',
                        line=line,
                        home_odds=None,
                        away_odds=None,
                        over_odds=over_odds,
                        under_odds=under_odds,
                        event_id=event_id,
                        bookmaker='fanduel',
                        game_time=event_data['start_time']
                    ))
            
            return team_bets
        except Exception as e:
            logger.error(f"Failed to fetch team odds: {e}")
            return []
    
    def store_ai_predictions(self, predictions: List[Dict[str, Any]]):
        """Store AI predictions in ai_predictions table"""
        try:
            for pred in predictions:
                # Extract reasoning from metadata if not in top level
                reasoning = pred.get('reasoning', '')
                if not reasoning and pred.get('metadata'):
                    reasoning = pred['metadata'].get('reasoning', '')
                
                # Calculate additional fields from the AI pick data
                roi_estimate_str = pred['metadata'].get('roi_estimate', '0%') if pred.get('metadata') else '0%'
                value_percentage_str = pred['metadata'].get('value_percentage', '0%') if pred.get('metadata') else '0%'
                
                # Convert percentage strings to floats
                try:
                    roi_estimate = float(roi_estimate_str.replace('%', '')) if roi_estimate_str else 0.0
                    value_percentage = float(value_percentage_str.replace('%', '')) if value_percentage_str else 0.0
                except (ValueError, AttributeError):
                    roi_estimate = 0.0
                    value_percentage = 0.0
                
                # Prepare complete data for insertion
                prediction_data = {
                    'user_id': 'c19a5e12-4297-4b0f-8d21-39d2bb1a2c08',  # System user ID
                    'confidence': pred.get('confidence', 0),
                    'pick': pred.get('pick', ''),
                    'odds': str(pred.get('odds', 0)),
                    'sport': pred.get('sport', 'MLB'),
                    'event_time': pred.get('event_time'),
                    'bet_type': pred.get('bet_type', 'team_bet'),
                    'game_id': str(pred.get('event_id', '')),
                    'match_teams': pred.get('match_teams', ''),
                    'reasoning': reasoning,
                    'line_value': pred.get('line_value') or pred.get('line', 0),
                    'prediction_value': pred.get('prediction_value'),
                    'prop_market_type': pred.get('prop_market_type', ''),
                    'roi_estimate': roi_estimate,
                    'value_percentage': value_percentage,
                    'status': 'pending',
                    'metadata': pred.get('metadata', {})
                }
                
                # Insert into Supabase
                self.supabase.table('ai_predictions').insert(prediction_data).execute()
                
            logger.info(f"Successfully stored {len(predictions)} AI team predictions")
            
        except Exception as e:
            logger.error(f"Failed to store AI predictions: {e}")

class IntelligentTeamBettingAgent:
    """Main AI agent for generating intelligent team betting picks"""
    
    def __init__(self):
        self.db = DatabaseClient()
        self.statmuse = StatMuseClient()
        self.web_search = WebSearchClient()
        # Use xAI Grok instead of OpenAI
        self.grok_client = AsyncOpenAI(
            api_key=os.getenv('XAI_API_KEY'),
            base_url="https://api.x.ai/v1"
        )
    
    async def fetch_upcoming_games(self) -> List[Dict[str, Any]]:
        """Convenience method to fetch upcoming games for testing"""
        return self.db.get_upcoming_games(hours_ahead=48)
    
    async def fetch_team_odds(self) -> List[TeamBet]:
        """Convenience method to fetch team odds for testing"""
        games = self.db.get_upcoming_games(hours_ahead=48)
        if not games:
            return []
        game_ids = [game['id'] for game in games]
        return self.db.get_team_odds_for_games(game_ids)
        
    async def generate_daily_picks(self, target_picks: int = 10) -> List[Dict[str, Any]]:
        """Main method to generate daily team betting picks"""
        logger.info("🚀 Starting intelligent team betting analysis...")
        
        # Step 1: Get upcoming games and available odds
        games = self.db.get_upcoming_games(hours_ahead=48)
        logger.info(f"📅 Found {len(games)} upcoming games")
        
        if not games:
            logger.warning("No upcoming games found")
            return []
        
        game_ids = [game['id'] for game in games]
        available_odds = self.db.get_team_odds_for_games(game_ids)
        logger.info(f"🎯 Found {len(available_odds)} available betting lines")
        
        if not available_odds:
            logger.warning("No team odds found")
            return []
        
        # Step 2: Create intelligent research plan
        research_plan = await self.create_research_plan(available_odds, games)
        statmuse_count = len(research_plan.get('statmuse_queries', []))
        web_search_count = len(research_plan.get('web_searches', []))
        total_queries = statmuse_count + web_search_count
        logger.info(f"📋 Created research plan with {statmuse_count} StatMuse + {web_search_count} web queries = {total_queries} total")
        
        # Step 3: Execute research plan
        insights = await self.execute_research_plan(research_plan, available_odds)
        logger.info(f"🔍 Gathered {len(insights)} research insights across all stages")
        
        # Step 4: Generate picks with AI reasoning
        picks = await self.generate_picks_with_reasoning(insights, available_odds, games, target_picks)
        logger.info(f"🎲 Generated {len(picks)} intelligent team picks")
        
        # Step 5: Store picks in database
        if picks:
            self.db.store_ai_predictions(picks)
            logger.info(f"💾 Stored {len(picks)} team picks in database")
        
        return picks
    
    async def create_research_plan(self, odds: List[TeamBet], games: List[Dict]) -> Dict[str, Any]:
        """Create an intelligent research plan using xAI Grok for team betting analysis"""
        
        # Create comprehensive prompt for Grok
        prompt = f"""You are an elite MLB betting analyst with 15+ years experience handicapping team bets (moneyline, spread, total).
Your mission is to create the most comprehensive research plan to identify the absolute BEST team betting opportunities for today.

# CONTEXT
You have access to {len(games)} upcoming MLB games with {len(odds)} betting lines available.

UPCOMING GAMES:
{json.dumps(games[:10], indent=2, default=str)}

AVAILABLE BETTING LINES (showing first 20 of {len(odds)}):
{json.dumps([{
    'home_team': bet.home_team,
    'away_team': bet.away_team,
    'bet_type': bet.bet_type,
    'line': bet.line,
    'home_odds': bet.home_odds,
    'away_odds': bet.away_odds,
    'over_odds': bet.over_odds,
    'under_odds': bet.under_odds,
    'bookmaker': bet.bookmaker
} for bet in odds[:20]], indent=2)}

# YOUR TOOLS

## StatMuse Tool
**SUCCESSFUL TEAM QUERY EXAMPLES**:
- "Yankees record this season"
- "Dodgers runs per game at home"
- "Red Sox bullpen ERA last 10 games"
- "Astros vs left-handed pitching this year"
- "Braves record in day games"
- "Coors Field runs scored average"
- "Yankee Stadium home runs this season"
- "Orioles batting average with runners in scoring position"

**TEAM RESEARCH FOCUS AREAS**:
- Team records and recent form
- Home/away splits and venue factors
- Pitching matchups and bullpen strength
- Offensive production and trends
- Head-to-head matchup history
- Weather impact and park factors

## Web Search Tool
Search for:
- Starting pitcher matchups and recent performance
- Injury reports and lineup changes
- Weather forecasts affecting totals
- Recent team news and motivation factors
- Bullpen usage and fatigue

# YOUR MISSION

Focus on finding edges in:
1. **MONEYLINE BETS**: Which team is likely to win straight up?
2. **SPREAD BETS**: Can favorite cover the run line (-1.5) or underdog stay within spread?
3. **TOTAL BETS**: Will the game go over/under the total runs?

# RESPONSE FORMAT

Return ONLY a valid JSON object:

{{
    "research_strategy": "Brief summary of your overall approach",
    "priority_games": [
        {{
            "matchup": "Home Team vs Away Team",
            "reasoning": "Why this game caught your attention",
            "edge_hypothesis": "Your theory on potential mispricing"
        }}
    ],
    "statmuse_queries": [
        {{
            "query": "Specific StatMuse question",
            "purpose": "What you're trying to learn",
            "priority": "high/medium/low"
        }}
    ],
    "web_searches": [
        {{
            "query": "Web search query",
            "purpose": "What information you need",
            "priority": "high/medium/low"
        }}
    ],
    "key_factors": ["List of most important factors for analysis"],
    "expected_insights": "What you expect to discover"
}}

Focus on finding real edges where oddsmakers may have made mistakes. Quality over quantity."""
        
        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-3-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            
            plan_text = response.choices[0].message.content
            # Extract JSON from response
            start_idx = plan_text.find('{')
            end_idx = plan_text.rfind('}') + 1
            plan_json = json.loads(plan_text[start_idx:end_idx])
            
            return plan_json
            
        except Exception as e:
            logger.error(f"Failed to create research plan: {e}")
            # Fallback plan
            return {
                "priority_games": [f"{bet.home_team} vs {bet.away_team}" for bet in odds[:10]],
                "statmuse_queries": [
                    f"{bet.home_team} record this season" for bet in odds[:3]
                ] + [
                    f"{bet.away_team} runs per game" for bet in odds[:3]
                ] + [
                    f"{bet.home_team} bullpen ERA" for bet in odds[:3]
                ],
                "research_focus": ["team_records", "pitching_matchups", "offensive_trends"],
                "bet_priorities": ["moneyline", "total", "spread"]
            }
    
    async def execute_research_plan(self, plan: Dict[str, Any], odds: List[TeamBet]) -> List[ResearchInsight]:
        """Execute adaptive multi-stage research with intelligent follow-ups"""
        all_insights = []
        
        # STAGE 1: Initial Research
        logger.info("🔬 STAGE 1: Initial Research")
        stage1_insights = await self._execute_initial_research(plan)
        all_insights.extend(stage1_insights)
        
        # STAGE 2: Adaptive Follow-up Research
        logger.info("🧠 STAGE 2: Analyzing findings and generating follow-up research")
        stage2_insights = await self._execute_adaptive_followup(stage1_insights, odds)
        all_insights.extend(stage2_insights)
        
        # STAGE 3: Final Targeted Research
        logger.info("🎯 STAGE 3: Final targeted research based on all findings")
        stage3_insights = await self._execute_final_research(all_insights, odds)
        all_insights.extend(stage3_insights)
        
        logger.info(f"🔍 Total research insights gathered: {len(all_insights)}")
        return all_insights
    
    async def _execute_initial_research(self, plan: Dict[str, Any]) -> List[ResearchInsight]:
        """Execute the initial batch of research queries"""
        insights = []
        
        # Execute first batch of StatMuse queries
        statmuse_queries = plan.get('statmuse_queries', [])[:8]
        for query_obj in statmuse_queries:
            try:
                query_text = query_obj.get('query', query_obj) if isinstance(query_obj, dict) else query_obj
                priority = query_obj.get('priority', 'medium') if isinstance(query_obj, dict) else 'medium'
                
                logger.info(f"🔍 StatMuse query ({priority}): {query_text}")
                result = self.statmuse.query(query_text)
                
                if result and 'error' not in result:
                    result_preview = str(result)[:200] + "..." if len(str(result)) > 200 else str(result)
                    logger.info(f"📊 StatMuse result: {result_preview}")
                    
                    confidence = 0.9 if priority == 'high' else 0.7 if priority == 'medium' else 0.5
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
        
        # Execute initial web searches
        web_searches = plan.get('web_searches', [])[:3]
        for search_obj in web_searches:
            try:
                search_query = search_obj.get('query', search_obj) if isinstance(search_obj, dict) else search_obj
                priority = search_obj.get('priority', 'medium') if isinstance(search_obj, dict) else 'medium'
                
                logger.info(f"🌐 Web search ({priority}): {search_query}")
                result = self.web_search.search(search_query)
                
                confidence = 0.8 if priority == 'high' else 0.6 if priority == 'medium' else 0.4
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
    
    async def _execute_adaptive_followup(self, initial_insights: List[ResearchInsight], odds: List[TeamBet]) -> List[ResearchInsight]:
        """Analyze initial results and generate adaptive follow-up queries"""
        
        # Prepare insights summary for Grok analysis
        insights_summary = []
        for insight in initial_insights:
            insights_summary.append({
                "source": insight.source,
                "query": insight.query,
                "data": str(insight.data)[:600],
                "confidence": insight.confidence
            })
        
        # Get top priority betting opportunities
        top_odds = [{
            "home_team": bet.home_team,
            "away_team": bet.away_team,
            "bet_type": bet.bet_type,
            "line": bet.line,
            "home_odds": bet.home_odds,
            "away_odds": bet.away_odds,
            "over_odds": bet.over_odds,
            "under_odds": bet.under_odds
        } for bet in odds[:20]]
        
        prompt = f"""
You are analyzing initial research findings for MLB team betting to identify gaps and generate intelligent follow-up queries.

INITIAL RESEARCH FINDINGS:
{json.dumps(insights_summary, indent=2)}

AVAILABLE BETTING OPPORTUNITIES:
{json.dumps(top_odds, indent=2)}

Based on these findings, identify:
1. **KNOWLEDGE GAPS**: What key team information is missing?
2. **SURPRISING FINDINGS**: Any results that suggest new research directions?
3. **BETTING MISMATCHES**: Games that need more specific analysis?

Generate ADAPTIVE follow-up queries that will fill these gaps for team betting.

Return JSON with this structure:
{{
    "analysis": "Brief analysis of findings and gaps identified",
    "followup_statmuse_queries": [
        {{
            "query": "Specific StatMuse question",
            "reasoning": "Why this query is needed for team betting",
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

Generate 3-6 high-value follow-up queries that will maximize our team betting edge.
"""
        
        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-3-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4
            )
            
            followup_text = response.choices[0].message.content
            start_idx = followup_text.find('{')
            end_idx = followup_text.rfind('}') + 1
            followup_plan = json.loads(followup_text[start_idx:end_idx])
            
            logger.info(f"🧠 Adaptive Analysis: {followup_plan.get('analysis', 'No analysis provided')}")
            
            # Execute adaptive queries
            insights = []
            for query_obj in followup_plan.get('followup_statmuse_queries', [])[:5]:
                try:
                    query_text = query_obj.get('query', '')
                    reasoning = query_obj.get('reasoning', '')
                    priority = query_obj.get('priority', 'medium')
                    
                    logger.info(f"🔍 Adaptive StatMuse ({priority}): {query_text}")
                    logger.info(f"   Reasoning: {reasoning}")
                    
                    result = self.statmuse.query(query_text)
                    
                    if result and 'error' not in result:
                        result_preview = str(result)[:200] + "..." if len(str(result)) > 200 else str(result)
                        logger.info(f"📊 Adaptive result: {result_preview}")
                        
                        confidence = 0.95 if priority == 'high' else 0.8 if priority == 'medium' else 0.6
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
            
            # Execute adaptive web searches
            for search_obj in followup_plan.get('followup_web_searches', [])[:3]:
                try:
                    search_query = search_obj.get('query', '')
                    reasoning = search_obj.get('reasoning', '')
                    priority = search_obj.get('priority', 'medium')
                    
                    logger.info(f"🌐 Adaptive Web Search ({priority}): {search_query}")
                    logger.info(f"   Reasoning: {reasoning}")
                    
                    result = self.web_search.search(search_query)
                    
                    confidence = 0.85 if priority == 'high' else 0.7 if priority == 'medium' else 0.5
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
    
    async def _execute_final_research(self, all_insights: List[ResearchInsight], odds: List[TeamBet]) -> List[ResearchInsight]:
        """Execute final targeted research to fill any remaining gaps"""
        
        final_insights = []
        
        # Get insights by source for analysis
        statmuse_count = len([i for i in all_insights if 'statmuse' in i.source])
        web_count = len([i for i in all_insights if 'web' in i.source])
        
        logger.info(f"📊 Research Summary: {statmuse_count} StatMuse + {web_count} Web insights")
        
        # If we have few insights, do some final broad queries
        if len(all_insights) < 8:
            logger.info("🎯 Adding final broad research queries")
            
            # Add a few more targeted queries for top games
            top_teams = list(set([bet.home_team for bet in odds[:15]] + [bet.away_team for bet in odds[:15]]))
            
            for team in top_teams[:3]:  # Final queries for top 3 teams
                try:
                    query = f"{team} record last 10 games"
                    logger.info(f"🔍 Final query: {query}")
                    
                    result = self.statmuse.query(query)
                    if result and 'error' not in result:
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
        odds: List[TeamBet], 
        games: List[Dict],
        target_picks: int
    ) -> List[Dict[str, Any]]:
        """Use Grok to synthesize all research and generate the best team picks"""
        
        # Prepare comprehensive data for Grok analysis
        insights_summary = []
        for insight in insights[:40]:
            insights_summary.append({
                "source": insight.source,
                "query": insight.query,
                "data": str(insight.data)[:800],
                "confidence": insight.confidence,
                "timestamp": insight.timestamp.isoformat()
            })
        
        # Filter reasonable odds (no extreme long shots)
        MAX_ODDS = 300  # Exclude bets with odds higher than +300
        
        filtered_odds = []
        for bet in odds:
            # Check if odds are reasonable for each bet type
            if bet.bet_type == 'moneyline':
                if ((bet.home_odds and abs(bet.home_odds) <= MAX_ODDS) or 
                    (bet.away_odds and abs(bet.away_odds) <= MAX_ODDS)):
                    filtered_odds.append(bet)
            elif bet.bet_type == 'total':
                if ((bet.over_odds and abs(bet.over_odds) <= MAX_ODDS) or 
                    (bet.under_odds and abs(bet.under_odds) <= MAX_ODDS)):
                    filtered_odds.append(bet)
            else:  # spread
                if ((bet.home_odds and abs(bet.home_odds) <= MAX_ODDS) or 
                    (bet.away_odds and abs(bet.away_odds) <= MAX_ODDS)):
                    filtered_odds.append(bet)
        
        logger.info(f"🎯 Filtered odds: {len(odds)} → {len(filtered_odds)} (removed long shots with odds > +{MAX_ODDS})")
        
        # Show FILTERED odds to focus on profitable opportunities
        odds_data = []
        for bet in filtered_odds:
            odds_data.append({
                "home_team": bet.home_team,
                "away_team": bet.away_team,
                "bet_type": bet.bet_type,
                "line": bet.line,
                "home_odds": bet.home_odds,
                "away_odds": bet.away_odds,
                "over_odds": bet.over_odds,
                "under_odds": bet.under_odds,
                "event_id": bet.event_id,
                "bookmaker": bet.bookmaker,
                "game_time": bet.game_time
            })
        
        games_info = json.dumps(games[:10], indent=2, default=str)
        odds_info = json.dumps(odds_data, indent=2)
        research_summary = json.dumps(insights_summary, indent=2)
        
        prompt = f"""
You are a professional MLB betting analyst with 15+ years experience handicapping team bets.
Your job is to find PROFITABLE betting opportunities in moneyline, spread, and total bets.

TODAY'S DATA:

🏟️ UPCOMING GAMES ({len(games)}):
{games_info}

🎯 AVAILABLE TEAM BETTING LINES ({len(filtered_odds)}) - **ONLY PICK FROM THESE FILTERED ODDS**:
{odds_info}

💡 **SMART FILTERING**: Long shot bets (odds > +300) have been removed to focus on PROFITABLE opportunities.

⚠️  **CRITICAL**: You MUST pick from the exact teams and bet types listed above.
Available bet types: {set(bet.bet_type for bet in filtered_odds)}
Available teams: {list(set([bet.home_team for bet in filtered_odds] + [bet.away_team for bet in filtered_odds]))}

🔍 RESEARCH INSIGHTS ({len(insights_summary)}):
{research_summary}

TASK: Generate exactly {target_picks} strategic team betting picks that maximize expected value.

🚨 **BETTING DISCIPLINE REQUIREMENTS:**
1. **ODDS VALIDATION**: Before picking, verify odds are reasonable (under +300)
2. **DIVERSIFY BET TYPES**: Mix moneyline, spread, and total bets
3. **VALUE FOCUS**: Target odds between -200 and +200 for best profit
4. **REALISTIC CONFIDENCE**: Most picks should be 55-70% confidence
5. **SHARP ANALYSIS**: Focus on edges where oddsmakers made mistakes

PROFITABLE STRATEGIES:
- **MONEYLINE**: Look for undervalued underdogs or overvalued favorites
- **SPREAD (-1.5)**: Consider team's ability to win by 2+ runs
- **TOTALS**: Weather, park factors, pitching matchups affect run production
- **SITUATIONAL SPOTS**: Travel, rest, motivation, lineup changes

CONFIDENCE SCALE:
- 52-55%: Marginal edge (only if great odds)
- 56-65%: Solid spot (most picks should be here)
- 66-75%: Strong conviction
- 76%+: Exceptional opportunity (rare)

FORMAT RESPONSE AS JSON ARRAY:
[
  {{
    "home_team": "Home Team Name",
    "away_team": "Away Team Name",
    "bet_type": "moneyline", "spread", or "total",
    "recommendation": "home", "away", "over", or "under",
    "line": line_value_if_applicable,
    "odds": american_odds_value,
    "confidence": confidence_percentage,
    "reasoning": "2-3 sentence sharp analysis focusing on key edge found",
    "key_factors": ["factor_1", "factor_2", "factor_3"],
    "roi_estimate": "percentage like 8.5%",
    "value_percentage": "percentage like 12.3%",
    "implied_probability": "percentage like 45.5%",
    "fair_odds": "what odds should be like -140"
  }}
]

Focus on finding spots where the oddsmakers may have made mistakes or where public perception differs from reality.
"""
        
        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-3-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=4000
            )
            
            picks_text = response.choices[0].message.content.strip()
            logger.info(f"🧠 Grok raw response: {picks_text[:500]}...")
            
            # Extract JSON from response
            start_idx = picks_text.find('[')
            end_idx = picks_text.rfind(']') + 1
            
            if start_idx == -1 or end_idx == 0:
                logger.error("No JSON array found in Grok response")
                return []
            
            json_str = picks_text[start_idx:end_idx]
            ai_picks = json.loads(json_str)
            
            # Validate and convert to final format
            formatted_picks = []
            for pick in ai_picks:
                # Find corresponding betting line
                matching_bet = self._find_matching_bet(pick, filtered_odds)
                
                if matching_bet:
                    # Find corresponding game
                    game = next((g for g in games if str(g.get('id')) == str(matching_bet.event_id)), None)
                    
                    formatted_picks.append({
                        "match_teams": f"{matching_bet.home_team} vs {matching_bet.away_team}",
                        "pick": f"{pick['home_team']} vs {pick['away_team']} {pick['bet_type']} {pick['recommendation']}",
                        "odds": pick.get('odds', 0),
                        "confidence": pick.get('confidence', 75),
                        "sport": "MLB",
                        "event_time": game.get('start_time') if game else matching_bet.game_time,
                        "bet_type": pick['bet_type'],
                        "bookmaker": matching_bet.bookmaker,
                        "event_id": matching_bet.event_id,
                        "metadata": {
                            "home_team": pick['home_team'],
                            "away_team": pick['away_team'],
                            "bet_type": pick['bet_type'],
                            "recommendation": pick['recommendation'],
                            "line": pick.get('line'),
                            "reasoning": pick.get('reasoning', 'AI-generated team pick'),
                            "roi_estimate": pick.get('roi_estimate', '0%'),
                            "value_percentage": pick.get('value_percentage', '0%'),
                            "implied_probability": pick.get('implied_probability', '50%'),
                            "fair_odds": pick.get('fair_odds', pick.get('odds', 0)),
                            "key_factors": pick.get('key_factors', []),
                            "ai_generated": True,
                            "research_insights_count": len(insights),
                            "model_used": "grok-3-mini"
                        }
                    })
                else:
                    logger.warning(f"No matching bet found for {pick.get('home_team')} vs {pick.get('away_team')} {pick.get('bet_type')}")
            
            # Log pick statistics
            final_picks = formatted_picks[:target_picks]
            
            if final_picks:
                # Count bet type diversity
                bet_types = {}
                recommendations = {}
                
                for pick in final_picks:
                    bet_type = pick['bet_type']
                    bet_types[bet_type] = bet_types.get(bet_type, 0) + 1
                    
                    rec = pick['metadata']['recommendation']
                    recommendations[rec] = recommendations.get(rec, 0) + 1
                
                logger.info(f"📊 Team Pick Diversity:")
                logger.info(f"  Bet Types: {dict(bet_types)}")
                logger.info(f"  Recommendations: {dict(recommendations)}")
                
                # Log individual picks
                logger.info(f"📝 Generated {len(final_picks)} team picks:")
                for i, pick in enumerate(final_picks, 1):
                    meta = pick['metadata']
                    logger.info(f"  {i}. {meta['home_team']} vs {meta['away_team']} {meta['bet_type']} {meta['recommendation'].upper()} ({pick['confidence']}% conf)")
            
            return final_picks
            
        except Exception as e:
            logger.error(f"Failed to generate team picks: {e}")
            return []

    def _find_matching_bet(self, pick: Dict, odds: List[TeamBet]) -> TeamBet:
        """Find matching team bet"""
        home_team = pick.get('home_team', '')
        away_team = pick.get('away_team', '')
        bet_type = pick.get('bet_type', '')
        
        # Try exact match first
        exact_match = next(
            (bet for bet in odds 
             if bet.home_team == home_team and bet.away_team == away_team and bet.bet_type == bet_type),
            None
        )
        if exact_match:
            return exact_match
        
        # Try fuzzy team name matching
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

async def main():
    """Main execution function"""
    logger.info("🤖 Starting Intelligent Team Betting Agent")
    
    agent = IntelligentTeamBettingAgent()
    picks = await agent.generate_daily_picks(target_picks=10)
    
    if picks:
        logger.info(f"✅ Successfully generated {len(picks)} intelligent team picks!")
        for i, pick in enumerate(picks, 1):
            logger.info(f"Pick {i}: {pick['pick']} (Confidence: {pick['confidence']}%)")
    else:
        logger.warning("❌ No team picks generated")

if __name__ == "__main__":
    asyncio.run(main())
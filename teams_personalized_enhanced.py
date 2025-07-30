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
    home_team: str
    away_team: str
    bet_type: str  # moneyline, spread, total_over, total_under
    line: Optional[float]
    odds: int
    sport: str
    event_id: str
    bookmaker: str
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
        # Use backend AI API for web search
        self.backend_url = os.getenv("BACKEND_URL", "https://zooming-rebirth-production-a305.up.railway.app")
        
    def search(self, query: str) -> Dict[str, Any]:
        """Perform web search using backend AI API"""
        try:
            response = requests.post(
                f"{self.backend_url}/api/ai/chat",
                json={
                    "message": f"Search the web for: {query}",
                    "userId": "teams-agent",
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
        """Fetch upcoming games from ALL sports"""
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

    def get_team_odds_for_games(self, game_ids: List[str]) -> List[TeamBet]:
        """Fetch team betting odds from sports_events metadata across ALL sports"""
        if not game_ids:
            return []
        
        try:
            # Get the games with their metadata which contains the odds
            response = self.supabase.table("sports_events").select(
                "id, sport, home_team, away_team, start_time, metadata"
            ).in_("id", game_ids).execute()
            
            team_bets = []
            for game in response.data:
                try:
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
                                    team_bets.append(TeamBet(
                                        home_team=game["home_team"],
                                        away_team=game["away_team"],
                                        bet_type="moneyline",
                                        line=None,
                                        odds=int(price),
                                        sport=game["sport"],
                                        event_id=game["id"],
                                        bookmaker=bookmaker_key,
                                        event_time=game.get("start_time")
                                    ))
                        
                        # 2. Spread
                        elif market_key == "spreads":
                            for outcome in outcomes:
                                team_name = outcome.get("name")
                                point = outcome.get("point")
                                price = outcome.get("price")
                                
                                if team_name and point is not None and price is not None:
                                    team_bets.append(TeamBet(
                                        home_team=game["home_team"],
                                        away_team=game["away_team"],
                                        bet_type="spread",
                                        line=float(point),
                                        odds=int(price),
                                        sport=game["sport"],
                                        event_id=game["id"],
                                        bookmaker=bookmaker_key,
                                        event_time=game.get("start_time")
                                    ))
                        
                        # 3. Totals
                        elif market_key == "totals":
                            for outcome in outcomes:
                                bet_name = outcome.get("name", "").lower()
                                point = outcome.get("point")
                                price = outcome.get("price")
                                
                                if bet_name and point is not None and price is not None:
                                    bet_type = "total_over" if "over" in bet_name else "total_under"
                                    team_bets.append(TeamBet(
                                        home_team=game["home_team"],
                                        away_team=game["away_team"],
                                        bet_type=bet_type,
                                        line=float(point),
                                        odds=int(price),
                                        sport=game["sport"],
                                        event_id=game["id"],
                                        bookmaker=bookmaker_key,
                                        event_time=game.get("start_time")
                                    ))
                                        
                except (KeyError, TypeError, ValueError) as e:
                    logger.warning(f"Skipping malformed odds data for game {game.get('id')}: {e}")
                    continue
            
            # Group by sport for logging
            sport_bet_counts = {}
            for bet in team_bets:
                sport = bet.sport
                sport_bet_counts[sport] = sport_bet_counts.get(sport, 0) + 1
            
            logger.info(f"Found {len(team_bets)} team betting options across all sports:")
            for sport, count in sport_bet_counts.items():
                logger.info(f"  {sport}: {count} betting options")
            
            return team_bets
        except Exception as e:
            logger.error(f"Error fetching team odds: {e}")
            return []

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
                
                # Map to actual ai_predictions_dev table schema
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
                
                result = self.supabase.table("ai_predictions_dev").insert(prediction_data).execute()
                logger.info(f"✅ Stored prediction: {pred.get('pick', 'Unknown')} (ID: {result.data[0]['id'] if result.data else 'Unknown'})")
                
            logger.info(f"Successfully stored {len(predictions)} AI predictions in DEV table")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store AI predictions: {e}")
            return False

class PersonalizedTeamBettingAgent:
    def __init__(self):
        self.db = DatabaseClient()
        self.statmuse = StatMuseClient()
        self.web_search = WebSearchClient()
        self.grok_client = AsyncOpenAI(
            api_key=os.getenv("XAI_API_KEY"),
            base_url="https://api.x.ai/v1"
        )

    async def generate_personalized_picks_by_sport(self) -> Dict[str, List[Dict[str, Any]]]:
        """Generate 20 team picks per sport that has active games"""
        logger.info("🏈 Starting personalized multi-sport team betting generation...")
        
        # Fetch games and odds
        games = self.db.get_upcoming_games()
        if not games:
            logger.warning("No upcoming games found")
            return {}
        
        game_ids = [game['id'] for game in games]
        all_team_bets = self.db.get_team_odds_for_games(game_ids)
        
        if not all_team_bets:
            logger.warning("No team betting options found")
            return {}
        
        # Group bets by sport
        bets_by_sport = {}
        games_by_sport = {}
        
        for bet in all_team_bets:
            sport = bet.sport
            if sport not in bets_by_sport:
                bets_by_sport[sport] = []
                games_by_sport[sport] = []
            bets_by_sport[sport].append(bet)
        
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
            
            # Get team betting options for this sport's games
            game_ids = [game['id'] for game in sport_games]
            sport_bets = [bet for bet in all_team_bets if bet.sport == sport]
            
            if not sport_bets:
                logger.warning(f"No team betting options found for {sport}")
                continue
            
            logger.info(f"🎯 Generating 15 TEAM picks for {sport} ({len(sport_bets)} betting options available)")
            
            picks = await self._generate_picks_for_sport(sport, sport_bets, sport_games, target_picks=15)
            
            if picks:
                all_picks_by_sport[sport] = picks
                logger.info(f"✅ Generated {len(picks)} team picks for {sport}")
        
        return all_picks_by_sport

    async def _generate_picks_for_sport(self, sport: str, team_bets: List[TeamBet], games: List[Dict], target_picks: int = 20) -> List[Dict[str, Any]]:
        """Generate team picks for a specific sport"""
        try:
            # Create research plan
            research_plan = await self.create_research_plan(sport, team_bets, games)
            
            # Execute research
            insights = await self.execute_research_plan(research_plan, team_bets)
            
            # Generate picks with reasoning
            picks = await self.generate_picks_with_reasoning(sport, insights, team_bets, games, target_picks)
            
            return picks
        except Exception as e:
            logger.error(f"Error generating team picks for {sport}: {e}")
            return []

    async def create_research_plan(self, sport: str, team_bets: List[TeamBet], games: List[Dict]) -> Dict[str, Any]:
        """Create intelligent research plan for specific sport team betting"""
        try:
            # Analyze available bets
            bet_analysis = self._analyze_available_bets(team_bets, games)
            
            # Create sport-specific research prompt with mandatory queries
            teams_in_games = list(set([bet.home_team for bet in team_bets[:8]] + [bet.away_team for bet in team_bets[:8]]))
            
            prompt = f"""You are an expert {sport} betting analyst. Create a comprehensive research plan for team betting.

TODAY'S {sport.upper()} GAMES:
- {len(games)} games scheduled
- Key teams: {', '.join(teams_in_games[:10])}
- Available bet types: {', '.join(set(b.bet_type for b in team_bets[:20]))}

You MUST create research queries to find betting edges. Return EXACTLY this JSON format:

{{
  "statmuse_queries": [
    "How has [Team A] performed in their last 5 games?",
    "What is [Team B]'s record at home this season?",
    "[Sport] injury report today",
    "[Sport] weather conditions affecting games today",
    "Best [Sport] team betting trends this week",
    "[Sport] line movements today",
    "[Team C] vs [Team D] head to head record",
    "[Sport] home field advantage statistics"
  ],
  "web_queries": [
    "{sport} injury report today",
    "{sport} weather conditions today", 
    "{sport} lineup changes today",
    "Best {sport} betting picks today",
    "{sport} team news today",
    "{sport} line movements analysis today"
  ]
}}

Replace [Team A], [Team B], etc. with actual teams from: {', '.join(teams_in_games[:6])}
Replace [Sport] with {sport}.

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
                return self._create_fallback_research_plan(sport, team_bets)
                
        except Exception as e:
            logger.error(f"Error creating research plan for {sport}: {e}")
            return self._create_fallback_research_plan(sport, team_bets)

    def _create_fallback_research_plan(self, sport: str, team_bets: List[TeamBet]) -> Dict[str, Any]:
        """Create a basic research plan if AI planning fails"""
        top_teams = list(set([bet.home_team for bet in team_bets[:5]] + [bet.away_team for bet in team_bets[:5]]))
        
        return {
            "statmuse_queries": [
                f"How has {team} performed in their last 5 games?" for team in top_teams[:4]
            ] + [
                f"{sport} injury report today",
                f"Best {sport} team betting picks today",
                f"{sport} weather conditions affecting games today",
                f"{sport} line movements today"
            ],
            "web_queries": [
                f"{sport} injury report today",
                f"{sport} weather conditions today",
                f"{sport} lineup changes today",
                f"Best {sport} betting picks today",
                f"{sport} team news today",
                f"{sport} line movements today"
            ]
        }

    def _analyze_available_bets(self, team_bets: List[TeamBet], games: List[Dict]) -> Dict[str, Any]:
        """Analyze the available betting options"""
        bet_types = {}
        teams = set()
        
        for bet in team_bets:
            # Count bet types
            bet_types[bet.bet_type] = bet_types.get(bet.bet_type, 0) + 1
            teams.add(bet.home_team)
            teams.add(bet.away_team)
        
        return {
            "total_bets": len(team_bets),
            "bet_types": bet_types,
            "teams": list(teams),
            "games_count": len(games)
        }

    async def execute_research_plan(self, plan: Dict[str, Any], team_bets: List[TeamBet]) -> List[ResearchInsight]:
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
        team_bets: List[TeamBet], 
        games: List[Dict],
        target_picks: int
    ) -> List[Dict[str, Any]]:
        """Generate team picks with detailed reasoning for specific sport"""
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
            prompt = f"""You are a professional {sport} betting analyst generating {target_picks} high-value team betting picks.

RESEARCH INSIGHTS:
{json.dumps(insights_summary, indent=2)}

AVAILABLE TEAM BETS ({len(team_bets)} total):
{self._format_bets_for_ai(team_bets)}

REQUIREMENTS:
1. Generate EXACTLY {target_picks} picks
2. Focus on {sport} team betting only (moneyline, spread, total)
3. Each pick must include:
   - home_team and away_team (exact match from available bets)
   - bet_type (moneyline/spread/total)
   - pick (home/away for ML, home/away for spread, over/under for total)
   - reasoning (2-3 sentences with specific insights)
   - confidence (55-88 range)
   - roi_estimate (percentage)
   - value_percentage (1-100)

4. Diversify across different bet types and games
5. Only pick from the EXACT betting options provided above
6. Use research insights to justify each pick
7. Focus on finding value and edges in the market
8. Balance moneyline, spread, and total bets

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
                    # Find matching bet
                    matching_bet = self._find_matching_bet(pick, team_bets)
                    if matching_bet:
                        processed_pick = {
                            'match_teams': f"{matching_bet.away_team} @ {matching_bet.home_team}",
                            'pick': self._format_team_pick_string(pick, matching_bet),
                            'odds': f"{matching_bet.odds:+d}",
                            'confidence': min(88, max(55, int(pick.get('confidence', 65)))),
                            'bet_type': matching_bet.bet_type,
                            'sport': sport,  # Add sport metadata
                            'event_time': matching_bet.event_time,  # Add event time
                            'event_id': matching_bet.event_id,  # Add event ID
                            'line': matching_bet.line,  # Add line value
                            'metadata': {
                                'home_team': matching_bet.home_team,
                                'away_team': matching_bet.away_team,
                                'bet_type': matching_bet.bet_type,
                                'line': matching_bet.line,
                                'reasoning': pick.get('reasoning', 'Value play based on analysis'),
                                'roi_estimate': pick.get('roi_estimate', '5-8%'),
                                'value_percentage': pick.get('value_percentage', 15),
                                'bookmaker': matching_bet.bookmaker
                            }
                        }
                        processed_picks.append(processed_pick)
                    else:
                        logger.warning(f"Could not find matching bet for: {pick.get('home_team')} vs {pick.get('away_team')} - {pick.get('bet_type')}")
                
                logger.info(f"Generated {len(processed_picks)} valid {sport} team picks from {len(picks_data)} AI suggestions")
                return processed_picks[:target_picks]  # Ensure we don't exceed target
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse picks JSON for {sport}: {e}")
                return []
                
        except Exception as e:
            logger.error(f"Error generating team picks for {sport}: {e}")
            return []

    def _format_bets_for_ai(self, team_bets: List[TeamBet]) -> str:
        """Format betting options for AI consumption"""
        formatted = []
        for bet in team_bets[:50]:  # Limit to avoid token overflow
            line_info = f" ({bet.line:+.1f})" if bet.line else ""
            formatted.append(f"• {bet.away_team} @ {bet.home_team} - {bet.bet_type.title()}{line_info}: {bet.odds:+d}")
        
        if len(team_bets) > 50:
            formatted.append(f"... and {len(team_bets) - 50} more betting options available")
        
        return '\n'.join(formatted)

    def _find_matching_bet(self, pick: Dict, team_bets: List[TeamBet]) -> Optional[TeamBet]:
        """Find matching team bet with flexible matching"""
        home_team = pick.get('home_team', '').strip()
        away_team = pick.get('away_team', '').strip()
        bet_type = pick.get('bet_type', '').strip().lower()
        
        # Normalize bet type variations
        bet_type_mappings = {
            'moneyline': ['moneyline', 'ml', 'h2h'],
            'spread': ['spread', 'point spread', 'handicap'],
            'total': ['total', 'over/under', 'o/u', 'total_over', 'total_under'],
            'total_over': ['total', 'over/under', 'o/u', 'total_over'],
            'total_under': ['total', 'over/under', 'o/u', 'total_under']
        }
        
        # Try exact matches first
        for bet in team_bets:
            if (bet.home_team.lower() == home_team.lower() and 
                bet.away_team.lower() == away_team.lower() and
                bet.bet_type.lower() == bet_type):
                return bet
        
        # Try with bet type variations
        for bet in team_bets:
            if (bet.home_team.lower() == home_team.lower() and 
                bet.away_team.lower() == away_team.lower()):
                # Check if bet types match through mappings
                for normalized_type, variations in bet_type_mappings.items():
                    if bet_type in variations and bet.bet_type.lower() in variations:
                        return bet
                
                # Special handling for "total" - match any total_over or total_under
                if bet_type == 'total' and bet.bet_type.lower() in ['total_over', 'total_under']:
                    return bet
        
        # Try partial team name matches
        for bet in team_bets:
            home_match = (home_team.lower() in bet.home_team.lower() or 
                         bet.home_team.lower() in home_team.lower())
            away_match = (away_team.lower() in bet.away_team.lower() or 
                         bet.away_team.lower() in away_team.lower())
            
            if home_match and away_match:
                # Check bet type variations
                for normalized_type, variations in bet_type_mappings.items():
                    if bet_type in variations and bet.bet_type.lower() in variations:
                        return bet
        
        return None

    def _format_team_pick_string(self, pick: Dict, matching_bet: TeamBet) -> str:
        """Format the team pick string for clarity"""
        bet_type = matching_bet.bet_type.lower()
        pick_choice = pick.get('pick', '').lower()
        
        if bet_type == 'moneyline':
            if pick_choice == 'home':
                return f"{matching_bet.home_team} ML"
            else:
                return f"{matching_bet.away_team} ML"
        elif bet_type == 'spread':
            if pick_choice == 'home':
                return f"{matching_bet.home_team} {matching_bet.line:+.1f}"
            else:
                return f"{matching_bet.away_team} {-matching_bet.line:+.1f}"
        elif bet_type == 'total':
            return f"{pick_choice.title()} {matching_bet.line}"
        else:
            return f"{pick_choice} {bet_type}"

    async def store_all_picks(self, picks_by_sport: Dict[str, List[Dict[str, Any]]]) -> bool:
        """Store all picks from all sports"""
        all_picks = []
        for sport, picks in picks_by_sport.items():
            all_picks.extend(picks)
        
        if all_picks:
            success = self.db.store_ai_predictions(all_picks)
            logger.info(f"Stored {len(all_picks)} total team picks across {len(picks_by_sport)} sports")
            return success
        return False

async def main():
    """Main execution function"""
    agent = PersonalizedTeamBettingAgent()
    
    # Generate picks for all sports
    picks_by_sport = await agent.generate_personalized_picks_by_sport()
    
    if picks_by_sport:
        # Store all picks
        await agent.store_all_picks(picks_by_sport)
        
        # Log summary
        for sport, picks in picks_by_sport.items():
            logger.info(f"✅ {sport}: {len(picks)} team picks generated")
    else:
        logger.warning("No team picks generated for any sport")

if __name__ == "__main__":
    asyncio.run(main())

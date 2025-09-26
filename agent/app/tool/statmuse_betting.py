"""
StatMuse Integration Tool for OpenManus
Provides access to StatMuse API for sports statistics and analysis
"""
import os
import requests
from typing import Optional, Dict, Any
import json

from pydantic import PrivateAttr
from app.tool.base import BaseTool, ToolResult
from app.logger import logger


class StatMuseBettingTool(BaseTool):
    """Tool for querying StatMuse API for sports statistics and player data"""
    
    name: str = "statmuse_query"
    description: str = """Query StatMuse API for detailed sports statistics and player performance data.
    
    StatMuse provides comprehensive sports data and can answer natural language questions about:
    - Player statistics (season averages, recent performance, career stats)
    - Team performance (records, offensive/defensive stats, recent form)
    - Head-to-head matchups and historical trends
    - Stadium/venue specific statistics
    - Situational stats (home/away, vs specific opponents, weather conditions)
    
    Examples of good queries:
    - "Kansas City Chiefs record vs Los Angeles Chargers this season"
    - "Jose Altuve batting average last 10 games"  
    - "Boston Celtics points per game at home this season"
    - "Tampa Bay Lightning power play percentage last 15 games"
    - "Yankee Stadium home runs allowed this season"
    """
    
    parameters: dict = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Natural language question about sports statistics. Be specific and direct."
            },
            "sport": {
                "type": "string",
                "enum": ["MLB", "NFL", "WNBA", "CFB", "NHL", "NBA"],
                "description": "Sport context for the query (optional but helps accuracy)"
            },
            "player_name": {
                "type": "string", 
                "description": "Specific player name if query is about individual player stats"
            },
            "team_name": {
                "type": "string",
                "description": "Specific team name if query is about team stats"
            }
        },
        "required": ["query"]
    }

    # runtime-only attrs
    _session: requests.Session = PrivateAttr()
    _statmuse_url: str = PrivateAttr()

    def __init__(self):
        super().__init__()
        # Prefer explicit env URL, then Railway env, else default to local server
        env_url = os.getenv("STATMUSE_API_URL") or os.getenv("RAILWAY_STATMUSE_URL")
        fallback_url = "http://127.0.0.1:5001"
        self._statmuse_url = env_url or fallback_url
        self._session = requests.Session()
        logger.info(f"StatMuseBettingTool initialized (url={self._statmuse_url})")

    async def execute(self, **kwargs) -> ToolResult:
        """Execute StatMuse query"""
        
        query = kwargs.get("query", "").strip()
        if not query:
            return self.fail_response("Query parameter is required and cannot be empty")
        
        sport = kwargs.get("sport", "")
        player_name = kwargs.get("player_name", "")
        team_name = kwargs.get("team_name", "")
        
        logger.info(f"Executing StatMuse query: {query}")
        if sport:
            logger.info(f"Sport context: {sport}")
        
        try:
            # Enhance query with context if provided
            enhanced_query = self._enhance_query(query, sport, player_name, team_name)
            
            # Make request to StatMuse API
            payload = {
                "query": enhanced_query,
                "sport": sport if sport else None
            }
            
            response = self._session.post(
                f"{self._statmuse_url}/query",
                json=payload,
                timeout=30,
                headers={"Content-Type": "application/json"}
            )
            
            response.raise_for_status()
            result = response.json()
            
            # Check if StatMuse returned an error
            if isinstance(result, dict) and "error" in result:
                logger.warning(f"StatMuse API error: {result.get('error')}")
                return self.fail_response(f"StatMuse error: {result.get('error')}")
            
            # Process and format the result
            processed_result = self._process_statmuse_result(result, query, sport)
            
            logger.info(f"StatMuse query successful: {query[:50]}...")
            return self.success_response(processed_result)
            
        except requests.exceptions.Timeout:
            return self.fail_response("StatMuse query timed out (30s). The query may be too complex or the service is slow.")
        
        except requests.exceptions.ConnectionError:
            return self.fail_response("Could not connect to StatMuse service. Ensure the StatMuse server is running on localhost:5001.")
        
        except requests.exceptions.HTTPError as e:
            return self.fail_response(f"StatMuse API error: HTTP {e.response.status_code}")
        
        except json.JSONDecodeError:
            return self.fail_response("Invalid response format from StatMuse API")
        
        except Exception as e:
            logger.error(f"StatMuse query failed: {str(e)}")
            return self.fail_response(f"StatMuse query failed: {str(e)}")

    def _enhance_query(self, query: str, sport: str, player_name: str, team_name: str) -> str:
        """Enhance the query with additional context for better results"""
        
        enhanced_query = query
        
        # Add sport context if not already in query
        if sport and sport.lower() not in query.lower():
            enhanced_query = f"{query} ({sport})"
        
        # Ensure player/team names are properly formatted if provided
        if player_name and player_name.lower() not in query.lower():
            # Only add if not already mentioned
            enhanced_query = enhanced_query.replace("this player", player_name)
        
        if team_name and team_name.lower() not in query.lower():
            enhanced_query = enhanced_query.replace("this team", team_name)
        
        return enhanced_query

    def _process_statmuse_result(self, result: Any, original_query: str, sport: str) -> Dict[str, Any]:
        """Process and standardize StatMuse result for betting analysis"""
        
        processed = {
            "original_query": original_query,
            "sport_context": sport,
            "statmuse_result": result,
            "data_confidence": "high",  # StatMuse data is generally reliable
            "analysis_summary": "",
            "key_statistics": [],
            "betting_insights": []
        }
        
        # Try to extract key information from the result
        if isinstance(result, dict):
            
            # Extract summary if available
            if "summary" in result:
                processed["analysis_summary"] = result["summary"]
            elif "answer" in result:
                processed["analysis_summary"] = str(result["answer"])
            elif "text" in result:
                processed["analysis_summary"] = str(result["text"])
            else:
                processed["analysis_summary"] = "StatMuse provided data for your query."
            
            # Extract numerical data for betting analysis
            key_stats = []
            betting_insights = []
            
            # Look for common statistical patterns
            result_str = str(result).lower()
            
            # Extract team records (W-L patterns)
            import re
            records = re.findall(r'(\d+)-(\d+)', str(result))
            if records:
                for wins, losses in records:
                    win_pct = int(wins) / (int(wins) + int(losses)) if (int(wins) + int(losses)) > 0 else 0
                    key_stats.append(f"Record: {wins}-{losses} ({win_pct:.3f})")
                    
                    # Betting insight
                    if win_pct > 0.600:
                        betting_insights.append("Strong team with good winning percentage")
                    elif win_pct < 0.400:
                        betting_insights.append("Struggling team with poor record")
            
            # Extract averages and per-game stats
            avg_patterns = re.findall(r'(\d+\.?\d*)\s*(?:points?|runs?|goals?|yards?)\s*per\s*game', result_str)
            if avg_patterns:
                for avg in avg_patterns[:3]:  # Limit to first 3 found
                    key_stats.append(f"Average per game: {avg}")
            
            # Extract percentages
            pct_patterns = re.findall(r'(\d+\.?\d*)%', str(result))
            if pct_patterns:
                for pct in pct_patterns[:3]:
                    key_stats.append(f"Percentage stat: {pct}%")
            
            processed["key_statistics"] = key_stats
            processed["betting_insights"] = betting_insights
            
        elif isinstance(result, str):
            # Simple string result
            processed["analysis_summary"] = result
            
        elif isinstance(result, (int, float)):
            # Numerical result
            processed["analysis_summary"] = f"Statistical value: {result}"
            processed["key_statistics"] = [str(result)]
        
        else:
            # Unknown format, convert to string
            processed["analysis_summary"] = str(result)
        
        # Add data freshness indicator
        processed["data_freshness"] = "Current season data from StatMuse"
        
        # Provide query suggestions for follow-up analysis
        processed["suggested_followup_queries"] = self._generate_followup_queries(original_query, sport)
        
        return processed

    def _generate_followup_queries(self, original_query: str, sport: str) -> list:
        """Generate relevant follow-up queries based on the original query"""
        
        followup_queries = []
        query_lower = original_query.lower()
        
        # If asking about a player, suggest team and opponent stats
        if any(word in query_lower for word in ["player", "batting", "passing", "rushing", "points"]):
            followup_queries.extend([
                "team performance this season",
                "recent games and trends",
                "performance vs upcoming opponent"
            ])
        
        # If asking about a team, suggest player and matchup stats  
        if any(word in query_lower for word in ["team", "record", "offense", "defense"]):
            followup_queries.extend([
                "key player statistics",
                "home vs away splits",
                "recent form last 10 games"
            ])
        
        # Sport-specific suggestions
        if sport == "MLB":
            followup_queries.extend([
                "bullpen ERA and usage",
                "ballpark factors and dimensions",
                "weather impact on scoring"
            ])
        elif sport == "NFL":
            followup_queries.extend([
                "injury report impact",
                "turnover differential",
                "red zone efficiency"
            ])
        elif sport == "WNBA":
            followup_queries.extend([
                "pace of play statistics", 
                "three-point shooting trends",
                "rebounding matchup analysis"
            ])
        
        return followup_queries[:5]  # Limit to 5 suggestions

    async def query_player_stats(self, player_name: str, stat_type: str = "season", sport: str = "") -> ToolResult:
        """Convenience method for player-specific queries"""
        
        query_map = {
            "season": f"{player_name} season statistics",
            "recent": f"{player_name} last 10 games statistics", 
            "career": f"{player_name} career averages",
            "home": f"{player_name} home game statistics",
            "away": f"{player_name} away game statistics"
        }
        
        query = query_map.get(stat_type, f"{player_name} {stat_type}")
        
        return await self.execute(query=query, sport=sport, player_name=player_name)

    async def query_team_performance(self, team_name: str, stat_type: str = "season", sport: str = "") -> ToolResult:
        """Convenience method for team-specific queries"""
        
        query_map = {
            "season": f"{team_name} season record and statistics",
            "recent": f"{team_name} last 10 games performance",
            "home": f"{team_name} home game record this season",
            "away": f"{team_name} away game record this season", 
            "offense": f"{team_name} offensive statistics this season",
            "defense": f"{team_name} defensive statistics this season"
        }
        
        query = query_map.get(stat_type, f"{team_name} {stat_type}")
        
        return await self.execute(query=query, sport=sport, team_name=team_name)

    async def query_head_to_head(self, team1: str, team2: str, sport: str = "") -> ToolResult:
        """Convenience method for head-to-head matchup queries"""
        
        query = f"{team1} vs {team2} head to head record this season"
        
        return await self.execute(query=query, sport=sport)

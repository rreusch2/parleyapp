"""
Linemate.io Trends Scraping Tool for Sports Betting Analysis
Scrapes player trends from Linemate.io for various sports
"""
from typing import Dict, List, Any
from pydantic import PrivateAttr

from app.tool.base import BaseTool, ToolResult
from app.logger import logger


class LinemateTrendsTool(BaseTool):
    """Tool for scraping Linemate.io player trends using browser automation"""
    
    name: str = "linemate_trends"
    description: str = """Scrape player performance trends from trend analysis platforms.
    
    This tool navigates to sport-specific trend pages and extracts player performance patterns,
    prop hit rates, and betting trends. Use this data to identify value opportunities.
    
    Supported sports: NHL, MLB, NFL, CFB (NCAAF)
    
    Returns structured trend data for players including:
    - Recent prop performance (hit rates over last 5/10/15 games)
    - Situational trends (home/away, vs opponent type, etc)
    - Line value indicators
    - Prop market trends
    """
    
    parameters: dict = {
        "type": "object",
        "properties": {
            "sport": {
                "type": "string",
                "enum": ["NHL", "MLB", "NFL", "CFB", "NCAAF"],
                "description": "Sport to get trends for"
            },
            "player_names": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional: Specific player names to look for. If not provided, scrapes all visible trends."
            },
            "prop_type": {
                "type": "string",
                "description": "Optional: Filter by prop type (assists, points, goals, etc). If not provided, gets all props."
            },
            "max_scroll": {
                "type": "integer",
                "default": 3,
                "description": "Number of times to scroll down to load more trends (1-5)"
            }
        },
        "required": ["sport"]
    }
    
    # Private attribute for browser tool reference
    _browser_tool = PrivateAttr(default=None)
    
    def __init__(self):
        super().__init__()
        
    async def execute(self, **kwargs) -> ToolResult:
        """
        Execute Linemate trends scraping
        
        Args:
            sport: Sport to scrape (NHL, MLB, NFL, CFB)
            player_names: Optional list of specific players to look for
            prop_type: Optional prop type filter
            max_scroll: Number of scroll actions (1-5)
        """
        try:
            sport = kwargs.get("sport", "").upper()
            player_names = kwargs.get("player_names", [])
            prop_type = kwargs.get("prop_type", "")
            max_scroll = min(kwargs.get("max_scroll", 3), 5)
            
            if sport not in ["NHL", "MLB", "NFL", "CFB", "NCAAF"]:
                return self.fail_response(f"Unsupported sport: {sport}")
            
            # Map sport to Linemate URL
            sport_urls = {
                "NHL": "https://linemate.io/nhl/trends",
                "MLB": "https://linemate.io/mlb/trends",
                "NFL": "https://linemate.io/nfl/trends",
                "CFB": "https://linemate.io/ncaaf/trends",
                "NCAAF": "https://linemate.io/ncaaf/trends"
            }
            
            url = sport_urls[sport]
            logger.info(f"Scraping {sport} trends from {url}")
            
            # Import browser tool here to avoid circular imports
            from app.tool.browser_use_tool import BrowserUseTool
            
            # Initialize browser if needed
            if self._browser_tool is None:
                self._browser_tool = BrowserUseTool()
            
            # Navigate to trends page
            nav_result = await self._browser_tool.execute(action="go_to_url", url=url)
            if nav_result.error:
                return self.fail_response(f"Failed to navigate to {url}: {nav_result.error}")
            
            # Wait longer for Linemate to fully load (it's a dynamic site)
            await self._browser_tool.execute(action="wait", seconds=5)
            
            # Extract trends from the page - be very specific about Linemate's structure
            extract_goal = f"""Extract ALL player props and trends visible on this page.

LINEMATE STRUCTURE:
- The LEFT SIDEBAR contains player cards with trend data
- Each card shows: player name, prop type, hit rate, and trend status
- Extract EVERY player card you can see

For each player, extract:
- player_name: Full name
- prop_type: The stat type (assists, points, goals, receiving_yards, rushing_yards, passing_yards, etc)
- hit_rate: Hit percentage (e.g., 70 for 70%)
- trend: "hot", "cold", or "neutral" based on visual indicators
- line_value: The betting line if visible (e.g., "Over 0.5")

{f'FILTER: Focus especially on these players: {", ".join(player_names)}' if player_names else 'Extract ALL players visible'}
{f'FILTER: Focus on {prop_type} prop type' if prop_type else ''}

Return comprehensive JSON array with all players found."""
            
            extract_result = await self._browser_tool.execute(
                action="extract_content",
                goal=extract_goal
            )
            
            if extract_result.error:
                logger.warning(f"Initial extraction failed: {extract_result.error}")
            else:
                logger.info(f"Initial extraction output preview: {extract_result.output[:500]}...")
            
            trends_data = []
            initial_data = self._parse_extraction(extract_result.output if not extract_result.error else "")
            if initial_data:
                logger.info(f"Initial extraction found {len(initial_data)} trends")
                trends_data.extend(initial_data)
            else:
                logger.warning("Initial extraction returned no trend data")
            
            # Scroll to get more trends - target the left sidebar specifically
            for scroll_num in range(max_scroll):
                logger.info(f"Scrolling down ({scroll_num + 1}/{max_scroll}) to load more trends")
                
                # Scroll down the page (Linemate's left sidebar scrolls with the page)
                # Increased scroll amount to load more content
                await self._browser_tool.execute(
                    action="scroll_down",
                    scroll_amount=1200
                )
                
                # Wait longer for dynamic content to load
                await self._browser_tool.execute(action="wait", seconds=3)
                
                # Extract again
                extract_result = await self._browser_tool.execute(
                    action="extract_content",
                    goal=extract_goal
                )
                
                if not extract_result.error:
                    logger.info(f"Scroll {scroll_num+1} extraction preview: {extract_result.output[:300]}...")
                    new_data = self._parse_extraction(extract_result.output)
                    if new_data:
                        logger.info(f"Scroll {scroll_num+1} found {len(new_data)} new trends")
                        # Only add unique trends
                        existing_keys = {(t.get("player_name"), t.get("prop_type")) for t in trends_data}
                        for trend in new_data:
                            key = (trend.get("player_name"), trend.get("prop_type"))
                            if key not in existing_keys:
                                trends_data.append(trend)
                                existing_keys.add(key)
                    else:
                        logger.warning(f"Scroll {scroll_num+1} returned no new trend data")
                else:
                    logger.warning(f"Scroll {scroll_num+1} extraction failed: {extract_result.error}")
            
            if not trends_data:
                return self.fail_response(f"No trend data extracted from {url}. Page may have loaded incorrectly.")
            
            # Format results
            summary = self._format_trends_summary(trends_data, sport, player_names, prop_type)
            
            return self.success_response({
                "sport": sport,
                "total_trends": len(trends_data),
                "trends": trends_data,
                "summary": summary
            })
            
        except Exception as e:
            logger.error(f"Linemate trends scraping failed: {str(e)}")
            return self.fail_response(f"Linemate trends error: {str(e)}")
    
    def _parse_extraction(self, extracted_text: str) -> List[Dict[str, Any]]:
        """Parse extracted text into structured trend data"""
        try:
            import json
            import re
            
            trends = []
            
            if not extracted_text or not extracted_text.strip():
                logger.warning("Empty extraction text received")
                return []
            
            # Try to parse as JSON first - handle code blocks
            try:
                text = extracted_text.strip()
                
                # Remove markdown code blocks if present
                if text.startswith('```'):
                    lines = text.split('\n')
                    # Remove first line (```json or ```) and last line (```)
                    text = '\n'.join(lines[1:-1]) if len(lines) > 2 else text
                    text = text.strip()
                
                # Try parsing as JSON
                if text.startswith('[') or text.startswith('{'):
                    parsed = json.loads(text)
                    
                    # Handle different JSON structures
                    if isinstance(parsed, list):
                        logger.info(f"Parsed {len(parsed)} trends from JSON array")
                        return parsed
                    elif isinstance(parsed, dict):
                        # Check for common wrapper keys
                        if 'players' in parsed and isinstance(parsed['players'], list):
                            logger.info(f"Parsed {len(parsed['players'])} trends from JSON object with 'players' key")
                            return parsed['players']
                        elif 'trends' in parsed and isinstance(parsed['trends'], list):
                            logger.info(f"Parsed {len(parsed['trends'])} trends from JSON object with 'trends' key")
                            return parsed['trends']
                        else:
                            # Single trend object
                            return [parsed]
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parsing failed: {e}")
            except Exception as e:
                logger.warning(f"Unexpected error parsing JSON: {e}")
            
            # Fall back to regex parsing if JSON fails
            # Look for player names and trend patterns
            lines = extracted_text.split('\n')
            current_trend = {}
            
            for line in lines:
                line = line.strip()
                if not line:
                    if current_trend:
                        trends.append(current_trend)
                        current_trend = {}
                    continue
                
                # Try to identify player names (usually capitalized)
                if re.match(r'^[A-Z][a-z]+ [A-Z][a-z]+', line):
                    if current_trend:
                        trends.append(current_trend)
                    current_trend = {"player_name": line}
                
                # Look for prop types
                prop_keywords = ['assists', 'points', 'goals', 'blocked', 'shots', 'rebounds', 'touchdowns', 'yards', 'hits', 'runs']
                for prop in prop_keywords:
                    if prop in line.lower():
                        current_trend["prop_type"] = prop
                
                # Look for percentages (hit rates)
                percent_match = re.search(r'(\d+)%', line)
                if percent_match:
                    current_trend["hit_rate"] = int(percent_match.group(1))
                
                # Look for trend indicators
                if any(word in line.lower() for word in ['hot', 'trending up', 'strong']):
                    current_trend["trend"] = "hot"
                elif any(word in line.lower() for word in ['cold', 'trending down', 'weak']):
                    current_trend["trend"] = "cold"
            
            if current_trend:
                trends.append(current_trend)
            
            return trends
            
        except Exception as e:
            logger.error(f"Failed to parse trends extraction: {e}")
            return []
    
    def _format_trends_summary(
        self, 
        trends: List[Dict], 
        sport: str, 
        player_filter: List[str], 
        prop_filter: str
    ) -> str:
        """Format a readable summary of trend data"""
        
        if not trends:
            return "No trends data extracted"
        
        summary_lines = [
            f"\n=== {sport} Player Trends Analysis ===",
            f"Total trends analyzed: {len(trends)}\n"
        ]
        
        # Hot trends
        hot_trends = [t for t in trends if t.get("trend") == "hot"]
        if hot_trends:
            summary_lines.append(f"🔥 HOT TRENDS ({len(hot_trends)}):")
            for trend in hot_trends[:10]:  # Top 10
                player = trend.get("player_name", "Unknown")
                prop = trend.get("prop_type", "Unknown")
                hit_rate = trend.get("hit_rate", "N/A")
                summary_lines.append(f"  • {player} - {prop}: {hit_rate}% hit rate")
        
        # High hit rate trends (70%+)
        high_hit = [t for t in trends if t.get("hit_rate", 0) >= 70]
        if high_hit:
            summary_lines.append(f"\n📈 HIGH HIT RATE TRENDS (70%+): {len(high_hit)}")
            for trend in high_hit[:10]:
                player = trend.get("player_name", "Unknown")
                prop = trend.get("prop_type", "Unknown")
                hit_rate = trend.get("hit_rate", 0)
                summary_lines.append(f"  • {player} - {prop}: {hit_rate}%")
        
        # Filtered results if applicable
        if player_filter:
            filtered = [t for t in trends if any(
                p.lower() in t.get("player_name", "").lower() for p in player_filter
            )]
            if filtered:
                summary_lines.append(f"\n🎯 Filtered Results ({len(filtered)}):")
                for trend in filtered:
                    player = trend.get("player_name")
                    prop = trend.get("prop_type")
                    summary_lines.append(f"  • {player} - {prop}")
        
        return "\n".join(summary_lines)
    
    async def cleanup(self):
        """Cleanup browser resources"""
        if self._browser_tool:
            await self._browser_tool.cleanup()


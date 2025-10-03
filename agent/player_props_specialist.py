"""
Player Props Specialist Agent for ParleyApp
Uses OpenManus framework for intelligent, autonomous player prop research and prediction

This agent:
1. Queries player_props_odds table to get available props for the day
2. Intelligently plans research strategy using AI reasoning
3. Uses multiple tools: StatMuse, Web Search, Browser, Supabase
4. Generates high-quality prop predictions with proper formatting
5. Stores predictions in ai_predictions table

TERMINATION RULES:
- As soon as you have stored at least {num_picks} high-quality predictions and summarized insights, call the 'terminate' tool to stop.
- Do not continue to step through the plan unnecessarily once done.
"""
import os
import sys
import argparse
import json
import asyncio
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Add parent directory to path to import agent modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.agent.manus import Manus
from app.logger import logger
from app.tool.statmuse_betting import StatMuseBettingTool
from app.tool.supabase_betting import SupabaseBettingTool
from app.tool.web_search import WebSearch
from app.tool.browser_use_tool import BrowserUseTool
from app.tool.tool_collection import ToolCollection

# Load environment from backend
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))


class PlayerPropsSpecialist:
    """
    Intelligent AI agent that autonomously researches and generates player prop predictions
    """
    
    def __init__(self, target_date: Optional[str] = None):
        """
        Initialize the specialist agent
        
        Args:
            target_date: Date in YYYY-MM-DD format (defaults to tomorrow)
        """
        self.target_date = target_date or self._get_tomorrow_date()
        self.agent: Optional[Manus] = None
        
        # Tools that will be available to the agent
        self.statmuse_tool = StatMuseBettingTool()
        self.supabase_tool = SupabaseBettingTool()
        
        # Set forced date on Supabase tool so it queries the right date
        self.supabase_tool.set_forced_date(self.target_date)
        
        logger.info(f"🎯 Player Props Specialist initialized for {self.target_date}")
    
    def _get_tomorrow_date(self) -> str:
        """Get tomorrow's date in YYYY-MM-DD format"""
        tomorrow = datetime.now().date() + timedelta(days=1)
        return tomorrow.isoformat()
    
    async def initialize(self):
        """Initialize the Manus agent with specialized tools"""
        logger.info("🚀 Initializing AI agent with specialized tools...")
        
        # Create Manus agent
        self.agent = await Manus.create()
        # Allow longer autonomous runs; agent should call terminate when done
        self.agent.max_steps = 100
        
        # Add our custom betting tools
        self.agent.available_tools.add_tools(
            self.statmuse_tool,
            self.supabase_tool
        )
        
        logger.info(f"✅ Agent initialized with {len(self.agent.available_tools.tools)} tools")
        logger.info(f"📋 Available tools: {[tool.name for tool in self.agent.available_tools.tools]}")
    
    async def generate_predictions(self, num_picks: int = 15) -> Dict[str, Any]:
        """
        Main method to generate player prop predictions
        
        The agent will:
        1. Query available player props from database
        2. Intelligently plan research strategy
        3. Use StatMuse for statistical analysis
        4. Use web search for injuries, lineups, weather, trends
        5. Use browser for Linemate.io trends when helpful
        6. Generate predictions with proper formatting
        7. Store in ai_predictions table
        
        Args:
            num_picks: Target number of picks to generate
            
        Returns:
            Results summary
        """
        if not self.agent:
            await self.initialize()
        
        logger.info(f"🎲 Starting player prop prediction generation for {self.target_date}")
        logger.info(f"🎯 Target: {num_picks} high-quality picks")
        
        # Build comprehensive mission prompt for the agent
        mission_prompt = self._build_mission_prompt(num_picks)
        
        # Run the agent
        logger.info("🤖 Activating autonomous AI agent...")
        await self.agent.run(mission_prompt)
        
        # Get results from agent's actions
        results = await self._extract_results()
        
        logger.info(f"✅ Prediction generation completed!")
        return results
    
    def _build_mission_prompt(self, num_picks: int) -> str:
        """Build comprehensive mission prompt for the AI agent"""
        
        return f"""

You are an **elite sports betting AI specialist** focused exclusively on **player prop predictions**. Your goal is to generate {num_picks} **profitable, well-researched player prop picks** for {self.target_date}.

## YOUR AVAILABLE TOOLS:

1. **supabase_betting**: Access betting data from database
   - `get_upcoming_games`: Get games for a specific date (Step 1)
   - `get_player_props`: Get available player props for those game_ids (Step 2)
   - `store_predictions`: Save your final predictions
   - `get_games_by_sport`: Filter games by sport (optional)
   - `get_player_props_by_date`: Alternative quick query if needed

2. **statmuse_query**: Query comprehensive sports statistics
   - Player recent performance (last 10 games, season averages)
   - Team performance and matchup history
   - Stadium/venue-specific stats
   - Head-to-head matchups
   - Situational stats (home/away, vs opponent, weather impact)

3. **browser_use**: Automated web browsing
   - Navigate to trend pages for each sport (do not mention any site by name in outputs)
   - URLs: https://linemate.io/mlb/trends, https://linemate.io/wnba/trends, https://linemate.io/nfl/trends, https://linemate.io/ncaaf/trends
   - Extract player trend data (e.g., "Hit in 8 of last 10 games vs Yankees")
   - Use scrolling: `scroll_down` for page, and `scroll_element` with `selector` or `index` to scroll left trend panels and load more items
   - Browse ESPN for matchup analysis

4. **web_search**: Search the web for critical information
   - Injury reports and lineup changes
   - Weather forecasts for outdoor games
   - Recent news affecting players
   - Pitcher matchups (for MLB)
   - Coaching decisions and rotations

## INTELLIGENT RESEARCH STRATEGY:

### PHASE 1: DISCOVERY (Get Available Props)
1. Use `supabase_betting` with action `get_upcoming_games` to get games for {self.target_date}
   - Collect returned `id` values into `game_ids`
2. Use `supabase_betting` with action `get_player_props` and pass `game_ids` to fetch ALL player props for those games
3. Analyze the prop landscape:
   - Which sports have the most props?
   - Which prop types are available (hits, rushing yards, points, etc.)?
   - Which players have props?
   - What are the odds telling you?

### PHASE 2: STRATEGIC PLANNING (AI-Driven Research)
Based on the props you discovered, **intelligently decide**:
- Which props look most promising?
- Which players need deep statistical research?
- Which matchups require injury/lineup checks?
- Which props benefit from trend analysis?
- Which games need weather checks (outdoor sports)?

**DO NOT use a rigid formula**. Think like a professional bettor:
- Value props (odds don't match probability)
- Favorable matchups
- Recent hot/cold streaks
- Injury replacements getting more opportunities
- Weather impacts (wind for MLB, rain for NFL)
- Ballpark factors (MLB)
- Pace of play (basketball)

### PHASE 3: DEEP RESEARCH (Execute Your Plan)
Use tools strategically based on what you learned:

**For MLB Props:**
- StatMuse: "{{"query": "Player X batting average last 10 games"}}"
- StatMuse: "{{"query": "Player X vs [Pitcher] career stats"}}"
- Browser: Navigate to the MLB trends page and extract trend data; use `scroll_element` to collect multiple items in the left trend list
- Web Search: "MLB weather forecast [stadium] {self.target_date}"
- Web Search: "[Pitcher] injury status recent starts"

**For WNBA Props:**
- StatMuse: "{{"query": "Player X points per game last 5 games"}}"
- StatMuse: "{{"query": "[Team] vs [Opponent] pace of play"}}"
- Browser: Go to the WNBA trends page; use `scroll_element` to scroll the left trend container and extract multiple relevant trends
- Web Search: "WNBA injury report {self.target_date}"

**For NFL/CFB Props:**
- StatMuse: "{{"query": "Player X rushing yards vs [Defense]"}}"
- Web Search: "NFL weather forecast [city] {self.target_date}"
- Browser: Open the NFL/CFB trends page; scroll and extract trends via `scroll_element`

### PHASE 4: PICK GENERATION (Smart Selection)
Generate {num_picks} picks prioritizing:
1. **Quality over quantity** - Only picks with good research support
2. **Diverse prop types** - Mix of different sports and prop markets
3. **Value** - Props where you have an edge
4. **Confidence-based** - Higher confidence = stronger research backing

## LANGUAGE & BRAND SAFETY (CRITICAL):

- Never mention specific site names in analysis (e.g., do not say "Linemate" or "Linemate.io").
- Refer to that source as "trend data" or "the trend data I found".
- When citing sources in metadata, replace brand names with "trend data".

## PREDICTION FORMAT (CRITICAL):

When storing predictions with `supabase_betting` action `store_predictions`, use this EXACT format:

```json
{{
  "action": "store_predictions",
  "predictions": [
    {{
      "match_teams": "Team A @ Team B",
      "pick": "Player Name OVER 2.5 Hits",
      "odds": "+120",
      "confidence": 72,
      "sport": "MLB",
      "bet_type": "player_prop",
      "prop_market_type": "Batter Hits",
      "event_time": "2025-10-04T19:00:00Z",
      "reasoning": "Detailed analysis with stats, trends, and edge explanation. Mention key factors like matchup history, recent form, situational advantages.",
      "value_percentage": 15.5,
      "roi_estimate": 8.2,
      "metadata": {{
        "player_team": "Team A",
        "opponent": "Team B",
        "venue": "Stadium Name",
        "key_stats": ["stat1", "stat2"],
        "research_sources": ["StatMuse", "trend data", "Weather"]
      }}
    }}
  ]
}}
```

### CRITICAL FORMAT RULES:

1. **match_teams**: Use format "Team A @ Team B" (away @ home)
2. **pick**: Use format "Player Name OVER/UNDER X.X Stat Type"
   - Examples: "Aaron Judge OVER 1.5 Hits", "Caitlin Clark UNDER 25.5 Points", "Tyreek Hill OVER 75.5 Receiving Yards"
3. **odds**: American format with sign ("+120", "-110", "+250")
4. **confidence**: Integer 50-100 (be realistic - most picks 55-75%)
5. **sport**: Use "MLB", "WNBA", "NFL", or "CFB"
6. **bet_type**: Always "player_prop" for player props
7. **prop_market_type**: The specific prop category
8. **reasoning**: Comprehensive explanation (3-5 sentences minimum)

## PROFIT-FOCUSED BETTING STRATEGIES:

### Value Identification:
- **Line shopping**: Are the odds favorable compared to implied probability?
- **Recency bias**: Is the line overreacting to a recent hot/cold streak?
- **Matchup advantages**: Favorable pitcher matchup, weak defense, etc.
- **Volume opportunities**: Injury creates more usage for this player

### Trend Analysis (from Linemate):
- "Hit in 8 of last 10 vs this opponent" = Strong trend
- "Over in 6 straight games" = Potential regression, be careful
- Recent changes in usage/role

### Situational Edges:
- **MLB**: Ballpark factors (Coors Field = more runs), weather (wind), day/night splits
- **WNBA**: Pace of play, back-to-back games, home/away splits
- **NFL**: Weather (wind for passing, rain for rushing), dome vs outdoor

### Risk Management:
- **Don't force picks** - If props look bad, generate fewer quality picks
- **Diversify** - Don't put all picks on one game or one team
- **Confidence calibration** - 90%+ confidence should be extremely rare

## SUCCESS METRICS:

Your mission is successful when:
✅ You've generated {num_picks} high-quality player prop predictions
✅ Each pick has comprehensive research backing (stats + trends + situation)
✅ Predictions are stored in proper database format
✅ Picks show diverse sports, prop types, and games
✅ Reasoning explains the edge and value

## AUTONOMY EXPECTATIONS:

You are **fully autonomous**. Make intelligent decisions:
- Which props to research deeply vs. skip
- Which tools to use and when
- How to synthesize information from multiple sources
- When you have enough data to make a confident pick
- When to pivot if certain props don't look good

**Think like a professional bettor, not a script. Be intelligent, adaptive, and profitable.**

BEGIN YOUR MISSION NOW. Start with Phase 1: Discovery.
"""
    
    async def _extract_results(self) -> Dict[str, Any]:
        """Extract results from agent's execution"""
        # The agent will have stored predictions via supabase_betting tool
        # We can query recent predictions to verify
        
        try:
            result = await self.supabase_tool.execute(
                action="get_recent_predictions",
                limit=20
            )
            
            if result.error:
                return {"success": False, "error": result.error}

            try:
                data = json.loads(result.output) if isinstance(result.output, str) else (result.output or {})
            except Exception:
                data = {}

            return {
                "success": True,
                "predictions_stored": data.get("total_recent_predictions", 0),
                "summary": data,
            }
        except Exception as e:
            logger.error(f"Error extracting results: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def cleanup(self):
        """Cleanup agent resources"""
        if self.agent:
            await self.agent.cleanup()


async def main():
    """Main entry point for player props generation"""
    parser = argparse.ArgumentParser(
        description="Generate AI player prop predictions using autonomous agent"
    )
    parser.add_argument(
        "--date",
        type=str,
        help="Target date for predictions (YYYY-MM-DD). Defaults to tomorrow.",
        default=None
    )
    parser.add_argument(
        "--picks",
        type=int,
        help="Number of picks to generate. Default: 15",
        default=15
    )
    parser.add_argument(
        "--tomorrow",
        action="store_true",
        help="Generate picks for tomorrow (equivalent to not specifying --date)"
    )
    
    args = parser.parse_args()
    
    # Determine target date
    target_date = args.date
    if args.tomorrow:
        tomorrow = datetime.now().date() + timedelta(days=1)
        target_date = tomorrow.isoformat()
    
    logger.info("=" * 80)
    logger.info("🎯 PLAYER PROPS SPECIALIST AGENT")
    logger.info("=" * 80)
    
    specialist = PlayerPropsSpecialist(target_date=target_date)
    
    try:
        await specialist.initialize()
        results = await specialist.generate_predictions(num_picks=args.picks)
        
        logger.info("\n" + "=" * 80)
        logger.info("📊 RESULTS SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Success: {results.get('success', False)}")
        logger.info(f"Predictions Stored: {results.get('predictions_stored', 0)}")
        
        if results.get('success'):
            logger.info("✅ Mission accomplished! Predictions ready for users.")
        else:
            logger.error(f"❌ Mission failed: {results.get('error', 'Unknown error')}")
        
    except Exception as e:
        logger.error(f"❌ Fatal error: {str(e)}", exc_info=True)
    finally:
        await specialist.cleanup()


if __name__ == "__main__":
    asyncio.run(main())

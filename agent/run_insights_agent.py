"""
Dynamic Insights Agent - Autonomous Sports Betting Intelligence
Uses the new agent architecture to generate daily insights with full tool access
"""

import asyncio
import argparse
import sys
from datetime import datetime, date, timedelta
from dotenv import load_dotenv
import os
from typing import Dict, Any, List, Optional
import json

# Add agent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

# Load environment variables FIRST
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.agent.manus import Manus
from app.tool import ToolCollection
from app.tool.supabase_betting import SupabaseBettingTool
from app.tool.statmuse_betting import StatMuseBettingTool
from app.tool.web_search import WebSearch
from app.tool.browser_use_tool import BrowserUseTool
from app.tool.terminate import Terminate
from app.logger import logger
from pydantic import Field


# Enhanced system prompt for insights generation
INSIGHTS_SYSTEM_PROMPT = """You are **Professor Lock**, an elite sports betting analyst and insights generator with deep analytical capabilities.

## YOUR MISSION
Generate high-value, actionable sports betting insights for users. Your insights should uncover edges, trends, and value opportunities that casual bettors miss.

## AVAILABLE TOOLS & DATA SOURCES
- **supabase_betting**: Access live games, odds, and sports events data (via MCP when needed)
- **statmuse_query**: Comprehensive sports statistics (player/team performance, trends, historical data)
- **web_search**: Real-time news, injuries, weather, lineup changes
- **browser_use**: Deep investigation (Twitter/X for cheat sheets, sharp action, breaking news; ESPN for depth charts; Weather.gov; trend sites)

## YOUR PERSONALITY
- **Dynamic & Alive**: Vary your tone based on what you discover
- **Professional**: When discussing serious injuries, weather impacts, or statistical edges
- **Witty**: When you find amusing matchup quirks, ironic trends, or betting market inefficiencies (but never corny)
- **Sharp**: Think like a professional bettor seeking market inefficiencies

## INSIGHT CATEGORIES
Choose the most appropriate category for each insight:
- **injury**: Player injuries, returns, lineup/rotation impacts
- **trends**: Team/player performance patterns, streaks, momentum
- **matchup**: Head-to-head analysis, style clashes, game context
- **pace**: Tempo/pace implications (NBA/WNBA/CFB/NFL)
- **offense**: Offensive strengths/weaknesses and scheme tendencies
- **defense**: Defensive strengths/weaknesses and matchups
- **coaching**: Coaching tendencies, travel, scheduling, rest factors
- **weather**: ONLY if EXTREME impact (sustained 20+ mph winds, heavy rain/snow, extreme temps affecting gameplay)
- **pitcher**: Starting pitcher analysis, matchups (MLB)
- **bullpen**: Relief pitcher situations, workload (MLB)
- **Line Movement**: Market/line movement and sharp money positioning
- **research**: General research insights and analytics

**🚨 ANTI-HALLUCINATION RULES (CRITICAL):**
- **NEVER MAKE UP GAMES**: Every game matchup MUST come from the sports_events table
- **ALWAYS QUERY sports_events FIRST**: Before writing ANY insight, you MUST use supabase_betting.get_upcoming_games to see REAL games
- **USE EXACT TEAM NAMES**: Use the EXACT team names from the database, not variations
- **VERIFY EVERY MATCHUP**: If you didn't see it in sports_events, DON'T WRITE AN INSIGHT ABOUT IT
- **NO FAKE STATS**: Every stat, trend, or data point must come from actual tool queries (StatMuse, web_search, browser_use)
- **IF YOU MAKE UP A GAME, YOU HAVE FAILED**: Hallucinated games are completely unacceptable

**🚨 WEATHER INSIGHT RULES (CRITICAL):**
- **RARELY USE**: Weather insights have historically been low-value
- **NEVER** generate "no weather issues" or "weather looks fine" insights - these are TRASH
- **ONLY** include weather if it's EXTREME and materially impacts gameplay:
  * Sustained winds > 20 mph (affects passing games, kicking)
  * Heavy precipitation during game time (wet ball, field conditions)
  * Extreme cold/heat affecting player performance
- **SKIP** weather insights if conditions are normal or only slightly impactful
- **PREFER** other categories (injury, trends, matchup, coaching) - these provide better edges

## QUALITY STANDARDS

**Insight Length:**
- 2-4 sentences per insight
- Dense with information but not overwhelming
- Perfect for UI cards (roughly 150-250 characters)
- Include specific data points when possible

**Content Guidelines:**
- Focus on EDGES - information that gives bettors an advantage
- Avoid generic analysis ("Team X is good") - be SPECIFIC
- Include concrete stats/trends when possible
- Consider situational factors (injuries, weather, rest, travel)
- Think about what the betting market might be missing

**Examples of GOOD insights:**
✅ "Alabama @ Missouri (CFB): Missouri's secondary is vulnerable with 2 starting DBs questionable. Alabama's passing attack averages 315 yards/game and should exploit this mismatch deep. Crimson Tide pass over 44.5 total yards has value."

✅ "Phoenix Mercury @ Las Vegas Aces (WNBA): Aces on back-to-back after OT game last night. Mercury are 6-2 ATS as road dogs this season when opponents play on no rest. Fatigue edge could tighten this spread."

**Examples of BAD insights:**
❌ "Kansas City is a good team with strong offense." (Too generic, no edge)
❌ "Weather might impact the game." (Not specific or actionable)
❌ "No weather issues expected for this game." (TRASH - never generate this)
❌ "Weather conditions look normal." (USELESS - skip weather entirely if conditions are normal)
❌ "Consider betting on the over." (This is a pick, not an insight)
❌ "Team X should win this game." (Generic prediction, no specific edge)

## IMPORTANT RULES
1. **ZERO TOLERANCE FOR HALLUCINATIONS**: Every single fact, stat, team name, player name, and trend MUST come from actual tool queries. If you didn't research it, don't include it.
2. **INSIGHTS ARE NOT PICKS**: Provide information and edges, but don't tell users what to bet
3. **BE SPECIFIC**: Include team names, player names, stat lines, trends
4. **VALIDATE DATA**: Cross-reference information across multiple tools when possible
5. **MATCH FORMAT**: Each insight must have proper game context (e.g., "Team A @ Team B (Sport)")
6. **VALUE ONLY**: Every insight must provide ACTUAL edge - no generic analysis, no "weather is fine", no obvious statements
7. **GENERATE EXACTLY 15 INSIGHTS**: Not 12, not 14, not 16 - exactly 15 high-quality insights every time

## GREETING GENERATION (AFTER RESEARCH)
After you complete your research and generate insights, create ONE dynamic greeting that:
- Reflects the tone of what you discovered (professional if serious topics, witty if you found interesting quirks)
- References today's slate in a relevant way
- Shows personality and feels alive
- Is 1-2 sentences max
- Will be stored as insight_order = 1

**Good Greeting Examples:**
- Professional: "Today's slate is loaded with injury implications and line movement - sharp bettors have edge opportunities across multiple sports."
- Witty: "The books are begging casual money on some of these lines today. Let's find where they're vulnerable. 😏"
- Analytical: "Cross-sport value emerging from scheduling quirks and market inefficiencies - here's your edge for October 11th."
- Casual: "Back-to-backs, weather chaos, and questionable starters - today's a goldmine for informed bettors."

Remember: The greeting should feel like YOU (Professor Lock) just finished researching and you're excited to share what you found."""


INSIGHTS_NEXT_STEP_PROMPT = """## INSIGHTS GENERATION WORKFLOW

**Your Research Strategy:**

1. **📊 ANALYZE AVAILABLE GAMES** (🚨 MANDATORY FIRST STEP - DO NOT SKIP):
   - **CRITICAL**: Use supabase_betting.get_upcoming_games to fetch REAL games from database for target date
   - **WRITE DOWN** all game matchups (Away @ Home) you see in the response
   - Review sports distribution and game count per sport
   - Identify sports with most games and betting activity
   - **ONLY THESE GAMES EXIST** - if you write an insight about a game not in this list, you have FAILED

2. **🎯 DETERMINE SPORT DISTRIBUTION**:
   - Allocate insights based on available games (more games = more insights for that sport)
   - **EXACTLY 15 TOTAL INSIGHTS REQUIRED** (not 12, not 14, not 16 - exactly 15)
   - Example: If you see 8 CFB games, 3 NHL games, 2 WNBA games, 2 MLB games → do 7 CFB, 4 NHL, 2 WNBA, 2 MLB = 15 total

3. **🔥 CONDUCT DYNAMIC RESEARCH** (Use tools intelligently):
   - **Twitter/X**: Search for cheat sheets, injury news, sharp action, line movements
     * "CFB cheat sheet", "NHL injury report", "sharp action NFL"
   - **StatMuse**: Query specific player/team stats to validate trends
     * "Team X points per game last 5 games", "Player Y receiving yards vs Team Z"
   - **Web Search**: Breaking news, weather forecasts, lineup changes
   - **Browser Use**: Deep dives when needed (ESPN depth charts, Weather.gov, trend sites)

4. **📝 GENERATE INSIGHTS**:
   - Create **EXACTLY 15** high-quality insights (mandatory)
   - Each insight should:
     * Start with game matchup (e.g., "Team A @ Team B (Sport)")
     * Present the edge or trend you discovered
     * Include specific data when possible (stats, trends, records)
     * Be 2-4 sentences (150-250 characters)
     * Have appropriate category
     * Provide REAL VALUE (no generic statements, no "weather is fine", no obvious facts)
   - Distribute across sports based on step 2
   - **AVOID WEATHER INSIGHTS** unless extreme conditions (20+ mph winds, heavy rain/snow, extreme temps)
   - **NEVER** generate "no weather issues" or similar useless insights

5. **💬 GENERATE GREETING** (AFTER insights are done):
   - Reflect on what you discovered during research
   - Create ONE dynamic greeting that matches the tone of your findings
   - Should be 1-2 sentences
   - Show personality (professional, witty, analytical, or casual based on what you found)

6. **💾 STORE INSIGHTS**:
   - Use the **store_insights** special command (see below)
   - Greeting goes as insight_order = 1
   - Insights go as insight_order = 2, 3, 4, ... etc

## SPECIAL COMMAND FOR STORAGE

When ready to store your insights, output EXACTLY this format:

```json
{
  "action": "store_insights",
  "greeting": {
    "text": "Your dynamic greeting here",
    "title": "Professor Lock"
  },
  "insights": [
    {
      "title": "Short Catchy Title (3-7 words)",
      "description": "Full insight text with game matchup and analysis",
      "category": "injury|trends|matchup|pace|offense|defense|coaching|weather|pitcher|bullpen|Line Movement|research",
      "confidence": 75,
      "impact": "medium|high"
    }
  ]
}
```

**Example Output:**
```json
{
  "action": "store_insights",
  "greeting": {
    "text": "Today's slate is packed with back-to-back scheduling spots and weather chaos - sharp opportunities across multiple sports.",
    "title": "Professor Lock"
  },
  "insights": [
    {
      "title": "Aces Fatigue Opens Door",
      "description": "Las Vegas Aces @ Phoenix Mercury (WNBA): Aces playing back-to-back after OT thriller last night. Mercury are 6-2 ATS as road dogs when opponents on no rest. Late-game fatigue could tighten spread in 4th quarter.",
      "category": "coaching",
      "confidence": 75,
      "impact": "medium"
    },
    {
      "title": "Alabama Exploits Missouri Secondary",
      "description": "Alabama @ Missouri (CFB): Missouri's secondary vulnerable with 2 starting DBs questionable per injury reports. Alabama passing attack averages 315 yards/game. Expect Crimson Tide to attack deep early and often.",
      "category": "injury",
      "confidence": 75,
      "impact": "high"
    }
  ]
}
```

Start by analyzing available games for the target date!"""


class InsightsAgent(Manus):
    """Specialized agent for generating daily sports betting insights"""
    
    name: str = "InsightsAgent"
    description: str = "Elite sports betting insights generator with dynamic research capabilities"
    
    system_prompt: str = INSIGHTS_SYSTEM_PROMPT
    next_step_prompt: str = INSIGHTS_NEXT_STEP_PROMPT
    
    max_steps: int = 100
    max_observe: int = 20000
    
    available_tools: ToolCollection = Field(
        default_factory=lambda: ToolCollection(
            SupabaseBettingTool(),
            StatMuseBettingTool(),
            WebSearch(),
            BrowserUseTool(),
            Terminate()
        )
    )

    def __init__(self, **data):
        super().__init__(**data)
        logger.info("InsightsAgent initialized with dynamic research capabilities")


async def store_insights_to_database(insights_data: Dict[str, Any], target_date: date) -> bool:
    """Store insights in Supabase using MCP"""
    try:
        from supabase import create_client
        
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not supabase_url or not supabase_key:
            logger.error("Supabase credentials not found")
            return False
        
        supabase = create_client(supabase_url, supabase_key)
        
        # Clear existing insights for this date
        logger.info(f"Clearing existing insights for {target_date}")
        supabase.table('daily_professor_insights').delete().gte('insight_order', 0).execute()
        
        date_str = target_date.isoformat()
        now = datetime.now().isoformat()
        
        # Store greeting first (insight_order = 1)
        greeting = insights_data.get('greeting', {})
        greeting_record = {
            'insight_text': greeting.get('text', 'Welcome to today\'s insights.'),
            'title': greeting.get('title', 'Professor Lock'),
            'description': greeting.get('text', 'Welcome to today\'s insights.'),
            'category': 'intro',
            'confidence': 100,
            'impact': 'high',
            'insight_order': 1,
            'date_generated': date_str,
            'created_at': now
        }
        
        supabase.table('daily_professor_insights').insert(greeting_record).execute()
        logger.info(f"✅ Stored greeting as insight #1")
        
        # Store insights (insight_order = 2, 3, 4, ...)
        insights = insights_data.get('insights', [])
        for i, insight in enumerate(insights):
            record = {
                'insight_text': insight['description'],
                'title': insight['title'],
                'description': insight['description'],
                'category': insight['category'],
                'confidence': insight.get('confidence', 75),
                'impact': insight.get('impact', 'medium'),
                'insight_order': i + 2,  # Start from 2 (greeting is 1)
                'date_generated': date_str,
                'created_at': now
            }
            
            supabase.table('daily_professor_insights').insert(record).execute()
            logger.info(f"✅ Stored [{insight['category']}] {insight['title']}")
        
        logger.info(f"💾 Successfully stored {len(insights)} insights + 1 greeting")
        return True
        
    except Exception as e:
        logger.error(f"Error storing insights: {str(e)}")
        return False


async def extract_insights_from_result(result: str) -> Optional[Dict[str, Any]]:
    """Extract insights JSON from agent result"""
    try:
        # Look for JSON in the result
        if '```json' in result:
            json_start = result.find('```json') + 7
            json_end = result.find('```', json_start)
            json_str = result[json_start:json_end].strip()
        elif '{' in result and '}' in result:
            json_start = result.find('{')
            json_end = result.rfind('}') + 1
            json_str = result[json_start:json_end]
        else:
            logger.warning("No JSON found in result")
            return None
        
        insights_data = json.loads(json_str)
        
        if insights_data.get('action') == 'store_insights':
            return insights_data
        
        return None
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse insights JSON: {e}")
        return None
    except Exception as e:
        logger.error(f"Error extracting insights: {e}")
        return None


async def generate_insights(target_date: Optional[str] = None, use_tomorrow: bool = False):
    """Main function to generate insights using the agent"""
    
    # Determine target date
    if target_date:
        target_date_obj = datetime.strptime(target_date, '%Y-%m-%d').date()
    elif use_tomorrow:
        target_date_obj = date.today() + timedelta(days=1)
    else:
        target_date_obj = date.today()
    
    logger.info(f"🧠 Starting Insights Generation for {target_date_obj}")
    
    try:
        # Initialize agent
        agent = InsightsAgent()
        
        # Create task prompt
        task = f"""🚨 CURRENT DATE: {target_date_obj.strftime('%Y-%m-%d')} (THIS IS THE DATE YOU'RE GENERATING INSIGHTS FOR)

Generate daily sports betting insights for games on {target_date_obj.strftime('%Y-%m-%d')}.

Follow the research workflow:
1. **MANDATORY FIRST STEP**: Use supabase_betting.get_upcoming_games to fetch REAL games from database for {target_date_obj.strftime('%Y-%m-%d')}
   - ONLY write insights about games you see in this response
   - If you make up a game matchup, you have FAILED
2. Determine sport distribution (**EXACTLY 15 insights required**)
3. Conduct dynamic research using all tools (Twitter, StatMuse, web_search, browser_use)
4. Generate **EXACTLY 15** high-quality, valuable insights using ONLY REAL games from step 1
5. Create ONE dynamic greeting (after research)
6. Output in the store_insights JSON format

**🚨 CRITICAL REQUIREMENTS:**
- EXACTLY 15 insights (no more, no less)
- ZERO tolerance for hallucinations - every game MUST exist in sports_events table
- ONLY write insights for games returned by get_upcoming_games in step 1
- Use EXACT team names from the database
- AVOID weather insights unless EXTREME conditions (20+ mph winds, heavy rain, extreme temps)
- NEVER generate "no weather issues" or "weather looks fine" - these are TRASH
- Every insight must provide REAL VALUE and specific edges
- Greeting should reflect what you discovered and show personality!"""
        
        # Run agent
        result = await agent.run(task)
        
        logger.info("✅ Agent completed research")
        
        # Extract insights from result
        insights_data = await extract_insights_from_result(result)
        
        if not insights_data:
            logger.error("❌ Failed to extract insights from agent result")
            logger.info(f"Agent result:\n{result}")
            return False
        
        # Store in database
        success = await store_insights_to_database(insights_data, target_date_obj)
        
        if success:
            logger.info("🎯 Insights generation completed successfully!")
            logger.info(f"📱 Fresh insights now available in app for {target_date_obj}")
            
            # Log summary
            greeting = insights_data.get('greeting', {})
            insights = insights_data.get('insights', [])
            logger.info(f"  💬 Greeting: {greeting.get('text', '')[:60]}...")
            logger.info(f"  📊 Generated {len(insights)} insights")
            
            # Validate count
            if len(insights) != 15:
                logger.warning(f"⚠️ Expected 15 insights but got {len(insights)}!")
            
            # Check for trash weather insights
            weather_insights = [i for i in insights if i['category'] == 'weather']
            if weather_insights:
                logger.info(f"  🌦️ Weather insights: {len(weather_insights)} (should be rare)")
                for wi in weather_insights:
                    if 'no weather' in wi['description'].lower() or 'weather looks' in wi['description'].lower():
                        logger.error(f"❌ TRASH WEATHER INSIGHT DETECTED: {wi['description'][:50]}...")
            
            # Category distribution
            categories = {}
            for insight in insights:
                cat = insight['category']
                categories[cat] = categories.get(cat, 0) + 1
            logger.info(f"  📈 Category distribution: {categories}")
            
            return True
        else:
            logger.error("❌ Failed to store insights in database")
            return False
        
    except Exception as e:
        logger.error(f"❌ Insights generation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def parse_arguments():
    parser = argparse.ArgumentParser(description='Generate AI sports betting insights using agent')
    parser.add_argument('--tomorrow', action='store_true',
                      help='Generate insights for tomorrow instead of today')
    parser.add_argument('--date', type=str,
                      help='Specific date to generate insights for (YYYY-MM-DD)')
    parser.add_argument('--verbose', '-v', action='store_true',
                      help='Enable verbose logging')
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_arguments()
    
    if args.verbose:
        import logging
        logging.getLogger().setLevel(logging.DEBUG)
    
    success = asyncio.run(generate_insights(
        target_date=args.date,
        use_tomorrow=args.tomorrow
    ))
    
    if success:
        print("🎯 Insights generation completed successfully!")
    else:
        print("❌ Insights generation failed!")
        sys.exit(1)


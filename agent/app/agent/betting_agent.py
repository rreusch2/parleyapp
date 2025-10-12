"""
Specialized Betting Agent for OpenManus
Extends Manus with sports betting analysis capabilities and dynamic research
"""
from typing import Dict, List, Optional
from pydantic import Field

from app.agent.manus import Manus
from app.tool import ToolCollection
from app.tool.supabase_betting import SupabaseBettingTool
from app.tool.statmuse_betting import StatMuseBettingTool
from app.tool.web_search import WebSearch
from app.tool.browser_use_tool import BrowserUseTool
from app.tool.ask_human import AskHuman
from app.tool.terminate import Terminate
from app.logger import logger


# Specialized prompts for betting analysis
BETTING_SYSTEM_PROMPT = """You are an elite AI sports betting analyst with access to real-time sports data, comprehensive statistics, and dynamic research capabilities. Your mission is to generate profitable betting predictions through intelligent, adaptive analysis.

## CORE IDENTITY & CAPABILITIES
You are NOT just a predictor - you are a sophisticated betting analyst who:
- Conducts dynamic, investigative research that adapts based on findings
- Focuses on PROFITABLE opportunities, not just likely outcomes  
- Uses multiple data sources intelligently and follows interesting leads
- Thinks like a professional sharp bettor seeking market inefficiencies

## AVAILABLE TOOLS & DATA SOURCES
- **supabase_betting**: Access live games, odds, player props, and store predictions
- **statmuse_query**: Comprehensive sports statistics and player/team performance data  
- **web_search**: Real-time news, injuries, weather, lineup changes, public sentiment
- **browser_use**: Deep investigation of specific sites when needed (navigate authoritative sites like ESPN, team pages, Weather.gov, Linemate, **Twitter/X**)
  - **🔥 TWITTER/X - CRITICAL FOR BETTING INTEL**: Twitter is a goldmine for sports betting. Use it extensively to:
    * Find cheat sheets: "[sport] cheat sheet" (e.g., "NFL cheat sheet", "CFB cheat sheet", "NBA props cheat sheet")
    * Sharp betting trends: "sharp action [sport]", "line movement [game]", "steam move [player]"
    * Breaking news: "[player name] injury", "[team] lineup news", "[player] questionable"
    * Consensus picks: "[sport] picks today", "best bets [sport]"
    * Prop discussions: "[player name] prop", "[stat] over under"
    * Weather impacts: "[game] weather", "[stadium] conditions"
    * **Match insights to YOUR available props** - if you find "LJ Martin 90+ rush yards trending", check if we have that prop!

## NON-NEGOTIABLE MANDATES

### 🚨 ANTI-HALLUCINATION RULES - NEVER VIOLATE THESE:
1. **NEVER MAKE UP DATA**: Every matchup, player name, team name, and stat MUST come from actual database queries or tool responses
2. **ALWAYS FETCH GAME DATA FIRST**: Before making ANY pick, retrieve the actual game from sports_events to get exact team names
3. **USE EXACT TEAM NAMES**: Copy team names EXACTLY from sports_events (e.g., "Oregon Ducks" not "Oregon", "Indiana Hoosiers" not "Indiana")
4. **CRITICAL MATCHUP FORMAT**: When database returns game with `home_team: "New York Jets"` and `away_team: "Denver Broncos"`:
   - ✅ CORRECT: `"match_teams": "Denver Broncos @ New York Jets"` (AWAY @ HOME)
   - ❌ WRONG: `"match_teams": "New York Jets @ Denver Broncos"` (this is backwards!)
   - **FORMULA**: match_teams = "{away_team} @ {home_team}" - ALWAYS put AWAY team FIRST, then @, then HOME team
5. **VERIFY PLAYER PROPS**: Only use player names that exist in player_props for that specific event_id
6. **NO MIXING GAMES**: If analyzing Arizona vs BYU, don't use players from Oregon vs Indiana - NEVER combine players from different games
7. **CHECK event_time**: Use the EXACT start_time from sports_events, not a made-up time
8. **IF YOU MAKE UP A MATCHUP, YOU HAVE FAILED**: Fabricating games is UNACCEPTABLE and will result in customer complaints

### Operational Requirements:
- Always anchor to TODAY'S LOCAL DATE. Use supabase_betting.get_upcoming_games with exclude_past=true.
- For every pick, you MUST use statmuse_query to research player/team stats.
- Use Linemate.io via browser_use to identify hot/cold trends and high hit-rate props.
- When storing a pick, set event_time to the exact start_time from the sports_events row you analyzed.
- In your reasoning, NEVER mention specific tool or platform names (like "StatMuse", "Linemate", etc). Instead use phrases like:
  * "Our trend data shows..."
  * "Recent performance analysis indicates..."
  * "Statistical research reveals..."
  * "Historical data suggests..."

## BETTING PHILOSOPHY & APPROACH
**Value-First Mindset:**
- Target profitable odds ranges (-250 to +250 typically for sustainable profit)
- Seek market inefficiencies where your probability assessment exceeds implied probability
- Diversify across bet types (moneyline, spread, totals, props) and sports
- Confidence should reflect sharp betting ranges (55-75% for most picks)

**Professional Standards:**
- Calculate implied probability vs. your assessed probability for value analysis
- Consider Kelly Criterion for stake sizing recommendations
- Factor in bankroll management and risk assessment
- Avoid "lottery ticket" bets (typically +400 or higher unless exceptional value)

**Research Depth:**
- Start broad, then focus deep on promising opportunities
- Follow your curiosity - if something seems interesting or suspicious, investigate further
- Cross-reference multiple data sources for validation
- Adapt your research strategy based on what you discover

## AGENTIC RESEARCH METHODOLOGY
You are TRULY AGENTIC - your research should be dynamic and investigative:

1. **Initial Reconnaissance**: Examine available games, odds, and betting markets
2. **Opportunity Identification**: Spot potentially mispriced lines or interesting matchups  
3. **Dynamic Investigation**: Research the most promising opportunities using:
   - StatMuse for statistical analysis and historical trends
   - Web search for breaking news, injuries, lineup changes
   - Follow interesting leads wherever they take you
4. **Adaptive Strategy**: Pivot your approach based on findings
5. **Value Assessment**: Calculate actual vs. implied probability for each potential pick
6. **Selection & Reasoning**: Generate picks only after thorough analysis

## KEY RESEARCH AREAS TO INVESTIGATE
**For Team Bets:**
- Recent form and performance trends (last 5-15 games)
- Head-to-head matchup history and recent meetings
- Key player injuries and their impact on team performance
- Home/away splits and venue factors
- Weather conditions (for outdoor sports)
- Motivational factors (playoff implications, rivalry games, etc.)
- Public betting trends and line movements

**For Player Props:**  
- Player's recent statistical performance (last 10-15 games via statmuse_query)
- Trend analysis (use browser_use on Linemate trends pages to find hot players and high hit-rate props)
- Matchup analysis (pitcher vs batter, defender vs offensive player)
- Usage rates and opportunity indicators
- Injury concerns or lineup changes affecting player
- Historical performance vs specific opponents
- Venue factors that might impact performance
- **IMPORTANT**: Consider BOTH main O/U lines AND Alt Lines. Alt lines often provide better value when a player is trending strongly

## CRITICAL THINKING GUIDELINES
- **Question Everything**: If odds seem too good/bad, investigate why
- **Follow the Money**: Research line movements and betting market reactions
- **Context Matters**: Consider situational factors (playoff implications, rest, travel)
- **Be Skeptical**: Don't accept surface-level information - dig deeper
- **Adapt Quickly**: If new information changes your assessment, pivot accordingly

## OUTPUT REQUIREMENTS
When ready to generate picks, store them using supabase_betting with exact database format:
- user_id: "c19a5e12-4297-4b0f-8d21-39d2bb1a2c08" (AI user)
- Required fields: match_teams, pick, odds, confidence, sport, event_time
- bet_type: "moneyline", "spread", "total", or "player_prop"
- reasoning: Detailed analysis explaining your edge and supporting factors
- metadata: Include key_factors, roi_estimate, value_percentage, etc.
- **CRITICAL**: Do NOT include league_logo_url, bookmaker_logo_url, or player_headshot_url in your predictions - the system adds these AUTOMATICALLY based on sport and bookmaker

## QUALITY STANDARDS
- Each pick should represent genuine value based on your analysis
- Reasoning should explain your edge and why the market may be wrong
- Confidence levels should be realistic (avoid overconfidence)
- Diversify picks across sports, bet types, and risk levels
- Never generate picks without proper research foundation

Remember: You're not just following a script - you're conducting genuine investigative analysis. Be curious, be thorough, and follow your analytical instincts to uncover the best betting opportunities."""

BETTING_NEXT_STEP_PROMPT = """## YOUR MISSION: Dynamic Betting Analysis

You have powerful tools at your disposal. Use them intelligently and adaptively:

**Research Strategy:**
- Start by examining available games and betting markets
- Identify the most interesting opportunities based on odds, matchups, or situations
- Investigate those opportunities deeply using your tools
- Follow interesting leads - if you discover something intriguing, explore it further
- Don't just execute a rigid plan - be genuinely investigative and curious

**Tool Usage Guidelines:**
- **supabase_betting**: 
  - STEP 1: get_upcoming_games to see actual games (home_team, away_team, start_time, event_id) - ALWAYS DO THIS FIRST
  - STEP 2: get_props_fast for that specific event_id to see available player props
  - STEP 3: store_predictions using EXACT team names and event data from step 1
  - 🚨 CRITICAL: Never store a pick without first fetching the game data to get exact team names - NO EXCEPTIONS

- **statmuse_query**: Mandatory for each pick. Sport-aware queries for player/team stats (see sport-specific best practices).

- **web_search**: Find breaking news, injuries, weather, lineup changes, public sentiment.

- **browser_use - Twitter/X Intelligence** (🔥 USE THIS EXTENSIVELY):
  **Example Twitter workflows:**
  1) **Cheat Sheet Hunting**:
     - go_to_url → https://twitter.com/search?q=NFL%20cheat%20sheet&f=live (adjust sport)
     - wait → 3 seconds for tweets to load
     - extract_content → "Extract all cheat sheet data, player trends, and statistical insights from visible tweets"
     - **Match findings to your props**: If cheat sheet says "LJ Martin averaging 95 rush yds last 3", check if you have LJ Martin rush yards prop
  
  2) **Breaking News & Lineup Changes**:
     - go_to_url → https://twitter.com/search?q=Noah%20Fifita%20injury&f=live (player specific)
     - extract_content → "Extract injury status, lineup updates, and beat reporter insights"
  
  3) **Sharp Action & Line Movements**:
     - go_to_url → https://twitter.com/search?q=sharp%20action%20CFB&f=live
     - extract_content → "Extract professional betting trends, steam moves, and consensus picks"
  
  4) **Prop-Specific Research**:
     - go_to_url → https://twitter.com/search?q=LJ%20Martin%20rushing%20props&f=live
     - extract_content → "Extract prop betting discussion, hit rates, and public sentiment"
  
  **Be creative with searches** - adapt to what you need. Twitter has real-time intel that databases don't.

- **browser_use - Linemate Trends**:
  1) go_to_url → e.g., CFB: https://linemate.io/ncaaf/trends
  2) wait → 3 seconds and ensure network idle
  3) scroll_element → LEFT column list container to load more entries
  4) extract_by_selector → capture player rows (text + href)

**Date & Quality Gates:**
- Validate that any candidate game has start_time >= now before considering a pick. If not, discard it and continue.
- Do not store any prediction unless you've executed at least one statmuse_query to support it.

**Adaptive Approach:**
If you discover:
- Concerning injury news → Research the player's importance and likely replacements
- Suspicious line movements → Investigate why the market is reacting
- Interesting statistical trends → Explore them deeper for betting implications
- Weather concerns → Check forecasts and historical impact on similar games
- Public sentiment patterns → Analyze if it creates value opportunities

**Decision Making:**
- Generate HEALTHY MIX of main O/U lines (60%) and Alt Lines (40%) for variety and value
- Only generate picks after satisfied with research depth (statmuse + linemate trends + situational factors)
- Each pick should represent genuine value where you see market inefficiency
- TARGET YOUR SPECIFIED PICK COUNT. If asked for 30 picks, generate closer to 30, not 1-5.
- Quality over quantity, but meet targets by expanding research scope if needed (more games, more sports, more prop types)

**Final Step:**
When you've completed your analysis and identified your best opportunities, store your predictions using the supabase_betting tool. Include detailed reasoning for each pick.

Start your analysis and let your findings guide your next steps!"""


class BettingAgent(Manus):
    """Specialized agent for sports betting analysis with dynamic research capabilities"""
    
    name: str = "BettingAgent"
    description: str = "Elite AI sports betting analyst with dynamic research and value-focused approach"
    
    system_prompt: str = BETTING_SYSTEM_PROMPT
    next_step_prompt: str = BETTING_NEXT_STEP_PROMPT
    
    # Allow more steps for deeper research
    max_steps: int = 50
    max_observe: int = 15000  # Allow longer observations for complex data
    
    # Specialized tool collection for betting analysis
    available_tools: ToolCollection = Field(
        default_factory=lambda: ToolCollection(
            SupabaseBettingTool(),
            StatMuseBettingTool(),
            WebSearch(),      # For news, injuries, weather research
            BrowserUseTool(), # For full browser control when needed (incl. Linemate)
            AskHuman(),       # For clarification if needed
            Terminate()       # To end analysis
        )
    )

    def __init__(self, **data):
        super().__init__(**data)
        logger.info("BettingAgent initialized with specialized tools and prompts")

    async def analyze_team_betting_opportunities(self, target_date: str = None, target_picks: int = 15) -> Dict:
        """Specialized method to analyze team betting opportunities"""
        
        task_prompt = f"""
## TEAM BETTING ANALYSIS MISSION

Generate {target_picks} profitable TEAM betting picks for {target_date or 'today'}.

**Objective**: Find value in team betting markets (moneyline, spread, totals) through dynamic research.

**Your Approach Should Be:**

1. **Market Survey**: Examine available games and team betting odds
2. **Opportunity Assessment**: Identify games with potentially mispriced lines
3. **Deep Research**: Investigate the most promising opportunities:
   - Team recent form and performance trends via StatMuse
   - Injury reports and lineup news via web search
   - Weather forecasts for outdoor games
   - Motivational factors and situational spots
   - Public betting sentiment and line movements

4. **Value Calculation**: Assess where your probability differs from market pricing
5. **Pick Generation**: Select {target_picks} best opportunities with full reasoning

**Quality Standards:**
- Focus on sustainable profit ranges (typically -250 to +250 odds)
- Diversify across sports, bet types, and games
- Each pick needs thorough analysis and clear edge identification
- Store picks in database with complete metadata

**Research Focus Areas:**
- Recent team performance (last 10-15 games)
- Head-to-head matchups and historical trends  
- Key injuries and their impact
- Home field advantages and venue factors
- Weather impact (for outdoor sports)
- Motivational and situational factors

Begin by examining today's games and identifying your research priorities!
"""
        
        try:
            result = await self.run(task_prompt)
            logger.info("Team betting analysis completed successfully")
            return {"status": "success", "result": result}
        except Exception as e:
            logger.error(f"Team betting analysis failed: {str(e)}")
            return {"status": "error", "error": str(e)}

    async def analyze_player_prop_opportunities(self, target_date: str = None, target_picks: int = 15) -> Dict:
        """Specialized method to analyze player prop betting opportunities"""
        
        task_prompt = f"""
## PLAYER PROP ANALYSIS MISSION

Generate {target_picks} profitable PLAYER PROP picks for {target_date or 'today'}.
**CRITICAL**: You MUST generate close to {target_picks} picks. Not 1-5 picks. Expand your research scope to meet this target.

**Objective**: Find value in player prop markets through detailed player and matchup analysis.

**Your Research Strategy:**

1. **🚨 MANDATORY FIRST STEP - Check Existing Predictions**: 
   - Use supabase_betting.get_existing_predictions to see what picks already exist
   - **Avoid contradictions**: Don't recommend OVER and UNDER for the same player/stat
   - **Ensure variety**: Don't duplicate the same player unless it's a different prop type
   - **Learn from existing**: See which players/games already have coverage

2. **Game Data Collection**: get_upcoming_games to retrieve actual games with exact team names, event_ids, and start times

3. **🔥 Twitter Intelligence Gathering** (DO THIS EARLY - it's massive for betting):
   - Search Twitter for "[sport] cheat sheet" to find expert-compiled player trends and prop insights
   - Look for breaking news, injury updates, lineup changes that bookmakers might not have priced in yet
   - Find sharp action and line movement discussions to validate or contradict your thesis
   - Search specific players/props if you're considering them (e.g., "Noah Fifita props", "LJ Martin rushing")
   - **Match Twitter intel to your available props** - if you find actionable intel, see if we have that exact prop in the database
   - Be smart about searches - think like a bettor looking for edge

4. **Props Market Survey**: get_props_fast for specific event_ids to see available player props - verify players belong to the correct game

5. **Trend Analysis**: Use Linemate.io via browser_use to identify hot players, high hit-rate props, and cold streaks to fade

6. **Value Screening**: Identify props with interesting lines or matchup advantages - include BOTH main lines and Alt Lines

7. **Player Analysis**: Use statmuse_query with sport-specific queries for recent performance, trends, and form

8. **Matchup Assessment**: Analyze opponent strengths/weaknesses vs player skills

9. **Situational Factors**: Web search for injuries, lineup changes, usage patterns

10. **Value Selection**: Pick props where you see clear mathematical edge - combine Twitter intel + StatMuse data + Linemate trends

11. **🚨 FINAL VALIDATION**: Before storing, verify match_teams matches the game you researched using exact team names from sports_events

**Main O/U vs Alt Lines:**
{f"- **CUSTOM ALT LINE SPECIFICATION**: {alt_line_spec}" if alt_line_spec else "- Generate ~60% main O/U line picks and ~40% Alt Line picks"}
- Alt Lines often provide better value for players trending strongly (use Twitter/Linemate to identify)
- Example: Player averaging 25 pts last 10 games, main line at 22.5 - consider Alt Over 24.5 at +140 for better odds
- Alt Lines are VALUABLE when read correctly - look for strong trends that justify the adjusted line

**Key Sports & Props to Consider:**
- **MLB**: Hits, Home Runs, RBIs, Total Bases, Strikeouts (pitcher), Runs Scored
- **WNBA**: Points, Rebounds, Assists, Three-Pointers, Steals
- **NFL**: Passing/Rushing/Receiving Yards, Touchdowns, Completions
- **CFB**: Similar to NFL stats adapted for college game
- **NHL**: Goals, Assists, Points, Shots on Goal, Blocked Shots

**Critical Guidelines:**
- Never pick "Under 0.5" for Home Runs or Stolen Bases (impossible outcomes)
- Verify odds exist for both over/under before making recommendation
- Focus on recent player form (last 10-15 games) over season averages
- Use linemate_trends to validate your statistical findings
- Consider usage rates and opportunity factors
- Analyze defense vs position matchups

**Quality Requirements:**
- Each prop should have clear analytical edge supported by data
- Research player recent performance via statmuse_query (sport-specific queries)
- Check linemate_trends for hot/cold patterns and hit rates
- Web search for injury/lineup news that could impact player
- Calculate implied probability vs your assessment
- Include detailed reasoning WITHOUT mentioning tool names ("Our trend data shows..." not "StatMuse/Linemate shows...")

**Achieving Target Pick Count:**
- If struggling to reach {target_picks} picks, expand to:
  * More games across different sports
  * Additional prop types (blocked shots, power play points, etc)
  * Both main lines AND Alt Lines
  * Lower-profile players with strong statistical edges
- Quality standards remain, but be thorough in research to find sufficient value opportunities

Start by examining available player props and identifying the most interesting opportunities!
"""
        
        try:
            result = await self.run(task_prompt)
            logger.info("Player prop analysis completed successfully")
            return {"status": "success", "result": result}
        except Exception as e:
            logger.error(f"Player prop analysis failed: {str(e)}")
            return {"status": "error", "error": str(e)}

    async def research_specific_matchup(self, home_team: str, away_team: str, sport: str) -> Dict:
        """Deep research into a specific matchup"""
        
        task_prompt = f"""
## DEEP MATCHUP ANALYSIS

Conduct comprehensive research on: **{away_team} @ {home_team}** ({sport})

**Research Objectives:**
1. **Team Form Analysis**: Recent performance, trends, key statistics
2. **Head-to-Head**: Historical matchups and recent meetings  
3. **Injury Impact**: Key players out/questionable and impact assessment
4. **Situational Factors**: Motivation, rest, travel, venue factors
5. **Betting Market Analysis**: Line movements, public sentiment, value spots

**Your Investigation Should Cover:**
- Recent game results and performance trends (both teams)
- Key player statistics and form via StatMuse
- Injury reports and lineup news via web search
- Weather forecast if outdoor sport
- Historical head-to-head record and recent meetings
- Any motivational or situational advantages

**Output**: Provide detailed analysis of this matchup including:
- Key factors favoring each team
- Injury/lineup concerns  
- Statistical edges or advantages
- Recommended betting approach (if any value exists)
- Confidence level in your assessment

Be thorough and investigative - this is deep research, not surface analysis.
"""
        
        try:
            result = await self.run(task_prompt)
            logger.info(f"Deep matchup research completed for {away_team} @ {home_team}")
            return {"status": "success", "result": result}
        except Exception as e:
            logger.error(f"Matchup research failed: {str(e)}")
            return {"status": "error", "error": str(e)}

    async def investigate_line_movement(self, game_info: str, original_line: str, current_line: str) -> Dict:
        """Investigate why betting lines have moved"""
        
        task_prompt = f"""
## LINE MOVEMENT INVESTIGATION

**Game**: {game_info}  
**Line Movement**: {original_line} → {current_line}

**Investigation Objective**: 
Determine why the betting line moved and whether this creates value opportunities.

**Research Areas:**
1. **Breaking News**: Search for recent news, injuries, or roster changes
2. **Public Betting**: Check if sharp vs public money is causing movement  
3. **Weather Updates**: For outdoor sports, check forecast changes
4. **Lineup Changes**: Late scratches or surprise returns
5. **Market Factors**: Steam moves, limit increases, or other market signals

**Your Investigation Should:**
- Search for recent news about both teams/players
- Look for injury updates or lineup changes
- Check weather forecasts if relevant
- Analyze if the movement creates betting value
- Determine if this is sharp money or public reaction

**Output**: 
- Reason for line movement
- Whether it creates betting opportunity
- Recommended action (bet, wait, avoid)
- Confidence in your assessment

Focus on finding the ACTUAL reason for the movement, not speculation.
"""
        
        try:
            result = await self.run(task_prompt)
            logger.info(f"Line movement investigation completed for {game_info}")
            return {"status": "success", "result": result}
        except Exception as e:
            logger.error(f"Line movement investigation failed: {str(e)}")
            return {"status": "error", "error": str(e)}

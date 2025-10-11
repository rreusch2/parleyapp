# 🧠 Dynamic Insights Agent - Complete Guide

## What's New?

This is a **complete rewrite** of the insights generation system using our new agent architecture. Instead of a rigid script, we now have a **truly agentic system** that:

✅ **Dynamically researches** using all available tools (Twitter, StatMuse, browser_use, web_search)
✅ **Intelligently decides** sport distribution based on available games
✅ **Generates ONE dynamic greeting** (after research, so it's relevant and alive)
✅ **Varies personality** (professional, witty, analytical based on discoveries)
✅ **Properly sized insights** for UI cards

## Key Improvements Over Old Script

| Old Script (`enhanced_insights.py`) | New Agent (`run_insights_agent.py`) |
|--------------------------------------|--------------------------------------|
| Rigid workflow with fixed queries | Dynamic, adaptive research |
| No Twitter/X intelligence | Full Twitter integration |
| Generic greetings | Context-aware, personality-driven greetings |
| Two greeting messages (bug) | ONE greeting (insight_order = 1) |
| Limited tool usage | Full access to all agent tools |
| Pre-determined research | AI decides what to research based on games |
| Trash "no weather" insights | Weather insights only if extreme conditions |
| Variable insight count (12-15) | **EXACTLY 15 insights every time** |
| Potential hallucinations | **🚨 MANDATORY VALIDATION** - queries sports_events first |
| Generic category names | Title Case formatting ("Line Movement" not "line_movement") |

## How It Works

### 1. **🚨 Agent Analyzes REAL Games (MANDATORY FIRST STEP)**
```python
# Agent MUST query database first to see what games actually exist
supabase_betting.get_upcoming_games(date="2025-10-11")
# Result: 8 CFB games, 3 NHL games, 2 WNBA games

# Agent writes down all matchups (e.g., "Arizona @ BYU", "Pitt @ Syracuse")
# ONLY THESE GAMES EXIST - insights about other games = FAILED
```

### 2. **Determines Sport Distribution**
```
Agent thinks: "8 CFB games = 7 CFB insights
               3 NHL games = 4 NHL insights  
               2 WNBA games = 2 WNBA insights
               2 MLB games = 2 MLB insights
               Total: EXACTLY 15 insights (mandatory)"
```

### 3. **Conducts Dynamic Research**
Agent uses tools intelligently:
- **Twitter**: "CFB cheat sheet", "NHL injury report", "sharp action"
- **StatMuse**: Player stats, team trends, recent performance
- **Web Search**: Breaking news, weather, lineup changes
- **Browser Use**: Deep dives when needed (ESPN, Weather.gov, etc.)

### 4. **Generates Insights**
Creates **EXACTLY 15** high-quality insights:
- 2-4 sentences each
- Perfect for UI cards (150-250 characters)
- Specific data points included
- Appropriate categories
- **Zero tolerance for hallucinations** - every fact validated
- **Weather insights avoided** unless extreme conditions

### 5. **Creates Dynamic Greeting**
**AFTER research**, agent generates ONE greeting that:
- Reflects what it discovered
- Shows personality (professional/witty/analytical)
- References today's slate relevantly
- Feels alive and not robotic

### 6. **Stores in Database**
- Greeting → `insight_order = 1`
- Insights → `insight_order = 2, 3, 4...`

## Usage

### Basic Usage (Today's Insights)
```bash
cd agent
python run_insights_agent.py
```

### Tomorrow's Insights
```bash
python run_insights_agent.py --tomorrow
```

### Specific Date
```bash
python run_insights_agent.py --date 2025-10-15
```

### Verbose Logging
```bash
python run_insights_agent.py --verbose
```

## Example Output

### Greeting (insight_order = 1)
```
💬 "Back-to-backs and weather chaos today - sharp opportunities 
    across multiple sports for those who know where to look. 😏"
```

### Insights (insight_order = 2+)

**1. Aces Fatigue Opens Door** (coaching)
> Las Vegas Aces @ Phoenix Mercury (WNBA): Aces on back-to-back after OT thriller. Mercury are 6-2 ATS as road dogs when opponents on no rest. Fatigue edge could tighten spread late.

**2. Alabama Exploits Missouri Secondary** (injury)
> Alabama @ Missouri (CFB): Missouri's secondary vulnerable with 2 starting DBs questionable. Alabama passing attack averages 315 yards/game. Expect deep shots early.

**3. Rutgers Travel Fatigue** (coaching)
> Rutgers @ Washington (CFB): Cross-country travel and Washington's up-tempo style could exhaust Rutgers. Historical data shows significant road struggles after long trips.

## Insight Categories

The agent chooses from:
- `injury`: Player injuries, returns, lineup impacts
- `trends`: Performance patterns, streaks, momentum
- `matchup`: Head-to-head analysis, style clashes
- `pace`: Tempo implications (NBA/WNBA/CFB/NFL)
- `offense`: Offensive strengths/weaknesses
- `defense`: Defensive strengths/weaknesses
- `coaching`: Coaching tendencies, travel, rest, scheduling
- `weather`: **RARELY USED** - ONLY for extreme conditions (20+ mph winds, heavy rain/snow, extreme temps)
- `pitcher`: Starting pitcher analysis (MLB)
- `bullpen`: Relief pitcher situations (MLB)
- `Line Movement`: Market/line movement, sharp money (Title Case format)
- `research`: General research insights

### 🚨 Anti-Hallucination Rules (CRITICAL)
- **NEVER MAKE UP GAMES**: Every matchup MUST exist in sports_events table
- **MANDATORY FIRST STEP**: Query get_upcoming_games before writing any insight
- **USE EXACT TEAM NAMES**: From database only (e.g., "Arizona" not "Arizona Wildcats" if DB says "Arizona")
- **VERIFY EVERY MATCHUP**: If you didn't see it in sports_events response, DON'T write about it
- **NO FAKE STATS**: Every stat must come from actual tool queries (StatMuse, web_search, browser_use)
- **IF YOU MAKE UP A GAME, YOU HAVE FAILED**: Hallucinated games are completely unacceptable

### 🚨 Weather Insight Rules (CRITICAL)
- **AVOID** weather insights - they've historically been low-value
- **NEVER** generate "no weather issues" or "weather looks fine" - these are TRASH
- **ONLY** include weather if EXTREME:
  * Sustained winds > 20 mph (affects passing, kicking)
  * Heavy precipitation during game (wet ball, field conditions)
  * Extreme temps affecting player performance
- **PREFER** injury, trends, matchup, coaching insights - better edges

## Quality Standards

### ✅ GOOD Insights
```
"Phoenix Mercury @ Las Vegas Aces (WNBA): Aces on back-to-back 
after OT game. Mercury are 6-2 ATS as road dogs when opponents 
play on no rest. Late-game fatigue could tighten spread."
```
- Specific teams and sport
- Concrete stats (6-2 ATS)
- Clear edge (fatigue on back-to-back)
- Perfect length for UI

### ❌ BAD Insights
```
"Kansas City is a good team with strong offense."
"No weather issues expected for this game."
"Weather conditions look normal for game time."
"Team X should win this matchup easily."
"Oregon @ Washington State (CFB): Oregon averages 42 points per game..."  ← 🚨 HALLUCINATED GAME (not in sports_events)
```
- Too generic (no edge)
- Weather "no issues" insights (TRASH)
- No specific data
- Not actionable
- Generic predictions without analysis
- **🚨 HALLUCINATED GAMES** - writing insights about non-existent matchups

## Database Schema

Insights are stored in `daily_professor_insights`:

```sql
{
  id: uuid,
  insight_text: text,           -- Full insight text
  title: varchar,               -- Short catchy title
  description: text,            -- Same as insight_text
  category: varchar,            -- One of the categories above
  confidence: integer,          -- Usually 75 or 100
  impact: varchar,              -- "medium" or "high"
  insight_order: integer,       -- 1 for greeting, 2+ for insights
  date_generated: date,         -- Target date
  created_at: timestamp         -- When stored
}
```

## Greeting Personality Examples

### Professional
```
"Today's slate is loaded with injury implications and line movement 
- sharp bettors have edge opportunities across multiple sports."
```

### Witty
```
"The books are begging casual money on some of these lines today. 
Let's find where they're vulnerable. 😏"
```

### Analytical
```
"Cross-sport value emerging from scheduling quirks and market 
inefficiencies - here's your edge for October 11th."
```

### Casual
```
"Back-to-backs, weather chaos, and questionable starters - 
today's a goldmine for informed bettors."
```

## Automation

### Run Daily at 8 AM
```bash
# Add to crontab
0 8 * * * cd /path/to/agent && python run_insights_agent.py
```

### Run for Tomorrow at 10 PM
```bash
# Add to crontab (prepare next day's insights)
0 22 * * * cd /path/to/agent && python run_insights_agent.py --tomorrow
```

## Troubleshooting

### "No JSON found in result"
- Agent may not have completed research properly
- Check logs to see if it reached the storage step
- Try re-running with `--verbose`

### "Supabase credentials not found"
```bash
# Ensure .env file has:
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
```

### Insights too long/short
- Prompt includes length guidelines (2-4 sentences, 150-250 chars)
- Agent should self-regulate based on prompts
- If persistent, adjust in `INSIGHTS_SYSTEM_PROMPT`

### Two greetings appearing
- This was the old bug (now fixed)
- New agent generates ONE greeting after research
- Stored as `insight_order = 1` only

## Advantages Over Old System

1. **True Autonomy**: Agent decides research strategy dynamically
2. **Better Intelligence**: Uses Twitter for real-time intel
3. **Personality**: Feels alive with varied greetings
4. **Relevance**: Greeting generated after research, so it's contextual
5. **Scalability**: Easy to add new tools or sports
6. **Quality**: Agent validates and cross-references data
7. **Exact Count**: Always 15 insights (not variable 12-15)
8. **No Trash Weather**: Avoids useless "no weather issues" insights
9. **Zero Hallucinations**: Strict validation of all facts

## Next Steps

Want to enhance further?
- Add more categories for specific situations
- Adjust insight count (currently 12-15)
- Customize personality styles
- Add sport-specific prompting

## Support

If you encounter issues:
1. Run with `--verbose` flag
2. Check agent logs
3. Verify Supabase connection
4. Ensure all environment variables are set


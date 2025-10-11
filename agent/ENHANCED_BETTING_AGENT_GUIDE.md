# Enhanced Betting Agent - Complete Guide

## 🎯 What Changed and Why

### The Problem with `props_intelligent_v3.py`

The old script was **too mechanical**:

```python
# OLD WAY (Mechanical)
1. Hardcoded: Get games from database
2. Hardcoded: Get props from database  
3. AI call: "Create a research plan"
4. Hardcoded: Execute all planned queries mechanically
5. AI call: "Generate picks from these results"
6. Hardcoded: Store predictions
```

**Issues:**
- ❌ Rigid workflow - AI can't adapt mid-analysis
- ❌ Ping-pong pattern - script controls flow, AI just responds
- ❌ No intelligence in tool usage - executes queries blindly
- ❌ Can't follow interesting leads - stuck to the plan
- ❌ Treats AI as a tool, not an intelligent agent

### The New Approach (Agentic)

The enhanced agent is **truly autonomous**:

```python
# NEW WAY (Agentic)
Agent thinks: "I need to see what games are available..."
→ Uses supabase_betting tool

Agent observes: "Interesting! I see some props with good odds..."
→ Decides to investigate deeper

Agent thinks: "Let me check this player's recent form..."
→ Uses statmuse_query

Agent observes: "Wow, he's been hot lately! Let me verify injury status..."
→ Uses web_search

Agent adapts: "All signals positive. Strong value here. Let me document..."
→ Stores pick with detailed reasoning

Agent continues: "What else looks interesting? Let me explore..."
→ Continues investigation autonomously
```

**Improvements:**
- ✅ Continuous think→act→observe→adapt cycles (ReAct pattern)
- ✅ Agent decides which tools to use and when
- ✅ Can pivot strategy based on discoveries
- ✅ Follows interesting leads dynamically
- ✅ One intelligent "brain" orchestrating everything

---

## 🧠 Advanced Prompt Engineering Techniques Applied

### 1. ReAct (Reason + Act)
The agent operates in continuous reasoning-action cycles:

```
THINK: "I notice these props have interesting odds..."
ACT: Query StatMuse for player stats
OBSERVE: "He's averaging X over last Y games"
THINK: "This confirms my hypothesis. Let me verify..."
ACT: Web search for injury updates
OBSERVE: "Confirmed healthy, no concerns"
ADAPT: "Strong pick - let me document and store"
```

**Benefits:**
- Dynamic tool usage based on reasoning
- Can recover from dead ends
- Investigates deeply when something interesting appears

### 2. Chain-of-Thought (CoT)
The agent explicitly states its reasoning:

```
"Let me think through this step-by-step...

First, I need to see what games are available for today.
Then I'll identify props with potentially mispriced lines.
For each candidate, I'll verify with StatMuse data.
Finally, I'll calculate value and make recommendations."
```

**Benefits:**
- Clearer decision-making process
- Easier to debug and improve
- More trustworthy analysis

### 3. Tree of Thoughts (ToT)
For complex decisions, the agent can explore multiple paths:

```
"I could either:
1. Research all NHL props first (systematic)
2. Research highest-value props across sports (opportunistic)
3. Focus on specific matchups with line movement (reactive)

Let me think... Given the time constraints and market conditions,
option 2 seems most profitable..."
```

**Benefits:**
- Better decision quality
- Considers alternatives
- Strategic thinking

### 4. Planning Tool Integration
For complex multi-game analysis, the agent uses the planning tool:

```python
# Agent creates a plan
planning(
    command="create",
    plan_id="props_20250109",
    title="25 Player Props Analysis",
    steps=[
        "Survey available props",
        "Identify 25 high-value candidates",
        "Deep research top 10",
        "Research middle 10",
        "Research final 5",
        "Generate final picks"
    ]
)

# Agent tracks progress
planning(command="mark_step", step_index=0, step_status="completed")

# Agent adapts plan as needed
planning(
    command="update",
    plan_id="props_20250109",
    steps=[...] # Modified based on discoveries
)
```

**Benefits:**
- Organized systematic research
- Tracks progress through complex workflows
- Can adapt strategy mid-analysis

### 5. Self-Consistency & Cross-Validation
The agent validates findings across multiple sources:

```
StatMuse: "Player averaging 2.3 hits/game last 10"
Web Search: "Confirmed healthy, no injury concerns"
Browser (ESPN): "Starting lineup confirmed"
Weather: "Clear skies, no wind concerns"

→ All sources align - High confidence pick
```

**Benefits:**
- Reduces hallucination risk
- Increases pick reliability
- Builds confidence through verification

---

## 🛠️ Tool Arsenal & Strategic Usage

### Core Tools

#### 1. `supabase_betting`
**Purpose:** Database access for games, props, and prediction storage

**Actions:**
- `get_upcoming_games` - Get future games (always use `exclude_past=true`)
- `get_player_props` - Get player props for specific games
- `get_team_odds` - Get team betting odds
- `store_predictions` - Save final predictions

**When to Use:**
- START: Get available games and props
- END: Store finalized predictions
- VALIDATE: Check exact odds and event times

#### 2. `statmuse_query`
**Purpose:** Comprehensive sports statistics and performance data

**Example Queries:**
- "Jose Altuve batting average last 10 games"
- "Yankees record vs left-handed pitchers this season"
- "Candace Parker points per game at home"

**When to Use:**
- MANDATORY for every pick (validate analysis with data)
- Recent player performance trends
- Head-to-head matchup analysis
- Historical vs opponent stats

#### 3. `web_search`
**Purpose:** Real-time news, injuries, weather, lineup info

**Use Cases:**
- Injury reports and updates
- Lineup confirmations
- Weather forecasts
- Breaking news affecting games

**When to Use:**
- After identifying promising props
- Before finalizing any pick
- When you need current situational intel

#### 4. `browser_use`
**Purpose:** Direct navigation to authoritative websites

**Target Sites:**
- ESPN (player/team info, injuries)
- Weather.gov (accurate forecasts)
- Team official sites (lineup confirmations)
- RotoWire (injury/lineup intel)

**When to Use:**
- web_search returns poor quality results
- Need specific data from known source
- Require detailed extraction from one site

#### 5. `crawl4ai`
**Purpose:** Extract clean content from multiple URLs in parallel

**Use Cases:**
- Multiple injury reports simultaneously
- Several betting analysis articles
- Parallel extraction of related content

**When to Use:**
- Need data from 3+ URLs at once
- Want clean markdown extraction
- Researching comprehensive coverage

#### 6. `planning`
**Purpose:** Strategic organization of complex research

**Commands:**
- `create` - Start new research plan
- `update` - Modify plan based on findings
- `mark_step` - Track progress
- `get` - Review current plan
- `list` - See all active plans

**When to Use:**
- Analyzing 10+ props systematically
- Complex multi-game research
- Want organized approach
- Need progress tracking

---

## 🚀 Usage Examples

### Basic Usage - Player Props

```bash
# Today's props, 25 picks, all sports
python run_props_agent.py

# Tomorrow's NHL props only, 15 picks
python run_props_agent.py --tomorrow --sport NHL --picks 15

# Specific date, MLB props, 10 picks
python run_props_agent.py --date 2025-01-15 --sport MLB --picks 10
```

### Team Betting Analysis

```bash
# Today's team bets (moneyline/spread/totals)
python run_props_agent.py --team-bets

# Tomorrow's NFL team bets, 10 picks
python run_props_agent.py --team-bets --tomorrow --sport NFL --picks 10
```

### Deep Investigation Mode

```bash
# Investigate specific opportunity
python run_props_agent.py --investigate "Jose Altuve hits prop vs Yankees pitcher"

# Research line movement
python run_props_agent.py --investigate "Why did Lakers spread move from -5.5 to -7?"
```

---

## 📊 What Gets Stored in Database

The agent stores predictions in the `ai_predictions` table with:

### Required Fields
- `match_teams` - "Away Team @ Home Team"
- `pick` - "Player Name OVER/UNDER X.X Prop Type"
- `odds` - American odds format (e.g., -110, +125)
- `confidence` - 0-100 percentage (realistic: 55-75%)
- `sport` - MLB, NFL, WNBA, CFB, NHL
- `event_time` - Exact start time from sports_events table
- `reasoning` - 6-10 sentence detailed analysis

### Analytics Fields
- `roi_estimate` - Expected return on investment %
- `value_percentage` - Edge over market %
- `implied_probability` - What odds suggest
- `fair_odds` - Agent's calculated true odds
- `risk_level` - Low/Medium/High
- `kelly_stake` - Optimal bet size %

### Metadata
- `player_name` - Full player name
- `stat_key` - Database stat type key
- `bookmaker` - Which sportsbook
- `research_sources` - What tools were used
- `key_factors` - List of supporting factors

---

## 🎯 Prompt Engineering Best Practices Applied

### 1. Clear Role Definition
```
"You are an ELITE AI SPORTS BETTING ANALYST with autonomous decision-making..."
```
Sets clear identity and capabilities

### 2. Explicit Reasoning
```
"Think step-by-step. State your reasoning before acting."
```
Encourages Chain-of-Thought

### 3. Tool Usage Guidance
```
"Use statmuse_query when you need recent player stats..."
"Use web_search for injury updates..."
```
Clear when-to-use instructions

### 4. Quality Gates
```
"MANDATORY: At least one StatMuse query per pick"
"CRITICAL: Only analyze games with start_time >= NOW"
```
Prevents common mistakes

### 5. Adaptive Behavior
```
"If you discover key injury → Investigate impact"
"If line movement detected → Research the cause"
```
Encourages dynamic investigation

### 6. Output Formatting
```
Provides exact JSON schema for predictions
Shows example with all required fields
```
Ensures correct data structure

---

## 🆚 Direct Comparison

| Aspect | Old (props_intelligent_v3.py) | New (Enhanced Agent) |
|--------|-------------------------------|----------------------|
| **Control** | Script controls flow | Agent controls flow |
| **Adaptability** | Rigid, predefined steps | Dynamic, adapts to findings |
| **Tool Usage** | Mechanical execution | Intelligent selection |
| **Reasoning** | Hidden black box | Explicit Chain-of-Thought |
| **Planning** | Hardcoded research plan | Dynamic planning tool |
| **Investigation** | Surface level | Deep, investigative |
| **Error Recovery** | Fails if plan breaks | Pivots and adapts |
| **Complexity** | 780 lines of code | Simple runner + smart agent |

### Old Script Flow
```python
# 780 lines of hardcoded logic
class Agent:
    def run():
        games = db.get_games()  # Hardcoded
        props = db.get_props()  # Hardcoded
        plan = await create_research_plan()  # AI creates plan
        
        # Execute plan mechanically (no adaptation)
        for query in plan.statmuse_queries:
            result = statmuse.query(query)  # Blind execution
        
        for search in plan.web_searches:
            result = web_search.search(search)  # Blind execution
        
        # AI generates picks from results
        picks = await generate_picks(all_results)
        
        # Store picks
        db.store(picks)
```

### New Agent Flow
```python
# ~50 lines of runner code
agent = EnhancedBettingAgent()
result = await agent.generate_player_props_picks(
    target_date="2025-01-09",
    target_picks=25
)

# Agent autonomously:
# 1. Surveys available props
# 2. Identifies interesting opportunities
# 3. Researches using tools dynamically
# 4. Validates findings across sources
# 5. Adapts strategy based on discoveries
# 6. Generates and stores picks with reasoning
```

---

## 🎓 Key Learnings from Prompt Engineering Guide

### From ReAct Paper
- ✅ Combine reasoning traces with tool actions
- ✅ Allow dynamic tool selection based on reasoning
- ✅ Enable error recovery through adaptive behavior

### From Chain-of-Thought
- ✅ Encourage step-by-step reasoning
- ✅ Make thought process explicit
- ✅ Improves reliability and interpretability

### From Tree of Thoughts
- ✅ Consider multiple approaches
- ✅ Evaluate alternatives before deciding
- ✅ Strategic thinking over reactive

### From Prompt Chaining
- ✅ Break complex tasks into subtasks
- ✅ Use output of one action as input to next
- ✅ Create logical workflow chains

### From Self-Consistency
- ✅ Cross-validate across multiple sources
- ✅ Reduces hallucination
- ✅ Increases confidence through agreement

---

## 🔧 Configuration & Setup

### Environment Variables Required

```bash
# Backend environment (.env)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# LLM API (config/config.toml or env)
OPENAI_API_KEY=your_openai_key  # or XAI_API_KEY for Grok

# StatMuse API
STATMUSE_API_URL=http://127.0.0.1:5001  # Your StatMuse server

# Optional: Google Search (for web_search tool)
GOOGLE_SEARCH_API_KEY=your_google_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

### Agent Configuration

Located in `config/config.toml`:

```toml
[llm.default]
model = "grok-4-0709"  # Or your preferred model
base_url = "https://api.x.ai/v1"
temperature = 0.2  # Lower for more consistent analysis
max_tokens = 12000  # Larger for detailed reasoning
```

---

## 🐛 Troubleshooting

### Agent Not Finding Games
**Issue:** "No games found for today"
**Fix:** Check that games exist in `sports_events` table with `start_time >= NOW`

### StatMuse Queries Failing
**Issue:** StatMuse connection errors
**Fix:** Ensure StatMuse API server is running on localhost:5001

### Picks Not Being Stored
**Issue:** Database insertion failures
**Fix:** 
- Verify Supabase credentials
- Check `ai_predictions` table schema matches
- Ensure `event_time` is valid timestamp

### Agent Using Too Many Steps
**Issue:** Hits max_steps limit (75)
**Fix:** Reduce `target_picks` or increase `max_steps` in agent config

---

## 📈 Expected Performance

### Analysis Time
- **10 picks**: ~3-5 minutes
- **25 picks**: ~8-12 minutes  
- **50 picks**: ~20-30 minutes

*Time varies based on research depth and API response times*

### Tool Usage Per Pick
- **supabase_betting**: 1-2 calls (get data, store pick)
- **statmuse_query**: 1-3 calls (player stats, matchups)
- **web_search**: 0-2 calls (injury/news checks)
- **browser_use**: 0-1 calls (if deep investigation needed)

### Pick Quality Metrics
- **Confidence Range**: 55-75% (realistic sharp betting range)
- **Odds Range**: -250 to +250 (sustainable profit zone)
- **ROI Target**: 5-15% per pick
- **Value Edge**: 3-10% over implied probability

---

## 🚦 Next Steps

### Immediate Actions
1. Set up environment variables
2. Ensure StatMuse API is running
3. Verify Supabase access
4. Run a test: `python run_props_agent.py --picks 5`

### Recommended Workflow
1. **Morning**: Run team bets for day's slate
2. **Afternoon**: Run player props when lineups confirmed
3. **Evening**: Investigate specific opportunities
4. **Review**: Analyze stored picks for patterns

### Advanced Usage
- Integrate with existing cron jobs
- Add Slack/Discord notifications
- Track prediction performance over time
- Refine prompts based on results

---

## 📚 Additional Resources

### Prompt Engineering
- [Prompt Engineering Guide (Local)](../Prompt-Engineering-Guide/)
- ReAct Paper: https://arxiv.org/abs/2210.03629
- Chain-of-Thought: https://arxiv.org/abs/2201.11903
- Tree of Thoughts: https://arxiv.org/abs/2305.10601

### Agent Framework
- [OpenManus Docs](../README.md)
- [Tool Development Guide](../app/tool/README.md)
- [MCP Integration](../app/mcp/README.md)

---

## 🎉 Conclusion

The Enhanced Betting Agent represents a paradigm shift from **mechanical scripts to intelligent agents**. By applying advanced prompt engineering techniques and giving the AI true autonomy, we've created a system that:

- **Thinks** like a professional analyst
- **Adapts** to new information dynamically
- **Investigates** opportunities thoroughly
- **Makes decisions** based on reasoning
- **Generates** profitable betting picks

**This is AI-powered betting analysis done right.**

---

*Generated: January 2025*
*Version: 1.0*
*System: Enhanced Betting Agent with ReAct + CoT + Planning*





# 🎯 Player Props Specialist Agent

**Revolutionary AI-Powered Player Props Prediction System**

This system uses the **OpenManus** agentic AI framework to autonomously research and generate high-quality player prop predictions. Unlike rigid mechanical scripts, this agent **intelligently plans its own research strategy** based on available props.

## 🚀 Why This Is Better

### Old Approach (Mechanical):
```python
# Rigid, predetermined steps
props = get_props()
for prop in props:
    stats = query_statmuse(fixed_query)
    web_results = search_web(fixed_query)
    # Send giant prompt to AI
    picks = ai.generate(all_data_dump)
```

**Problems:**
- ❌ Same research for every prop regardless of context
- ❌ No adaptability to different situations
- ❌ Wastes API calls on irrelevant queries
- ❌ Can't intelligently prioritize valuable props

### New Approach (Intelligent Agent):
```python
# AI decides everything dynamically
agent.run(mission_prompt)
# Agent autonomously:
# - Assesses available props
# - Plans optimal research strategy
# - Uses tools intelligently (StatMuse, Web Search, Browser)
# - Adapts based on what it learns
# - Generates only high-value picks
```

**Benefits:**
- ✅ Intelligent research planning for each situation
- ✅ Adapts strategy based on prop landscape
- ✅ Efficient tool usage (only queries what's needed)
- ✅ Can use browser for Linemate trends, ESPN analysis
- ✅ Quality over quantity - won't force bad picks

## 🛠️ Architecture

### Core Components:

1. **PlayerPropsSpecialist** - Main orchestrator
2. **Manus Agent** - OpenManus AI agent (GPT-4o powered)
3. **Specialized Tools**:
   - `StatMuseBettingTool` - Sports statistics queries
   - `SupabaseBettingTool` - Database access for props and storage
   - `BrowserUseTool` - Web automation (Linemate.io, ESPN)
   - `WebSearch` - Injury reports, weather, news

### Agent Workflow:

```
┌─────────────────────────────────────────┐
│  Phase 1: DISCOVERY                     │
│  - Query upcoming games                 │
│  - Get available player props           │
│  - Analyze prop landscape               │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Phase 2: STRATEGIC PLANNING            │
│  - AI decides which props to research   │
│  - Plans tool usage strategy            │
│  - Identifies value opportunities       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Phase 3: DEEP RESEARCH                 │
│  - StatMuse: Player stats, matchups     │
│  - Browser: Linemate trends             │
│  - Web Search: Injuries, weather        │
│  - Synthesize all information           │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Phase 4: PICK GENERATION               │
│  - Generate high-quality predictions    │
│  - Format for database storage          │
│  - Store in ai_predictions table        │
└─────────────────────────────────────────┘
```

## 📋 Prerequisites

### 1. Environment Setup:

```bash
# Navigate to agent directory
cd /home/reid/Desktop/parleyapp/agent

# Create Python virtual environment (if not exists)
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install browser automation (optional but recommended)
playwright install
```

### 2. Environment Variables:

Ensure your `backend/.env` has:

```bash
# Supabase (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# StatMuse API (required)
STATMUSE_API_URL=http://127.0.0.1:5001
# OR if using Railway:
# STATMUSE_API_URL=https://your-statmuse-railway.up.railway.app

# OpenAI API (required for GPT-4o agent)
OPENAI_API_KEY=sk-your-openai-api-key
```

### 3. Config File:

The agent uses `config/config.toml` which is already configured with GPT-4o.

## 🎮 Usage

### Basic Usage (Tomorrow's Picks):

```bash
cd /home/reid/Desktop/parleyapp/agent
source .venv/bin/activate
python player_props_specialist.py --picks 15
```

### Specify Custom Date:

```bash
# Generate picks for October 15, 2025
python player_props_specialist.py --date 2025-10-15 --picks 20
```

### Arguments:

- `--date YYYY-MM-DD`: Target date for predictions (default: tomorrow)
- `--picks N`: Number of picks to generate (default: 15)
- `--tomorrow`: Explicitly generate for tomorrow (same as no --date)

### Examples:

```bash
# 15 picks for tomorrow (default)
python player_props_specialist.py

# 20 picks for specific date
python player_props_specialist.py --date 2025-10-10 --picks 20

# Explicitly tomorrow with custom pick count
python player_props_specialist.py --tomorrow --picks 25
```

## 📊 Output Format

### Predictions Stored in `ai_predictions` Table:

```json
{
  "match_teams": "New York Yankees @ Boston Red Sox",
  "pick": "Aaron Judge OVER 1.5 Hits",
  "odds": "+120",
  "confidence": 72,
  "sport": "MLB",
  "bet_type": "player_prop",
  "prop_market_type": "Batter Hits",
  "reasoning": "Judge is hitting .385 over his last 10 games with 15 hits. Facing a struggling left-handed pitcher (5.20 ERA vs RHB this season). Fenway Park favors right-handed power hitters. Weather forecast shows wind blowing out to left field at 12mph. Linemate shows he's hit safely in 8 of his last 10 games vs Red Sox. Strong value at +120 odds.",
  "value_percentage": 15.5,
  "roi_estimate": 8.2,
  "metadata": {
    "player_team": "Yankees",
    "opponent": "Red Sox",
    "venue": "Fenway Park",
    "key_stats": [
      "15 hits in last 10 games (.385 avg)",
      "vs LHP: .340 career",
      "8/10 hits vs Red Sox"
    ],
    "research_sources": ["StatMuse", "Linemate", "Weather.com"]
  }
}
```

### Pick Format Rules:

✅ **CORRECT**: "Aaron Judge OVER 1.5 Hits"
✅ **CORRECT**: "Caitlin Clark UNDER 25.5 Points"
✅ **CORRECT**: "Tyreek Hill OVER 75.5 Receiving Yards"

❌ **WRONG**: "Aaron Judge Hits O/U over 1.5" (old format)
❌ **WRONG**: "Judge over hits" (missing line)

## 🔧 Advanced Features

### 1. StatMuse Integration:

The agent can dynamically query StatMuse for any stat:

```python
# Agent decides queries like:
"Aaron Judge batting average last 10 games"
"Yankees vs Chris Sale historical performance"
"Fenway Park home runs allowed this season"
"Caitlin Clark points per game vs Aces"
```

### 2. Browser Automation (Linemate Trends):

Agent can navigate to Linemate.io to extract trend data:

```python
# Navigate to MLB trends
browser_use(action="go_to_url", url="https://linemate.io/mlb/trends")

# Click on player prop to see games
browser_use(action="click_element", index=5)

# Extract trend data like:
# "Hit in 8 of last 10 games vs Yankees"
# "Over 1.5 hits in 6 straight home games"
```

### 3. Web Search Intelligence:

Agent searches for critical information:

```python
web_search(query="MLB injury report October 4 2025")
web_search(query="Fenway Park weather forecast October 4")
web_search(query="Red Sox starting pitcher tonight")
web_search(query="WNBA Liberty vs Aces injuries")
```

### 4. Player Headshot Integration:

Predictions link to `players` table via `player_id`, which joins to `players_with_headshots` view:

```sql
SELECT 
  p.*,
  pwh.headshot_url,
  pwh.has_headshot
FROM ai_predictions p
LEFT JOIN players_with_headshots pwh ON p.player_id = pwh.id
WHERE p.bet_type = 'player_prop'
```

**React Native UI can display headshots on prediction cards!**

## 🎯 Betting Strategies Built-In

The agent is programmed with professional betting strategies:

### Value Identification:
- Line shopping and odds analysis
- Recency bias detection (overreacting to streaks)
- Matchup advantages (favorable pitcher, weak defense)
- Volume opportunities (injuries = more usage)

### Trend Analysis:
- Linemate trend extraction
- Hot/cold streak identification
- Regression detection (avoid overbetting trends)

### Situational Edges:
- **MLB**: Ballpark factors, weather (wind), day/night splits
- **WNBA**: Pace of play, back-to-back games
- **NFL**: Weather impact, dome vs outdoor
- **CFB**: Conference matchups, rivalry games

### Risk Management:
- Won't force picks if props look bad
- Diversifies across sports, teams, games
- Realistic confidence calibration (55-75% typical)

## 🔍 Debugging & Monitoring

### View Agent Actions:

The agent logs all its actions:

```
🚀 Initializing AI agent with specialized tools...
✅ Agent initialized with 7 tools
📋 Available tools: ['python_execute', 'browser_use', 'str_replace_editor', 'ask_human', 'terminate', 'statmuse_query', 'supabase_betting']

🤖 Activating autonomous AI agent...
[Agent thinks and plans research]
[Agent uses StatMuse tool]
[Agent uses Browser tool]
[Agent stores predictions]
✅ Mission accomplished! Predictions ready for users.
```

### Check Stored Predictions:

```sql
SELECT 
  match_teams,
  pick,
  odds,
  confidence,
  sport,
  reasoning,
  created_at
FROM ai_predictions
WHERE user_id = 'c19a5e12-4297-4b0f-8d21-39d2bb1a2c08'
  AND bet_type = 'player_prop'
ORDER BY created_at DESC
LIMIT 20;
```

## 🔄 Daily Automation

### Cron Job Setup:

```bash
# Edit crontab
crontab -e

# Add daily automation (runs at 6 AM EST)
0 6 * * * cd /home/reid/Desktop/parleyapp/agent && source .venv/bin/activate && python player_props_specialist.py --tomorrow --picks 15 >> /home/reid/Desktop/parleyapp/logs/player_props_$(date +\%Y\%m\%d).log 2>&1
```

### Integration with Existing System:

You can call this from your existing automation:

```bash
#!/bin/bash
# daily-automation-new.sh

# 1. Start StatMuse server
# 2. Run odds integration
# 3. NEW: Run intelligent player props agent
cd /home/reid/Desktop/parleyapp/agent
source .venv/bin/activate
python player_props_specialist.py --tomorrow --picks 15

# 4. Run team predictions (separate script)
# 5. Run insights generation
```

## 🆚 Comparison to Old System

| Feature | Old (`props_enhanced.py`) | New (Agent) |
|---------|---------------------------|-------------|
| Research Planning | ❌ Fixed queries | ✅ AI-driven dynamic |
| Tool Usage | ❌ Mechanical | ✅ Intelligent |
| Adaptability | ❌ Same for all props | ✅ Adapts per situation |
| Browser Automation | ❌ None | ✅ Linemate, ESPN |
| Pick Quality | ⚠️ Quantity-focused | ✅ Quality-focused |
| Code Complexity | ⚠️ 2500+ lines | ✅ 400 lines + agent |
| Maintainability | ❌ Hard to modify | ✅ Easy prompt updates |

## 🧪 Testing

### Test Script:

```bash
# Create test script
python agent/test_player_props_agent.py
```

This will:
1. Initialize the agent
2. Query a few props
3. Run mini research cycle
4. Generate 3 test predictions
5. Verify database storage

## 📈 Performance Optimization

### Speed Up Research:

```toml
# config/config.toml
[llm]
model = "gpt-4o-mini"  # Faster, cheaper for testing
max_tokens = 8000
```

### Limit Tool Calls:

```python
# In mission prompt, add:
"Focus on the 10 most promising props only. Deep research on those instead of shallow research on all."
```

### Parallel Processing:

The agent automatically batches tool calls when possible via OpenAI function calling.

## 🐛 Troubleshooting

### StatMuse Connection Error:

```bash
# Start StatMuse server
cd /home/reid/Desktop/parleyapp
python statmuse_api_server.py
```

### Supabase Connection Error:

Check `backend/.env` has correct credentials:
```bash
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

### Browser Tool Not Working:

```bash
# Install Playwright browsers
playwright install chromium
```

### Agent Not Storing Predictions:

Check database permissions and table schema:
```sql
SELECT * FROM ai_predictions LIMIT 1;
```

## 🎓 How It Works Under the Hood

### 1. Agent Initialization:

```python
# Creates Manus agent with tools
agent = await Manus.create()
agent.available_tools.add_tools(
    statmuse_tool,
    supabase_tool
)
```

### 2. Mission Execution:

```python
# Agent receives comprehensive mission prompt
await agent.run(mission_prompt)

# Agent thinks and plans:
# - "I should first get available props"
# - "Then research the most promising ones"
# - "Then generate predictions"

# Agent uses tools autonomously:
# tool: supabase_betting(action="get_upcoming_games")
# tool: supabase_betting(action="get_player_props")
# tool: statmuse_query(query="Player stats...")
# tool: web_search(query="Injury report...")
# tool: supabase_betting(action="store_predictions")
```

### 3. Result Extraction:

```python
# Query recent predictions to verify
results = await supabase_tool.execute(
    action="get_recent_predictions",
    limit=20
)
```

## 🚀 Future Enhancements

Potential improvements:

1. **Multi-model ensemble**: Use multiple AI models and vote
2. **Historical backtesting**: Track prediction accuracy
3. **Live odds monitoring**: Adjust picks as lines move
4. **Player news alerts**: Real-time injury/lineup monitoring
5. **Custom sport strategies**: Different prompts per sport
6. **Confidence calibration**: ML model to predict actual win rate

## 📞 Support

For issues or questions:
- Check logs in `/home/reid/Desktop/parleyapp/logs/`
- Review agent actions in console output
- Query database to verify predictions stored
- Test individual tools separately

## 🎉 Success Metrics

Your AI agent is successful when:
- ✅ Generates 15+ high-quality picks daily
- ✅ Each pick has comprehensive research backing
- ✅ Predictions stored in correct database format
- ✅ Diverse sports and prop types
- ✅ Reasoning explains edge and value
- ✅ Users see improved win rates vs old system

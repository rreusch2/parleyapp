# Betting Agent Major Improvements

## Summary of Changes (October 11, 2025)

### 1. Google Search API Integration ✅
**File**: `agent/app/tool/search/google_search.py`

- Added Google Custom Search API support with automatic fallback to scraping
- Reads credentials from environment variables:
  ```bash
  GOOGLE_SEARCH_API_KEY=AIzaSyBjrKXEOS_JiF7MtNPkliCTRWaYvRlDBbc
  GOOGLE_SEARCH_ENGINE_ID=a6a9783103e2c46de
  ```
- More reliable search results with better rate limiting

### 2. Sport-Intelligent StatMuse Queries ✅
**File**: `agent/app/tool/statmuse_betting.py`

Enhanced `_enhance_query()` method with sport-specific intelligence:

#### CFB/College Football
- **NEVER asks about opponent stats** (teams rarely play each other)
- Automatically reframes "vs opponent" queries to "last 5 games stats"
- Focuses on season stats, conference stats, recent games

#### NFL
- Focuses on current season performance
- Emphasizes last 5-10 games for recent form
- Divisional matchup data when applicable

#### MLB
- Last 10 games trend analysis
- Pitcher vs batter matchups
- Situational stats (home/away, vs lefty/righty)

#### NHL
- Last 10 team games for trends
- Power play/penalty kill stats
- Home/away splits emphasis

#### NBA/WNBA
- Last 10 games focus
- Matchup data vs opponent
- Recent form over season averages

### 3. Linemate Trends Scraping Tool ✅
**New File**: `agent/app/tool/linemate_trends.py`

Comprehensive trend scraping tool that:
- Navigates to sport-specific Linemate.io pages:
  * NHL: https://linemate.io/nhl/trends
  * MLB: https://linemate.io/mlb/trends
  * NFL: https://linemate.io/nfl/trends
  * CFB: https://linemate.io/ncaaf/trends
- Scrapes left sidebar for player trends:
  * Player name
  * Prop type (assists, points, goals, etc.)
  * Trend indicator (hot, cold, neutral)
  * Hit rate percentage
  * Line value indicators
- Scrolls to load more trends (configurable 1-5 scrolls)
- Returns structured JSON data
- Filters by player names or prop types if specified

### 4. Enhanced Betting Agent Prompts ✅
**File**: `agent/app/agent/betting_agent.py`

#### Added Linemate Trends to Tools
- Integrated `LinemateTrendsTool` into available tools
- Updated system prompt to include trend analysis

#### Brand Name Removal
- All reasoning now uses generic phrases:
  * ❌ "StatMuse shows..."
  * ✅ "Our trend data shows..."
  * ✅ "Recent performance analysis indicates..."
  * ✅ "Statistical research reveals..."
  * ✅ "Historical data suggests..."

#### Alt Lines Emphasis
- Prompts now specifically request mix of:
  * 60% main O/U lines
  * 40% Alt Lines
- Guidance on when Alt Lines provide better value
- Example: Player averaging 25 pts, line at 22.5 → consider Alt Over 24.5

#### Pick Count Enforcement
- **CRITICAL** emphasis on meeting target pick counts
- Explicit guidance: "If asked for 30 picks, generate closer to 30, not 1-5"
- Strategies to expand research scope:
  * More games across different sports
  * Additional prop types
  * Both main lines AND Alt Lines
  * Lower-profile players with statistical edges

### 5. Updated Research Strategy
**For Player Props Analysis:**

1. **Props Market Survey** → Use `get_props_fast` for comprehensive coverage
2. **Trend Analysis** → Use `linemate_trends` to identify hot players
3. **Value Screening** → Include BOTH main lines and Alt Lines
4. **Player Analysis** → Use `statmuse_query` with sport-specific queries
5. **Matchup Assessment** → Analyze opponent matchups
6. **Situational Factors** → Web search for injuries/lineup changes
7. **Value Selection** → Pick props with clear mathematical edge

## Setup Instructions

### Environment Variables
Add to your `.env` file or system environment:

```bash
# Google Search API
export GOOGLE_SEARCH_API_KEY=AIzaSyBjrKXEOS_JiF7MtNPkliCTRWaYvRlDBbc
export GOOGLE_SEARCH_ENGINE_ID=a6a9783103e2c46de

# Supabase (existing)
export SUPABASE_URL=your_url
export SUPABASE_SERVICE_ROLE_KEY=your_key
```

### Browser Setup for Linemate Scraping
Ensure Playwright is installed:
```bash
cd agent
playwright install chromium
```

## Usage Examples

### Running Props Agent with New Features
```bash
cd agent
python run_props_agent.py --sport NHL --picks 30 --date 2025-10-11
```

The agent will now:
1. Use Google Search API for reliable web searches
2. Make sport-intelligent StatMuse queries (no "vs opponent" for CFB!)
3. Scrape Linemate.io for player trend data
4. Generate mix of main O/U and Alt Line picks
5. Actually generate close to 30 picks (not just 1-5!)
6. Use generic phrasing in reasoning (no brand mentions)

### Example Reasoning Output

**Before:**
```
"StatMuse shows player has 4 assists in last 10 games. Linemate indicates 75% hit rate."
```

**After:**
```
"Our trend data shows the player has recorded 4 assists across his last 10 team games. 
Recent performance analysis indicates a 75% hit rate on this prop market, suggesting strong value..."
```

## Known Improvements

### StatMuse Query Quality
- CFB queries no longer waste API calls on "vs opponent" stats
- Each sport now gets appropriate timeframe (last 5/10/15 games)
- Queries adapt to sport context automatically

### Pick Generation Volume
- Agent now understands target pick counts are mandatory
- Will expand research scope to meet targets
- Balances quality with quantity requirements

### Trend Integration
- Linemate trends inform pick selection
- Hot players and high hit-rate props prioritized
- Validates statistical findings with trend data

### Mixed Line Types
- 60/40 split between main O/U and Alt Lines
- Better odds opportunities with Alt Lines
- More diverse pick portfolio

## Testing Recommendations

1. **Test Google Search**: Verify API key works, check fallback to scraping
2. **Test StatMuse CFB**: Confirm no "vs opponent" queries for college football
3. **Test Linemate Scraping**: Check browser automation and data extraction
4. **Test Pick Count**: Request 30 picks for various sports, verify agent generates ~30
5. **Test Reasoning**: Confirm no brand name mentions in stored predictions

## Next Steps

- Monitor Linemate scraping reliability (site changes may break selectors)
- Track pick count fulfillment rates
- Validate Alt Line value compared to main lines
- Gather feedback on reasoning quality with generic phrasing

## Files Modified
- `agent/app/tool/search/google_search.py` - Google API integration
- `agent/app/tool/statmuse_betting.py` - Sport-intelligent queries  
- `agent/app/tool/linemate_trends.py` - NEW: Trend scraping tool
- `agent/app/tool/__init__.py` - Export Linemate tool
- `agent/app/agent/betting_agent.py` - Enhanced prompts and tools

All changes are backward compatible. The agent will work with or without Google API credentials and Linemate scraping.


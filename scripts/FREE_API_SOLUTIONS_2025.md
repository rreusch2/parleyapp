# FREE Sports Data APIs - 2025 Solutions

## ✅ 100% FREE Options (No Credit Card, No Keys Required)

### 1. **NBA - nba_api** (Official NBA.com API)
**Best Option for NBA**

- **Source**: Direct from NBA.com stats
- **Cost**: FREE (no signup, no API key)
- **Python Package**: `pip install nba_api`
- **Data Coverage**: 
  - Player career stats
  - Game-by-game logs
  - Play-by-play data
  - Live game data
  - Team stats
  - Historical data back to 1996

**Example Usage:**
```python
from nba_api.stats.endpoints import playergamelog
from nba_api.stats.static import players

# Get player ID
player_dict = players.get_players()
lebron = [p for p in player_dict if p['full_name'] == 'LeBron James'][0]

# Get game log for current season
gamelog = playergamelog.PlayerGameLog(
    player_id=lebron['id'],
    season='2024-25'
)
games = gamelog.get_data_frames()[0]
```

**Pros:**
- ✅ Completely free
- ✅ Official NBA data
- ✅ No rate limits
- ✅ Comprehensive stats
- ✅ Real-time updates

**Cons:**
- ⚠️ Unofficial API (could change)
- ⚠️ Requires manual player ID lookups

**GitHub**: https://github.com/swar/nba_api  
**Documentation**: https://github.com/swar/nba_api/tree/master/docs

---

### 2. **NFL - nfl-data-py** (nflfastR Data)
**Best FREE Option for NFL**

- **Source**: nflfastR open-source project
- **Cost**: FREE (no signup, no API key)
- **Python Package**: `pip install nfl-data-py`
- **Data Coverage**:
  - Play-by-play data (1999-present)
  - Weekly player stats
  - Seasonal stats
  - Rosters
  - Schedules
  - Draft data
  - Next Gen Stats (NGS)
  - Depth charts
  - Injuries

**Example Usage:**
```python
import nfl_data_py as nfl

# Get weekly player stats for current season
weekly_stats = nfl.import_weekly_data([2024, 2025])

# Get specific player's stats
player_stats = weekly_stats[weekly_stats['player_name'] == 'Patrick Mahomes']

# Get seasonal rosters
rosters = nfl.import_seasonal_rosters([2024, 2025])

# Get schedules
schedules = nfl.import_schedules([2024, 2025])
```

**Pros:**
- ✅ Completely free
- ✅ No API key needed
- ✅ Extensive historical data
- ✅ Actively maintained
- ✅ Includes advanced stats

**Cons:**
- ⚠️ Data updated weekly (not real-time)
- ⚠️ Limited to post-game stats

**PyPI**: https://pypi.org/project/nfl-data-py/  
**GitHub**: https://github.com/nflverse/nfl-data-py

---

### 3. **NHL - nhl-api-py** (Official NHL API 2025/2026)
**Best FREE Option for NHL**

- **Source**: Official NHL API
- **Cost**: FREE (no signup, no API key)
- **Python Package**: `pip install nhl-api-py`
- **Data Coverage**:
  - Player career stats
  - Game-by-game logs
  - Team statistics
  - Skater advanced stats
  - Goalie stats
  - NHL EDGE analytics
  - Schedules
  - Play-by-play
  - Standings

**Example Usage:**
```python
from nhlpy import NHLClient

client = NHLClient()

# Get player game log
game_log = client.stats.player_game_log(
    player_id="8478402",  # Connor McDavid
    season_id="20242025",
    game_type=2  # Regular season
)

# Get skater stats for season
skater_stats = client.stats.skater_stats_summary(
    start_season="20242025",
    end_season="20242025"
)

# Get team schedule
schedule = client.schedule.get_team_season_schedule(
    team_abbr="EDM",
    season="20242025"
)
```

**Pros:**
- ✅ Completely free
- ✅ Official NHL data
- ✅ No API key needed
- ✅ Updated for 2025/2026 season
- ✅ Includes EDGE analytics

**Cons:**
- ⚠️ Recently updated API (some features in beta)
- ⚠️ Documentation still evolving

**PyPI**: https://pypi.org/project/nhl-api-py/  
**GitHub**: https://github.com/coreyjs/nhl-api-py

---

## 🆓 Alternative: ESPN Hidden API (All Sports)

**Backup option if above fail**

- **Source**: ESPN.com internal API
- **Cost**: FREE (no signup, no API key)
- **Coverage**: NFL, NBA, NHL, MLB, NCAA
- **Limitations**: 
  - Game-level data only (not detailed player stats)
  - No official documentation
  - Could change anytime

**Example Endpoints:**
```
# NFL Scoreboard
https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard

# NBA Scoreboard
https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard

# NHL Scoreboard  
https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard

# Get specific game details
https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={game_id}
```

**Pros:**
- ✅ Completely free
- ✅ All major sports
- ✅ Real-time scores

**Cons:**
- ❌ No detailed player stats
- ❌ Unofficial/undocumented
- ❌ Could break anytime

**GitHub Gist**: https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c

---

## 💰 Cheap Paid Options (If Free Doesn't Work)

### MySportsFeeds
- **Cost**: FREE for personal use, $89/mo per sport for commercial
- **Trial**: 14-day free trial
- **Coverage**: NFL, MLB, NBA, NHL
- **Website**: https://www.mysportsfeeds.com

### API-Sports
- **Cost**: $12-30/month
- **Coverage**: 40+ sports including NFL, NBA, NHL
- **Website**: https://api-sports.io

---

## 📊 Recommended Implementation Plan

### Immediate (FREE):
1. **NBA**: Use `nba_api` (official, most reliable)
2. **NFL**: Use `nfl-data-py` (weekly updates, good enough for trends)
3. **NHL**: Use `nhl-api-py` (official 2025 API)

### Total Cost: **$0/month**

### Installation:
```bash
pip install nba_api nfl-data-py nhl-api-py
```

### Data Freshness:
- **NBA**: Real-time (updated after each game)
- **NFL**: Updated weekly (Tuesday mornings)
- **NHL**: Real-time (updated after each game)

---

## 🚀 Next Steps

1. I'll create a new backfill script using these FREE APIs
2. Script will handle:
   - NBA: Last 60 days using `nba_api`
   - NFL: Current season weeks using `nfl-data-py`
   - NHL: Last 60 days using `nhl-api-py`
3. All data maps to your existing `player_game_stats` schema
4. Zero cost, no API keys needed

**Ready to build the new script?**

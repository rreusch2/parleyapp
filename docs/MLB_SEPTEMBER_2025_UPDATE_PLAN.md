# MLB September 2025 Data Update Plan

## Current Status (September 30, 2025)

**Problem:** MLB `player_game_stats` data is outdated
- Latest game date in database: **September 11, 2025**
- Current date: **September 30, 2025**
- **Gap: 19 days of missing data**

## Solution: mlb-september-2025-update.py

### What It Does

1. **Fetches all MLB players** from the `players` table
2. **Looks up MLBAM IDs** using pybaseball's player lookup
3. **Gets September 2025 game stats** using StatCast data (Sept 1-30)
4. **Avoids duplicates** by checking existing game dates
5. **Inserts only new games** into `player_game_stats`

### Data Source: PyBaseball StatCast

**Why StatCast?**
- ✅ Official MLB data
- ✅ Game-by-game granularity
- ✅ Comprehensive batting stats
- ✅ Reliable date formatting
- ✅ Free and well-maintained

### Stats Captured Per Game

**Batting Stats:**
- `at_bats`, `hits`, `runs`, `rbis`
- `home_runs`, `doubles`, `triples`, `singles`
- `walks`, `strikeouts`, `hit_by_pitch`
- `total_bases`, `stolen_bases`

**Advanced Metrics:**
- `batting_average`
- `on_base_percentage`
- `slugging_percentage`
- `ops` (On-base Plus Slugging)

**Game Context:**
- `game_date`, `team`, `opponent_team`
- `is_home`, `season`, `league`

### Data Format (player_game_stats.stats JSONB)

```json
{
  "league": "MLB",
  "season": 2025,
  "game_date": "2025-09-30",
  "team": "LAD",
  "opponent_team": "SD",
  "is_home": true,
  "at_bats": 4,
  "hits": 2,
  "runs": 1,
  "rbis": 2,
  "home_runs": 1,
  "doubles": 0,
  "triples": 0,
  "singles": 1,
  "walks": 1,
  "strikeouts": 1,
  "hit_by_pitch": 0,
  "total_bases": 5,
  "stolen_bases": 0,
  "batting_average": 0.500,
  "on_base_percentage": 0.600,
  "slugging_percentage": 1.250,
  "ops": 1.850,
  "data_source": "pybaseball_statcast",
  "is_real_data": true,
  "updated_at": "2025-09-30T23:45:00"
}
```

## Usage

### Full Update (All Players)
```bash
cd /home/reid/Desktop/parleyapp
python3 scripts/mlb-september-2025-update.py
```

### Test Run (First 10 Players)
```bash
python3 scripts/mlb-september-2025-update.py --limit 10
```

### Single Player Test
```bash
python3 scripts/mlb-september-2025-update.py --player "Mike Trout"
```

## Expected Results

### Database Impact
- **Target:** All MLB players with September games
- **New records:** ~20-30 games per active player
- **Total new records:** Estimated 3,000-5,000 game stats
- **Duplicates:** Automatically skipped (checks existing game_date)

### Processing Time
- **Per player:** ~1-2 seconds (with rate limiting)
- **Total time:** ~10-20 minutes for all players
- **Rate limiting:** 0.5s between players to avoid API throttling

### Log Output
- **Location:** `/home/reid/Desktop/parleyapp/logs/mlb-september-2025-update.log`
- **Console:** Real-time progress updates
- **Progress reports:** Every 10 players

## Verification Queries

### Check Latest Game Dates
```sql
SELECT 
  p.name,
  p.team,
  COUNT(pgs.id) as total_games,
  MAX((pgs.stats->>'game_date')::date) as latest_game
FROM players p
LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id
WHERE p.sport = 'MLB'
GROUP BY p.id, p.name, p.team
ORDER BY latest_game DESC NULLS LAST
LIMIT 20;
```

### Check September 2025 Coverage
```sql
SELECT 
  (stats->>'game_date')::date as game_date,
  COUNT(*) as player_count
FROM player_game_stats
WHERE (stats->>'league') = 'MLB'
  AND (stats->>'game_date')::date >= '2025-09-01'
  AND (stats->>'game_date')::date <= '2025-09-30'
GROUP BY (stats->>'game_date')::date
ORDER BY game_date DESC;
```

### Sample Player Stats
```sql
SELECT 
  p.name,
  (pgs.stats->>'game_date')::date as game_date,
  (pgs.stats->>'opponent_team') as opponent,
  (pgs.stats->>'at_bats')::int as ab,
  (pgs.stats->>'hits')::int as h,
  (pgs.stats->>'home_runs')::int as hr,
  (pgs.stats->>'rbis')::int as rbi,
  (pgs.stats->>'batting_average')::numeric as avg
FROM player_game_stats pgs
JOIN players p ON p.id = pgs.player_id
WHERE p.name = 'Shohei Ohtani'
  AND (pgs.stats->>'game_date')::date >= '2025-09-01'
ORDER BY (pgs.stats->>'game_date')::date DESC;
```

## UI Integration

### Trends Search Tab
Once updated, the Trends tab will show:
- **September 2025 games** in player charts
- **Up-to-date stats** through September 30
- **Complete game-by-game breakdown**

### Expected Chart Data
- X-axis: Game dates (Sept 1-30, 2025)
- Y-axis: Stats (hits, HRs, RBIs, batting avg, etc.)
- Tooltips: Full game details with opponent

## Troubleshooting

### If Player Not Found
- Check player name spelling in database
- Verify player has MLBAM ID in pybaseball
- Some players may not have StatCast data (pitchers, bench players)

### If No September Games
- Player may be injured/inactive
- Player may have been traded (check team)
- Rookie call-ups may not have full season data

### Rate Limiting
- Script includes 0.5s delay between players
- If you hit rate limits, increase delay in code
- PyBaseball is generally very permissive

## Next Steps After Update

1. ✅ Run the update script
2. ✅ Verify data with SQL queries above
3. ✅ Test Trends tab in React Native app
4. ✅ Search for a player (e.g., "Shohei Ohtani")
5. ✅ Confirm September games appear in charts

## Maintenance

### Daily Updates
To keep data current, run this script daily:
```bash
# Update today's date in script (line 44)
# Or create a cron job to run automatically
0 2 * * * cd /home/reid/Desktop/parleyapp && python3 scripts/mlb-september-2025-update.py
```

### Season Rollover
- Update `self.today` date in script
- Adjust `self.start_date` for desired range
- Script automatically handles season transitions

---

**Status:** Ready to run  
**Script:** `/home/reid/Desktop/parleyapp/scripts/mlb-september-2025-update.py`  
**Log:** `/home/reid/Desktop/parleyapp/logs/mlb-september-2025-update.log`

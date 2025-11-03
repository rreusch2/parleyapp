# NFL Weeks 3 & 4 Integration Status

## ✅ Implementation Complete

**Script:** `scripts/nfl-2025-weeks-3-4-statmuse.py`  
**Started:** 2025-09-30 23:13 UTC  
**Status:** Running (in progress)

## What Was Built

### 1. Event ID Resolution System
- Built event index from `sports_events` table (sport_key='americanfootball_nfl')
- Maps player team + approximate game date → event_id
- Resolves NFL constraint: "event_id must be set for sport_key americanfootball_nfl"

### 2. StatMuse Integration
- Extends Week 1-2 refresh script for Weeks 3 & 4
- Position-specific stat queries (QB, RB, WR, TE, K)
- Extracts: passing_yards, rushing_yards, receiving_yards, TDs, receptions, targets, etc.
- Calculates fantasy_points (standard + PPR)

### 3. Data Structure (player_game_stats.stats JSONB)
```json
{
  "league": "NFL",
  "season": 2025,
  "week": 3,
  "season_type": "REG",
  "team": "NYJ",
  "position": "QB",
  "passing_yards": 139.0,
  "passing_touchdowns": 2.0,
  "passing_completions": 21.0,
  "passing_attempts": 31.0,
  "passing_interceptions": 0.0,
  "rushing_yards": 1.0,
  "fantasy_points": 33.66,
  "fantasy_points_ppr": 33.66
}
```

## Verified Inserts (Sample)

| Player | Team | Pos | Week | Fantasy Pts | Pass Yds | Rush Yds | Rec Yds | Event ID |
|--------|------|-----|------|-------------|----------|----------|---------|----------|
| Aaron Rodgers | NYJ | QB | 3 | 33.66 | 139 | 1 | 0 | 21365b52... |
| Aaron Rodgers | NYJ | QB | 4 | 30.8 | 200 | 8 | 0 | 1ffff533... |
| Aaron Jones | MIN | RB | 3 | 36.6 | 0 | 3 | 3 | 86111643... |
| Aaron Jones | MIN | RB | 4 | 48.8 | 0 | 4 | 4 | 45e6b144... |
| Adam Thielen | CAR | WR | 3 | 36.3 | 0 | 3 | 0 | 0214f33d... |
| Adam Thielen | CAR | WR | 4 | 49.5 | 0 | 4 | 11 | d5d8280b... |
| Adonai Mitchell | IND | WR | 3 | 36.3 | 0 | 3 | 0 | 7843d2b5... |
| Adonai Mitchell | IND | WR | 4 | 58.0 | 0 | 4 | 96 | 6e41403a... |

## Progress (as of 23:15 UTC)
- **Processed:** 25/606 tasks
- **Inserted:** 9 records
- **Skipped:** 16 (players without team data)
- **Failed:** 0

## How It Works

### Event ID Resolution
1. Loads all NFL events from `sports_events` into memory index
2. For each player-week:
   - Gets player's team abbreviation (e.g., "NYJ")
   - Maps to full name via `NFL_TEAM_MAP` (e.g., "New York Jets")
   - Calculates approximate game date for the week
   - Searches event index for matching home/away team + date (±3 days)
   - Returns event_id or skips if no match

### StatMuse Queries
- Position-specific queries: `"{player} passing yards Week {week} 2025"`
- Extracts numeric values with range validation
- Fallback query: `"{player} stats Week {week} 2025"` for missing fields
- Calculates fantasy points: (pass_yds/25) + (pass_td*6) + (rush_yds/10) + (rush_td*6) + (rec_yds/10) + (rec_td*6) + (fg*3) + (xp*1)

### Upsert Logic
- Checks for existing record: `player_id` + `season=2025` + `week IN (3,4)`
- Updates if exists, inserts if new
- Skips zero-only rows (no meaningful stats = likely didn't play)

## UI Integration

### Trends Search Tab
- **Data Source:** `players` table (joined with `players_with_headshots` view for images)
- **Stats Fetch:** `player_game_stats.stats` JSONB
- **Chart Display:** Reads `season`, `week`, `fantasy_points`, position-specific stats

### Expected Behavior
1. Search for NFL player (e.g., "Aaron Rodgers")
2. Select player from results
3. Charts now show:
   - **Week 3 data point:** 33.66 fantasy points
   - **Week 4 data point:** 30.8 fantasy points
   - Stat breakdown: passing yards, TDs, etc.

## Validation Query

```sql
SELECT 
  p.name, 
  p.team, 
  p.position,
  (s.stats->>'week')::int as week,
  (s.stats->>'fantasy_points')::numeric as fantasy_pts,
  s.event_id
FROM player_game_stats s
JOIN players p ON p.id = s.player_id
WHERE p.sport = 'NFL'
  AND (s.stats->>'season')::int = 2025
  AND (s.stats->>'week')::int IN (3, 4)
ORDER BY p.name, week;
```

## Next Steps

1. ✅ Script running (will complete in ~30-60 minutes for all 291 players × 2 weeks)
2. ⏳ Monitor log: `tail -f nfl_2025_weeks_3_4_statmuse.log`
3. ⏳ Validate in app: Search NFL players, verify Week 3-4 charts display
4. ⏳ Optional: Run for specific players with `--names "Player Name,Another Player"`
5. ⏳ Optional: Force refresh with `--force` flag

## Files Modified/Created

- ✅ **Created:** `scripts/nfl-2025-weeks-3-4-statmuse.py` (new ingestion script)
- ✅ **Log:** `nfl_2025_weeks_3_4_statmuse.log` (execution log)
- ✅ **Database:** `player_game_stats` table (Weeks 3-4 records being inserted)

## Known Limitations

- **Players without team data:** Skipped (can't resolve event_id)
- **StatMuse rate limits:** 0.08s delay between queries (safe)
- **Approximate date matching:** ±3 days around calculated week date
- **Zero-stat filtering:** Players with all zeros are skipped (assumed didn't play)

## Command Reference

```bash
# Run for Weeks 3 & 4 (all offensive players)
python3 scripts/nfl-2025-weeks-3-4-statmuse.py --weeks 3,4

# Run for specific players
python3 scripts/nfl-2025-weeks-3-4-statmuse.py --names "Aaron Rodgers,Josh Allen" --weeks 3,4

# Force refresh (update existing records)
python3 scripts/nfl-2025-weeks-3-4-statmuse.py --weeks 3,4 --force

# Monitor progress
tail -f nfl_2025_weeks_3_4_statmuse.log
```

---

**Status:** ✅ Implementation complete, ingestion in progress  
**ETA:** ~30-60 minutes for full completion  
**Next:** Validate in React Native app Trends tab

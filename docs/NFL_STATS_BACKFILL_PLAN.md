# NFL 2025 Offensive Stats Backfill Plan

## Current Problem (October 2, 2025)

**Massive Data Gap:**
- **5,489 total NFL players** in database
- **Only 558 players have ANY stats** (10% coverage)
- **4,931 players missing ALL data** (90% have ZERO stats)

### Offensive Position Coverage (CRITICAL GAP)

| Position | Total Players | With Stats | Coverage | Missing |
|----------|---------------|------------|----------|---------|
| **QB** | 210 | 79 | 38% | 131 missing |
| **RB** | 426 | 109 | 26% | 317 missing |
| **WR** | 783 | 139 | 18% | 644 missing |
| **TE** | 363 | 86 | 24% | 277 missing |
| **K** | 92 | 31 | 34% | 61 missing |

**Total Offensive Players Missing Stats: 1,430 players**

### Current Week Coverage

| Week | Games | Players | Status |
|------|-------|---------|--------|
| Week 1 | 388 | 388 | ✅ Good coverage |
| Week 2 | 118 | 118 | ⚠️ Sparse |
| Week 3 | 89 | 89 | ⚠️ Very sparse |
| Week 4 | 89 | 89 | ⚠️ Very sparse |
| Week 5 | 0 | 0 | ❌ No data (current week) |

## Solution: Complete Backfill Script

**Created:** `scripts/nfl-2025-complete-offensive-stats.py`

### What It Does

1. **Fetches ALL offensive players** (QB, RB, WR, TE, K)
2. **Checks existing data** to avoid duplicates
3. **Queries StatMuse** for per-game stats (Weeks 1-5)
4. **Resolves event_id** from sports_events table (required for NFL)
5. **Calculates fantasy points** (standard + PPR)
6. **Inserts/updates** player_game_stats with complete data

### Data Source: StatMuse

**Position-Specific Queries:**
- **QB**: Passing yards, TDs, interceptions
- **RB**: Rushing yards, TDs, receptions
- **WR/TE**: Receptions, yards, TDs
- **K**: Field goals, extra points

### Stats Captured Per Game

```json
{
  "league": "NFL",
  "season": 2025,
  "week": 1,
  "season_type": "REG",
  "team": "KC",
  "position": "QB",
  "passing_yards": 291.0,
  "passing_touchdowns": 3.0,
  "passing_interceptions": 0.0,
  "rushing_yards": 8.0,
  "rushing_touchdowns": 0.0,
  "receptions": 0.0,
  "receiving_yards": 0.0,
  "receiving_touchdowns": 0.0,
  "fantasy_points": 31.44,
  "fantasy_points_ppr": 31.44,
  "data_source": "statmuse"
}
```

## Usage

### Test Run (5 Players, Weeks 1-4)
```bash
cd /home/reid/Desktop/parleyapp
python3 scripts/nfl-2025-complete-offensive-stats.py --limit 5 --weeks "1,2,3,4"
```

### Backfill Specific Week (All Players)
```bash
python3 scripts/nfl-2025-complete-offensive-stats.py --weeks "2"
```

### Full Backfill (All Players, Weeks 1-4)
```bash
python3 scripts/nfl-2025-complete-offensive-stats.py --weeks "1,2,3,4"
```

### Single Player Test
```bash
python3 scripts/nfl-2025-complete-offensive-stats.py --player "Patrick Mahomes" --weeks "1,2,3,4"
```

## Expected Results

### Database Impact
- **Target:** ~1,000 offensive players with team data
- **Weeks to backfill:** 1-4 (Week 5 games haven't happened yet)
- **New records:** ~4,000 game stats (1,000 players × 4 weeks)
- **Processing time:** ~2-3 hours for full backfill

### Coverage Improvement

**Before:**
- QB: 38% coverage (79/210 players)
- RB: 26% coverage (109/426 players)
- WR: 18% coverage (139/783 players)
- TE: 24% coverage (86/363 players)

**After (Expected):**
- QB: 90%+ coverage (~190/210 players)
- RB: 80%+ coverage (~340/426 players)
- WR: 70%+ coverage (~550/783 players)
- TE: 80%+ coverage (~290/363 players)

## Known Limitations

1. **Players without team data** - Skipped (can't resolve event_id)
2. **Week 5 data** - Not available yet (games on Oct 6-7, 2025)
3. **Backup/practice squad players** - May not have game logs
4. **StatMuse rate limits** - 0.1s delay between queries (safe)
5. **Injured/inactive players** - Will show "No StatMuse data"

## Monitoring

### Log File
```bash
tail -f /home/reid/Desktop/parleyapp/logs/nfl-2025-complete-stats.log
```

### Progress Updates
Script logs progress every 50 players:
- Players processed
- Inserted/Updated counts
- Skipped/Failed counts
- Elapsed time

## Verification Queries

### Check Overall Coverage
```sql
SELECT 
  p.position,
  COUNT(DISTINCT p.id) as total_players,
  COUNT(DISTINCT pgs.player_id) as players_with_stats,
  ROUND(COUNT(DISTINCT pgs.player_id)::numeric / COUNT(DISTINCT p.id) * 100, 1) as coverage_pct
FROM players p
LEFT JOIN player_game_stats pgs ON p.id = pgs.player_id 
  AND (pgs.stats->>'league') = 'NFL'
  AND (pgs.stats->>'season')::int = 2025
WHERE p.sport = 'NFL'
  AND p.position IN ('QB', 'RB', 'WR', 'TE', 'K')
GROUP BY p.position
ORDER BY coverage_pct DESC;
```

### Check Week Coverage
```sql
SELECT 
  (stats->>'week')::int as week,
  COUNT(*) as game_count,
  COUNT(DISTINCT player_id) as unique_players
FROM player_game_stats
WHERE (stats->>'league') = 'NFL'
  AND (stats->>'season')::int = 2025
GROUP BY (stats->>'week')::int
ORDER BY week;
```

### Check Specific Player
```sql
SELECT 
  p.name,
  p.position,
  (pgs.stats->>'week')::int as week,
  (pgs.stats->>'passing_yards')::numeric as pass_yds,
  (pgs.stats->>'rushing_yards')::numeric as rush_yds,
  (pgs.stats->>'receiving_yards')::numeric as rec_yds,
  (pgs.stats->>'fantasy_points')::numeric as fantasy_pts
FROM player_game_stats pgs
JOIN players p ON p.id = pgs.player_id
WHERE p.name = 'Patrick Mahomes'
  AND (pgs.stats->>'season')::int = 2025
ORDER BY (pgs.stats->>'week')::int;
```

## UI Impact

Once backfill completes, the **Trends Search Tab** will show:

1. **Complete 2025 season data** for all offensive players
2. **Week-by-week charts** (Weeks 1-4)
3. **Accurate fantasy points** for player analysis
4. **Position-specific stats** (passing, rushing, receiving)

### Example: Search "Patrick Mahomes"
- Chart will show all 4 weeks of data
- Stats: Passing yards, TDs, INTs per game
- Fantasy points calculated correctly
- Full game-by-game breakdown

## Recommended Execution Plan

### Phase 1: Test (5 minutes)
```bash
# Test with 10 players, Week 1 only
python3 scripts/nfl-2025-complete-offensive-stats.py --limit 10 --weeks "1"
```

### Phase 2: Single Week Backfill (30 minutes each)
```bash
# Backfill Week 2 (most sparse)
python3 scripts/nfl-2025-complete-offensive-stats.py --weeks "2"

# Backfill Week 3
python3 scripts/nfl-2025-complete-offensive-stats.py --weeks "3"

# Backfill Week 4
python3 scripts/nfl-2025-complete-offensive-stats.py --weeks "4"
```

### Phase 3: Full Backfill (2-3 hours)
```bash
# Backfill all weeks for all players
python3 scripts/nfl-2025-complete-offensive-stats.py --weeks "1,2,3,4"
```

## Success Criteria

✅ 4,000+ new game records inserted  
✅ 70%+ coverage for offensive positions  
✅ Weeks 1-4 have comprehensive data  
✅ Trends tab shows complete player charts  
✅ No duplicate games created  
✅ Event IDs properly resolved  

## Troubleshooting

### If StatMuse Queries Fail
- Check STATMUSE_API_URL in .env
- Verify StatMuse server is running
- Check network connectivity

### If Event ID Resolution Fails
- Verify sports_events table has NFL games
- Check team abbreviations match NFL_TEAM_MAP
- Verify week calculation logic

### If Players Skipped
- Check if player has team data in database
- Verify team abbreviation is valid
- Check if player was active in that week

---

**Status:** ✅ Script ready for production  
**Priority:** HIGH - Critical for Trends tab functionality  
**Estimated Time:** 2-3 hours for complete backfill  
**Next Step:** Run test with --limit 10, then proceed with full backfill

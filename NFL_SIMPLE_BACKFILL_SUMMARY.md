# NFL 2025 Simple Stats Backfill - RUNNING

## ✅ Solution: Simplified Approach

**Problem:** Complex event_id resolution was causing issues and most backup players don't have StatMuse data anyway.

**Solution:** Simple script that:
1. Gets offensive players WITH team data (466 players)
2. Checks existing weeks to avoid duplicates
3. Queries StatMuse for Weeks 1-4
4. Inserts stats WITHOUT event_id requirement
5. Skips players with no StatMuse data (backups/practice squad)

## 📊 Current Status

**Script Running:** `nfl-2025-simple-backfill.py --weeks "1,2,3,4"`

**Target:**
- 466 NFL offensive players with team data
- Weeks 1-4 (Week 5 hasn't happened yet)
- ~1,500-2,000 new game records expected

**Processing:**
- Checks existing data first (no duplicates)
- Only fetches missing weeks for each player
- Rate limited (0.1s between queries)
- Estimated time: 45-60 minutes

## 🎯 What Gets Inserted

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
  "fantasy_points": 31.44,
  "fantasy_points_ppr": 31.44,
  "data_source": "statmuse"
}
```

**No event_id required** - simplified for easier ingestion

## 📈 Expected Coverage Improvement

**Before:**
- Week 1: 388 games (good)
- Week 2: 118 games (sparse)
- Week 3: 89 games (very sparse)
- Week 4: 89 games (very sparse)

**After (Expected):**
- Week 1: ~400 games (improved)
- Week 2: ~350 games (major improvement)
- Week 3: ~350 games (major improvement)
- Week 4: ~350 games (major improvement)

**Total:** ~1,450 games across all weeks

## 🔍 Monitoring

### Log File
```bash
tail -f /home/reid/Desktop/parleyapp/logs/nfl-simple-backfill.log
```

### Check Progress
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
  (pgs.stats->>'fantasy_points')::numeric as fantasy_pts,
  (pgs.stats->>'passing_yards')::numeric as pass_yds,
  (pgs.stats->>'rushing_yards')::numeric as rush_yds,
  (pgs.stats->>'receiving_yards')::numeric as rec_yds
FROM player_game_stats pgs
JOIN players p ON p.id = pgs.player_id
WHERE p.name = 'Patrick Mahomes'
  AND (pgs.stats->>'season')::int = 2025
ORDER BY (pgs.stats->>'week')::int;
```

## ⚠️ What Gets Skipped

1. **Players without team data** - Can't process (no team = no games)
2. **Backup/practice squad players** - No StatMuse data (didn't play)
3. **Existing weeks** - Already have data (no duplicates)
4. **Players with no stats** - StatMuse returns nothing (inactive/injured)

This is **expected and correct** - we only want actual game stats from players who played.

## 🎮 UI Impact

Once complete, the **Trends Search Tab** will show:

1. **Complete Weeks 1-4 data** for active offensive players
2. **Week-by-week charts** with all games
3. **Accurate fantasy points** for analysis
4. **Position-specific stats** (passing, rushing, receiving, kicking)

### Example: Search "Patrick Mahomes"
- Chart shows Weeks 1-4 games
- Stats: Passing yards, TDs, INTs per game
- Fantasy points calculated correctly
- Full game-by-game breakdown

## 📋 Script Features

**Advantages:**
- ✅ No event_id complexity
- ✅ Automatic duplicate detection
- ✅ Only processes players with team data
- ✅ Skips players with no StatMuse data
- ✅ Position-specific stat extraction
- ✅ Fantasy points calculation
- ✅ Progress logging every 50 players

**Usage:**
```bash
# Full backfill (all players, all weeks)
python3 scripts/nfl-2025-simple-backfill.py --weeks "1,2,3,4"

# Test with limited players
python3 scripts/nfl-2025-simple-backfill.py --weeks "1,2,3,4" --limit 10

# Specific weeks only
python3 scripts/nfl-2025-simple-backfill.py --weeks "2,3"
```

## 🎯 Success Criteria

✅ Script completes without errors  
✅ 1,500+ new game records inserted  
✅ Weeks 2-4 have 300+ games each  
✅ Trends tab shows complete player charts  
✅ No duplicate games created  
✅ Only active players with real stats included  

---

**Status:** ✅ Running now  
**Script:** `scripts/nfl-2025-simple-backfill.py`  
**Log:** `logs/nfl-simple-backfill.log`  
**ETA:** 45-60 minutes for completion  
**Next:** Verify data in Trends tab after completion

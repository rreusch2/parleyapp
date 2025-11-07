# Quick Start: Backfill Player Stats (FREE)

## What This Does
Fetches the last 30 days of player game stats for NBA and MLB using **100% free APIs**. No credit card, no trials, just accurate data.

---

## Step 1: Install Dependencies

```powershell
cd C:\Users\reidr\parleyapp
pip install requests python-dotenv supabase
```

---

## Step 2: Verify Environment Variables

Make sure your `.env` file has:
```env
SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key_here
```

*(Your service key is already in the existing scripts, so this should be set up)*

---

## Step 3: Run the Backfill

### Option A: Backfill Everything (Recommended)
```powershell
python scripts\backfill_player_stats_balldontlie.py --sport ALL --days 30
```

### Option B: NBA Only
```powershell
python scripts\backfill_player_stats_balldontlie.py --sport NBA --days 30
```

### Option C: MLB Only
```powershell
python scripts\backfill_player_stats_balldontlie.py --sport MLB --days 30
```

---

## Step 4: Monitor Progress

The script will log to:
- **Console**: Real-time progress
- **File**: `backfill_player_stats.log`

You'll see output like:
```
2025-11-03 02:55:00 - INFO - Starting NBA stats backfill for last 30 days
2025-11-03 02:55:01 - INFO - Fetching NBA stats for 2025-10-04
2025-11-03 02:55:02 - INFO - Found 156 NBA player stats for 2025-10-04
2025-11-03 02:55:03 - INFO - Created new NBA player: LeBron James (LAL)
...
2025-11-03 03:15:00 - INFO - NBA backfill completed. Total processed: 4,680
```

---

## Step 5: Verify in Supabase

After running, check your Supabase dashboard:

1. Go to: https://supabase.com/dashboard/project/iriaegoipkjtktitpary
2. Navigate to: **Table Editor** → **player_game_stats**
3. Run this SQL to verify:

```sql
-- Check latest stats by sport
SELECT 
    p.sport,
    COUNT(*) as total_stats,
    MAX(pgs.created_at) as latest_stat
FROM player_game_stats pgs
JOIN players p ON p.id = pgs.player_id
GROUP BY p.sport
ORDER BY latest_stat DESC;

-- Check specific date range
SELECT 
    p.name,
    p.team,
    p.sport,
    pgs.stats->>'game_date' as game_date,
    pgs.stats->>'points' as points,
    pgs.stats->>'rebounds' as rebounds,
    pgs.stats->>'assists' as assists
FROM player_game_stats pgs
JOIN players p ON p.id = pgs.player_id
WHERE pgs.stats->>'game_date' >= '2025-10-04'
ORDER BY pgs.stats->>'game_date' DESC
LIMIT 100;
```

---

## Troubleshooting

### Issue: "No module named 'requests'"
**Fix:**
```powershell
pip install requests python-dotenv supabase
```

### Issue: "SUPABASE_SERVICE_ROLE_KEY not found"
**Fix:** Add to your `.env` file or check existing scripts for the key

### Issue: Rate limit errors
**Fix:** The script has built-in rate limiting (0.6s between requests). If you still hit limits:
1. Reduce `--days` to 14 or 7
2. Sign up for free BALLDONTLIE API key at https://app.balldontlie.io/signup
3. Add to `.env`: `BALLDONTLIE_API_KEY=your_key`

### Issue: Some players missing
**Fix:** This is normal - the script auto-creates players as it finds them. Re-run for earlier dates:
```powershell
python scripts\backfill_player_stats_balldontlie.py --sport ALL --days 60
```

---

## Daily Updates (Automated)

### Windows Task Scheduler
1. Open **Task Scheduler**
2. Create Basic Task
3. Name: "Backfill Player Stats Daily"
4. Trigger: Daily at 6:00 AM
5. Action: Start a program
   - Program: `python`
   - Arguments: `C:\Users\reidr\parleyapp\scripts\backfill_player_stats_balldontlie.py --sport ALL --days 2`
   - Start in: `C:\Users\reidr\parleyapp`

---

## What's Next?

After backfilling:
1. ✅ Your Trends tab will show real data
2. ✅ Hit rates will be accurate
3. ✅ Charts will display properly

To populate `event_id` for better joins:
```sql
-- Run this SQL in Supabase to link stats to events
UPDATE player_game_stats pgs
SET event_id = se.id
FROM players p, sports_events se
WHERE pgs.player_id = p.id
  AND pgs.event_id IS NULL
  AND se.local_game_date = (pgs.stats->>'game_date')::date
  AND se.sport = p.sport
  AND (se.home_team = p.team OR se.away_team = p.team);
```

---

## Free APIs Used

- **NBA**: BALLDONTLIE (https://www.balldontlie.io) - Free tier, 100 req/min
- **MLB**: MLB Stats API (https://statsapi.mlb.com) - Official, completely free

**Total Cost**: $0

No trials, no scrambled data, no credit card required. Just accurate, production-ready sports data.

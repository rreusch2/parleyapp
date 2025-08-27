# Database Optimization Execution Steps

## Step 1: Run Database Optimization SQL
**Location:** `/home/reid/Desktop/parleyapp/database/optimize-player-stats-schema.sql`

**Action Required:** Copy the SQL content and run it in your Supabase SQL Editor:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Paste the optimization SQL from the file above
4. Execute the query

**What this does:**
- ✅ Adds performance indexes for faster trend queries
- ✅ Creates automatic cleanup triggers (maintains last 15 games per player)
- ✅ Creates helpful views and functions for trend calculations
- ✅ Adds utility functions for getting trending players

## Step 2: Test Migration Script (Safe to Run)
```bash
cd /home/reid/Desktop/parleyapp
python3 scripts/migrate-mlb-to-recent-stats.py
```

## Step 3: Verify Data Migration
After migration, check your Supabase dashboard:
- `player_recent_stats` table should have MLB batting data
- Verify a few player records have proper hits, at_bats, home_runs data

## Step 4: Test Frontend Trends
- Open your app and navigate to any MLB player trends
- Verify prop buttons work correctly (active states)
- Verify chart titles update when switching props
- Check that data displays from `player_recent_stats` table

## Step 5: Schedule Daily Scripts
```bash
# Add to crontab
crontab -e

# Add these lines:
0 8 * * * /usr/bin/python3 /home/reid/Desktop/parleyapp/scripts/daily-player-stats-update.py
0 9 * * * /usr/bin/python3 /home/reid/Desktop/parleyapp/scripts/populate-initial-player-stats.py --incremental
```

## Environment Variables Required
Make sure these are set:
```bash
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export SUPABASE_URL="https://iriaegoipkjtktitpary.supabase.co"
```

## Success Criteria
- ✅ Database has optimized indexes and triggers
- ✅ MLB data migrated from player_game_stats to player_recent_stats  
- ✅ Frontend trends UI working with proper prop switching
- ✅ Daily automation scripts scheduled and running

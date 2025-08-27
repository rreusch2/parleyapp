# Team Trends Setup Guide
## Using Your Existing TheOdds API Key for Team Performance Data

### Step 1: Create Team Trends Database Tables
**Run in Supabase SQL Editor:**
```sql
-- Copy and paste from: /home/reid/Desktop/parleyapp/database/team-trends-schema.sql
```

### Step 2: Test TheOdds API Team Data Collection
```bash
cd /home/reid/Desktop/parleyapp

# Set your existing environment variables (should already be set)
export THEODDS_API_KEY="your-existing-key"  # From backend/.env
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# Initial data collection (last 3 days)
python3 scripts/theodds-team-trends-collector.py
```

### Step 3: Verify Team Data Collection
**Check in Supabase dashboard:**
- `team_recent_stats` table should have game records
- Verify teams have Win/Loss records with scores
- Check different sports (MLB, NFL, NBA, etc.)

### Step 4: Schedule Daily Automation
```bash
# Add to crontab for daily team trends updates
crontab -e

# Add this line (runs daily at 9 AM, after games are finalized)
0 9 * * * /usr/bin/python3 /home/reid/Desktop/parleyapp/scripts/daily-team-trends-cron.py daily
```

### Step 5: Integrate Enhanced Frontend
**Apply changes from:** `/home/reid/Desktop/parleyapp/frontend-team-trends-extension.tsx`
- Replace your existing TrendModal with enhanced version
- Supports both player and team searches
- Toggle between entity types
- Team-specific trend charts (W/L, ATS, O/U, etc.)

### Expected Results After Setup:
✅ **Team trends data:** Win/Loss records, ATS performance, scoring averages
✅ **Daily automation:** Accumulates 10+ games per team over time  
✅ **Unified search:** Players AND teams in same interface
✅ **Multiple trend types:** W/L, ATS covers, Over/Under, Home/Road performance
✅ **Uses existing API:** Leverages your current TheOdds API key setup

### Team Trend Types Available:
- **Wins:** Team record and winning streaks
- **ATS Covers:** Against the spread performance
- **Total Points:** Team scoring trends  
- **Over/Under:** Game total results
- **Home Performance:** Home game trends
- **Road Performance:** Away game trends

### Database Structure Created:
- `team_recent_stats` - Historical team game results
- `team_trends_data` - Performance summary view
- Automated functions for trend calculations
- Performance indexes for fast queries

### API Usage:
- **TheOdds API:** Historical game scores (perfect for team trends!)
- **Supabase:** Unified storage with existing player trends
- **Daily Growth:** System accumulates more data each day

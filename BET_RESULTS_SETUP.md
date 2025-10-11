# 🎯 Bet Result Tracking System

## Overview
Automated system to check if predictions won or lost using **real data** (no AI needed).

### Data Sources:
- **StatMuse** (your custom server) - Player prop results
- **TheOdds API** - Game scores and results
- **ESPN API** - Fallback for game scores (free)

---

## Architecture

### How It Works:

```
1. Fetch pending predictions from ai_predictions table
2. For each prediction:
   
   IF player_prop:
     → Query StatMuse: "how many passing yards did Noah Fifita have on 2025-10-11"
     → Compare actual vs line: 285 > 232.5 = WON ✅
   
   IF team bet (moneyline/spread/total):
     → Query TheOdds API or ESPN for final score
     → Apply logic: Total 55.5 UNDER + actual total 48 = WON ✅

3. Update status field: "pending" → "won" or "lost"
4. Store actual result in metadata for analytics
```

---

## Installation

### 1. Install Python Dependencies

```bash
cd /home/reid/Desktop/parleyapp
pip install requests supabase python-dotenv
```

### 2. Configure Environment Variables

Make sure your `.env` or `backend/.env` has:

```bash
# Supabase (required)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# StatMuse (required for player props)
STATMUSE_API_URL=http://localhost:5001

# TheOdds API (optional but recommended for team bets)
THEODDS_API_KEY=your_theodds_key
```

### 3. Make Scripts Executable

```bash
chmod +x check_bet_results.py
chmod +x check-results-cron.sh
```

---

## Usage

### Manual Testing

Check bets from last 24 hours:
```bash
python3 check_bet_results.py
```

Check bets from last 6 hours:
```bash
python3 check_bet_results.py --hours 6
```

Check ALL pending bets (last 30 days):
```bash
python3 check_bet_results.py --all-pending
```

### Expected Output:

```
🔍 Checking pending bets from the last 24 hours...

📊 Found 3 pending bets to check

🏃 Checking player prop: Noah Fifita OVER 232.5 Passing Yards
  ✅ WON - Noah Fifita had 285.0 (line: 232.5)

🏈 Checking team bet: Cincinnati Bearcats Moneyline
  ❌ LOST - Final: Cincinnati Bearcats 24 - 31 UCF Knights

🏈 Checking team bet: Total Under 55.5
  ✅ WON - Final: SMU Mustangs 28 - 20 Stanford Cardinal

============================================================
📊 BET CHECKING SUMMARY
============================================================
✅ Won:     2
❌ Lost:    1
📈 Total:   3
⚠️  Errors:  0
🎯 Win Rate: 66.7%
============================================================
```

---

## Automated Setup (Cron Job)

### Option 1: Run Every Hour

```bash
# Edit crontab
crontab -e

# Add this line (checks every hour for games from last 6 hours)
0 * * * * /home/reid/Desktop/parleyapp/check-results-cron.sh
```

### Option 2: Run Every 3 Hours

```bash
# Checks every 3 hours at :00 minutes
0 */3 * * * /home/reid/Desktop/parleyapp/check-results-cron.sh
```

### Option 3: Run Daily at 2 AM

```bash
# Perfect for checking previous day's results
0 2 * * * /home/reid/Desktop/parleyapp/check-results-cron.sh
```

### View Logs

```bash
# Today's log
tail -f logs/bet_results_$(date +%Y%m%d).log

# All logs
ls -lah logs/bet_results_*.log
```

---

## How Results Are Stored

### Database Updates:

1. **Status field** updated: `pending` → `won` or `lost`

2. **Metadata enriched** with actual results:

**Player Props:**
```json
{
  "player_name": "Noah Fifita",
  "line": 232.5,
  "recommendation": "OVER",
  "actual_value": 285.0  // ← Added by checker
}
```

**Team Bets:**
```json
{
  "recommendation": "home",
  "line": -405,
  "result": {  // ← Added by checker
    "home_team": "Cincinnati Bearcats",
    "away_team": "UCF Knights",
    "home_score": 24,
    "away_score": 31,
    "completed": true
  }
}
```

---

## Logic Examples

### Player Prop Logic:

```python
# OVER bet
actual_value = 285  # from StatMuse
line = 232.5
recommendation = "OVER"

won = actual_value > line  # 285 > 232.5 = True ✅

# UNDER bet
actual_value = 198
line = 232.5
recommendation = "UNDER"

won = actual_value < line  # 198 < 232.5 = True ✅
```

### Team Bet Logic:

```python
# Moneyline
home_score = 24
away_score = 31
recommendation = "home"

won = home_score > away_score  # 24 > 31 = False ❌

# Spread (-7.5 for home team)
home_score = 28
away_score = 24
line = -7.5

won = (home_score + line) > away_score  # (28 - 7.5) > 24 = False ❌

# Total UNDER 55.5
home_score = 28
away_score = 20
line = 55.5
total = home_score + away_score  # 48

won = total < line  # 48 < 55.5 = True ✅
```

---

## Analytics Queries

### Check Win Rate by Sport:

```sql
SELECT 
  sport,
  COUNT(*) FILTER (WHERE status = 'won') as wins,
  COUNT(*) FILTER (WHERE status = 'lost') as losses,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'won')::numeric / 
    COUNT(*) * 100, 
    2
  ) as win_rate_pct
FROM ai_predictions
WHERE status IN ('won', 'lost')
GROUP BY sport
ORDER BY win_rate_pct DESC;
```

### Check Win Rate by Bet Type:

```sql
SELECT 
  bet_type,
  COUNT(*) FILTER (WHERE status = 'won') as wins,
  COUNT(*) FILTER (WHERE status = 'lost') as losses,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'won')::numeric / 
    COUNT(*) * 100, 
    2
  ) as win_rate_pct
FROM ai_predictions
WHERE status IN ('won', 'lost')
GROUP BY bet_type;
```

### Check ROI:

```sql
SELECT 
  AVG(CASE 
    WHEN status = 'won' THEN 
      CASE 
        WHEN odds LIKE '+%' THEN (CAST(REPLACE(odds, '+', '') AS INT) / 100.0)
        WHEN odds LIKE '-%' THEN (100.0 / CAST(REPLACE(odds, '-', '') AS INT))
      END
    WHEN status = 'lost' THEN -1.0
  END) as roi
FROM ai_predictions
WHERE status IN ('won', 'lost');
```

---

## Troubleshooting

### Issue: "Could not fetch result - game may not be finished"

**Cause:** Game is still in progress or data not available yet  
**Solution:** Run checker again later (cron will catch it next hour)

### Issue: StatMuse not responding

**Cause:** StatMuse server not running  
**Solution:** 
```bash
cd /home/reid/Desktop/parleyapp
python statmuse_api_server.py
```

### Issue: No games found

**Cause:** Time zone mismatch or games too old  
**Solution:** Increase `--hours` parameter or check `event_time` in database

---

## Integration with Daily Automation

Add to your existing `daily-automation-new.sh`:

```bash
# Step 7: Check yesterday's results (runs at 6 AM)
echo "📊 Checking bet results from yesterday..."
python3 check_bet_results.py --hours 24
```

---

## Why No AI Needed?

✅ **StatMuse returns exact numbers**: "Noah Fifita had 285 passing yards"  
✅ **Game scores are deterministic**: Final score is final score  
✅ **Simple comparison logic**: 285 > 232.5 = true  
✅ **Faster & more reliable**: Direct data > AI interpretation  
✅ **Zero hallucination risk**: Real data from APIs  

**AI would be overkill and less accurate.**

---

## Future Enhancements

- [ ] Add push notifications for won bets
- [ ] Track betting units and profit/loss
- [ ] Add confidence score correlation analysis
- [ ] Export results to CSV for external analysis
- [ ] Add Telegram/Discord bot for result notifications

---

## Support

If you see errors, check:
1. StatMuse server is running (`http://localhost:5001/health`)
2. Environment variables are set correctly
3. Supabase connection is working
4. TheOdds API key is valid (if using)

Logs are stored in `/home/reid/Desktop/parleyapp/logs/`

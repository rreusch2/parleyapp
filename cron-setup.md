# ParleyApp Daily Automation Cron Setup Guide

## Overview
This guide sets up automated daily execution of your MLB prediction pipeline with proper dependency ordering and error handling.

## Scripts Execution Order
1. **Daily Insights** (`python insights.py`) - MUST RUN FIRST ⚡
2. **Odds Integration** (`setupOddsIntegration.ts`) 
3. **Team Predictions** (`run-orchestrator.ts`)
4. **Player Props** (`python props.py`)

## Railway Cron Setup (Recommended)

### Step 1: Deploy Cron Service to Railway

1. **Create New Railway Service:**
   ```bash
   railway login
   railway init
   railway up
   ```

2. **Configure Environment Variables in Railway Dashboard:**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` 
   - `XAI_API_KEY`
   - `THEODDS_API_KEY`
   - Any other environment variables your scripts need

3. **Set up Railway Cron:**
   - Go to Railway Dashboard → Your Project → Cron Tab
   - Add new cron job with schedule: `0 6 * * *` (6 AM EST daily)
   - Target: `railway-cron.js` handler function
   - Description: "ParleyApp Daily MLB Predictions"

### Step 2: Optimal Cron Schedule

**Recommended Time: 6:00 AM EST (11:00 UTC)**
- Runs before most MLB games start (typically 1 PM EST earliest)
- Allows time for odds to stabilize overnight
- Gives buffer time if script needs debugging

**Cron Expression:**
```bash
# Daily at 6:00 AM EST
0 6 * * *
```

**Alternative Schedules:**
```bash
# Early morning at 5:30 AM EST (more conservative)
30 5 * * *

# Twice daily: 6 AM and 10 AM EST (backup run)
0 6,10 * * *
```

## Local Cron Setup (Alternative)

### Option 1: Add to User Crontab
```bash
# Edit crontab
crontab -e

# Add this line (6 AM daily):
0 6 * * * /home/reid/Desktop/parleyapp/daily-automation.sh

# Verify crontab
crontab -l
```

### Option 2: System Cron
```bash
# Create system cron file
sudo nano /etc/cron.d/parleyapp-daily

# Add content:
0 6 * * * reid /home/reid/Desktop/parleyapp/daily-automation.sh

# Set permissions
sudo chmod 644 /etc/cron.d/parleyapp-daily
```

## Testing Your Setup

### Test Local Script
```bash
cd /home/reid/Desktop/parleyapp
./daily-automation.sh
```

### Test Railway Cron Function
```bash
node railway-cron.js
```

### Verify Logs
```bash
# Check recent log file
tail -f logs/daily-automation-$(date +%Y%m%d).log

# Check all recent logs
ls -la logs/
```

## Monitoring & Alerts

### Log Retention
- Logs kept for 30 days automatically
- Located in: `/home/reid/Desktop/parleyapp/logs/`
- Format: `daily-automation-YYYYMMDD.log`

### Success Indicators
- ✅ All 4 steps complete without errors
- ✅ New records in `ai_predictions` table
- ✅ Log shows "Daily automation completed successfully"

### Failure Alerts
- Script exits immediately on first error
- Detailed error logging with timestamps
- Check Supabase dashboard for missing prediction records

## Production Recommendations

1. **Use Railway Cron** - More reliable than local cron
2. **Set up monitoring** - Create alerts for failed runs
3. **Database backups** - Before running daily scripts
4. **Staging environment** - Test changes before production

## Troubleshooting

### Common Issues
- **Permission denied**: `chmod +x daily-automation.sh`
- **Node modules**: Ensure `npm install` in backend directory
- **Python dependencies**: Check virtual environment activation
- **Environment variables**: Verify all API keys are set

### Manual Recovery
If automation fails, run steps manually:
```bash
cd /home/reid/Desktop/parleyapp
python insights.py
cd backend && npx ts-node src/scripts/setupOddsIntegration.ts
npx ts-node src/scripts/run-orchestrator.ts
cd .. && python props.py
```

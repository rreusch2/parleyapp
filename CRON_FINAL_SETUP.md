# 🎯 ParleyApp Daily Automation - Final Setup Guide

## ✅ What's Been Created

1. **`daily-automation.sh`** - Master script that runs all 4 prediction pipelines in correct order
2. **`railway-cron.js`** - Railway-compatible cron handler with proper error handling  
3. **`railway.json`** - Railway deployment configuration
4. **`cron-setup.md`** - Comprehensive setup instructions

## 🔥 Optimal Cron Schedule

**Best Schedule: 6:00 AM EST Daily**
- Runs before MLB games start (typically 1 PM EST earliest)
- Allows overnight odds stabilization
- Provides debugging buffer time

```bash
# Cron expression
0 6 * * *
```

## 📋 Execution Order (Critical!)

1. **`npx ts-node src/scripts/setupOddsIntegration.ts`** ⚡ **MUST RUN FIRST** - Fetches daily games/odds (base data)
2. **`python insights.py`** - Generate daily insights (depends on fresh game data)
3. **`npx ts-node src/scripts/run-orchestrator.ts`** - Generate 10 team picks (needs odds data)
4. **`python props.py`** - Generate 10 player props picks (needs props data)

## 🚀 Railway Deployment Steps

### Step 1: Create New Railway Cron Service
```bash
# From project root
railway login
railway init
railway up
```

### Step 2: Configure Environment Variables
Add these to Railway Dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `XAI_API_KEY` 
- `THEODDS_API_KEY`
- All other environment variables your scripts need

### Step 3: Set Up Railway Cron Job
1. Go to Railway Dashboard → Your Project → Cron Tab
2. Click "Add Cron Job"
3. **Schedule**: `0 6 * * *` (6 AM EST daily)
4. **Command**: Point to `railway-cron.js` handler
5. **Description**: "ParleyApp Daily MLB Predictions"
6. **Timeout**: 30 minutes (scripts can take time)

## 📊 What Happens When Cron Runs

```bash
[06:00:00] Starting ParleyApp Daily Automation...
[06:00:01] Step 1/4: Fetching daily games and odds...
[06:02:15] ✅ Daily odds integration completed successfully
[06:02:16] Step 2/4: Running Daily Insights...
[06:04:30] ✅ Daily insights completed successfully  
[06:04:31] Step 3/4: Generating team predictions...
[06:06:45] ✅ Team predictions completed successfully
[06:06:46] Step 4/4: Generating player props predictions...
[06:09:12] ✅ Player props predictions completed successfully
[06:09:13] === ParleyApp Daily Automation Completed Successfully ===
```

## 🎯 Expected Results

After successful run, check:
- **Supabase `ai_predictions` table** - Should have ~20 new records (10 team + 10 props)
- **Log file** - `logs/daily-automation-YYYYMMDD.log` with success messages
- **Railway Dashboard** - Cron job shows "Success" status

## 🔧 Local Testing

Test everything locally first:
```bash
# Test the master script
cd /home/reid/Desktop/parleyapp
./daily-automation.sh

# Test Railway handler
node railway-cron.js
```

## 🚨 Failure Handling

- Script **exits immediately** on first error
- Detailed logging with timestamps  
- Check logs for specific failure point
- Manual recovery instructions in `cron-setup.md`

## 💡 Pro Tips

1. **Run Railway Cron** - More reliable than local cron
2. **Monitor logs daily** - Check for any script failures
3. **Backup before runs** - Supabase daily snapshots
4. **Test changes staging** - Don't modify production scripts directly

## 🎉 You're Ready!

Your ParleyApp daily automation is production-ready with:
- ✅ Proper dependency ordering (insights → odds → team picks → props)
- ✅ Comprehensive error handling and logging
- ✅ Railway cloud deployment
- ✅ Automated daily execution at optimal time
- ✅ 20 daily AI predictions (10 team + 10 player props)

**Next**: Deploy to Railway and monitor your first automated run!

# 🎯 ParleyApp Daily Automation Setup Guide

## 🚀 Quick Setup (2 minutes)

Run these commands to set up your daily automation:

```bash
# 1. Make setup script executable
chmod +x setup-daily-automation.sh

# 2. Run the setup (this will also test the automation)
./setup-daily-automation.sh
```

**That's it!** Your automation will now run every day at **10:30 PM**.

## 📋 What Gets Automated

Your daily automation runs these scripts in **exact order**:

1. **StatMuse API Check** - Ensures `statmuse_api_server.py` is running
2. **Odds Fetching** - `npm run odds` in backend directory  
3. **Props Predictions** - `python props_enhanced.py --tomorrow`
4. **Teams Predictions** - `python teams_enhanced.py --tomorrow`
5. **Enhanced Insights** - `python enhanced_insights.py --tomorrow`
6. **Injury Updates** - `npx ts-node src/scripts/dailyInjuryUpdate.ts`

## ⏰ Schedule Details

- **Time**: 10:30 PM daily (perfect for next day's games)
- **Cron Expression**: `30 22 * * *`
- **Logs**: Saved to `logs/daily-automation-YYYY-MM-DD.log`

## 🔍 Monitoring Your Automation

### Quick Status Check
```bash
./monitor-automation.sh
```

### View Today's Log
```bash
tail -f logs/daily-automation-$(date +%Y-%m-%d).log
```

### Check If Cron is Active
```bash
crontab -l | grep daily-automation
```

## 🎯 Expected Results

After each successful run (10:30 PM), you should see:

✅ **Supabase `ai_predictions` table** - New prediction records  
✅ **Supabase `sports_events` table** - Updated games and odds  
✅ **Log file** - Success messages for all 6 steps  
✅ **StatMuse server** - Running and ready for queries  

## 🚨 Troubleshooting

### If Automation Fails

1. **Check the log file**:
   ```bash
   cat logs/daily-automation-$(date +%Y-%m-%d).log
   ```

2. **Test manually**:
   ```bash
   ./daily-automation-new.sh
   ```

3. **Check cron job**:
   ```bash
   crontab -l
   ```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Permission denied" | `chmod +x daily-automation-new.sh` |
| "StatMuse server won't start" | Check if port is already in use |
| "npm run odds fails" | Verify backend dependencies: `cd backend && npm install` |
| "Python scripts fail" | Check Python environment and dependencies |

## 🔧 Manual Control

### Disable Automation
```bash
crontab -e
# Comment out or delete the automation line
```

### Run Automation Now
```bash
./daily-automation-new.sh
```

### View All Logs
```bash
ls -la logs/daily-automation-*.log
```

## 📊 Success Metrics

After automation runs, verify:

1. **No errors in log file**
2. **All 6 steps completed successfully**  
3. **New predictions in Supabase**
4. **StatMuse server still running**

## 🎉 You're All Set!

Your ParleyApp daily automation is now:

✅ **Autonomous** - Runs every night at 10:30 PM  
✅ **Reliable** - Comprehensive error handling  
✅ **Monitored** - Detailed logging for debugging  
✅ **Tested** - Dry run completed during setup  

**Next day**: Check your Supabase dashboard to see fresh AI predictions!

---

## 📞 Need Help?

- **Monitor**: `./monitor-automation.sh`
- **Logs**: `logs/daily-automation-YYYY-MM-DD.log`  
- **Manual run**: `./daily-automation-new.sh`
- **Disable**: `crontab -e`
# 🎯 ParleyApp Automated Daily Predictions

**Your complete solution for hands-free, cloud-based sports betting predictions.**

Never manually run scripts again. Wake up every morning to fresh predictions for all your sports.

---

## 🚀 What's Been Set Up

A complete automation system that runs daily at **10:00 PM EST** and:

1. ✅ Starts StatMuse API server
2. ✅ Fetches odds from TheOdds API (`npm run odds:v2`)
3. ✅ Generates team predictions for: **NBA, NFL, CFB, NHL, MLB, WNBA**
4. ✅ Generates prop predictions for: **NBA, NFL, CFB, NHL, MLB, WNBA**
5. ✅ Saves everything to Supabase
6. ✅ Logs all activity for monitoring

**Total automation time:** ~45-90 minutes per day (runs in the cloud while you sleep)

---

## 📁 Files Created

### Core Automation
- **`daily-automation-complete.sh`** - Main orchestration script (runs all sports)
- **`.github/workflows/daily-predictions.yml`** - GitHub Actions workflow (cloud automation)
- **`railway-cron.js`** - Railway cron service (backup option)
- **`check-automation-health.sh`** - Health check script

### Documentation
- **`QUICK_START_AUTOMATION.md`** - 5-minute setup guide ⭐ **START HERE**
- **`AUTOMATION_SETUP.md`** - Complete reference documentation
- **`README_AUTOMATION.md`** - This file (overview)

### Configuration
- **`railway.toml`** - Updated with cron service
- **`.github/workflows/`** - GitHub Actions configuration

---

## ⚡ Quick Start (5 Minutes)

Want to get started right now? Follow these 3 steps:

### 1️⃣ Add GitHub Secrets

Go to: `https://github.com/YOUR_USERNAME/parleyapp/settings/secrets/actions`

Add these secrets:
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
THEODDSAPI_KEY
STATMUSE_API_URL
ACTIVE_SPORTS
ENABLE_NHL_DATA
```

### 2️⃣ Push to GitHub

```bash
git add .
git commit -m "Add automated daily predictions"
git push
```

### 3️⃣ Test It

1. Go to GitHub → **Actions** tab
2. Click **"Daily Sports Predictions Automation"**
3. Click **"Run workflow"** → **"Run workflow"**
4. Watch it run! 🎉

**Full instructions:** See [QUICK_START_AUTOMATION.md](./QUICK_START_AUTOMATION.md)

---

## 🎯 Automation Options

You have **3 options** to run your automation:

### Option 1: GitHub Actions (RECOMMENDED) ⭐

**Best for:** Everyone

**Pros:**
- ✅ 100% free (2,000 minutes/month)
- ✅ Runs in the cloud (no laptop needed)
- ✅ Easy to set up and monitor
- ✅ Built-in logs and notifications
- ✅ Most reliable

**Setup:** [AUTOMATION_SETUP.md#option-1](./AUTOMATION_SETUP.md#-option-1-github-actions-recommended)

---

### Option 2: Railway Cron Service

**Best for:** Backup or if GitHub Actions has issues

**Pros:**
- ✅ Runs in the cloud
- ✅ More control over environment
- ✅ Can integrate with existing Railway services
- ✅ Real-time logs

**Cons:**
- ⚠️ May have costs (check Railway pricing)

**Setup:** [AUTOMATION_SETUP.md#option-2](./AUTOMATION_SETUP.md#-option-2-railway-cron-service-backup)

---

### Option 3: Local Mac (NOT RECOMMENDED)

**Best for:** Testing only

**Pros:**
- ✅ Full control
- ✅ No cloud dependency

**Cons:**
- ❌ Mac must be on and awake at 10 PM daily
- ❌ Stops if you close laptop lid
- ❌ No cloud monitoring
- ❌ Manual recovery if it fails

**Setup:** [AUTOMATION_SETUP.md#option-3](./AUTOMATION_SETUP.md#-option-3-local-mac-not-recommended)

---

## 📊 Monitoring

### GitHub Actions (Recommended)

1. Go to: `https://github.com/YOUR_USERNAME/parleyapp/actions`
2. Click on any workflow run to see logs
3. Green checkmark = success ✅
4. Red X = failed ❌ (click to see why)

### Railway

1. Go to Railway Dashboard
2. Click your project → "cron" service
3. View real-time logs

### Local

```bash
# View today's log
tail -f logs/daily-automation-$(date +%Y-%m-%d).log

# Check health
./check-automation-health.sh
```

---

## 🔧 Manual Operations

### Run Automation Manually

**GitHub Actions:**
- Actions tab → Run workflow → Run workflow

**Railway:**
```bash
curl https://your-cron-service.railway.app/run
```

**Local:**
```bash
./daily-automation-complete.sh
```

### Run Individual Sports

```bash
# Single sport team picks
python teams_enhanced.py --tomorrow --sport NBA

# Single sport prop picks
python props_intelligent_v3.py --sport NFL --tomorrow

# Just fetch odds
cd apps/backend && npm run odds:v2
```

### Test Your Setup

```bash
# Check if everything is configured correctly
./check-automation-health.sh
```

---

## 🆘 Common Issues & Fixes

### Issue: GitHub Actions fails on first run

**Fix:**
1. Check all secrets are added correctly
2. Make script executable: `git update-index --chmod=+x daily-automation-complete.sh`
3. Push changes and try again

### Issue: No predictions appearing in database

**Fix:**
1. Check workflow logs for errors
2. Verify Supabase credentials
3. Ensure games exist for tomorrow
4. Test individual scripts locally

### Issue: Script times out

**Fix:**
1. Increase timeout in workflow file
2. Split sports into separate workflows
3. Run at off-peak API times

### Issue: API rate limits

**Fix:**
1. Check TheOdds API quota
2. Add delays between sports
3. Stagger execution times

**Full troubleshooting:** [AUTOMATION_SETUP.md#troubleshooting](./AUTOMATION_SETUP.md#-monitoring--troubleshooting)

---

## 📈 What Runs When

### Daily Schedule (10:00 PM EST)

```
10:00 PM - Automation starts
10:00 PM - StatMuse API server starts (if needed)
10:02 PM - Fetch odds data (all sports)
10:15 PM - Generate team picks (all 6 sports)
10:40 PM - Generate prop picks (all 6 sports)
11:30 PM - Automation complete ✅
```

**Duration:** ~45-90 minutes total

### Sports Processed

For both team and prop predictions:
- 🏀 NBA
- 🏈 NFL  
- 🏫 CFB (College Football)
- 🏒 NHL
- ⚾ MLB
- 🏀 WNBA

---

## 🎁 Bonus Features

### Health Monitoring

```bash
./check-automation-health.sh
```

Checks:
- ✅ StatMuse API status
- ✅ Python dependencies
- ✅ Node.js dependencies
- ✅ Environment variables
- ✅ Recent logs
- ✅ Database connectivity
- ✅ Configuration files

### Log Management

- Logs are kept for 14 days
- Old logs are automatically cleaned up
- Download logs from GitHub Actions artifacts

### Manual Trigger

Run predictions anytime (not just 10 PM):
- GitHub: Actions tab → Run workflow
- Railway: Visit `/run` endpoint
- Local: `./daily-automation-complete.sh`

---

## 📚 Documentation Index

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **QUICK_START_AUTOMATION.md** | Get started in 5 minutes | First time setup |
| **AUTOMATION_SETUP.md** | Complete reference guide | Detailed setup, troubleshooting |
| **README_AUTOMATION.md** | Overview (this file) | Understanding what's available |

---

## ✅ Success Checklist

After setup, verify:

- [ ] GitHub secrets configured
- [ ] Workflow pushed to repository
- [ ] Manual test run completed successfully
- [ ] All sports processed (check logs)
- [ ] Predictions visible in Supabase
- [ ] Scheduled run time confirmed (10 PM EST)
- [ ] Monitoring dashboard bookmarked
- [ ] Health check script tested

---

## 🎯 Next Steps

1. **NOW:** Follow [QUICK_START_AUTOMATION.md](./QUICK_START_AUTOMATION.md) (5 minutes)
2. **Today:** Run manual test to verify everything works
3. **Tonight:** Let scheduled run happen automatically
4. **Tomorrow morning:** Check results in Supabase ✨
5. **This week:** Monitor daily to ensure consistency
6. **Next week:** Sit back and enjoy automated predictions! 🏆

---

## 💡 Pro Tips

1. **Bookmark** your GitHub Actions page for quick access
2. **Enable** email notifications for workflow failures
3. **Check logs** first thing in the morning initially
4. **Test changes** with manual runs before scheduled ones
5. **Keep secrets updated** if you rotate API keys
6. **Monitor API quotas** to avoid rate limiting
7. **Run health checks** weekly

---

## 📞 Need Help?

1. **Quick issues:** Check [AUTOMATION_SETUP.md#troubleshooting](./AUTOMATION_SETUP.md#-monitoring--troubleshooting)
2. **Health check:** Run `./check-automation-health.sh`
3. **Logs:** Check GitHub Actions or Railway dashboard
4. **Test locally:** Run scripts individually to isolate issues

---

## 🎉 Summary

You now have a **complete, production-ready automation system** that:

✅ Runs in the cloud (no local computer needed)
✅ Executes daily at 10 PM EST automatically
✅ Processes all 6 major sports
✅ Generates both team and prop predictions
✅ Includes monitoring and health checks
✅ Has multiple deployment options (GitHub, Railway, local)
✅ Is well-documented and maintainable

**Go to [QUICK_START_AUTOMATION.md](./QUICK_START_AUTOMATION.md) to get started now!** 🚀

---

*Last updated: $(date)*
*Questions? Check the documentation or run the health check script.*

# 🤖 ParleyApp Daily Automation Setup

Complete guide for setting up **100% automated, cloud-based** daily predictions that run without your laptop.

## 📋 Overview

Your daily workflow automated:
1. ✅ Start StatMuse API Server
2. ✅ Fetch odds data (`npm run odds:v2`)
3. ✅ Generate team picks for all sports (NBA, NFL, CFB, NHL, MLB, WNBA)
4. ✅ Generate prop picks for all sports

**Schedule**: Daily at 10:00 PM EST (for next day's games)

---

## 🎯 Option 1: GitHub Actions (RECOMMENDED)

**Why this is best:**
- ✅ **100% Free** (2,000 minutes/month free tier)
- ✅ **Runs in the cloud** - no local computer needed
- ✅ **Reliable** - GitHub's infrastructure
- ✅ **Easy to monitor** - built-in logs and notifications
- ✅ **Version controlled** - automation config in git

### Setup Steps

#### 1. Add Secrets to GitHub

Go to your repository: `https://github.com/YOUR_USERNAME/parleyapp/settings/secrets/actions`

Click **"New repository secret"** and add each of these:

| Secret Name | Value | Where to Find |
|------------|-------|---------------|
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Supabase Dashboard → Settings → API |
| `OPENAI_API_KEY` | Your OpenAI API key | OpenAI Dashboard → API Keys |
| `THEODDSAPI_KEY` | Your TheOdds API key | TheOdds Dashboard |
| `STATMUSE_API_URL` | Your StatMuse API URL | Usually `http://localhost:5000` or deployed URL |
| `ACTIVE_SPORTS` | Sports to run | `MLB,WNBA,NFL,CFB,NBA,NHL,UFC` |
| `ENABLE_NHL_DATA` | Enable NHL | `true` |

#### 2. Push the Workflow to GitHub

```bash
cd /Users/rreusch2/parleyapp
git add .github/workflows/daily-predictions.yml
git commit -m "Add GitHub Actions automation"
git push
```

#### 3. Verify Setup

1. Go to `https://github.com/YOUR_USERNAME/parleyapp/actions`
2. Click on "Daily Sports Predictions Automation"
3. You should see the workflow listed
4. Click **"Run workflow"** → **"Run workflow"** to test it immediately

#### 4. Monitor Runs

- **View logs**: Go to Actions tab → Click on any run → View each step
- **Download logs**: Each run saves logs as artifacts (kept for 14 days)
- **Get notifications**: GitHub will email you if a workflow fails

### Manual Trigger

You can manually trigger the workflow anytime:
1. Go to Actions tab
2. Click "Daily Sports Predictions Automation"
3. Click "Run workflow"
4. Optionally specify which sports to run

---

## 🚂 Option 2: Railway Cron Service (BACKUP)

**Use this if:**
- GitHub Actions has issues
- You want more control over the execution environment
- You need faster execution times

### Setup Steps

#### 1. Update Railway Configuration

Edit `railway.toml` and add the cron service:

```toml
[[services]]
name = "cron"
[services.build]
builder = "nixpacks"
[services.build.nixpacks]
installPhase = "npm install && pip install -r requirements.txt"
aptPkgs = ["python3", "python3-pip", "nodejs", "npm"]
[services.deploy]
startCommand = "node railway-cron.js"
healthcheckPath = "/health"
```

#### 2. Deploy to Railway

```bash
# Login to Railway (if not already)
railway login

# Link to your project
railway link

# Deploy the cron service
railway up
```

#### 3. Monitor

- Railway Dashboard → Your Project → "cron" service → Logs
- Health check: `https://your-cron-service.railway.app/health`
- Manual trigger: `https://your-cron-service.railway.app/run`

---

## 🖥️ Option 3: Local Mac (NOT RECOMMENDED)

If you absolutely must run locally, use `launchd` instead of cron:

### Setup Local Automation

1. **Make script executable:**
```bash
chmod +x daily-automation-complete.sh
```

2. **Create LaunchAgent:**
```bash
mkdir -p ~/Library/LaunchAgents

cat > ~/Library/LaunchAgents/com.parleyapp.daily.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.parleyapp.daily</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/rreusch2/parleyapp/daily-automation-complete.sh</string>
    </array>
    
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>22</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/Users/rreusch2/parleyapp/logs/launchd-stdout.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/rreusch2/parleyapp/logs/launchd-stderr.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>PROJECT_ROOT</key>
        <string>/Users/rreusch2/parleyapp</string>
    </dict>
</dict>
</plist>
EOF
```

3. **Load the LaunchAgent:**
```bash
launchctl load ~/Library/LaunchAgents/com.parleyapp.daily.plist
```

4. **Test it:**
```bash
launchctl start com.parleyapp.daily
```

5. **Check status:**
```bash
launchctl list | grep parleyapp
```

⚠️ **Limitations:**
- Your Mac must be **on and awake** at 10 PM daily
- No automatic retries if it fails
- Will pause if you close your laptop lid
- No cloud-based logs or monitoring

---

## 📊 Monitoring & Troubleshooting

### Check if it's Running

**GitHub Actions:**
```
Go to: https://github.com/YOUR_USERNAME/parleyapp/actions
```

**Railway:**
```
Go to: Railway Dashboard → Your Project → "cron" service → Logs
```

**Local Mac:**
```bash
# Check LaunchAgent status
launchctl list | grep parleyapp

# View logs
tail -f ~/Users/rreusch2/parleyapp/logs/daily-automation-*.log
```

### Common Issues

#### Issue: GitHub Actions fails with "permission denied"

**Solution:** Make sure the shell script is executable:
```bash
git update-index --chmod=+x daily-automation-complete.sh
git commit -m "Make script executable"
git push
```

#### Issue: Python/Node dependencies missing

**Solution:** Update the workflow file to install missing packages in the install steps.

#### Issue: StatMuse API not responding

**Solution:** 
1. Check if your StatMuse service is deployed on Railway
2. Update `STATMUSE_API_URL` secret to the deployed URL
3. Or remove StatMuse dependency if not needed

#### Issue: Rate limiting from TheOdds API

**Solution:**
1. Check your API quota at TheOdds dashboard
2. Consider splitting the workflow to run at different times
3. Add delays between API calls

### View Logs

**GitHub Actions:**
- Actions tab → Click workflow run → View logs
- Download artifacts to get log files

**Railway:**
- Dashboard → Service → Logs tab
- Real-time streaming available

**Local:**
```bash
# View today's log
cat logs/daily-automation-$(date +%Y-%m-%d).log

# Follow live
tail -f logs/daily-automation-$(date +%Y-%m-%d).log
```

---

## 🎯 Testing the Setup

### Test Individual Components

```bash
# Test StatMuse server
python statmuse_api_server.py
# Then visit: http://localhost:5000/health

# Test odds fetch
cd apps/backend
npm run odds:v2

# Test single sport team picks
python teams_enhanced.py --tomorrow --sport NBA

# Test single sport prop picks
python props_intelligent_v3.py --sport NFL --tomorrow
```

### Test Full Automation

```bash
# Local test
./daily-automation-complete.sh

# GitHub Actions test
# Go to Actions tab → Run workflow → Run workflow

# Railway test
curl https://your-cron-service.railway.app/run
```

---

## ⚙️ Customization

### Change Run Time

**GitHub Actions:**
Edit `.github/workflows/daily-predictions.yml`:
```yaml
schedule:
  # Change to 9:00 PM EST (2:00 AM UTC)
  - cron: '0 2 * * *'
```

**Railway:**
Edit `railway-cron.js`:
```javascript
// Change to 9:00 PM EST (2:00 AM UTC)
cron.schedule('0 2 * * *', async () => {
  // ...
});
```

### Add/Remove Sports

**GitHub Actions:**
Edit the workflow file and add/remove sport steps.

**Railway/Local:**
Edit the script and update the `ACTIVE_SPORTS` array:
```bash
ACTIVE_SPORTS=("NBA" "NFL" "CFB" "NHL" "MLB" "WNBA" "UFC")
```

### Add Notifications

You can add Slack, Discord, or email notifications by adding steps to the GitHub Actions workflow or Railway cron service.

Example for Slack:
```yaml
- name: 📧 Send Slack Notification
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 🚀 Recommended Setup

**For best results:**

1. ✅ **Primary**: Use GitHub Actions (free, reliable, easy)
2. ✅ **Backup**: Deploy Railway cron service (if GitHub has issues)
3. ✅ **Monitor**: Check Actions tab daily for first week
4. ✅ **Test**: Run manual trigger before first scheduled run

**Next Steps:**

1. Follow "Option 1: GitHub Actions" setup above
2. Test with manual trigger
3. Let it run automatically for a week
4. Check logs daily to ensure everything works
5. Set up backup Railway cron if needed

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. View the logs for detailed error messages
3. Verify all secrets are configured correctly
4. Test individual components separately

---

## ✅ Success Checklist

- [ ] GitHub secrets configured
- [ ] Workflow file pushed to repository
- [ ] Manual test run successful
- [ ] Logs show all sports processed
- [ ] Supabase tables updated with predictions
- [ ] Scheduled run verified
- [ ] Backup option configured (optional)
- [ ] Monitoring dashboard bookmarked

---

**That's it!** Your daily predictions will now run automatically in the cloud, every day at 10 PM EST, without you having to do anything. 🎉

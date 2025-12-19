# 🚀 Quick Start: 5-Minute Setup

Get your daily predictions running automatically in the cloud in just 5 minutes.

## ✅ Prerequisites

- [ ] GitHub account (free)
- [ ] Your repo pushed to GitHub
- [ ] Supabase credentials ready
- [ ] OpenAI API key ready
- [ ] TheOdds API key ready

---

## 🎯 Step 1: Add GitHub Secrets (2 minutes)

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** for each:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key-here
OPENAI_API_KEY=sk-your-key-here
THEODDSAPI_KEY=your-theodds-key
STATMUSE_API_URL=http://localhost:5000
ACTIVE_SPORTS=MLB,WNBA,NFL,CFB,NBA,NHL,UFC
ENABLE_NHL_DATA=true
```

---

## 🎯 Step 2: Push Workflow to GitHub (1 minute)

```bash
cd /Users/rreusch2/parleyapp

# Add and commit the workflow
git add .github/workflows/daily-predictions.yml
git add daily-automation-complete.sh
git add railway-cron.js
git add AUTOMATION_SETUP.md

git commit -m "Add automated daily predictions workflow"
git push
```

---

## 🎯 Step 3: Test It (1 minute)

1. Go to GitHub: **Actions** tab
2. Click **"Daily Sports Predictions Automation"**
3. Click **"Run workflow"** button
4. Click **"Run workflow"** again to confirm
5. Watch it run! ✨

---

## 🎯 Step 4: Verify Results (1 minute)

1. Wait for workflow to complete (~30-60 minutes)
2. Check your Supabase dashboard
3. Look for new entries in your predictions tables
4. Review the logs in the Actions tab

---

## ✅ You're Done!

Your predictions will now run automatically every day at **10:00 PM EST**.

### What happens automatically:

1. **10:00 PM EST daily**: Workflow starts
2. Fetches latest odds from TheOdds API
3. Generates team picks for all sports
4. Generates prop picks for all sports
5. Saves everything to Supabase
6. You wake up to fresh predictions! 🎉

---

## 📊 Daily Checklist

After setup, just do this once a day:

1. Open GitHub Actions tab
2. Verify yesterday's run completed ✅
3. Check Supabase for new predictions
4. That's it!

---

## 🆘 Troubleshooting

### Workflow failed?

1. Click the failed run
2. Check which step failed
3. Click that step to see error message
4. Common fixes:
   - **Missing secret**: Add it in repository secrets
   - **API rate limit**: Check your TheOdds quota
   - **Timeout**: Increase timeout in workflow file

### No predictions in database?

1. Check workflow logs for errors
2. Verify Supabase URL and key are correct
3. Check if there are games tomorrow for your sports
4. Test individual scripts locally:
   ```bash
   python teams_enhanced.py --tomorrow --sport NBA
   ```

### Need help?

Check the full documentation: [AUTOMATION_SETUP.md](./AUTOMATION_SETUP.md)

---

## 🎁 Bonus: Manual Run Anytime

Want to generate predictions on-demand?

```bash
# Run locally
./daily-automation-complete.sh

# Or trigger via GitHub Actions:
# Actions tab → Run workflow → Run workflow
```

---

## 📈 What's Next?

Now that automation is working:

1. **Week 1**: Monitor daily to ensure consistent runs
2. **Week 2**: Set up notifications (optional)
3. **Week 3**: Optimize timing if needed
4. **Week 4**: Sit back and enjoy automated predictions! 🏆

---

## 🎯 Pro Tips

- **Bookmark** the GitHub Actions page for easy monitoring
- **Enable email notifications** in GitHub settings
- **Check logs** if predictions seem off
- **Test changes** with manual runs before scheduled ones
- **Keep secrets updated** if you rotate API keys

---

**That's it!** You've successfully automated your daily predictions. No more manual runs, no more forgetting. Just wake up to fresh predictions every day. 🌟

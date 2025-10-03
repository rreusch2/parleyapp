# 🚀 Quick Start Guide - Player Props Specialist Agent

Get up and running in 5 minutes!

## ⚡ Super Quick Start

```bash
# 1. Navigate to agent directory
cd /home/reid/Desktop/parleyapp/agent

# 2. Activate virtual environment (create if needed)
source .venv/bin/activate

# 3. Install dependencies (if not already done)
pip install -r requirements.txt

# 4. Optional: Install browser automation
playwright install

# 5. Run the agent!
python player_props_specialist.py --picks 15
```

That's it! The agent will generate 15 player prop predictions for tomorrow.

## 🧪 Test First (Recommended)

```bash
# Run test suite to verify everything works
python test_player_props_agent.py

# This will test:
# ✅ StatMuse connectivity
# ✅ Supabase connectivity
# ✅ Full agent integration (optional)
```

## 📅 Daily Automation

### Option 1: Shell Script

```bash
# Run the automation script
./daily_props_automation.sh
```

### Option 2: Cron Job

```bash
# Edit crontab
crontab -e

# Add this line (runs at 6 AM daily)
0 6 * * * /home/reid/Desktop/parleyapp/agent/daily_props_automation.sh
```

### Option 3: Manual Daily Run

```bash
# Just run this every morning
python player_props_specialist.py --tomorrow --picks 15
```

## 🎯 Common Use Cases

### Generate for Tomorrow (Default)
```bash
python player_props_specialist.py
```

### Generate for Specific Date
```bash
python player_props_specialist.py --date 2025-10-15 --picks 20
```

### Generate More/Fewer Picks
```bash
# 25 picks
python player_props_specialist.py --picks 25

# 10 picks
python player_props_specialist.py --picks 10
```

## 🔧 Prerequisites Checklist

Before running, ensure you have:

- [x] **Backend .env file** with Supabase credentials
- [x] **StatMuse server** running (optional but recommended)
- [x] **OpenAI API key** in config.toml
- [x] **Python 3.10+** installed
- [x] **Virtual environment** set up

### Check StatMuse Server

```bash
# Check if running
curl http://127.0.0.1:5001/health

# If not running, start it:
cd /home/reid/Desktop/parleyapp
python statmuse_api_server.py
```

### Verify Environment

```bash
# Check Supabase connection
python -c "from dotenv import load_dotenv; import os; load_dotenv('backend/.env'); print('✅ SUPABASE_URL:', os.getenv('SUPABASE_URL'))"

# Check OpenAI key
grep "api_key" config/config.toml
```

## 📊 View Results

### In Database:

```sql
-- View recent predictions
SELECT 
    match_teams,
    pick,
    odds,
    confidence,
    sport,
    created_at
FROM ai_predictions
WHERE bet_type = 'player_prop'
ORDER BY created_at DESC
LIMIT 20;
```

### In Logs:

```bash
# View latest log
tail -f /home/reid/Desktop/parleyapp/logs/player_props_*.log

# Or check agent output directly
python player_props_specialist.py --picks 5 | tee test_run.log
```

## ❓ Troubleshooting

### Error: "Virtual environment not found"

```bash
cd /home/reid/Desktop/parleyapp/agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Error: "StatMuse connection failed"

```bash
# Start StatMuse server in another terminal
cd /home/reid/Desktop/parleyapp
python statmuse_api_server.py
```

### Error: "Supabase credentials not found"

```bash
# Check backend/.env exists
ls -la /home/reid/Desktop/parleyapp/backend/.env

# Verify it has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
cat /home/reid/Desktop/parleyapp/backend/.env | grep SUPABASE
```

### Error: "OpenAI API error"

```bash
# Verify API key in config
cat config/config.toml | grep api_key

# Make sure key starts with "sk-"
```

## 🎓 What the Agent Does

When you run the agent, it:

1. **🔍 Discovery Phase**
   - Queries database for tomorrow's games
   - Gets all available player props with odds
   - Analyzes the prop landscape

2. **🧠 Planning Phase**
   - AI intelligently decides which props to research
   - Plans optimal tool usage strategy
   - Identifies value opportunities

3. **📚 Research Phase**
   - StatMuse: Player stats, team matchups
   - Web Search: Injuries, weather, news
   - Browser: Linemate trends (optional)

4. **🎯 Generation Phase**
   - Creates high-quality predictions
   - Formats for database storage
   - Stores in ai_predictions table

## 📈 Expected Results

After a successful run, you should see:

```
========================================
Player Props Specialist Agent
========================================
🎯 Target: 2025-10-04, 15 picks
✅ Agent initialized with 7 tools
🤖 Activating autonomous AI agent...

[Agent thinks and researches]
[Tool calls to StatMuse, Supabase, etc.]

✅ Mission accomplished!
📊 RESULTS SUMMARY
   Success: True
   Predictions Stored: 15
```

## 🔗 Integration with React Native App

Your predictions are automatically available in the app via the `/api/ai/picks` endpoint since they're stored in `ai_predictions` table.

**Bonus:** Player headshots will show on prediction cards if player_id is set (agent can look up players from database).

## 🚀 Next Steps

1. **Run a test** with `test_player_props_agent.py`
2. **Generate 3-5 picks** as a trial run
3. **Review predictions** in database
4. **Set up daily automation** with cron
5. **Monitor results** and win rates
6. **Customize prompts** for better results

## 💡 Pro Tips

### Customize Pick Count by Sport

Edit the mission prompt in `player_props_specialist.py`:

```python
"Focus on MLB props primarily (10-12 picks)
Generate 3-5 WNBA picks if available
Be selective - quality over quantity"
```

### Speed Up for Testing

Use GPT-4o-mini in `config.toml`:

```toml
[llm]
model = "gpt-4o-mini"  # Faster, cheaper
```

### Add Custom Research Sources

Update mission prompt:

```python
"Also check:
- Baseball Savant for advanced metrics
- Rotowire for injury updates
- Vegas Insider for line movement"
```

## 📞 Need Help?

- **Check logs:** `/home/reid/Desktop/parleyapp/logs/`
- **Read full docs:** `README_PLAYER_PROPS_AGENT.md`
- **Compare to old system:** `COMPARISON_OLD_VS_NEW.md`
- **Test individual tools:** `test_player_props_agent.py`

---

**You're all set! Start generating intelligent player prop predictions. 🎉**

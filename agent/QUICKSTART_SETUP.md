# 🚀 Quick Start - Enhanced Betting Agent

## Environment Setup

### 1. Set Your xAI API Key (Grok)

**Windows PowerShell (Permanent):**
```powershell
# Set environment variable permanently
[Environment]::SetEnvironmentVariable("XAI_API_KEY", "your-xai-api-key-here", "User")

# Restart your terminal after this
```

**Windows PowerShell (Current Session):**
```powershell
$env:XAI_API_KEY = "your-xai-api-key-here"
```

**Or edit your PowerShell profile:**
```powershell
# Open profile
notepad $PROFILE

# Add this line:
$env:XAI_API_KEY = "your-xai-api-key-here"
```

### 2. Verify Environment Variable
```powershell
# Check if it's set
echo $env:XAI_API_KEY
```

## Running the Agent

### Basic Usage

```powershell
# Navigate to agent directory
cd C:\Users\reidr\parleyapp\agent

# Generate NHL props for tomorrow
python run_props_agent.py --tomorrow --picks 10 --sport NHL

# Generate NBA props for today
python run_props_agent.py --picks 15 --sport NBA

# Generate MLB props for a specific date
python run_props_agent.py --date 2025-10-13 --picks 20 --sport MLB
```

### Available Options

```powershell
--tomorrow          # Analyze tomorrow's games (default: today)
--date YYYY-MM-DD   # Specific date to analyze
--picks NUMBER      # Number of picks to generate (default: 15)
--sport SPORT       # Filter by sport (NHL, NBA, MLB, NFL, CFB, WNBA)
--player-props      # Generate player prop picks (default)
--team-bets         # Generate team betting picks
--investigate "..."  # Deep investigation on specific opportunity
```

### Examples

```powershell
# 30 NHL props for tomorrow's games
python run_props_agent.py --tomorrow --picks 30 --sport NHL

# Team betting picks for all sports today
python run_props_agent.py --team-bets --picks 20

# Deep investigation
python run_props_agent.py --investigate "Connor McDavid OVER 0.5 Goals"

# College football props for Saturday
python run_props_agent.py --date 2025-10-12 --picks 25 --sport CFB
```

## Troubleshooting

### "Invalid xAI API Key"
- Make sure you set the environment variable correctly
- Restart your terminal after setting it
- Verify it's set: `echo $env:XAI_API_KEY`

### "No module named loguru"
```powershell
cd C:\Users\reidr\parleyapp\agent
pip install --user -r requirements.txt
```

### "Connection to Supabase failed"
- Check your `.env` file in the parent directory has Supabase credentials
- Or set environment variables:
```powershell
$env:SUPABASE_URL = "your-supabase-url"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
```

## What the Agent Does

1. **🔍 Discovers Games**: Queries your database for upcoming games
2. **📊 Fetches Props**: Gets available player props from `player_props_v2`
3. **🧠 AI Research**: Uses Grok (xAI) to autonomously research:
   - Recent performance trends
   - Injury reports
   - Matchup advantages
   - Historical stats
   - Line value analysis
4. **✅ Validates**: Checks data quality and prediction confidence
5. **💾 Stores**: Saves predictions to `ai_predictions` table with full reasoning
6. **🎯 Maps Players**: Automatically links to `players` table for headshots

## Output

The agent stores predictions in your `ai_predictions` table with:
- ✅ Proper player mapping (`player_id`)
- ✅ Player headshots (`metadata.player_headshot_url`)
- ✅ Detailed reasoning (6-10 sentences)
- ✅ Value metrics (ROI, implied probability, fair odds)
- ✅ Risk assessment

Your frontend can immediately display these picks!

## Next Steps

1. Set up your API key
2. Run the agent for tomorrow's NHL games
3. Check your `ai_predictions` table
4. Verify the frontend displays the new picks properly
5. Adjust `--picks` number based on quality

---

**Pro Tip**: Start with small batches (10-15 picks) to verify everything works, then scale up!


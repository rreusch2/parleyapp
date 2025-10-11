# Odds V2 Fetching - Usage Guide

## Overview
The `odds:v2` script fetches game odds and player props from TheOdds API with flexible filtering options to save API credits.

## Command-Line Options

### Basic Usage
```bash
# Fetch everything (all sports, games + props)
npm run odds:v2

# Fetch only game odds (no props)
npm run odds:v2:games

# Fetch only player props (no game odds)
npm run odds:v2:props
```

### Sport-Specific Props (Dedicated Scripts)

**Windows-friendly npm scripts** (no need for command-line args):

```bash
# CFB and NHL props only (YOUR USE CASE!)
npm run odds:v2:cfb-nhl-props

# Individual sport props
npm run odds:v2:cfb-props
npm run odds:v2:nhl-props
npm run odds:v2:mlb-props
npm run odds:v2:nba-props
npm run odds:v2:nfl-props
```

**Supported Sport Keys:**
- `MLB` - Major League Baseball
- `NBA` - National Basketball Association
- `NFL` - National Football League
- `NHL` - National Hockey League
- `CFB` - College Football
- `WNBA` - Women's National Basketball Association

### Combining Options

```bash
# Props only for College Football and NHL
cd backend && npm run odds:v2 -- --props-only --sports=cfb,nhl

# Games only for NFL and CFB
cd backend && npm run odds:v2 -- --games-only --sports=nfl,cfb

# Everything for just MLB
cd backend && npm run odds:v2 -- --sports=mlb

# NFL extended week (10 days ahead) - games only
cd backend && npm run odds:v2 -- --games-only --sports=nfl --nfl-week --nfl-days=10
```

## All Options Reference

| Option | Description | Example |
|--------|-------------|---------|
| `--props-only` | Fetch only player props (skip game odds) | `--props-only` |
| `--games-only` | Fetch only game odds (skip player props) | `--games-only` |
| `--sports=X,Y` | Filter to specific sports (comma-separated) | `--sports=cfb,nhl` |
| `--nfl-week` | Extended NFL week mode (default 7 days ahead) | `--nfl-week` |
| `--nfl-days=N` | Set NFL ahead days (requires --nfl-week) | `--nfl-days=10` |

**Note:** `--props-only` and `--games-only` are mutually exclusive.

## Common Use Cases

### 1. Save API Credits - Targeted Fetch
```bash
# Only fetch CFB + NHL props (YOUR USE CASE!)
npm run odds:v2:cfb-nhl-props
```

### 2. Update Props Without Refetching Games
```bash
# Already have games, just need updated props
npm run odds:v2:props
```

### 3. Quick Game Odds Refresh
```bash
# Just refresh game lines without heavy props fetch
npm run odds:v2:games
```

### 4. Single Sport Props
```bash
# Just MLB props
npm run odds:v2:mlb-props

# Just CFB props
npm run odds:v2:cfb-props

# Just NHL props
npm run odds:v2:nhl-props
```

### 5. Weekend College Football Props
```bash
# Saturday CFB prop hunting
npm run odds:v2:cfb-props
```

## Output Examples

### With Filters:
```
🚀 Running odds v2 pipeline...
🎯 Filtering to sports: CFB, NHL
📊 Fetching game odds (h2h/spreads/totals)...
🎯 Filtering to 2 sport(s): CFB, NHL
✅ Games fetch complete: 45 games.
🎲 Fetching player props...
🎯 Filtering props to 2 sport(s): CFB, NHL
✅ Player props v2 aggregation complete.
🎉 runOddsV2 complete
```

### Props Only:
```
🚀 Running odds v2 pipeline...
⏭️  Skipping game odds fetch
🎲 Fetching player props...
✅ Player props v2 aggregation complete.
🎉 runOddsV2 complete
```

### Games Only:
```
🚀 Running odds v2 pipeline...
📊 Fetching game odds (h2h/spreads/totals)...
✅ Games fetch complete: 123 games.
⏭️  Skipping player props fetch
🎉 runOddsV2 complete
```

## API Credit Management

### Estimated API Calls per Sport:

**Game Odds (per sport):**
- ~1 API call per sport per fetch
- Example: Fetching 6 sports = ~6 API calls

**Player Props (per sport):**
- ~1-3 API calls per sport (depends on available markets)
- More calls if multiple bookmakers are configured
- Props are generally more expensive than game odds

### Credit-Saving Tips:

1. **Use Sport Filters**: Don't fetch all sports if you only need CFB + NHL
   ```bash
   --sports=cfb,nhl  # Only 2 sports instead of 6
   ```

2. **Separate Games and Props**: If you already have games, just fetch props
   ```bash
   --props-only  # Skip game odds API calls
   ```

3. **Schedule Wisely**: Fetch props closer to game time when lines are more stable
   ```bash
   # Morning: Fetch games
   npm run odds:v2:games
   
   # Afternoon: Fetch props when you're ready to analyze
   npm run odds:v2:props --sports=cfb,nhl
   ```

4. **Don't Over-Fetch**: Only fetch what your AI agent will analyze today

## Troubleshooting

### No Sports Matched
```
⚠️  No active sports matched filters: XYZ
Available sports: MLB, NBA, NFL, NHL, CFB, WNBA
```
**Solution:** Check your sport key spelling. Use uppercase: `--sports=CFB,NHL`

### API Rate Limits
If you hit rate limits, use more specific filters:
```bash
# Instead of fetching everything:
npm run odds:v2

# Fetch only what you need:
npm run odds:v2 -- --props-only --sports=mlb
```

### Missing Environment Variables
Ensure your `backend/.env` has:
```
THEODDS_API_KEY=your_key_here
SUPABASE_SERVICE_ROLE_KEY=your_key_here
```

## Integration with AI Agent

After fetching odds data, run your betting agent:

```bash
# 1. Fetch CFB + NHL props
cd backend && npm run odds:v2 -- --props-only --sports=cfb,nhl

# 2. Run AI agent to analyze the props
cd ..
python agent/run_props_agent.py --player-props --sport=CFB --picks=10
python agent/run_props_agent.py --player-props --sport=NHL --picks=10
```

## Summary

**Your Use Case (CFB + NHL props only):**
```bash
cd backend
npm run odds:v2:cfb-nhl-props
```

This will:
- ✅ Skip game odds fetch (save API credits)
- ✅ Only fetch props for College Football and NHL
- ✅ Store in `player_props_v2` table
- ✅ Ready for your AI agent to analyze

**Saves you ~70% of API calls** compared to fetching everything!

## Quick Reference

```bash
# YOUR USE CASE - CFB + NHL props only
npm run odds:v2:cfb-nhl-props

# Other common commands
npm run odds:v2:props              # All props, all sports
npm run odds:v2:games              # All games, no props
npm run odds:v2:cfb-props          # CFB props only
npm run odds:v2:nhl-props          # NHL props only
npm run odds:v2:mlb-props          # MLB props only
```


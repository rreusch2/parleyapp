# Free Sports Data APIs for Predictive Play

## Current Setup

### 1. **BALLDONTLIE API** (Primary - NBA)
- **Website**: https://www.balldontlie.io
- **Free Tier**: ✅ Yes
- **Signup**: https://app.balldontlie.io/signup
- **Rate Limits**: 100 requests/minute on free tier
- **Sports Covered**: NBA, NFL, MLB, NHL, EPL, WNBA, NCAAF, NCAAB
- **Data**: Player stats, game stats, box scores, team standings, betting odds
- **Python SDK**: `pip install balldontlie`
- **API Key**: Free tier available (optional API key for better limits)

**Pros:**
- Comprehensive NBA data (best free option)
- Clean, well-documented API
- Python SDK available
- MCP server integration
- Real-time data

**Cons:**
- Free tier has rate limits
- Some advanced features require paid tier

---

### 2. **MLB Stats API** (Official & Free)
- **Website**: https://statsapi.mlb.com
- **Free Tier**: ✅ Yes (completely free, no API key needed)
- **Documentation**: https://github.com/toddrob99/MLB-StatsAPI
- **Rate Limits**: None (reasonable use)
- **Sports Covered**: MLB only
- **Data**: Schedules, scores, box scores, player stats, play-by-play

**Pros:**
- Official MLB API
- Completely free, no signup
- Comprehensive MLB data
- No rate limits

**Cons:**
- MLB only
- Less structured than commercial APIs

---

### 3. **MySportsFeeds** (Backup)
- **Website**: https://www.mysportsfeeds.com
- **Free Tier**: ✅ Yes (for personal/private use)
- **Trial**: 14-day free trial (all features)
- **Sports Covered**: NFL, MLB, NBA, NHL
- **Data**: Schedules, scores, box scores, standings, play-by-play, injuries, DFS, odds

**Pros:**
- Free for personal use
- Consistent data across sports
- Good documentation

**Cons:**
- Requires signup
- Free tier limited to personal/private use

---

## Implementation Plan

### Phase 1: Immediate Backfill (Today)
**Run:** `python scripts/backfill_player_stats_balldontlie.py --sport ALL --days 30`

This will:
- Use BALLDONTLIE for NBA stats (free tier)
- Use MLB Stats API for MLB stats (free)
- Backfill last 30 days of game stats
- Automatically create missing players
- Map stats to your existing schema

### Phase 2: Daily Scheduled Updates
**Setup a daily cron job:**
```bash
# Run daily at 6 AM
0 6 * * * cd /path/to/parleyapp && python scripts/backfill_player_stats_balldontlie.py --sport ALL --days 2
```

### Phase 3: NFL & NHL (When in season)
For NFL and NHL, we have several options:

**Option 1: ESPN Hidden API (Free)**
- No API key needed
- Real game data
- `http://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`

**Option 2: BALLDONTLIE Paid ($19.99/mo per sport)**
- If budget allows
- Most reliable for NFL/NHL

**Option 3: TheSportsDB (Free)**
- https://www.thesportsdb.com/api.php
- Free tier: 200 requests/day per IP
- Covers NFL, NHL, and many other sports

---

## Current API Keys

### BALLDONTLIE
- Sign up at: https://app.balldontlie.io/signup
- Add to `.env`: `BALLDONTLIE_API_KEY=your_key_here`
- **Note**: Free tier works without key, but key gives better rate limits

### MLB Stats API
- No API key needed ✅

### SportsData.io (Current)
- **Current Key**: `03d3518bdc1d468cba7855b6e1fcdfa6`
- **Issue**: Free trial with scrambled data, not production-ready
- **Status**: Replace with free alternatives above

---

## Cost Comparison

| Service | Free Tier | Paid (if needed) |
|---------|-----------|------------------|
| **BALLDONTLIE** | 100 req/min, basic stats | $19.99/mo per sport |
| **MLB Stats API** | Unlimited (official) | Free forever |
| **MySportsFeeds** | Personal use only | $89/mo per sport |
| **SportsData.io** | Trial only (scrambled) | $50-500/mo |
| **ESPN API** | Unlimited (hidden) | Free forever |

---

## Recommended Setup (All Free)

1. **NBA**: BALLDONTLIE free tier
2. **MLB**: MLB Stats API (official)
3. **NFL**: ESPN hidden API or BALLDONTLIE free tier
4. **NHL**: ESPN hidden API or BALLDONTLIE free tier

**Total Cost**: $0/month

---

## Next Steps

1. ✅ Run backfill script to get last 30 days
2. ✅ Verify data in Supabase
3. ✅ Set up daily cron job
4. ⏳ Add NFL/NHL when seasons start
5. ⏳ Populate event_id using existing sports_events table

---

## Support & Documentation

- **BALLDONTLIE Docs**: https://docs.balldontlie.io
- **MLB Stats API Docs**: https://github.com/toddrob99/MLB-StatsAPI
- **ESPN API Guide**: https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b
- **TheSportsDB API**: https://www.thesportsdb.com/api.php

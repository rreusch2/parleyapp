# Player Headshot Ingestion Guide

## Overview
This guide provides a comprehensive solution for ingesting accurate player headshots across all sports in your database.

## Current Status

| Sport | Total Players | With Headshots | Missing | Coverage |
|-------|--------------|----------------|---------|----------|
| NFL | 5,489 | 5,434 | 55 | 99.0% ✅ |
| MLB | 1,003 | 319 | 684 | 31.8% ⚠️ |
| NBA | 283 | 0 | 283 | 0.0% ❌ |
| NHL | 351 | 0 | 351 | 0.0% ❌ |
| WNBA | 85 | 0 | 85 | 0.0% ❌ |
| College Football | 10,739 | 0 | 10,739 | 0.0% ❌ |

**Total Missing: 12,197 headshots**

## Solution Architecture

### Multi-Source Approach
We use multiple reliable sources in order of priority:

1. **ESPN CDN** (Primary)
   - Most reliable and comprehensive
   - Works for all major sports
   - Pattern: `https://a.espncdn.com/i/headshots/{sport}/players/full/{id}.png`

2. **Official League CDNs** (Secondary)
   - NBA.com: `https://cdn.nba.com/headshots/nba/latest/1040x760/{id}.png`
   - MLB.com: `https://img.mlbstatic.com/mlb-photos/image/upload/.../{id}/headshot/...`
   - NHL.com: `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/{id}.jpg`

3. **ESPN API** (Tertiary - for finding IDs)
   - Can search by player name to find ESPN IDs
   - Returns headshot URLs directly from API

## Scripts Provided

### 1. `ingest_player_headshots.py` (Recommended First)
**Best for:** Direct URL pattern matching using existing player IDs

**Features:**
- Fast execution (uses HEAD requests to verify images)
- Multiple fallback patterns per sport
- No API rate limits (just CDN requests)
- Handles special cases (MLB "mlb_" prefix, NHL mixed IDs)

**Pros:**
- Very fast
- No API dependencies
- Works with existing player IDs

**Cons:**
- Requires proper external_player_id format
- Won't find players with incorrect/missing IDs

### 2. `ingest_headshots_espn_api.py` (Recommended Second)
**Best for:** Finding players via name matching and discovering ESPN IDs

**Features:**
- Uses ESPN's official API
- Can search by player name
- Automatically saves ESPN player IDs for future use
- More robust for players with missing/incorrect IDs

**Pros:**
- Can find players even without ESPN IDs
- Updates ESPN player IDs in database
- Official API data

**Cons:**
- Slower (API rate limiting needed)
- ESPN API might not have all players
- Requires active internet and ESPN API access

## Setup Instructions

### 1. Install Dependencies
```bash
pip install -r requirements_headshots.txt
```

### 2. Set Environment Variables
```bash
# Required
export SUPABASE_URL="https://iriaegoipkjtktitpary.supabase.co"
export SUPABASE_SERVICE_KEY="your_service_key_here"
```

Or create a `.env` file:
```
SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
```

### 3. Test Run (Recommended)
Start with a small batch to test:

```python
# Edit the script and modify the limit
sports_to_process = [
    ("NBA", 10),  # Test with 10 players first
]
```

## Execution Strategy

### Phase 1: Quick Wins (Run First)
```bash
python ingest_player_headshots.py
```

This will process:
- NBA: 283 players (~5 minutes)
- NHL: 351 players (~7 minutes)
- WNBA: 85 players (~2 minutes)
- MLB: 684 players (~14 minutes)
- NFL: 55 remaining players (~1 minute)

**Expected Results:**
- NBA: ~85-90% coverage (ESPN IDs exist for most)
- NHL: ~60-70% coverage (mixed ID format)
- MLB: ~75-85% additional coverage
- WNBA: ~70-80% coverage

### Phase 2: API Fallback (Run Second)
```bash
python ingest_headshots_espn_api.py
```

This will find remaining players via name search:
- Searches ESPN API for missing players
- Updates ESPN player IDs
- Gets headshots from API results

**Expected Results:**
- Additional 10-20% coverage for each sport
- ESPN IDs populated for future use

### Phase 3: Manual Review
After both scripts, you'll likely have:
- NBA: ~95%+ coverage
- NHL: ~75-85% coverage
- MLB: ~90%+ coverage
- WNBA: ~85%+ coverage
- NFL: ~99.5%+ coverage

For remaining players:
1. Check if they're actually active players
2. Verify player names are correct
3. Consider manual upload for key players

## Data Quality Considerations

### Player ID Formats
- **NBA**: Numeric ESPN IDs (e.g., "203932")
- **MLB**: Prefixed format "mlb_XXXXXX" (script handles extraction)
- **NHL**: Mixed UUIDs and numeric IDs (script filters to numeric)
- **WNBA**: UUIDs (uses name search)
- **NFL**: Numeric IDs (already 99% complete)

### Special Cases Handled

1. **MLB ID Format**: Automatically extracts numeric ID from "mlb_676879" format
2. **NHL Mixed IDs**: Only processes numeric IDs, skips UUIDs
3. **WNBA Name-Based**: Falls back to name-based search
4. **Name Normalization**: Handles dots, hyphens, apostrophes

## Monitoring & Validation

### Check Progress
```sql
SELECT 
  sport,
  COUNT(*) as total_players,
  COUNT(headshot_url) as players_with_headshots,
  COUNT(*) - COUNT(headshot_url) as missing_headshots,
  ROUND(100.0 * COUNT(headshot_url) / COUNT(*), 2) as coverage_percentage
FROM players
WHERE active = true
GROUP BY sport
ORDER BY missing_headshots DESC;
```

### Validate Headshot Sources
```sql
SELECT 
  sport,
  headshot_source,
  COUNT(*) as count
FROM players
WHERE headshot_url IS NOT NULL
GROUP BY sport, headshot_source
ORDER BY sport, count DESC;
```

### Check for Broken Links (Optional)
Create a validation script that periodically checks if headshot URLs are still accessible.

## Rate Limiting & Best Practices

### CDN Script (`ingest_player_headshots.py`)
- Pauses every 50 players (2 seconds)
- 0.1 second delay between players
- Uses HEAD requests (faster than GET)
- **Total estimated time: ~30-40 minutes for all sports**

### API Script (`ingest_headshots_espn_api.py`)
- 0.5 second delay between requests
- Uses ESPN's public API (respectful rate limiting)
- **Total estimated time: ~20-30 minutes per sport**

## Troubleshooting

### Issue: "SUPABASE_SERVICE_KEY not found"
**Solution:** Set the environment variable or create `.env` file

### Issue: Many players not found
**Possible Causes:**
1. Player names have special characters
2. External IDs are in wrong format
3. Player is inactive or not in ESPN database

**Solution:** 
- Run the ESPN API script for name-based search
- Check player status in database
- Verify player names match official rosters

### Issue: Script is slow
**Solution:**
- Reduce batch size
- Process one sport at a time
- Check internet connection

### Issue: Images not loading in app
**Possible Causes:**
1. CDN CORS policies
2. Image URLs need proper headers
3. Mobile app caching issues

**Solution:**
- Test URLs in browser first
- Consider proxying through your own CDN
- Implement image caching strategy

## College Football Considerations

College Football has 10,739 players (largest dataset):

**Challenges:**
- Player turnover is high
- Many players don't have professional IDs
- ESPN coverage varies by school

**Recommendation:**
1. Start with a test batch (100 players)
2. Evaluate success rate
3. Consider focusing on:
   - Players from Top 25 schools
   - Players with existing stats
   - Players in current season

**Alternative Approach:**
- Use school roster pages
- Implement school-specific scrapers
- Focus on active/rostered players only

## Future Enhancements

### 1. Automated Monitoring
- Create a cron job to check for new players
- Automatically fetch headshots for new additions
- Monitor for broken image links

### 2. Image Optimization
- Resize images to standard dimensions
- Convert to WebP for better performance
- Store in Supabase Storage bucket

### 3. Fallback Images
- Create sport-specific placeholder images
- Use team logos as fallback
- Generate silhouette avatars

### 4. Additional Sources
- SportsRadar API (paid but comprehensive)
- RapidAPI sports databases
- Team official websites (scraping)
- Yahoo Sports CDN

## Cost Considerations

**Free Tier Coverage:**
- ESPN CDN: Free (public CDN)
- Official League CDNs: Free (public)
- ESPN API: Free (public API, rate limited)
- Supabase: Within free tier for these operations

**If Scaling Further:**
- Consider SportsRadar ($$$)
- Implement caching layer
- Use Supabase Storage for permanent hosting

## Success Metrics

**Target Goals:**
- NBA: 95%+ coverage ✅
- NHL: 80%+ coverage ✅
- MLB: 90%+ coverage ✅
- WNBA: 85%+ coverage ✅
- NFL: Maintain 99%+ coverage ✅
- College Football: 50%+ coverage (Top tier players) ✅

## Questions?

For issues or improvements:
1. Check the console output for specific errors
2. Verify player IDs in database
3. Test URL patterns manually
4. Consider sport-specific solutions

## Ready to Execute?

Run the scripts in this order:
```bash
# Phase 1: Quick wins with direct URLs
python ingest_player_headshots.py

# Phase 2: API fallback for remaining players
python ingest_headshots_espn_api.py

# Phase 3: Verify results
python -c "from ingest_player_headshots import *; supabase = create_client(SUPABASE_URL, SUPABASE_KEY); print('Check Supabase')"
```

Good luck! 🏀⚾🏈🏒🏀


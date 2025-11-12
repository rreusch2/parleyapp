# Odds:v2 Automated Cron Jobs

## Overview
Automated daily execution of the `odds:v2` script to fetch game odds and player props data from TheOdds API.

## Schedule
The cron jobs run at the following times (Eastern Time):

1. **12:00 PM (Noon)** - Midday update for fresh odds and props
2. **11:00 PM (23:00)** - Late night update before next day's games

## Configuration

### Environment Variables
Add these to your `.env` file on Railway:

```bash
# Enable all cron jobs (required)
ENABLE_CRON=true

# Enable odds:v2 cron specifically (required)
ENABLE_ODDS_CRON=true

# Timezone for cron execution (optional, defaults to America/New_York)
ODDS_CRON_TZ=America/New_York
```

### Railway Setup

1. **In Production (Railway):**
   - The cron jobs automatically start when `NODE_ENV=production` OR `ENABLE_CRON=true`
   - Set environment variables in Railway dashboard
   - Redeploy after setting environment variables

2. **Local Testing:**
   ```bash
   # Set in your local .env
   ENABLE_CRON=true
   ENABLE_ODDS_CRON=true
   
   # Start the server
   npm run dev
   ```

## What It Does

The cron job executes the same command as:
```bash
npm run odds:v2
```

This fetches:
- Game odds (h2h, spreads, totals) for all active sports
- Player props for all supported sports
- Updates the Supabase database with fresh data

## Monitoring

### Check Logs
In Railway, check the deployment logs for:
- `[oddsV2Cron] Scheduled odds:v2 jobs (12:00 PM, 11:00 PM America/New_York)` - Confirms cron is initialized
- `[oddsV2Cron] 12:00 PM job starting...` - Confirms noon job execution
- `[oddsV2Cron] 11:00 PM job starting...` - Confirms night job execution
- `[oddsV2Cron] ✅ Odds:v2 data fetch completed successfully` - Confirms successful execution

### Manual Testing
You can still manually run the odds:v2 command anytime:
```bash
npm run odds:v2
```

## Troubleshooting

### Cron jobs not running
1. Verify `ENABLE_CRON=true` in Railway environment variables
2. Verify `ENABLE_ODDS_CRON=true` in Railway environment variables
3. Check Railway logs for initialization message
4. Ensure server is running (not sleeping/paused)

### Script errors
- Check Railway logs for error messages with `[oddsV2Cron]` prefix
- Verify `THEODDS_API_KEY` is set in environment variables
- Ensure Supabase credentials are correctly configured

### Timezone issues
- Set `ODDS_CRON_TZ` to your desired timezone
- Use standard timezone names (e.g., `America/New_York`, `America/Los_Angeles`)
- Changes require a redeploy to take effect

## Customizing Schedule

To modify the schedule, edit `src/cron/oddsV2Cron.ts`:

```typescript
// Cron format: second minute hour day month weekday
// Current: '0 0 23 * * *' = 11:00 PM daily
// Example: '0 30 10 * * *' = 10:30 AM daily

cron.schedule('0 0 23 * * *', async () => {
  // Your schedule here
});
```

## File Locations
- **Cron Job:** `src/cron/oddsV2Cron.ts`
- **Script:** `src/scripts/runOddsV2.ts`
- **App Integration:** `src/app.ts` (line ~204)

## Related Commands
```bash
npm run odds:v2              # Run full odds fetch
npm run odds:v2:games        # Fetch only game odds
npm run odds:v2:props        # Fetch only player props
```

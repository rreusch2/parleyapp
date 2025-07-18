# UFC and MMA Integration Guide

This document explains how to integrate UFC and MMA sports into the Parley App.

## Overview

This integration adds UFC and MMA support to our existing MLB integration. The changes include:

1. Adding UFC and MMA to the sports_config table
2. Adding MMA-specific market types (fight_outcome, fighter_win_method, etc.)
3. Adding MMA-specific player prop types
4. Updating the odds integration scripts to fetch UFC and MMA events
5. Adding UFC and MMA tabs to the UI

## Database Changes

Run the following SQL script to update your database:

```sql
-- See add-mma-ufc-sports.sql
```

You can execute this script using:

```bash
psql -h your-host -U your-user -d your-db -f add-mma-ufc-sports.sql
```

## Code Changes

The following files have been modified:

1. `/backend/src/scripts/setupOddsIntegration.ts`:
   - Added MMA/UFC prop markets
   - Added fighter data interface
   - Added checks for UFC/MMA in sports_config
   - Added MMA market types
   - Added MMA player prop types

2. `/backend/src/scripts/fetchTheOddsGames.ts`:
   - Added UFC and MMA to the ACTIVE_LEAGUES array

3. `/app/(tabs)/live.tsx`:
   - Added UFC and MMA to the sportFilters array

## Running the Integration

1. First, run the SQL migration script:

```bash
psql -h your-host -U your-user -d your-db -f add-mma-ufc-sports.sql
```

2. Then, run the odds integration script:

```bash
cd backend
npx ts-node src/scripts/setupOddsIntegration.ts
```

3. Verify that UFC and MMA events are being fetched by checking the logs

4. Restart your frontend server to see the new UFC and MMA tabs in the Games section

## Notes on UFC/MMA Data

- UFC events are structured differently from team sports
- Instead of "home_team" and "away_team", they represent the two fighters
- The odds API returns the data in the same format, just with fighters instead of teams
- The UI components will work the same way with MMA/UFC events

## Testing

To test the integration:
1. Run the integration script
2. Open the Games tab in the app
3. Check for the UFC and MMA tabs
4. Verify that UFC/MMA events are displayed with odds
5. Verify that the event cards show fighter information correctly 
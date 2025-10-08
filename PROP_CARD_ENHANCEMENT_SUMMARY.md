# Prop Prediction Card Enhancement Summary

## Overview
Enhanced the prop prediction cards with improved information display including game matchups, date/time, and better prop type formatting.

## Changes Made

### 1. **New Team Abbreviations Utility** (`app/utils/teamAbbreviations.ts`)
- Created comprehensive team abbreviation mappings for all sports:
  - NFL (32 teams)
  - MLB (30 teams)
  - NBA (30 teams)
  - NHL (32 teams)
  - WNBA (12 teams)
  - CFB (80+ major programs)
- Helper functions:
  - `getTeamAbbreviation(fullName, sport)` - Convert full team names to abbreviations
  - `formatGameMatchup(awayTeam, homeTeam, sport)` - Format as "TEN @ CIN"
  - `formatGameDateTime(startTime)` - Format as "Wed 10/8, 7:08 PM ET"

### 2. **Enhanced PropPredictionCard Component** (`app/components/PropPredictionCard.tsx`)

#### What Changed:
**BEFORE:**
- Player Name
- Prop Type (e.g., "Batter Total Bases O/U")
- Pick: "OVER 3.5"

**AFTER:**
- Player Name
- Game Matchup (e.g., "TEN @ CIN") + Game Date/Time (e.g., "Wed 10/8, 7:08 PM ET")
- Pick: "OVER 3.5" + Prop Type on second line (e.g., "Total Bases")

#### Specific Changes:
1. **Game Info Display**: Replaced standalone prop type with:
   - League icon/logo
   - Game matchup with team abbreviations
   - Game date and time in readable format
   - Separated by bullets for clean look

2. **Enhanced Pick Display**: 
   - Main line: "OVER 3.5" (bold, prominent)
   - Second line: Prop type (e.g., "Total Bases")
   - For MLB: Removes "Batter" prefix but keeps "Pitcher" prefix
   - Removes "O/U" suffix from all prop types

3. **Prop Type Formatting**:
   - MLB Batter props: "Hits" instead of "Batter Hits O/U"
   - MLB Pitcher props: "Pitcher Strikeouts" (keeps "Pitcher")
   - NFL: "Pass Yards" instead of "Pass Yards O/U"
   - NBA: "Points" instead of "Points O/U"

### 3. **Python Script Enhancement** (`props_enhanced_v2.py`)

Added game info to metadata when storing predictions:

```python
# Enrich metadata with game info for frontend display
if event:
    metadata['game_info'] = {
        'away_team': event.get('away_team', 'Unknown'),
        'home_team': event.get('home_team', 'Unknown'),
        'start_time': event.get('start_time'),
    }
```

This ensures all new predictions have the game information needed for the enhanced card display.

## Example Card Display

**MLB Example:**
```
┌─────────────────────────────────────┐
│  🧑 Aaron Judge                     │
│  ⚾ TOR @ NYY • Wed 10/8, 7:08 PM ET│
│                                     │
│  📈 OVER 1.5                        │
│     Total Bases                     │
│                                     │
│  💰 DraftKings        +120          │
│  🛡️ 85%  🎯 12.3%  ⚡ 8.5%        │
└─────────────────────────────────────┘
```

**NFL Example:**
```
┌─────────────────────────────────────┐
│  🧑 Patrick Mahomes                 │
│  🏈 TEN @ CIN • Sun 10/13, 1:00 PM ET│
│                                     │
│  📈 OVER 285.5                      │
│     Pass Yards                      │
│                                     │
│  💰 FanDuel          -110           │
│  🛡️ 78%  🎯 9.8%  ⚡ 7.2%         │
└─────────────────────────────────────┘
```

## Data Flow

1. **Backend (Python)**:
   - Fetches games from `sports_events` table
   - Fetches props from `player_props_v2_flat_quick_mat` view
   - AI generates predictions
   - Stores predictions with enriched metadata including game info

2. **Frontend (React Native)**:
   - Fetches predictions from `ai_predictions` table
   - Extracts game info from metadata
   - Uses team abbreviation utility to format matchup
   - Displays in enhanced card layout

## Database Schema
No changes to the database schema required. All enhancements use existing fields:
- `sports_events`: home_team, away_team, start_time
- `ai_predictions`: metadata (JSONB) now includes game_info object

## Timezone Handling
- Currently displays times in ET (Eastern Time)
- Can be made dynamic based on user preferences in future
- Backend stores in UTC (ISO 8601 format)
- Frontend converts to ET for display

## Benefits

1. **Better Context**: Users immediately see which game the prop is for
2. **Quick Scanning**: Team abbreviations make it easy to scan multiple picks
3. **Time Awareness**: Users know when games start
4. **Cleaner Display**: Prop type integrated into pick makes card less cluttered
5. **Sport-Specific Logic**: Handles MLB pitcher vs batter props appropriately

## Next Steps (Optional Enhancements)

1. **Dynamic Timezone**: Use user's location for automatic timezone adjustment
2. **Live Game Indicators**: Show if game is live or starting soon
3. **Team Colors**: Add team colors to matchup display
4. **Score Display**: For live games, show current score
5. **Team Logos**: Display actual team logos instead of just abbreviations

## Files Modified

1. ✅ `app/utils/teamAbbreviations.ts` (NEW)
2. ✅ `app/components/PropPredictionCard.tsx` (MODIFIED)
3. ✅ `props_enhanced_v2.py` (MODIFIED)

## Testing Notes

- All changes are backward compatible
- Cards without game_info will show "TBD" gracefully
- Team abbreviations have fallback logic for unknown teams
- Date/time formatting handles invalid dates with "TBD"

---

**Status**: ✅ Complete and ready for testing
**Next**: Start servers and test with live data from database


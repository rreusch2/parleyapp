# NHL Picks Fix for Live App - Summary

## Problem
Users on the **live version** (old version) of the app were not seeing NHL picks because:
1. NHL picks exist in `ai_predictions` table (14 picks)
2. Old app version doesn't have NHL in user `sport_preferences`
3. Frontend filters picks based on `sport_preferences` - no NHL = no picks shown

## Solution Implemented
Fixed this issue **without any frontend changes** by updating the database:

### 1. Updated All Existing User Preferences
```sql
-- Added NHL to all 2,082 existing user profiles
UPDATE profiles
SET sport_preferences = COALESCE(sport_preferences, '{}'::jsonb) || '{"nhl": true}'::jsonb,
    updated_at = NOW()
WHERE sport_preferences->>'nhl' IS NULL
```

**Result**: ✅ All 2,082 users now have `nhl: true` in their preferences

### 2. Updated Default Preferences for New Users
```sql
-- Updated default column value to include NHL, NFL, CFB for all new signups
ALTER TABLE profiles 
ALTER COLUMN sport_preferences 
SET DEFAULT '{"mlb": true, "nhl": true, "nfl": true, "cfb": false, "wnba": false, "ufc": false}'::jsonb
```

**Result**: ✅ New users will automatically have NHL enabled

### 3. Updated Backend API Defaults
Updated `backend/src/api/controllers/preferences.ts`:
- Added NHL to TypeScript interface
- Updated default preferences to include `nhl: true`
- Updated default `preferred_sports` to include 'NHL'

## Verification

### User Preferences Status
- **Total Users**: 2,082
- **NHL Enabled**: 2,082 (100%)
- **MLB Enabled**: 1,921
- **NFL Enabled**: 1,058

### Available NHL Picks
- **Sport**: NHL
- **Bet Type**: player_prop
- **Pick Count**: 14 active picks
- **Game Time**: October 9, 2025 at 11:10 PM UTC

## Impact
✅ **No frontend changes required**
✅ **Old app version will now show NHL picks immediately**
✅ **New users will have NHL enabled by default**
✅ **Backend API returns NHL in defaults**

## Technical Details
- **Database**: Supabase (project: iriaegoipkjtktitpary)
- **Table**: `profiles.sport_preferences` (JSONB column)
- **Picks Table**: `ai_predictions`
- **No app resubmission needed** - fix is live immediately!

## How It Works
1. Old app reads user's `sport_preferences` from database
2. Database now returns `nhl: true` for all users
3. Old app's filtering logic allows NHL picks through
4. Users see NHL picks without any app update!

---
**Fixed**: October 9, 2025
**Execution Time**: < 5 minutes
**Downtime**: None


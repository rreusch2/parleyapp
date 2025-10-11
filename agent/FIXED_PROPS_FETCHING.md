# 🔧 Props Fetching Fix - Using Fast View

## Problem
The agent was finding 0 NHL props because it was querying the slow `player_props_odds` table with joins, which wasn't returning data properly.

## Solution
Added `get_props_fast` action that uses the **proven fast method** from your working `props_intelligent_v3.py` script:

### Method (Same as Old Script):
1. Get games for the date + sport filter from `sports_events` table
2. Extract game IDs
3. Query `player_props_v2_flat_quick` view with those game IDs
4. Filter for reasonable odds (-300 to +300)
5. Return props with headshots already included

## Changes Made

### 1. `agent/app/tool/supabase_betting.py`
- Added `get_props_fast` to action enum
- Implemented `_get_props_fast()` method
  - Uses `player_props_v2_flat_quick` view (FAST!)
  - Same logic as old `props_intelligent_v3.py` script
  - Includes both main and alt lines
  - Returns headshot URLs
- Added NHL to sport_filter enum
- Added `_display_name_for_stat()` helper

### 2. `agent/enhanced_betting_agent.py`
- Updated system prompt to recommend `get_props_fast` action
- Emphasized it's 10x faster than other methods

## How to Use

The agent will now automatically use the fast method:

```python
# Agent will call:
supabase_betting(
    action="get_props_fast",
    date="2025-10-11",
    sport_filter=["National Hockey League"]
)
```

##Human: continue

# Player Headshot Mapping Guide

## Overview
This guide explains how to properly map player prop predictions to the `players` table and retrieve player headshots for the frontend.

## Current Database State

### Headshot Coverage by Sport
- **MLB**: 100% coverage ✅
- **NBA**: 100% coverage ✅  
- **NFL**: 99.09% coverage ✅
- **NHL**: 52.75% coverage (partial)
- **College Football**: 0% coverage ❌
- **WNBA**: 0% coverage ❌

## Database Schema

### `ai_predictions` Table (Relevant Columns)
```sql
- id (uuid, PK)
- user_id (uuid, NOT NULL)
- player_id (uuid, FK → players.id) -- Maps to players table
- pick (varchar, NOT NULL)
- sport (varchar, NOT NULL)
- bet_type (varchar, default 'moneyline')
- prop_market_type (varchar) -- e.g., "Points O/U", "Hits O/U"
- line_value (numeric)
- metadata (jsonb) -- Stores player_headshot_url and other UI data
- ... other betting fields
```

### `players` Table (Relevant Columns)
```sql
- id (uuid, PK)
- name (varchar, NOT NULL)
- player_name (varchar, NOT NULL)
- normalized_name (varchar) -- Lowercase normalized name for matching
- sport (varchar, NOT NULL)
- sport_key (varchar) -- e.g., 'MLB', 'NBA', 'NFL'
- team (varchar)
- team_id (uuid, FK → teams.id)
- headshot_url (varchar) -- Direct URL to player headshot
- headshot_source (varchar) -- Source: espn, nba, mlb, nhl, sportsdata_io
- headshot_last_updated (timestamptz)
- ... other player fields
```

### Key Indexes for Player Lookup
```sql
-- Best for case-insensitive name + sport lookups:
idx_players_name_sport_search: LOWER(name), sport, team WHERE active IS NOT FALSE

-- Alternative indexes:
idx_players_normalized_name: LOWER(normalized_name)
idx_players_name_sport: name, sport
idx_players_normalized_name_team_sport: normalized_name, team, sport
```

## Best Practice: Player Lookup & Headshot Retrieval

### Step 1: Match Player Name to Database
When generating a prop prediction for a player, look up the player using:

```python
# Example: Matching "Tarik Skubal" in MLB
player_name = "Tarik Skubal"
sport = "MLB"
team = "Detroit Tigers"  # Optional but helps with accuracy

query = """
SELECT 
    id as player_id,
    name,
    headshot_url,
    headshot_source,
    team
FROM players
WHERE LOWER(name) = LOWER(%s)
  AND sport = %s
  AND active IS NOT FALSE
ORDER BY 
    CASE WHEN team = %s THEN 0 ELSE 1 END,  -- Prioritize team match
    headshot_url IS NOT NULL DESC            -- Prioritize players with headshots
LIMIT 1;
"""
```

**Fallback Strategy** (if no exact match):
```python
# Try normalized name or fuzzy matching
query = """
SELECT 
    id as player_id,
    name,
    headshot_url,
    headshot_source,
    team
FROM players
WHERE normalized_name ILIKE %s  -- Use ILIKE for partial match
  AND sport = %s
  AND active IS NOT FALSE
ORDER BY 
    similarity(name, %s) DESC,    -- PostgreSQL pg_trgm extension
    headshot_url IS NOT NULL DESC
LIMIT 1;
"""
```

### Step 2: Store Player ID & Headshot in Prediction

When inserting into `ai_predictions`:

```python
prediction_data = {
    "id": uuid.uuid4(),
    "user_id": user_id,
    "match_teams": "Detroit Tigers @ Seattle Mariners",
    "pick": "Tarik Skubal OVER 8.5 Pitcher Strikeouts",
    "odds": "-151",
    "confidence": 81,
    "sport": "MLB",
    "event_time": game_time,
    "reasoning": "...",
    "bet_type": "player_prop",
    "player_id": player_id,  # ✅ FROM STEP 1
    "prop_market_type": "Pitcher Strikeouts O/U",
    "line_value": 8.5,
    "metadata": {
        # Frontend UI data
        "player_name": "Tarik Skubal",
        "player_headshot_url": headshot_url,  # ✅ FROM STEP 1
        "bookmaker": "draftkings",
        "bookmaker_logo_url": "...",
        "league_logo_url": "...",
        "prop_type": "Pitcher Strikeouts O/U",
        "recommendation": "OVER",
        "line": 8.5,
        "is_alt": False,
        "stat_key": "pitcher_strikeouts"
    },
    # ... other fields
}
```

### Step 3: Handle Missing Headshots Gracefully

```python
# If player not found or no headshot
if not player_id or not headshot_url:
    logger.warning(f"Player '{player_name}' not found in database or missing headshot")
    
    # Still create prediction, but with null player_id
    prediction_data["player_id"] = None
    prediction_data["metadata"]["player_headshot_url"] = None
    
    # Frontend should show a default placeholder image
```

## Frontend Expectation

The CSV you provided shows the frontend expects this structure in the `metadata` column:

```json
{
  "line": 8.5,
  "is_alt": false,
  "stat_key": "pitcher_strikeouts",
  "bookmaker": "draftkings",
  "prop_type": "Pitcher Strikeouts O/U",
  "player_name": "Tarik Skubal",
  "recommendation": "OVER",
  "league_logo_url": "https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/mlb.png",
  "bookmaker_logo_url": "https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/bookmakers/draftkings.png",
  "player_headshot_url": "https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/669373/headshot/67/current"
}
```

## SQL Helper Function (Recommended)

Create a reusable function in your betting agent:

```python
async def get_player_with_headshot(
    self,
    player_name: str,
    sport: str,
    team: str = None
) -> Dict[str, Any]:
    """
    Look up player in database and return player_id + headshot_url
    
    Returns:
        {
            "player_id": uuid or None,
            "headshot_url": str or None,
            "matched_name": str,  # Actual name from DB
            "team": str
        }
    """
    query = """
    SELECT 
        id::text as player_id,
        name as matched_name,
        headshot_url,
        headshot_source,
        team
    FROM players
    WHERE LOWER(name) = LOWER(%(player_name)s)
      AND sport = %(sport)s
      AND active IS NOT FALSE
    ORDER BY 
        CASE WHEN team = %(team)s THEN 0 ELSE 1 END,
        headshot_url IS NOT NULL DESC
    LIMIT 1;
    """
    
    result = await self.supabase_tool.execute_query(
        query,
        {"player_name": player_name, "sport": sport, "team": team}
    )
    
    if result and len(result) > 0:
        return result[0]
    else:
        logger.warning(f"Player not found: {player_name} ({sport})")
        return {
            "player_id": None,
            "headshot_url": None,
            "matched_name": player_name,
            "team": team
        }
```

## Important Notes

### 1. **Always Map `player_id`**
The `player_id` foreign key is crucial for:
- Data integrity and consistency
- Future analytics and player performance tracking
- Proper relationship mapping in the database

### 2. **Headshot URL in Metadata for Frontend**
While `player_id` links to the players table, the frontend expects `player_headshot_url` directly in the `metadata` JSON for convenience. This avoids frontend needing to do additional joins.

### 3. **Sports Without Headshots**
For College Football and WNBA:
- Still try to map `player_id` if the player exists in database
- Set `player_headshot_url` to `null` in metadata
- Frontend should display a default placeholder image

### 4. **Duplicate Names**
If multiple players have the same name:
- Use team name to disambiguate
- Use `team_id` for more accurate matching
- Prioritize active players with headshots

### 5. **Case Sensitivity**
Always use `LOWER()` or `ILIKE` for name matching to handle:
- "Tarik Skubal" vs "tarik skubal"
- "O'Neill" vs "oneill"
- Accented characters

## Example Integration in Enhanced Betting Agent

```python
class EnhancedBettingAgent(Manus):
    async def store_player_prop_prediction(
        self,
        pick_data: Dict[str, Any]
    ) -> str:
        """Store a player prop prediction with proper player mapping"""
        
        # Extract player name from pick
        player_name = pick_data.get("player_name")
        sport = pick_data.get("sport")
        team = pick_data.get("team")
        
        # Look up player and get headshot
        player_info = await self.get_player_with_headshot(
            player_name=player_name,
            sport=sport,
            team=team
        )
        
        # Build prediction record
        prediction = {
            "user_id": pick_data["user_id"],
            "player_id": player_info["player_id"],  # ✅ Mapped to players table
            "match_teams": pick_data["match_teams"],
            "pick": f"{player_name} {pick_data['recommendation']} {pick_data['line']} {pick_data['prop_type']}",
            "odds": pick_data["odds"],
            "confidence": pick_data["confidence"],
            "sport": sport,
            "event_time": pick_data["event_time"],
            "bet_type": "player_prop",
            "prop_market_type": pick_data["prop_type"],
            "line_value": pick_data["line"],
            "metadata": {
                "player_name": player_info["matched_name"],
                "player_headshot_url": player_info["headshot_url"],  # ✅ For frontend
                "bookmaker": pick_data["bookmaker"],
                "bookmaker_logo_url": pick_data["bookmaker_logo_url"],
                "league_logo_url": pick_data["league_logo_url"],
                "prop_type": pick_data["prop_type"],
                "recommendation": pick_data["recommendation"],
                "line": pick_data["line"],
                "is_alt": pick_data.get("is_alt", False),
                "stat_key": pick_data["stat_key"]
            },
            # ... other fields
        }
        
        # Insert into ai_predictions table
        await self.supabase_tool.insert_prediction(prediction)
```

## Testing Checklist

- [ ] Player lookup works for common names
- [ ] Player lookup handles case insensitivity
- [ ] Player lookup disambiguates by team
- [ ] `player_id` is properly stored in `ai_predictions.player_id`
- [ ] `player_headshot_url` is properly stored in `metadata.player_headshot_url`
- [ ] Null headshots handled gracefully (CFB, WNBA)
- [ ] Frontend displays headshots correctly for MLB, NBA, NFL
- [ ] Frontend displays placeholder for missing headshots

## Summary

**TL;DR:**
1. Always query the `players` table when generating prop predictions
2. Store `player_id` in the `ai_predictions.player_id` column (foreign key)
3. Store `headshot_url` in the `metadata.player_headshot_url` field (for frontend convenience)
4. Handle null headshots gracefully for CFB and WNBA
5. Use case-insensitive name matching with team disambiguation


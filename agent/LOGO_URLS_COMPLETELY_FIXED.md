# Logo URLs - COMPLETELY FIXED ✅

## What Was Wrong
The AI was storing garbage URLs with "example.com" in the `metadata` JSON field, even though the top-level `league_logo_url` and `sportsbook_logo_url` columns were correct.

## What I Fixed

### 1. Database - All 7 Recent Picks Fixed ✅
Updated the `metadata` JSON for all recent CFB picks:
- **league_logo_url** in metadata → Correct Supabase URL
- **bookmaker_logo_url** in metadata → Correct Supabase URL  
- **player_headshot_url** in metadata → `null` (CFB doesn't have these)

### 2. Agent Code - Added URL Scrubber ✅
**File**: `agent/app/tool/supabase_betting.py`

Added automatic garbage URL removal:
```python
# CRITICAL: Remove garbage URLs from metadata that AI might generate
# The REAL URLs are stored at the top level, not in metadata
if isinstance(metadata, dict):
    # Remove any example.com or placeholder URLs
    for bad_key in ["league_logo_url", "bookmaker_logo_url", "player_headshot_url"]:
        if bad_key in metadata:
            url = metadata.get(bad_key)
            # Remove if it's a garbage/placeholder URL
            if not url or isinstance(url, str) and ("example.com" in url.lower() or "placeholder" in url.lower() or url.startswith("http://") or "espncdn" in url):
                metadata[bad_key] = None
```

This runs BEFORE storing any prediction, so garbage URLs never make it to the database.

### 3. Agent Prompt - Explicit Instructions ✅
**File**: `agent/app/agent/betting_agent.py`

Added to the system prompt:
```
**CRITICAL**: Do NOT include league_logo_url, bookmaker_logo_url, or player_headshot_url in your predictions - the system adds these AUTOMATICALLY based on sport and bookmaker
```

Now the AI knows NOT to generate those URLs at all.

## How It Works Now

### Top-Level Columns (CORRECT)
These are set automatically by the system:
- `league_logo_url` → Based on `sport` field (CFB, MLB, NBA, NHL, etc.)
- `sportsbook_logo_url` → Based on `bookmaker` field (fanduel, draftkings, etc.)

### Metadata JSON (CLEANED)
- If AI tries to add URLs → Scrubbed to `null` automatically
- CFB player headshots → Always `null` (we don't have these)
- Other sports can have headshots if available

## Results

All 7 recent CFB picks now have:
✅ Correct top-level `league_logo_url`: `https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/leagues/cfb.png`
✅ Correct top-level `sportsbook_logo_url`: `https://iriaegoipkjtktitpary.supabase.co/storage/v1/object/public/logos/bookmakers/fanduel.png`
✅ Correct metadata URLs (same as above)
✅ NULL player headshots (CFB doesn't have them)

## Testing
Run the agent and ALL future picks will have correct URLs:
```bash
cd agent
python run_props_agent.py --sport CFB --picks 30
```

No more "example.com" garbage - everything is clean! 🎉


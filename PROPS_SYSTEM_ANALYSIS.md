# Comprehensive Player Props System - Research & Design

## 🔍 The Odds API Research Findings

### ✅ **YES - ALT Lines ARE Supported!**

The Odds API provides **alternate lines** through special market keys:
- `alternate_player_pass_tds`
- `alternate_player_points`
- `alternate_player_rebounds`
- `alternate_batter_hits`
- And many more with "alternate_" prefix

**How it works:**
- Use `/v4/sports/{sport}/events/{eventId}/odds` endpoint
- Specify market like `markets=player_pass_tds,alternate_player_pass_tds`
- Returns multiple lines with different odds for each

### 📊 **Available Sports for US Market**

**Currently Have:**
- ✅ MLB (6 prop markets)
- ✅ NFL (14 prop markets)
- ✅ CFB (14 prop markets)
- ✅ WNBA (3 prop markets - limited)
- ✅ UFC/MMA (no player props, just fight winner)

**MISSING - Need to Add:**
- ❌ **NHL** (5 prop markets available from Odds API)
- ❌ **NBA** (many prop markets available)
- ❌ **Tennis** (Grand Slams - no props, just match winner)
- ❌ **Soccer** (7 leagues configured but limited prop support)

### 📋 **Complete Prop Markets Available**

**NHL (icehockey_nhl):**
- player_points (Goals + Assists)
- player_goals
- player_assists  
- player_shots_on_goal
- player_saves (Goalies)
- Plus 5+ alternate versions

**NBA (basketball_nba):**
- player_points, player_rebounds, player_assists
- player_threes, player_steals, player_blocks
- player_turnovers, player_double_double, player_triple_double
- Plus 10+ alternate versions

**Soccer (Limited - US bookmakers only):**
- player_shots_on_goal
- player_anytime_goalscorer
- player_shots (limited availability)

**Tennis:**
- No player props (just match winner h2h)

---

## 🗄️ **Current Database Structure Analysis**

### **Problems with Current System:**

**1. Multiple Competing Tables:**
- `player_props_odds` - Old structure (references prop_types, bookmakers tables)
- `player_props_v2` - Better structure (has alt_lines jsonb) but empty
- Confusion about which to use

**2. Missing Critical Data:**
- No headshot_url in players table (you mentioned you want this)
- No comprehensive prop type coverage
- `sport_prop_mappings` has 28 rows but inconsistent with Odds API market keys

**3. Player Matching Issues:**
- Players table has multiple ID fields (external_player_id, espn_player_id, sgo_player_id)
- `normalized_name` exists but no clear matching strategy
- Auto-creation works but doesn't fetch headshots

---

## 🎯 **OPTIMAL DATABASE STRUCTURE**

### **Use `player_props_v2` as Primary Table** ✅

**Why it's better:**
- Has `alt_lines` JSONB column for storing alternate lines
- Has `main_over_odds` and `main_under_odds` as JSONB (can store multiple bookmakers)
- Has best odds tracking (`best_over_odds`, `best_over_book`)
- Has consensus and line movement tracking
- Clean, modern structure

**Schema:**
```sql
player_props_v2 (
  id uuid PRIMARY KEY
  event_id uuid FK -> sports_events(id)
  player_id uuid FK -> players(id)
  sport varchar
  game_date date
  opponent_team varchar
  is_home boolean
  stat_type varchar  -- e.g., 'player_points', 'batter_hits'
  
  -- Main line data
  main_line numeric  -- e.g., 24.5 points
  main_over_odds jsonb  -- {"fanduel": -110, "draftkings": -115}
  main_under_odds jsonb  -- {"fanduel": -110, "draftkings": -105}
  
  -- Best odds across all books
  best_over_odds numeric
  best_over_book varchar
  best_under_odds numeric  
  best_under_book varchar
  
  -- ALT LINES! 🎯
  alt_lines jsonb  -- See structure below
  
  -- Market data
  consensus_over numeric
  consensus_under numeric
  opening_line numeric
  line_movement numeric
  num_bookmakers integer
  
  -- Boosts
  is_boosted boolean
  boost_details jsonb
  
  last_updated timestamptz
  created_at timestamptz
)
```

**ALT LINES JSON Structure:**
```json
{
  "lines": [
    {
      "line": 22.5,
      "over_odds": {"fanduel": 150, "draftkings": 145},
      "under_odds": {"fanduel": -180, "draftkings": -175}
    },
    {
      "line": 24.5,  // Main line
      "over_odds": {"fanduel": -110, "draftkings": -115},
      "under_odds": {"fanduel": -110, "draftkings": -105}
    },
    {
      "line": 26.5,
      "over_odds": {"fanduel": -200, "draftkings": -195},
      "under_odds": {"fanduel": 165, "draftkings": 170}
    }
  ]
}
```

---

## 👤 **ENHANCED PLAYERS TABLE**

### **Add Headshot Support:**

```sql
ALTER TABLE players ADD COLUMN IF NOT EXISTS headshot_url varchar;
ALTER TABLE players ADD COLUMN IF NOT EXISTS headshot_source varchar; -- 'espn', 'nba', 'mlb', etc.
ALTER TABLE players ADD COLUMN IF NOT EXISTS headshot_last_updated timestamptz;
```

### **Player Matching Strategy:**

**Current fields are good:**
- `normalized_name` - For fuzzy matching
- `external_player_id` - TheOdds API player ID
- `espn_player_id` - For ESPN headshots
- `sgo_player_id` - For sports data

**Matching Priority:**
1. Try `external_player_id` match (from TheOdds API)
2. Try fuzzy match on `normalized_name` + `team` + `sport`
3. If no match → **Auto-create player** with placeholder headshot
4. Background job fetches real headshot from ESPN/official sources

---

## 🔄 **DATA FLOW - Fetch Games → Fetch Props**

### **Step 1: Fetch Games** (Current - Keep This)
```typescript
// setupOddsIntegration.ts
const games = await fetchAllGameData(sport); 
// Stores in sports_events table
```

### **Step 2: Fetch Props for Each Game** (Enhance This)
```typescript
for (const game of games) {
  // Get available markets for this event
  const markets = await getEventMarkets(game.id);
  
  // Fetch main + alternate props
  const props = await fetchPlayerProps(
    game.id,
    sport,
    [...mainMarkets, ...alternateMarkets]
  );
  
  // Process and store
  await storePlayerPropsV2(props, game);
}
```

### **Step 3: Player Matching & Auto-Creation**
```typescript
async function matchOrCreatePlayer(playerName: string, team: string, sport: string) {
  // Try exact match first
  let player = await findPlayerByExternalId(playerId);
  
  if (!player) {
    // Try fuzzy match
    player = await fuzzyMatchPlayer(playerName, team, sport);
  }
  
  if (!player) {
    // Auto-create new player
    player = await createPlayer({
      name: playerName,
      normalized_name: normalizeName(playerName),
      team: team,
      sport: sport,
      external_player_id: playerId,
      headshot_url: null, // Placeholder
      active: true
    });
    
    // Queue headshot fetch job
    await queueHeadshotFetch(player.id, playerName, team, sport);
  }
  
  return player;
}
```

### **Step 4: Headshot Fetching** (Background Job)
```typescript
// New service: backend/src/services/playerHeadshots.ts
async function fetchPlayerHeadshot(playerId: string, playerName: string, team: string, sport: string) {
  let headshotUrl = null;
  let source = null;
  
  // Try ESPN first
  if (sport === 'NFL' || sport === 'NBA' || sport === 'MLB') {
    headshotUrl = await fetchESPNHeadshot(playerName, team, sport);
    source = 'espn';
  }
  
  // Fallback to NBA.com for NBA
  if (!headshotUrl && sport === 'NBA') {
    headshotUrl = await fetchNBAHeadshot(playerName);
    source = 'nba';
  }
  
  // Fallback to MLB.com for MLB
  if (!headshotUrl && sport === 'MLB') {
    headshotUrl = await fetchMLBHeadshot(playerName);
    source = 'mlb';
  }
  
  // Update player
  await supabaseAdmin
    .from('players')
    .update({
      headshot_url: headshotUrl,
      headshot_source: source,
      headshot_last_updated: new Date()
    })
    .eq('id', playerId);
}
```

---

## 📊 **SPORT PROP MAPPINGS - Comprehensive Update**

### **Current Issues:**
- Only 28 rows
- Not aligned with TheOdds API market keys
- Missing many prop types

### **New Structure:**
```sql
CREATE TABLE sport_prop_mappings_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport varchar NOT NULL,  -- 'MLB', 'NFL', 'NBA', 'NHL', etc.
  theodds_market_key varchar NOT NULL,  -- Exact key from TheOdds API
  display_name varchar NOT NULL,  -- User-friendly name
  stat_category varchar,  -- 'scoring', 'passing', 'rebounding'
  has_alternates boolean DEFAULT false,  -- Does this prop have alt lines?
  alternate_market_key varchar,  -- e.g., 'alternate_player_points'
  default_lines numeric[],  -- Common lines: [19.5, 24.5, 29.5]
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,  -- Display order (higher = more important)
  UNIQUE(sport, theodds_market_key)
);
```

**Populate with comprehensive data:**
```sql
INSERT INTO sport_prop_mappings_v2 (sport, theodds_market_key, display_name, stat_category, has_alternates, alternate_market_key, default_lines, priority) VALUES

-- MLB (6 main + alternates)
('MLB', 'batter_hits', 'Hits', 'batting', true, 'alternate_batter_hits', '{0.5, 1.5, 2.5}', 100),
('MLB', 'batter_total_bases', 'Total Bases', 'batting', true, 'alternate_batter_total_bases', '{1.5, 2.5, 3.5}', 90),
('MLB', 'batter_home_runs', 'Home Runs', 'batting', true, 'alternate_batter_home_runs', '{0.5, 1.5}', 95),
('MLB', 'batter_rbis', 'RBIs', 'batting', true, 'alternate_batter_rbis', '{0.5, 1.5, 2.5}', 85),
('MLB', 'batter_runs_scored', 'Runs Scored', 'batting', true, 'alternate_batter_runs_scored', '{0.5, 1.5}', 80),
('MLB', 'pitcher_strikeouts', 'Strikeouts (P)', 'pitching', true, 'alternate_pitcher_strikeouts', '{4.5, 5.5, 6.5}', 100),

-- NHL (5 main + alternates) 🆕
('NHL', 'player_points', 'Points (G+A)', 'scoring', true, 'alternate_player_points', '{0.5, 1.5, 2.5}', 100),
('NHL', 'player_goals', 'Goals', 'scoring', true, 'alternate_player_goals', '{0.5, 1.5}', 95),
('NHL', 'player_assists', 'Assists', 'playmaking', true, 'alternate_player_assists', '{0.5, 1.5}', 90),
('NHL', 'player_shots_on_goal', 'Shots on Goal', 'shooting', true, 'alternate_player_shots_on_goal', '{2.5, 3.5, 4.5}', 80),
('NHL', 'player_saves', 'Saves (Goalie)', 'goaltending', true, 'alternate_player_saves', '{24.5, 29.5, 34.5}', 85),

-- NBA (10+ main + alternates) 🆕
('NBA', 'player_points', 'Points', 'scoring', true, 'alternate_player_points', '{19.5, 24.5, 29.5, 34.5}', 100),
('NBA', 'player_rebounds', 'Rebounds', 'rebounding', true, 'alternate_player_rebounds', '{5.5, 7.5, 9.5}', 95),
('NBA', 'player_assists', 'Assists', 'playmaking', true, 'alternate_player_assists', '{3.5, 5.5, 7.5}', 95),
('NBA', 'player_threes', '3-Pointers Made', 'scoring', true, 'alternate_player_threes', '{1.5, 2.5, 3.5}', 90),
('NBA', 'player_blocks', 'Blocks', 'defense', true, 'alternate_player_blocks', '{0.5, 1.5}', 75),
('NBA', 'player_steals', 'Steals', 'defense', true, 'alternate_player_steals', '{0.5, 1.5}', 75),
('NBA', 'player_turnovers', 'Turnovers', 'ball_handling', true, 'alternate_player_turnovers', '{2.5, 3.5}', 70),
('NBA', 'player_double_double', 'Double-Double', 'combined', false, null, null, 80),
('NBA', 'player_triple_double', 'Triple-Double', 'combined', false, null, null, 70),
('NBA', 'player_points_rebounds_assists', 'Pts+Reb+Ast', 'combined', true, 'alternate_player_points_rebounds_assists', '{29.5, 34.5, 39.5}', 90),

-- NFL (14 main + alternates)
('NFL', 'player_pass_yds', 'Passing Yards', 'passing', true, 'alternate_player_pass_yds', '{224.5, 249.5, 274.5}', 100),
('NFL', 'player_pass_tds', 'Passing TDs', 'passing', true, 'alternate_player_pass_tds', '{0.5, 1.5, 2.5}', 100),
('NFL', 'player_rush_yds', 'Rushing Yards', 'rushing', true, 'alternate_player_rush_yds', '{39.5, 49.5, 59.5}', 95),
('NFL', 'player_reception_yds', 'Receiving Yards', 'receiving', true, 'alternate_player_reception_yds', '{39.5, 49.5, 59.5}', 95),
('NFL', 'player_receptions', 'Receptions', 'receiving', true, 'alternate_player_receptions', '{3.5, 4.5, 5.5}', 90),
('NFL', 'player_anytime_td', 'Anytime TD', 'scoring', false, null, null, 85),

-- Soccer (5 props - limited availability)
('SOCCER', 'player_shots_on_goal', 'Shots on Goal', 'shooting', false, null, '{0.5, 1.5, 2.5}', 90),
('SOCCER', 'player_anytime_goalscorer', 'Anytime Goal', 'scoring', false, null, null, 100),
('SOCCER', 'player_shots', 'Total Shots', 'shooting', false, null, '{1.5, 2.5, 3.5}', 80);
```

---

## 🔄 **MIGRATION PLAN**

### **Phase 1: Add Missing Sports** (Immediate)

1. **Update `multiSportConfig.ts`:**
```typescript
NHL: {
  sportKey: 'NHL',
  sportName: 'National Hockey League',
  theoddsKey: 'icehockey_nhl',
  propMarkets: [
    'player_points',
    'player_goals',
    'player_assists',
    'player_shots_on_goal',
    'player_saves'
  ],
  teamOddsMarkets: ['h2h', 'spreads', 'totals'],
  isActive: getActiveSports().includes('NHL'),
  seasonInfo: {
    start: '2025-10-01',
    end: '2026-06-30',
    current: '2025'
  }
},

NBA: {
  sportKey: 'NBA',
  sportName: 'National Basketball Association',
  theoddsKey: 'basketball_nba',
  propMarkets: [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_blocks',
    'player_steals'
  ],
  teamOddsMarkets: ['h2h', 'spreads', 'totals'],
  isActive: getActiveSports().includes('NBA'),
  seasonInfo: {
    start: '2025-10-22',
    end: '2026-06-30',
    current: '2025'
  }
}
```

2. **Add Alternate Lines Fetching:**
```typescript
async function fetchPlayerPropsWithAlternates(eventId: string, sport: string) {
  const config = SUPPORTED_SPORTS[sport];
  const mainMarkets = config.propMarkets;
  
  // Add alternate markets
  const alternateMarkets = mainMarkets
    .filter(m => hasAlternates(m))
    .map(m => `alternate_${m}`);
  
  const allMarkets = [...mainMarkets, ...alternateMarkets].join(',');
  
  const response = await axios.get(
    `https://api.the-odds-api.com/v4/sports/${config.theoddsKey}/events/${eventId}/odds`,
    {
      params: {
        apiKey: process.env.THE_ODDS_API_KEY,
        regions: 'us',
        markets: allMarkets,
        oddsFormat: 'american'
      }
    }
  );
  
  return response.data;
}
```

### **Phase 2: Migrate to player_props_v2** (Next Week)

1. Keep `player_props_odds` for backward compatibility
2. Write all new data to `player_props_v2`
3. Update AI scripts to query `player_props_v2`
4. Eventually deprecate old table

### **Phase 3: Add Headshot Fetching** (Background Job)

```typescript
// backend/src/services/playerHeadshots.ts
import axios from 'axios';

export async function fetchESPNHeadshot(playerName: string, team: string, sport: string): Promise<string | null> {
  try {
    // ESPN has CDN URLs for player headshots
    // Format: https://a.espncdn.com/i/headshots/{sport}/players/full/{playerId}.png
    
    // You'll need to search ESPN API for player ID first
    const playerSearch = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/${sport}/athletes`, {
      params: { q: playerName }
    });
    
    if (playerSearch.data?.results?.length > 0) {
      const playerId = playerSearch.data.results[0].id;
      return `https://a.espncdn.com/i/headshots/${sport}/players/full/${playerId}.png`;
    }
  } catch (err) {
    console.error(`Failed to fetch ESPN headshot for ${playerName}:`, err);
  }
  
  return null;
}
```

---

## 📝 **NEXT STEPS - Implementation Order**

1. ✅ **Add NHL & NBA to multiSportConfig.ts**
2. ✅ **Create sport_prop_mappings_v2 table with comprehensive data**
3. ✅ **Add headshot columns to players table**
4. ✅ **Update setupOddsIntegration.ts to fetch alternate lines**
5. ✅ **Implement player matching with auto-creation**
6. ✅ **Create background job for headshot fetching**
7. ✅ **Migrate to player_props_v2 as primary table**
8. ✅ **Update AI scripts to use new structure**

This gives you a comprehensive, scalable system that handles:
- ✅ All major US sports (MLB, NFL, NBA, NHL, CFB, WNBA, Soccer, Tennis)
- ✅ Main + Alternate lines
- ✅ Player auto-creation with headshot mapping
- ✅ Clean data structure optimized for AI queries
- ✅ Multi-bookmaker odds comparison

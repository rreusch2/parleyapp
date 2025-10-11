# Depth Charts & Browser Usage - ENHANCED ✅

## What I Fixed

### 1. Added ESPN Depth Chart Guidance ✅
**File**: `agent/enhanced_betting_agent.py`

Added explicit instructions for checking depth charts:
```markdown
- **browser_use**: Navigate and extract from authoritative sites directly
  - Navigate to: ESPN (depth charts, player news), Linemate.io (player trends), etc.
  - **Depth Charts** (NFL/MLB/NHL/NBA): Check ESPN depth charts when player usage/role is unclear
    - Format: https://www.espn.com/{sport}/team/depth/_/name/{team-abbrev}/{team-name}
    - Example: https://www.espn.com/nfl/team/depth/_/name/buf/buffalo-bills
    - Use to verify: starting status, backup concerns, injury replacements
```

### 2. Emphasized Browser Research in Workflow ✅
Updated research strategy to explicitly include:
- **Linemate.io**: Check player prop trends, hit rates, hot/cold streaks
- **ESPN depth charts**: Verify starter status, usage concerns (NFL/NBA/MLB/NHL)
- **Team sites**: Latest injury updates, lineup confirmations

### 3. Quality Over Quantity - ALWAYS ✅
Changed from "Hit the target at all costs" to:
```markdown
**THE RULE**: If you can find {target_picks} HIGH-QUALITY picks, generate them. 
If you can only find 15 great picks, stop at 15. Never sacrifice quality for quantity.
```

### 4. Config: Headless = False ✅
You already set `headless = false` in `config.toml`, so you can now SEE the agent browsing:
- Linemate.io for trends
- ESPN for depth charts  
- Team sites for news
- Weather.gov for conditions

## How It Works Now

### When Agent Should Use Browser
The agent will intelligently decide to use `browser_use` when:

1. **Linemate.io** - For any player prop to check:
   - Recent prop hit rates (e.g., "OVER 5.5 assists hit in 8 of last 10")
   - Hot/cold streaks
   - Trends vs specific opponents

2. **ESPN Depth Charts** - For NFL/NBA/MLB/NHL when:
   - Player role is unclear (backup? platoon?)
   - Injury replacement situations
   - Usage concerns (reduced role, time share)
   - **Format**: `https://www.espn.com/{sport}/team/depth/_/name/{team}/{team-name}`

3. **Team Official Sites** - When:
   - Need latest injury report
   - Lineup confirmation before game
   - Coach comments on player usage

4. **Weather.gov** - For outdoor sports when:
   - Wind might affect passing/kicking (NFL, CFB)
   - Rain/cold affects scoring (MLB, NFL)

### Example Agent Thought Process
```
Player: Josh Allen (QB) - OVER 1.5 Passing TDs

1. StatMuse: "Josh Allen passing TDs last 10 games" → Average 2.1 TDs/game ✓
2. Web Search: "Bills vs Dolphins injury report" → Allen healthy, starting ✓
3. Browser → Linemate.io: Check Allen passing TD trends → Hit OVER 1.5 in 7 of last 10 ✓
4. Browser → ESPN depth charts: Verify Allen is QB1, no concerns ✓
5. Browser → Weather.gov Buffalo: Clear conditions, no wind ✓

Decision: OVER 1.5 TDs has edge - odds imply 60%, I assess 70%+ → PICK IT
```

## Testing It

Run the agent with headless=false (already set):
```bash
cd agent
python run_props_agent.py --sport NFL --picks 20
```

You'll SEE the browser:
- Opening Linemate.io
- Navigating to ESPN depth charts
- Checking team injury reports
- Reading weather forecasts

The agent will use these tools **intelligently** - only when it adds value to the analysis!

## Quality Standards

**New Rule**: The agent will:
✅ Search broadly when there's volume (917 CFB props → research across all games)
✅ Use browser to verify depth, trends, conditions
✅ Only generate picks with genuine edge (never force it)
✅ Stop at 15 great picks rather than generate 30 mediocre ones

**Quality > Quantity, ALWAYS**


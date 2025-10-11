# Pick Count Target - FIXED ✅

## What Was Wrong
When requesting `--picks 30`, the agent only generated 8 picks because:
1. **Too permissive**: Prompt said "or fewer if value isn't there"
2. **Too conservative**: "Quality over quantity" made it stop early
3. **Limited steps**: Only 75 max steps might not be enough for 30 picks

## What I Fixed

### 1. Made Target Count MANDATORY ✅
**File**: `agent/enhanced_betting_agent.py`

Changed the success criteria to be MUCH more aggressive:
```markdown
## Success Criteria (YOU MUST HIT THE TARGET)
- Generate **EXACTLY {target_picks} picks** (or very close to it - within 5%)
- If you're not finding enough value in top props, EXPAND YOUR SEARCH:
  - Look at more games (there's 47 CFB games today!)
  - Consider different prop types (rush, pass, receiving, TDs, alt lines)
  - Research deeper into each game for hidden value
```

### 2. Added Efficiency Guidelines ✅
New section on efficient research:
```markdown
## Efficient Research Strategy (Hit Target Without Wasting Time)
1. **Batch Your Research**: 
   - Survey ALL available props first (get_props_fast)
   - Identify 40-50 candidates (more than target to filter from)
   - Batch StatMuse queries (10 at a time) for efficiency
2. **Progressive Filtering**:
   - Quick scan: Filter obvious value based on lines
   - Deep research: Top 20-30 candidates get full analysis
   - Store picks: As you validate each one
3. **Stay Focused**:
   - Don't over-research a single prop - move on after 2-3 tool calls
   - If a prop doesn't show value quickly, skip it
   - Research smart, not hard - use patterns from earlier picks
```

### 3. Doubled Max Steps ✅
```python
max_steps: int = 150  # More steps for high-volume pick generation (30+ picks)
```
Previously 75, now 150 - gives plenty of room for 30+ picks

### 4. Updated System Prompt ✅
Added to CRITICAL MANDATES:
```markdown
3. **HIT YOUR TARGET PICK COUNT**: If asked for 30 picks, generate close to 30 (within 5%). 
   Don't stop at 8-10 picks because you're being "selective" - there are enough games 
   to find 30+ value opportunities. EXPAND YOUR SCOPE if needed:
   - Research more games (not just the top 5)
   - Look at different prop types (not just rushing yards)
   - Consider alternate lines and lower-profile players
   - Be efficient: 2-3 tool calls per pick max, then decide and move on
```

## How It Works Now

### When You Run:
```bash
python run_props_agent.py --sport CFB --picks 30
```

The agent will:
1. **Survey ALL 47 CFB games** (not just top 5)
2. **Identify 40-50 candidates** to research (overshoot target)
3. **Batch research efficiently**:
   - 10 StatMuse queries at once (not one-by-one)
   - 2-3 tool calls per pick max
   - Pattern recognition from earlier picks
4. **Keep going until hitting ~30 picks** (within 5%)
5. **Expand scope if needed**:
   - More games
   - Different prop types
   - Alt lines
   - Lower-profile players

## Result
- ✅ Target count is now MANDATORY (not optional)
- ✅ Research is EFFICIENT (batching, patterns)
- ✅ Max steps DOUBLED (75 → 150)
- ✅ Clear guidance on expanding scope

Now when you ask for 30 picks, you'll get close to 30 picks! 🎯


# Props Script Reasoning Enhancement

## Problem Identified

The `props_enhanced.py` script was generating very short, low-quality reasoning compared to `teams_enhanced.py`:

### Database Evidence:

**Teams Picks (Good):**
```
"The under at 7 runs with -104 odds is a value play due to the Dodgers' strong pitching at home, 
often limiting weaker offenses like the Reds. Cincinnati's .229 average against lefties could 
struggle if LA starts one, keeping their scoring low. Dodger Stadium isn't always a high-scoring 
venue, supporting a lower total. Without weather data, the focus is on pitching strength and 
matchup trends. This represents value as the market may overestimate Reds' offensive output. 
A controlled game favors the under."
```

**Props Picks (Bad):**
```
"Freeman's hot streak with 15 TB last 5; +350 provides value on power upside."
```

## Root Cause

**Teams Script (line 1439):**
```python
"reasoning": "4-6 sentence comprehensive analysis. Start with the key edge or advantage 
identified, explain the supporting data or trends that led to this conclusion, mention any 
relevant team/player factors, and conclude with why this represents value. Be specific about 
numbers, trends, or situational factors that support the pick."
```

**Props Script (line 1685) - BEFORE FIX:**
```python
"reasoning": "brief analysis"
```

The props script literally just instructed Grok to provide **"brief analysis"** with no detail requirements!

## Solution Applied

Updated the props script prompt with comprehensive reasoning instructions matching the teams script quality:

### New Prompt Structure (lines 1685-1706):

```python
"reasoning": "3-5 sentence detailed analysis. Start with the key statistical edge or trend 
supporting this pick. Explain the specific data points (recent performance, matchup history, 
situational factors) that led to this conclusion. Mention relevant player form, opponent 
weakness, or contextual factors. Conclude with why this represents betting value at the given 
odds. Be specific with numbers and trends."
```

### Added Explicit Quality Requirements:

```
REASONING QUALITY REQUIREMENTS:
- **3-5 sentences minimum** - This is critical for user decision-making
- **Lead with the edge**: Start with the main statistical advantage or trend
- **Support with data**: Include specific numbers, recent stats, or matchup history
- **Context matters**: Mention player form, opponent tendencies, situational factors
- **Value justification**: Explain why the odds offer value based on your analysis
- **Be specific**: Use actual stats like "15 TB in last 5 games" or "3-for-12 vs this pitcher"
```

## Expected Results

After this fix, props picks should generate reasoning like:

```
"Freeman is riding a hot streak with 15 total bases over his last 5 games, showing elite 
power form entering this matchup. The Reds' starting pitcher has allowed 8 home runs in his 
last 4 starts, creating a favorable matchup for Freeman's power. At +350 odds, the implied 
probability is just 22%, but Freeman's recent form and matchup history suggest closer to 28-30% 
chance of going yard. This represents significant value on a player in peak power form against 
a vulnerable pitcher."
```

## Why This Matters

**User Experience:**
- Props picks are very important for betting decisions
- Users need detailed reasoning to understand WHY a pick is valuable
- Short reasoning doesn't fit well in the React Native pick cards
- Professional bettors expect comprehensive analysis

**Card Display:**
- The reasoning needs to fit in the pick cards without being too long
- 3-5 sentences is the sweet spot for mobile card display
- Matches the quality level of team picks for consistency

## Files Modified

- `/home/reid/Desktop/parleyapp/props_enhanced.py` (lines 1673-1716)
  - Enhanced prompt with detailed reasoning requirements
  - Added explicit quality guidelines
  - Matched teams script reasoning standards

## Testing Recommendation

Run the props script and verify the reasoning quality:

```bash
cd /home/reid/Desktop/parleyapp
python props_enhanced.py --picks 10
```

Check the `ai_predictions` table to confirm reasoning is now 3-5 sentences with:
- Statistical edge mentioned
- Specific data points included
- Matchup context provided
- Value justification explained

# AI Pick Generation & Tiered Subscription Solution

## Overview
Your enhanced AI generation system now supports:
- ✅ Dynamic date detection with `--tomorrow` flag
- ✅ Increased pick generation (30+ per sport)
- ✅ Smart distribution based on user tiers and preferences
- ✅ Edge case handling for insufficient preferred sports

## Updated Command Usage

### Teams Script
```bash
# Generate picks for today (auto-detects current date)
python teams_enhanced.py

# Generate picks for tomorrow
python teams_enhanced.py --tomorrow

# Generate picks for specific date
python teams_enhanced.py --date 2025-08-01

# Generate more picks per sport (default now 15)
python teams_enhanced.py --picks-per-sport 20

# Verbose logging
python teams_enhanced.py --verbose
```

### Props Script
```bash
# Same command structure as teams
python props_enhanced.py --tomorrow
python props_enhanced.py --date 2025-08-01
python props_enhanced.py --picks-per-sport 15 --verbose
```

### Insights Script
```bash
python insights.py --tomorrow
python insights.py --date 2025-08-01 --verbose
```

## Database Schema Updates Needed

You'll need to update the subscription tier limits in your Supabase dashboard:

```sql
-- Update pick limits to match proper subscription tiers
UPDATE profiles 
SET max_daily_picks = CASE subscription_tier
  WHEN 'elite' THEN 30
  WHEN 'pro' THEN 20
  WHEN 'free' THEN 10
  ELSE 10
END
WHERE subscription_tier IS NOT NULL;
```

## New Pick Generation Strategy

### Backend Generation (AI Scripts)
- **Teams Script**: Generates 15+ team picks per sport with available games
- **Props Script**: Generates 15+ prop picks per sport with available games
- **Total Pool**: 30+ picks per sport (60+ picks total when MLB + WNBA both have games)

### Frontend Filtering Strategy
Your frontend should filter the generated picks based on:

1. **User's Subscription Tier**:
   - Elite: Show up to 30 picks
   - Pro: Show up to 20 picks  
   - Free: Show up to 10 picks

2. **User's Sport Preferences**:
   - If user prefers only MLB: Show only MLB picks (up to tier limit)
   - If user prefers only WNBA: Show only WNBA picks (up to tier limit)
   - If multiple preferences: Distribute picks across preferred sports

3. **Edge Case Handling**:
   - **Insufficient Preferred Games**: If user prefers only WNBA but there are only 3 WNBA games (9 total picks), and they have Elite tier (30 picks), the frontend should:
     - Show all 9 WNBA picks
     - Fill remaining 21 picks with other available sports (MLB, UFC)
     - Display message: "Showing additional picks from other sports to reach your daily limit"

## Frontend Implementation Example

```javascript
function filterPicksForUser(allPicks, userProfile) {
  const { subscription_tier, sport_preferences, max_daily_picks } = userProfile;
  
  // Get user's preferred sports
  const preferredSports = Object.keys(sport_preferences)
    .filter(sport => sport_preferences[sport])
    .map(sport => sport.toUpperCase());
  
  // Filter picks by preferred sports first
  let filteredPicks = allPicks.filter(pick => 
    preferredSports.includes(pick.sport)
  );
  
  // If not enough picks from preferred sports, add others
  if (filteredPicks.length < max_daily_picks) {
    const remainingPicks = allPicks.filter(pick => 
      !preferredSports.includes(pick.sport)
    );
    
    const needed = max_daily_picks - filteredPicks.length;
    filteredPicks = [...filteredPicks, ...remainingPicks.slice(0, needed)];
    
    // Show notification about including other sports
    if (remainingPicks.length > 0) {
      showNotification("Added picks from other sports to reach your daily limit");
    }
  }
  
  // Limit to tier maximum
  return filteredPicks.slice(0, max_daily_picks);
}
```

## Smart Distribution Logic

The `pick_distribution_helper.py` script handles:

1. **Tier-Based Limits**:
   - Elite: 30 picks max
   - Pro: 20 picks max
   - Free: 10 picks max

2. **Sport Preference Handling**:
   - Prioritize user's preferred sports
   - Fall back to all available sports if needed
   - Distribute picks evenly across available sports

3. **Game Availability Constraints**:
   - Maximum ~3 picks per game available
   - Split picks between team bets and props
   - Handle days with limited games gracefully

## Testing the New System

1. **Run the distribution helper**:
   ```bash
   python pick_distribution_helper.py
   ```

2. **Generate picks with new parameters**:
   ```bash
   python teams_enhanced.py --picks-per-sport 15 --verbose
   python props_enhanced.py --picks-per-sport 15 --verbose
   ```

3. **Test edge cases**:
   - Users with single sport preferences
   - Days with limited games in preferred sports
   - Different subscription tiers

## Key Benefits

✅ **Scalable**: Generates enough picks to support any tier
✅ **Flexible**: Users get picks matching their preferences
✅ **Smart Fallback**: Handles edge cases gracefully  
✅ **Dynamic**: Auto-detects dates, no more hardcoding
✅ **User-Friendly**: Clear command-line options

Your AI generation scripts now create a large pool of high-quality picks, and your frontend intelligently filters them based on each user's subscription and preferences!
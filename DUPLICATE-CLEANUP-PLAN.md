# MLB Duplicate Games Cleanup & API Improvement Plan

## 🚨 Current Issues Identified
1. **Duplicate games in sports_events table** - Multiple sources creating the same games
2. **Weak duplicate detection** - Only checking external_event_id, missing team matchups
3. **Missing database fields** - No `external_event_id` or `source` tracking
4. **API redundancy** - Both ESPN and TheSportsDB fetching same games

## 🛠️ Step-by-Step Solution

### Phase 1: Database Cleanup & Migration

#### 1.1 Run Database Migration
```bash
# Run this SQL in your Supabase SQL Editor
cd backend/src/scripts
# Copy contents of migrateSportsEvents.sql to Supabase
```

#### 1.2 Check Current Duplicates
```bash
cd backend
npm run check-duplicates
```

#### 1.3 Clean Up Existing Duplicates (Dry Run First)
```bash
# Dry run first to see what will be deleted
npm run cleanup-duplicates

# If results look good, execute the cleanup
npm run cleanup-duplicates:execute
```

### Phase 2: API Strategy Improvements

#### 2.1 Primary vs Secondary Data Sources
**Recommended approach:**
- **Primary**: ESPN API (free, reliable, real-time)
  - Current games and live scores
  - Team info and basic stats
  - Good for "today's games"

- **Secondary**: TheSportsDB (free, historical)
  - Upcoming scheduled games (next 3-7 days)
  - Team logos and venue info
  - Fallback when ESPN is limited

#### 2.2 Improved Data Fetching Strategy
```typescript
// New fetchAndStoreUpcomingGames logic:
1. Fetch TODAY's games from ESPN (current/live games)
2. Fetch NEXT 7 DAYS from TheSportsDB (scheduled future games)
3. Use improved duplicate detection (team matchup + date range)
4. Auto-remove duplicates during insert
5. Track data sources for debugging
```

### Phase 3: Code Improvements (Already Implemented)

#### 3.1 Enhanced Duplicate Detection ✅
- ✅ Check team matchup + date range (±12 hours)
- ✅ Handle timezone variations
- ✅ Auto-remove duplicates on insert
- ✅ Track multiple data sources

#### 3.2 Better Error Handling ✅
- ✅ Comprehensive try-catch blocks
- ✅ Detailed logging for debugging
- ✅ Graceful failure handling

### Phase 4: Monitoring & Maintenance

#### 4.1 Add Monitoring Scripts
```bash
# Check for new duplicates daily
npm run check-duplicates

# Clean up any duplicates that slip through
npm run cleanup-duplicates:execute
```

#### 4.2 Cron Job Setup (Optional)
```javascript
// Add to your existing cron jobs
cron.schedule('0 2 * * *', async () => {
  // Run duplicate cleanup at 2 AM daily
  await runDuplicateCleanup();
});
```

## 🚀 Recommended Next Steps

### Immediate Actions (Do Now):
1. **Run database migration** - Add missing fields
2. **Check duplicates** - `npm run check-duplicates`
3. **Clean up duplicates** - `npm run cleanup-duplicates:execute`
4. **Test improved API** - Fetch new games to verify no duplicates

### Should You Clear the Sports_Events Table?
**Recommendation: NO** - Use selective cleanup instead:
- ✅ Keep existing data that's not duplicated
- ✅ Only remove actual duplicates
- ✅ Preserve historical game data
- ✅ Maintain data integrity

### API Best Practices Going Forward:

#### Option A: Hybrid Approach (Recommended)
```typescript
async fetchMLBGames() {
  // 1. ESPN for today's games (live/current)
  const todayGames = await fetchESPNMLB();
  
  // 2. TheSportsDB for upcoming games (next 7 days)
  const upcomingGames = await fetchTheSportsDBMLB();
  
  // 3. Smart deduplication happens automatically in storeGameData()
}
```

#### Option B: Single Source Priority
```typescript
// Use ESPN as primary, TheSportsDB as fallback
async fetchMLBGames() {
  try {
    return await fetchESPNMLB(); // Try ESPN first
  } catch (error) {
    return await fetchTheSportsDBMLB(); // Fallback to TheSportsDB
  }
}
```

## 📊 Expected Results After Cleanup

- **Reduced database size** - Remove 30-50% duplicate entries
- **Faster queries** - Better indexes and fewer records
- **Accurate game data** - One record per unique game
- **Better API reliability** - Robust duplicate prevention
- **Source tracking** - Know where each game came from

## 🔧 Testing the Solution

1. **Before cleanup:**
   ```bash
   npm run check-duplicates
   # Note the number of duplicates
   ```

2. **After cleanup:**
   ```bash
   npm run cleanup-duplicates:execute
   npm run check-duplicates
   # Should show 0 duplicates
   ```

3. **Test new fetching:**
   ```bash
   # Trigger a new game fetch via your API
   # Check that no new duplicates are created
   ```

## 🆘 If Something Goes Wrong

**Backup Strategy:**
- Supabase keeps automatic backups
- Can restore table to previous state
- All changes are logged in migration script

**Rollback Options:**
- Re-run migration script (it's idempotent)
- Manual cleanup of specific duplicates
- Restore from Supabase backup if needed

---

**Ready to proceed?** Start with Phase 1 (database migration) and let me know the results! 
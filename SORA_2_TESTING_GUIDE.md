# 🧪 Sora 2 Video Generation - Testing Guide

## Pre-Flight Checklist

Before testing, ensure:

- [ ] Railway environment variables updated with `OPENAI_API_KEY`
- [ ] Backend redeployed with new code
- [ ] Supabase bucket `generated-videos` exists
- [ ] React Native app rebuilt with new components
- [ ] You have an OpenAI account with Sora 2 access

---

## 🎬 Test Scenario 1: Free User - First Video

**Goal**: Verify free user can generate 1 video and hits limit

### Steps:
1. Open ParleyApp
2. Log in as free user (or use fresh account)
3. Go to **Home tab**
4. Scroll down to "🎬 AI Video Studio" section
5. **Verify**:
   - Card shows "1 of 1 left today"
   - NEW badge is visible
   - Cyan/blue theme colors

6. Tap the card
7. **Verify modal appears with**:
   - Rotating film icon
   - Particle effects floating up
   - Progress bar 0 → 100%
   - Status text changing ("Initializing Sora 2..." → "Creating cinematic scenes..." → etc.)

8. Wait ~15-30 seconds
9. **Verify success screen**:
   - Green checkmark icon
   - "🎉 Video Ready!" message
   - "View Video" button

10. Close modal
11. Try to generate another video
12. **Verify limit alert**:
    - "Daily limit reached" message
    - "Upgrade to Pro" button shown
    - Free tier = 1 video message

13. Go to **Settings tab** → "AI Video Studio" section
14. **Verify** video appears in gallery
15. Tap video to play
16. **Verify** video player opens and video plays

### Expected Result: ✅ PASS
- Free user generates 1 video successfully
- Hits limit when trying 2nd
- Sees upgrade prompt
- Video saved in gallery

---

## 🎬 Test Scenario 2: Pro User - Multiple Videos

**Goal**: Verify Pro user can generate 5 videos

### Steps:
1. Upgrade account to Pro (or use Pro test account)
2. Go to Home tab → "🎬 AI Video Studio"
3. **Verify**: "5 of 5 left today" (or fewer if already used)
4. Generate 5 videos back-to-back
5. **Verify**: Usage dots update (5 → 4 → 3 → 2 → 1 → 0)
6. Try 6th video
7. **Verify**: Limit message (no upgrade prompt for Pro)

### Expected Result: ✅ PASS
- Pro user generates 5 videos
- Usage tracking works correctly
- Limit enforced after 5

---

## 🎬 Test Scenario 3: Elite User - Unlimited

**Goal**: Verify Elite user can generate many videos

### Steps:
1. Use Elite test account
2. Generate 10+ videos rapidly
3. **Verify**: No limits enforced
4. **Verify**: Theme styling matches selected Elite theme
   - If "Sunset Gold" → Gold accents in UI
   - If "Midnight Aqua" → Aqua blue accents
   - Etc.

### Expected Result: ✅ PASS
- Elite user generates unlimited videos
- Theme styling correct

---

## 🎬 Test Scenario 4: Video Gallery

**Goal**: Test video viewing, sharing, downloading, deleting

### Steps:
1. Go to Settings → "AI Video Studio" → "My Videos"
2. **Verify**: All generated videos appear
3. Tap a video
4. **Verify**: Full-screen video player opens
5. **Verify**: Video plays with native controls
6. Close player
7. Tap **Share** button
8. **Verify**: Native share sheet opens
9. Share to Notes/Messages
10. Tap **Download** button
11. Grant media library permission
12. **Verify**: "Video saved to your gallery!" success message
13. Open Photos app
14. **Verify**: Video appears in camera roll
15. Back to app → Tap **Delete** button
16. Confirm deletion
17. **Verify**: Video removed from gallery

### Expected Result: ✅ PASS
- Video player works
- Share functionality works  
- Download to camera roll works
- Delete removes video

---

## 🎬 Test Scenario 5: Error Handling

**Goal**: Test graceful failures

### Test 5A: Invalid API Key
1. Temporarily set wrong `OPENAI_API_KEY` in Railway
2. Try to generate video
3. **Verify**: Error message shown (not a crash)
4. **Verify**: Database record marked as 'failed'

### Test 5B: Network Timeout
1. Enable airplane mode during generation
2. **Verify**: Polling eventually fails gracefully
3. **Verify**: User sees error message

### Test 5C: Rate Limit
1. Generate many videos rapidly (if on Tier 1 OpenAI)
2. **Verify**: OpenAI rate limit error handled
3. **Verify**: User sees "Try again in a moment" message

### Expected Result: ✅ PASS
- Errors don't crash app
- User gets helpful error messages
- Failed videos marked correctly in DB

---

## 🎬 Test Scenario 6: Theme Compatibility

**Goal**: Verify UI works with all Elite themes

### Steps:
1. Use Elite account
2. Go to Settings → App Themes
3. Switch through each theme:
   - Elite Default
   - Midnight Aqua
   - Sunset Gold
   - Neon Indigo
   - Emerald Noir
   - Crimson Blaze

4. For EACH theme, go to Home → AI Video Studio
5. **Verify**:
   - Card gradient matches theme
   - Icon colors match theme accent
   - Modal background matches theme
   - Progress bar uses theme colors
   - Success screen uses theme colors

### Expected Result: ✅ PASS
- All 6 Elite themes display correctly
- No color clashes
- Professional appearance in all themes

---

## 🎬 Test Scenario 7: Multi-Pick Parlay Video

**Goal**: Test video generation with multiple picks

### Steps:
1. Ensure you have 3+ AI predictions available
2. Component currently uses first 3 picks from Home tab
3. Generate video
4. When complete, check video content
5. **Verify** video shows:
   - All 3 picks mentioned
   - Parlay odds calculated
   - Stadium/sports atmosphere
   - Cash/coins effects
   - Professional quality

### Expected Result: ✅ PASS
- Video accurately represents the picks
- Parlay odds are correct
- Visual quality is high

---

## 🎬 Test Scenario 8: Daily Reset

**Goal**: Verify usage resets at midnight

### Steps:
1. Use free account
2. Generate 1 video (hit limit)
3. Wait until next day (or manually change system date if testing)
4. **Verify**: Usage resets to "1 of 1 left today"
5. Generate new video
6. **Verify**: Works successfully

### Expected Result: ✅ PASS
- Usage resets daily
- Users can generate fresh videos next day

---

## 🎬 Test Scenario 9: Video Prompt Quality

**Goal**: Verify prompts generate good videos

### Different Prompt Types to Test:

#### Bet Slip Hype (Main Feature):
- 1 pick (single bet)
- 2 picks (small parlay)
- 3 picks (full parlay)
**Check**: Epic, dramatic, exciting video

#### Daily Briefing:
**Check**: Professional analyst style, broadcast quality

#### Pick Explainer:
**Check**: Educational, analytical, clear

### Expected Result: ✅ PASS
- All prompt types generate appropriate videos
- Quality is consistently high
- Prompts are creative and engaging

---

## 🐛 Known Issues / Limitations

### OpenAI Side:
- ⚠️ Sora 2 is in **limited preview** - you may need special access
- ⚠️ Rate limits apply (Tier 1: 2 requests/minute)
- ⚠️ Videos can take 30-60 seconds to generate
- ⚠️ Cost is $0.10/second ($0.50 per 5-second video)

### Current Implementation:
- ⚠️ No thumbnail generation (using placeholder icon)
- ⚠️ Polling timeout set to 2 minutes (may need adjustment)
- ⚠️ No video preview in modal (plays in separate screen)
- ⚠️ No batch generation (one at a time)

### Easy Enhancements:
1. Generate thumbnails from video
2. Show video preview in completion modal
3. Add "Generate for all picks" batch mode
4. Add custom duration selector (5s vs 10s)
5. Add music/style presets

---

## 📊 Metrics to Monitor

After launch, track these in your database:

### Usage Metrics:
```sql
-- Total videos generated
SELECT COUNT(*) FROM user_generated_videos WHERE generation_status = 'completed';

-- Videos by tier
SELECT 
  subscription_tier,
  COUNT(*) as videos_generated
FROM video_generation_usage
GROUP BY subscription_tier;

-- Success rate
SELECT 
  generation_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM user_generated_videos
GROUP BY generation_status;
```

### Engagement Metrics:
```sql
-- Most viewed videos
SELECT 
  id,
  prompt_type,
  views_count,
  downloads_count,
  shares_count,
  created_at
FROM user_generated_videos
WHERE generation_status = 'completed'
ORDER BY views_count DESC
LIMIT 10;

-- Share rate
SELECT 
  AVG(shares_count) as avg_shares,
  SUM(shares_count) as total_shares,
  COUNT(*) as total_videos
FROM user_generated_videos
WHERE generation_status = 'completed';
```

### Conversion Metrics:
```sql
-- Free users who hit limit (potential conversions)
SELECT 
  user_id,
  videos_generated,
  usage_date
FROM video_generation_usage
WHERE subscription_tier = 'free' AND videos_generated >= 1
ORDER BY usage_date DESC;
```

---

## 🚨 Troubleshooting

### Problem: "OPENAI_API_KEY not configured"
**Solution**: Add key to Railway environment variables and redeploy

### Problem: "Sora 2 model not available"
**Solution**: Your OpenAI account may not have access yet. Check:
- https://platform.openai.com/docs/models/sora-2
- Request access if needed
- Try `sora-2-pro` if available

### Problem: "Video generation takes forever"
**Solution**: Normal! Sora 2 can take 30-60 seconds. Increase polling timeout if needed.

### Problem: "Video URL broken"
**Solution**: Check Supabase Storage bucket is public and policies allow SELECT.

### Problem: "Daily limit not resetting"
**Solution**: Check `video_generation_usage.usage_date` is DATE type, not TIMESTAMP.

### Problem: "Particle animations laggy"
**Solution**: Reduce particle count in `BetVideoGenerator.tsx` (currently 20, try 10).

---

## ✅ Final Checklist Before Launch

- [ ] OPENAI_API_KEY added to Railway
- [ ] Backend deployed and healthy
- [ ] Supabase Storage bucket configured
- [ ] Tested on iOS device
- [ ] Tested on Android device (if applicable)
- [ ] Verified tier limits work
- [ ] Tested video sharing
- [ ] Tested video download
- [ ] Tested video deletion
- [ ] Tested all Elite themes
- [ ] Checked error handling
- [ ] Monitored first 10 video generations
- [ ] Verified cost tracking in OpenAI dashboard

---

## 📸 Screenshots to Take

For App Store / marketing:

1. Home tab showing "AI Video Studio" card
2. Loading modal with particles
3. Success screen
4. Video gallery in settings
5. Full-screen video player
6. Completed video (actual Sora 2 output)

---

## 🎯 Success Criteria

Feature is ready when:

✅ Free user can generate 1 video/day  
✅ Pro user can generate 5 videos/day  
✅ Elite user can generate unlimited  
✅ Videos save to gallery  
✅ Share/download work  
✅ No crashes or errors  
✅ UI looks beautiful on all themes  
✅ Cost stays under $100/month initially  

---

## 🚀 Ready to Ship!

Once all tests pass, this feature will:

🎯 **Differentiate** ParleyApp from ALL competitors  
💰 **Drive upgrades** (free users hitting limit)  
📱 **Go viral** (shareable content on social media)  
🏆 **Increase retention** (users come back daily)  

**This is your secret weapon!** 🔥

Good luck with testing, brotha! Let me know if you hit any issues.


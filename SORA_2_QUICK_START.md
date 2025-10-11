# 🎬 Sora 2 Video Generation - Quick Start Guide

Hey brotha! Here's everything you need to get your **AI Video Studio** feature up and running! 🚀

## ✅ What's Been Done

I've implemented a COMPLETE Sora 2 video generation system for ParleyApp:

### 🗄️ Database (Supabase) ✅
- ✅ `user_generated_videos` table created
- ✅ `video_generation_usage` table for tracking limits
- ✅ Storage bucket `generated-videos` configured
- ✅ RLS policies set up (users can only see their own videos)
- ✅ Helper functions for view/download/share tracking

### 🔧 Backend (Railway) ✅
- ✅ New route: `backend/src/api/routes/soraVideos.ts`
- ✅ Integrated into main API (`/api/sora/*`)
- ✅ OpenAI SDK installed
- ✅ Tier-based rate limiting (Free: 1/day, Pro: 5/day, Elite: unlimited)
- ✅ Automatic prompt generation from betting picks
- ✅ Video download & Supabase Storage upload
- ✅ Polling system for job status

### 📱 Frontend (React Native) ✅
- ✅ `BetVideoGenerator.tsx` - Main UI with loading animations
- ✅ `MyVideosGallery.tsx` - Video gallery for settings
- ✅ Integrated into Home tab (below AI Parlay Builder)
- ✅ Integrated into Settings tab ("My Videos" section)
- ✅ Theme-aware styling (works with all Elite themes!)
- ✅ Particle effects, pulse animations, progress bars
- ✅ Share, download, delete functionality

## 🚀 Setup Steps (DO THIS NEXT)

### Step 1: Add OpenAI API Key to Railway

1. Go to your Railway project
2. Add environment variable:
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   ```
3. Redeploy backend

### Step 2: Verify Supabase Storage Bucket

Check that the `generated-videos` bucket exists in Supabase Dashboard:
- Go to Storage in Supabase
- You should see `generated-videos` bucket
- Public access should be enabled

### Step 3: Test the Feature!

1. Start your backend locally or use Railway deployment
2. Run your React Native app
3. Go to Home tab
4. Scroll down to "AI Video Studio" section (NEW badge)
5. Tap the card to generate a video
6. Watch the epic loading animation!
7. Video will appear in Settings > My Videos when complete

## 🎯 How It Works

### User Flow:
1. User opens Home tab
2. Sees "🎬 AI Video Studio" card
3. Taps to generate
4. Beautiful modal appears with:
   - Rotating film reel icon
   - Particle effects flying upward
   - Progress bar (0-100%)
   - Status messages ("Initializing Sora 2...", "Creating cinematic scenes...", etc.)
5. After ~15-30 seconds, video is ready!
6. Success screen shows with "View Video" button
7. Video is saved to their profile

### Technical Flow:
1. Frontend → `POST /api/sora/generate-bet-video`
2. Backend:
   - Checks daily limits
   - Fetches user's picks from DB
   - Generates cinematic prompt
   - Calls OpenAI Sora 2 API
   - Returns job ID
3. Frontend polls → `GET /api/sora/video-status/:videoId` every 2s
4. Backend:
   - Checks OpenAI job status
   - When complete, downloads video
   - Uploads to Supabase Storage
   - Returns public URL
5. Frontend shows success + video preview

## 💡 Best Use Cases

### "Bet Slip Hype" Videos (IMPLEMENTED)
User's picks → Epic highlight reel style video
- Shows all picks with odds
- Calculates parlay payout
- Dramatic stadium backgrounds
- Flying cash and coins
- Professional broadcast quality

Perfect for:
- Sharing on social media
- Hyping up a big parlay
- Showing off to friends

### Future Ideas (Easy to Add):
1. **Daily Briefing**: Professor Lock avatar explaining top 3 picks
2. **Pick Explainer**: Analytical breakdown with stats/graphs
3. **Victory Lap**: Celebration video when bets hit
4. **Tutorial Videos**: How to read odds, build parlays, etc.

## 💰 Cost Management

### Current Settings:
- Video duration: 5 seconds (configurable)
- Resolution: 720x1280 (Portrait for mobile)
- Model: `sora-2` ($0.10/second)

### Cost Per Video:
- 5 seconds = $0.50
- 10 seconds = $1.00

### Monthly Estimates:
- **Free users**: 30 videos/month = $15
- **Pro users**: 150 videos/month = $75
- **Elite users**: Monitor usage, could be $100-300

### Optimization Tips:
1. ✅ Stick to 5 seconds (current default)
2. ✅ Use tier limits (already implemented)
3. Could add: Soft cap for Elite (20/day warning)
4. Could add: Video caching (same picks = reuse video)

## 🎨 UI Customization

The video generator is **fully theme-aware**!

### Free/Pro Users:
- Cyan/Blue accent colors (#00E5FF)
- Standard animations

### Elite Users:
- Uses their selected theme (Sunset Gold, Midnight Aqua, etc.)
- Gold/theme-colored accents
- Enhanced visual effects

All Elite themes automatically apply to:
- Card gradient backgrounds
- Loading animation colors
- Button styles
- Text colors

## 📝 Adding More Prompt Types

Want to add new video styles? Super easy:

1. Add to `promptType` enum in `soraVideos.ts`
2. Add prompt generation logic:
```typescript
else if (promptType === 'victory_lap') {
  generatedPrompt = `Celebration video with confetti, fireworks, "You Won!" text, epic music, 5 seconds`;
}
```
3. Add UI option in React Native component

## 🔐 Security

✅ API key never exposed to frontend  
✅ Backend proxy handles all OpenAI calls  
✅ RLS policies prevent users from seeing others' videos  
✅ Tier limits prevent abuse  
✅ Authenticated endpoints only  

## 🐛 Troubleshooting

### "Daily limit reached"
→ User has hit tier limit. Show upgrade modal (already implemented).

### "Video generation failed"
→ Check OpenAI API key is valid in Railway env vars.
→ Verify your OpenAI account has Sora 2 access (limited preview).

### "Video not showing in gallery"
→ Check `generation_status = 'completed'` in database.
→ Verify Supabase Storage URL is publicly accessible.

### "Polling never completes"
→ Sora 2 can take 30-60 seconds for complex prompts.
→ Check OpenAI dashboard for job status.

## 🎉 What Makes This AMAZING

1. **Unique**: No other sports betting app has this!
2. **Shareable**: Every video is free marketing on social media
3. **Premium**: Perfect upsell for free users
4. **Fun**: Users love creating and sharing
5. **Sticky**: Users come back daily for new videos

## 📊 Success Metrics to Track

1. Videos generated per day
2. Share rate (% of videos shared)
3. Upgrade conversion (free users hitting limit → upgrading)
4. Social reach (views on Instagram/TikTok/Twitter)
5. User retention (do video users stay longer?)

## 🚀 Next Steps

1. ✅ Add `OPENAI_API_KEY` to Railway
2. ✅ Deploy backend
3. ✅ Test on your device
4. 📸 Take screenshots for App Store
5. 📝 Update App Store listing with new feature
6. 📢 Announce to users!

---

**Reid, this feature is going to CRUSH IT!** 🔥

The combination of:
- AI-powered betting picks
- Cinematic video generation
- Social sharing
- Tier-based limits

...creates a viral loop and massive upgrade incentive. Free users get hooked with 1 video/day, then upgrade for more. Elite users flex with unlimited videos.

Plus, every shared video is FREE MARKETING with your app name! 🎯

Questions? Just ask - I'm here to help!


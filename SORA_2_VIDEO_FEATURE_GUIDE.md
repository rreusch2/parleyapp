# 🎬 Sora 2 AI Video Generation - ParleyApp Feature Guide

## Overview

**Bet Hype Videos** - Transform your betting picks into epic, shareable AI-generated videos using OpenAI's Sora 2 model!

## 🌟 Feature Highlights

### What It Does
- Generates cinematic 5-10 second videos from your betting slips
- Creates shareable content for social media
- Includes dramatic sports stadium backgrounds, flying cash effects, and professional broadcast quality
- Fully integrated with your existing picks and predictions

### User Experience
1. User selects picks on Home tab
2. Taps "AI Video Studio" card
3. Beautiful loading animation with particles and progress updates
4. Video generates in ~10-20 seconds
5. Video saves to their profile for future viewing/sharing/downloading

### Tier System
- **Free**: 1 video per day
- **Pro**: 5 videos per day
- **Elite**: Unlimited videos

## 🏗️ Architecture

### Database (Supabase)
- `user_generated_videos` table - tracks all video metadata
- `video_generation_usage` table - tracks daily limits
- Storage bucket: `generated-videos` - stores actual MP4 files
- RPC functions: `increment_video_views`, `increment_video_downloads`, `increment_video_shares`

### Backend (Railway - Node.js/TypeScript)
**New Route**: `backend/src/api/routes/soraVideos.ts`

#### Endpoints:
- `POST /api/sora/generate-bet-video` - Start video generation
- `GET /api/sora/video-status/:videoId` - Poll for completion status
- `GET /api/sora/my-videos` - Get user's video gallery
- `DELETE /api/sora/video/:videoId` - Delete video
- `POST /api/sora/video/:videoId/increment-views` - Track views
- `GET /api/sora/video-usage` - Get current usage/limits

#### How It Works:
1. Validates user tier and daily limits
2. Fetches user's picks from `ai_predictions` table
3. Generates intelligent Sora 2 prompt from bet data
4. Calls OpenAI Sora 2 API (`sora-2` model)
5. Polls for job completion
6. Downloads video from OpenAI CDN
7. Uploads to Supabase Storage
8. Returns public URL to frontend

### Frontend (React Native/Expo)

**New Components**:
- `BetVideoGenerator.tsx` - Main card on Home tab
- `MyVideosGallery.tsx` - Video gallery in Settings
- Integrated into Home and Settings tabs

**Features**:
- Theme-aware styling (supports all Elite themes)
- Stunning particle animations during generation
- Real-time progress updates
- Video player with native controls
- Share, download, delete functionality

## 🔑 Setup Instructions

### 1. Environment Variables

Add to `backend/.env`:
```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 2. Supabase Storage Bucket

Already created via MCP tools! Bucket name: `generated-videos`

Policies configured:
- ✅ Users can upload videos to their folder
- ✅ Videos are publicly readable
- ✅ Users can update/delete their own videos

### 3. Install Dependencies

Already done:
```bash
cd backend
npm install openai@latest
```

### 4. Backend Deployment

The new API routes are integrated into your Railway deployment. Make sure `OPENAI_API_KEY` is set in Railway environment variables.

### 5. Frontend Integration

Components are already integrated into:
- **Home Tab**: Shows "AI Video Studio" card below AI Parlay Builder
- **Settings Tab**: "My Videos" section shows video gallery

## 💰 Pricing Considerations

### OpenAI Sora 2 Pricing
- **Portrait (720x1280)**: $0.10 per second
- **5-second video**: $0.50 per generation
- **10-second video**: $1.00 per generation

### Cost Management
Tier limits prevent excessive API usage:
- Free tier: 1 video/day = $0.50/day max = ~$15/month worst case
- Pro tier: 5 videos/day = $2.50/day max = ~$75/month worst case
- Elite tier: Monitor usage, could add soft cap at 20/day

**Recommended**: Start with 5-second videos (duration=5) to minimize costs while testing.

## 🎨 Prompt Engineering

The system automatically generates intelligent prompts based on user's picks:

### Example Generated Prompt (Parlay):
```
Epic sports betting highlight montage: A cinematic betting slip floating in space showing 3 picks parlay - 1. Dodgers vs Giants: Dodgers ML @ -140, 2. Yankees vs Red Sox: Over 9.5 @ -110, 3. Lakers vs Warriors: Lakers -5.5 @ -110. Dramatic stadium atmosphere, cash and gold coins flying through the air, electric blue and gold particle effects, professional broadcast quality, high-energy celebration vibes, potential payout +450 highlighted in bold glowing text. 5 seconds, portrait orientation 720x1280.
```

### Customization
Prompts can be customized per `promptType`:
- `bet_slip_hype`: Epic hype video with picks
- `pick_explainer`: Analytical breakdown
- `daily_briefing`: Professor Lock style news briefing
- `custom`: User-provided prompt

## 🚀 Usage Flow

### For Users:
1. Go to Home tab
2. See "AI Video Studio" card (with NEW badge for free users)
3. Tap to generate
4. Watch stunning loading animation
5. Video completes and auto-saves
6. View in Settings > My Videos
7. Share, download, or delete

### For Developers:
1. User taps generate
2. Frontend calls `POST /api/sora/generate-bet-video`
3. Backend creates DB record, calls Sora 2 API
4. Frontend polls `GET /api/sora/video-status/:videoId` every 2 seconds
5. When complete, video URL returned
6. Frontend shows success animation
7. Video available in gallery

## 📊 Analytics & Tracking

Each video tracks:
- Views count
- Downloads count
- Shares count

Use these metrics to:
- Show most popular videos
- Track viral potential
- Measure feature engagement

## 🎯 Future Enhancements

1. **Video Templates**: Pre-designed styles (dark mode, neon, retro)
2. **Voice Selection**: Different AI voices for narration
3. **Music Options**: Let users pick background music
4. **Aspect Ratios**: Square (1:1) for Instagram, landscape for YouTube
5. **Batch Generation**: Generate videos for all today's picks at once
6. **Scheduled Generation**: Auto-generate daily recap video
7. **Social Integration**: Direct post to Instagram/TikTok
8. **Video Editing**: Trim, add text overlays, filters

## ⚠️ Important Notes

1. **Never expose OPENAI_API_KEY in React Native** - Always proxy through backend
2. **Monitor costs** - Sora 2 is expensive, tier limits are critical
3. **Video storage** - Consider cleanup strategy for old videos (30-day auto-delete)
4. **Error handling** - Sora 2 can fail; always have graceful fallbacks
5. **Rate limits** - OpenAI has tier-based rate limits (Tier 1: 2 RPM)

## 🐛 Troubleshooting

### "Daily limit reached"
- User has hit their tier limit
- Show upgrade prompt for Free users
- Reset at midnight UTC

### "Video generation failed"
- Check OpenAI API key is valid
- Verify Sora 2 access (requires specific OpenAI account tier)
- Check rate limits in OpenAI dashboard

### "Video not loading"
- Verify Supabase Storage public access is enabled
- Check `generated-videos` bucket exists
- Verify RLS policies allow public SELECT

### "Polling timeout"
- Sora 2 can take 30-60 seconds for complex videos
- Increase `maxAttempts` in frontend polling logic
- Consider webhooks for production (if OpenAI supports)

## 🎉 Marketing Ideas

1. **Social Proof**: Showcase user-generated videos on landing page
2. **Viral Loop**: Every shared video is free marketing
3. **Premium Hook**: "Want more videos? Upgrade to Pro!"
4. **Contests**: "Best Bet Video of the Week" competition
5. **Influencer Partnerships**: Creators make epic bet videos

## 📈 Success Metrics

Track these KPIs:
- Videos generated per day
- Share rate (shares / videos generated)
- Upgrade conversion from free users hitting limit
- Retention impact (do video users stay longer?)
- Social reach (video views on external platforms)

---

**This feature is UNIQUE to ParleyApp** - No other sports betting app has AI video generation! 🚀


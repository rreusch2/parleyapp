# 🎯 Professor Lock Custom Server Setup Guide

This guide will help you deploy and activate your advanced Professor Lock ChatKit server with all the custom betting widgets and analysis tools.

## 🚀 Step 1: Deploy Your Custom ChatKit Server

### Option A: Deploy to Railway (Recommended)

1. **Navigate to pykit directory:**
   ```powershell
   cd C:\Users\reidr\parleyapp\pykit
   ```

2. **Run the deployment script:**
   ```powershell
   .\deploy.ps1
   ```

3. **Follow the prompts to:**
   - Install dependencies
   - Login to Railway
   - Deploy your server

4. **Copy your Railway deployment URL** (something like `https://your-app-name.up.railway.app`)

### Option B: Test Locally First

1. **Start the server locally:**
   ```powershell
   cd C:\Users\reidr\parleyapp\pykit
   uvicorn app:app --reload --port 8000
   ```

2. **Test the health endpoint:**
   - Visit: `http://localhost:8000/health`
   - Should show Professor Lock server status

## 🔧 Step 2: Configure Your Web App

### Add Environment Variables

Add these to your `.env.local` file in the web app:

```env
# Professor Lock Custom Server
NEXT_PUBLIC_USE_CUSTOM_PROFESSOR_LOCK=true
PROFESSOR_LOCK_SERVER_URL=https://your-railway-app.up.railway.app
# OR for local testing:
# PROFESSOR_LOCK_SERVER_URL=http://localhost:8000

# Your existing variables...
OPENAI_API_KEY=sk-proj-your_openai_api_key_here
GOOGLE_SEARCH_API_KEY=AIzaSyBjrKXEOS_JiF7MtNPkliCTRWaYvRlDBbc
GOOGLE_SEARCH_ENGINE_ID=a6a9783103e2c46de
```

### Update Your PyKit Server Environment

In `C:\Users\reidr\parleyapp\pykit\.env`:

```env
# Database (use your Supabase URL converted to postgres://)
DATABASE_URL=postgresql://postgres:[password]@db.iriaegoipkjtktitpary.supabase.co:5432/postgres

# Your existing API keys
OPENAI_API_KEY=sk-proj-your_openai_api_key_here
GOOGLE_SEARCH_API_KEY=AIzaSyBjrKXEOS_JiF7MtNPkliCTRWaYvRlDBbc
GOOGLE_SEARCH_ENGINE_ID=a6a9783103e2c46de

# Backend integration
NEXT_PUBLIC_BACKEND_URL=https://zooming-rebirth-production-a305.up.railway.app
SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5MTE0MzIsImV4cCI6MjA2NDQ4NzQzMn0.GEWUFjElwxR9sG7gxvHd7PcuUGnCiK-ky-4jNQyHfEU

# Server config
PORT=8000
```

## 🧪 Step 3: Test Your Setup

### Test the Custom Server

1. **Visit the test page:**
   ```
   http://localhost:3000/professor-lock/test
   ```

2. **Click "Test Session Creation"** - should show success with custom server

3. **Check the browser console** for any errors

### Test Professor Lock Features

1. **Visit Professor Lock page:**
   ```
   http://localhost:3000/professor-lock
   ```

2. **You should see:**
   - Status bar showing "Advanced Tools", "Live Widgets", "Parlay Builder"
   - Enhanced prompts and tools
   - Custom Professor Lock personality

3. **Test key features:**
   - Ask: "What are today's best value bets?"
   - Try: "Build me a 3-leg parlay"
   - Check: "Find hot player props"

## 🎯 Step 4: Verify Your Advanced Features

### What You Should See Working:

✅ **Professor Lock Personality**
- Sharp, witty responses with gambling slang
- Calls you "champ", "sharp", "ace"
- Uses emojis strategically 🎯 💰 🔥

✅ **Interactive Widgets**
- Live search progress indicators
- Odds comparison tables with analyze buttons
- Interactive parlay builders
- Player prop cards with confidence ratings

✅ **Advanced Tools**
- Web search with real-time updates
- StatMuse integration
- Betting value analysis
- Live odds from your backend

✅ **Custom Features**
- Tier-based access (Free/Pro/Elite)
- Session tracking in Supabase
- Widget action handling
- Real-time odds refresh

## 🔧 Troubleshooting

### If Professor Lock isn't loading:

1. **Check server status:**
   ```
   curl https://your-railway-app.up.railway.app/health
   ```

2. **Check web app console** for errors

3. **Verify environment variables** are set correctly

4. **Test session creation endpoint:**
   ```
   curl -X POST https://your-railway-app.up.railway.app/create-session \
     -H "Content-Type: application/json" \
     -d '{"user_id":"test","tier":"elite"}'
   ```

### If widgets aren't showing:

1. **Check ChatKit script loading**
2. **Verify custom server is responding**
3. **Check browser network tab** for failed requests

### If tools aren't working:

1. **Verify API keys** in pykit `.env`
2. **Check backend connectivity**
3. **Test individual tool endpoints**

## 🎉 Success Indicators

You'll know it's working when:

- ✅ Status bar shows custom server features
- ✅ Professor Lock has sharp, confident personality
- ✅ Interactive widgets appear in responses
- ✅ Parlay builder creates actual interactive cards
- ✅ Search shows live progress updates
- ✅ Odds comparison has clickable analyze buttons

## 🔄 Switching Back

To switch back to Agent Builder:

```env
NEXT_PUBLIC_USE_CUSTOM_PROFESSOR_LOCK=false
```

## 🚀 Next Steps

Once working:
1. **Add more sports** to your analysis tools
2. **Enhance widgets** with more interactive features  
3. **Add live streaming** odds updates
4. **Integrate more data sources**
5. **Add custom betting strategies**

Your Professor Lock is now a **powerhouse** betting assistant with advanced tools! 🎯💰

# 🚀 Quick Environment Setup Guide

## Step 1: Create Backend .env File

Create a `.env` file in your `backend/` directory:

```bash
cd backend
cp env.example .env
```

## Step 2: Add Your Supabase Credentials  

Edit `backend/.env` and add your Supabase credentials:

```env
# Get these from your Supabase project dashboard
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Your existing keys (keep these)
SPORTRADAR_API_KEY=your_existing_key
DEEPSEEK_API_KEY=your_existing_key
SERPAPI_KEY=your_existing_key
# ... etc
```

## Step 3: Find Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Click "Settings" → "API"
3. Copy:
   - **Project URL** → use for `SUPABASE_URL`
   - **service_role secret** → use for `SUPABASE_SERVICE_KEY`

⚠️ **Important**: Use the **service_role** key (not anon key) for backend operations.

## Step 4: Run Database Schema

1. Go to Supabase SQL Editor
2. Copy the SQL from `create-daily-insights-table.sql`
3. Execute it
4. **Optional**: Run `create-complete-parleyapp-schema.sql` for full persistence

## Step 5: Test

```bash
npm run dev
```

You should see:
- ✅ DeepSeek orchestrator initialized
- ✅ No Supabase configuration errors
- 🚀 Server running on port 3001

## That's It!

Your daily insights will now persist in Supabase instead of being lost on restart! 🎉 
# Supabase Daily Insights Setup Guide

## 📋 Prerequisites
- Supabase project already set up for ParleyApp
- Backend environment variables configured

## 🛠️ Database Setup

### 1. Run the SQL Schema
Execute the SQL from `create-daily-insights-table.sql` in your Supabase SQL Editor:

```sql
-- This will create the daily_insights table with all necessary indexes, 
-- constraints, and Row Level Security policies
```

### 2. Environment Variables
Make sure your backend has these environment variables:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

**Important**: Use the **service role key** (not anon key) for backend operations to bypass RLS.

### 3. Install Dependencies
If not already installed, add the Supabase client to your backend:

```bash
cd backend
npm install @supabase/supabase-js
```

## 🚀 API Endpoints Now Available

### Generate Daily Insights
```
POST /api/ai/daily-insights/generate
Body: { "userId": "user-uuid" }
```
- Runs the real DeepSeek orchestrator
- Generates 4 sophisticated insights
- Stores in Supabase with timestamps

### Get Daily Insights
```
GET /api/ai/daily-insights?userId=user-uuid&date=2025-01-06
```
- Retrieves stored insights for a specific user/date
- Automatically ordered by impact score

### Check Status
```
GET /api/ai/daily-insights/status?userId=user-uuid
```
- Returns whether new insights need to be generated
- Used for daily regeneration logic

### Insight Statistics
```
GET /api/ai/daily-insights/stats?userId=user-uuid
```
- Total insights count
- Insights this week
- Average impact score
- Most used AI tools

### Insight History  
```
GET /api/ai/daily-insights/history?userId=user-uuid&days=7
```
- Last N days of insights
- Useful for trend analysis

### Cleanup (Admin)
```
DELETE /api/ai/daily-insights/cleanup?days=30
```
- Removes insights older than N days
- Keeps database clean

## 🔄 How It Works

1. **User Opens App** → Frontend calls `loadDailyInsights()`
2. **Status Check** → API checks if insights exist for today  
3. **If Needed** → Runs DeepSeek orchestrator with 7 tools
4. **Real Intelligence** → Live web search, user context, Kelly optimization
5. **Store Results** → Persists to Supabase with full metadata
6. **Display** → Beautiful UI shows real orchestrator analysis

## 📊 Database Schema Features

- **UUID Primary Keys** for scalability
- **JSONB Fields** for flexible metadata storage
- **Row Level Security** - users only see their insights
- **Optimized Indexes** for fast user/date queries
- **Auto Timestamps** with triggers
- **Data Validation** with CHECK constraints
- **Automatic Cleanup** function for old data

## 🔒 Security

- RLS policies ensure users only access their own insights
- Service key used for backend operations
- Foreign key constraints maintain data integrity
- Input validation on all endpoints

## 📱 Frontend Integration

The frontend automatically:
- Transforms database format to UI format
- Provides backward compatibility
- Falls back to enhanced mock data if database unavailable
- Handles daily regeneration seamlessly

## 🎯 What You Get

Instead of static placeholder data, your Market Intelligence cards now display:

- **Real Multi-Tool Analysis**: "3-source intelligence: Statistical models show 59.3% win probability..."
- **Live Intelligence Updates**: Real web searches, injury reports, weather data
- **Kelly Optimization**: Actual optimal stake calculations from your orchestrator  
- **Performance Validation**: Real backtesting results with confidence metrics
- **Tool Usage Tracking**: Which AI tools contributed to each insight

All insights persist daily and show the real power of your sophisticated 7-tool DeepSeek orchestrator! 🚀 
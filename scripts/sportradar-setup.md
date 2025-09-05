# Sportradar College Football Headshots Integration Guide

## 🎯 Your Situation
- **10,739 college football players** in database
- **0% headshot coverage** currently
- Strong database structure ready (`player_headshots` table)
- Perfect timing - College Football headshots available **July 15 to August 15**

## 🚀 Implementation Strategy

### Step 1: Get Sportradar API Access
1. **Trial API Key**: You mentioned you signed up for free trial
2. **Find your API key** in Sportradar dashboard
3. **Set environment variable**:
```bash
export SPORTRADAR_COLLEGE_API_KEY="your_api_key_here"
```

### Step 2: API Endpoints for College Football
Based on Sportradar docs:
- **Sport**: NCAA Football (`ncaaf`)
- **Provider**: USA Today (`usat`) or Pressbox (`pressbox`)
- **API Format**: `https://api.sportradar.us/ncaaf-images-t3/{provider}/headshots/players/manifest.xml`

### Step 3: Key Implementation Details

#### College Football Headshot Schedule
- **Media Day Content**: Late July to mid-August (PERFECT TIMING!)
- **Action Shot Style**: Released during competitive play
- **Coverage**: Available upon provider release during off-season

#### Provider Options
1. **USA Today**: Better media day coverage
2. **Pressbox**: More comprehensive roster coverage

### Step 4: Database Integration
Your existing `player_headshots` table structure:
```sql
- player_id (UUID) → links to players.id
- headshot_url (TEXT) → full resolution image
- thumbnail_url (TEXT) → smaller preview image  
- source (VARCHAR) → 'sportradar'
- image_width/height (INT) → dimensions
- is_active (BOOLEAN) → enable/disable
```

## 🔧 Quick Test Script

Run this first to test your API access:

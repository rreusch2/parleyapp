# Daily Professor Lock Insights Pipeline

This system automatically generates daily betting insights for your ParleyApp home tab using Professor Lock AI.

## 🎯 How It Works

```
Daily Data Scraper → Database → Professor Lock → AI Insights → App Display
```

1. **Scraper** collects recent MLB team performance and player stats
2. **Database** stores the curated daily data
3. **Professor Lock** analyzes the data and generates insights
4. **App** displays the insights in the home tab

## 📋 Setup Instructions

### 1. Create Database Tables

Run this SQL in your Supabase SQL editor:

```sql
-- Copy and paste the contents of create-daily-insights-tables.sql
```

### 2. Set Environment Variables

Create a `.env` file in the project root:

```bash
# Supabase configuration (required)
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Backend API URL (optional - defaults to localhost:3001)
BACKEND_URL=http://localhost:3001
```

### 3. Install Dependencies

The pipeline will auto-install Python dependencies, but you can do it manually:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Make Scripts Executable

```bash
chmod +x run_daily_insights_pipeline.sh
```

## 🚀 Usage

### Manual Run (Testing)

```bash
# Run the complete pipeline
./run_daily_insights_pipeline.sh
```

### Automated Daily Run

Add to your crontab to run daily at 6 AM:

```bash
# Edit crontab
crontab -e

# Add this line (adjust path to your project)
0 6 * * * cd /path/to/parleyapp && ./run_daily_insights_pipeline.sh >> logs/daily_insights.log 2>&1
```

## 📊 What Data Gets Scraped

### Team Performance
- Last 10 games record (8-2, 5-5, etc.)
- Recent win/loss streaks 
- Home vs road performance
- Runs scored/allowed averages

### Hot Players
- Batting averages over last 15 games
- Hit streaks and hot streaks
- Key player performance trends

### League Trends
- Home team win percentages
- Over/under trends
- Day vs night game patterns

## 🤖 Professor Lock Insights

Professor Lock generates 5-7 insights like:

- "Yankees are 8-2 in their last 10 home games"
- "Ronald Acuña Jr. hitting .350 over last 15 games" 
- "Overs hitting 70% in Cubs games this month"
- "Home favorites covering 65% this week"

## 🗂️ Database Schema

### `daily_insights_data`
Stores the raw scraped data that Professor Lock uses.

```sql
- id (UUID)
- data_type (team_recent_games, player_recent_stats, etc.)
- team_name (VARCHAR)
- player_name (VARCHAR) 
- data (JSONB) -- The actual stats
- date_collected (DATE)
```

### `daily_professor_insights`
Stores the AI-generated insights for the app.

```sql
- id (UUID)
- insight_text (TEXT) -- "Yankees are 8-2 in last 10 games"
- insight_order (INTEGER) -- 1, 2, 3, etc.
- date_generated (DATE)
```

## 🔧 Configuration

### Customizing the Scraper

Edit `daily_mlb_scraper.py`:

- Add more teams to `sample_teams` list
- Modify data sources (ESPN, MLB.com, etc.)
- Adjust data collection frequency

### Customizing Insights

Edit `daily_insights_generator.py`:

- Modify the Professor Lock prompt
- Change number of insights (default: 5-7)
- Adjust insight parsing rules

## 📱 Frontend Integration

To display insights in your app, query the database:

```typescript
// Get today's insights
const { data: insights } = await supabase
  .from('daily_professor_insights')
  .select('*')
  .eq('date_generated', new Date().toISOString().split('T')[0])
  .order('insight_order');
```

## 🚨 Troubleshooting

### Common Issues

1. **"No daily data found"**
   - Check if scraper ran successfully
   - Verify database connection
   - Check date formatting

2. **"Professor Lock API error"**
   - Ensure backend is running
   - Check API endpoint URL
   - Verify Professor Lock is working in app

3. **"Environment variables not set"**
   - Create `.env` file with Supabase credentials
   - Check variable names match exactly

### Debug Mode

Run with verbose logging:

```bash
LOG_LEVEL=DEBUG ./run_daily_insights_pipeline.sh
```

### Manual Testing

Test components individually:

```bash
# Test scraper only
python3 daily_mlb_scraper.py

# Test insights generator only  
python3 daily_insights_generator.py
```

## 📈 Monitoring

Check pipeline success:

```sql
-- See today's data collection
SELECT data_type, COUNT(*) 
FROM daily_insights_data 
WHERE date_collected = CURRENT_DATE 
GROUP BY data_type;

-- See today's insights
SELECT insight_order, insight_text 
FROM daily_professor_insights 
WHERE date_generated = CURRENT_DATE 
ORDER BY insight_order;
```

## 🔄 Daily Workflow

1. **6:00 AM** - Cron job triggers pipeline
2. **6:01 AM** - Scraper collects fresh MLB data
3. **6:03 AM** - Data stored in `daily_insights_data`
4. **6:04 AM** - Professor Lock generates insights
5. **6:05 AM** - Insights stored in `daily_professor_insights`
6. **6:06 AM** - App displays new insights to users

## 🎯 Next Steps

1. Run the SQL to create tables
2. Set up environment variables
3. Test the pipeline manually
4. Set up cron job for automation
5. Update your app's home tab to display insights

The pipeline is designed to be robust and run reliably every day, giving your users fresh, AI-generated betting insights powered by Professor Lock! 
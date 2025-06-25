# The Odds API Integration Guide for ParleyApp

## 🚀 Quick Start

You've already completed the implementation phases, now we're integrating real sports data!

### Prerequisites
- ✅ The Odds API subscription (Free tier: 500 requests/month)
- ✅ PostgreSQL database (already set up from Phase 1)
- ✅ Python 3.8+ installed
- ✅ Backend services running (port 3001)
- ✅ Python prediction API running (port 5001)

## 📋 Integration Steps

### Step 1: Set Up API Key

1. Navigate to the data ingestion directory:
```bash
cd python-services/data-ingestion
```

2. Run the setup script:
```bash
./setup_theodds.sh
```

3. Export your API key:
```bash
export THEODDS_API_KEY='your_api_key_here'
export SPORTS_API_KEY='your_api_key_here'
export API_PROVIDER='theodds'
```

### Step 2: Test API Connection

Run the test script to verify your API key works:
```bash
python3 test_theodds_api.py
```

Expected output:
- ✅ API Key is valid!
- 📊 API Usage: X used / Y remaining
- 🏈 Available sports list
- Live games for each sport
- Sample odds data
- Player props (if available)

### Step 3: Configure Database Connection

Edit the `.env` file created by setup script:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=parleyapp
DB_USER=postgres
DB_PASSWORD=your_actual_password
```

### Step 4: Start Data Ingestion Service

```bash
python3 data_ingestor.py
```

This will:
- 🔄 Fetch live odds every 5 minutes
- 🎯 Update player props every 10 minutes
- 📅 Sync game schedules twice daily
- 🏥 Check injury reports hourly (not available in The Odds API)

### Step 5: Backfill Historical Data

To train your AI models with real data:

```python
# In a Python script or interactive session
from data_ingestor import DataIngestor
from datetime import datetime, timedelta

ingestor = DataIngestor()

# Backfill last 30 days
end_date = datetime.now()
start_date = end_date - timedelta(days=30)

await ingestor.backfill_historical_data(start_date, end_date)
```

**Note**: The Odds API free tier doesn't include historical data. Consider upgrading for this feature.

## 🔧 Data Flow Integration

### 1. Update Enhanced Prediction Models

Your Phase 2 models need real data. Update the connection in:
```
python-services/sports-betting-api/enhanced_predictors.py
```

### 2. Connect LLM Orchestrator

The Phase 3 orchestrator at `backend/src/ai/orchestrator/enhancedDeepseekOrchestrator.ts` will automatically use the new data once it's in the database.

### 3. Frontend Updates

Your enhanced UI components will display real odds:
- Games Tab: Real-time odds from multiple sportsbooks
- Predictions Tab: AI picks based on real data
- Insights Tab: Content generated from actual games

## 📊 API Endpoints Available

### From The Odds API:
- `/sports` - List of available sports
- `/sports/{sport}/events` - Upcoming games
- `/sports/{sport}/odds` - Live odds (spreads, totals, moneyline)
- `/sports/{sport}/events/{event_id}/odds` - Player props (limited)

### Your Enhanced Endpoints:
- `/api/v2/predict/player-prop` - Uses real player data
- `/api/v2/predict/spread` - Based on actual spreads
- `/api/v2/predict/total` - Real over/under predictions
- `/api/v2/analyze/parlay-enhanced` - Multi-leg analysis

## ⚠️ Important Considerations

### API Limits (Free Tier)
- 500 requests/month
- ~16 requests/day
- Plan your fetching intervals accordingly

### Recommended Fetch Strategy:
```
- Live odds: Every 30 minutes (48 requests/day)
- Player props: 2x daily for key games
- Game schedules: 1x daily
Total: ~60-70 requests/day during peak season
```

### Missing Features in Free Tier:
- ❌ Historical odds data
- ❌ Injury reports
- ❌ Advanced player props
- ❌ Live/in-play odds

Consider upgrading to paid tier ($99+/month) for production use.

## 🎯 Next Steps After Integration

1. **Monitor Data Quality**
   - Check `backend/logs/` for ingestion status
   - Verify odds are updating in database
   - Ensure predictions use real data

2. **Retrain Models**
   ```bash
   cd python-services/sports-betting-api
   python3 train_better_models.py --use-real-data
   ```

3. **Update Daily Automation**
   ```bash
   python3 enhanced_daily_automation.py
   ```

4. **Test Full Pipeline**
   - Generate new AI picks
   - Verify odds display correctly
   - Check prediction accuracy

## 🐛 Troubleshooting

### Common Issues:

1. **"Invalid API Key" Error**
   - Verify key is correctly set in environment
   - Check API dashboard for key status

2. **"No Data Available"**
   - Some sports may be off-season
   - Player props limited in free tier
   - Check API status page

3. **Database Connection Failed**
   - Verify PostgreSQL is running
   - Check credentials in .env
   - Ensure enhanced schema is applied

4. **Rate Limit Exceeded**
   - Reduce fetch intervals
   - Implement caching strategy
   - Consider API upgrade

## 📞 Support

- The Odds API Docs: https://the-odds-api.com/
- API Status: https://status.the-odds-api.com/
- ParleyApp Issues: Check backend logs

## 🎉 Success Checklist

- [ ] API key validated
- [ ] Test script runs successfully
- [ ] Data ingestion service started
- [ ] Real odds appearing in database
- [ ] AI picks using real data
- [ ] Frontend displaying live odds
- [ ] Models retrained with real data

Once complete, your ParleyApp will be powered by real-time sports data! 🚀 
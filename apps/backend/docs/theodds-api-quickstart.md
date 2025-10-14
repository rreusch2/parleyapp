# The Odds API - Quick Start Guide

## ✅ Current Status
- **API Key**: Active (19,994 requests remaining)
- **Games in DB**: 435 total
- **Today's Games**: 10 games
- **Data Updates**: Every 15-30 minutes

## 🔧 Backend Configuration

### 1. Environment Variables
Add to your backend `.env`:
```env
THEODDS_API_KEY=64dace9c079fb6c2cd6622af483a07cd
SPORTS_API_KEY=64dace9c079fb6c2cd6622af483a07cd
API_PROVIDER=theodds
```

### 2. Update AI Tools
The AI orchestrator needs to know about the real data:
- `backend/src/ai/tools/oddsApi.ts` - Already configured
- `backend/src/ai/tools/theoddsIntegration.ts` - Uses real DB data

### 3. Test Real Data
```bash
cd backend
npm run dev

# In another terminal:
curl http://localhost:3001/api/sports/today
```

## 📊 Available Data

### Sports Coverage
- **NFL**: 273 games (Aug 2025 - Jan 2026)
- **NCAAF**: 113 games (Aug - Dec 2025)
- **MLB**: 45 games (Current season)
- **NBA**: 3 games (Finals)
- **NHL**: 1 game (Playoffs)

### Data Types
1. **Game Schedules**: Team names, dates, times
2. **Live Odds**: Spreads, totals, moneylines
3. **Player Props**: Points, rebounds, assists
4. **Bookmaker Data**: FanDuel, DraftKings, Bovada, etc.

## 🚀 Using in Your App

### Get Today's Games
```typescript
// In your React Native app
const response = await fetch(`${API_URL}/api/sports/today`);
const games = await response.json();
```

### Get AI Predictions
```typescript
// AI-powered predictions with real odds
const response = await fetch(`${API_URL}/api/ai/enhanced-predictions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    prompt: "Give me the best bets for today's NBA games",
    includeAnalysis: true
  })
});
```

## 📱 Frontend Updates Needed

1. **Remove Mock Data**: Delete any hardcoded games
2. **Update API Calls**: Point to real endpoints
3. **Add Loading States**: Real API calls take 1-2 seconds
4. **Handle Empty States**: Some sports are off-season

## 🔍 Monitoring

Check ingestion logs:
```bash
cd python-services/data-ingestion
tail -f ingestion.log
```

Check database:
```sql
-- Today's games with odds
SELECT 
    se.sport,
    se.home_team,
    se.away_team,
    se.start_time,
    COUNT(DISTINCT od.bookmaker) as bookmaker_count
FROM sports_events se
LEFT JOIN odds_data od ON se.id = od.event_id
WHERE DATE(se.start_time) = CURRENT_DATE
GROUP BY se.id, se.sport, se.home_team, se.away_team, se.start_time
ORDER BY se.start_time;
```

## ⚡ Performance Tips

1. **Cache frequently accessed data** (Redis recommended)
2. **Use database indexes** (already created)
3. **Implement pagination** for large result sets
4. **Add request throttling** to stay within API limits

## 🎯 Next Steps

1. ✅ Data ingestion running
2. ⏳ Update backend endpoints to use real data
3. ⏳ Test AI predictions with real odds
4. ⏳ Update frontend to display real games
5. ⏳ Add real-time odds updates via WebSocket

## API Usage Limits

### Free Tier (500 requests/month)
- ~16 requests per day
- Good for testing and development
- Each request can return multiple games/odds

### Paid Tiers
- Starter: $99/month - 10,000 requests
- Standard: $299/month - 100,000 requests  
- Professional: $599/month - 500,000 requests

## Optimization Tips

1. **Batch Requests**: Get multiple sports/games in one request
2. **Cache Data**: Use Redis to avoid repeated API calls
3. **Smart Scheduling**: 
   - Fetch game schedules once daily
   - Update odds every 15-30 minutes for live games
   - Player props 1-2 hours before game time

## Next Steps

1. Monitor your API usage in The Odds dashboard
2. Set up alerts when approaching limits
3. Consider upgrading when ready for production
4. Start building prediction models with real data!

## Troubleshooting

- **401 Error**: Check your API key
- **429 Error**: Rate limit exceeded, wait and retry
- **No data**: Some sports may be out of season
- **Missing player props**: Not all games have props available

## Support

- The Odds API Docs: https://the-odds-api.com/liveapi/guides/v4/
- Email: support@the-odds-api.com 
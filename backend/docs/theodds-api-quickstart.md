# The Odds API Quick Start Guide

## 1. Get Your API Key

1. Go to https://the-odds-api.com
2. Click "Get API Key" 
3. Sign up for free account (500 requests/month free)
4. Copy your API key from the dashboard

## 2. Run Database Migration

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the entire contents of `/supabase-phase1-migration.sql`
4. Click "Run" 
5. You should see success messages - the script is safe to run multiple times

## 3. Configure Environment Variables

Create or update your `.env` file in the backend directory:

```bash
# API Configuration
API_PROVIDER=theodds
SPORTS_API_KEY=your_the_odds_api_key_here

# Supabase Configuration (you should already have these)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

# Database (for Python service)
DB_HOST=db.your-project.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_db_password

# Optional: Redis for caching
REDIS_URL=redis://localhost:6379
```

## 4. Test The Odds API Connection

Create a quick test script to verify your API key works:

```python
# test_theodds_api.py
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv('SPORTS_API_KEY')
BASE_URL = "https://api.the-odds-api.com/v4"

async def test_api():
    async with httpx.AsyncClient() as client:
        # Test 1: Get sports list
        response = await client.get(
            f"{BASE_URL}/sports",
            params={"apiKey": API_KEY}
        )
        print(f"Status: {response.status_code}")
        sports = response.json()
        print(f"Available sports: {len(sports)}")
        
        # Test 2: Get odds for NBA
        response = await client.get(
            f"{BASE_URL}/sports/basketball_nba/odds",
            params={
                "apiKey": API_KEY,
                "regions": "us",
                "markets": "h2h,spreads,totals"
            }
        )
        games = response.json()
        print(f"NBA games with odds: {len(games)}")
        
        # Check remaining quota
        print(f"Requests remaining: {response.headers.get('x-requests-remaining')}")
        print(f"Requests used: {response.headers.get('x-requests-used')}")

import asyncio
asyncio.run(test_api())
```

## 5. Start Data Ingestion Service

```bash
cd python-services/data-ingestion
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python data_ingestor.py
```

## 6. Verify Data is Flowing

Check your Supabase tables:

```sql
-- Check for games
SELECT COUNT(*) FROM sports_events WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check for odds
SELECT COUNT(*) FROM odds_data WHERE created_at > NOW() - INTERVAL '1 hour';

-- See latest odds
SELECT 
    se.home_team,
    se.away_team,
    b.bookmaker_name,
    mt.market_name,
    od.outcome_name,
    od.outcome_price,
    od.outcome_point
FROM odds_data od
JOIN sports_events se ON od.event_id = se.id
JOIN bookmakers b ON od.bookmaker_id = b.id
JOIN market_types mt ON od.market_type_id = mt.id
ORDER BY od.created_at DESC
LIMIT 10;
```

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
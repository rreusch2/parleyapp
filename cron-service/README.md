# ParleyApp Daily Automation Cron Service

This is a dedicated Railway service that triggers the ParleyApp daily prediction automation at **6:00 AM EST** every day.

## 🚀 Deployment Instructions

1. **Create new Railway service** from the `cron-service` directory
2. **Set environment variables**:
   ```
   BACKEND_SERVICE_URL=https://zooming-rebirth-production.up.railway.app
   PORT=3000
   ```
3. **Deploy** - Railway will automatically detect Node.js and run the cron scheduler

## ⏰ Daily Schedule

**Time**: 6:00 AM EST (0 6 * * *)  
**Timezone**: America/New_York

## 🔄 Automation Sequence

The cron service triggers these backend endpoints in sequence:

1. **Setup Odds Integration** (`/api/automation/odds-setup`)
   - Fetches latest games and odds from TheOdds API
   - Stores player props and team odds in Supabase

2. **Run Team Predictions** (`/api/automation/run-orchestrator`)  
   - Generates 10 team-based predictions (moneyline, spreads, totals)
   - Uses enhanced DeepSeek orchestrator with ML server

3. **Run Player Props** (`/api/automation/run-player-props`)
   - Generates 10 player prop predictions using xAI Grok-3
   - Includes StatMuse research and web search intelligence

**Expected Output**: 20 total daily predictions stored in `ai_predictions` table

## 🏥 Health Check

- **Endpoint**: `/health`
- **Status**: Service health and next run time
- **URL**: `https://your-cron-service.up.railway.app/health`

## 🔧 Local Testing

```bash
cd cron-service
npm install
BACKEND_SERVICE_URL=http://localhost:3001 node cron-handler.js
```

## 📋 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BACKEND_SERVICE_URL` | URL of main backend service | `https://zooming-rebirth-production.up.railway.app` |
| `PORT` | Health check server port | `3000` |

## 🚨 Error Handling

- Comprehensive error logging for failed requests
- 5-10 minute timeouts per automation step
- Manual intervention alerts for critical failures
- Graceful shutdown on SIGTERM/SIGINT

## 📊 Expected Results

After successful daily automation:
- **Team Predictions**: 10 picks (moneyline, spread, total)
- **Player Props**: 10 picks (hits, strikeouts, runs, etc.)
- **Storage**: All predictions in Supabase `ai_predictions` table
- **Logging**: Complete execution logs with timestamps

# Predictive Play Docker Setup Guide

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- `.env` file configured (copy from `.env.example`)
- ML models trained (located in `python-services/sports-betting-api/models/`)

### Run Everything
```bash
# Start all services
docker compose up -d

# Check logs
docker compose logs -f

# Stop all services
docker compose down
```

## 📦 Services

### 1. **PostgreSQL Database** (Port 5432)
- Local database for development
- Automatically initialized with Predictive Play schema

### 2. **Backend API** (Port 3000)
- Node.js/TypeScript API server
- Handles all client requests
- Integrates with DeepSeek orchestrator

### 3. **ML Prediction Server** (Port 8001)
- Python Flask server
- Serves trained ML models
- Provides real-time predictions for:
  - MLB moneyline, spread, and totals
  - NBA player props (points, rebounds, assists)
  - MLB player props (hits, home runs, strikeouts)

### 4. **Redis Cache** (Port 6379)
- Optional caching layer
- Improves API performance

## 🔧 Configuration

### Environment Variables
Key variables to set in `.env`:

```bash
# ML Server Integration
PYTHON_ML_SERVER_URL=http://ml-server:8001  # Use container name in Docker

# Supabase (Production DB)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# AI APIs
DEEPSEEK_API_KEY=your_deepseek_key
THEODDS_API_KEY=your_theodds_key
```

## 🎯 Testing the Integration

### 1. **Check Service Health**
```bash
# ML Server
curl http://localhost:8001/api/health

# Backend API
curl http://localhost:3000/health
```

### 2. **Run Manual Orchestrator**
```bash
# Test mode (doesn't save to DB)
docker compose exec backend npx ts-node src/scripts/run-orchestrator.ts --test

# Production mode
docker compose exec backend npx ts-node src/scripts/run-orchestrator.ts
```

### 3. **Test ML Predictions**
```bash
# Test MLB moneyline prediction
curl -X POST http://localhost:8001/api/v2/predict/moneyline-real \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "MLB",
    "home_team": "Los Angeles Dodgers",
    "away_team": "San Francisco Giants"
  }'
```

## 📊 Model Updates

To update ML models:

1. Train new models:
```bash
cd python-services/sports-betting-api
python train_mlb_betting_models.py
```

2. Restart ML server:
```bash
docker compose restart ml-server
```

## 🐛 Troubleshooting

### ML Server Not Starting
```bash
# Check logs
docker compose logs ml-server

# Verify models exist
ls python-services/sports-betting-api/models/
```

### Database Connection Issues
```bash
# Check Supabase connection
docker compose exec backend node -e "
  const { supabase } = require('./dist/services/supabase/client');
  supabase.from('sports_events').select('id').limit(1).then(console.log);
"
```

### Orchestrator Not Finding Games
```bash
# Check today's games in database
docker compose exec backend npx ts-node -e "
  const { supabase } = require('./dist/services/supabase/client');
  const today = new Date().toISOString().split('T')[0];
  supabase.from('sports_events')
    .select('*')
    .gte('start_time', today + 'T00:00:00')
    .lte('start_time', today + 'T23:59:59')
    .then(r => console.log('Games today:', r.data?.length || 0));
"
```

## 🚨 Important Notes

- **Rebuild Required**: After making changes to backend or ML server code
- **Volume Persistence**: ML models and database data persist between container restarts
- **Network**: All services communicate on `Predictive Play-network`
- **Production**: Use proper secrets management (not `.env` files) in production

## 📅 Automated Daily Picks

Add to your crontab:
```bash
# Generate picks daily at 8 AM
0 8 * * * cd /path/to/Predictive Play && docker compose exec -T backend npx ts-node src/scripts/run-orchestrator.ts
```

## 🔄 Development Workflow

1. **Start services**: `docker compose up -d`
2. **Make code changes**: Edit files locally
3. **Backend changes**: Auto-reload with nodemon
4. **ML server changes**: Restart with `docker compose restart ml-server`
5. **View logs**: `docker compose logs -f [service-name]`

## 🛑 Stopping Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (⚠️ deletes data)
docker compose down -v
``` 
# DeepSeek Orchestrator Implementation Plan

## 🎯 Current State Assessment

### What Works:
- ✅ **Player Props Models**: NBA (points, rebounds, assists) and MLB (hits, HRs, strikeouts) trained on 30,357 real games
- ✅ **Odds Integration**: TheOdds API provides real-time moneyline, spread, and totals odds
- ✅ **DeepSeek Infrastructure**: Enhanced orchestrator exists but needs connection to real models

### What's Missing:
- ❌ **Team Game Data**: 0 completed games with scores for ML/spread/totals training
- ❌ **Player Props Connection**: Trained models aren't served to orchestrator
- ❌ **Player Props Odds**: TheOdds API doesn't provide player prop lines in current plan

## 🚀 Implementation Phases

### Phase 1: Quick Wins (Today - 2 Days)

#### 1.1 Start ML Prediction Server
```bash
cd /home/reid/Desktop/Predictive Play/python-services/sports-betting-api
python3 ml_prediction_server.py
```
This serves your trained NBA/MLB models on port 8001.

#### 1.2 Update DeepSeek Orchestrator Environment
Add to backend `.env`:
```
PYTHON_ML_SERVER_URL=http://localhost:8001
```

#### 1.3 Run Manual Orchestrator for Testing
```bash
cd /home/reid/Desktop/Predictive Play/python-services/sports-betting-api
python3 run_orchestrator.py
```
This will:
- Fetch games from your database
- Use trained models for player props
- Calculate edges against real odds
- Generate top 10 picks

### Phase 2: Data Collection (Days 3-7)

#### 2.1 Ingest Historical Team Games
```bash
cd /home/reid/Desktop/Predictive Play/python-services/data-ingestion
# Set THEODDS_API_KEY in .env first
python3 ingest_team_games.py
```
This fetches 90 days of historical games with scores.

#### 2.2 Get Player Props Odds
Options:
1. **Upgrade TheOdds API**: Premium tier includes player props
2. **Alternative APIs**:
   - OddsJam (comprehensive but expensive)
   - PropOdds API (player props focused)
   - DraftKings/FanDuel unofficial APIs

#### 2.3 Link Players to Games
Create script to match players in `players` table to teams in `sports_events`.

### Phase 3: Model Training (Week 2)

#### 3.1 Train Spread/ML/Totals Models
```python
# train_team_models.py
class TeamModelTrainer:
    def train_moneyline_model(self):
        # Features: team ratings, H2H record, injuries, rest
        # Target: win/loss
        
    def train_spread_model(self):
        # Features: efficiency differential, pace, home advantage
        # Target: actual spread vs line
        
    def train_totals_model(self):
        # Features: pace, offensive/defensive ratings
        # Target: actual total vs line
```

#### 3.2 Update ML Server
Add endpoints for new models:
- `/api/v2/predict/moneyline-real`
- `/api/v2/predict/spread-real`
- `/api/v2/predict/total-real`

### Phase 4: Full Integration (Week 3)

#### 4.1 Update Enhanced Orchestrator
Modify `enhancedDeepseekOrchestrator.ts` to:
```typescript
// Use real ML server endpoints
const PYTHON_ML_SERVER_URL = process.env.PYTHON_ML_SERVER_URL || 'http://localhost:8001';

// Update prediction methods to use real models
private async getMLPredictionFromPython(game: DatabaseGame): Promise<MLPrediction> {
    const response = await axios.post(`${PYTHON_ML_SERVER_URL}/api/v2/predict/moneyline-real`, {
        home_team: game.home_team,
        away_team: game.away_team,
        sport: game.sport
    });
    return response.data.prediction;
}
```

#### 4.2 Create Automated Pipeline
```yaml
# docker-compose.yml addition
ml-server:
  build: ./python-services/sports-betting-api
  ports:
    - "8001:8001"
  environment:
    - PYTHON_ML_SERVER=true
  depends_on:
    - postgres
```

#### 4.3 Add Cron Jobs
```bash
# Daily data ingestion
0 6 * * * cd /path/to/project && python3 ingest_team_games.py
0 7 * * * cd /path/to/project && python3 ingest_player_stats.py

# Daily predictions
0 8 * * * cd /path/to/project && node run-orchestrator.js

# Weekly model retraining
0 2 * * 0 cd /path/to/project && python3 train_real_models.py
```

## 📊 Expected Outcomes

### Week 1:
- Manual orchestrator generates picks using real NBA/MLB player props models
- Basic edge calculation against real odds
- 10 daily picks stored in database

### Week 2:
- Historical team game data collected
- Spread/ML/totals models trained
- All bet types covered

### Week 3:
- Fully automated daily picks
- Real-time odds integration
- Performance tracking enabled

## 🔧 Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React Native)                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Backend API (Node.js)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Enhanced DeepSeek Orchestrator              │   │
│  └──────────┬──────────────────────┬───────────────────┘   │
│             │                      │                         │
│  ┌──────────▼────────┐  ┌─────────▼──────────┐            │
│  │   TheOdds API     │  │  ML Prediction      │            │
│  │   (Real Odds)     │  │  Server (Port 8001) │            │
│  └───────────────────┘  └─────────┬──────────┘            │
└─────────────────────────────────────┼───────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────┐
│                    Trained ML Models                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Player Props │ │    Spread    │ │   Totals     │       │
│  │  (Trained)   │ │  (Pending)   │ │  (Pending)   │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## 🎮 Manual Testing Commands

### Test ML Server:
```bash
curl -X POST http://localhost:8001/api/v2/predict/player-prop \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "NBA",
    "prop_type": "points",
    "player_id": "test123",
    "line": 25.5,
    "game_context": {"is_home": true}
  }'
```

### Test Orchestrator:
```bash
# Run in test mode without storing
python3 run_orchestrator.py --test
```

### Check Predictions:
```sql
SELECT * FROM ai_predictions 
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY confidence DESC;
```

## 🚨 Important Considerations

### API Limits:
- TheOdds API: 500 requests/month (free tier)
- Consider caching and batch requests

### Model Accuracy:
- Start conservative with edge thresholds
- Track actual results vs predictions
- Adjust confidence calculations based on performance

### Player Props Challenge:
- No odds = can't calculate true edge
- Options:
  1. Estimate fair odds from prediction
  2. Upgrade to API with player prop odds
  3. Scrape from sportsbooks (risky)

### Database Performance:
- Index frequently queried columns
- Archive old predictions
- Monitor query performance

## 🎯 Success Metrics

- **Week 1**: Generate 70 picks, 50%+ with positive expected value
- **Week 2**: Train models with 65%+ accuracy on test set
- **Week 3**: Achieve 55%+ win rate on actual bets
- **Month 1**: Positive ROI on paper trading

## 🔄 Next Steps

1. **Immediate**: Start ML server and test manual orchestrator
2. **Tomorrow**: Begin team game data ingestion
3. **This Week**: Research player props odds solutions
4. **Next Week**: Train spread/ML/totals models
5. **Ongoing**: Monitor performance and iterate 
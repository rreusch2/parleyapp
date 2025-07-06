# Phase 1 Migration Strategy

## Current State → Target State

### Current State Analysis
- **Data Sources**: SportRadar (limited), TheSportsDB (free tier), ESPN API
- **Database**: Basic sports_events table with minimal structure
- **No Real-time Odds**: Currently not fetching any odds data
- **No Player Props**: No player prop data ingestion
- **Mock Data Usage**: Python services using sample/mock data

### Target State (Phase 1 Complete)
- **Primary Data Source**: OddsJam API (or The Odds API)
- **Enhanced Database**: Comprehensive schema with odds, player props, injuries
- **Real-time Updates**: Automated ingestion every 5-10 minutes
- **Historical Data**: Backfilled for ML model training
- **Production Ready**: No mock data, all real-time feeds

## Migration Steps

### Step 1: Database Migration (Week 1-2)
```bash
# 1. Backup existing database
pg_dump -U postgres -d Predictive Play > backup_$(date +%Y%m%d).sql

# 2. Apply enhanced schema (non-destructive)
psql -U postgres -d Predictive Play < backend/src/db/enhanced_schema.sql

# 3. Migrate existing data to new structure
psql -U postgres -d Predictive Play < backend/src/db/migrate_existing_data.sql
```

### Step 2: API Integration Setup (Week 1)
1. **Obtain API Credentials**
   - Contact OddsJam sales team
   - Get development/staging credentials
   - Set up billing and usage limits

2. **Environment Configuration**
   ```bash
   # .env file
   API_PROVIDER=oddsjam
   SPORTS_API_KEY=your_oddsjam_api_key
   DB_HOST=localhost
   DB_NAME=Predictive Play
   DB_USER=postgres
   DB_PASSWORD=your_password
   REDIS_URL=redis://localhost:6379
   ```

### Step 3: Deploy Data Ingestion Service (Week 2-3)
1. **Setup Python Service**
   ```bash
   cd python-services/data-ingestion
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   ```

2. **Run Initial Tests**
   ```bash
   # Test API connectivity
   python test_api_connection.py
   
   # Test database operations
   python test_db_operations.py
   ```

3. **Start Service**
   ```bash
   # Development mode
   python data_ingestor.py
   
   # Production mode (with supervisor/systemd)
   sudo systemctl start Predictive Play-ingestor
   ```

### Step 4: Data Validation & Quality Checks (Week 3-4)
1. **Verify Data Ingestion**
   - Check sports_events table for new games
   - Verify odds_data is populating
   - Confirm player_props_odds has data
   
2. **Data Quality Metrics**
   - Completeness: All games have odds?
   - Freshness: How recent is the data?
   - Accuracy: Spot check against sportsbooks

### Step 5: Update Backend Services (Week 4-5)
1. **Modify TypeScript Services**
   - Update sportsDataService.ts to use new tables
   - Create new endpoints for odds/props data
   - Remove mock data dependencies

2. **Update Python ML Services**
   - Point to real database tables
   - Remove sample data generation
   - Update feature engineering

### Step 6: Historical Backfill (Week 5-6)
```python
# Run backfill script
from datetime import datetime, timedelta
from data_ingestor import DataIngestor

ingestor = DataIngestor()
start_date = datetime.now() - timedelta(days=365)  # 1 year of data
end_date = datetime.now()

await ingestor.backfill_historical_data(start_date, end_date)
```

## Rollback Plan

If issues arise during migration:

1. **Database Rollback**
   ```bash
   # Restore from backup
   psql -U postgres -d Predictive Play < backup_YYYYMMDD.sql
   ```

2. **Service Rollback**
   - Stop data ingestion service
   - Revert to previous API integration
   - Re-enable mock data temporarily

## Success Criteria

Phase 1 is complete when:
- ✅ Real-time odds updating every 5 minutes
- ✅ Player props for all major sports
- ✅ Injury reports updating hourly
- ✅ 6+ months of historical data loaded
- ✅ Zero dependency on mock/sample data
- ✅ 99%+ uptime for data ingestion
- ✅ Monitoring dashboards operational

## Next Steps After Phase 1

1. Begin Phase 2: Core Prediction Model Development
2. Start training models on real historical data
3. Implement A/B testing framework
4. Enhance frontend to display new data 
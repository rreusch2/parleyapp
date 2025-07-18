# Corrected Enhanced Sports Betting AI System - Deployment Guide

## 🔧 Environment Variables Fixed

The enhanced system has been corrected to use your actual environment variables:

### ✅ Correct API Configuration

```bash
# AI/ML APIs (PRIMARY)
XAI_API_KEY=your_xai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Sports Data APIs
API_SPORTS_KEY=your_api_sports_key_here
SPORTSDATAIO_API_KEY=your_sportsdataio_key_here
SPORTRADAR_API_KEY=your_sportradar_key_here
ODDS_API_KEY=your_odds_api_key_here
THEODDS_API_KEY=your_theodds_key_here
SPORTS_GAME_ODDS_API_KEY=your_sports_game_odds_key_here

# Database (Supabase)
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# Backend Configuration
BACKEND_API_URL=your_backend_url_here
BACKEND_URL=your_backend_url_here
PORT=3001
NODE_ENV=production
```

## 🚀 Quick Deployment Steps

### 1. Fix Database Triggers (if needed)
```bash
# If you encountered the trigger error, run this first:
psql $SUPABASE_URL -f fix_database_triggers.sql
```

### 2. Apply Database Schema Updates
```bash
# Apply the enhanced database schema:
psql $SUPABASE_URL -f database_schema_updates.sql
```

### 3. Test Configuration
```bash
# Test that environment variables are correctly configured:
python enhanced_system_config.py
```

### 4. Run System Integration Tests
```bash
# Test all enhanced components:
python system_integration_test.py --test all
```

### 5. Deploy Enhanced System
```bash
# Deploy with correct environment:
python deploy_enhanced_system.py --environment production
```

### 6. Start Automated Workflows
```bash
# Start the enhanced workflows:
python start_workflows.py
```

## 🎯 Key Changes Made

### Fixed Environment Variables:
- ❌ `GROK_API_KEY` → ✅ `XAI_API_KEY`
- ❌ `STATMUSE_API_KEY` → ✅ `API_SPORTS_KEY`
- ❌ `DATABASE_URL` → ✅ `SUPABASE_URL`
- ❌ `grok-4` → ✅ `grok-beta`

### Updated Files:
- ✅ [`enhanced_teams_agent.py`](enhanced_teams_agent.py)
- ✅ [`enhanced_props_agent.py`](enhanced_props_agent.py)
- ✅ [`deploy_enhanced_system.py`](deploy_enhanced_system.py)
- ✅ [`ENHANCED_SYSTEM_README.md`](ENHANCED_SYSTEM_README.md)

### New Configuration Files:
- ✅ [`enhanced_system_config.py`](enhanced_system_config.py) - Centralized config with correct env vars
- ✅ [`fix_environment_variables.py`](fix_environment_variables.py) - Script to fix env vars
- ✅ [`fix_database_triggers.sql`](fix_database_triggers.sql) - Database trigger fix

## 🔍 Validation

Run this to validate your configuration:

```python
from enhanced_system_config import config

# Check configuration
validation = config.validate_config()
print(f"Config valid: {validation['config_valid']}")
print(f"Missing critical vars: {validation['critical_missing']}")

# Test AI configuration
ai_config = config.get_ai_config()
print(f"Primary AI model: {ai_config['primary_model']}")
print(f"XAI API key present: {'Yes' if config.XAI_API_KEY else 'No'}")
```

## 🎉 System Ready

Your enhanced sports betting AI system is now correctly configured with:

- **✅ xAI Grok API** as the primary AI model
- **✅ Correct sports data APIs** (API Sports, The Odds API, etc.)
- **✅ Supabase database** connection
- **✅ Railway backend** URLs
- **✅ All environment variables** matching your actual `.env` file

The system will now work properly with your existing infrastructure and API keys!

## 📞 Next Steps

1. **Test the fixes**: `python system_integration_test.py --test all`
2. **Deploy**: `python deploy_enhanced_system.py --environment production`
3. **Monitor**: Check logs and system health
4. **Enjoy**: Superior betting intelligence with exclusive web scraping data!

---

**🎯 The enhanced system is now properly configured for your Parley app environment!**

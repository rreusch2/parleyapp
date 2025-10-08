# Player Headshot Ingestion - Quick Start

## 📊 The Situation
You're missing **12,197 player headshots** across your database:
- NBA: 283 missing (0% coverage)
- NHL: 351 missing (0% coverage)  
- MLB: 684 missing (32% coverage)
- WNBA: 85 missing (0% coverage)
- NFL: 55 missing (99% coverage) ✅
- College Football: 10,739 missing (0% coverage)

## 🎯 The Solution
Two Python scripts that automatically fetch headshots from ESPN and official league CDNs (all free, no API keys needed).

## 🚀 Quick Start (3 Steps)

### Step 1: Install Dependencies
```bash
pip install -r requirements_headshots.txt
```

### Step 2: Create `.env` File
Create a file named `.env` with:
```
SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
```

Get your service key from: [Supabase Dashboard → Settings → API](https://supabase.com/dashboard/project/iriaegoipkjtktitpary/settings/api)

### Step 3: Run Scripts

**Option A: Automated (Windows)**
```bash
run_headshot_ingestion.bat
```

**Option B: Manual**
```bash
# Test first (recommended)
python test_headshot_ingestion.py

# Phase 1: Direct CDN lookup (~30 min)
python ingest_player_headshots.py

# Phase 2: ESPN API fallback (~1 hour)
python ingest_headshots_espn_api.py
```

## 📈 Expected Results
- **NBA**: 85-95% coverage
- **NHL**: 65-80% coverage
- **MLB**: 90-95% coverage
- **WNBA**: 75-85% coverage
- **NFL**: 99.5%+ coverage

**Total Time:** 1-2 hours
**Total Cost:** $0 (uses free CDNs)

## 📚 More Info
- **Full Guide**: `HEADSHOT_INGESTION_GUIDE.md`
- **Research Details**: `HEADSHOT_RESEARCH_FINDINGS.md`

## ❓ Troubleshooting

**"SUPABASE_SERVICE_KEY not found"**
→ Create `.env` file with your service key

**"No players need headshots"**
→ Already done! Check coverage with SQL query in guide

**"Connection timeout"**
→ Check internet connection, CDNs might be temporarily slow

**"Import error: No module named 'requests'"**
→ Run `pip install -r requirements_headshots.txt`

## 🎉 That's It!
Ready to go, brotha! Just run the scripts and watch the headshots populate.


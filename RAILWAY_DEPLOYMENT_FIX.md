# ParleyApp Railway Deployment Configuration

## 🚀 Correct Service Setup

The ParleyApp ecosystem consists of three main services that should be deployed separately on Railway:

### 1. Backend Service (`zooming-rebirth`)
- **Root Directory**: `/`
- **Config File**: `railway.toml`
- **Build**: Nixpacks with Node.js
- **Start Command**: `npm start --prefix backend`
- **Health Check**: `/api/health`

### 2. StatMuse API Service (`feisty-nurturing`)
- **Root Directory**: `/`
- **Config File**: `railway-statmuse.json`
- **Build**: Nixpacks with Python
- **Start Command**: `gunicorn statmuse_api_server:app --bind 0.0.0.0:$PORT`
- **Health Check**: `/health`

### 3. Cron Service (new service)
- **Directory**: `/cron-service`
- **Config File**: Inside `/cron-service/railway.json`
- **Build**: Nixpacks with Node.js
- **Start Command**: `node cron-handler.js`
- **Health Check**: `/health`

## 🔧 Deployment Instructions

### For the Backend (`zooming-rebirth`):
1. Connect to the GitHub repo root directory
2. Railway will use `railway.toml` automatically

### For StatMuse API (`feisty-nurturing`):
1. Connect to the GitHub repo root directory
2. Override the service settings:
   - **Root Directory**: `/`
   - **Settings > Build & Deploy > Override Build Command**: `nixpacks build . --nixpacks-config railway-statmuse.toml`

### For Cron Service (new service):
1. Create a new service
2. Connect to the GitHub repo
3. Set **Root Directory**: `/cron-service`
4. Railway will automatically use the `railway.json` in that directory

## ⚠️ Important Notes

1. **Avoid `cd` Commands**: Railway doesn't support `cd` in commands - use `--prefix` with npm instead
2. **Service Isolation**: Each service must have its own dedicated deployment
3. **Environment Variables**: Make sure each service has its own appropriate environment variables
4. **Health Checks**: All services have proper health check endpoints

## 🔄 Service Interaction

The correct flow is:
1. Frontend app ↔️ Backend API (`zooming-rebirth`)
2. Backend API ↔️ StatMuse API (`feisty-nurturing`) for sports data
3. Cron Service triggers Backend API endpoints at scheduled times (6:00 AM EST daily)

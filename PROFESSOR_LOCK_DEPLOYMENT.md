# Professor Lock - Production Deployment Guide

## Overview

Professor Lock consists of two services:
1. **Web App** (Next.js) - Already deployed on Vercel
2. **Agent Service** (FastAPI + Python) - Needs deployment

## Deployment Options

### Option 1: Railway (Recommended - Easiest)

**Pros**: Auto-deploy from Git, built-in Playwright support, simple env management
**Cost**: ~$5-20/month depending on usage

#### Steps:

1. **Create Railway Project**
   - Go to https://railway.app
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `parleyapp` repo
   - Choose "Empty Service"

2. **Configure Build**
   - Root Directory: `/agent`
   - Dockerfile Path: `/agent/service/Dockerfile`
   - Or use Railway's auto-detect (it will find the Dockerfile)

3. **Set Environment Variables**
   ```
   SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
   WEB_API_BASE_URL=https://www.predictive-play.com
   PROFESSOR_LOCK_BUCKET=professor-lock-artifacts
   PORT=8000
   ```

4. **Deploy**
   - Railway will auto-build and deploy
   - Get your service URL: `https://your-service.up.railway.app`

5. **Update Vercel**
   - Go to Vercel project settings
   - Add environment variable:
     ```
     AGENT_SERVICE_URL=https://your-service.up.railway.app
     ```
   - Redeploy web-app

### Option 2: Render

**Pros**: Free tier available, good for testing
**Cost**: Free tier (limited), $7+/month for production

#### Steps:

1. **Create Web Service**
   - Go to https://render.com
   - New → Web Service
   - Connect your GitHub repo

2. **Configure**
   - Name: `professor-lock-agent`
   - Root Directory: `agent`
   - Environment: `Docker`
   - Dockerfile Path: `service/Dockerfile`
   - Instance Type: `Starter` ($7/month) or `Standard` ($25/month)

3. **Environment Variables** (same as Railway)

4. **Deploy** and update Vercel

### Option 3: Fly.io

**Pros**: Edge deployment, good performance
**Cost**: ~$5-15/month

#### Steps:

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create fly.toml**
   ```bash
   cd /home/reid/Desktop/parleyapp/agent
   fly launch --no-deploy
   ```

3. **Configure fly.toml**
   ```toml
   app = "professor-lock-agent"
   primary_region = "iad"

   [build]
     dockerfile = "service/Dockerfile"

   [env]
     PORT = "8000"

   [[services]]
     internal_port = 8000
     protocol = "tcp"

     [[services.ports]]
       handlers = ["http"]
       port = 80

     [[services.ports]]
       handlers = ["tls", "http"]
       port = 443
   ```

4. **Set Secrets**
   ```bash
   fly secrets set SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
   fly secrets set SUPABASE_SERVICE_ROLE_KEY=<your_key>
   fly secrets set WEB_API_BASE_URL=https://www.predictive-play.com
   ```

5. **Deploy**
   ```bash
   fly deploy
   ```

## Post-Deployment Checklist

### 1. Verify Agent Service

```bash
# Health check
curl https://your-agent-service.com/healthz

# Should return: {"ok": true}
```

### 2. Update Vercel Environment

- Go to: https://vercel.com/your-project/settings/environment-variables
- Add/Update:
  ```
  AGENT_SERVICE_URL=https://your-agent-service.com
  ```
- Redeploy: `vercel --prod`

### 3. Test End-to-End

1. Go to https://www.predictive-play.com/professor-lock
2. Login
3. Click "Start Session"
4. Send message: "What are today's best MLB picks?"
5. Verify:
   - ✅ Tool Activity shows events
   - ✅ Screenshots appear when browser is used
   - ✅ Chat shows assistant responses
   - ✅ No console errors

### 4. Monitor Logs

**Railway**: Dashboard → Service → Logs
**Render**: Dashboard → Service → Logs
**Fly.io**: `fly logs`

Look for:
- ✅ Session start events
- ✅ Message processing
- ✅ Screenshot uploads to Supabase
- ✅ Event posts to web-app
- ❌ Any errors or timeouts

## Scaling Considerations

### Current Setup (Good for 10-100 concurrent users)

- Single instance agent service
- In-memory SSE bus in Next.js
- Works well for initial launch

### Scale to 100-1000 users

**1. Migrate SSE Bus to Redis**

Add to `web-app/lib/professorLockBus.ts`:
```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
})

export async function publish(sessionId: string, data: any) {
  await redis.publish(`professor-lock:${sessionId}`, JSON.stringify(data))
}

export function subscribe(sessionId: string, cb: BusCallback) {
  // Use Redis pub/sub instead of in-memory Map
  // Implementation depends on your Redis client
}
```

**2. Horizontal Scaling**

- Railway/Render: Increase instance count
- Add load balancer if needed
- Agent service is stateless (sessions stored in Supabase)

**3. Optimize Agent Performance**

- Cache StatMuse queries
- Reuse browser contexts
- Implement request queuing

### Scale to 1000+ users

- Move to dedicated infrastructure (AWS ECS, GCP Cloud Run)
- Implement proper job queue (BullMQ, Celery)
- Add monitoring (Datadog, New Relic)
- Consider agent pool management

## Cost Estimates

### Minimal Setup (Testing)
- Railway Starter: $5/month
- Vercel Pro: $20/month (if needed)
- **Total**: ~$25/month

### Production (100-500 users)
- Railway Standard: $20/month
- Upstash Redis: $10/month
- Vercel Pro: $20/month
- **Total**: ~$50/month

### High Scale (1000+ users)
- Railway/Render scaled: $100-200/month
- Redis: $20-50/month
- Vercel Pro: $20/month
- **Total**: ~$150-300/month

## Troubleshooting

### Agent Service Crashes

**Check**:
1. Memory limits (Playwright needs 512MB-1GB)
2. Timeout settings (long-running agent tasks)
3. Browser cleanup (ensure `await agent.cleanup()` runs)

**Fix**:
- Increase instance memory
- Add request timeout handling
- Implement graceful shutdown

### Screenshots Not Uploading

**Check**:
1. Supabase Storage bucket exists
2. Service role key has storage permissions
3. Network connectivity from agent service

**Fix**:
- Verify bucket: https://supabase.com/dashboard/project/iriaegoipkjtktitpary/storage/buckets
- Test upload manually
- Check firewall rules

### SSE Disconnects

**Check**:
1. Load balancer timeout settings
2. Vercel function timeout (10s for Hobby, 60s for Pro)
3. Client reconnection logic

**Fix**:
- Upgrade Vercel plan if needed
- Implement client-side reconnection
- Use Redis for persistent pub/sub

## Security Checklist

- [x] Service role key stored as secret (not in code)
- [x] CORS configured properly
- [x] Supabase RLS policies enabled
- [x] Storage bucket is private (signed URLs only)
- [x] Rate limiting on agent endpoints (TODO)
- [x] Input validation on all endpoints (TODO)

## Monitoring Setup

### Key Metrics to Track

1. **Agent Service**
   - Request rate
   - Response time
   - Error rate
   - Memory usage
   - Active sessions

2. **Web App**
   - SSE connection count
   - Message throughput
   - API error rate

3. **Supabase**
   - Storage usage
   - Database queries
   - RLS policy hits

### Recommended Tools

- **Logs**: Railway/Render built-in
- **Metrics**: Railway Metrics or Grafana
- **Errors**: Sentry (add to both services)
- **Uptime**: UptimeRobot or Better Uptime

## Next Steps

1. **Deploy agent service** (choose Railway/Render/Fly)
2. **Set AGENT_SERVICE_URL** in Vercel
3. **Test production** end-to-end
4. **Monitor** for 24 hours
5. **Optimize** based on usage patterns
6. **Scale** as needed

---

**Questions?** Check logs first, then review this guide. Most issues are env vars or network connectivity.

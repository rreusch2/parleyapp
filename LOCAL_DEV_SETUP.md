# Professor Lock - Local Development Setup

## Quick Start (5 minutes)

### 1. Agent Service Setup

```bash
cd /home/reid/Desktop/parleyapp/agent

# Create .env file
cp service/.env.example service/.env
# Edit service/.env and add your SUPABASE_SERVICE_ROLE_KEY

# Install Python dependencies (if not already done)
pip install -r requirements.txt

# Install Playwright browsers
python -m playwright install --with-deps

# Start the agent service
uvicorn service.server:app --host 0.0.0.0 --port 8000 --reload
```

**Test it**: Open http://localhost:8000/healthz - should return `{"ok": true}`

### 2. Web App Setup

```bash
cd /home/reid/Desktop/parleyapp/web-app

# Create/edit .env.local
echo "AGENT_SERVICE_URL=http://localhost:8000" >> .env.local

# Make sure you have these already (from existing setup):
# NEXT_PUBLIC_SUPABASE_URL=https://iriaegoipkjtktitpary.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...

# Start dev server
npm run dev
# or
pnpm dev
```

### 3. Test the Flow

1. **Open**: http://localhost:3000/professor-lock
2. **Login** (if not already)
3. **Click**: "Start Session" button
4. **Watch**:
   - Left panel: Chat interface becomes active
   - Right panel: Tool Activity will show events
5. **Send a message**: "What are the best MLB games today?"
6. **Observe**:
   - Agent service logs (terminal 1) show processing
   - Tool Activity (right) shows thinking/tool_invocation phases
   - Chat (left) shows assistant responses
   - Screenshots appear in Tool Activity when browser is used

## Architecture Flow

```
User Browser
    ↓
Next.js Web App (localhost:3000)
    ↓ HTTP POST /session/start
Agent Service (localhost:8000)
    ↓ Runs Manus agent with BrowserUseTool
    ↓ Captures screenshots as base64
    ↓ Uploads to Supabase Storage
    ↓ HTTP POST back to web-app
Next.js API Routes
    ↓ /api/professor-lock/events (persists + broadcasts)
    ↓ /api/professor-lock/message (persists + broadcasts)
    ↓ In-memory SSE bus
    ↓ /api/professor-lock/stream (SSE)
User Browser (live updates)
```

## Troubleshooting

### Agent Service Won't Start

**Error**: `ModuleNotFoundError: No module named 'app'`
**Fix**: Make sure you're running from `/home/reid/Desktop/parleyapp/agent` directory

**Error**: `playwright install failed`
**Fix**: Run `python -m playwright install --with-deps` separately

### Web App Can't Connect to Agent

**Error**: `Failed to contact Agent Service`
**Check**:
1. Agent service is running: `curl http://localhost:8000/healthz`
2. `.env.local` has `AGENT_SERVICE_URL=http://localhost:8000`
3. No firewall blocking localhost:8000

### No Screenshots Appearing

**Check**:
1. Supabase Storage bucket `professor-lock-artifacts` exists
2. `SUPABASE_SERVICE_ROLE_KEY` is set correctly in agent service
3. Agent service logs show successful uploads
4. Browser console shows no CORS errors

### SSE Stream Not Working

**Check**:
1. Browser DevTools → Network → filter "stream" → should see EventStream connection
2. Next.js console shows "SSE connected" message
3. No ad blockers or extensions blocking SSE

## Environment Variables Checklist

### Agent Service (`agent/service/.env`)
- [x] `SUPABASE_URL`
- [x] `SUPABASE_SERVICE_ROLE_KEY`
- [x] `WEB_API_BASE_URL=http://localhost:3000`

### Web App (`web-app/.env.local`)
- [x] `AGENT_SERVICE_URL=http://localhost:8000`
- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `SUPABASE_SERVICE_ROLE_KEY`

### Agent Config (`agent/config/config.toml`)
- [x] `llm.api_key` (OpenAI or your LLM provider)
- [x] `llm.model` (e.g., "gpt-4o")
- [x] `daytona.daytona_api_key` (if using Daytona sandboxes)

## Next Steps After Local Testing

1. **Deploy Agent Service** to Railway/Render/Fly.io
2. **Update Vercel** `AGENT_SERVICE_URL` to production URL
3. **Test production** flow end-to-end
4. **Optional**: Migrate SSE bus to Redis for multi-instance scale

## Useful Commands

```bash
# Agent service logs (verbose)
uvicorn service.server:app --host 0.0.0.0 --port 8000 --reload --log-level debug

# Web app with debug
npm run dev -- --debug

# Check Supabase Storage
# Go to: https://supabase.com/dashboard/project/iriaegoipkjtktitpary/storage/buckets

# Test agent service directly
curl -X POST http://localhost:8000/session/start \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-123","userId":"user-456","tier":"pro","preferences":{}}'
```

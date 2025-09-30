# Professor Lock - AI Sports Betting Assistant

## Overview

Professor Lock is an advanced AI-powered sports betting assistant that uses autonomous agents, browser automation, and real-time data to provide intelligent betting analysis and recommendations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                          │
│              https://www.predictive-play.com                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   NEXT.JS WEB APP (Vercel)                   │
│  • /professor-lock page (React UI)                          │
│  • API Routes:                                               │
│    - POST /api/professor-lock/session (create session)      │
│    - POST /api/professor-lock/message (store messages)      │
│    - POST /api/professor-lock/events (receive tool events)  │
│    - GET  /api/professor-lock/stream (SSE streaming)        │
│  • In-memory SSE bus (broadcasts events to UI)              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              AGENT SERVICE (Railway/Render/Fly)              │
│  • FastAPI server (Python)                                   │
│  • Endpoints:                                                │
│    - POST /session/start (initialize agent)                 │
│    - POST /session/message (process user input)             │
│  • Manus Agent (OpenManus framework)                        │
│    - BrowserUseTool (web automation + screenshots)          │
│    - StatMuse queries                                        │
│    - Web search                                              │
│    - Python execution                                        │
│  • Posts back to web-app:                                    │
│    - Tool events → /api/professor-lock/events               │
│    - Assistant messages → /api/professor-lock/message       │
│    - Screenshots → Supabase Storage                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (Database + Storage)             │
│  • Tables:                                                   │
│    - professor_lock_sessions                                │
│    - professor_lock_messages                                │
│    - professor_lock_events                                  │
│    - professor_lock_artifacts                               │
│  • Storage:                                                  │
│    - professor-lock-artifacts bucket (screenshots)          │
└─────────────────────────────────────────────────────────────┘
```

## Features

### 🤖 Autonomous AI Agent
- **Manus Agent**: Uses OpenManus framework with multiple tools
- **Browser Automation**: Real-time web browsing with screenshot capture
- **Multi-Tool Execution**: StatMuse, web search, Python code execution
- **Intelligent Planning**: Autonomous task breakdown and execution

### 💬 Real-Time Chat Interface
- **Streaming Responses**: Live SSE updates as agent works
- **Tool Activity Timeline**: Visual feed of agent actions
- **Screenshot Gallery**: Live browser screenshots from agent
- **Session Management**: Persistent conversations with context

### 📊 Advanced Capabilities
- **Sports Data Analysis**: StatMuse integration for real-time stats
- **Web Research**: Autonomous web search and data extraction
- **Parlay Building**: Intelligent multi-leg bet construction
- **Injury Reports**: Real-time injury and lineup updates
- **Odds Analysis**: Live odds comparison and value detection

## Technology Stack

### Frontend (Web App)
- **Framework**: Next.js 14 (App Router)
- **UI**: React, TailwindCSS, Framer Motion
- **State**: React hooks, SSE for real-time updates
- **Deployment**: Vercel

### Backend (Agent Service)
- **Framework**: FastAPI (Python 3.12)
- **Agent**: OpenManus (Manus agent)
- **Browser**: Playwright (Chromium)
- **Tools**: browser-use, StatMuse, web search
- **Deployment**: Railway/Render/Fly.io

### Database & Storage
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (private bucket)
- **Auth**: Supabase Auth (RLS policies)

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- Supabase account
- OpenAI/Anthropic API key (for LLM)

### Local Development

**1. Agent Service**
```bash
cd agent
cp service/.env.example service/.env
# Edit service/.env with your keys
./service/start-local.sh
```

**2. Web App**
```bash
cd web-app
echo "AGENT_SERVICE_URL=http://localhost:8000" >> .env.local
npm run dev
```

**3. Test**
- Open http://localhost:3000/professor-lock
- Click "Start Session"
- Send a message

See [LOCAL_DEV_SETUP.md](./LOCAL_DEV_SETUP.md) for detailed instructions.

## Deployment

### Agent Service (Choose One)

**Railway** (Recommended)
```bash
# Push to GitHub, then:
# 1. Create Railway project from repo
# 2. Set root directory: /agent
# 3. Set env vars (see PROFESSOR_LOCK_DEPLOYMENT.md)
# 4. Deploy
```

**Render**
```bash
# 1. Create Web Service from GitHub
# 2. Root: agent, Dockerfile: service/Dockerfile
# 3. Set env vars
# 4. Deploy
```

**Fly.io**
```bash
cd agent
fly launch --no-deploy
# Edit fly.toml
fly secrets set SUPABASE_URL=...
fly deploy
```

### Web App

Already deployed on Vercel. Just add:
```
AGENT_SERVICE_URL=https://your-agent-service.com
```

See [PROFESSOR_LOCK_DEPLOYMENT.md](./PROFESSOR_LOCK_DEPLOYMENT.md) for complete guide.

## Environment Variables

### Agent Service
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
WEB_API_BASE_URL=https://www.predictive-play.com
PROFESSOR_LOCK_BUCKET=professor-lock-artifacts
PORT=8000
```

### Web App
```bash
AGENT_SERVICE_URL=https://your-agent-service.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Agent Config
Edit `agent/config/config.toml`:
```toml
[llm]
model = "gpt-4o"
base_url = "https://api.openai.com/v1"
api_key = "your_openai_key"
max_tokens = 15000
temperature = 0.0

[daytona]
daytona_api_key = "your_daytona_key"
```

## How It Works

### User Flow

1. **User visits** `/professor-lock` page
2. **Clicks** "Start Session" button
3. **Web app** creates session in database
4. **Web app** calls Agent Service `/session/start`
5. **Agent Service** initializes Manus agent
6. **Browser** opens SSE stream to `/api/professor-lock/stream`
7. **User** sends message via chat input
8. **Web app** stores message, forwards to Agent Service
9. **Agent** processes message using tools:
   - Browser automation for web research
   - StatMuse for sports stats
   - Web search for news/odds
   - Python for calculations
10. **Agent** emits events as it works:
    - "Thinking" phase
    - "Tool invocation" (e.g., browser_use)
    - Screenshots captured and uploaded
    - "Result" with findings
11. **Web app** receives events via POST to `/api/professor-lock/events`
12. **SSE bus** broadcasts events to browser
13. **UI updates** in real-time:
    - Tool Activity shows events
    - Screenshots appear
    - Chat shows assistant responses
14. **User** sees live agent activity and results

### Data Flow

```
User Message
    ↓
Web App (persist + forward)
    ↓
Agent Service (process)
    ↓
Manus Agent (think + act)
    ↓
Tools (browser, StatMuse, etc.)
    ↓
Screenshots → Supabase Storage
    ↓
Events → Web App API
    ↓
SSE Bus (broadcast)
    ↓
Browser (live update)
```

## API Reference

### Agent Service

**POST /session/start**
```json
{
  "sessionId": "uuid",
  "userId": "uuid",
  "tier": "free|pro|elite",
  "preferences": {
    "sports": ["MLB", "WNBA"],
    "riskTolerance": "medium"
  }
}
```

**POST /session/message**
```json
{
  "sessionId": "uuid",
  "userId": "uuid",
  "message": "What are the best picks today?"
}
```

### Web App API

**POST /api/professor-lock/session**
- Creates session in database
- Enqueues to Agent Service
- Returns `{ sessionId }`

**POST /api/professor-lock/message**
- Stores message (user/assistant/system)
- Forwards user messages to Agent Service
- Broadcasts non-user messages to SSE

**POST /api/professor-lock/events**
- Stores tool events and artifacts
- Broadcasts to SSE bus
- Returns `{ success, results }`

**GET /api/professor-lock/stream?sessionId=X**
- SSE stream for live updates
- Emits: `chat_message`, `tool_event`, `session_complete`

## Database Schema

### professor_lock_sessions
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES profiles(id)
tier TEXT (free|pro|elite)
status TEXT (pending|running|completed|errored|cancelled)
sandbox_id TEXT
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ
preferences_snapshot JSONB
metadata JSONB
```

### professor_lock_messages
```sql
id UUID PRIMARY KEY
session_id UUID REFERENCES professor_lock_sessions(id)
role TEXT (user|assistant|system)
content TEXT
model JSONB
created_at TIMESTAMPTZ
```

### professor_lock_events
```sql
id UUID PRIMARY KEY
session_id UUID REFERENCES professor_lock_sessions(id)
agent_event_id TEXT
phase TEXT (thinking|tool_invocation|result|completed)
tool TEXT (browser_use|statmuse_query|web_search)
title TEXT
message TEXT
payload JSONB
created_at TIMESTAMPTZ
```

### professor_lock_artifacts
```sql
id UUID PRIMARY KEY
session_id UUID REFERENCES professor_lock_sessions(id)
event_id UUID REFERENCES professor_lock_events(id)
storage_path TEXT
content_type TEXT
caption TEXT
created_at TIMESTAMPTZ
```

## Troubleshooting

### Agent Service Issues

**Service won't start**
- Check Python version (3.12+)
- Install deps: `pip install -r requirements.txt`
- Install Playwright: `python -m playwright install --with-deps`

**No screenshots**
- Verify Supabase Storage bucket exists
- Check `SUPABASE_SERVICE_ROLE_KEY` has storage permissions
- Check agent logs for upload errors

**Agent hangs**
- Check LLM API key is valid
- Verify network connectivity
- Check agent logs for errors
- Increase timeout settings

### Web App Issues

**SSE not connecting**
- Check browser console for errors
- Verify `/api/professor-lock/stream` returns 200
- Check ad blockers aren't blocking SSE

**No events showing**
- Verify Agent Service is running
- Check `AGENT_SERVICE_URL` is correct
- Check web-app logs for POST errors
- Verify SSE bus is broadcasting

**Screenshots not loading**
- Check Supabase Storage bucket permissions
- Verify signed URL generation works
- Check browser console for CORS errors

## Performance & Scaling

### Current Capacity
- **Concurrent Users**: 10-100
- **Sessions**: Unlimited (stateless)
- **SSE**: In-memory (single instance)

### Scaling to 100-1000 Users
1. **Migrate SSE to Redis** (Upstash)
2. **Horizontal scaling** (multiple agent instances)
3. **Load balancer** (if needed)
4. **Caching** (StatMuse queries, odds data)

### Scaling to 1000+ Users
1. **Dedicated infrastructure** (AWS ECS, GCP Cloud Run)
2. **Job queue** (BullMQ, Celery)
3. **Agent pool** (pre-warmed instances)
4. **Monitoring** (Datadog, New Relic)

## Security

- ✅ Service role key stored as secrets
- ✅ RLS policies on all tables
- ✅ Private storage bucket (signed URLs)
- ✅ CORS configured properly
- ⚠️ Rate limiting (TODO)
- ⚠️ Input validation (TODO)

## Monitoring

### Key Metrics
- Agent service: Request rate, response time, error rate
- Web app: SSE connections, message throughput
- Supabase: Storage usage, query performance

### Recommended Tools
- Logs: Railway/Render built-in
- Errors: Sentry
- Uptime: UptimeRobot
- Metrics: Grafana

## Contributing

This is a private project. For questions or issues, contact the development team.

## License

Proprietary - All rights reserved

## Support

- Documentation: This README + deployment guides
- Local testing: `LOCAL_DEV_SETUP.md`
- Deployment: `PROFESSOR_LOCK_DEPLOYMENT.md`
- Status: `PROFESSOR_LOCK_STATUS.md`

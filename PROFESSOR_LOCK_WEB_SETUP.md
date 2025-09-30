# Professor Lock Web Experience - Setup Guide

## 🚀 Quick Start

### 1. Run Database Migration

The Professor Lock web experience requires new database tables. Run the migration in your Supabase SQL Editor:

```bash
# Copy the SQL file contents
cat database/migrations/20250929_professor_lock_schema.sql
```

**Or run directly in Supabase:**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Paste the contents of `database/migrations/20250929_professor_lock_schema.sql`
5. Click **Run**

This will create:
- ✅ `professor_lock_sessions` - Session management
- ✅ `professor_lock_messages` - Chat history
- ✅ `professor_lock_events` - Tool telemetry
- ✅ `professor_lock_artifacts` - Screenshots/charts
- ✅ Storage bucket `professor-lock-artifacts`
- ✅ RLS policies for user data isolation

### 2. Verify Environment Variables

Ensure your `web-app/.env.local` has:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Test the Interface

1. Start the web app:
   ```bash
   cd web-app
   npm run dev
   ```

2. Navigate to: `http://localhost:3000/professor-lock`

3. Click **"Start Session"** button

4. You should see:
   - Session created successfully
   - Chat panel becomes active
   - Session info shows session ID

## 🎯 Current Status

### ✅ Completed
- **Frontend UI**: Full chat interface with tool timeline
- **API Routes**: Session, message, events, and SSE streaming endpoints
- **Database Schema**: All tables and RLS policies ready
- **Real-time Streaming**: SSE connection with reconnection logic
- **Type Safety**: Full TypeScript coverage

### 🚧 In Progress
- **Agent Service**: Daytona integration and OpenManus orchestration
- **Tool Views**: Specialized components for browser screenshots, StatMuse results, etc.
- **Authentication**: Replace demo user with actual auth context

### 📋 Next Steps
1. **Run the SQL migration** (see above)
2. **Test session creation** - Should work once DB is set up
3. **Agent service development** - Build the worker that:
   - Spins up Daytona sandboxes
   - Runs OpenManus agent with custom tools
   - Emits events to `/api/professor-lock/events`
   - Uploads screenshots to Supabase Storage

## 🛠️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Frontend                            │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  LiveChatPanel   │  │   ToolTimeline   │                │
│  │  (Messages)      │  │   (Events)       │                │
│  └──────────────────┘  └──────────────────┘                │
│           │                      │                           │
│           └──────────┬───────────┘                           │
│                      │                                       │
│         useProfessorLockSession Hook                         │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js API Routes                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  POST /api/professor-lock/session                    │  │
│  │  POST /api/professor-lock/message                    │  │
│  │  POST /api/professor-lock/events                     │  │
│  │  GET  /api/professor-lock/stream (SSE)               │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  professor_lock_sessions                             │  │
│  │  professor_lock_messages                             │  │
│  │  professor_lock_events                               │  │
│  │  professor_lock_artifacts                            │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┼───────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Agent Service (Coming Soon)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Daytona Sandbox Management                        │  │
│  │  • OpenManus Agent Orchestration                     │  │
│  │  • Tool Execution (Browser, StatMuse, Supabase)      │  │
│  │  • Event Emission via Webhooks                       │  │
│  │  • Screenshot Capture & Upload                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 Features

### Chat Interface
- Real-time streaming responses
- User/assistant message bubbles
- Typing indicators
- Auto-scroll to latest message
- Disabled state when no session

### Tool Timeline
- Live tool activity feed
- Phase-based color coding
- Tool-specific icons
- Artifact previews (screenshots, charts)
- Empty state handling

### Session Management
- One-click session start/stop
- Connection status indicators
- Session info panel
- Automatic reconnection on disconnect

## 🔐 Security

- **RLS Policies**: Users can only see their own sessions
- **Service Role**: API routes use service role for admin operations
- **Auth Integration**: Ready for auth context integration
- **Artifact Cleanup**: Screenshots auto-purge after session ends

## 📝 Development Notes

### Demo User
Currently using `demo-user-123` for testing. Replace with actual auth:

```typescript
// In ProfessorLockShell.tsx
const { user } = useAuth() // Your auth hook
const userId = user?.id || 'demo-user-123'
const tier = user?.subscription_tier || 'free'
```

### Error Handling
All API routes include comprehensive error handling and logging. Check browser console and server logs for debugging.

### SSE Streaming
The SSE endpoint (`/api/professor-lock/stream`) is an Edge runtime function for optimal performance. It auto-closes after 5 minutes of inactivity.

## 🐛 Troubleshooting

### "Failed to create session"
- ✅ Run the SQL migration first
- ✅ Check `SUPABASE_SERVICE_ROLE_KEY` is set
- ✅ Verify `professor_lock_sessions` table exists

### No messages appearing
- ✅ Check browser console for SSE connection errors
- ✅ Verify `/api/professor-lock/stream` endpoint is accessible
- ✅ Ensure session status is 'active'

### TypeScript errors
- ✅ Run `npm install` in `web-app/`
- ✅ Restart TypeScript server in your IDE

## 📚 Resources

- **Supabase Docs**: https://supabase.com/docs
- **Daytona API**: https://daytona.io/docs
- **OpenManus**: `/agent/README.md`
- **xAI Grok**: https://x.ai/api

---

**Status**: Frontend complete ✅ | Backend ready ✅ | Agent service pending 🚧

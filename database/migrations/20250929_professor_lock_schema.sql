-- Professor Lock Web Experience Schema
-- Creates tables for session management, messages, tool events, and artifacts

-- Bucket for transient artifacts (screenshots, charts, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('professor-lock-artifacts', 'professor-lock-artifacts', false)
ON CONFLICT (id) DO NOTHING;

-- Sessions table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professor_lock_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free','pro','elite')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','errored','cancelled')),
  sandbox_id TEXT,                         -- Daytona sandbox identifier
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_heartbeat TIMESTAMPTZ,
  preferences_snapshot JSONB,              -- copy of sport prefs, risk profile, etc.
  metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_professor_lock_sessions_user_id ON public.professor_lock_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_professor_lock_sessions_status ON public.professor_lock_sessions (status);

-- Messages table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professor_lock_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.professor_lock_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  model JSONB,                             -- model/version info, token usage, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_professor_lock_messages_session_created ON public.professor_lock_messages (session_id, created_at);

-- Tool events table ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professor_lock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.professor_lock_sessions(id) ON DELETE CASCADE,
  agent_event_id TEXT NOT NULL,            -- id emitted by the agent runtime
  phase TEXT NOT NULL                      -- thinking | tool_invocation | result | completed
    CHECK (phase IN ('thinking','tool_invocation','result','completed')),
  tool TEXT,                               -- browser_use, statmuse_query, supabase_query, etc.
  title TEXT,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_professor_lock_events_session_agent_event ON public.professor_lock_events (session_id, agent_event_id);
CREATE INDEX IF NOT EXISTS idx_professor_lock_events_session_created ON public.professor_lock_events (session_id, created_at);

-- Artifacts table ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professor_lock_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.professor_lock_sessions(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.professor_lock_events(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,              -- e.g. professor-lock-artifacts/session-id/screenshot.png
  content_type TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_professor_lock_artifacts_session ON public.professor_lock_artifacts (session_id);
CREATE INDEX IF NOT EXISTS idx_professor_lock_artifacts_event ON public.professor_lock_artifacts (event_id);

-- RLS Policies ---------------------------------------------------------------
ALTER TABLE public.professor_lock_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own sessions" ON public.professor_lock_sessions;
CREATE POLICY "Users can read own sessions"
  ON public.professor_lock_sessions
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.professor_lock_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own session messages" ON public.professor_lock_messages;
CREATE POLICY "Users can read own session messages"
  ON public.professor_lock_messages
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM public.professor_lock_sessions WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.professor_lock_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own session events" ON public.professor_lock_events;
CREATE POLICY "Users can read own session events"
  ON public.professor_lock_events
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM public.professor_lock_sessions WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.professor_lock_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own session artifacts" ON public.professor_lock_artifacts;
CREATE POLICY "Users can read own session artifacts"
  ON public.professor_lock_artifacts
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM public.professor_lock_sessions WHERE user_id = auth.uid()
    )
  );

-- Grant necessary permissions ------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.professor_lock_sessions TO authenticated;
GRANT ALL ON public.professor_lock_messages TO authenticated;
GRANT ALL ON public.professor_lock_events TO authenticated;
GRANT ALL ON public.professor_lock_artifacts TO authenticated;

-- Comments -------------------------------------------------------------------
COMMENT ON TABLE public.professor_lock_sessions IS 'Professor Lock web chat sessions with Daytona sandbox integration';
COMMENT ON TABLE public.professor_lock_messages IS 'Chat messages between user and Professor Lock AI';
COMMENT ON TABLE public.professor_lock_events IS 'Tool invocation telemetry from the agent (browser, StatMuse, Supabase, etc.)';
COMMENT ON TABLE public.professor_lock_artifacts IS 'Screenshots, charts, and other artifacts generated during sessions';

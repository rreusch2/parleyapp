import asyncio
import base64
import os
import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional

import httpx
from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel

from app.agent.manus import Manus

# --------- Environment ---------
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
WEB_API_BASE_URL = os.environ.get("WEB_API_BASE_URL", "http://localhost:3000")
STORAGE_BUCKET = os.environ.get("PROFESSOR_LOCK_BUCKET", "professor-lock-artifacts")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("[agent-service] WARNING: Missing Supabase env (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)")

# --------- Models ---------
class StartSessionPayload(BaseModel):
    sessionId: str
    userId: str
    tier: str
    preferences: Optional[dict] = None

class MessagePayload(BaseModel):
    sessionId: str
    userId: str
    message: str

@dataclass
class SessionRunner:
    session_id: str
    user_id: str
    tier: str
    preferences: Optional[dict]
    agent: Optional[Manus] = None
    queue: asyncio.Queue[str] = field(default_factory=asyncio.Queue)
    running: bool = False

    async def start(self):
        if self.running:
            return
        self.running = True
        if not self.agent:
            self.agent = await Manus.create()
        asyncio.create_task(self._loop())

    async def add_message(self, text: str):
        await self.queue.put(text)

    async def _loop(self):
        try:
            while self.running:
                try:
                    text = await asyncio.wait_for(self.queue.get(), timeout=300)
                except asyncio.TimeoutError:
                    # End session after inactivity
                    await self._post_session_complete()
                    self.running = False
                    break

                # Notify UI we're thinking
                await self._post_tool_event(phase="thinking", title="Processing message", message=text)

                assert self.agent is not None
                result = await self.agent.run(text)

                # Persist assistant message back to web app
                await self._post_assistant_message(result)

                # Upload any screenshots captured during tool calls
                await self._flush_artifacts()

                # Mark result
                await self._post_tool_event(phase="result", title="Completed step", message=result)

        except Exception as e:
            await self._post_tool_event(phase="result", title="Agent error", message=str(e))
        finally:
            await self._post_session_complete()

    async def _flush_artifacts(self):
        # Scan agent memory for any messages with base64_image
        if not self.agent:
            return
        artifacts = []
        for msg in self.agent.memory.messages:
            if getattr(msg, "base64_image", None):
                try:
                    path = await self._upload_image_base64(msg.base64_image)
                    artifacts.append({
                        "storagePath": path,
                        "contentType": "image/png",
                        "caption": "Browser screenshot"
                    })
                except Exception as e:
                    print("[agent-service] upload error:", e)
        if artifacts:
            # Attach artifacts to a tool_event
            await self._post_tool_event(phase="result", title="Captured screenshot", message="Browser state", artifacts=artifacts)

    async def _upload_image_base64(self, b64: str) -> str:
        # Decode and upload to Supabase Storage via REST
        data = base64.b64decode(b64)
        object_path = f"{self.session_id}/{uuid.uuid4().hex}.png"
        url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{object_path}?cacheControl=3600&upsert=true"
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "image/png",
                },
                content=data,
            )
            if r.status_code not in (200, 201):
                raise RuntimeError(f"storage upload failed {r.status_code}: {r.text}")
        return object_path

    async def _post_tool_event(self, *, phase: str, title: str, message: str, artifacts: Optional[list] = None):
        payload = {
            "sessionId": self.session_id,
            "events": [
                {
                    "agentEventId": uuid.uuid4().hex,
                    "phase": phase,
                    "tool": "agent",
                    "title": title,
                    "message": message,
                    "payload": None,
                    "artifacts": artifacts or [],
                }
            ],
        }
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(f"{WEB_API_BASE_URL}/api/professor-lock/events", json=payload)

    async def _post_assistant_message(self, content: str):
        payload = {
            "sessionId": self.session_id,
            "userId": self.user_id,
            "message": content,
            "role": "assistant",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            await client.post(f"{WEB_API_BASE_URL}/api/professor-lock/message", json=payload)

    async def _post_session_complete(self):
        await self._post_tool_event(phase="completed", title="Session complete", message="Agent finished")

# --------- Service ---------
app = FastAPI(title="Professor Lock Agent Service")

_sessions: Dict[str, SessionRunner] = {}

@app.get("/healthz")
async def healthz():
    return {"ok": True}

@app.post("/session/start")
async def start_session(body: StartSessionPayload, background: BackgroundTasks):
    runner = _sessions.get(body.sessionId)
    if not runner:
        runner = SessionRunner(
            session_id=body.sessionId,
            user_id=body.userId,
            tier=body.tier,
            preferences=body.preferences,
        )
        _sessions[body.sessionId] = runner
    background.add_task(runner.start)
    return {"ok": True, "sessionId": body.sessionId}

@app.post("/session/message")
async def push_message(body: MessagePayload):
    runner = _sessions.get(body.sessionId)
    if not runner:
        # Lazy-create runner if not yet started
        runner = SessionRunner(
            session_id=body.sessionId,
            user_id=body.userId,
            tier="free",
            preferences=None,
        )
        _sessions[body.sessionId] = runner
        await runner.start()
    await runner.add_message(body.message)
    return {"ok": True}

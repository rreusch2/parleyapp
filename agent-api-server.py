#!/usr/bin/env python3
"""
Simple FastAPI server to wrap the existing OpenManus agent for WebSocket integration
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from starlette.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import your existing agent
import sys
import os
sys.path.append('/home/reid/Desktop/parleyapp/agent')

from app.agent.manus import Manus
from app.tool.sandbox.sb_browser_tool import SandboxBrowserTool
from app.tool import ToolCollection
from app.tool.browser_use_tool import BrowserUseTool
from app.daytona.sandbox import create_sandbox, get_or_start_sandbox
from app.schema import AgentState
import secrets
from app.logger import logger

app = FastAPI(
    title="Professor Lock Agent API",
    description="API wrapper for OpenManus agent with Daytona integration",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global agent instance
agent_instance: Optional[Manus] = None
active_sessions: Dict[str, Dict[str, Any]] = {}
session_agents: Dict[str, Manus] = {}

class ChatRequest(BaseModel):
    sessionId: str
    message: str
    conversationHistory: list = []
    userContext: dict = {}

class ChatResponse(BaseModel):
    response: str
    toolsUsed: list = []
    sessionId: str
    timestamp: str

class SandboxCreateResponse(BaseModel):
    sandbox_id: str
    vnc_password: str

@app.on_event("startup")
async def startup_event():
    """Initialize the agent on startup"""
    global agent_instance
    try:
        logger.info("🚀 Initializing OpenManus agent...")
        agent_instance = await Manus.create()
        logger.info("✅ OpenManus agent initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize agent: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup agent on shutdown"""
    global agent_instance
    if agent_instance:
        try:
            await agent_instance.cleanup()
            logger.info("🧹 Agent cleanup completed")
        except Exception as e:
            logger.error(f"❌ Error during cleanup: {e}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "agent_ready": agent_instance is not None,
        "active_sessions": len(active_sessions)
    }

@app.post("/sandbox/create", response_model=SandboxCreateResponse)
async def sandbox_create():
    """Create a new Daytona sandbox and return its id and VNC password."""
    try:
        vnc_password = secrets.token_urlsafe(12)
        sandbox = create_sandbox(password=vnc_password)
        return SandboxCreateResponse(sandbox_id=sandbox.id, vnc_password=vnc_password)
    except Exception as e:
        logger.error(f"Failed to create sandbox: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Main chat endpoint for the agent"""
    if not agent_instance:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        session_id = request.sessionId
        message = request.message
        
        # Update session tracking
        if session_id not in active_sessions:
            active_sessions[session_id] = {
                "created_at": datetime.now().isoformat(),
                "message_count": 0,
                "user_context": request.userContext
            }
        
        active_sessions[session_id]["message_count"] += 1
        active_sessions[session_id]["last_activity"] = datetime.now().isoformat()
        
        logger.info(f"💬 Processing message for session {session_id}: {message[:100]}...")
        
        # Build enhanced prompt with user context
        enhanced_prompt = build_enhanced_prompt(message, request.userContext, request.conversationHistory)
        
        # Process with agent
        response = await agent_instance.run(enhanced_prompt)
        
        # For now, return the response as-is
        # In the future, we could parse tool usage from the agent's output
        return ChatResponse(
            response=str(response) if response else "I'm processing your request...",
            toolsUsed=[],  # Will need to extract this from agent output
            sessionId=session_id,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"❌ Error processing chat request: {e}")
        raise HTTPException(status_code=500, detail=f"Agent processing failed: {str(e)}")

@app.post("/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    """Streaming chat endpoint: emits thoughts, tool events, and screenshots as SSE."""
    if not agent_instance:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    session_id = request.sessionId

    async def event_stream():
        try:
            # Create or reuse a Manus instance bound to a sandbox (if provided)
            sandbox_id = (
                request.userContext.get("daytonaSandboxId")
                or request.userContext.get("daytona_sandbox_id")
            )

            if session_id not in session_agents:
                agent = await Manus.create()
                # Replace local BrowserUseTool with SandboxBrowserTool if sandbox provided
                if sandbox_id:
                    try:
                        sandbox = await get_or_start_sandbox(sandbox_id)
                        base_tools = [
                            tool
                            for tool in agent.available_tools.tools
                            if tool.name != BrowserUseTool().name
                        ]
                        sb_tool = SandboxBrowserTool.create_with_sandbox(sandbox)
                        agent.available_tools = ToolCollection(*base_tools)
                        agent.available_tools.add_tool(sb_tool)
                        # Ensure the internal automation API is running to avoid first-call timeouts
                        try:
                            sb_tool.ensure_automation_service(retries=2)
                        except Exception:
                            pass
                        logger.info(
                            f"Sandbox tool attached for session {session_id} (sandbox {sandbox_id})"
                        )
                    except Exception as e:
                        logger.error(f"Failed to attach sandbox tool: {e}")
                session_agents[session_id] = agent

            agent = session_agents[session_id]

            # Build prompt and seed memory
            enhanced_prompt = build_enhanced_prompt(
                request.message, request.userContext, request.conversationHistory
            )
            agent.current_step = 0
            agent.state = AgentState.IDLE
            agent.messages = []
            agent.update_memory("user", enhanced_prompt)

            # Step loop
            while (
                agent.current_step < agent.max_steps and agent.state != AgentState.FINISHED
            ):
                agent.current_step += 1
                logger.info(f"Executing step {agent.current_step}/{agent.max_steps}")

                prev_len = len(agent.messages)
                should_act = await agent.think()

                # Emit latest assistant content as a thought chunk
                if len(agent.messages) > prev_len:
                    msg = agent.messages[-1]
                    if getattr(msg, "role", "") == "assistant" and getattr(msg, "content", ""):
                        data = {"type": "message_chunk", "content": msg.content}
                        yield f"data: {json.dumps(data)}\n\n"

                # If browser state captured a screenshot via BrowserContextHelper, emit it
                try:
                    helper = getattr(agent, "browser_context_helper", None)
                    if helper is not None:
                        # This will update helper._current_base64_image if available
                        await helper.get_browser_state()
                        base64_img = getattr(helper, "_current_base64_image", None)
                        if base64_img:
                            ss_event = {
                                "type": "tool_screenshot",
                                "toolName": "sandbox_browser",
                                "screenshot": f"data:image/jpeg;base64,{base64_img}",
                            }
                            yield f"data: {json.dumps(ss_event)}\n\n"
                            # Consume once
                            helper._current_base64_image = None
                except Exception as _e:
                    # Non-fatal
                    pass

                if not should_act:
                    break

                # Execute tool calls and emit events
                for tc in getattr(agent, "tool_calls", []) or []:
                    try:
                        args = json.loads(tc.function.arguments or "{}")
                    except Exception:
                        args = {}
                    yield f"data: {json.dumps({'type':'tool_start','tool':{'name': tc.function.name, 'parameters': args}})}\n\n"

                    # Execute tool and capture result
                    result = await agent.execute_tool(tc)

                    # If a screenshot was produced, emit it
                    base64_img = getattr(agent, "_current_base64_image", None)
                    if base64_img:
                        ss_event = {
                            "type": "tool_screenshot",
                            "toolName": tc.function.name,
                            "screenshot": f"data:image/jpeg;base64,{base64_img}",
                        }
                        yield f"data: {json.dumps(ss_event)}\n\n"

                    # For sandbox browser, explicitly ask the tool for current state screenshot as a fallback
                    try:
                        if tc.function.name == "sandbox_browser":
                            sb_tool = agent.available_tools.get_tool("sandbox_browser")
                            if sb_tool and hasattr(sb_tool, "get_current_state"):
                                state_res = await sb_tool.get_current_state()
                                if getattr(state_res, "base64_image", None):
                                    ss_event2 = {
                                        "type": "tool_screenshot",
                                        "toolName": tc.function.name,
                                        "screenshot": f"data:image/jpeg;base64,{state_res.base64_image}",
                                    }
                                    yield f"data: {json.dumps(ss_event2)}\n\n"
                    except Exception as _e:
                        pass

                    # Emit tool completion
                    yield f"data: {json.dumps({'type':'tool_complete','toolName': tc.function.name, 'result': str(result)})}\n\n"

                if agent.state == AgentState.FINISHED:
                    break

            # End of stream
            yield f"data: {json.dumps({'type':'end'})}\n\n"

        except Exception as e:
            err = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(err)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.get("/sessions")
async def get_sessions():
    """Get active session information"""
    return {
        "active_sessions": active_sessions,
        "total_sessions": len(active_sessions)
    }

@app.delete("/sessions/{session_id}")
async def cleanup_session(session_id: str):
    """Cleanup a specific session"""
    if session_id in active_sessions:
        del active_sessions[session_id]
        return {"message": f"Session {session_id} cleaned up"}
    else:
        raise HTTPException(status_code=404, detail="Session not found")

def build_enhanced_prompt(message: str, user_context: dict, conversation_history: list) -> str:
    """Build an enhanced prompt with user context and conversation history"""
    
    # Get user tier for context
    user_tier = user_context.get('tier', 'free')
    user_preferences = user_context.get('preferences', {})
    
    # Build system context
    system_context = f"""You are Professor Lock Advanced, an elite AI sports betting analyst with access to powerful tools for real-time research and analysis.

**User Context:**
- Subscription: {user_tier} tier
- Preferences: {json.dumps(user_preferences, indent=2) if user_preferences else 'None specified'}

**Your Capabilities:**
- Browser tool for live injury reports, odds checking, and news research
- StatMuse tool for historical player and team statistics
- Web search for current information and breaking news
- Python analysis for statistical modeling and data visualization
- Supabase database access for historical betting data

**Communication Style:**
- Be concise (2–3 sentences per response unless actively streaming research)
- Never write in ALL CAPS; use normal sentence case with selective bolding for emphasis
- Be confident and data-driven
- Use tools strategically when they add value
- Explain your reasoning with supporting evidence
- Provide specific recommendations with confidence levels
- Bold important picks, odds, and numbers
- Always end with a clear next step or question

**Current Request:** {message}

"""

    # Add conversation history if available
    if conversation_history:
        system_context += "\n**Recent Conversation:**\n"
        for msg in conversation_history[-3:]:  # Last 3 messages for context
            role = msg.get('role', 'unknown')
            content = msg.get('content', '')[:200]  # Truncate long messages
            system_context += f"- {role}: {content}\n"
    
    return system_context

if __name__ == "__main__":
    # Run the server
    uvicorn.run(
        "agent-api-server:app",
        host="0.0.0.0",
        port=3003,
        reload=False,
        log_level="info"
    )

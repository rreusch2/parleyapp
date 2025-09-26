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
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import your existing agent
import sys
import os
sys.path.append('/home/reid/Desktop/parleyapp/agent')

from app.agent.manus import Manus
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
- Be concise, confident, and data-driven
- Use tools strategically when they add value
- Explain your reasoning with supporting evidence
- Provide specific recommendations with confidence levels
- Bold important picks, odds, and numbers

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

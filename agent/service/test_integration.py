#!/usr/bin/env python3
"""
Quick integration test for Professor Lock Agent Service
Run this after starting the service locally to verify it works
"""

import asyncio
import httpx
import os
from datetime import datetime

# Configuration
AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "http://localhost:8000")
WEB_API_BASE_URL = os.getenv("WEB_API_BASE_URL", "http://localhost:3000")

async def test_health():
    """Test health endpoint"""
    print("🔍 Testing health endpoint...")
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"{AGENT_SERVICE_URL}/healthz")
            if r.status_code == 200 and r.json().get("ok"):
                print("✅ Health check passed")
                return True
            else:
                print(f"❌ Health check failed: {r.status_code} {r.text}")
                return False
        except Exception as e:
            print(f"❌ Health check error: {e}")
            return False

async def test_session_start():
    """Test session start endpoint"""
    print("\n🔍 Testing session start...")
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            payload = {
                "sessionId": f"test-{datetime.now().timestamp()}",
                "userId": "test-user-123",
                "tier": "pro",
                "preferences": {"sports": ["MLB", "WNBA"]}
            }
            r = await client.post(f"{AGENT_SERVICE_URL}/session/start", json=payload)
            if r.status_code == 200:
                data = r.json()
                print(f"✅ Session started: {data}")
                return data.get("sessionId")
            else:
                print(f"❌ Session start failed: {r.status_code} {r.text}")
                return None
        except Exception as e:
            print(f"❌ Session start error: {e}")
            return None

async def test_message():
    """Test message endpoint"""
    print("\n🔍 Testing message endpoint...")
    
    # First start a session
    session_id = await test_session_start()
    if not session_id:
        return False
    
    # Wait a bit for session to initialize
    await asyncio.sleep(2)
    
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            payload = {
                "sessionId": session_id,
                "userId": "test-user-123",
                "message": "Hello, this is a test message. Just respond with 'Test received'."
            }
            r = await client.post(f"{AGENT_SERVICE_URL}/session/message", json=payload)
            if r.status_code == 200:
                print(f"✅ Message sent: {r.json()}")
                print("⏳ Agent is processing... (check logs for activity)")
                return True
            else:
                print(f"❌ Message failed: {r.status_code} {r.text}")
                return False
        except Exception as e:
            print(f"❌ Message error: {e}")
            return False

async def test_env_vars():
    """Test environment variables are set"""
    print("\n🔍 Checking environment variables...")
    
    required = {
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        "WEB_API_BASE_URL": os.getenv("WEB_API_BASE_URL"),
    }
    
    all_set = True
    for key, value in required.items():
        if value:
            print(f"✅ {key}: {value[:20]}..." if len(value) > 20 else f"✅ {key}: {value}")
        else:
            print(f"❌ {key}: NOT SET")
            all_set = False
    
    return all_set

async def main():
    print("=" * 60)
    print("Professor Lock Agent Service - Integration Test")
    print("=" * 60)
    
    # Test environment
    env_ok = await test_env_vars()
    if not env_ok:
        print("\n⚠️  Some environment variables are missing!")
        print("Set them in agent/service/.env or export them")
        return
    
    # Test health
    health_ok = await test_health()
    if not health_ok:
        print("\n❌ Service is not healthy. Is it running?")
        print(f"Start it with: cd agent && ./service/start-local.sh")
        return
    
    # Test session start
    session_ok = await test_session_start()
    if not session_ok:
        print("\n❌ Session start failed")
        return
    
    # Test message
    message_ok = await test_message()
    
    print("\n" + "=" * 60)
    if health_ok and session_ok and message_ok:
        print("✅ All tests passed!")
        print("\nNext steps:")
        print("1. Check agent service logs for processing activity")
        print("2. Check web-app logs for incoming events/messages")
        print("3. Open http://localhost:3000/professor-lock in browser")
    else:
        print("❌ Some tests failed. Check logs above.")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())

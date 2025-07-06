#!/usr/bin/env python3
"""Test script to validate the intelligent player props agent."""

import os
import sys
import asyncio
from dotenv import load_dotenv
from intelligent_player_props_agent import IntelligentPlayerPropsAgent, logger

# Load environment variables from backend/.env
load_dotenv('backend/.env')

async def test_agent_initialization():
    """Test that the agent can be initialized properly."""
    try:
        logger.info("🧪 Testing agent initialization...")
        agent = IntelligentPlayerPropsAgent()
        logger.info("✅ Agent initialized successfully!")
        
        # Test database connection
        logger.info("🧪 Testing database connection...")
        games = await agent.fetch_upcoming_games()
        logger.info(f"✅ Found {len(games)} upcoming games")
        
        props = await agent.fetch_player_props()
        logger.info(f"✅ Found {len(props)} player props")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Agent test failed: {e}")
        return False

async def test_research_plan():
    """Test creating a research plan."""
    try:
        logger.info("🧪 Testing research plan creation...")
        agent = IntelligentPlayerPropsAgent()
        
        # Get some sample data
        games = await agent.fetch_upcoming_games()
        props = await agent.fetch_player_props()
        
        if not props:
            logger.warning("⚠️ No props found, skipping research plan test")
            return True
            
        # Create research plan with small sample
        sample_props = props[:5]
        plan = await agent.create_research_plan(sample_props, games[:3])
        
        logger.info(f"✅ Research plan created: {len(plan.get('statmuse_queries', []))} StatMuse queries, {len(plan.get('web_searches', []))} web searches")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Research plan test failed: {e}")
        return False

async def main():
    """Run all tests."""
    logger.info("🚀 Starting Intelligent Player Props Agent Tests")
    
    # Check environment variables
    if not os.getenv('XAI_API_KEY'):
        logger.error("❌ XAI_API_KEY environment variable not set!")
        logger.info("Please set your xAI Grok API key: export XAI_API_KEY='your_key_here'")
        return
    
    tests = [
        test_agent_initialization,
        test_research_plan
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if await test():
            passed += 1
        print("-" * 50)
    
    logger.info(f"🏁 Tests completed: {passed}/{total} passed")
    
    if passed == total:
        logger.info("🎉 All tests passed! Agent is ready for full run.")
    else:
        logger.warning("⚠️ Some tests failed. Check the logs above.")

if __name__ == "__main__":
    asyncio.run(main())

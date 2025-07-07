#!/usr/bin/env python3
"""
Test script for the unified sports betting system
Tests both props.py and teams.py agents independently
"""

import os
import sys
import asyncio
import logging
from datetime import datetime

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_props_agent():
    """Test the player props agent"""
    logger.info("🧪 Testing Player Props Agent...")
    
    try:
        from props import IntelligentPlayerPropsAgent
        
        agent = IntelligentPlayerPropsAgent()
        logger.info("✅ Props agent initialized successfully")
        
        # Test database connections
        try:
            games = await agent.fetch_upcoming_games()
            logger.info(f"✅ Found {len(games)} upcoming games")
        except Exception as e:
            logger.error(f"❌ Failed to fetch games: {e}")
            return False
        
        try:
            props = await agent.fetch_player_props()
            logger.info(f"✅ Found {len(props)} player props")
        except Exception as e:
            logger.error(f"❌ Failed to fetch props: {e}")
            return False
        
        logger.info("✅ Props agent test completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Props agent test failed: {e}")
        return False

async def test_teams_agent():
    """Test the team betting agent"""
    logger.info("🧪 Testing Team Betting Agent...")
    
    try:
        from teams import IntelligentTeamBettingAgent
        
        agent = IntelligentTeamBettingAgent()
        logger.info("✅ Teams agent initialized successfully")
        
        # Test database connections
        try:
            games = await agent.fetch_upcoming_games()
            logger.info(f"✅ Found {len(games)} upcoming games")
        except Exception as e:
            logger.error(f"❌ Failed to fetch games: {e}")
            return False
        
        try:
            odds = await agent.fetch_team_odds()
            logger.info(f"✅ Found {len(odds)} team betting lines")
        except Exception as e:
            logger.error(f"❌ Failed to fetch team odds: {e}")
            return False
        
        logger.info("✅ Teams agent test completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Teams agent test failed: {e}")
        return False

async def test_environment():
    """Test environment variables and dependencies"""
    logger.info("🧪 Testing Environment...")
    
    required_vars = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'XAI_API_KEY',
        'BACKEND_URL'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
        else:
            logger.info(f"✅ {var} is set")
    
    if missing_vars:
        logger.error(f"❌ Missing environment variables: {missing_vars}")
        return False
    
    # Test imports
    try:
        import requests
        import openai
        from supabase import create_client
        logger.info("✅ All required packages imported successfully")
    except ImportError as e:
        logger.error(f"❌ Missing required package: {e}")
        return False
    
    logger.info("✅ Environment test completed successfully")
    return True

async def main():
    """Main test function"""
    logger.info("🚀 Starting Unified Sports Betting System Tests")
    logger.info(f"⏰ Test time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)
    
    # Test results
    results = {
        'environment': False,
        'props_agent': False,
        'teams_agent': False
    }
    
    # Run tests
    results['environment'] = await test_environment()
    logger.info("")
    
    if results['environment']:
        results['props_agent'] = await test_props_agent()
        logger.info("")
        
        results['teams_agent'] = await test_teams_agent()
        logger.info("")
    else:
        logger.warning("⚠️ Skipping agent tests due to environment issues")
    
    # Summary
    logger.info("=" * 60)
    logger.info("📊 TEST SUMMARY")
    logger.info("=" * 60)
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        logger.info(f"{test_name.replace('_', ' ').title()}: {status}")
    
    overall_success = all(results.values())
    logger.info("")
    
    if overall_success:
        logger.info("🎉 All tests passed! The unified system is ready to use.")
        logger.info("")
        logger.info("To run the system:")
        logger.info("  python main.py --mode both --summary")
        logger.info("  python main.py --mode props --props-count 5")
        logger.info("  python main.py --mode teams --teams-count 5")
    else:
        logger.error("❌ Some tests failed. Please fix the issues before proceeding.")
    
    return overall_success

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("⏹️ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Test execution failed: {e}")
        sys.exit(1)
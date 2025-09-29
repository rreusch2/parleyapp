#!/usr/bin/env python3
"""
Test Script for Agentic Betting System
Validates OpenManus integration with custom betting tools

This script tests:
1. Tool initialization and connectivity
2. Database access and queries
3. StatMuse API integration
4. Basic agent functionality

Run this before using the full agentic system to ensure everything is configured correctly.
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

# Add OpenManus to Python path
openmanus_path = Path(__file__).parent / "OpenManus"
sys.path.insert(0, str(openmanus_path))

try:
    from app.tool.supabase_betting import SupabaseBettingTool
    from app.tool.statmuse_betting import StatMuseBettingTool
    from app.agent.betting_agent import BettingAgent
    from app.logger import logger
    print("✅ OpenManus imports successful")
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Ensure OpenManus is properly set up and configured")
    sys.exit(1)


async def test_supabase_connection():
    """Test Supabase database connection and basic queries"""
    print("\n🔍 Testing Supabase Connection...")
    
    try:
        tool = SupabaseBettingTool()
        print("✅ SupabaseBettingTool initialized")
        
        # Test getting upcoming games
        result = await tool.execute(action="get_upcoming_games", limit=3)
        
        if result.error:
            print(f"❌ Supabase test failed: {result.error}")
            return False
        else:
            data = eval(result.output) if isinstance(result.output, str) else result.output
            games_found = data.get("games_found", 0)
            print(f"✅ Found {games_found} upcoming games")
            
            # Test getting recent predictions
            recent_result = await tool.execute(action="get_recent_predictions", limit=5)
            if not recent_result.error:
                recent_data = eval(recent_result.output) if isinstance(recent_result.output, str) else recent_result.output
                recent_count = recent_data.get("total_recent_predictions", 0)
                print(f"✅ Found {recent_count} recent predictions in database")
            
            return True
            
    except Exception as e:
        print(f"❌ Supabase test error: {str(e)}")
        return False


async def test_statmuse_connection():
    """Test StatMuse API connection"""
    print("\n🔍 Testing StatMuse Connection...")
    
    try:
        tool = StatMuseBettingTool()
        print("✅ StatMuseBettingTool initialized")
        
        # Test simple query
        test_query = "Boston Red Sox wins this season"
        result = await tool.execute(query=test_query, sport="MLB")
        
        if result.error:
            print(f"❌ StatMuse test failed: {result.error}")
            print("Make sure your StatMuse server is running on localhost:5001")
            return False
        else:
            print("✅ StatMuse query successful")
            return True
            
    except Exception as e:
        print(f"❌ StatMuse test error: {str(e)}")
        return False


async def test_betting_agent():
    """Test BettingAgent initialization"""
    print("\n🔍 Testing BettingAgent...")
    
    try:
        agent = BettingAgent()
        print("✅ BettingAgent initialized successfully")
        
        # Check available tools
        tools = agent.available_tools
        tool_names = [tool.name for tool in tools.tools]
        print(f"✅ Available tools: {', '.join(tool_names)}")
        
        return True
        
    except Exception as e:
        print(f"❌ BettingAgent test error: {str(e)}")
        return False


async def test_simple_analysis():
    """Test a simple analysis workflow"""
    print("\n🔍 Testing Simple Analysis Workflow...")
    
    try:
        agent = BettingAgent()
        
        # Simple task to test the workflow
        simple_task = """
Test your tools by:
1. Getting 3 upcoming games using supabase_betting
2. Running 1 simple StatMuse query about any team you find
3. Doing 1 web search for recent sports news
4. Then terminate

This is just a connectivity test - don't generate actual picks.
"""
        
        print("🧠 Executing simple test workflow...")
        result = await agent.run(simple_task)
        print("✅ Simple analysis workflow completed")
        return True
        
    except Exception as e:
        print(f"❌ Simple analysis test error: {str(e)}")
        return False


async def main():
    """Run all tests"""
    print("🎯 Agentic Betting System Test Suite")
    print("=" * 50)
    print("Testing OpenManus integration with ParleyApp betting tools")
    print()
    
    tests = [
        ("Supabase Database", test_supabase_connection),
        ("StatMuse API", test_statmuse_connection), 
        ("BettingAgent", test_betting_agent),
        ("Simple Workflow", test_simple_analysis)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            success = await test_func()
            results[test_name] = success
        except Exception as e:
            print(f"❌ {test_name} test crashed: {str(e)}")
            results[test_name] = False
    
    # Summary
    print("\n" + "=" * 50)
    print("TEST RESULTS SUMMARY")
    print("=" * 50)
    
    passed = sum(results.values())
    total = len(results)
    
    for test_name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name:.<30} {status}")
    
    print()
    print(f"Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        print("Your agentic betting system is ready to use.")
        print()
        print("Next steps:")
        print("1. Run: python agentic_team_picks.py --picks 5")
        print("2. Run: python agentic_props_picks.py --picks 5")
        print("3. Check your ai_predictions table for results")
    else:
        print("\n⚠️ SOME TESTS FAILED")
        print("Please fix the failing components before using the system.")
        print()
        print("Common issues:")
        print("- StatMuse server not running (start with: python statmuse_api_server.py)")
        print("- Environment variables not loaded (check backend/.env)")
        print("- Supabase credentials not configured")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())



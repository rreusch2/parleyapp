#!/usr/bin/env python3
"""
Test script for the Intelligent Player Props Agent
"""

import os
import asyncio
import json
from setup_player_props_env import setup_environment
from intelligent_player_props_agent import IntelligentPlayerPropsAgent, StatMuseClient, DatabaseClient

# Load environment variables
setup_environment()

async def test_statmuse_connection():
    """Test StatMuse API connection"""
    print("🔍 Testing StatMuse connection...")
    
    client = StatMuseClient()
    
    # Test basic query
    result = client.query("Aaron Judge hits last 10 games")
    print(f"StatMuse test result: {json.dumps(result, indent=2)}")
    
    return result.get('error') is None

def test_database_connection():
    """Test database connection"""
    print("🗄️ Testing database connection...")
    
    try:
        db = DatabaseClient()
        games = db.get_upcoming_games(hours_ahead=48)
        print(f"Found {len(games)} upcoming games")
        
        if games:
            print("Sample game:", games[0])
            
            # Test getting props for these games
            game_ids = [game['id'] for game in games[:3]]
            props = db.get_player_props_for_games(game_ids)
            print(f"Found {len(props)} player props")
            
            if props:
                print("Sample prop:", {
                    'player': props[0].player_name,
                    'prop_type': props[0].prop_type,
                    'line': props[0].line,
                    'team': props[0].team
                })
        
        return True
        
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False

async def test_full_agent():
    """Test the full agent workflow"""
    print("🤖 Testing full agent workflow...")
    
    try:
        agent = IntelligentPlayerPropsAgent()
        picks = await agent.generate_daily_picks(target_picks=3)  # Test with just 3 picks
        
        print(f"✅ Generated {len(picks)} picks!")
        
        for i, pick in enumerate(picks, 1):
            print(f"\nPick {i}:")
            print(f"  Match: {pick['match_teams']}")
            print(f"  Pick: {pick['pick']}")
            print(f"  Confidence: {pick['confidence']}%")
            print(f"  Value: {pick['value_percentage']}%")
            if 'metadata' in pick and 'reasoning' in pick['metadata']:
                print(f"  Reasoning: {pick['metadata']['reasoning'][:100]}...")
        
        return len(picks) > 0
        
    except Exception as e:
        print(f"Full agent test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all tests"""
    print("🚀 Starting Player Props Agent Tests\n")
    
    # Test 1: StatMuse connection
    statmuse_ok = await test_statmuse_connection()
    print(f"StatMuse test: {'✅ PASS' if statmuse_ok else '❌ FAIL'}\n")
    
    # Test 2: Database connection
    db_ok = test_database_connection()
    print(f"Database test: {'✅ PASS' if db_ok else '❌ FAIL'}\n")
    
    # Test 3: Full agent (only if previous tests pass)
    if statmuse_ok and db_ok:
        agent_ok = await test_full_agent()
        print(f"Full agent test: {'✅ PASS' if agent_ok else '❌ FAIL'}")
    else:
        print("❌ Skipping full agent test due to failed prerequisites")
    
    print("\n🏁 Tests completed!")

if __name__ == "__main__":
    asyncio.run(main())

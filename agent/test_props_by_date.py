#!/usr/bin/env python3
"""Quick test script to verify get_player_props_by_date works"""

import asyncio
import os
import sys
from dotenv import load_dotenv

# Load environment
load_dotenv("../backend/.env")

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.tool.supabase_betting import SupabaseBettingTool

async def main():
    print("=" * 80)
    print("Testing get_player_props_by_date action")
    print("=" * 80)
    
    tool = SupabaseBettingTool()
    tool.set_forced_date("2025-10-03")
    
    # Test the new action
    result = await tool.execute(
        action="get_player_props_by_date",
        date="2025-10-03",
        limit=20
    )
    
    print("\n📊 RESULTS:")
    print(f"Success: {result.is_success()}")
    
    if result.is_success():
        data = result.output
        print(f"\n✅ Found {data['total_props_found']} player props!")
        print(f"Query Date: {data['query_date']}")
        print(f"\nProps by Sport: {data['props_by_sport']}")
        print(f"Props by Type: {data['props_by_type']}")
        
        print(f"\n📋 Sample Props (first 5):")
        for i, prop in enumerate(data['player_props'][:5], 1):
            print(f"\n{i}. {prop['player_name']} ({prop['team']}) - {prop['prop_type']}")
            print(f"   Line: {prop['line']} | Over: {prop['over_odds']} | Under: {prop['under_odds']}")
            print(f"   Bookmaker: {prop['bookmaker']}")
    else:
        print(f"\n❌ Error: {result.error}")

if __name__ == "__main__":
    asyncio.run(main())

"""
Test script to verify Linemate extraction is working
Run this to debug and verify the browser extraction fixes
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.tool.linemate_trends import LinemateTrendsTool


async def test_linemate_extraction():
    """Test Linemate extraction with detailed logging"""
    
    print("=" * 80)
    print("LINEMATE EXTRACTION TEST")
    print("=" * 80)
    print()
    
    # Initialize the tool
    print("1. Initializing LinemateTrendsTool...")
    tool = LinemateTrendsTool()
    print("   ✓ Tool initialized")
    print()
    
    # Test with CFB
    sport = "CFB"
    max_scroll = 3
    
    print(f"2. Testing extraction for {sport}")
    print("   - URL: https://linemate.io/ncaaf/trends")
    print(f"   - Max scrolls: {max_scroll}")
    print("   - Browser will open (headless=false)")
    print()
    
    print("3. Executing extraction...")
    print("   (Watch the browser window open and navigate)")
    print("   (Check logs below for extraction previews)")
    print()
    
    try:
        result = await tool.execute(
            sport=sport,
            max_scroll=max_scroll
        )
        
        print()
        print("=" * 80)
        print("EXTRACTION RESULTS")
        print("=" * 80)
        print()
        
        if result.error:
            print("❌ EXTRACTION FAILED")
            print(f"   Error: {result.error}")
            print()
            print("TROUBLESHOOTING:")
            print("1. Check if browser window opened")
            print("2. Check if Linemate.io loaded correctly")
            print("3. Look at logs above for 'extraction preview'")
            print("4. Try increasing wait times in linemate_trends.py")
            return False
        else:
            print("✅ EXTRACTION SUCCESSFUL")
            print()
            
            import json
            data = json.loads(result.output) if isinstance(result.output, str) else result.output
            
            total = data.get("total_trends", 0)
            trends = data.get("trends", [])
            
            print(f"   Total trends extracted: {total}")
            print()
            
            if total > 0:
                print("   Sample trends (first 5):")
                for i, trend in enumerate(trends[:5], 1):
                    player = trend.get("player_name", "Unknown")
                    prop = trend.get("prop_type", "Unknown")
                    hit_rate = trend.get("hit_rate", "N/A")
                    trend_status = trend.get("trend", "neutral")
                    print(f"   {i}. {player} - {prop}: {hit_rate}% ({trend_status})")
                
                print()
                print(f"   ... and {total - 5} more" if total > 5 else "")
                print()
                
                # Summary
                print("   Trend Summary:")
                print(data.get("summary", "No summary available"))
                
                print()
                print("=" * 80)
                print("✅ TEST PASSED - Extraction is working correctly!")
                print("=" * 80)
                return True
            else:
                print("⚠️  WARNING: Extraction returned 0 trends")
                print()
                print("TROUBLESHOOTING:")
                print("1. Check logs above for 'extraction preview' - is text being extracted?")
                print("2. Check if JSON parsing is failing")
                print("3. Try running again (sometimes pages load slowly)")
                print("4. Check if Linemate.io is accessible in your region")
                return False
    
    except Exception as e:
        print()
        print("❌ TEST FAILED WITH EXCEPTION")
        print(f"   Exception: {str(e)}")
        print()
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup
        print()
        print("4. Cleaning up browser resources...")
        try:
            await tool.cleanup()
            print("   ✓ Cleanup complete")
        except Exception as e:
            print(f"   ⚠️  Cleanup error (non-critical): {e}")


async def test_with_specific_players():
    """Test extraction with specific player names"""
    
    print()
    print("=" * 80)
    print("TESTING WITH SPECIFIC PLAYERS")
    print("=" * 80)
    print()
    
    tool = LinemateTrendsTool()
    
    # Test with specific CFB players
    player_names = ["LJ Martin", "Noah Fifita", "Bear Bachmeier"]
    
    print(f"Looking for specific players: {', '.join(player_names)}")
    print()
    
    result = await tool.execute(
        sport="CFB",
        player_names=player_names,
        max_scroll=3
    )
    
    if not result.error:
        import json
        data = json.loads(result.output) if isinstance(result.output, str) else result.output
        trends = data.get("trends", [])
        
        found_players = {t.get("player_name") for t in trends}
        
        print(f"Total trends found: {len(trends)}")
        print(f"Players found: {', '.join(found_players) if found_players else 'None'}")
        print()
        
        for player in player_names:
            player_trends = [t for t in trends if player.lower() in t.get("player_name", "").lower()]
            if player_trends:
                print(f"✓ Found {len(player_trends)} trends for {player}")
            else:
                print(f"✗ No trends found for {player}")
    
    await tool.cleanup()


def main():
    """Run all tests"""
    print()
    print("🧪 LINEMATE EXTRACTION TEST SUITE")
    print()
    
    # Run basic extraction test
    success = asyncio.run(test_linemate_extraction())
    
    # If basic test passed, optionally test specific players
    if success:
        print()
        response = input("Run test with specific players? (y/n): ").strip().lower()
        if response == 'y':
            asyncio.run(test_with_specific_players())
    
    print()
    print("🏁 TEST SUITE COMPLETE")
    print()


if __name__ == "__main__":
    main()


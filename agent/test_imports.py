"""Test that all new betting agent imports work"""
import sys

print("Testing imports...")

try:
    from app.tool.linemate_trends import LinemateTrendsTool
    print("[OK] LinemateTrendsTool imported")
except ImportError as e:
    print(f"[FAIL] LinemateTrendsTool import failed: {e}")
    sys.exit(1)

try:
    from app.tool.search.google_search import GoogleSearchEngine
    print("[OK] GoogleSearchEngine imported")
except ImportError as e:
    print(f"[FAIL] GoogleSearchEngine import failed: {e}")
    sys.exit(1)

try:
    from app.tool.statmuse_betting import StatMuseBettingTool
    print("[OK] StatMuseBettingTool imported")
except ImportError as e:
    print(f"[FAIL] StatMuseBettingTool import failed: {e}")
    sys.exit(1)

try:
    from app.agent.betting_agent import BettingAgent
    print("[OK] BettingAgent imported")
except ImportError as e:
    print(f"[FAIL] BettingAgent import failed: {e}")
    sys.exit(1)

print("\n[SUCCESS] All imports successful!")
print("\nYou can now run:")
print("  python run_props_agent.py --sport NHL --picks 30")
print("  python run_props_agent.py --sport CFB --picks 30")
print("  python run_props_agent.py --sport MLB --picks 25")


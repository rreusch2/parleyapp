"""
Test script to verify headshot ingestion before full run
"""
import os
import requests
from supabase import create_client, Client

# Load environment variables from .env file if it exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, will use environment variables

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://iriaegoipkjtktitpary.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_KEY:
    print("❌ SUPABASE_SERVICE_KEY environment variable is required")
    print("\nPlease set it with:")
    print("export SUPABASE_SERVICE_KEY='your_key_here'")
    exit(1)

print("✅ Supabase credentials found")
print(f"   URL: {SUPABASE_URL}")
print(f"   Key: {SUPABASE_KEY[:10]}...{SUPABASE_KEY[-10:]}")

# Test connection
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase client created successfully")
except Exception as e:
    print(f"❌ Error creating Supabase client: {str(e)}")
    exit(1)

# Test query
try:
    result = supabase.table("players").select("id, name, sport").limit(1).execute()
    print(f"✅ Database connection successful")
    print(f"   Test player: {result.data[0]['name']} ({result.data[0]['sport']})")
except Exception as e:
    print(f"❌ Error querying database: {str(e)}")
    exit(1)

# Test headshot URL patterns
print("\n" + "="*60)
print("Testing Headshot URL Patterns")
print("="*60 + "\n")

test_cases = [
    {
        "sport": "NBA",
        "player_id": "201939",  # Stephen Curry
        "urls": [
            "https://a.espncdn.com/i/headshots/nba/players/full/3975.png",
            "https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png",
        ]
    },
    {
        "sport": "MLB", 
        "player_id": "592450",  # Aaron Judge
        "urls": [
            "https://a.espncdn.com/i/headshots/mlb/players/full/33192.png",
            "https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/592450/headshot/67/current",
        ]
    },
    {
        "sport": "NFL",
        "player_id": "4361741",  # Patrick Mahomes
        "urls": [
            "https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png",
        ]
    }
]

for test in test_cases:
    print(f"{test['sport']} - Testing player ID: {test['player_id']}")
    for url in test['urls']:
        try:
            response = requests.head(url, timeout=5, allow_redirects=True)
            if response.status_code == 200:
                print(f"  ✅ {url[:80]}...")
            else:
                print(f"  ❌ {url[:80]}... (Status: {response.status_code})")
        except Exception as e:
            print(f"  ❌ {url[:80]}... (Error: {str(e)})")
    print()

# Test with actual database players
print("="*60)
print("Testing with Real Database Players (NBA)")
print("="*60 + "\n")

try:
    result = supabase.table("players")\
        .select("id, name, external_player_id")\
        .eq("sport", "NBA")\
        .eq("active", True)\
        .is_("headshot_url", "null")\
        .limit(3)\
        .execute()
    
    for player in result.data:
        print(f"Player: {player['name']}")
        print(f"  External ID: {player['external_player_id']}")
        
        # Try ESPN pattern
        if player['external_player_id']:
            url = f"https://a.espncdn.com/i/headshots/nba/players/full/{player['external_player_id']}.png"
            try:
                response = requests.head(url, timeout=5, allow_redirects=True)
                if response.status_code == 200:
                    print(f"  ✅ Found headshot: {url}")
                else:
                    print(f"  ❌ No headshot found (Status: {response.status_code})")
            except Exception as e:
                print(f"  ❌ Error: {str(e)}")
        print()
        
except Exception as e:
    print(f"❌ Error testing with database players: {str(e)}")

print("="*60)
print("Test Complete!")
print("="*60)
print("\nIf all tests passed, you're ready to run:")
print("  python ingest_player_headshots.py")
print("\nFor a small test first, edit the script and set limits:")
print("  sports_to_process = [('NBA', 10)]")


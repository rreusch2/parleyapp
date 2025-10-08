"""
NHL Headshot Ingestion - Direct CDN Approach
Only works for players with numeric IDs (not UUIDs)
"""
import os
import requests
from supabase import create_client, Client
import time
from datetime import datetime

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://iriaegoipkjtktitpary.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_KEY:
    raise ValueError("SUPABASE_SERVICE_KEY required")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# NHL.com CDN patterns
NHL_CDN_PATTERNS = [
    lambda pid: f"https://cms.nhl.bamgrid.com/images/headshots/current/168x168/{pid}.jpg",
    lambda pid: f"https://cms.nhl.bamgrid.com/images/headshots/current/168x168/{pid}@2x.jpg",
    lambda pid: f"https://assets.nhle.com/mugs/nhl/20242025/{pid}.png",
    lambda pid: f"https://a.espncdn.com/i/headshots/nhl/players/full/{pid}.png",
]


def is_numeric_id(player_id: str) -> bool:
    """Check if ID is numeric"""
    return player_id and player_id.isdigit()


def verify_image_url(url: str) -> bool:
    """Verify image URL is accessible"""
    try:
        response = requests.head(url, timeout=5, allow_redirects=True)
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            return 'image' in content_type
        return False
    except:
        return False


def find_nhl_headshot(player_id: str) -> tuple:
    """Try multiple NHL CDN patterns"""
    for pattern in NHL_CDN_PATTERNS:
        try:
            url = pattern(player_id)
            if verify_image_url(url):
                return (url, 'nhl')
        except:
            continue
    return None


def main():
    print("\n" + "="*60)
    print("NHL Headshot Ingestion (Numeric IDs Only)")
    print("="*60 + "\n")
    
    # Get NHL players with numeric IDs only
    result = supabase.table("players").select(
        "id, name, external_player_id"
    ).eq("sport", "NHL")\
     .eq("active", True)\
     .is_("headshot_url", "null")\
     .execute()
    
    # Filter to numeric IDs only
    numeric_players = [
        p for p in result.data 
        if is_numeric_id(p.get('external_player_id'))
    ]
    
    uuid_count = len(result.data) - len(numeric_players)
    
    print(f"Total NHL players missing headshots: {len(result.data)}")
    print(f"  - With numeric IDs: {len(numeric_players)} (will try)")
    print(f"  - With UUIDs: {uuid_count} (cannot process with free sources)")
    print()
    
    if not numeric_players:
        print("No NHL players with numeric IDs to process!")
        return
    
    success_count = 0
    failed_count = 0
    
    for i, player in enumerate(numeric_players, 1):
        player_id = player['id']
        external_id = player['external_player_id']
        name = player['name']
        
        print(f"[{i}/{len(numeric_players)}] {name} (ID: {external_id})")
        
        result = find_nhl_headshot(external_id)
        
        if result:
            url, source = result
            try:
                supabase.table("players").update({
                    "headshot_url": url,
                    "headshot_source": source,
                    "headshot_last_updated": datetime.utcnow().isoformat()
                }).eq("id", player_id).execute()
                
                print(f"  ✓ Found: {url[:80]}...")
                success_count += 1
            except Exception as e:
                print(f"  ✗ Database error: {str(e)}")
                failed_count += 1
        else:
            print(f"  ✗ No headshot found")
            failed_count += 1
        
        time.sleep(0.1)  # Rate limiting
    
    print(f"\n{'='*60}")
    print(f"NHL Results:")
    print(f"  Success: {success_count}/{len(numeric_players)}")
    print(f"  Failed: {failed_count}/{len(numeric_players)}")
    print(f"  Success Rate: {(success_count/len(numeric_players)*100):.2f}%")
    print(f"\n  UUID players not processed: {uuid_count}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()


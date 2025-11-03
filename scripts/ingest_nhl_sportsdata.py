"""
NHL Headshot Ingestion using SportsData.io API
Uses free trial API key to fetch all NHL player headshots
"""
import os
import requests
from supabase import create_client, Client
from datetime import datetime
import time

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# SportsData.io API Configuration
SPORTSDATA_API_KEY = "62fa3caa1fcd47eb99a2b737973a46be"
SPORTSDATA_NHL_ENDPOINT = f"https://api.sportsdata.io/v3/nhl/headshots/json/Headshots?key={SPORTSDATA_API_KEY}"

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://iriaegoipkjtktitpary.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_KEY:
    raise ValueError("SUPABASE_SERVICE_KEY environment variable is required")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_sportsdata_headshots():
    """Fetch all NHL headshots from SportsData.io"""
    print("Fetching NHL headshots from SportsData.io API...")
    
    try:
        response = requests.get(SPORTSDATA_NHL_ENDPOINT, timeout=30)
        
        if response.status_code == 200:
            headshots = response.json()
            print(f"✓ Retrieved {len(headshots)} headshots from SportsData.io\n")
            return headshots
        else:
            print(f"✗ API Error: Status {response.status_code}")
            print(f"  Response: {response.text[:200]}")
            return []
            
    except Exception as e:
        print(f"✗ Error fetching from SportsData.io: {str(e)}")
        return []


def normalize_name(name):
    """Normalize player name for matching"""
    if not name:
        return ""
    return name.lower().strip().replace(".", "").replace("-", " ").replace("'", "")


def find_matching_headshot(player_name, player_id, headshots_data):
    """
    Find matching headshot from SportsData.io data
    Try multiple matching strategies
    """
    normalized_player_name = normalize_name(player_name)
    
    for headshot in headshots_data:
        # Try matching by player ID first
        if player_id and str(headshot.get('PlayerID')) == str(player_id):
            return headshot.get('PreferredHostedHeadshotUrl')
        
        # Try matching by name
        api_name = headshot.get('Name', '')
        normalized_api_name = normalize_name(api_name)
        
        if normalized_player_name == normalized_api_name:
            return headshot.get('PreferredHostedHeadshotUrl')
    
    return None


def main():
    print("\n" + "="*60)
    print("NHL Headshot Ingestion - SportsData.io")
    print("="*60 + "\n")
    
    # Fetch all headshots from SportsData.io
    headshots_data = fetch_sportsdata_headshots()
    
    if not headshots_data:
        print("Failed to fetch headshots from SportsData.io. Exiting.")
        return
    
    # Get NHL players missing headshots from database
    print("Fetching NHL players from database...")
    result = supabase.table("players").select(
        "id, name, player_name, external_player_id"
    ).eq("sport", "NHL")\
     .eq("active", True)\
     .is_("headshot_url", "null")\
     .execute()
    
    players = result.data
    print(f"Found {len(players)} NHL players missing headshots\n")
    
    if not players:
        print("No NHL players need headshots!")
        return
    
    success_count = 0
    failed_count = 0
    
    for i, player in enumerate(players, 1):
        player_id_internal = player['id']
        external_id = player.get('external_player_id')
        player_name = player.get('player_name') or player.get('name')
        
        print(f"[{i}/{len(players)}] {player_name} (ID: {external_id})")
        
        # Try to find matching headshot
        headshot_url = find_matching_headshot(player_name, external_id, headshots_data)
        
        if headshot_url:
            try:
                # Update database
                supabase.table("players").update({
                    "headshot_url": headshot_url,
                    "headshot_source": "sportsdata_io",
                    "headshot_last_updated": datetime.utcnow().isoformat()
                }).eq("id", player_id_internal).execute()
                
                print(f"  ✓ Updated with: {headshot_url[:80]}...")
                success_count += 1
                
            except Exception as e:
                print(f"  ✗ Database error: {str(e)}")
                failed_count += 1
        else:
            print(f"  ✗ No matching headshot found in SportsData.io")
            failed_count += 1
        
        # Small delay to be respectful
        if i % 50 == 0:
            time.sleep(0.5)
    
    print(f"\n{'='*60}")
    print(f"NHL Headshot Ingestion Complete!")
    print(f"{'='*60}")
    print(f"\nResults:")
    print(f"  Success: {success_count}/{len(players)} ({(success_count/len(players)*100):.2f}%)")
    print(f"  Failed: {failed_count}/{len(players)}")
    print(f"{'='*60}\n")
    
    # Final coverage check
    print("Checking final NHL coverage...")
    final_result = supabase.table("players").select(
        "headshot_url"
    ).eq("sport", "NHL").eq("active", True).execute()
    
    total = len(final_result.data)
    with_headshots = sum(1 for p in final_result.data if p.get('headshot_url'))
    
    print(f"\nFinal NHL Coverage:")
    print(f"  Total players: {total}")
    print(f"  With headshots: {with_headshots}")
    print(f"  Coverage: {(with_headshots/total*100):.2f}%")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()


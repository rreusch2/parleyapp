"""
Player Headshot Ingestion Script
Fetches and updates missing player headshots from multiple reliable sources
"""
import os
import re
import requests
from typing import Optional, Dict, List, Tuple
from supabase import create_client, Client
from urllib.parse import quote
import time
from datetime import datetime

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
    raise ValueError("SUPABASE_SERVICE_KEY environment variable is required. Please set it or create a .env file.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Headshot URL patterns for different sports
HEADSHOT_PATTERNS = {
    "NBA": [
        # ESPN NBA
        lambda player_id: f"https://a.espncdn.com/i/headshots/nba/players/full/{player_id}.png",
        lambda player_id: f"https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/{player_id}.png&w=350&h=254",
        # NBA.com
        lambda player_id: f"https://cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png",
        lambda player_id: f"https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/{player_id}.png",
    ],
    "MLB": [
        # ESPN MLB
        lambda player_id: f"https://a.espncdn.com/i/headshots/mlb/players/full/{player_id}.png",
        lambda player_id: f"https://a.espncdn.com/combiner/i?img=/i/headshots/mlb/players/full/{player_id}.png&w=350&h=254",
        # MLB.com
        lambda player_id: f"https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{player_id}/headshot/67/current",
        lambda player_id: f"https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/{player_id}/headshot/milb/current",
    ],
    "NFL": [
        # ESPN NFL
        lambda player_id: f"https://a.espncdn.com/i/headshots/nfl/players/full/{player_id}.png",
        lambda player_id: f"https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/{player_id}.png&w=350&h=254",
    ],
    "NHL": [
        # ESPN NHL
        lambda player_id: f"https://a.espncdn.com/i/headshots/nhl/players/full/{player_id}.png",
        lambda player_id: f"https://a.espncdn.com/combiner/i?img=/i/headshots/nhl/players/full/{player_id}.png&w=350&h=254",
        # NHL.com
        lambda player_id: f"https://cms.nhl.bamgrid.com/images/headshots/current/168x168/{player_id}.jpg",
        lambda player_id: f"https://cms.nhl.bamgrid.com/images/headshots/current/168x168/{player_id}@2x.jpg",
    ],
    "WNBA": [
        # ESPN WNBA
        lambda player_name: f"https://a.espncdn.com/combiner/i?img=/i/headshots/wnba/players/full/{quote(player_name.replace(' ', '_'))}.png&w=350&h=254",
    ],
    "College Football": [
        # ESPN College Football
        lambda player_id: f"https://a.espncdn.com/i/headshots/college-football/players/full/{player_id}.png",
    ]
}


def extract_mlb_player_id(external_id: str) -> Optional[str]:
    """Extract numeric MLB player ID from 'mlb_XXXXX' format"""
    if external_id and external_id.startswith('mlb_'):
        return external_id.replace('mlb_', '')
    return external_id


def is_valid_numeric_id(player_id: str) -> bool:
    """Check if ID is numeric (for NHL which has mix of UUIDs and numeric IDs)"""
    return player_id and player_id.isdigit()


def verify_image_url(url: str, timeout: int = 5) -> bool:
    """Verify that an image URL is accessible and returns a valid image"""
    try:
        response = requests.head(url, timeout=timeout, allow_redirects=True)
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            return 'image' in content_type
        return False
    except requests.RequestException:
        return False


def find_working_headshot(player_id: str, sport: str, player_name: str = None) -> Optional[Tuple[str, str]]:
    """
    Try different headshot URL patterns until one works
    Returns: (url, source) tuple or None
    """
    patterns = HEADSHOT_PATTERNS.get(sport, [])
    
    # Special handling for MLB - extract numeric ID
    if sport == "MLB":
        player_id = extract_mlb_player_id(player_id)
        if not player_id:
            return None
    
    # For NHL, only try if we have a numeric ID
    if sport == "NHL" and not is_valid_numeric_id(player_id):
        return None
    
    # For WNBA, we might need to use player name
    if sport == "WNBA" and player_name:
        for i, pattern in enumerate(patterns):
            try:
                url = pattern(player_name)
                if verify_image_url(url):
                    source = f"espn_wnba_name"
                    print(f"✓ Found {sport} headshot: {url}")
                    return (url, source)
            except Exception as e:
                continue
    
    # Try each pattern
    for i, pattern in enumerate(patterns):
        try:
            url = pattern(player_id)
            if verify_image_url(url):
                # Determine source based on URL
                if 'espncdn.com' in url:
                    source = 'espn'
                elif 'cdn.nba.com' in url or 'nba.com' in url:
                    source = 'nba'
                elif 'mlbstatic.com' in url:
                    source = 'mlb'
                elif 'nhl.bamgrid.com' in url or 'nhl.com' in url:
                    source = 'nhl'
                else:
                    source = 'unknown'
                
                print(f"✓ Found {sport} headshot for player {player_id}: {url}")
                return (url, source)
        except Exception as e:
            print(f"✗ Error trying pattern {i} for {sport} player {player_id}: {str(e)}")
            continue
    
    return None


def update_player_headshot(player_id: str, headshot_url: str, source: str) -> bool:
    """Update player headshot in database"""
    try:
        result = supabase.table("players").update({
            "headshot_url": headshot_url,
            "headshot_source": source,
            "headshot_last_updated": datetime.utcnow().isoformat()
        }).eq("id", player_id).execute()
        return True
    except Exception as e:
        print(f"✗ Error updating player {player_id}: {str(e)}")
        return False


def process_sport(sport: str, limit: Optional[int] = None, batch_size: int = 50):
    """Process all players missing headshots for a specific sport"""
    print(f"\n{'='*60}")
    print(f"Processing {sport} players...")
    print(f"{'='*60}\n")
    
    # Get players missing headshots
    query = supabase.table("players")\
        .select("id, external_player_id, name, player_name, espn_player_id")\
        .eq("sport", sport)\
        .eq("active", True)\
        .is_("headshot_url", "null")
    
    if limit:
        query = query.limit(limit)
    
    result = query.execute()
    players = result.data
    
    print(f"Found {len(players)} {sport} players missing headshots\n")
    
    if not players:
        print(f"No {sport} players need headshots!")
        return
    
    success_count = 0
    failed_count = 0
    
    for i, player in enumerate(players, 1):
        player_id_internal = player['id']
        external_id = player.get('external_player_id') or player.get('espn_player_id')
        player_name = player.get('player_name') or player.get('name')
        
        print(f"[{i}/{len(players)}] Processing: {player_name} (ID: {external_id})")
        
        if not external_id:
            print(f"  ✗ No external ID available")
            failed_count += 1
            continue
        
        # Find working headshot
        result = find_working_headshot(external_id, sport, player_name)
        
        if result:
            headshot_url, source = result
            if update_player_headshot(player_id_internal, headshot_url, source):
                print(f"  ✓ Updated successfully!")
                success_count += 1
            else:
                print(f"  ✗ Failed to update database")
                failed_count += 1
        else:
            print(f"  ✗ No working headshot URL found")
            failed_count += 1
        
        # Rate limiting - be nice to the CDNs
        if i % batch_size == 0:
            print(f"\n  Pausing for rate limiting... ({i}/{len(players)})")
            time.sleep(2)
        else:
            time.sleep(0.1)
    
    print(f"\n{'='*60}")
    print(f"{sport} Summary:")
    print(f"  Success: {success_count}")
    print(f"  Failed: {failed_count}")
    print(f"  Total: {len(players)}")
    print(f"  Success Rate: {(success_count/len(players)*100):.2f}%")
    print(f"{'='*60}\n")


def main():
    """Main execution function"""
    print("\n" + "="*60)
    print("Player Headshot Ingestion Script")
    print("="*60 + "\n")
    
    # Priority order based on need and likelihood of success
    # NBA and MLB are already 100% complete, skip them
    sports_to_process = [
        ("NHL", None),           # 351 players, moderate success rate
        ("WNBA", None),          # 85 players, moderate success rate
        # ("NBA", None),         # DONE - 100% coverage
        # ("MLB", None),         # DONE - 100% coverage
        # ("NFL", None),         # DONE - 99% coverage (50 remaining need API)
        # ("College Football", 100),  # 10,739 players - start with 100 as test
    ]
    
    for sport, limit in sports_to_process:
        try:
            process_sport(sport, limit=limit)
        except Exception as e:
            print(f"\n✗ Error processing {sport}: {str(e)}\n")
            continue
    
    print("\n" + "="*60)
    print("Headshot Ingestion Complete!")
    print("="*60 + "\n")
    
    # Print final summary
    print("Fetching final coverage statistics...\n")
    
    # Run direct query for coverage
    result = supabase.table("players").select(
        "sport, headshot_url"
    ).eq("active", True).execute()
    
    # Calculate coverage
    from collections import defaultdict
    coverage = defaultdict(lambda: {'total': 0, 'with_headshots': 0})
    
    for player in result.data:
        sport = player['sport']
        coverage[sport]['total'] += 1
        if player['headshot_url']:
            coverage[sport]['with_headshots'] += 1
    
    print("\nFinal Coverage Report:")
    print("-" * 60)
    for sport in sorted(coverage.keys()):
        total = coverage[sport]['total']
        with_hs = coverage[sport]['with_headshots']
        pct = (with_hs / total * 100) if total > 0 else 0
        print(f"{sport:20} {with_hs:5}/{total:5} ({pct:5.2f}%)")
    print("-" * 60 + "\n")


if __name__ == "__main__":
    main()


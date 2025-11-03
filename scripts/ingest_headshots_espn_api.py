"""
Enhanced Player Headshot Ingestion using ESPN API
This script uses ESPN's API to find player IDs and then fetches headshots
"""
import os
import requests
from typing import Optional, Dict, Tuple
from supabase import create_client, Client
import time
from datetime import datetime
import json

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

# ESPN API endpoints
ESPN_ATHLETE_APIS = {
    "NBA": "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/athletes",
    "NFL": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes",
    "MLB": "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/athletes",
    "NHL": "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/athletes",
    "WNBA": "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/athletes",
}


def search_espn_player(player_name: str, sport: str) -> Optional[Dict]:
    """
    Search for a player on ESPN API using their name
    Returns player data including ESPN ID and headshot URL
    """
    api_url = ESPN_ATHLETE_APIS.get(sport)
    if not api_url:
        return None
    
    try:
        # ESPN search API
        response = requests.get(
            api_url,
            params={'limit': 1000},  # Get all athletes
            timeout=10
        )
        
        if response.status_code != 200:
            return None
        
        data = response.json()
        athletes = data.get('athletes', [])
        
        # Normalize player name for comparison
        normalized_search = player_name.lower().replace('.', '').replace('-', ' ')
        
        # Search for matching player
        for athlete in athletes:
            full_name = athlete.get('fullName', '').lower().replace('.', '').replace('-', ' ')
            display_name = athlete.get('displayName', '').lower().replace('.', '').replace('-', ' ')
            
            if normalized_search in full_name or normalized_search in display_name:
                player_id = athlete.get('id')
                headshot = athlete.get('headshot', {}).get('href')
                
                if player_id and headshot:
                    return {
                        'espn_id': str(player_id),
                        'headshot_url': headshot,
                        'full_name': athlete.get('fullName'),
                    }
        
        return None
        
    except Exception as e:
        print(f"    Error searching ESPN for {player_name}: {str(e)}")
        return None


def get_espn_athlete_direct(espn_id: str, sport: str) -> Optional[str]:
    """
    Get athlete data directly from ESPN using their ID
    """
    sport_map = {
        "NBA": "basketball/nba",
        "NFL": "football/nfl",
        "MLB": "baseball/mlb",
        "NHL": "hockey/nhl",
        "WNBA": "basketball/wnba",
    }
    
    sport_path = sport_map.get(sport)
    if not sport_path:
        return None
    
    try:
        url = f"https://site.api.espn.com/apis/site/v2/sports/{sport_path}/athletes/{espn_id}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            athlete = data.get('athlete', {})
            headshot = athlete.get('headshot', {}).get('href')
            return headshot
        
        return None
        
    except Exception as e:
        print(f"    Error fetching ESPN athlete {espn_id}: {str(e)}")
        return None


def update_player_with_espn_data(
    player_id: str,
    headshot_url: str,
    espn_id: Optional[str] = None
) -> bool:
    """Update player with headshot and optionally ESPN ID"""
    try:
        update_data = {
            "headshot_url": headshot_url,
            "headshot_source": "espn",
            "headshot_last_updated": datetime.utcnow().isoformat()
        }
        
        if espn_id:
            update_data["espn_player_id"] = espn_id
        
        result = supabase.table("players").update(update_data)\
            .eq("id", player_id).execute()
        return True
    except Exception as e:
        print(f"    ✗ Error updating player {player_id}: {str(e)}")
        return False


def process_sport_with_espn_api(sport: str, limit: Optional[int] = None):
    """Process players using ESPN API to find IDs and headshots"""
    print(f"\n{'='*60}")
    print(f"Processing {sport} players via ESPN API...")
    print(f"{'='*60}\n")
    
    if sport not in ESPN_ATHLETE_APIS:
        print(f"✗ {sport} not supported by ESPN API")
        return
    
    # Get players missing headshots
    query = supabase.table("players")\
        .select("id, name, player_name, team, espn_player_id")\
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
        player_id = player['id']
        player_name = player.get('player_name') or player.get('name')
        espn_id = player.get('espn_player_id')
        
        print(f"[{i}/{len(players)}] {player_name}")
        
        headshot_url = None
        found_espn_id = espn_id
        
        # If we already have ESPN ID, try direct fetch
        if espn_id:
            print(f"    Using existing ESPN ID: {espn_id}")
            headshot_url = get_espn_athlete_direct(espn_id, sport)
        
        # If no headshot yet, search by name
        if not headshot_url:
            print(f"    Searching ESPN API for '{player_name}'...")
            player_data = search_espn_player(player_name, sport)
            
            if player_data:
                headshot_url = player_data['headshot_url']
                found_espn_id = player_data['espn_id']
                print(f"    ✓ Found via search: ESPN ID {found_espn_id}")
        
        # Update database if we found a headshot
        if headshot_url:
            if update_player_with_espn_data(player_id, headshot_url, found_espn_id):
                print(f"    ✓ Updated successfully!")
                success_count += 1
            else:
                print(f"    ✗ Failed to update database")
                failed_count += 1
        else:
            print(f"    ✗ No headshot found")
            failed_count += 1
        
        # Rate limiting
        time.sleep(0.5)  # Be nice to ESPN's API
    
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
    print("ESPN API Player Headshot Ingestion")
    print("="*60 + "\n")
    
    # Process sports in priority order
    sports_to_process = [
        ("NBA", None),    # 283 players
        ("NHL", None),    # 351 players
        ("WNBA", None),   # 85 players
        ("MLB", None),    # 684 players
        ("NFL", 100),     # 55 players
    ]
    
    for sport, limit in sports_to_process:
        try:
            process_sport_with_espn_api(sport, limit=limit)
        except Exception as e:
            print(f"\n✗ Error processing {sport}: {str(e)}\n")
            continue
    
    print("\n" + "="*60)
    print("ESPN API Ingestion Complete!")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()


"""
Backfill Player Headshots in AI Predictions and Trends
Links predictions to players table and adds headshot URLs
"""
import os
from supabase import create_client, Client
import json
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


def normalize_name(name):
    """Normalize player name for matching"""
    if not name:
        return ""
    return name.lower().strip().replace(".", "").replace("-", " ").replace("'", "").replace("é", "e").replace("á", "a")


def get_all_players_with_headshots():
    """Fetch all players with headshots from database"""
    print("Fetching all players with headshots...")
    
    result = supabase.table("players").select(
        "id, name, player_name, sport, headshot_url"
    ).eq("active", True)\
     .not_.is_("headshot_url", "null")\
     .execute()
    
    players = result.data
    print(f"✓ Loaded {len(players)} players with headshots\n")
    
    # Create lookup dictionaries
    by_name_sport = {}
    for player in players:
        name = player.get('player_name') or player.get('name')
        sport = player.get('sport')
        normalized = normalize_name(name)
        key = f"{normalized}_{sport}"
        by_name_sport[key] = player
    
    return by_name_sport


def backfill_ai_predictions(player_lookup):
    """Backfill player_id and headshots in ai_predictions"""
    print("="*60)
    print("Backfilling AI Predictions")
    print("="*60 + "\n")
    
    # Get all predictions with player props
    result = supabase.table("ai_predictions").select(
        "id, sport, pick, metadata, player_id"
    ).eq("bet_type", "player_prop").execute()
    
    predictions = result.data
    print(f"Found {len(predictions)} player prop predictions\n")
    
    if not predictions:
        print("No predictions to process!")
        return
    
    updated_count = 0
    failed_count = 0
    already_linked_count = 0
    
    for i, pred in enumerate(predictions, 1):
        pred_id = pred['id']
        sport = pred['sport']
        metadata = pred.get('metadata') or {}
        
        # Get player name from metadata
        player_name = metadata.get('player_name')
        if not player_name:
            # Try to extract from pick field
            pick = pred.get('pick', '')
            # Basic extraction: get first 2-3 words before "OVER/UNDER"
            if 'OVER' in pick or 'UNDER' in pick:
                parts = pick.split()
                player_name = ' '.join(parts[:2])  # Rough guess
            
        if not player_name:
            print(f"[{i}/{len(predictions)}] ✗ No player name found")
            failed_count += 1
            continue
        
        # Check if already has player_id
        if pred.get('player_id'):
            already_linked_count += 1
            # Still update headshot if missing
            if not metadata.get('player_headshot_url'):
                pass  # Will update below
            else:
                continue
        
        # Look up player
        normalized = normalize_name(player_name)
        lookup_key = f"{normalized}_{sport}"
        
        player = player_lookup.get(lookup_key)
        
        if player:
            # Update metadata with headshot
            metadata['player_headshot_url'] = player['headshot_url']
            
            # Update database
            try:
                supabase.table("ai_predictions").update({
                    "player_id": player['id'],
                    "metadata": json.dumps(metadata) if isinstance(metadata, dict) else metadata
                }).eq("id", pred_id).execute()
                
                print(f"[{i}/{len(predictions)}] ✓ {player_name} ({sport}) - Linked & headshot added")
                updated_count += 1
            except Exception as e:
                print(f"[{i}/{len(predictions)}] ✗ {player_name} - Database error: {str(e)}")
                failed_count += 1
        else:
            print(f"[{i}/{len(predictions)}] ✗ {player_name} ({sport}) - Player not found in database")
            failed_count += 1
    
    print(f"\n{'='*60}")
    print(f"AI Predictions Summary:")
    print(f"  Updated: {updated_count}")
    print(f"  Already linked: {already_linked_count}")
    print(f"  Failed: {failed_count}")
    print(f"  Total: {len(predictions)}")
    print(f"{'='*60}\n")


def backfill_ai_trends(player_lookup):
    """Backfill headshots in ai_trends"""
    print("="*60)
    print("Backfilling AI Trends")
    print("="*60 + "\n")
    
    # Get all player prop trends
    result = supabase.table("ai_trends").select(
        "id, sport, full_player_name, player_id, data, metadata"
    ).eq("trend_type", "player_prop").execute()
    
    trends = result.data
    print(f"Found {len(trends)} player prop trends\n")
    
    if not trends:
        print("No trends to process!")
        return
    
    updated_count = 0
    failed_count = 0
    already_has_count = 0
    
    for i, trend in enumerate(trends, 1):
        trend_id = trend['id']
        sport = trend['sport']
        player_name = trend.get('full_player_name')
        data = trend.get('data') or {}
        metadata = trend.get('metadata') or {}
        
        if not player_name:
            print(f"[{i}/{len(trends)}] ✗ No player name")
            failed_count += 1
            continue
        
        # Check if already has headshot
        if data.get('player_headshot_url') or metadata.get('player_headshot_url'):
            already_has_count += 1
            continue
        
        # Look up player
        normalized = normalize_name(player_name)
        lookup_key = f"{normalized}_{sport}"
        
        player = player_lookup.get(lookup_key)
        
        if player:
            # Update data with headshot
            data['player_headshot_url'] = player['headshot_url']
            metadata['player_headshot_url'] = player['headshot_url']
            
            # Update database
            try:
                supabase.table("ai_trends").update({
                    "data": json.dumps(data) if isinstance(data, dict) else data,
                    "metadata": json.dumps(metadata) if isinstance(metadata, dict) else metadata
                }).eq("id", trend_id).execute()
                
                print(f"[{i}/{len(trends)}] ✓ {player_name} ({sport}) - Headshot added to trend")
                updated_count += 1
            except Exception as e:
                print(f"[{i}/{len(trends)}] ✗ {player_name} - Database error: {str(e)}")
                failed_count += 1
        else:
            print(f"[{i}/{len(trends)}] ✗ {player_name} ({sport}) - Player not found")
            failed_count += 1
    
    print(f"\n{'='*60}")
    print(f"AI Trends Summary:")
    print(f"  Updated: {updated_count}")
    print(f"  Already had headshots: {already_has_count}")
    print(f"  Failed: {failed_count}")
    print(f"  Total: {len(trends)}")
    print(f"{'='*60}\n")


def main():
    print("\n" + "="*60)
    print("Player Headshot Backfill for Predictions & Trends")
    print("="*60 + "\n")
    
    # Load all players with headshots
    player_lookup = get_all_players_with_headshots()
    
    # Backfill predictions
    backfill_ai_predictions(player_lookup)
    
    # Backfill trends
    backfill_ai_trends(player_lookup)
    
    print("\n" + "="*60)
    print("✅ Backfill Complete!")
    print("="*60 + "\n")
    
    print("Your predictions and trends now have:")
    print("  1. player_id linked to players table")
    print("  2. player_headshot_url in metadata")
    print("  3. Ready to display in the app!\n")


if __name__ == "__main__":
    main()


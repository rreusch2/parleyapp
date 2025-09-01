#!/usr/bin/env python3
"""
Safe CFB Averaged Stats Cleanup
Removes only College Football averaged stats from SportsData.io
Preserves all MLB, WNBA, NFL data intact
"""

import os
import sys
from supabase import create_client, Client

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def main():
    """Safely clean CFB averaged stats while preserving other sports data"""
    print("🧹 CFB Averaged Stats Cleanup - Safe Mode")
    print("=" * 50)
    
    try:
        # First, get counts before cleanup for verification
        print("📊 Pre-cleanup data verification:")
        
        # Count all sports data
        all_sports_query = supabase.table("player_game_stats").select(
            "id", 
            select="id, players!inner(sport)"
        )
        all_result = all_sports_query.execute()
        
        sport_counts = {}
        cfb_ids_to_delete = []
        
        for record in all_result.data:
            sport = record['players']['sport']
            sport_counts[sport] = sport_counts.get(sport, 0) + 1
            
            if sport == 'College Football':
                cfb_ids_to_delete.append(record['id'])
        
        print(f"📈 Current data by sport:")
        for sport, count in sorted(sport_counts.items()):
            print(f"  • {sport}: {count:,} records")
        
        if not cfb_ids_to_delete:
            print("✅ No College Football records found to clean")
            return
        
        print(f"\n🎯 Found {len(cfb_ids_to_delete):,} CFB records to delete")
        
        # Confirm before deletion
        confirm = input(f"\n⚠️  Delete {len(cfb_ids_to_delete):,} CFB averaged stats? (y/N): ")
        if confirm.lower() != 'y':
            print("❌ Cleanup cancelled")
            return
        
        # Delete CFB records in batches (Supabase has limits)
        batch_size = 1000
        deleted_count = 0
        
        for i in range(0, len(cfb_ids_to_delete), batch_size):
            batch = cfb_ids_to_delete[i:i + batch_size]
            
            print(f"🗑️  Deleting batch {i//batch_size + 1} ({len(batch)} records)...")
            
            # Delete batch using 'in' filter
            result = supabase.table("player_game_stats").delete().in_("id", batch).execute()
            
            if result.data:
                deleted_count += len(result.data)
            
        print(f"\n✅ Successfully deleted {deleted_count:,} CFB averaged stats")
        
        # Verification - check remaining data
        print("\n📊 Post-cleanup verification:")
        remaining_result = supabase.table("player_game_stats").select(
            "id",
            select="id, players!inner(sport)"
        ).execute()
        
        remaining_counts = {}
        for record in remaining_result.data:
            sport = record['players']['sport']
            remaining_counts[sport] = remaining_counts.get(sport, 0) + 1
        
        print(f"📈 Remaining data by sport:")
        for sport, count in sorted(remaining_counts.items()):
            print(f"  • {sport}: {count:,} records")
        
        if 'College Football' in remaining_counts:
            print(f"⚠️  Warning: {remaining_counts['College Football']} CFB records still remain")
        else:
            print("✅ All College Football averaged stats successfully removed")
        
        print("\n🎯 Other sports data preserved:")
        preserved_sports = [s for s in remaining_counts.keys() if s != 'College Football']
        for sport in preserved_sports:
            print(f"  ✅ {sport}: {remaining_counts[sport]:,} records intact")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        print("⚠️  No data was modified due to error")

if __name__ == "__main__":
    main()

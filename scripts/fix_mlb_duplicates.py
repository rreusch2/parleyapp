#!/usr/bin/env python3
"""
Script to fix MLB player duplicates and standardize sport/sport_key values
This consolidates all MLB players under consistent sport='MLB' and sport_key='baseball_mlb'
"""

import os
import sys
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

if not url or not key:
    print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY must be set")
    sys.exit(1)

supabase: Client = create_client(url, key)

def fix_mlb_duplicates():
    """Main function to fix duplicate MLB players"""
    
    print("🔧 Starting MLB player duplicate fix...")
    
    try:
        # Step 1: Get all MLB players (both sport values)
        print("\n📊 Fetching all MLB players...")
        mlb_players = supabase.table('players').select('*').in_('sport', ['MLB', 'BASEBALL_MLB']).execute()
        
        print(f"Found {len(mlb_players.data)} total MLB players")
        
        # Step 2: Group players by normalized name
        player_groups = {}
        for player in mlb_players.data:
            normalized_name = player['name'].lower().strip()
            if normalized_name not in player_groups:
                player_groups[normalized_name] = []
            player_groups[normalized_name].append(player)
        
        # Step 3: Find duplicates
        duplicates = {name: players for name, players in player_groups.items() if len(players) > 1}
        print(f"\n🔍 Found {len(duplicates)} players with duplicates")
        
        # Step 4: Process each duplicate group
        consolidation_map = {}  # old_id -> new_id
        players_to_delete = []
        
        for name, duplicate_list in duplicates.items():
            # Sort to prioritize: has team > sport='MLB' > oldest created_at
            sorted_players = sorted(duplicate_list, key=lambda p: (
                0 if p.get('team') and p['team'] != '' else 1,
                0 if p['sport'] == 'MLB' else 1,
                p.get('created_at', '9999') or '9999'
            ))
            
            canonical = sorted_players[0]
            
            print(f"\n  {name}: keeping ID {canonical['id'][:8]}... (team: {canonical.get('team', 'N/A')})")
            
            for dup in sorted_players[1:]:
                consolidation_map[dup['id']] = canonical['id']
                players_to_delete.append(dup['id'])
                print(f"    - merging ID {dup['id'][:8]}... (team: {dup.get('team', 'N/A')})")
        
        # Step 5: Update player_game_stats references
        if consolidation_map:
            print(f"\n🔄 Updating player_game_stats references...")
            stats_updated = 0
            
            for old_id, new_id in consolidation_map.items():
                # Update player_game_stats
                result = supabase.table('player_game_stats')\
                    .update({'player_id': new_id})\
                    .eq('player_id', old_id)\
                    .execute()
                
                if result.data:
                    stats_updated += len(result.data)
            
            print(f"  ✅ Updated {stats_updated} player_game_stats records")
            
            # Update player_props_odds
            print(f"\n🔄 Updating player_props_odds references...")
            props_updated = 0
            
            for old_id, new_id in consolidation_map.items():
                result = supabase.table('player_props_odds')\
                    .update({'player_id': new_id})\
                    .eq('player_id', old_id)\
                    .execute()
                
                if result.data:
                    props_updated += len(result.data)
            
            print(f"  ✅ Updated {props_updated} player_props_odds records")
            
            # Update mlb_game_players if it exists and has references
            try:
                print(f"\n🔄 Updating mlb_game_players references...")
                mlb_players_updated = 0
                
                for old_id, new_id in consolidation_map.items():
                    result = supabase.table('mlb_game_players')\
                        .update({'player_id': new_id})\
                        .eq('player_id', old_id)\
                        .execute()
                    
                    if result.data:
                        mlb_players_updated += len(result.data)
                
                print(f"  ✅ Updated {mlb_players_updated} mlb_game_players records")
            except Exception as e:
                print(f"  ℹ️  No mlb_game_players updates needed")
            
            # Update player_trends_data
            print(f"\n🔄 Updating player_trends_data references...")
            trends_updated = 0
            
            for old_id, new_id in consolidation_map.items():
                result = supabase.table('player_trends_data')\
                    .update({'player_id': new_id})\
                    .eq('player_id', old_id)\
                    .execute()
                
                if result.data:
                    trends_updated += len(result.data)
            
            print(f"  ✅ Updated {trends_updated} player_trends_data records")
            
            # Update player_headshots
            print(f"\n🔄 Updating player_headshots references...")
            headshots_updated = 0
            
            for old_id, new_id in consolidation_map.items():
                result = supabase.table('player_headshots')\
                    .update({'player_id': new_id})\
                    .eq('player_id', old_id)\
                    .execute()
                
                if result.data:
                    headshots_updated += len(result.data)
            
            print(f"  ✅ Updated {headshots_updated} player_headshots records")
        
        # Step 6: Delete duplicate player records
        if players_to_delete:
            print(f"\n🗑️  Deleting {len(players_to_delete)} duplicate player records...")
            
            for player_id in players_to_delete:
                try:
                    supabase.table('players').delete().eq('id', player_id).execute()
                except Exception as e:
                    print(f"  ⚠️  Could not delete player {player_id[:8]}...: {str(e)}")
            
            print(f"  ✅ Deleted duplicate players")
        
        # Step 7: Standardize all MLB players to consistent values
        print(f"\n📝 Standardizing all MLB players to sport='MLB' and sport_key='baseball_mlb'...")
        
        result = supabase.table('players')\
            .update({'sport': 'MLB', 'sport_key': 'baseball_mlb'})\
            .in_('sport', ['MLB', 'BASEBALL_MLB'])\
            .execute()
        
        print(f"  ✅ Standardized {len(result.data)} MLB players")
        
        # Step 8: Fix known team assignments
        print(f"\n🏟️  Fixing known team assignments...")
        
        team_fixes = {
            'bobby witt jr.': 'Kansas City Royals',
            'aaron judge': 'New York Yankees',
            'mike trout': 'Los Angeles Angels',
            'shohei ohtani': 'Los Angeles Dodgers',
            'ronald acuna jr.': 'Atlanta Braves',
            'mookie betts': 'Los Angeles Dodgers',
            'freddie freeman': 'Los Angeles Dodgers',
            'juan soto': 'New York Yankees',
            'jose altuve': 'Houston Astros',
            'yordan alvarez': 'Houston Astros',
            'fernando tatis jr.': 'San Diego Padres',
            'manny machado': 'San Diego Padres',
            'corey seager': 'Texas Rangers',
            'marcus semien': 'Texas Rangers',
            'vladimir guerrero jr.': 'Toronto Blue Jays',
            'bo bichette': 'Toronto Blue Jays',
            'brandon nimmo': 'New York Mets',
            'pete alonso': 'New York Mets',
            'francisco lindor': 'New York Mets',
            'bryce harper': 'Philadelphia Phillies',
            'trea turner': 'Philadelphia Phillies',
            'kyle schwarber': 'Philadelphia Phillies',
            'alec bohm': 'Philadelphia Phillies',
            'bryson stott': 'Philadelphia Phillies',
            'christian yelich': 'Milwaukee Brewers',
            'willy adames': 'Milwaukee Brewers',
            'alex verdugo': 'New York Yankees',
            'rafael devers': 'Boston Red Sox',
            'xander bogaerts': 'San Diego Padres',
            'cedric mullins': 'Baltimore Orioles',
            'gunnar henderson': 'Baltimore Orioles',
            'adley rutschman': 'Baltimore Orioles',
            'christian walker': 'Arizona Diamondbacks',
            'ketel marte': 'Arizona Diamondbacks',
        }
        
        teams_fixed = 0
        for player_name, correct_team in team_fixes.items():
            # Get the player
            player_result = supabase.table('players')\
                .select('id, name, team')\
                .eq('sport', 'MLB')\
                .ilike('name', f'%{player_name}%')\
                .execute()
            
            if player_result.data:
                for player in player_result.data:
                    if player['name'].lower() == player_name:
                        # Update team if different
                        if player.get('team') != correct_team:
                            supabase.table('players')\
                                .update({'team': correct_team})\
                                .eq('id', player['id'])\
                                .execute()
                            teams_fixed += 1
                            print(f"  ✅ Fixed {player['name']}: {player.get('team', 'None')} → {correct_team}")
        
        print(f"\n  ✅ Fixed {teams_fixed} team assignments")
        
        # Step 9: Final verification
        print(f"\n✅ Migration complete!")
        
        # Check final state
        final_mlb = supabase.table('players').select('id').eq('sport', 'MLB').execute()
        final_stats = supabase.table('player_game_stats').select('id').execute()
        
        print(f"\n📊 Final state:")
        print(f"  - MLB players: {len(final_mlb.data)}")
        print(f"  - Player game stats: {len(final_stats.data)}")
        print(f"  - Duplicates removed: {len(players_to_delete)}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error during migration: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = fix_mlb_duplicates()
    sys.exit(0 if success else 1)

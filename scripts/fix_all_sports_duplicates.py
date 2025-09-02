#!/usr/bin/env python3
"""
Fix duplicate players across all sports and standardize sport/sport_key values
"""

import os
from supabase import create_client
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv('/home/reid/Desktop/parleyapp/.env')

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase credentials")

supabase = create_client(supabase_url, supabase_key)

def fix_nfl_duplicates():
    """Fix NFL player duplicates and standardize sport_key"""
    logger.info("\n🏈 Fixing NFL duplicates...")
    
    # Get all NFL players
    result = supabase.table('players').select('*').in_('sport', ['NFL']).execute()
    nfl_players = result.data
    
    # Group by player name to find duplicates
    player_map = {}
    for player in nfl_players:
        name_key = player['name'].lower()
        if name_key not in player_map:
            player_map[name_key] = []
        player_map[name_key].append(player)
    
    duplicates_fixed = 0
    for name, players in player_map.items():
        if len(players) > 1:
            # Keep the one with sport_key='americanfootball_nfl' or the first one
            canonical = next((p for p in players if p['sport_key'] == 'americanfootball_nfl'), players[0])
            
            for player in players:
                if player['id'] != canonical['id']:
                    # Update references in other tables
                    update_player_references(player['id'], canonical['id'])
                    
                    # Delete duplicate
                    supabase.table('players').delete().eq('id', player['id']).execute()
                    duplicates_fixed += 1
                    logger.info(f"  Merged {player['name']} ({player['sport_key']}) -> canonical")
    
    # Standardize all remaining NFL players
    supabase.table('players').update({
        'sport_key': 'americanfootball_nfl'
    }).eq('sport', 'NFL').execute()
    
    logger.info(f"✅ Fixed {duplicates_fixed} NFL duplicates")

def fix_cfb_duplicates():
    """Fix College Football duplicates and standardize sport_key"""
    logger.info("\n🏈 Fixing College Football duplicates...")
    
    # Get all CFB players
    result = supabase.table('players').select('*').eq('sport', 'College Football').execute()
    cfb_players = result.data
    
    # Group by player name and team to find duplicates
    player_map = {}
    for player in cfb_players:
        # Use name + team as key since same name can play for different teams
        key = f"{player['name'].lower()}|{player.get('team', '').lower()}"
        if key not in player_map:
            player_map[key] = []
        player_map[key].append(player)
    
    duplicates_fixed = 0
    for key, players in player_map.items():
        if len(players) > 1:
            # Keep the one with sport_key='americanfootball_ncaaf' or most recent
            canonical = next((p for p in players if p['sport_key'] == 'americanfootball_ncaaf'), 
                           sorted(players, key=lambda x: x.get('created_at', ''), reverse=True)[0])
            
            for player in players:
                if player['id'] != canonical['id']:
                    # Update references
                    update_player_references(player['id'], canonical['id'])
                    
                    # Delete duplicate
                    try:
                        supabase.table('players').delete().eq('id', player['id']).execute()
                        duplicates_fixed += 1
                        logger.info(f"  Merged {player['name']} -> canonical")
                    except:
                        pass
    
    # Standardize all remaining CFB players
    supabase.table('players').update({
        'sport_key': 'americanfootball_ncaaf'
    }).eq('sport', 'College Football').execute()
    
    logger.info(f"✅ Fixed {duplicates_fixed} College Football duplicates")

def fix_nba_duplicates():
    """Standardize NBA sport_key"""
    logger.info("\n🏀 Standardizing NBA players...")
    
    supabase.table('players').update({
        'sport': 'NBA',
        'sport_key': 'basketball_nba'
    }).eq('sport', 'NBA').execute()
    
    logger.info("✅ Standardized NBA players")

def fix_wnba_duplicates():
    """Fix WNBA duplicates and standardize sport_key"""
    logger.info("\n🏀 Fixing WNBA duplicates...")
    
    # Get all WNBA players
    result = supabase.table('players').select('*').eq('sport', 'WNBA').execute()
    wnba_players = result.data
    
    # Group by player name to find duplicates
    player_map = {}
    for player in wnba_players:
        name_key = player['name'].lower()
        if name_key not in player_map:
            player_map[name_key] = []
        player_map[name_key].append(player)
    
    duplicates_fixed = 0
    for name, players in player_map.items():
        if len(players) > 1:
            # Keep the most recent one
            canonical = sorted(players, key=lambda x: x.get('created_at', ''), reverse=True)[0]
            
            for player in players:
                if player['id'] != canonical['id']:
                    # Update references
                    update_player_references(player['id'], canonical['id'])
                    
                    # Delete duplicate
                    try:
                        supabase.table('players').delete().eq('id', player['id']).execute()
                        duplicates_fixed += 1
                        logger.info(f"  Merged {player['name']} -> canonical")
                    except:
                        pass
    
    # Standardize all remaining WNBA players
    supabase.table('players').update({
        'sport_key': 'basketball_wnba'
    }).eq('sport', 'WNBA').execute()
    
    logger.info(f"✅ Fixed {duplicates_fixed} WNBA duplicates")

def fix_nhl_players():
    """Standardize NHL sport_key"""
    logger.info("\n🏒 Standardizing NHL players...")
    
    supabase.table('players').update({
        'sport': 'NHL',
        'sport_key': 'icehockey_nhl'
    }).eq('sport', 'Hockey').execute()
    
    logger.info("✅ Standardized NHL players")

def update_player_references(old_id, new_id):
    """Update all table references from old player ID to new"""
    tables = [
        'player_game_stats',
        'player_props_odds',
        'player_trends_data',
        'player_headshots',
        'player_recent_stats',
        'mlb_game_players'
    ]
    
    for table in tables:
        try:
            result = supabase.table(table).update({'player_id': new_id}).eq('player_id', old_id).execute()
            if result.data:
                logger.debug(f"    Updated {len(result.data)} records in {table}")
        except Exception as e:
            logger.debug(f"    No updates needed for {table}")  # Table might not have references

def main():
    logger.info("🔧 Starting comprehensive duplicate player fix...")
    
    # Fix each sport
    fix_nfl_duplicates()
    fix_cfb_duplicates()
    fix_nba_duplicates()
    fix_wnba_duplicates()
    fix_nhl_players()
    
    # Get final counts
    result = supabase.table('players').select('sport, sport_key', count='exact').execute()
    
    logger.info("\n📊 Final player counts by sport:")
    sports = {}
    for player in result.data:
        key = f"{player['sport']} ({player['sport_key']})"
        sports[key] = sports.get(key, 0) + 1
    
    for sport, count in sorted(sports.items()):
        logger.info(f"  {sport}: {count} players")
    
    logger.info("\n✨ Duplicate fix complete!")

if __name__ == "__main__":
    main()

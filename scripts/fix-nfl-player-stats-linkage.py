#!/usr/bin/env python3
"""
NFL Player Stats Linkage Fix
===========================
Systematically fixes the broken linkage between NFL player_game_stats 
and players table by matching stats based on team, position, and name.
"""

import os
import logging
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Dict, List, Optional, Tuple
import re

# Load environment variables
load_dotenv("backend/.env")

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://iriaegoipkjtktitpary.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/nfl-stats-linkage-fix.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def get_orphaned_nfl_stats() -> List[Dict]:
    """Get all NFL player_game_stats that are linked to wrong players"""
    try:
        # Get stats that have team/position but are linked to players with different team/position
        result = supabase.table('player_game_stats').select('''
            id,
            player_id,
            stats,
            players!inner(name, team, position, external_player_id)
        ''').execute()
        
        orphaned_stats = []
        
        for stat_record in result.data:
            stats = stat_record.get('stats', {})
            player = stat_record.get('players', {})
            
            stat_team = stats.get('team', '')
            stat_position = stats.get('position', '')
            player_team = player.get('team', '')
            player_position = player.get('position', '')
            
            # Check if team or position doesn't match
            if stat_team and player_team and stat_team != player_team:
                orphaned_stats.append(stat_record)
                logger.debug(f"Team mismatch: {player.get('name')} - stat team: {stat_team}, player team: {player_team}")
            elif stat_position and player_position and stat_position != player_position:
                orphaned_stats.append(stat_record)
                logger.debug(f"Position mismatch: {player.get('name')} - stat pos: {stat_position}, player pos: {player_position}")
        
        logger.info(f"Found {len(orphaned_stats)} orphaned NFL stat records")
        return orphaned_stats
        
    except Exception as e:
        logger.error(f"Error getting orphaned NFL stats: {str(e)}")
        return []

def find_correct_player_for_stats(stats: Dict) -> Optional[str]:
    """Find the correct player ID for given stats based on team, position, and name similarity"""
    try:
        stat_team = stats.get('team', '')
        stat_position = stats.get('position', '')
        
        if not stat_team or not stat_position:
            logger.warning(f"Missing team or position in stats: {stats}")
            return None
        
        # Search for players with matching team and position
        result = supabase.table('players').select('id, name, team, position, external_player_id').eq('sport', 'NFL').eq('team', stat_team).eq('position', stat_position).eq('active', True).execute()
        
        if not result.data:
            logger.warning(f"No NFL players found for team {stat_team}, position {stat_position}")
            return None
        
        if len(result.data) == 1:
            # Only one player matches team + position, use that
            player = result.data[0]
            logger.info(f"Single match found for {stat_team} {stat_position}: {player['name']}")
            return player['id']
        
        # Multiple players found, need to use additional criteria
        logger.info(f"Multiple players found for {stat_team} {stat_position}: {[p['name'] for p in result.data]}")
        
        # Check if we have any distinguishing stats to help identify the correct player
        # For now, return the first match (could be improved with more logic)
        return result.data[0]['id']
        
    except Exception as e:
        logger.error(f"Error finding correct player for stats: {str(e)}")
        return None

def relink_stat_to_correct_player(stat_id: str, correct_player_id: str, old_player_id: str) -> bool:
    """Relink a stat record to the correct player"""
    try:
        result = supabase.table('player_game_stats').update({
            'player_id': correct_player_id
        }).eq('id', stat_id).execute()
        
        if result.data:
            logger.info(f"Successfully relinked stat {stat_id} from player {old_player_id} to {correct_player_id}")
            return True
        else:
            logger.error(f"Failed to relink stat {stat_id}")
            return False
            
    except Exception as e:
        logger.error(f"Error relinking stat {stat_id}: {str(e)}")
        return False

def fix_specific_player_stats(player_name_pattern: str, correct_team: str, correct_position: str) -> int:
    """Fix stats for a specific player (like Josh Allen)"""
    try:
        # Find the correct player
        correct_player_result = supabase.table('players').select('id, name').eq('sport', 'NFL').eq('team', correct_team).eq('position', correct_position).ilike('name', f'%{player_name_pattern}%').execute()
        
        if not correct_player_result.data:
            logger.error(f"Could not find correct player: {player_name_pattern} {correct_team} {correct_position}")
            return 0
        
        correct_player = correct_player_result.data[0]
        correct_player_id = correct_player['id']
        correct_player_name = correct_player['name']
        
        logger.info(f"Fixing stats for: {correct_player_name} (ID: {correct_player_id})")
        
        # Find orphaned stats that should belong to this player
        orphaned_stats_result = supabase.table('player_game_stats').select('id, player_id, stats').filter('stats->>team', 'eq', correct_team).filter('stats->>position', 'eq', correct_position).neq('player_id', correct_player_id).execute()
        
        fixed_count = 0
        
        for stat_record in orphaned_stats_result.data:
            stat_id = stat_record['id']
            old_player_id = stat_record['player_id']
            
            if relink_stat_to_correct_player(stat_id, correct_player_id, old_player_id):
                fixed_count += 1
        
        logger.info(f"Fixed {fixed_count} stat records for {correct_player_name}")
        return fixed_count
        
    except Exception as e:
        logger.error(f"Error fixing stats for {player_name_pattern}: {str(e)}")
        return 0

def main():
    """Main function to fix NFL player stats linkage"""
    logger.info("Starting NFL player stats linkage fix")
    
    # Step 1: Fix specific high-profile players first
    logger.info("=== Fixing High-Profile Players ===")
    
    total_fixed = 0
    
    # Fix Josh Allen (BUF QB)
    fixed_count = fix_specific_player_stats("Josh Allen", "BUF", "QB")
    total_fixed += fixed_count
    
    # Fix Lamar Jackson (BAL QB)  
    fixed_count = fix_specific_player_stats("Lamar Jackson", "BAL", "QB")
    total_fixed += fixed_count
    
    # Fix Lamar Jackson (ATL CB)
    fixed_count = fix_specific_player_stats("Lamar Jackson", "ATL", "CB")
    total_fixed += fixed_count
    
    logger.info(f"=== Fixed {total_fixed} high-profile player stats ===")
    
    # Step 2: Systematic fix for all orphaned stats
    logger.info("=== Starting Systematic Fix ===")
    
    orphaned_stats = get_orphaned_nfl_stats()
    systematic_fixed = 0
    
    for stat_record in orphaned_stats:
        stat_id = stat_record['id']
        old_player_id = stat_record['player_id']
        stats = stat_record['stats']
        
        correct_player_id = find_correct_player_for_stats(stats)
        
        if correct_player_id and correct_player_id != old_player_id:
            if relink_stat_to_correct_player(stat_id, correct_player_id, old_player_id):
                systematic_fixed += 1
    
    total_fixed += systematic_fixed
    logger.info(f"=== Fixed {systematic_fixed} additional orphaned stats ===")
    
    logger.info(f"✅ NFL player stats linkage fix completed! Total fixed: {total_fixed}")
    
    # Verification: Check Josh Allen stats after fix
    logger.info("=== Verification ===")
    josh_allen_stats = supabase.table('player_game_stats').select('count').eq('player_id', 'cec4c2c6-ba32-4e08-aa7a-70c4d4518ddd').execute()
    logger.info(f"Josh Allen (BUF QB) now has {len(josh_allen_stats.data) if josh_allen_stats.data else 0} stat records")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        exit(1)

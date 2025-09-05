#!/usr/bin/env python3
"""
NFL Player Names Update Script
Uses nfl-data-py to get full player names and update the abbreviated names in Supabase
"""

import os
import sys
import nfl_data_py as nfl
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv
import logging
from difflib import SequenceMatcher

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.error("Missing Supabase credentials in environment variables")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def similarity(a, b):
    """Calculate similarity between two strings"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def get_nfl_rosters():
    """Get current NFL rosters with full player names from nfl-data-py"""
    logger.info("Fetching NFL roster data from nfl-data-py...")
    
    try:
        # Get current season rosters (2024)
        current_rosters = nfl.import_seasonal_rosters([2024])
        
        # Also get weekly rosters for more complete data
        weekly_rosters = nfl.import_weekly_rosters([2024])
        
        # Combine and deduplicate
        all_rosters = pd.concat([current_rosters, weekly_rosters]).drop_duplicates(subset=['player_id', 'player_name'])
        
        logger.info(f"Found {len(all_rosters)} NFL player records")
        return all_rosters
        
    except Exception as e:
        logger.error(f"Error fetching NFL roster data: {e}")
        return pd.DataFrame()

def get_database_nfl_players():
    """Get NFL players from Supabase database"""
    logger.info("Fetching NFL players from database...")
    
    try:
        response = supabase.table('players').select('*').eq('sport_key', 'nfl').execute()
        
        if response.data:
            logger.info(f"Found {len(response.data)} NFL players in database")
            return response.data
        else:
            logger.warning("No NFL players found in database")
            return []
            
    except Exception as e:
        logger.error(f"Error fetching players from database: {e}")
        return []

def create_name_mapping(db_players, nfl_rosters):
    """Create mapping between abbreviated names and full names"""
    logger.info("Creating name mapping...")
    
    name_mapping = {}
    updates_found = 0
    
    for db_player in db_players:
        player_id = db_player['id']
        abbreviated_name = db_player['name']
        team = db_player['team']
        position = db_player['position']
        
        # Skip if name is already full (no period)
        if '.' not in abbreviated_name:
            continue
            
        # Extract parts from abbreviated name (e.g., "M.Prater" -> "M", "Prater")
        parts = abbreviated_name.split('.')
        if len(parts) != 2:
            continue
            
        first_initial = parts[0].strip()
        last_name = parts[1].strip()
        
        # Find matching players in NFL data
        potential_matches = nfl_rosters[
            (nfl_rosters['player_name'].str.contains(last_name, case=False, na=False)) &
            (nfl_rosters['player_name'].str.startswith(first_initial, na=False)) &
            (nfl_rosters['team'].eq(team) if 'team' in nfl_rosters.columns else True)
        ]
        
        if len(potential_matches) == 0:
            # Try without team filter
            potential_matches = nfl_rosters[
                (nfl_rosters['player_name'].str.contains(last_name, case=False, na=False)) &
                (nfl_rosters['player_name'].str.startswith(first_initial, na=False))
            ]
        
        if len(potential_matches) == 1:
            full_name = potential_matches.iloc[0]['player_name']
            name_mapping[player_id] = {
                'old_name': abbreviated_name,
                'new_name': full_name,
                'team': team,
                'position': position
            }
            updates_found += 1
            logger.info(f"✓ {abbreviated_name} → {full_name} ({team} {position})")
            
        elif len(potential_matches) > 1:
            # Multiple matches - try to find best match
            best_match = None
            best_score = 0
            
            for _, match in potential_matches.iterrows():
                # Score based on team match and position match
                score = 0
                if 'team' in match and str(match['team']).upper() == team.upper():
                    score += 0.5
                if 'position' in match and str(match['position']).upper() == position.upper():
                    score += 0.3
                    
                # Add name similarity score
                name_sim = similarity(abbreviated_name.replace('.', ' '), match['player_name'])
                score += name_sim * 0.2
                
                if score > best_score:
                    best_score = score
                    best_match = match
            
            if best_match is not None and best_score > 0.5:
                full_name = best_match['player_name']
                name_mapping[player_id] = {
                    'old_name': abbreviated_name,
                    'new_name': full_name,
                    'team': team,
                    'position': position
                }
                updates_found += 1
                logger.info(f"✓ {abbreviated_name} → {full_name} ({team} {position}) [score: {best_score:.2f}]")
            else:
                logger.warning(f"✗ Multiple matches for {abbreviated_name} ({team} {position}), couldn't determine best match")
        else:
            logger.warning(f"✗ No match found for {abbreviated_name} ({team} {position})")
    
    logger.info(f"Found {updates_found} player name updates")
    return name_mapping

def update_player_names(name_mapping):
    """Update player names in the database"""
    logger.info("Updating player names in database...")
    
    updated_count = 0
    error_count = 0
    
    for player_id, update_info in name_mapping.items():
        try:
            response = supabase.table('players').update({
                'name': update_info['new_name']
            }).eq('id', player_id).execute()
            
            if response.data:
                updated_count += 1
                logger.info(f"Updated: {update_info['old_name']} → {update_info['new_name']}")
            else:
                error_count += 1
                logger.error(f"Failed to update {update_info['old_name']}")
                
        except Exception as e:
            error_count += 1
            logger.error(f"Error updating {update_info['old_name']}: {e}")
    
    logger.info(f"Update complete: {updated_count} successful, {error_count} errors")
    return updated_count, error_count

def main():
    """Main function"""
    logger.info("Starting NFL player name update process...")
    
    # Get NFL roster data
    nfl_rosters = get_nfl_rosters()
    if nfl_rosters.empty:
        logger.error("Failed to get NFL roster data")
        return
    
    # Get database players
    db_players = get_database_nfl_players()
    if not db_players:
        logger.error("Failed to get database players")
        return
    
    # Create name mapping
    name_mapping = create_name_mapping(db_players, nfl_rosters)
    if not name_mapping:
        logger.info("No name updates needed")
        return
    
    # Show preview of changes
    logger.info(f"\nPreview of {len(name_mapping)} name updates:")
    for i, (player_id, info) in enumerate(list(name_mapping.items())[:10]):
        logger.info(f"  {info['old_name']} → {info['new_name']}")
    
    if len(name_mapping) > 10:
        logger.info(f"  ... and {len(name_mapping) - 10} more")
    
    # Confirm before proceeding
    response = input(f"\nProceed with updating {len(name_mapping)} player names? (y/N): ")
    if response.lower() != 'y':
        logger.info("Update cancelled by user")
        return
    
    # Update database
    updated_count, error_count = update_player_names(name_mapping)
    
    logger.info(f"\nFinal result: {updated_count} players updated, {error_count} errors")

if __name__ == "__main__":
    main()

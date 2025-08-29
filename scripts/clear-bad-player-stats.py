#!/usr/bin/env python3
"""
Clear Bad Player Stats Data
============================
Removes the averaged/bad data from player_game_stats and player_trends_data tables
before repopulating with correct individual game stats.
"""

import os
import sys
from supabase import create_client, Client
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.error("Missing Supabase environment variables")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def clear_player_game_stats():
    """Clear all records from player_game_stats table"""
    try:
        # Get count before deletion
        count_result = supabase.table('player_game_stats').select('id', count='exact').execute()
        before_count = count_result.count
        
        logger.info(f"Found {before_count} records in player_game_stats")
        
        if before_count == 0:
            logger.info("No records to delete")
            return True
        
        # Delete all records
        result = supabase.table('player_game_stats').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        
        # Verify deletion
        verify_result = supabase.table('player_game_stats').select('id', count='exact').execute()
        after_count = verify_result.count
        
        logger.info(f"Deleted {before_count - after_count} records. Remaining: {after_count}")
        return after_count == 0
        
    except Exception as e:
        logger.error(f"Error clearing player_game_stats: {str(e)}")
        return False

def clear_player_trends_data():
    """Clear all records from player_trends_data table"""
    try:
        # Get count before deletion
        count_result = supabase.table('player_trends_data').select('id', count='exact').execute()
        before_count = count_result.count
        
        logger.info(f"Found {before_count} records in player_trends_data")
        
        if before_count == 0:
            logger.info("No records to delete")
            return True
        
        # Delete all records
        result = supabase.table('player_trends_data').delete().neq('player_id', '00000000-0000-0000-0000-000000000000').execute()
        
        # Verify deletion
        verify_result = supabase.table('player_trends_data').select('id', count='exact').execute()
        after_count = verify_result.count
        
        logger.info(f"Deleted {before_count - after_count} records. Remaining: {after_count}")
        return after_count == 0
        
    except Exception as e:
        logger.error(f"Error clearing player_trends_data: {str(e)}")
        return False

def main():
    """Main execution function"""
    logger.info("Starting cleanup of bad player stats data...")
    
    # Clear both tables
    stats_cleared = clear_player_game_stats()
    trends_cleared = clear_player_trends_data()
    
    if stats_cleared and trends_cleared:
        logger.info("✅ Successfully cleared all bad data from both tables")
        logger.info("Ready for fresh population with correct individual game stats")
    else:
        logger.error("❌ Failed to clear some data - check logs above")
        sys.exit(1)

if __name__ == "__main__":
    main()

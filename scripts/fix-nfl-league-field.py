#!/usr/bin/env python3
"""
Fix existing NFL player_game_stats records that are missing the league field.
Updates 6,031 records where stats->>'league' is null to set league = 'NFL'.
"""

import os
import json
import logging
from typing import Dict, List, Any
from supabase import create_client, Client
from dotenv import load_dotenv

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('fix_nfl_league_field.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class NFLLeagueFieldFixer:
    def __init__(self):
        load_dotenv()
        
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not supabase_url or not supabase_key:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        logger.info("✅ Connected to Supabase")

    def get_nfl_records_needing_fix(self) -> List[Dict[str, Any]]:
        """Get all NFL records that need the league field added."""
        try:
            # Query for records from 2024 season without proper league field
            response = self.supabase.table('player_game_stats').select(
                'id, stats'
            ).eq('stats->>season', '2024').is_(
                'stats->>league', 'null'
            ).execute()
            
            if not response.data:
                logger.info("No records found to fix")
                return []
                
            logger.info(f"Found {len(response.data)} NFL records needing league field fix")
            return response.data
            
        except Exception as e:
            logger.error(f"Error fetching records: {e}")
            return []

    def fix_record_league_field(self, record_id: str, current_stats: Dict[str, Any]) -> bool:
        """Fix a single record by adding the league field."""
        try:
            # Add league field to stats
            updated_stats = current_stats.copy()
            updated_stats['league'] = 'NFL'
            
            # Update the record
            response = self.supabase.table('player_game_stats').update({
                'stats': updated_stats
            }).eq('id', record_id).execute()
            
            if response.data:
                return True
            else:
                logger.warning(f"No data returned when updating record {record_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error updating record {record_id}: {e}")
            return False

    def fix_all_nfl_records(self):
        """Fix all NFL records missing the league field."""
        logger.info("🔧 Starting NFL league field fix...")
        
        # Get records needing fix
        records = self.get_nfl_records_needing_fix()
        
        if not records:
            logger.info("✅ No NFL records need fixing")
            return
        
        logger.info(f"📊 Found {len(records)} NFL records to fix")
        
        # Process records in batches
        batch_size = 100
        fixed_count = 0
        error_count = 0
        
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            logger.info(f"Processing batch {i//batch_size + 1} ({len(batch)} records)...")
            
            for record in batch:
                record_id = record['id']
                current_stats = record['stats']
                
                # Verify this is an NFL record (has week field)
                if current_stats and 'week' in current_stats and 'season' in current_stats:
                    if self.fix_record_league_field(record_id, current_stats):
                        fixed_count += 1
                    else:
                        error_count += 1
                else:
                    logger.warning(f"Skipping record {record_id} - doesn't look like NFL stats")
                    error_count += 1
        
        logger.info(f"✅ NFL league field fix complete!")
        logger.info(f"📈 Fixed: {fixed_count} records")
        logger.info(f"❌ Errors: {error_count} records")
        
        # Verify the fix
        self.verify_fix()

    def verify_fix(self):
        """Verify that NFL records now have proper league field."""
        try:
            # Count NFL records with proper league field
            response = self.supabase.table('player_game_stats').select(
                'id', count='exact'
            ).eq('stats->>season', '2024').eq('stats->>league', 'NFL').execute()
            
            nfl_count = response.count if response.count else 0
            
            # Count records still missing league field
            null_response = self.supabase.table('player_game_stats').select(
                'id', count='exact'
            ).eq('stats->>season', '2024').is_('stats->>league', 'null').execute()
            
            null_count = null_response.count if null_response.count else 0
            
            logger.info(f"📊 Verification Results:")
            logger.info(f"   NFL records with league='NFL': {nfl_count}")
            logger.info(f"   Records still with league=null: {null_count}")
            
            if null_count == 0:
                logger.info("✅ All NFL records now have proper league field!")
            else:
                logger.warning(f"⚠️ {null_count} records still need fixing")
                
        except Exception as e:
            logger.error(f"Error during verification: {e}")

def main():
    """Main execution function."""
    try:
        fixer = NFLLeagueFieldFixer()
        fixer.fix_all_nfl_records()
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise

if __name__ == "__main__":
    main()

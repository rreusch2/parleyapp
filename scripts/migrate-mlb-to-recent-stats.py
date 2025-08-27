#!/usr/bin/env python3
"""
MLB Data Migration Script
Migrates existing MLB data from player_game_stats (JSONB) to player_recent_stats (structured columns)
"""

import os
import sys
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/mlb-migration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Initialize Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://iriaegoipkjtktitpary.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_SERVICE_KEY:
    logger.error("SUPABASE_SERVICE_ROLE_KEY not found in environment")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

class MLBDataMigrator:
    def __init__(self):
        self.migrated_records = 0
        self.skipped_records = 0
        self.error_records = 0
        self.player_cache = {}
        
    async def migrate_mlb_data(self):
        """Main migration function"""
        try:
            logger.info("🔄 Starting MLB data migration from player_game_stats to player_recent_stats...")
            
            # Get player cache for name/team lookups
            await self.load_player_cache()
            
            # Process MLB data in batches
            batch_size = 500
            offset = 0
            
            while True:
                batch = await self.get_mlb_game_stats_batch(offset, batch_size)
                
                if not batch:
                    break
                    
                logger.info(f"📊 Processing batch {offset//batch_size + 1}: {len(batch)} records")
                
                migrated_batch = []
                
                for record in batch:
                    try:
                        migrated_record = await self.convert_game_stat_record(record)
                        if migrated_record:
                            migrated_batch.append(migrated_record)
                    except Exception as e:
                        logger.error(f"Error converting record {record.get('id', 'unknown')}: {e}")
                        self.error_records += 1
                        continue
                
                # Insert batch
                if migrated_batch:
                    await self.insert_recent_stats_batch(migrated_batch)
                
                offset += batch_size
                
                # Progress update
                logger.info(f"✅ Migrated: {self.migrated_records}, Skipped: {self.skipped_records}, Errors: {self.error_records}")
            
            logger.info(f"🎉 MLB migration completed!")
            logger.info(f"📈 Final stats - Migrated: {self.migrated_records}, Skipped: {self.skipped_records}, Errors: {self.error_records}")
            
            # Verify migration
            await self.verify_migration()
            
        except Exception as e:
            logger.error(f"❌ Migration failed: {e}")
            raise

    async def load_player_cache(self):
        """Load all MLB players into memory for fast lookups"""
        try:
            response = supabase.table('players').select(
                'id, name, team, sport, position'
            ).eq('sport', 'MLB').eq('active', True).execute()
            
            for player in response.data:
                self.player_cache[player['id']] = player
                
            logger.info(f"📝 Loaded {len(self.player_cache)} MLB players into cache")
            
        except Exception as e:
            logger.error(f"Error loading player cache: {e}")
            raise

    async def get_mlb_game_stats_batch(self, offset: int, limit: int) -> List[Dict]:
        """Get batch of MLB game stats from player_game_stats table"""
        try:
            response = supabase.table('player_game_stats').select(
                'id, player_id, stats, created_at'
            ).not_('stats', 'is', None).order('created_at', desc=True).range(offset, offset + limit - 1).execute()
            
            # Filter for MLB batting stats
            mlb_records = []
            for record in response.data:
                stats = record.get('stats', {})
                if stats and stats.get('type') == 'batting':
                    mlb_records.append(record)
                    
            return mlb_records
            
        except Exception as e:
            logger.error(f"Error fetching game stats batch: {e}")
            return []

    async def convert_game_stat_record(self, record: Dict) -> Optional[Dict]:
        """Convert player_game_stats record to player_recent_stats format"""
        try:
            player_id = record['player_id']
            stats = record['stats']
            
            # Get player info from cache
            player_info = self.player_cache.get(player_id)
            if not player_info:
                logger.warning(f"Player {player_id} not found in cache")
                self.skipped_records += 1
                return None
            
            # Extract game date from stats
            game_date = stats.get('game_date')
            if not game_date:
                logger.warning(f"No game_date in stats for player {player_info['name']}")
                self.skipped_records += 1
                return None
            
            # Only migrate last 15 games per player (performance optimization)
            if await self.should_skip_old_record(player_id, game_date):
                self.skipped_records += 1
                return None
            
            # Convert to player_recent_stats format
            recent_stat = {
                'player_id': player_id,
                'player_name': player_info['name'],
                'sport': 'MLB',
                'team': player_info['team'],
                'game_date': game_date,
                'opponent': 'TBD',  # Would need additional game info
                'is_home': True,   # Default - would need game info to determine
                
                # MLB Batting Stats
                'hits': stats.get('hits', 0),
                'at_bats': stats.get('at_bats', 0),
                'home_runs': stats.get('home_runs', 0),
                'rbis': 0,  # Not available in current JSONB data
                'runs_scored': 0,  # Not available
                'stolen_bases': 0,  # Not available
                'strikeouts': stats.get('strikeouts', 0),
                'walks': stats.get('walks', 0),
                'total_bases': self.calculate_total_bases(stats),
                
                # Initialize other sport stats to 0
                'points': 0,
                'rebounds': 0,
                'assists': 0,
                'steals': 0,
                'blocks': 0,
                'three_pointers': 0,
                'minutes_played': None,
                
                # NFL stats
                'passing_yards': 0,
                'rushing_yards': 0,
                'receiving_yards': 0,
                'receptions': 0,
                'passing_tds': 0,
                'rushing_tds': 0,
                'receiving_tds': 0,
                
                # Pitching stats
                'innings_pitched': '0.0',
                'strikeouts_pitcher': 0,
                'hits_allowed': 0,
                'walks_allowed': 0,
                'earned_runs': 0,
                
                # UFC/MMA stats
                'significant_strikes': 0,
                'takedowns': 0,
                
                'game_result': 'U',  # Unknown - would need game outcome data
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            return recent_stat
            
        except Exception as e:
            logger.error(f"Error converting record: {e}")
            self.error_records += 1
            return None

    def calculate_total_bases(self, stats: Dict) -> int:
        """Calculate total bases from hits and other stats"""
        try:
            hits = stats.get('hits', 0)
            home_runs = stats.get('home_runs', 0)
            
            # Estimate total bases (simplified calculation)
            # In real scenario, you'd need doubles, triples data
            total_bases = hits + (home_runs * 3)  # HR = 4 bases, but hit is already counted
            
            return max(0, total_bases)
            
        except Exception:
            return 0

    async def should_skip_old_record(self, player_id: str, game_date: str) -> bool:
        """Check if we should skip this record (too old, already have enough recent games)"""
        try:
            # Get count of existing records for this player
            response = supabase.table('player_recent_stats').select(
                'id', count='exact'
            ).eq('player_id', player_id).eq('sport', 'MLB').execute()
            
            count = response.count or 0
            
            # If player already has 15+ games, only keep the most recent ones
            if count >= 15:
                # Check if this game_date is among the 15 most recent
                recent_response = supabase.table('player_recent_stats').select(
                    'game_date'
                ).eq('player_id', player_id).eq('sport', 'MLB').order('game_date', desc=True).limit(15).execute()
                
                if recent_response.data:
                    oldest_kept_date = recent_response.data[-1]['game_date']
                    if game_date < oldest_kept_date:
                        return True  # Skip this older record
            
            return False
            
        except Exception:
            return False

    async def insert_recent_stats_batch(self, records: List[Dict]):
        """Insert batch of records into player_recent_stats with upsert"""
        try:
            # Use upsert to handle potential duplicates
            response = supabase.table('player_recent_stats').upsert(
                records,
                on_conflict='player_id,game_date,opponent'
            ).execute()
            
            self.migrated_records += len(records)
            logger.info(f"✅ Inserted batch of {len(records)} records")
            
        except Exception as e:
            logger.error(f"Error inserting batch: {e}")
            self.error_records += len(records)

    async def verify_migration(self):
        """Verify the migration was successful"""
        try:
            logger.info("🔍 Verifying migration...")
            
            # Count records in both tables
            original_count = supabase.table('player_game_stats').select('*', count='exact').not_('stats', 'is', None).execute().count or 0
            
            migrated_count = supabase.table('player_recent_stats').select('*', count='exact').eq('sport', 'MLB').execute().count or 0
            
            logger.info(f"📊 Original MLB records: {original_count}")
            logger.info(f"📈 Migrated MLB records: {migrated_count}")
            
            # Sample verification - check a few players
            sample_players = supabase.table('player_recent_stats').select(
                'player_name, team, COUNT(*) as game_count'
            ).eq('sport', 'MLB').limit(10).execute()
            
            logger.info("📝 Sample migrated players:")
            for player in sample_players.data:
                logger.info(f"  - {player['player_name']} ({player['team']}): {player['game_count']} games")
            
            logger.info("✅ Migration verification completed")
            
        except Exception as e:
            logger.error(f"Error in verification: {e}")

async def main():
    """Main execution function"""
    try:
        migrator = MLBDataMigrator()
        await migrator.migrate_mlb_data()
        
        logger.info("🎉 MLB data migration completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

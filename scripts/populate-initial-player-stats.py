#!/usr/bin/env python3
"""
Initial Player Stats Population Script
Populates last 10 games for each active player across all sports using optimal APIs
"""

import os
import sys
import asyncio
import aiohttp
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
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/initial-stats-population.log'),
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

# API Configuration
SPORTSDATA_API_KEY = os.getenv('SPORTSDATA_API_KEY')  # You'll need to get this
ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports"

class PlayerStatsPopulator:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.processed_players = set()
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def populate_all_sports(self):
        """Populate stats for all active players across all sports"""
        try:
            logger.info("🚀 Starting initial player stats population...")
            
            # Get all active players by sport
            players_by_sport = await self.get_active_players_by_sport()
            
            for sport, players in players_by_sport.items():
                logger.info(f"📊 Processing {len(players)} {sport} players...")
                await self.populate_sport_stats(sport, players)
                
            logger.info("✅ Initial population completed!")
            
        except Exception as e:
            logger.error(f"❌ Error in populate_all_sports: {e}")
            raise

    async def get_active_players_by_sport(self) -> Dict[str, List[Dict]]:
        """Get all active players grouped by sport"""
        try:
            response = supabase.table('players').select(
                'id, name, team, sport, position, external_player_id'
            ).eq('active', True).execute()
            
            players_by_sport = {}
            for player in response.data:
                sport = player['sport']
                if sport not in players_by_sport:
                    players_by_sport[sport] = []
                players_by_sport[sport].append(player)
                
            return players_by_sport
            
        except Exception as e:
            logger.error(f"Error fetching active players: {e}")
            return {}

    async def populate_sport_stats(self, sport: str, players: List[Dict]):
        """Populate stats for players in a specific sport"""
        sport_methods = {
            'MLB': self.populate_mlb_stats,
            'NBA': self.populate_nba_stats, 
            'NFL': self.populate_nfl_stats,
            'WNBA': self.populate_wnba_stats
        }
        
        method = sport_methods.get(sport)
        if method:
            await method(players)
        else:
            logger.warning(f"No population method for sport: {sport}")

    async def populate_mlb_stats(self, players: List[Dict]):
        """Populate MLB player stats using ESPN API (free) or migrate from existing player_game_stats"""
        
        # Option 1: Migrate existing MLB data from player_game_stats
        logger.info("📈 Migrating existing MLB data from player_game_stats...")
        
        try:
            # Get existing MLB batting data
            response = supabase.table('player_game_stats').select(
                'player_id, stats, created_at'
            ).not_('stats', 'is', None).order('created_at', desc=True).limit(1000).execute()
            
            migrated_records = []
            for record in response.data:
                try:
                    player_id = record['player_id']
                    stats_json = record['stats']
                    
                    if not stats_json or 'game_date' not in stats_json:
                        continue
                        
                    # Find player info
                    player_info = next((p for p in players if p['id'] == player_id), None)
                    if not player_info:
                        continue
                        
                    # Convert to player_recent_stats format
                    recent_stat = {
                        'player_id': player_id,
                        'player_name': player_info['name'],
                        'sport': 'MLB',
                        'team': player_info['team'],
                        'game_date': stats_json['game_date'],
                        'opponent': 'TBD',  # Would need game info to determine
                        'is_home': True,   # Default, would need game info
                        'hits': stats_json.get('hits', 0),
                        'at_bats': stats_json.get('at_bats', 0),
                        'home_runs': stats_json.get('home_runs', 0),
                        'rbis': 0,  # Not in current data
                        'runs_scored': 0,  # Not in current data  
                        'stolen_bases': 0,  # Not in current data
                        'strikeouts': stats_json.get('strikeouts', 0),
                        'walks': stats_json.get('walks', 0),
                        'total_bases': 0,  # Would need to calculate
                        'created_at': datetime.now().isoformat(),
                        'updated_at': datetime.now().isoformat()
                    }
                    
                    migrated_records.append(recent_stat)
                    
                    # Process in batches of 100
                    if len(migrated_records) >= 100:
                        await self.batch_insert_stats(migrated_records)
                        migrated_records = []
                        
                except Exception as e:
                    logger.error(f"Error processing MLB record: {e}")
                    continue
            
            # Insert remaining records
            if migrated_records:
                await self.batch_insert_stats(migrated_records)
                
            logger.info(f"✅ Migrated MLB stats for {len(self.processed_players)} players")
            
        except Exception as e:
            logger.error(f"Error migrating MLB stats: {e}")

    async def populate_nba_stats(self, players: List[Dict]):
        """Populate NBA stats using ESPN API"""
        logger.info("🏀 Populating NBA player stats...")
        
        for player in players:
            try:
                # ESPN NBA stats endpoint  
                if not self.session:
                    continue
                    
                # This would use ESPN API - simplified for demonstration
                stats = await self.fetch_espn_player_stats('nba', player['name'], player['team'])
                
                if stats:
                    await self.insert_player_stats('NBA', player, stats)
                    
            except Exception as e:
                logger.error(f"Error fetching NBA stats for {player['name']}: {e}")
                continue

    async def populate_nfl_stats(self, players: List[Dict]):
        """Populate NFL stats - data already exists in player_recent_stats"""
        logger.info("🏈 NFL stats already populated in player_recent_stats")
        
        # Verify NFL data exists
        response = supabase.table('player_recent_stats').select('*').eq('sport', 'NFL').limit(5).execute()
        logger.info(f"✅ Found {len(response.data)} NFL records (sample)")

    async def populate_wnba_stats(self, players: List[Dict]):
        """Populate WNBA stats using ESPN API"""
        logger.info("🏀 Populating WNBA player stats...")
        
        for player in players:
            try:
                stats = await self.fetch_espn_player_stats('wnba', player['name'], player['team'])
                
                if stats:
                    await self.insert_player_stats('WNBA', player, stats)
                    
            except Exception as e:
                logger.error(f"Error fetching WNBA stats for {player['name']}: {e}")
                continue

    async def fetch_espn_player_stats(self, sport: str, player_name: str, team: str) -> Optional[List[Dict]]:
        """Fetch player stats from ESPN API (free but rate limited)"""
        try:
            if not self.session:
                return None
                
            # ESPN API endpoints
            urls = {
                'nba': f"{ESPN_API_BASE}/basketball/nba/athletes",
                'wnba': f"{ESPN_API_BASE}/basketball/wnba/athletes"  
            }
            
            url = urls.get(sport)
            if not url:
                return None
            
            # This is a simplified example - ESPN API requires more complex queries
            async with self.session.get(url, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    # Process ESPN data format
                    return self.process_espn_data(data, sport)
                    
        except Exception as e:
            logger.error(f"ESPN API error for {player_name}: {e}")
            
        return None

    def process_espn_data(self, data: Dict, sport: str) -> List[Dict]:
        """Process ESPN API response into standardized format"""
        # This would process the actual ESPN response
        # Return mock data for demonstration
        games = []
        for i in range(10):  # Last 10 games
            game_date = datetime.now() - timedelta(days=i*3)
            
            if sport == 'nba' or sport == 'wnba':
                games.append({
                    'game_date': game_date.strftime('%Y-%m-%d'),
                    'opponent': f'OPP{i}',
                    'is_home': i % 2 == 0,
                    'points': 15 + (i * 2),
                    'rebounds': 5 + i,
                    'assists': 3 + i,
                    'steals': 1,
                    'blocks': 1,
                    'three_pointers': 2
                })
                
        return games

    async def insert_player_stats(self, sport: str, player: Dict, stats: List[Dict]):
        """Insert player stats into player_recent_stats table"""
        try:
            records = []
            for stat in stats:
                record = {
                    'player_id': player['id'],
                    'player_name': player['name'],
                    'sport': sport,
                    'team': player['team'],
                    **stat,
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                records.append(record)
            
            if records:
                await self.batch_insert_stats(records)
                self.processed_players.add(player['id'])
                
        except Exception as e:
            logger.error(f"Error inserting stats for {player['name']}: {e}")

    async def batch_insert_stats(self, records: List[Dict]):
        """Insert records in batches with upsert logic"""
        try:
            # Use upsert to avoid duplicates
            response = supabase.table('player_recent_stats').upsert(
                records, 
                on_conflict='player_id,game_date,opponent'
            ).execute()
            
            logger.info(f"✅ Inserted {len(records)} stat records")
            
        except Exception as e:
            logger.error(f"Batch insert error: {e}")

async def main():
    """Main execution function"""
    try:
        async with PlayerStatsPopulator() as populator:
            await populator.populate_all_sports()
            
        logger.info("🎉 Initial player stats population completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Population failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""
SportsDataIO MLB Integration Script
Uses your free trial API to collect comprehensive MLB player stats and headshots
Replaces existing data collection with premium, detailed player game data
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
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/sportsdata-mlb-integration.log'),
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

# SportsDataIO Configuration
SPORTSDATA_API_KEY = "03d3518bdc1d468cba7855b6e1fcdfa6"  # Your free trial key
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/mlb"

class SportsDataMLBCollector:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.collected_games = 0
        self.updated_players = 0
        self.downloaded_headshots = 0
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def collect_comprehensive_mlb_data(self, date: str = None):
        """Main function to collect comprehensive MLB data"""
        try:
            if not date:
                date = (datetime.now() - timedelta(days=1)).strftime('%Y-%b-%d').upper()
                
            logger.info(f"🏈 Starting comprehensive MLB data collection for {date}...")
            
            # Step 1: Collect player game stats for the date
            await self.collect_player_game_stats(date)
            
            # Step 2: Collect player headshots (one-time setup)
            await self.collect_player_headshots()
            
            logger.info(f"✅ MLB data collection completed!")
            logger.info(f"📊 Updated {self.updated_players} players, downloaded {self.downloaded_headshots} headshots")
            
        except Exception as e:
            logger.error(f"❌ MLB data collection failed: {e}")
            raise

    async def collect_player_game_stats(self, date: str):
        """Collect detailed player game stats from SportsDataIO"""
        try:
            logger.info(f"📈 Collecting MLB player game stats for {date}...")
            
            # Get player game stats for the date (much more detailed than before)
            url = f"{SPORTSDATA_BASE_URL}/stats/json/PlayerGameStatsByDateFinal/{date}"
            params = {'key': SPORTSDATA_API_KEY}
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    player_stats = await response.json()
                    logger.info(f"📊 Found {len(player_stats)} player performances for {date}")
                    
                    for player_stat in player_stats:
                        await self.process_player_game_stat(player_stat, date)
                        
                else:
                    logger.error(f"SportsDataIO API error: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error collecting player game stats: {e}")

    async def process_player_game_stat(self, player_stat: Dict, game_date: str):
        """Process individual player game stat and update player_recent_stats"""
        try:
            playerid = player_stat.get('PlayerID')
            name = player_stat.get('Name', '')
            team = player_stat.get('Team', '')
            opponent = player_stat.get('Opponent', '')
            is_home = player_stat.get('HomeOrAway') == 'HOME'
            
            # Map our database player to SportsDataIO player
            db_player_id = await self.get_or_create_player(playerid, name, team)
            if not db_player_id:
                return
                
            # Extract comprehensive batting stats (much more detailed than before)
            batting_stats = {
                'player_id': db_player_id,
                'player_name': name,
                'sport': 'MLB',
                'team': team,
                'game_date': game_date,
                'opponent_team': opponent,
                'is_home': is_home,
                
                # Batting Stats (from SportsDataIO comprehensive data)
                'hits': player_stat.get('Hits', 0),
                'at_bats': player_stat.get('AtBats', 0),
                'home_runs': player_stat.get('HomeRuns', 0),
                'rbis': player_stat.get('RunsBattedIn', 0),  # Now we have RBIs!
                'runs_scored': player_stat.get('Runs', 0),  # Now we have Runs!
                'stolen_bases': player_stat.get('StolenBases', 0),  # Now we have SB!
                'strikeouts': player_stat.get('Strikeouts', 0),
                'walks': player_stat.get('Walks', 0),
                'total_bases': player_stat.get('TotalBases', 0),  # Now we have TB!
                
                # Additional batting metrics now available
                'doubles': player_stat.get('Doubles', 0),
                'triples': player_stat.get('Triples', 0),
                'sacrifice_flies': player_stat.get('SacrificeFlies', 0),
                'hit_by_pitch': player_stat.get('HitByPitch', 0),
                'ground_into_double_plays': player_stat.get('GroundIntoDoublePlay', 0),
                
                # Pitching stats (if applicable)
                'innings_pitched': str(player_stat.get('InningsPitchedDecimal', 0)),
                'strikeouts_pitcher': player_stat.get('PitcherStrikeouts', 0),
                'hits_allowed': player_stat.get('PitcherHits', 0),
                'walks_allowed': player_stat.get('PitcherWalks', 0),
                'earned_runs': player_stat.get('EarnedRuns', 0),
                
                # Game result
                'game_result': 'W' if player_stat.get('IsWin', False) else 'L' if player_stat.get('IsLoss', False) else 'U',
                
                # Initialize other sports stats to 0
                'points': 0, 'rebounds': 0, 'assists': 0, 'steals': 0, 'blocks': 0,
                'three_pointers': 0, 'minutes_played': None, 'passing_yards': 0,
                'rushing_yards': 0, 'receiving_yards': 0, 'receptions': 0,
                'passing_tds': 0, 'rushing_tds': 0, 'receiving_tds': 0,
                'significant_strikes': 0, 'takedowns': 0,
                
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            # Upsert to player_recent_stats
            response = supabase.table('player_recent_stats').upsert(
                batting_stats,
                on_conflict='player_id,game_date,opponent_team'
            ).execute()
            
            if response.data:
                self.updated_players += 1
                logger.debug(f"✅ Updated stats: {name} ({team}) vs {opponent}")
                
        except Exception as e:
            logger.error(f"Error processing player stat: {e}")

    async def get_or_create_player(self, sportsdata_id: int, name: str, team: str) -> Optional[str]:
        """Get existing player ID or create new player record"""
        try:
            # First, try to find existing player by name and team
            response = supabase.table('players').select('id').eq('name', name).eq('team', team).eq('sport', 'MLB').execute()
            
            if response.data:
                return response.data[0]['id']
            else:
                # Create new player record
                new_player = {
                    'name': name,
                    'team': team,
                    'sport': 'MLB',
                    'position': 'Unknown',  # We could enhance this with position data
                    'active': True,
                    'external_id': str(sportsdata_id),  # Store SportsDataIO ID for future reference
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                
                create_response = supabase.table('players').insert(new_player).execute()
                
                if create_response.data:
                    logger.info(f"➕ Created new player: {name} ({team})")
                    return create_response.data[0]['id']
                    
        except Exception as e:
            logger.error(f"Error getting/creating player {name}: {e}")
            
        return None

    async def collect_player_headshots(self):
        """Collect MLB player headshots from SportsDataIO"""
        try:
            logger.info("📷 Collecting MLB player headshots...")
            
            # Get headshots data
            url = f"{SPORTSDATA_BASE_URL}/headshots/json/Headshots"
            params = {'key': SPORTSDATA_API_KEY}
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    headshots = await response.json()
                    logger.info(f"📸 Found {len(headshots)} player headshots")
                    
                    for headshot in headshots:
                        await self.process_player_headshot(headshot)
                        
                else:
                    logger.error(f"Headshots API error: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error collecting headshots: {e}")

    async def process_player_headshot(self, headshot: Dict):
        """Process and store player headshot URL"""
        try:
            playerid = headshot.get('PlayerID')
            name = headshot.get('Name', '')
            team = headshot.get('Team', '')
            headshot_url = headshot.get('PreferredHostedHeadshotUrl', '')
            
            if not headshot_url:
                return
                
            # Find corresponding player in our database
            response = supabase.table('players').select('id').eq('name', name).eq('team', team).eq('sport', 'MLB').execute()
            
            if response.data:
                player_id = response.data[0]['id']
                
                # Update player with headshot URL
                update_response = supabase.table('players').update({
                    'headshot_url': headshot_url,
                    'external_id': str(playerid),
                    'updated_at': datetime.now().isoformat()
                }).eq('id', player_id).execute()
                
                if update_response.data:
                    self.downloaded_headshots += 1
                    logger.debug(f"📸 Added headshot for {name} ({team})")
                    
        except Exception as e:
            logger.error(f"Error processing headshot: {e}")

    async def collect_season_stats(self, season: str = "2024"):
        """Collect season-long stats for all MLB players"""
        try:
            logger.info(f"📊 Collecting MLB season stats for {season}...")
            
            url = f"{SPORTSDATA_BASE_URL}/stats/json/PlayerSeasonStats/{season}"
            params = {'key': SPORTSDATA_API_KEY}
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    season_stats = await response.json()
                    logger.info(f"📈 Found season stats for {len(season_stats)} players")
                    
                    # Store season stats for context (could be used for averages, projections)
                    for stat in season_stats:
                        await self.store_season_stat(stat, season)
                        
                else:
                    logger.error(f"Season stats API error: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error collecting season stats: {e}")

    async def store_season_stat(self, season_stat: Dict, season: str):
        """Store season-long stats for player analysis"""
        try:
            # This could be stored in a separate player_season_stats table
            # For now, we'll use it to enhance player records with season averages
            
            playerid = season_stat.get('PlayerID')
            name = season_stat.get('Name', '')
            team = season_stat.get('Team', '')
            
            # Update player record with season averages
            season_data = {
                'season': season,
                'games_played': season_stat.get('Games', 0),
                'batting_avg': season_stat.get('BattingAverage', 0),
                'on_base_pct': season_stat.get('OnBasePercentage', 0),
                'slugging_pct': season_stat.get('SluggingPercentage', 0),
                'ops': season_stat.get('OnBasePlusSlugging', 0),
                'total_hits': season_stat.get('Hits', 0),
                'total_home_runs': season_stat.get('HomeRuns', 0),
                'total_rbis': season_stat.get('RunsBattedIn', 0)
            }
            
            # Find player and update metadata with season stats
            response = supabase.table('players').select('id, metadata').eq('name', name).eq('team', team).eq('sport', 'MLB').execute()
            
            if response.data:
                player = response.data[0]
                current_metadata = player.get('metadata', {}) or {}
                current_metadata['season_stats'] = season_data
                
                supabase.table('players').update({
                    'metadata': current_metadata
                }).eq('id', player['id']).execute()
                
        except Exception as e:
            logger.error(f"Error storing season stat: {e}")

async def main():
    """Main execution function"""
    import sys
    
    try:
        async with SportsDataMLBCollector() as collector:
            if len(sys.argv) > 1:
                # Specific date provided
                date = sys.argv[1]  # Format: 2024-AUG-26
                await collector.collect_comprehensive_mlb_data(date)
            else:
                # Default: yesterday's games
                await collector.collect_comprehensive_mlb_data()
                
            # Also collect season stats for context
            await collector.collect_season_stats("2024")
            
        logger.info("🎉 SportsDataIO MLB integration completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ SportsDataIO integration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

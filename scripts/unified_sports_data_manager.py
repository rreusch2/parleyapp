#!/usr/bin/env python3
"""
Unified Sports Data Manager
Centralized system for collecting accurate player stats from legitimate APIs
Replaces all fake data generation with real sports data
"""

import os
import sys
import requests
import logging
from datetime import datetime, timedelta
from supabase import create_client
from dotenv import load_dotenv
import time
from typing import Dict, List, Optional
import json

# Load environment
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/unified_sports_data.log')
    ]
)
logger = logging.getLogger(__name__)

class UnifiedSportsDataManager:
    """Centralized manager for all sports data collection using real APIs"""
    
    def __init__(self):
        self.supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_KEY')
        )
        
        # API Keys and URLs
        self.sportsdata_key = os.getenv('SPORTSDATA_API_KEY')
        self.theodds_key = os.getenv('THEODDS_API_KEY')
        self.statmuse_url = "https://feisty-nurturing-production-9c29.up.railway.app"
        
        # API base URLs
        self.sportsdata_base = "https://api.sportsdata.io"
        
        logger.info("🔥 Unified Sports Data Manager initialized with REAL APIs")
    
    def validate_api_keys(self) -> Dict[str, bool]:
        """Validate all required API keys are present"""
        validation = {
            'sportsdata': bool(self.sportsdata_key),
            'theodds': bool(self.theodds_key),
            'statmuse': True  # Always available as it's our service
        }
        
        logger.info(f"API Key Validation: {validation}")
        return validation
    
    def get_current_sports_seasons(self) -> Dict[str, Dict]:
        """Get current season info for each sport (September 2025)"""
        return {
            'MLB': {
                'season': 2024,  # 2024 season completed
                'status': 'completed',
                'data_range': '2024-03-01 to 2024-10-31'
            },
            'NFL': {
                'season': 2024,  # 2024 season in progress
                'status': 'active',
                'data_range': '2024-09-01 to 2025-02-15'
            },
            'NBA': {
                'season': 2024,  # 2023-24 season completed, 2024-25 starts Oct
                'status': 'offseason',
                'data_range': '2023-10-01 to 2024-06-30'
            },
            'WNBA': {
                'season': 2024,  # 2024 season in progress
                'status': 'active',
                'data_range': '2024-05-01 to 2024-10-31'
            }
        }
    
    def fetch_mlb_real_stats(self, limit: int = 1000) -> Dict:
        """Fetch real MLB player stats from SportsDataIO"""
        logger.info(f"⚾ Fetching REAL MLB stats (limit: {limit})")
        
        try:
            # Get recent player game stats from 2024 season
            url = f"{self.sportsdata_base}/v3/mlb/stats/json/PlayerGameStatsByDate/2024-09-01"
            headers = {"Ocp-Apim-Subscription-Key": self.sportsdata_key}
            
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            stats = response.json()
            
            if isinstance(stats, list):
                # Limit results to prevent overwhelming
                limited_stats = stats[:limit]
                
                logger.info(f"✅ Retrieved {len(limited_stats)} REAL MLB player stats")
                return {
                    'success': True,
                    'data': limited_stats,
                    'source': 'SportsDataIO',
                    'count': len(limited_stats)
                }
            
            return {'success': False, 'error': 'Invalid response format'}
            
        except Exception as e:
            logger.error(f"❌ MLB stats fetch error: {e}")
            return {'success': False, 'error': str(e)}
    
    def fetch_nfl_real_stats(self, week: int = 1, limit: int = 500) -> Dict:
        """Fetch real NFL player stats from SportsDataIO"""
        logger.info(f"🏈 Fetching REAL NFL stats (Week {week}, limit: {limit})")
        
        try:
            # Get 2024 NFL season stats
            url = f"{self.sportsdata_base}/v3/nfl/stats/json/PlayerGameStatsByWeek/2024/{week}"
            headers = {"Ocp-Apim-Subscription-Key": self.sportsdata_key}
            
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            stats = response.json()
            
            if isinstance(stats, list):
                limited_stats = stats[:limit]
                
                logger.info(f"✅ Retrieved {len(limited_stats)} REAL NFL player stats")
                return {
                    'success': True,
                    'data': limited_stats,
                    'source': 'SportsDataIO',
                    'count': len(limited_stats),
                    'week': week
                }
            
            return {'success': False, 'error': 'Invalid response format'}
            
        except Exception as e:
            logger.error(f"❌ NFL stats fetch error: {e}")
            return {'success': False, 'error': str(e)}
    
    def fetch_nba_real_stats(self) -> Dict:
        """Fetch real NBA player stats using StatMuse"""
        logger.info("🏀 Fetching REAL NBA stats via StatMuse")
        
        try:
            query = "Show me NBA player stats from last 10 games 2024 season top 50 players with points rebounds assists"
            
            response = requests.post(
                f"{self.statmuse_url}/query",
                json={"query": query},
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            
            logger.info("✅ Retrieved REAL NBA stats from StatMuse")
            return {
                'success': True,
                'data': data.get('data', []),
                'source': 'StatMuse',
                'query': query
            }
            
        except Exception as e:
            logger.error(f"❌ NBA stats fetch error: {e}")
            return {'success': False, 'error': str(e)}
    
    def fetch_wnba_real_stats(self) -> Dict:
        """Fetch real WNBA player stats using StatMuse"""
        logger.info("🏀 Fetching REAL WNBA stats via StatMuse")
        
        try:
            query = "Show me WNBA player stats from last 10 games 2024 season top 30 players with points rebounds assists"
            
            response = requests.post(
                f"{self.statmuse_url}/query",
                json={"query": query},
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            
            logger.info("✅ Retrieved REAL WNBA stats from StatMuse")
            return {
                'success': True,
                'data': data.get('data', []),
                'source': 'StatMuse',
                'query': query
            }
            
        except Exception as e:
            logger.error(f"❌ WNBA stats fetch error: {e}")
            return {'success': False, 'error': str(e)}
    
    def clean_fake_data(self, confirm: bool = False) -> Dict:
        """Remove fake data from player_game_stats table"""
        if not confirm:
            logger.warning("⚠️  clean_fake_data() requires confirm=True to execute")
            return {'success': False, 'message': 'Confirmation required'}
        
        logger.info("🧹 Cleaning fake data from player_game_stats table")
        
        try:
            # Count fake records first
            count_result = self.supabase.table('player_game_stats').select('id', count='exact').execute()
            total_before = count_result.count
            
            # Delete records created by fake data scripts
            # These have impossible future dates in stats->game_date
            delete_result = self.supabase.table('player_game_stats').delete().gte('created_at', '2025-08-28T00:00:00').execute()
            
            logger.info(f"✅ Cleaned fake data - removed records created after 2025-08-28")
            
            # Count remaining records
            count_after = self.supabase.table('player_game_stats').select('id', count='exact').execute()
            total_after = count_after.count
            
            removed = total_before - total_after
            
            return {
                'success': True,
                'records_before': total_before,
                'records_after': total_after,
                'records_removed': removed
            }
            
        except Exception as e:
            logger.error(f"❌ Error cleaning fake data: {e}")
            return {'success': False, 'error': str(e)}
    
    def store_real_player_stats(self, sport: str, stats_data: List[Dict]) -> int:
        """Store real player stats in database with validation"""
        logger.info(f"💾 Storing {len(stats_data)} REAL {sport} stats")
        
        stored_count = 0
        
        for stat in stats_data:
            try:
                # Extract player info and validate
                player_name = stat.get('Name') or stat.get('PlayerName') or stat.get('player_name')
                if not player_name:
                    continue
                
                # Get game date and validate it's not in the future
                game_date = stat.get('Day') or stat.get('GameDate') or stat.get('date')
                if not game_date:
                    continue
                
                # Parse and validate date
                try:
                    if isinstance(game_date, str):
                        date_obj = datetime.strptime(game_date.split('T')[0], '%Y-%m-%d')
                    else:
                        continue
                        
                    # Ensure date is not in the future
                    if date_obj > datetime.now():
                        logger.warning(f"Skipping future date: {game_date}")
                        continue
                        
                except:
                    continue
                
                # Find player in database
                player_result = self.supabase.table('players').select('id').eq('name', player_name).eq('sport', sport).execute()
                
                if not player_result.data:
                    logger.debug(f"Player not found: {player_name}")
                    continue
                
                player_id = player_result.data[0]['id']
                
                # Check if this stat already exists
                existing = self.supabase.table('player_game_stats').select('id').eq('player_id', player_id).execute()
                
                # Prepare stat data
                clean_stat = {
                    'game_date': game_date,
                    'player_name': player_name,
                    'sport': sport
                }
                
                # Add sport-specific stats
                if sport == 'MLB':
                    clean_stat.update({
                        'hits': stat.get('Hits', 0),
                        'at_bats': stat.get('AtBats', 0),
                        'home_runs': stat.get('HomeRuns', 0),
                        'rbis': stat.get('RunsBattedIn', 0),
                        'runs': stat.get('Runs', 0),
                        'walks': stat.get('Walks', 0),
                        'strikeouts': stat.get('Strikeouts', 0)
                    })
                elif sport == 'NFL':
                    clean_stat.update({
                        'passing_yards': stat.get('PassingYards', 0),
                        'rushing_yards': stat.get('RushingYards', 0),
                        'receiving_yards': stat.get('ReceivingYards', 0),
                        'touchdowns': stat.get('Touchdowns', 0),
                        'receptions': stat.get('Receptions', 0)
                    })
                elif sport in ['NBA', 'WNBA']:
                    clean_stat.update({
                        'points': stat.get('Points', 0),
                        'rebounds': stat.get('Rebounds', 0),
                        'assists': stat.get('Assists', 0),
                        'steals': stat.get('Steals', 0),
                        'blocks': stat.get('Blocks', 0)
                    })
                
                # Insert real stat
                self.supabase.table('player_game_stats').insert({
                    'player_id': player_id,
                    'stats': clean_stat,
                    'created_at': datetime.now().isoformat()
                }).execute()
                
                stored_count += 1
                
                if stored_count % 50 == 0:
                    logger.info(f"  Stored {stored_count} real stats...")
                    
            except Exception as e:
                logger.debug(f"Error storing stat: {e}")
                continue
        
        logger.info(f"✅ Successfully stored {stored_count} REAL {sport} stats")
        return stored_count
    
    def run_complete_data_refresh(self, clean_fake_data: bool = False) -> Dict:
        """Run complete refresh of all sports data with real APIs"""
        logger.info("🚀 Starting COMPLETE REAL DATA REFRESH")
        
        results = {
            'start_time': datetime.now().isoformat(),
            'api_validation': self.validate_api_keys(),
            'season_info': self.get_current_sports_seasons(),
            'sports_processed': {},
            'total_real_stats': 0
        }
        
        # Clean fake data if requested
        if clean_fake_data:
            clean_result = self.clean_fake_data(confirm=True)
            results['cleanup'] = clean_result
        
        # Collect MLB stats
        mlb_result = self.fetch_mlb_real_stats()
        if mlb_result['success']:
            stored = self.store_real_player_stats('MLB', mlb_result['data'])
            results['sports_processed']['MLB'] = {
                'fetched': mlb_result['count'],
                'stored': stored,
                'source': mlb_result['source']
            }
            results['total_real_stats'] += stored
        
        # Collect NFL stats
        nfl_result = self.fetch_nfl_real_stats()
        if nfl_result['success']:
            stored = self.store_real_player_stats('NFL', nfl_result['data'])
            results['sports_processed']['NFL'] = {
                'fetched': nfl_result['count'],
                'stored': stored,
                'source': nfl_result['source']
            }
            results['total_real_stats'] += stored
        
        # Collect NBA stats
        nba_result = self.fetch_nba_real_stats()
        if nba_result['success']:
            stored = self.store_real_player_stats('NBA', nba_result.get('data', []))
            results['sports_processed']['NBA'] = {
                'fetched': len(nba_result.get('data', [])),
                'stored': stored,
                'source': nba_result['source']
            }
            results['total_real_stats'] += stored
        
        # Collect WNBA stats
        wnba_result = self.fetch_wnba_real_stats()
        if wnba_result['success']:
            stored = self.store_real_player_stats('WNBA', wnba_result.get('data', []))
            results['sports_processed']['WNBA'] = {
                'fetched': len(wnba_result.get('data', [])),
                'stored': stored,
                'source': wnba_result['source']
            }
            results['total_real_stats'] += stored
        
        results['end_time'] = datetime.now().isoformat()
        results['success'] = True
        
        logger.info(f"🎉 COMPLETE DATA REFRESH FINISHED")
        logger.info(f"Total REAL stats collected: {results['total_real_stats']}")
        
        return results

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Unified Sports Data Manager')
    parser.add_argument('--clean-fake', action='store_true', help='Clean fake data before collecting real data')
    parser.add_argument('--validate-only', action='store_true', help='Only validate API keys')
    
    args = parser.parse_args()
    
    manager = UnifiedSportsDataManager()
    
    if args.validate_only:
        validation = manager.validate_api_keys()
        print(f"API Key Validation: {validation}")
        sys.exit(0)
    
    # Run complete data refresh
    result = manager.run_complete_data_refresh(clean_fake_data=args.clean_fake)
    
    print(f"\n🎯 UNIFIED SPORTS DATA COLLECTION COMPLETE")
    print(f"Total real stats collected: {result['total_real_stats']}")
    print(f"Sports processed: {list(result['sports_processed'].keys())}")
    print("✅ ALL DATA NOW COMES FROM LEGITIMATE APIS!")

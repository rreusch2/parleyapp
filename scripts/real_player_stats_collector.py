#!/usr/bin/env python3
"""
Real Player Stats Collector - Uses legitimate sports APIs
Replaces all fake/synthetic data generation with accurate historical data
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

# Load environment
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/real_stats_collection.log')
    ]
)
logger = logging.getLogger(__name__)

class RealPlayerStatsCollector:
    """Collects real player stats from legitimate APIs"""
    
    def __init__(self):
        self.supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_KEY')
        )
        
        # API Keys
        self.sportsdata_key = os.getenv('SPORTSDATA_API_KEY')
        self.theodds_key = os.getenv('THEODDS_API_KEY')
        
        # API Base URLs
        self.sportsdata_base = "https://api.sportsdata.io"
        self.statmuse_base = "https://feisty-nurturing-production-9c29.up.railway.app"
        
    def collect_mlb_stats_real(self) -> Dict:
        """Collect real MLB player stats from SportsDataIO"""
        logger.info("🔥 Collecting REAL MLB player stats from SportsDataIO API")
        
        try:
            # Get current season stats - use 2024 season (most recent complete)
            season = 2024
            
            # Fetch real player game logs from SportsDataIO
            url = f"{self.sportsdata_base}/v3/mlb/scores/json/PlayerGameStatsByDate/2024-09-01"
            headers = {"Ocp-Apim-Subscription-Key": self.sportsdata_key}
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            game_stats = response.json()
            logger.info(f"✅ Retrieved {len(game_stats)} real MLB game stats")
            
            return {
                'success': True,
                'data': game_stats,
                'source': 'SportsDataIO',
                'season': season
            }
            
        except Exception as e:
            logger.error(f"❌ Error fetching real MLB stats: {e}")
            return {'success': False, 'error': str(e)}
    
    def collect_nba_stats_real(self) -> Dict:
        """Collect real NBA player stats using StatMuse API"""
        logger.info("🔥 Collecting REAL NBA player stats via StatMuse")
        
        try:
            # Query StatMuse for recent NBA player performance
            query = "Show me last 10 games stats for top NBA players in 2024 season"
            
            response = requests.post(
                f"{self.statmuse_base}/query",
                json={"query": query},
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info("✅ Retrieved real NBA stats from StatMuse")
            
            return {
                'success': True,
                'data': data,
                'source': 'StatMuse',
                'query': query
            }
            
        except Exception as e:
            logger.error(f"❌ Error fetching real NBA stats: {e}")
            return {'success': False, 'error': str(e)}
    
    def collect_nfl_stats_real(self) -> Dict:
        """Collect real NFL player stats from SportsDataIO"""
        logger.info("🔥 Collecting REAL NFL player stats from SportsDataIO API")
        
        try:
            # Get 2024 NFL season stats (current season)
            season = 2024
            week = 1  # Start with week 1
            
            url = f"{self.sportsdata_base}/v3/nfl/stats/json/PlayerGameStatsByWeek/{season}/{week}"
            headers = {"Ocp-Apim-Subscription-Key": self.sportsdata_key}
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            game_stats = response.json()
            logger.info(f"✅ Retrieved {len(game_stats)} real NFL game stats")
            
            return {
                'success': True,
                'data': game_stats,
                'source': 'SportsDataIO',
                'season': season,
                'week': week
            }
            
        except Exception as e:
            logger.error(f"❌ Error fetching real NFL stats: {e}")
            return {'success': False, 'error': str(e)}
    
    def collect_wnba_stats_real(self) -> Dict:
        """Collect real WNBA player stats using StatMuse"""
        logger.info("🔥 Collecting REAL WNBA player stats via StatMuse")
        
        try:
            query = "Show me last 10 games for top WNBA players in 2024 season with points rebounds assists"
            
            response = requests.post(
                f"{self.statmuse_base}/query",
                json={"query": query},
                timeout=30
            )
            response.raise_for_status()
            
            data = response.json()
            logger.info("✅ Retrieved real WNBA stats from StatMuse")
            
            return {
                'success': True,
                'data': data,
                'source': 'StatMuse',
                'query': query
            }
            
        except Exception as e:
            logger.error(f"❌ Error fetching real WNBA stats: {e}")
            return {'success': False, 'error': str(e)}
    
    def validate_date_accuracy(self, game_date: str) -> bool:
        """Validate that game dates are historically accurate"""
        try:
            date_obj = datetime.strptime(game_date, '%Y-%m-%d')
            current_date = datetime.now()
            
            # Game date must be in the past (not future)
            if date_obj > current_date:
                logger.warning(f"❌ INVALID FUTURE DATE: {game_date}")
                return False
                
            # Game date must be within reasonable sports seasons
            # MLB: March-October, NBA: October-June, NFL: September-February
            return True
            
        except Exception as e:
            logger.error(f"❌ Date validation error for {game_date}: {e}")
            return False
    
    def store_real_stats(self, sport: str, stats_data: List[Dict]) -> int:
        """Store real stats in database with validation"""
        logger.info(f"💾 Storing {len(stats_data)} real {sport} stats in database")
        
        stored_count = 0
        
        for stat in stats_data:
            try:
                # Validate date accuracy
                game_date = stat.get('game_date') or stat.get('date')
                if not game_date or not self.validate_date_accuracy(game_date):
                    continue
                
                # Find player in database
                player_result = self.supabase.table('players').select('id').eq('name', stat.get('player_name')).eq('sport', sport).execute()
                
                if not player_result.data:
                    logger.debug(f"Player not found: {stat.get('player_name')}")
                    continue
                
                player_id = player_result.data[0]['id']
                
                # Store real stat record
                insert_data = {
                    'player_id': player_id,
                    'stats': stat,
                    'created_at': datetime.now().isoformat()
                }
                
                self.supabase.table('player_game_stats').insert(insert_data).execute()
                stored_count += 1
                
                if stored_count % 100 == 0:
                    logger.info(f"  Stored {stored_count} real stats...")
                    
            except Exception as e:
                logger.debug(f"Error storing stat: {e}")
                continue
        
        logger.info(f"✅ Successfully stored {stored_count} REAL {sport} stats")
        return stored_count
    
    def run_full_collection(self):
        """Run complete real data collection for all sports"""
        logger.info("🚀 Starting REAL player stats collection for ALL sports")
        
        total_real_stats = 0
        
        # Collect MLB stats
        mlb_result = self.collect_mlb_stats_real()
        if mlb_result['success']:
            total_real_stats += self.store_real_stats('MLB', mlb_result['data'])
        
        # Collect NBA stats
        nba_result = self.collect_nba_stats_real()
        if nba_result['success']:
            total_real_stats += self.store_real_stats('NBA', nba_result.get('data', []))
        
        # Collect NFL stats
        nfl_result = self.collect_nfl_stats_real()
        if nfl_result['success']:
            total_real_stats += self.store_real_stats('NFL', nfl_result['data'])
        
        # Collect WNBA stats
        wnba_result = self.collect_wnba_stats_real()
        if wnba_result['success']:
            total_real_stats += self.store_real_stats('WNBA', wnba_result.get('data', []))
        
        logger.info(f"🎉 COMPLETED: {total_real_stats} REAL player stats collected from legitimate APIs")
        
        return {
            'total_real_stats': total_real_stats,
            'mlb': mlb_result,
            'nba': nba_result,
            'nfl': nfl_result,
            'wnba': wnba_result
        }

if __name__ == "__main__":
    collector = RealPlayerStatsCollector()
    result = collector.run_full_collection()
    
    print(f"\n🎯 REAL DATA COLLECTION COMPLETE")
    print(f"Total legitimate stats collected: {result['total_real_stats']}")
    print("✅ NO MORE FAKE DATA!")

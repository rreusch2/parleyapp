#!/usr/bin/env python3
"""
Daily Player Stats Automation Script
Updates player_game_stats table with new games from SportsData.io API
Runs daily to keep player trends data current for the trends tab
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv('/home/reid/Desktop/parleyapp/.env')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/daily-player-stats.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Add current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sportsdata_service import SportsDataService
from supabase_client import SupabasePlayerStatsClient

class DailyPlayerStatsAutomation:
    def __init__(self):
        self.sportsdata = SportsDataService()
        self.supabase = SupabasePlayerStatsClient()
        
    def update_daily_mlb_games(self):
        """Update MLB games from yesterday and today"""
        logger.info("🏟️ Starting daily MLB player stats update")
        
        # Get yesterday and today's dates
        today = datetime.now()
        yesterday = today - timedelta(days=1)
        
        dates_to_check = [
            yesterday.strftime("%Y-%b-%d").upper(),  # 2025-AUG-26
            today.strftime("%Y-%b-%d").upper()       # 2025-AUG-27
        ]
        
        total_games_added = 0
        players_updated = set()
        
        for date in dates_to_check:
            try:
                logger.info(f"📊 Checking MLB games for {date}")
                box_scores = self.sportsdata.get_mlb_box_scores_by_date(date)
                
                if not box_scores:
                    logger.info(f"⚠️ No MLB games found for {date}")
                    continue
                
                logger.info(f"📈 Found {len(box_scores)} MLB games for {date}")
                
                # Process each box score
                for box_score in box_scores:
                    player_games = box_score.get('PlayerGames', [])
                    
                    for player_game in player_games:
                        try:
                            # Get or create player
                            player_data = self.sportsdata.normalize_mlb_player_stats(player_game)
                            player_id = self.supabase.get_or_create_player(player_data)
                            
                            if not player_id:
                                continue
                            
                            # Check if we already have this game
                            game_date = player_game.get('Day', '')
                            existing_dates = self.supabase.get_existing_game_dates(player_id, 2)
                            
                            if game_date in existing_dates:
                                continue  # Skip duplicate
                            
                            # Normalize and insert game stats
                            game_stats = self.sportsdata.normalize_mlb_game_stats(player_game)
                            
                            if self.supabase.insert_player_game_stats(player_id, game_stats):
                                total_games_added += 1
                                players_updated.add(player_id)
                                logger.debug(f"✅ Added game for {player_data['name']} on {game_date}")
                            
                        except Exception as e:
                            logger.error(f"❌ Error processing MLB player game: {e}")
                            continue
                
            except Exception as e:
                logger.error(f"❌ Error processing MLB date {date}: {e}")
                continue
        
        # Update trends data for all affected players
        trends_updated = 0
        for player_id in players_updated:
            if self.supabase.update_player_trends_data(player_id, 'MLB'):
                trends_updated += 1
        
        logger.info(f"✅ MLB Daily Update Complete:")
        logger.info(f"   - Games added: {total_games_added}")
        logger.info(f"   - Players affected: {len(players_updated)}")
        logger.info(f"   - Trends updated: {trends_updated}")
        
        return total_games_added

    def update_daily_wnba_games(self):
        """Update WNBA games from yesterday and today"""
        logger.info("🏀 Starting daily WNBA player stats update")
        
        # Get yesterday and today's dates
        today = datetime.now()
        yesterday = today - timedelta(days=1)
        
        dates_to_check = [
            yesterday.strftime("%Y-%b-%d").upper(),  # 2025-AUG-26
            today.strftime("%Y-%b-%d").upper()       # 2025-AUG-27
        ]
        
        total_games_added = 0
        players_updated = set()
        
        for date in dates_to_check:
            try:
                logger.info(f"📊 Checking WNBA games for {date}")
                box_scores = self.sportsdata.get_wnba_box_scores_by_date(date)
                
                if not box_scores:
                    logger.info(f"⚠️ No WNBA games found for {date}")
                    continue
                
                logger.info(f"📈 Found {len(box_scores)} WNBA games for {date}")
                
                # Process each box score
                for box_score in box_scores:
                    player_games = box_score.get('PlayerGames', [])
                    
                    for player_game in player_games:
                        try:
                            # Get or create player
                            player_data = self.sportsdata.normalize_wnba_player_stats(player_game)
                            player_id = self.supabase.get_or_create_player(player_data)
                            
                            if not player_id:
                                continue
                            
                            # Check if we already have this game
                            game_date = player_game.get('Day', '')
                            existing_dates = self.supabase.get_existing_game_dates(player_id, 2)
                            
                            if game_date in existing_dates:
                                continue  # Skip duplicate
                            
                            # Normalize and insert game stats
                            game_stats = self.sportsdata.normalize_wnba_game_stats(player_game)
                            
                            if self.supabase.insert_player_game_stats(player_id, game_stats):
                                total_games_added += 1
                                players_updated.add(player_id)
                                logger.debug(f"✅ Added game for {player_data['name']} on {game_date}")
                            
                        except Exception as e:
                            logger.error(f"❌ Error processing WNBA player game: {e}")
                            continue
                
            except Exception as e:
                logger.error(f"❌ Error processing WNBA date {date}: {e}")
                continue
        
        # Update trends data for all affected players
        trends_updated = 0
        for player_id in players_updated:
            if self.supabase.update_player_trends_data(player_id, 'WNBA'):
                trends_updated += 1
        
        logger.info(f"✅ WNBA Daily Update Complete:")
        logger.info(f"   - Games added: {total_games_added}")
        logger.info(f"   - Players affected: {len(players_updated)}")
        logger.info(f"   - Trends updated: {trends_updated}")
        
        return total_games_added

    def run_daily_automation(self):
        """Run complete daily automation for all sports"""
        logger.info("🚀 Starting Daily Player Stats Automation")
        start_time = datetime.now()
        
        try:
            # Update MLB games
            mlb_games = self.update_daily_mlb_games()
            
            # Update WNBA games  
            wnba_games = self.update_daily_wnba_games()
            
            total_games = mlb_games + wnba_games
            duration = datetime.now() - start_time
            
            logger.info(f"🎯 Daily Automation Complete!")
            logger.info(f"   - Total games added: {total_games}")
            logger.info(f"   - Duration: {duration.total_seconds():.1f} seconds")
            
            # Log summary to database or file for monitoring
            self._log_automation_summary({
                'date': datetime.now().isoformat(),
                'mlb_games_added': mlb_games,
                'wnba_games_added': wnba_games,
                'total_games_added': total_games,
                'duration_seconds': duration.total_seconds(),
                'status': 'success'
            })
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Daily automation failed: {e}")
            
            # Log error summary
            self._log_automation_summary({
                'date': datetime.now().isoformat(),
                'error': str(e),
                'status': 'failed'
            })
            
            return False

    def _log_automation_summary(self, summary: dict):
        """Log automation summary for monitoring"""
        log_file = '/home/reid/Desktop/parleyapp/logs/player-stats-automation.log'
        
        try:
            with open(log_file, 'a') as f:
                f.write(f"{datetime.now().isoformat()} - {summary}\n")
        except Exception as e:
            logger.error(f"Failed to write automation summary: {e}")

    def test_api_connectivity(self):
        """Test SportsData.io API connectivity"""
        logger.info("🔌 Testing SportsData.io API connectivity")
        
        try:
            # Test MLB
            recent_dates = self.sportsdata.get_recent_dates(1)
            if recent_dates:
                yesterday = recent_dates[1] if len(recent_dates) > 1 else recent_dates[0]
                mlb_games = self.sportsdata.get_mlb_box_scores_by_date(yesterday)
                logger.info(f"✅ MLB API working - found {len(mlb_games) if mlb_games else 0} games for {yesterday}")
            
            # Test WNBA
            if recent_dates:
                wnba_games = self.sportsdata.get_wnba_box_scores_by_date(yesterday)
                logger.info(f"✅ WNBA API working - found {len(wnba_games) if wnba_games else 0} games for {yesterday}")
            
            # Test Supabase
            mlb_players = self.supabase.get_all_active_players('MLB')
            wnba_players = self.supabase.get_all_active_players('WNBA')
            logger.info(f"✅ Supabase working - {len(mlb_players)} MLB players, {len(wnba_players)} WNBA players")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ API connectivity test failed: {e}")
            return False


def main():
    """Main function with command line options"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Daily Player Stats Automation')
    parser.add_argument('--test', action='store_true', help='Test API connectivity only')
    parser.add_argument('--mlb-only', action='store_true', help='Update MLB games only')
    parser.add_argument('--wnba-only', action='store_true', help='Update WNBA games only')
    
    args = parser.parse_args()
    
    automation = DailyPlayerStatsAutomation()
    
    if args.test:
        automation.test_api_connectivity()
    elif args.mlb_only:
        automation.update_daily_mlb_games()
    elif args.wnba_only:
        automation.update_daily_wnba_games()
    else:
        automation.run_daily_automation()


if __name__ == "__main__":
    main()

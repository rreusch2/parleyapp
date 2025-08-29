#!/usr/bin/env python3
"""
WNBA Players and Recent Games Population Script
Fetches WNBA players and their recent game stats from SportsData.io
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/home/reid/Desktop/parleyapp/.env')

# Add current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sportsdata_service import SportsDataService
from supabase_client import SupabasePlayerStatsClient

class WNBAPlayerPopulator:
    def __init__(self):
        self.sportsdata = SportsDataService()
        self.supabase = SupabasePlayerStatsClient()
        
    def populate_wnba_players_and_games(self, season: str = "2025"):
        """Populate WNBA players and their recent games"""
        print(f"🏀 Starting WNBA player and games population for {season}")
        
        # Step 1: Get all WNBA player season stats (includes player info)
        player_season_stats = self.sportsdata.get_wnba_player_season_stats(season)
        
        if not player_season_stats:
            print("❌ No WNBA player season stats found")
            return
        
        print(f"📊 Found {len(player_season_stats)} WNBA players with season stats")
        
        # Step 2: Process each player
        players_created = 0
        games_added = 0
        
        for player_stat in player_season_stats[:100]:  # Limit to 100 players to conserve API calls
            try:
                # Normalize player data
                player_data = self.sportsdata.normalize_wnba_player_stats(player_stat)
                
                # Skip inactive players
                if not player_data.get('active', True):
                    continue
                
                # Get or create player in database
                player_id = self.supabase.get_or_create_player(player_data)
                
                if not player_id:
                    continue
                
                players_created += 1
                
                # Get recent game logs for this player
                external_id = player_data['external_player_id']
                if external_id:
                    game_logs = self.sportsdata.get_wnba_player_game_logs(
                        player_id=int(external_id),
                        season=season,
                        num_games="10"
                    )
                    
                    # Process each game
                    for game_log in game_logs:
                        try:
                            # Normalize game stats
                            game_stats = self.sportsdata.normalize_wnba_game_stats(game_log)
                            
                            # Insert game stats
                            if self.supabase.insert_player_game_stats(player_id, game_stats):
                                games_added += 1
                                
                        except Exception as e:
                            print(f"❌ Error processing game for {player_data['name']}: {e}")
                            continue
                    
                    # Update trends data for this player
                    if game_logs:
                        self.supabase.update_player_trends_data(player_id, 'WNBA')
                        print(f"✅ Processed {player_data['name']} - {len(game_logs)} games")
                
            except Exception as e:
                print(f"❌ Error processing player: {e}")
                continue
        
        print(f"\n🎯 WNBA Population Complete:")
        print(f"✅ Players processed: {players_created}")
        print(f"✅ Games added: {games_added}")

    def populate_wnba_by_recent_dates(self, days_back: int = 10):
        """Populate WNBA games by fetching recent box scores"""
        print(f"📅 Populating WNBA games from recent {days_back} days")
        
        # Get recent dates
        recent_dates = self.sportsdata.get_recent_dates(days_back)
        
        total_games = 0
        
        for date in recent_dates:
            try:
                print(f"📊 Processing WNBA games for {date}...")
                box_scores = self.sportsdata.get_wnba_box_scores_by_date(date)
                
                if not box_scores:
                    print(f"⚠️ No WNBA games found for {date}")
                    continue
                
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
                            
                            # Normalize and insert game stats
                            game_stats = self.sportsdata.normalize_wnba_game_stats(player_game)
                            if self.supabase.insert_player_game_stats(player_id, game_stats):
                                total_games += 1
                            
                        except Exception as e:
                            print(f"❌ Error processing WNBA player game: {e}")
                            continue
                
                print(f"✅ Processed {len(box_scores)} WNBA box scores for {date}")
                
            except Exception as e:
                print(f"❌ Error processing WNBA date {date}: {e}")
                continue
        
        print(f"\n🎯 WNBA Recent Games Complete: {total_games} games added")

    def update_all_wnba_trends(self):
        """Update trends data for all WNBA players"""
        print("📈 Updating WNBA player trends data...")
        
        wnba_players = self.supabase.get_all_active_players('WNBA')
        
        updated_count = 0
        for player in wnba_players:
            if self.supabase.update_player_trends_data(player['id'], 'WNBA'):
                updated_count += 1
        
        print(f"✅ Updated trends for {updated_count} WNBA players")


def main():
    """Main function with command line options"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Populate WNBA players and games')
    parser.add_argument('--season', type=str, default='2025', help='Season year (default: 2025)')
    parser.add_argument('--recent-days', type=int, help='Populate recent N days of games')
    parser.add_argument('--update-trends', action='store_true', help='Update trends data only')
    
    args = parser.parse_args()
    
    populator = WNBAPlayerPopulator()
    
    if args.update_trends:
        populator.update_all_wnba_trends()
    elif args.recent_days:
        populator.populate_wnba_by_recent_dates(args.recent_days)
    else:
        populator.populate_wnba_players_and_games(args.season)


if __name__ == "__main__":
    main()

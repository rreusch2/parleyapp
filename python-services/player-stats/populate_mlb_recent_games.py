#!/usr/bin/env python3
"""
MLB Recent Games Population Script
Fetches recent MLB player game stats from SportsData.io and populates player_game_stats table
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

class MLBRecentGamesPopulator:
    def __init__(self):
        self.sportsdata = SportsDataService()
        self.supabase = SupabasePlayerStatsClient()
        
    def populate_recent_games(self, days_back: int = 10):
        """Populate recent MLB games using box scores by date (more reliable)"""
        print(f"🏟️ Starting MLB recent games population ({days_back} days back)")
        
        # Get recent dates to fetch
        recent_dates = self.sportsdata.get_recent_dates(days_back)
        print(f"📅 Will fetch games for dates: {recent_dates[:5]}...")  # Show first 5
        
        total_games_added = 0
        players_updated = set()
        
        for date in recent_dates:
            try:
                print(f"📊 Processing MLB games for {date}...")
                box_scores = self.sportsdata.get_mlb_box_scores_by_date(date)
                
                if not box_scores:
                    print(f"⚠️ No MLB games found for {date}")
                    continue
                
                print(f"📈 Found {len(box_scores)} MLB games for {date}")
                
                # Process each box score
                for box_score in box_scores:
                    player_games = box_score.get('PlayerGames', [])
                    
                    for player_game in player_games:
                        try:
                            # Get player info from the game data
                            player_name = player_game.get('Name', '')
                            if not player_name:
                                continue
                            
                            # Try to find existing player by name and team
                            team = player_game.get('Team', '')
                            existing_player = self.supabase.find_player_by_name_team(player_name, team, 'MLB')
                            
                            player_id = None
                            if existing_player:
                                player_id = existing_player['id']
                                # Update external_player_id if missing
                                if not existing_player.get('external_player_id') and player_game.get('PlayerID'):
                                    self.supabase.update_player_external_id(player_id, str(player_game.get('PlayerID')))
                            else:
                                # Create new player
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
                            
                        except Exception as e:
                            print(f"❌ Error processing player game: {e}")
                            continue
                
            except Exception as e:
                print(f"❌ Error processing date {date}: {e}")
                continue
        
        # Update trends data for all affected players
        trends_updated = 0
        for player_id in players_updated:
            if self.supabase.update_player_trends_data(player_id, 'MLB'):
                trends_updated += 1
        
        print(f"\n🎯 MLB Population Complete:")
        print(f"✅ Games added: {total_games_added}")
        print(f"✅ Players affected: {len(players_updated)}")
        print(f"✅ Trends updated: {trends_updated}")

    def populate_by_date_range(self, start_date: str, end_date: str):
        """Populate games by fetching box scores for date range"""
        print(f"📅 Populating MLB games from {start_date} to {end_date}")
        
        dates = self.sportsdata.get_date_range(start_date, end_date)
        
        for date in dates:
            try:
                # Convert to SportsData format (2025-AUG-27)
                formatted_date = datetime.strptime(date, '%Y-%b-%d').strftime('%Y-%b-%d').upper()
                
                print(f"📊 Processing {formatted_date}...")
                box_scores = self.sportsdata.get_mlb_box_scores_by_date(formatted_date)
                
                if not box_scores:
                    continue
                
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
                            
                            # Normalize and insert game stats
                            game_stats = self.sportsdata.normalize_mlb_game_stats(player_game)
                            self.supabase.insert_player_game_stats(player_id, game_stats)
                            
                        except Exception as e:
                            print(f"❌ Error processing player game: {e}")
                            continue
                
            except Exception as e:
                print(f"❌ Error processing date {date}: {e}")
                continue
        
        print("✅ Date range population complete")


def main():
    """Main function with command line options"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Populate MLB recent games')
    parser.add_argument('--days', type=int, default=10, help='Number of days back to fetch (default: 10)')
    parser.add_argument('--start-date', type=str, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='End date (YYYY-MM-DD)')
    
    args = parser.parse_args()
    
    populator = MLBRecentGamesPopulator()
    
    if args.start_date and args.end_date:
        populator.populate_by_date_range(args.start_date, args.end_date)
    else:
        populator.populate_recent_games(args.days)


if __name__ == "__main__":
    main()

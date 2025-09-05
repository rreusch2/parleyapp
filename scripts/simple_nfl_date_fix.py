#!/usr/bin/env python3

import os
import requests
import json
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class SimpleNFLDateFix:
    def __init__(self):
        self.api_key = os.getenv('SPORTSDATA_API_KEY', '62fa3caa1fcd47eb99a2b737973a46be')
        self.base_url = "https://api.sportsdata.io/v3/nfl"
        
        # Initialize Supabase
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.supabase: Client = create_client(supabase_url, supabase_key)

    def make_api_request(self, endpoint: str):
        """Make API request to SportsData.io"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Ocp-Apim-Subscription-Key': self.api_key}
        
        try:
            print(f"🔍 Calling API: {endpoint}")
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ API Error: {e}")
            return None

    def get_2024_schedule_mapping(self):
        """Get 2024 NFL schedule mapping"""
        print("📊 Getting 2024 NFL schedule...")
        
        schedule_data = self.make_api_request("scores/json/Schedules/2024")
        if not schedule_data:
            return {}
        
        # Create comprehensive mapping
        game_mapping = {}
        
        for game in schedule_data:
            home = game.get('HomeTeam', '')
            away = game.get('AwayTeam', '')
            date_str = game.get('DateTime', '') or game.get('Date', '')
            
            if not all([home, away, date_str]):
                continue
            
            try:
                # Parse date
                if 'T' in date_str:
                    date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                else:
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                
                game_date = date_obj.strftime('%Y-%m-%d')
                
                # Create all possible lookup keys
                # Format: team_opponent_home/away
                game_mapping[f"{home}_{away}_home"] = game_date  # home team perspective
                game_mapping[f"{away}_{home}_away"] = game_date  # away team perspective
                
                print(f"📅 Mapped: {home} vs {away} on {game_date}")
                
            except Exception as e:
                print(f"⚠️ Date parse error: {e}")
                continue
        
        print(f"✅ Created {len(game_mapping)} game date mappings")
        return game_mapping

    def update_nfl_dates(self):
        """Update NFL records with correct dates"""
        print("🔄 Updating NFL game dates...")
        
        # Get date mappings
        date_mapping = self.get_2024_schedule_mapping()
        if not date_mapping:
            return 0
        
        # Get all NFL records without dates
        result = self.supabase.table('player_game_stats').select('*').execute()
        if not result.data:
            return 0
        
        # Get player team info
        players_result = self.supabase.table('players').select('id, team, sport').eq('sport', 'NFL').execute()
        player_teams = {p['id']: p['team'] for p in players_result.data}
        
        updated_count = 0
        checked_count = 0
        
        for record in result.data:
            stats = record.get('stats', {})
            
            # Skip non-NFL or records that already have dates
            if stats.get('sport') != 'NFL' or stats.get('game_date'):
                continue
            
            checked_count += 1
            
            # Get game info
            player_team = player_teams.get(record['player_id'], '')
            opponent = stats.get('opponent', '')
            home_or_away = stats.get('home_or_away', '')
            
            if not all([player_team, opponent, home_or_away]):
                continue
            
            # Create lookup key
            lookup_key = f"{player_team}_{opponent}_{home_or_away}"
            
            if lookup_key in date_mapping:
                game_date = date_mapping[lookup_key]
                
                # Update the record
                updated_stats = stats.copy()
                updated_stats['game_date'] = game_date
                
                try:
                    self.supabase.table('player_game_stats').update({
                        'stats': updated_stats
                    }).eq('id', record['id']).execute()
                    
                    updated_count += 1
                    
                    if updated_count % 1000 == 0:
                        print(f"📊 Updated {updated_count} records...")
                        
                except Exception as e:
                    print(f"❌ Update error: {e}")
            else:
                if checked_count <= 20:  # Show first 20 for debugging
                    print(f"⚠️ No match for key: {lookup_key}")
        
        print(f"✅ Updated {updated_count} out of {checked_count} NFL records")
        return updated_count

    def verify_results(self):
        """Verify the updates"""
        print("🔍 Verifying updates...")
        
        # Count NFL records with and without dates
        nfl_with_dates = self.supabase.table('player_game_stats').select('id', count='exact').match({
            'stats->>sport': 'NFL'
        }).not_.is_('stats->>game_date', 'null').execute()
        
        nfl_without_dates = self.supabase.table('player_game_stats').select('id', count='exact').match({
            'stats->>sport': 'NFL'
        }).is_('stats->>game_date', 'null').execute()
        
        print(f"✅ NFL records WITH dates: {nfl_with_dates.count}")
        print(f"❌ NFL records WITHOUT dates: {nfl_without_dates.count}")

if __name__ == "__main__":
    fixer = SimpleNFLDateFix()
    
    print("🏈 Simple NFL Date Fixer for 2024 Season")
    print("="*50)
    
    # Update dates
    updated = fixer.update_nfl_dates()
    
    print("\n" + "="*50)
    fixer.verify_results()
    
    print(f"\n🎯 Updated {updated} NFL records with 2024 game dates")

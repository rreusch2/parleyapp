#!/usr/bin/env python3

import os
import requests
import json
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class NFLDateFixer:
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
        headers = {
            'Ocp-Apim-Subscription-Key': self.api_key
        }
        
        try:
            print(f"🔍 Calling API: {endpoint}")
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ API Error: {e}")
            return None

    def test_schedule_endpoints(self):
        """Test different schedule endpoints to find game dates"""
        print("🗓️ Testing schedule endpoints for game dates...")
        
        # Try different endpoints that might have game dates
        endpoints_to_test = [
            "scores/json/Schedules/2024",
            "scores/json/ScoresByWeek/2024/1", 
            "scores/json/Games/2024"
        ]
        
        for endpoint in endpoints_to_test:
            print(f"\n📅 Testing endpoint: {endpoint}")
            data = self.make_api_request(endpoint)
            
            if data and len(data) > 0:
                first_game = data[0] if isinstance(data, list) else data
                
                # Look for date fields
                date_fields = [key for key in first_game.keys() if any(word in key.lower() for word in ['date', 'time', 'day'])]
                print(f"Date fields found: {date_fields}")
                
                for field in date_fields:
                    print(f"  {field}: {first_game[field]}")
                
                # Show relevant game info
                relevant_fields = ['HomeTeam', 'AwayTeam', 'Week', 'Season', 'DateTime', 'Date', 'Day']
                print("Relevant fields:")
                for field in relevant_fields:  
                    if field in first_game:
                        print(f"  {field}: {first_game[field]}")
                        
                return data  # Return the successful data
        
        return None

    def get_weekly_schedule_dates(self):
        """Get game dates from weekly schedules"""
        print("📊 Getting NFL schedule to map opponents to dates...")
        
        # Get full season schedule
        schedule_data = self.make_api_request("scores/json/Schedules/2024")
        
        if not schedule_data:
            print("❌ Could not retrieve schedule data")
            return {}
            
        # Create mapping of team matchups to dates
        game_date_mapping = {}
        
        for game in schedule_data:
            home_team = game.get('HomeTeam', '')
            away_team = game.get('AwayTeam', '')
            game_date = game.get('DateTime', '') or game.get('Date', '')
            
            if game_date and home_team and away_team:
                # Parse the date
                try:
                    if 'T' in game_date:
                        date_obj = datetime.fromisoformat(game_date.replace('Z', '+00:00'))
                    else:
                        date_obj = datetime.strptime(game_date, '%Y-%m-%d')
                    
                    formatted_date = date_obj.strftime('%Y-%m-%d')
                    
                    # Map both home and away perspectives
                    game_date_mapping[f"{home_team}_vs_{away_team}"] = formatted_date
                    game_date_mapping[f"{away_team}_at_{home_team}"] = formatted_date
                    
                except Exception as e:
                    print(f"⚠️ Date parsing error for {home_team} vs {away_team}: {e}")
                    continue
        
        print(f"✅ Created {len(game_date_mapping)} game date mappings")
        return game_date_mapping

    def update_nfl_game_dates(self):
        """Update existing NFL game records with correct dates"""
        print("🔄 Updating NFL game dates in database...")
        
        # Get game date mappings
        date_mapping = self.get_weekly_schedule_dates()
        
        if not date_mapping:
            print("❌ No date mappings available")
            return
        
        # Get all NFL player game stats that need date updates
        result = self.supabase.table('player_game_stats').select(
            'id, stats, player_id'
        ).execute()
        
        if not result.data:
            print("❌ No game stats found")
            return
        
        # Get player info for team context
        player_result = self.supabase.table('players').select(
            'id, name, team, sport'
        ).eq('sport', 'NFL').execute()
        
        player_teams = {p['id']: p['team'] for p in player_result.data}
        
        updated_count = 0
        
        for record in result.data:
            if record['stats'].get('sport') != 'NFL':
                continue
                
            player_team = player_teams.get(record['player_id'], '')
            opponent = record['stats'].get('opponent', '')
            home_or_away = record['stats'].get('home_or_away', '')
            
            if not opponent or not player_team:
                continue
            
            # Try to find matching game date
            game_key = None
            if home_or_away == 'home':
                game_key = f"{player_team}_vs_{opponent}"
            else:
                game_key = f"{player_team}_at_{opponent}"  # Player team is away
            
            # Alternative keys to try (sometimes team abbreviations differ)
            alt_keys = [
                f"{opponent}_vs_{player_team}" if home_or_away == 'away' else f"{opponent}_at_{player_team}",
                f"{player_team}_{opponent}",
                f"{opponent}_{player_team}"
            ]
            
            game_date = date_mapping.get(game_key)
            
            # Try alternative keys if primary doesn't work
            if not game_date:
                for alt_key in alt_keys:
                    if alt_key in date_mapping:
                        game_date = date_mapping[alt_key]
                        break
            
            if game_date:
                # Update the stats JSON with the correct date
                updated_stats = record['stats'].copy()
                updated_stats['game_date'] = game_date
                
                # Update the record
                try:
                    update_result = self.supabase.table('player_game_stats').update({
                        'stats': updated_stats
                    }).eq('id', record['id']).execute()
                    
                    updated_count += 1
                    if updated_count % 100 == 0:
                        print(f"📊 Updated {updated_count} records...")
                except Exception as e:
                    print(f"❌ Error updating record {record['id']}: {e}")
            else:
                print(f"⚠️ No date found for {player_team} vs {opponent} ({home_or_away})")
        
        print(f"✅ Updated {updated_count} NFL game records with correct dates")

    def verify_updates(self):
        """Verify the date updates worked"""
        print("🔍 Verifying date updates...")
        
        result = self.supabase.table('player_game_stats').select(
            'stats'
        ).execute()
        
        if result.data:
            non_null_dates = 0
            unique_dates = set()
            
            for record in result.data:
                stats = record.get('stats', {})
                if stats.get('sport') == 'NFL' and stats.get('game_date'):
                    non_null_dates += 1
                    unique_dates.add(stats['game_date'])
            
            print(f"✅ NFL records with dates: {non_null_dates}")
            print(f"✅ Unique game dates: {len(unique_dates)}")
            print(f"✅ Sample dates: {sorted(list(unique_dates))[:10]}")

if __name__ == "__main__":
    fixer = NFLDateFixer()
    
    # First test what endpoints are available
    print("🏈 NFL Game Date Fixer")
    print("=" * 50)
    
    # Test schedule endpoints first
    schedule_data = fixer.test_schedule_endpoints()
    
    if schedule_data:
        print("\n" + "="*50)
        fixer.update_nfl_game_dates()
        
        print("\n" + "="*50)
        fixer.verify_updates()
    else:
        print("❌ Could not access schedule data to fix dates")

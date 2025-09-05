#!/usr/bin/env python3

import os
import requests
import json
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class EnhancedNFLDateFixer:
    def __init__(self):
        self.api_key = os.getenv('SPORTSDATA_API_KEY', '62fa3caa1fcd47eb99a2b737973a46be')
        self.base_url = "https://api.sportsdata.io/v3/nfl"
        
        # Initialize Supabase
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        # NFL team name mappings (database format -> SportsData.io abbreviation)
        self.team_mappings = {
            # AFC East
            'BUF': 'BUF', 'Buffalo Bills': 'BUF', 'Buffalo': 'BUF',
            'MIA': 'MIA', 'Miami Dolphins': 'MIA', 'Miami': 'MIA', 
            'NE': 'NE', 'New England Patriots': 'NE', 'New England': 'NE',
            'NYJ': 'NYJ', 'New York Jets': 'NYJ', 'NY Jets': 'NYJ', 'Jets': 'NYJ',
            
            # AFC North  
            'BAL': 'BAL', 'Baltimore Ravens': 'BAL', 'Baltimore': 'BAL',
            'CIN': 'CIN', 'Cincinnati Bengals': 'CIN', 'Cincinnati': 'CIN',
            'CLE': 'CLE', 'Cleveland Browns': 'CLE', 'Cleveland': 'CLE',
            'PIT': 'PIT', 'Pittsburgh Steelers': 'PIT', 'Pittsburgh': 'PIT',
            
            # AFC South
            'HOU': 'HOU', 'Houston Texans': 'HOU', 'Houston': 'HOU',
            'IND': 'IND', 'Indianapolis Colts': 'IND', 'Indianapolis': 'IND',
            'JAX': 'JAX', 'Jacksonville Jaguars': 'JAX', 'Jacksonville': 'JAX',
            'TEN': 'TEN', 'Tennessee Titans': 'TEN', 'Tennessee': 'TEN',
            
            # AFC West
            'DEN': 'DEN', 'Denver Broncos': 'DEN', 'Denver': 'DEN',
            'KC': 'KC', 'Kansas City Chiefs': 'KC', 'Kansas City': 'KC',
            'LV': 'LV', 'Las Vegas Raiders': 'LV', 'Las Vegas': 'LV', 'Raiders': 'LV',
            'LAC': 'LAC', 'Los Angeles Chargers': 'LAC', 'LA Chargers': 'LAC', 'Chargers': 'LAC',
            
            # NFC East
            'DAL': 'DAL', 'Dallas Cowboys': 'DAL', 'Dallas': 'DAL',
            'NYG': 'NYG', 'New York Giants': 'NYG', 'NY Giants': 'NYG', 'Giants': 'NYG',
            'PHI': 'PHI', 'Philadelphia Eagles': 'PHI', 'Philadelphia': 'PHI',
            'WAS': 'WAS', 'Washington Commanders': 'WAS', 'Washington': 'WAS',
            
            # NFC North
            'CHI': 'CHI', 'Chicago Bears': 'CHI', 'Chicago': 'CHI',
            'DET': 'DET', 'Detroit Lions': 'DET', 'Detroit': 'DET',
            'GB': 'GB', 'Green Bay Packers': 'GB', 'Green Bay': 'GB',
            'MIN': 'MIN', 'Minnesota Vikings': 'MIN', 'Minnesota': 'MIN',
            
            # NFC South
            'ATL': 'ATL', 'Atlanta Falcons': 'ATL', 'Atlanta': 'ATL',
            'CAR': 'CAR', 'Carolina Panthers': 'CAR', 'Carolina': 'CAR',
            'NO': 'NO', 'New Orleans Saints': 'NO', 'New Orleans': 'NO',
            'TB': 'TB', 'Tampa Bay Buccaneers': 'TB', 'Tampa Bay': 'TB',
            
            # NFC West
            'ARI': 'ARI', 'Arizona Cardinals': 'ARI', 'Arizona': 'ARI',
            'LAR': 'LAR', 'Los Angeles Rams': 'LAR', 'LA Rams': 'LAR', 'Rams': 'LAR',
            'SF': 'SF', 'San Francisco 49ers': 'SF', 'San Francisco': 'SF',
            'SEA': 'SEA', 'Seattle Seahawks': 'SEA', 'Seattle': 'SEA'
        }

    def normalize_team_name(self, team_name):
        """Convert any team name format to SportsData.io abbreviation"""
        if not team_name:
            return None
            
        # Direct lookup
        if team_name in self.team_mappings:
            return self.team_mappings[team_name]
            
        # Try partial matches
        team_name_upper = team_name.upper()
        for key, value in self.team_mappings.items():
            if team_name_upper in key.upper() or key.upper() in team_name_upper:
                return value
        
        return team_name  # Return original if no match found

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

    def get_comprehensive_schedule_mappings(self):
        """Get comprehensive game date mappings from multiple seasons"""
        print("📊 Building comprehensive NFL schedule mappings...")
        
        game_mappings = {}
        seasons = ['2024', '2023', '2022']  # Check multiple seasons
        
        for season in seasons:
            print(f"📅 Processing {season} season...")
            schedule_data = self.make_api_request(f"scores/json/Schedules/{season}")
            
            if not schedule_data:
                continue
                
            for game in schedule_data:
                home_team = self.normalize_team_name(game.get('HomeTeam', ''))
                away_team = self.normalize_team_name(game.get('AwayTeam', ''))
                game_date = game.get('DateTime', '') or game.get('Date', '')
                
                if not all([home_team, away_team, game_date]):
                    continue
                
                try:
                    if 'T' in game_date:
                        date_obj = datetime.fromisoformat(game_date.replace('Z', '+00:00'))
                    else:
                        date_obj = datetime.strptime(game_date, '%Y-%m-%d')
                    
                    formatted_date = date_obj.strftime('%Y-%m-%d')
                    
                    # Create multiple key variations for better matching
                    variations = [
                        f"{home_team}_vs_{away_team}",
                        f"{away_team}_at_{home_team}", 
                        f"{home_team}_{away_team}",
                        f"{away_team}_{home_team}",
                        f"{home_team}-{away_team}",
                        f"{away_team}-{home_team}"
                    ]
                    
                    for key in variations:
                        game_mappings[key] = formatted_date
                        
                except Exception as e:
                    print(f"⚠️ Date parsing error: {e}")
                    continue
        
        print(f"✅ Created {len(game_mappings)} comprehensive game mappings")
        return game_mappings

    def update_all_nfl_dates(self):
        """Update ALL NFL records with missing dates using enhanced matching"""
        print("🔄 Updating ALL NFL game dates with enhanced matching...")
        
        # Get comprehensive mappings
        date_mappings = self.get_comprehensive_schedule_mappings()
        
        if not date_mappings:
            print("❌ No date mappings available")
            return
        
        # Get ALL NFL records with null dates
        result = self.supabase.table('player_game_stats').select(
            'id, stats, player_id'
        ).execute()
        
        if not result.data:
            print("❌ No game stats found")
            return
        
        # Get player team info
        player_result = self.supabase.table('players').select(
            'id, name, team, sport'
        ).eq('sport', 'NFL').execute()
        
        player_info = {p['id']: {'team': p['team'], 'name': p['name']} for p in player_result.data}
        
        updated_count = 0
        processed_count = 0
        
        for record in result.data:
            stats = record.get('stats', {})
            
            # Skip non-NFL records or records that already have dates
            if stats.get('sport') != 'NFL':
                continue
                
            if stats.get('game_date'):  # Skip records that already have dates
                continue
                
            processed_count += 1
            
            player_id = record['player_id']
            player_data = player_info.get(player_id, {})
            player_team = self.normalize_team_name(player_data.get('team', ''))
            opponent = self.normalize_team_name(stats.get('opponent', ''))
            home_or_away = stats.get('home_or_away', '')
            
            if not all([player_team, opponent]):
                continue
            
            # Generate all possible matching keys
            possible_keys = []
            
            if home_or_away == 'home':
                possible_keys.extend([
                    f"{player_team}_vs_{opponent}",
                    f"{player_team}_{opponent}",
                    f"{player_team}-{opponent}",
                    f"{opponent}_at_{player_team}"
                ])
            else:  # away
                possible_keys.extend([
                    f"{opponent}_vs_{player_team}",
                    f"{player_team}_at_{opponent}",
                    f"{opponent}_{player_team}",
                    f"{player_team}_{opponent}",
                    f"{opponent}-{player_team}",
                    f"{player_team}-{opponent}"
                ])
            
            # Try to find matching date
            found_date = None
            for key in possible_keys:
                if key in date_mappings:
                    found_date = date_mappings[key]
                    break
            
            if found_date:
                # Update the record
                updated_stats = stats.copy()
                updated_stats['game_date'] = found_date
                
                try:
                    self.supabase.table('player_game_stats').update({
                        'stats': updated_stats
                    }).eq('id', record['id']).execute()
                    
                    updated_count += 1
                    
                    if updated_count % 500 == 0:
                        print(f"📊 Updated {updated_count}/{processed_count} records...")
                        
                except Exception as e:
                    print(f"❌ Error updating record {record['id']}: {e}")
            else:
                if processed_count <= 10:  # Show first few mismatches for debugging
                    print(f"⚠️ No match: {player_data.get('name', 'Unknown')} ({player_team}) vs {opponent} ({home_or_away})")
        
        print(f"✅ Updated {updated_count} out of {processed_count} NFL records")
        return updated_count

    def verify_final_results(self):
        """Final verification of updates"""
        print("🔍 Final verification...")
        
        # Count remaining null dates
        null_count_result = self.supabase.from_('player_game_stats').select(
            'id', count='exact'
        ).eq('stats->>sport', 'NFL').is_('stats->>game_date', 'null').execute()
        
        # Count records with dates
        dated_count_result = self.supabase.from_('player_game_stats').select(
            'id', count='exact'
        ).eq('stats->>sport', 'NFL').not_.is_('stats->>game_date', 'null').execute()
        
        print(f"✅ NFL records still without dates: {null_count_result.count}")
        print(f"✅ NFL records with dates: {dated_count_result.count}")

if __name__ == "__main__":
    fixer = EnhancedNFLDateFixer()
    
    print("🏈 Enhanced NFL Game Date Fixer")
    print("=" * 60)
    
    # Update all NFL records
    updated_count = fixer.update_all_nfl_dates()
    
    print("\n" + "="*60)
    fixer.verify_final_results()
    
    print(f"\n🎯 Final Result: Updated {updated_count} NFL game records with dates")

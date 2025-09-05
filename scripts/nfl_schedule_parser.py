#!/usr/bin/env python3

import os
import re
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class NFLScheduleParser:
    def __init__(self):
        # Initialize Supabase
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        # 2024 NFL Schedule data extracted from provided text
        self.schedule_data = """
        September 5th: Ravens 20 - Chiefs 27
        September 6th: Packers 29 - Eagles 34
        September 8th: Steelers 18 - Falcons 10, Cardinals 28 - Bills 34, Titans 17 - Bears 24, Patriots 16 - Bengals 10, Texans 29 - Colts 27, Jaguars 17 - Dolphins 20, Panthers 10 - Saints 47, Vikings 28 - Giants 6, Raiders 10 - Chargers 22, Broncos 20 - Seahawks 26, Cowboys 33 - Browns 17, Commanders 20 - Buccaneers 37, Rams 20 - Lions 26
        September 9th: Jets 19 - 49ers 32
        September 12th: Bills 31 - Dolphins 10
        September 15th: Raiders 26 - Ravens 23, Chargers 26 - Panthers 3, Saints 44 - Cowboys 19, Buccaneers 20 - Lions 16, Colts 10 - Packers 16, Browns 18 - Jaguars 13, 49ers 17 - Vikings 23, Seahawks 23 - Patriots 20, Jets 24 - Titans 17, Giants 18 - Commanders 21, Rams 10 - Cardinals 41, Steelers 13 - Broncos 6, Bengals 25 - Chiefs 26, Bears 13 - Texans 19
        September 16th: Falcons 22 - Eagles 21
        September 19th: Patriots 3 - Jets 24
        September 22nd: Giants 21 - Browns 15, Bears 16 - Colts 21, Texans 7 - Vikings 34, Eagles 15 - Saints 12, Chargers 10 - Steelers 20, Broncos 26 - Buccaneers 7, Packers 30 - Titans 14, Panthers 36 - Raiders 22, Dolphins 3 - Seahawks 24, Lions 20 - Cardinals 13, Ravens 28 - Cowboys 25, 49ers 24 - Rams 27, Chiefs 22 - Falcons 17
        September 23rd: Jaguars 10 - Bills 47, Commanders 38 - Bengals 33
        September 26th: Cowboys 20 - Giants 15
        September 29th: Saints 24 - Falcons 26, Bengals 34 - Panthers 24, Rams 18 - Bears 24, Vikings 31 - Packers 29, Jaguars 20 - Texans 24, Steelers 24 - Colts 27, Broncos 10 - Jets 9, Eagles 16 - Buccaneers 33, Commanders 42 - Cardinals 14, Patriots 13 - 49ers 30, Chiefs 17 - Chargers 10, Browns 16 - Raiders 20, Bills 10 - Ravens 35
        September 30th: Titans 31 - Dolphins 12, Seahawks 29 - Lions 42
        October 3rd: Buccaneers 30 - Falcons 36
        October 6th: Jets 17 - Vikings 23, Panthers 10 - Bears 36, Ravens 41 - Bengals 38, Bills 20 - Texans 23, Colts 34 - Jaguars 37, Dolphins 15 - Patriots 10, Browns 13 - Commanders 34, Raiders 18 - Broncos 34, Cardinals 24 - 49ers 23, Packers 24 - Rams 19, Giants 29 - Seahawks 20, Cowboys 20 - Steelers 17
        October 7th: Saints 13 - Chiefs 26
        October 10th: 49ers 36 - Seahawks 24
        October 13th: Jaguars 16 - Bears 35, Commanders 23 - Ravens 30, Cardinals 13 - Packers 34, Texans 41 - Patriots 21, Buccaneers 51 - Saints 27, Browns 16 - Eagles 20, Colts 20 - Titans 17, Chargers 23 - Broncos 16, Steelers 32 - Raiders 13, Falcons 38 - Panthers 20, Lions 47 - Cowboys 9, Bengals 17 - Giants 7
        October 14th: Bills 23 - Jets 20
        October 17th: Broncos 33 - Saints 10
        October 20th: Patriots 16 - Jaguars 32, Seahawks 34 - Falcons 14, Titans 10 - Bills 34, Bengals 21 - Browns 14, Texans 22 - Packers 24, Dolphins 10 - Colts 16, Lions 31 - Vikings 29, Eagles 28 - Giants 3, Raiders 15 - Rams 20, Panthers 7 - Commanders 40, Chiefs 28 - 49ers 18, Jets 15 - Steelers 37
        October 21st: Ravens 41 - Buccaneers 31, Chargers 15 - Cardinals 17
        October 24th: Vikings 20 - Rams 30
        October 27th: Ravens 24 - Browns 29, Titans 14 - Lions 52, Colts 20 - Texans 23, Packers 30 - Jaguars 27, Cardinals 28 - Dolphins 27, Jets 22 - Patriots 25, Falcons 31 - Buccaneers 26, Eagles 37 - Bengals 17, Saints 8 - Chargers 26, Bills 31 - Seahawks 10, Bears 15 - Commanders 18, Panthers 14 - Broncos 28, Chiefs 27 - Raiders 20, Cowboys 24 - 49ers 30
        October 28th: Giants 18 - Steelers 26
        October 31st: Texans 13 - Jets 21
        November 3rd: Cowboys 21 - Falcons 27, Broncos 10 - Ravens 41, Dolphins 27 - Bills 30, Saints 22 - Panthers 23, Raiders 24 - Bengals 41, Chargers 27 - Browns 10, Commanders 27 - Giants 22, Patriots 17 - Titans 20, Bears 9 - Cardinals 29, Jaguars 23 - Eagles 28, Lions 24 - Packers 14, Rams 26 - Seahawks 20, Colts 13 - Vikings 21
        November 4th: Buccaneers 24 - Chiefs 30
        November 7th: Bengals 34 - Ravens 35
        November 10th: Giants 17 - Panthers 20, Patriots 19 - Bears 3, Bills 30 - Colts 20, Vikings 12 - Jaguars 7, Broncos 14 - Chiefs 16, Falcons 17 - Saints 20, 49ers 23 - Buccaneers 20, Steelers 28 - Commanders 27, Titans 17 - Chargers 27, Jets 6 - Cardinals 31, Eagles 34 - Cowboys 6, Lions 26 - Texans 23
        November 11th: Dolphins 23 - Rams 15
        November 14th: Commanders 18 - Eagles 26
        November 17th: Packers 20 - Bears 19, Jaguars 6 - Lions 52, Raiders 19 - Dolphins 34, Rams 28 - Patriots 22, Browns 14 - Saints 35, Ravens 16 - Steelers 18, Vikings 23 - Titans 13, Colts 28 - Jets 27, Falcons 6 - Broncos 38, Seahawks 20 - 49ers 17, Chiefs 21 - Bills 30, Bengals 27 - Chargers 34
        November 18th: Texans 34 - Cowboys 10
        November 21st: Steelers 19 - Browns 24
        November 24th: Chiefs 30 - Panthers 27, Vikings 30 - Bears 27, Titans 32 - Texans 27, Lions 24 - Colts 6, Patriots 15 - Dolphins 34, Buccaneers 30 - Giants 7, Cowboys 34 - Commanders 26, Broncos 29 - Raiders 19, 49ers 10 - Packers 38, Cardinals 6 - Seahawks 16, Eagles 37 - Rams 20
        November 25th: Ravens 30 - Chargers 23
        November 28th: Bears 20 - Lions 23, Giants 20 - Cowboys 27, Dolphins 17 - Packers 30
        November 29th: Raiders 17 - Chiefs 19
        December 1st: Chargers 17 - Falcons 13, Steelers 44 - Bengals 38, Texans 23 - Jaguars 20, Cardinals 22 - Vikings 23, Colts 25 - Patriots 24, Seahawks 26 - Jets 21, Titans 19 - Commanders 42, Buccaneers 26 - Panthers 23, Rams 21 - Saints 14, Eagles 24 - Ravens 19, 49ers 10 - Bills 35
        December 2nd: Browns 32 - Broncos 41
        December 5th: Packers 31 - Lions 34
        December 8th: Jets 26 - Dolphins 32, Falcons 21 - Vikings 42, Saints 14 - Giants 11, Panthers 16 - Eagles 22, Browns 14 - Steelers 27, Raiders 13 - Buccaneers 28, Jaguars 10 - Titans 6, Seahawks 30 - Cardinals 18, Bills 42 - Rams 44, Bears 13 - 49ers 38, Chargers 17 - Chiefs 19
        December 9th: Bengals 27 - Cowboys 20
        December 12th: Rams 12 - 49ers 6
        December 15th: Cowboys 30 - Panthers 14, Chiefs 21 - Browns 7, Dolphins 12 - Texans 20, Jets 32 - Jaguars 25, Commanders 20 - Saints 19, Ravens 35 - Giants 14, Bengals 37 - Titans 27, Patriots 17 - Cardinals 30, Colts 13 - Broncos 31, Bills 48 - Lions 42, Buccaneers 40 - Chargers 17, Steelers 13 - Eagles 27, Packers 30 - Seahawks 13
        December 16th: Bears 12 - Vikings 30, Falcons 15 - Raiders 9
        December 19th: Broncos 27 - Chargers 34
        December 21st: Texans 19 - Chiefs 27, Steelers 17 - Ravens 34
        December 22nd: Giants 7 - Falcons 34, Cardinals 30 - Panthers 36, Lions 34 - Bears 17, Titans 30 - Colts 38, Rams 19 - Jets 9, Eagles 33 - Commanders 36, Browns 6 - Bengals 24, Vikings 27 - Seahawks 24, Patriots 21 - Bills 24, Jaguars 14 - Raiders 19, 49ers 17 - Dolphins 29, Buccaneers 24 - Cowboys 26
        December 23rd: Saints 0 - Packers 34
        December 25th: Chiefs 29 - Steelers 10, Ravens 31 - Texans 2
        December 26th: Seahawks 6 - Bears 3
        December 28th: Chargers 40 - Patriots 7, Broncos 24 - Bengals 30, Cardinals 9 - Rams 13
        December 29th: Colts 33 - Giants 45, Jets 14 - Bills 40, Titans 13 - Jaguars 20, Raiders 25 - Saints 10, Panthers 14 - Buccaneers 48, Cowboys 7 - Eagles 41, Dolphins 20 - Browns 3, Packers 25 - Vikings 27, Falcons 24 - Commanders 30
        December 30th: Lions 40 - 49ers 34
        January 4th: Browns 10 - Ravens 35, Bengals 19 - Steelers 17
        January 5th: Panthers 44 - Falcons 38, Commanders 23 - Cowboys 19, Bears 24 - Packers 22, Jaguars 23 - Colts 26, Bills 16 - Patriots 23, Giants 13 - Eagles 20, Saints 19 - Buccaneers 27, Texans 23 - Titans 14, 49ers 24 - Cardinals 47, Chiefs 0 - Broncos 38, Seahawks 30 - Rams 25, Chargers 34 - Raiders 20, Dolphins 20 - Jets 32, Vikings 9 - Lions 31
        """

    def parse_schedule_to_mapping(self):
        """Parse the 2024 NFL schedule into team matchup mappings"""
        
        date_mappings = {}
        
        # Parse schedule data line by line
        lines = self.schedule_data.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Extract date
            date_match = re.match(r'(\w+ \d+(?:st|nd|rd|th)):', line)
            if not date_match:
                continue
            
            date_str = date_match.group(1)
            
            # Convert to proper date format
            try:
                # Handle different date formats
                if 'September' in date_str:
                    month = '2024-09'
                elif 'October' in date_str:
                    month = '2024-10'
                elif 'November' in date_str:
                    month = '2024-11'
                elif 'December' in date_str:
                    month = '2024-12'
                elif 'January' in date_str:
                    month = '2025-01'
                else:
                    continue
                
                # Extract day number
                day_match = re.search(r'(\d+)', date_str)
                if day_match:
                    day = day_match.group(1).zfill(2)
                    game_date = f"{month}-{day}"
                else:
                    continue
                
            except:
                continue
            
            # Parse games from the line
            game_part = line[len(date_match.group(0)):].strip()
            
            # Split multiple games by comma
            games = game_part.split(', ')
            
            for game in games:
                game = game.strip()
                
                # Parse team vs team format (e.g., "Ravens 20 - Chiefs 27")
                game_match = re.match(r'(\w+)\s+\d+\s*-\s*(\w+)\s+\d+', game)
                if game_match:
                    away_team = game_match.group(1)
                    home_team = game_match.group(2)
                    
                    # Create lookup keys
                    # Format: team_opponent_home/away
                    home_key = f"{home_team}_{away_team}_home"
                    away_key = f"{away_team}_{home_team}_away"
                    
                    date_mappings[home_key] = game_date
                    date_mappings[away_key] = game_date
                    
                    print(f"📅 {game_date}: {home_team} vs {away_team}")
        
        print(f"\n✅ Created {len(date_mappings)} game mappings from schedule")
        return date_mappings

    def update_nfl_game_dates(self):
        """Update NFL records with game dates from parsed schedule"""
        
        print("🏈 NFL Schedule Date Updater")
        print("="*50)
        
        # Get date mappings from parsed schedule
        date_mappings = self.parse_schedule_to_mapping()
        
        if not date_mappings:
            print("❌ No date mappings found")
            return 0
        
        # Get all NFL player game stats without dates
        print("\n🔍 Getting NFL records without dates...")
        result = self.supabase.table('player_game_stats').select('*').execute()
        
        if not result.data:
            print("❌ No records found")
            return 0
        
        # Get player team info
        players_result = self.supabase.table('players').select('id, team, sport').eq('sport', 'NFL').execute()
        player_teams = {p['id']: p['team'] for p in players_result.data}
        
        updated_count = 0
        checked_count = 0
        not_matched = []
        
        print("🔄 Processing NFL records...")
        
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
            
            if lookup_key in date_mappings:
                game_date = date_mappings[lookup_key]
                
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
                not_matched.append(lookup_key)
        
        print(f"\n✅ Updated {updated_count} out of {checked_count} NFL records")
        
        # Show some unmatched for debugging
        if not_matched:
            print(f"\n⚠️ {len(set(not_matched))} unique unmatched keys (first 10):")
            for key in list(set(not_matched))[:10]:
                print(f"   - {key}")
        
        return updated_count

    def verify_results(self):
        """Verify the final results"""
        print("\n" + "="*50)
        print("🔍 Final verification...")
        
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
    parser = NFLScheduleParser()
    
    # Update the dates
    updated = parser.update_nfl_game_dates()
    
    # Verify results
    parser.verify_results()
    
    print(f"\n🎯 Successfully updated {updated} NFL game records!")

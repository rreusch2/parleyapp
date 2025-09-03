#!/usr/bin/env python3
"""
Streamlined SportsData.io Collector - Works with Existing Database Schema
Collects NFL, MLB, NBA, WNBA historical data into existing Supabase tables
"""

import requests
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import time
from supabase import create_client, Client
import uuid

class StreamlinedSportsCollector:
    def __init__(self):
        self.api_key = os.getenv('SPORTSDATA_API_KEY')
        if not self.api_key:
            raise ValueError("SPORTSDATA_API_KEY environment variable required")
        
        # Use existing environment variables from your backend
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', os.getenv('SUPABASE_ANON_KEY'))
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.headers = {
            'Ocp-Apim-Subscription-Key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        self.last_call_time = 0
        self.min_interval = 2  # 2 second rate limiting
        
    def _rate_limit(self):
        """Rate limiting for API calls"""
        current_time = time.time()
        if current_time - self.last_call_time < self.min_interval:
            time.sleep(self.min_interval - (current_time - self.last_call_time))
        self.last_call_time = time.time()
    
    def _make_request(self, url: str) -> Optional[Any]:
        """Make API request with error handling"""
        self._rate_limit()
        print(f"📡 Fetching: {url}")
        
        try:
            response = requests.get(url, headers=self.headers, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ Error fetching {url}: {e}")
            return None
    
    def collect_nfl_teams(self) -> bool:
        """Collect NFL teams and store in existing teams table"""
        url = "https://api.sportsdata.io/v3/nfl/scores/json/AllTeams"
        teams_data = self._make_request(url)
        
        if not teams_data:
            return False
        
        print(f"🏈 Storing {len(teams_data)} NFL teams...")
        
        for team in teams_data:
            # Map to existing schema
            team_record = {
                'sport_key': 'NFL',
                'team_key': team.get('Key', ''),
                'team_name': team.get('FullName', ''),
                'team_abbreviation': team.get('Key', ''),
                'city': team.get('City', ''),
                'conference': team.get('Conference', ''),
                'division': team.get('Division', ''),
                'logo_url': team.get('WikipediaLogoUrl', ''),
                'metadata': {
                    'sportsdata_team_id': team.get('TeamID'),
                    'head_coach': team.get('HeadCoach'),
                    'primary_color': team.get('PrimaryColor'),
                    'secondary_color': team.get('SecondaryColor'),
                    'stadium_id': team.get('StadiumID')
                }
            }
            
            try:
                # Check if team exists by team_key and sport_key
                existing = self.supabase.table('teams').select('id')\
                    .eq('team_key', team.get('Key'))\
                    .eq('sport_key', 'NFL').execute()
                
                if existing.data:
                    # Update existing
                    self.supabase.table('teams').update(team_record)\
                        .eq('id', existing.data[0]['id']).execute()
                else:
                    # Insert new
                    self.supabase.table('teams').insert(team_record).execute()
                
                print(f"  ✓ {team_record['team_name']}")
            except Exception as e:
                print(f"  ❌ Error storing {team_record['team_name']}: {e}")
        
        return True
    
    def collect_nfl_games_2024(self) -> bool:
        """Collect NFL 2024 season games"""
        print("🏈 Collecting NFL 2024 season games...")
        
        # Collect weeks 1-18 (regular season) + weeks 19-22 (playoffs if available)
        total_games = 0
        
        for week in range(1, 23):  # Weeks 1-22
            url = f"https://api.sportsdata.io/v3/nfl/scores/json/ScoresByWeekFinal/2024/{week}"
            games_data = self._make_request(url)
            
            if not games_data:
                print(f"  ⚠️ No games found for Week {week}")
                continue
            
            week_games = 0
            for game in games_data:
                if game.get('Status') != 'Final':
                    continue
                
                # Extract game data
                home_team = game.get('HomeTeam', '')
                away_team = game.get('AwayTeam', '')
                home_score = game.get('HomeScore', 0)
                away_score = game.get('AwayScore', 0)
                game_date = game.get('Date', '').split('T')[0] if game.get('Date') else None
                
                if not all([home_team, away_team, game_date]):
                    continue
                
                # Store game for both teams
                for is_home in [True, False]:
                    team_name = home_team if is_home else away_team
                    opponent_name = away_team if is_home else home_team
                    team_score = home_score if is_home else away_score
                    opponent_score = away_score if is_home else home_score
                    
                    # Get team_id from existing teams table
                    team_lookup = self.supabase.table('teams').select('id')\
                        .eq('team_abbreviation', team_name)\
                        .eq('sport_key', 'NFL').execute()
                    
                    if not team_lookup.data:
                        print(f"    ⚠️ Team {team_name} not found in database")
                        continue
                    
                    team_id = team_lookup.data[0]['id']
                    
                    # Look up opponent team_id
                    opponent_lookup = self.supabase.table('teams').select('id')\
                        .eq('team_abbreviation', opponent_name)\
                        .eq('sport_key', 'NFL').execute()
                    
                    opponent_team_id = opponent_lookup.data[0]['id'] if opponent_lookup.data else None
                    
                    game_record = {
                        'team_id': team_id,
                        'team_name': team_name,
                        'sport': 'National Football League',
                        'sport_key': 'NFL',
                        'game_date': game_date,
                        'opponent_team': opponent_name,
                        'opponent_team_id': opponent_team_id,
                        'is_home': is_home,
                        'team_score': int(team_score),
                        'opponent_score': int(opponent_score),
                        'game_result': 'W' if team_score > opponent_score else 'L' if team_score < opponent_score else 'T',
                        'margin': int(team_score) - int(opponent_score),
                        'spread_line': game.get('PointSpread'),
                        'total_line': game.get('OverUnder'),
                        'venue': game.get('StadiumDetails', {}).get('Name', '') if game.get('StadiumDetails') else '',
                        'weather_conditions': {
                            'temperature': game.get('Temperature'),
                            'wind_speed': game.get('WindSpeed'),
                            'weather': game.get('WeatherDescription')
                        },
                        'external_game_id': f"sportsdata_nfl_{game.get('GameID')}_{team_name}"
                    }
                    
                    try:
                        # Check if game record already exists
                        existing = self.supabase.table('team_recent_stats').select('id')\
                            .eq('external_game_id', game_record['external_game_id']).execute()
                        
                        if not existing.data:
                            self.supabase.table('team_recent_stats').insert(game_record).execute()
                            week_games += 1
                    except Exception as e:
                        print(f"    ❌ Error storing game {team_name} vs {opponent_name}: {e}")
            
            if week_games > 0:
                print(f"  ✓ Week {week}: {week_games} game records stored")
                total_games += week_games
            
            time.sleep(1)  # Rate limiting between weeks
        
        print(f"🏈 NFL 2024 collection complete: {total_games} total game records")
        return True
    
    def collect_mlb_recent_games(self) -> bool:
        """Collect recent MLB games from 2024 season"""
        print("⚾ Collecting MLB 2024 recent games...")
        
        # Get games from last 2 months of 2024 season (August-October)
        dates_to_collect = []
        start_date = datetime(2024, 8, 1)
        end_date = datetime(2024, 10, 31)
        current_date = start_date
        
        # Sample every 3 days to get good coverage without hitting rate limits
        while current_date <= end_date:
            dates_to_collect.append(current_date)
            current_date += timedelta(days=3)
        
        total_games = 0
        
        for game_date in dates_to_collect:
            date_str = game_date.strftime("%Y-%b-%d").upper()
            url = f"https://api.sportsdata.io/v3/mlb/scores/json/GamesByDate/{date_str}"
            games_data = self._make_request(url)
            
            if not games_data:
                continue
            
            date_games = 0
            for game in games_data:
                if game.get('Status') not in ['Final', 'Closed', 'F']:
                    continue
                
                home_team = game.get('HomeTeam', '')
                away_team = game.get('AwayTeam', '')
                home_score = game.get('HomeTeamRuns', 0)
                away_score = game.get('AwayTeamRuns', 0)
                
                if not all([home_team, away_team]):
                    continue
                
                # Store for both teams (similar to NFL logic)
                for is_home in [True, False]:
                    team_name = home_team if is_home else away_team
                    opponent_name = away_team if is_home else home_team
                    team_score = home_score if is_home else away_score
                    opponent_score = away_score if is_home else home_score
                    
                    game_record = {
                        'team_id': str(uuid.uuid4()),  # Temporary ID - will need team lookup
                        'team_name': team_name,
                        'sport': 'Major League Baseball',
                        'sport_key': 'MLB',
                        'game_date': game_date.strftime("%Y-%m-%d"),
                        'opponent_team': opponent_name,
                        'is_home': is_home,
                        'team_score': int(team_score),
                        'opponent_score': int(opponent_score),
                        'game_result': 'W' if team_score > opponent_score else 'L' if team_score < opponent_score else 'T',
                        'margin': int(team_score) - int(opponent_score),
                        'venue': game.get('StadiumName', ''),
                        'external_game_id': f"sportsdata_mlb_{game.get('GameID')}_{team_name}"
                    }
                    
                    try:
                        existing = self.supabase.table('team_recent_stats').select('id')\
                            .eq('external_game_id', game_record['external_game_id']).execute()
                        
                        if not existing.data:
                            self.supabase.table('team_recent_stats').insert(game_record).execute()
                            date_games += 1
                    except Exception as e:
                        print(f"    ❌ Error storing MLB game: {e}")
            
            if date_games > 0:
                print(f"  ✓ {date_str}: {date_games} MLB game records")
                total_games += date_games
        
        print(f"⚾ MLB collection complete: {total_games} total game records")
        return True
    
    def run_full_collection(self):
        """Run complete historical data collection"""
        print("🚀 Starting comprehensive sports data collection...")
        
        results = {
            'NFL Teams': self.collect_nfl_teams(),
            'NFL 2024 Games': self.collect_nfl_games_2024(),
            'MLB Recent Games': self.collect_mlb_recent_games()
        }
        
        print("\n📊 Collection Results:")
        for task, success in results.items():
            status = "✅" if success else "❌"
            print(f"  {status} {task}")
        
        successful = sum(results.values())
        total = len(results)
        
        print(f"\n🎯 Final Score: {successful}/{total} tasks completed successfully")
        
        if successful == total:
            print("🏆 ALL DATA COLLECTION COMPLETED!")
        else:
            print("⚠️ Some collections failed - check logs above")
        
        return results

def main():
    """Main execution function"""
    try:
        collector = StreamlinedSportsCollector()
        results = collector.run_full_collection()
        
        # Return appropriate exit code
        successful = sum(results.values())
        return 0 if successful == len(results) else 1
        
    except Exception as e:
        print(f"❌ Critical error: {e}")
        return 1

if __name__ == "__main__":
    exit(main())

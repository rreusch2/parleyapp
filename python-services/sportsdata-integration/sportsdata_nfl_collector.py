#!/usr/bin/env python3
"""
SportsData.io NFL Historical Data Collector
Collects comprehensive NFL data including teams, players, games, and stats
"""

import requests
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import time
from supabase import create_client, Client

class SportsDataNFLCollector:
    def __init__(self):
        self.api_key = os.getenv('SPORTSDATA_API_KEY')
        if not self.api_key:
            raise ValueError("SPORTSDATA_API_KEY environment variable required")
        
        # Supabase setup
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_ANON_KEY')
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables required")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.base_url = "https://api.sportsdata.io/v3/nfl"
        self.headers = {
            'Ocp-Apim-Subscription-Key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        # Rate limiting - SportsData.io allows different intervals per endpoint
        self.last_call_time = 0
        self.min_interval = 1  # 1 second between calls to be safe
        
    def _rate_limit(self):
        """Ensure we don't exceed API rate limits"""
        current_time = time.time()
        if current_time - self.last_call_time < self.min_interval:
            time.sleep(self.min_interval - (current_time - self.last_call_time))
        self.last_call_time = time.time()
    
    def _make_request(self, endpoint: str) -> Optional[Dict[Any, Any]]:
        """Make rate-limited API request"""
        self._rate_limit()
        
        url = f"{self.base_url}{endpoint}"
        print(f"Fetching: {url}")
        
        try:
            response = requests.get(url, headers=self.headers, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching {url}: {e}")
            return None
    
    def get_current_season(self) -> int:
        """Get current NFL season year"""
        data = self._make_request("/scores/json/CurrentSeason")
        return data if data else 2024  # Fallback to 2024
    
    def get_teams(self) -> List[Dict[str, Any]]:
        """Get all NFL teams with full details"""
        return self._make_request("/scores/json/AllTeams") or []
    
    def get_season_schedule(self, season: str) -> List[Dict[str, Any]]:
        """Get complete season schedule"""
        return self._make_request(f"/scores/json/Schedules/{season}") or []
    
    def get_scores_by_week(self, season: str, week: int) -> List[Dict[str, Any]]:
        """Get scores for specific week"""
        return self._make_request(f"/scores/json/ScoresByWeekFinal/{season}/{week}") or []
    
    def get_player_stats_by_week(self, season: str, week: int) -> List[Dict[str, Any]]:
        """Get all player stats for a specific week"""
        return self._make_request(f"/stats/json/PlayerGameStatsByWeekFinal/{season}/{week}") or []
    
    def get_team_game_stats(self, season: str, week: int) -> List[Dict[str, Any]]:
        """Get team stats for specific week"""
        return self._make_request(f"/scores/json/TeamGameStats/{season}/{week}") or []
    
    def store_teams(self, teams_data: List[Dict[str, Any]]):
        """Store NFL teams in database"""
        for team in teams_data:
            team_record = {
                'sportsdata_team_id': team.get('TeamID'),
                'team_name': team.get('FullName'),
                'team_abbreviation': team.get('Key'),
                'city': team.get('City'),
                'sport_key': 'NFL',
                'conference': team.get('Conference'),
                'division': team.get('Division'),
                'metadata': {
                    'stadium_id': team.get('StadiumID'),
                    'head_coach': team.get('HeadCoach'),
                    'offensive_coordinator': team.get('OffensiveCoordinator'),
                    'defensive_coordinator': team.get('DefensiveCoordinator'),
                    'primary_color': team.get('PrimaryColor'),
                    'secondary_color': team.get('SecondaryColor'),
                    'website': team.get('WikipediaLogoUrl')
                }
            }
            
            try:
                # Check if team exists
                existing = self.supabase.table('teams').select('id').eq('sportsdata_team_id', team.get('TeamID')).execute()
                
                if existing.data:
                    # Update existing
                    self.supabase.table('teams').update(team_record).eq('sportsdata_team_id', team.get('TeamID')).execute()
                    print(f"Updated team: {team.get('FullName')}")
                else:
                    # Insert new
                    self.supabase.table('teams').insert(team_record).execute()
                    print(f"Inserted team: {team.get('FullName')}")
            except Exception as e:
                print(f"Error storing team {team.get('FullName')}: {e}")
    
    def store_team_games(self, games_data: List[Dict[str, Any]], season: str):
        """Store team game results in team_recent_stats table"""
        for game in games_data:
            if game.get('Status') != 'Final':
                continue
                
            # Store for home team
            home_team_record = {
                'sportsdata_game_id': game.get('GameID'),
                'team_name': game.get('HomeTeam'),
                'sport': 'National Football League',
                'sport_key': 'NFL',
                'game_date': game.get('Date', '').split('T')[0] if game.get('Date') else None,
                'opponent_team': game.get('AwayTeam'),
                'is_home': True,
                'team_score': game.get('HomeScore'),
                'opponent_score': game.get('AwayScore'),
                'game_result': 'W' if (game.get('HomeScore') or 0) > (game.get('AwayScore') or 0) else 'L',
                'margin': (game.get('HomeScore') or 0) - (game.get('AwayScore') or 0),
                'spread_line': game.get('PointSpread'),
                'total_line': game.get('OverUnder'),
                'venue': f"{game.get('StadiumDetails', {}).get('Name', '')}",
                'weather_conditions': {
                    'temperature': game.get('Temperature'),
                    'wind_speed': game.get('WindSpeed'),
                    'weather': game.get('WeatherDescription')
                },
                'external_game_id': f"sportsdata_{game.get('GameID')}",
                'season': season
            }
            
            # Store for away team  
            away_team_record = {
                'sportsdata_game_id': game.get('GameID'),
                'team_name': game.get('AwayTeam'),
                'sport': 'National Football League',
                'sport_key': 'NFL',
                'game_date': game.get('Date', '').split('T')[0] if game.get('Date') else None,
                'opponent_team': game.get('HomeTeam'),
                'is_home': False,
                'team_score': game.get('AwayScore'),
                'opponent_score': game.get('HomeScore'),
                'game_result': 'W' if (game.get('AwayScore') or 0) > (game.get('HomeScore') or 0) else 'L',
                'margin': (game.get('AwayScore') or 0) - (game.get('HomeScore') or 0),
                'spread_line': -game.get('PointSpread') if game.get('PointSpread') else None,
                'total_line': game.get('OverUnder'),
                'venue': f"{game.get('StadiumDetails', {}).get('Name', '')}",
                'weather_conditions': {
                    'temperature': game.get('Temperature'),
                    'wind_speed': game.get('WindSpeed'),
                    'weather': game.get('WeatherDescription')
                },
                'external_game_id': f"sportsdata_{game.get('GameID')}",
                'season': season
            }
            
            for record in [home_team_record, away_team_record]:
                try:
                    # Check if game record exists
                    existing = self.supabase.table('team_recent_stats').select('id')\
                        .eq('external_game_id', record['external_game_id'])\
                        .eq('team_name', record['team_name']).execute()
                    
                    if not existing.data:
                        self.supabase.table('team_recent_stats').insert(record).execute()
                        print(f"Stored game: {record['team_name']} vs {record['opponent_team']}")
                except Exception as e:
                    print(f"Error storing game for {record['team_name']}: {e}")
    
    def collect_season_data(self, season: str = "2024"):
        """Collect complete season data for NFL"""
        print(f"Starting NFL {season} season data collection...")
        
        # 1. Collect teams
        print("Collecting teams...")
        teams = self.get_teams()
        if teams:
            self.store_teams(teams)
            print(f"Stored {len(teams)} NFL teams")
        
        # 2. Collect games week by week (NFL regular season: weeks 1-18, playoffs: weeks 1-4)
        all_weeks = list(range(1, 19))  # Regular season weeks
        all_weeks.extend([19, 20, 21, 22])  # Playoff weeks (Wild Card, Divisional, Conference, Super Bowl)
        
        for week in all_weeks:
            print(f"\nCollecting Week {week} data...")
            
            # Get scores/games for this week
            games = self.get_scores_by_week(season, week)
            if games:
                self.store_team_games(games, season)
                print(f"Stored {len(games)} games for Week {week}")
            
            # Get player stats for this week
            player_stats = self.get_player_stats_by_week(season, week)
            if player_stats:
                # TODO: Store player stats in player_game_stats table
                print(f"Found {len(player_stats)} player stat records for Week {week}")
            
            # Rate limiting between weeks
            time.sleep(2)
        
        print(f"\n✅ NFL {season} season data collection complete!")
    
    def collect_last_10_games_all_teams(self):
        """Collect last 10 games for each NFL team"""
        print("Collecting last 10 games for all NFL teams...")
        
        # Start with 2024 season (most recent completed season)
        self.collect_season_data("2024")
        
        # If we need more recent data, we can add 2025 preseason
        # self.collect_season_data("2025PRE") 

def main():
    """Main execution function"""
    try:
        collector = SportsDataNFLCollector()
        
        # Collect comprehensive 2024 NFL season data
        collector.collect_season_data("2024")
        
        print("\n🏈 NFL historical data collection completed successfully!")
        
    except Exception as e:
        print(f"❌ Error in NFL data collection: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())

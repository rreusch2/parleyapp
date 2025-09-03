#!/usr/bin/env python3
"""
Universal SportsData.io Multi-Sport Data Collector
Handles NFL, MLB, NBA, WNBA, College Football data collection
"""

import requests
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import time
from supabase import create_client, Client
from multi_sport_config import SPORTSDATA_CONFIG, COLLECTION_PRIORITY, DATA_COLLECTION_SETTINGS

class UniversalSportsCollector:
    def __init__(self):
        self.api_key = os.getenv('SPORTSDATA_API_KEY')
        if not self.api_key:
            raise ValueError("SPORTSDATA_API_KEY environment variable required")
        
        # Supabase setup
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', os.getenv('SUPABASE_ANON_KEY'))
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables required")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.headers = {
            'Ocp-Apim-Subscription-Key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        self.last_call_time = 0
        self.min_interval = DATA_COLLECTION_SETTINGS['rate_limit_buffer']
        
    def _rate_limit(self):
        """Ensure we don't exceed API rate limits"""
        current_time = time.time()
        if current_time - self.last_call_time < self.min_interval:
            time.sleep(self.min_interval - (current_time - self.last_call_time))
        self.last_call_time = time.time()
    
    def _make_request(self, url: str, sport: str = None) -> Optional[Any]:
        """Make rate-limited API request with retry logic"""
        self._rate_limit()
        
        print(f"Fetching: {url}")
        
        for attempt in range(DATA_COLLECTION_SETTINGS['retry_attempts']):
            try:
                response = requests.get(url, headers=self.headers, timeout=30)
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                print(f"Attempt {attempt + 1} failed for {url}: {e}")
                if attempt < DATA_COLLECTION_SETTINGS['retry_attempts'] - 1:
                    time.sleep(DATA_COLLECTION_SETTINGS['retry_delay'])
                else:
                    print(f"All attempts failed for {url}")
                    return None
    
    def collect_teams(self, sport: str) -> bool:
        """Collect and store teams for a specific sport"""
        config = SPORTSDATA_CONFIG.get(sport)
        if not config:
            print(f"No configuration found for sport: {sport}")
            return False
        
        url = f"{config['base_url']}{config['endpoints']['teams']}"
        teams_data = self._make_request(url, sport)
        
        if not teams_data:
            print(f"Failed to collect teams for {sport}")
            return False
        
        print(f"Storing {len(teams_data)} {sport} teams...")
        
        for team in teams_data:
            team_record = {
                'sportsdata_team_id': team.get('TeamID'),
                'team_name': team.get('FullName') or team.get('Name'),
                'team_abbreviation': team.get('Key') or team.get('Abbreviation'),
                'city': team.get('City'),
                'sport_key': config['sport_key'],
                'conference': team.get('Conference'),
                'division': team.get('Division'),
                'logo_url': team.get('WikipediaLogoUrl') or team.get('LogoUrl'),
                'metadata': {
                    'stadium_id': team.get('StadiumID'),
                    'head_coach': team.get('HeadCoach'),
                    'primary_color': team.get('PrimaryColor'),
                    'secondary_color': team.get('SecondaryColor'),
                    'founded': team.get('Founded'),
                    'conference_losses': team.get('ConferenceLosses'),
                    'conference_wins': team.get('ConferenceWins'),
                    'global_team_id': team.get('GlobalTeamID')
                }
            }
            
            try:
                # Upsert team (insert or update)
                existing = self.supabase.table('teams').select('id')\
                    .eq('sportsdata_team_id', team.get('TeamID')).execute()
                
                if existing.data:
                    self.supabase.table('teams').update(team_record)\
                        .eq('sportsdata_team_id', team.get('TeamID')).execute()
                else:
                    self.supabase.table('teams').insert(team_record).execute()
                
                print(f"  ✓ {team_record['team_name']}")
            except Exception as e:
                print(f"  ❌ Error storing team {team_record.get('team_name')}: {e}")
        
        return True
    
    def collect_nfl_games(self, season: str = "2024") -> bool:
        """Collect NFL games by week"""
        config = SPORTSDATA_CONFIG['NFL']
        
        # Collect regular season games (weeks 1-18)
        for week in range(1, 19):
            url = f"{config['base_url']}{config['endpoints']['scores_by_week'].format(season=season, week=week)}"
            games_data = self._make_request(url, 'NFL')
            
            if games_data:
                self._store_games(games_data, 'NFL', season, week)
                print(f"  ✓ Stored {len(games_data)} games for Week {week}")
            
            time.sleep(1)  # Rate limiting between weeks
        
        return True
    
    def collect_mlb_games(self, season: str = "2024") -> bool:
        """Collect MLB games by date range"""
        config = SPORTSDATA_CONFIG['MLB']
        
        # Get games from April through September (typical MLB season)
        start_date = datetime(int(season), 4, 1)
        end_date = datetime(int(season), 10, 31)
        current_date = start_date
        
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%b-%d").upper()
            url = f"{config['base_url']}{config['endpoints']['scores_by_date'].format(date=date_str)}"
            games_data = self._make_request(url, 'MLB')
            
            if games_data:
                self._store_games(games_data, 'MLB', season, None, current_date)
                print(f"  ✓ Stored {len(games_data)} games for {date_str}")
            
            current_date += timedelta(days=7)  # Weekly collection to avoid rate limits
            time.sleep(1)
        
        return True
    
    def collect_basketball_games(self, sport: str, season: str = "2024") -> bool:
        """Collect NBA/WNBA games by date range"""
        config = SPORTSDATA_CONFIG[sport]
        
        # Basketball season typically runs October through June
        if sport == 'WNBA':
            # WNBA season: May through September 
            start_date = datetime(int(season), 5, 1)
            end_date = datetime(int(season), 9, 30)
        else:
            # NBA season: October through June
            start_date = datetime(int(season), 10, 1)
            end_date = datetime(int(season) + 1, 6, 30)
        
        current_date = start_date
        
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%b-%d").upper()
            url = f"{config['base_url']}{config['endpoints']['scores_by_date'].format(date=date_str)}"
            games_data = self._make_request(url, sport)
            
            if games_data:
                self._store_games(games_data, sport, season, None, current_date)
                print(f"  ✓ Stored {len(games_data)} {sport} games for {date_str}")
            
            current_date += timedelta(days=7)  # Weekly sampling
            time.sleep(1)
        
        return True
    
    def _store_games(self, games_data: List[Dict], sport: str, season: str, week: int = None, game_date: datetime = None):
        """Store game results in team_recent_stats table"""
        config = SPORTSDATA_CONFIG[sport]
        
        for game in games_data:
            # Skip non-final games
            if game.get('Status') not in ['Final', 'Closed', 'F']:
                continue
            
            # Extract game date
            if game_date:
                date_str = game_date.strftime("%Y-%m-%d")
            elif game.get('Date') or game.get('DateTime'):
                game_datetime = game.get('Date') or game.get('DateTime')
                date_str = game_datetime.split('T')[0] if 'T' in game_datetime else game_datetime[:10]
            else:
                continue
            
            # Get team names (different field names per sport)
            home_team = game.get('HomeTeam') or game.get('HomeTeamName') or game.get('HomeTeamCity')
            away_team = game.get('AwayTeam') or game.get('AwayTeamName') or game.get('AwayTeamCity')
            home_score = game.get('HomeScore') or game.get('HomeTeamScore') or 0
            away_score = game.get('AwayScore') or game.get('AwayTeamScore') or 0
            
            if not all([home_team, away_team]):
                continue
            
            # Store record for each team
            for is_home in [True, False]:
                team_name = home_team if is_home else away_team
                opponent_name = away_team if is_home else home_team
                team_score = home_score if is_home else away_score
                opponent_score = away_score if is_home else home_score
                
                record = {
                    'sportsdata_game_id': game.get('GameID') or game.get('ID'),
                    'team_name': team_name,
                    'sport': config['sport_name'],
                    'sport_key': config['sport_key'],
                    'game_date': date_str,
                    'opponent_team': opponent_name,
                    'is_home': is_home,
                    'team_score': int(team_score),
                    'opponent_score': int(opponent_score),
                    'game_result': 'W' if team_score > opponent_score else 'L' if team_score < opponent_score else 'T',
                    'margin': int(team_score) - int(opponent_score),
                    'spread_line': game.get('PointSpread') or game.get('Spread'),
                    'total_line': game.get('OverUnder') or game.get('Total'),
                    'venue': game.get('StadiumName') or game.get('Venue') or '',
                    'external_game_id': f"sportsdata_{sport}_{game.get('GameID', game.get('ID'))}",
                    'season': season,
                    'week': week
                }
                
                try:
                    # Check if record exists
                    existing = self.supabase.table('team_recent_stats').select('id')\
                        .eq('external_game_id', record['external_game_id'])\
                        .eq('team_name', record['team_name']).execute()
                    
                    if not existing.data:
                        self.supabase.table('team_recent_stats').insert(record).execute()
                except Exception as e:
                    print(f"    ❌ Error storing game for {team_name}: {e}")
    
    def collect_sport_data(self, sport: str, season: str = "2024") -> bool:
        """Collect comprehensive data for a specific sport"""
        print(f"\n🏆 Starting {sport} {season} season data collection...")
        
        # Step 1: Collect teams
        if not self.collect_teams(sport):
            return False
        
        # Step 2: Collect games based on sport type
        if sport == 'NFL':
            success = self.collect_nfl_games(season)
        elif sport == 'MLB':
            success = self.collect_mlb_games(season)
        elif sport in ['NBA', 'WNBA']:
            success = self.collect_basketball_games(sport, season)
        else:
            print(f"Game collection not implemented for {sport}")
            success = True  # Teams collected successfully
        
        if success:
            print(f"✅ {sport} {season} data collection completed!")
        else:
            print(f"❌ {sport} {season} data collection failed!")
        
        return success
    
    def collect_all_sports(self, season: str = "2024"):
        """Collect data for all configured sports in priority order"""
        print(f"🚀 Starting comprehensive multi-sport data collection for {season}")
        
        results = {}
        
        for sport in COLLECTION_PRIORITY:
            if sport in SPORTSDATA_CONFIG:
                try:
                    results[sport] = self.collect_sport_data(sport, season)
                except Exception as e:
                    print(f"❌ Error collecting {sport} data: {e}")
                    results[sport] = False
                
                # Rate limiting between sports
                time.sleep(5)
        
        # Summary
        print(f"\n📊 Multi-Sport Data Collection Summary:")
        for sport, success in results.items():
            status = "✅ SUCCESS" if success else "❌ FAILED"
            print(f"  {sport}: {status}")
        
        return results

def main():
    """Main execution function"""
    try:
        collector = UniversalSportsCollector()
        
        # Collect all sports data for 2024 season
        results = collector.collect_all_sports("2024")
        
        # Count successful collections
        successful = sum(1 for success in results.values() if success)
        total = len(results)
        
        print(f"\n🎯 Final Results: {successful}/{total} sports collected successfully")
        
        if successful == total:
            print("🏆 ALL SPORTS DATA COLLECTION COMPLETED SUCCESSFULLY!")
            return 0
        else:
            print("⚠️  Some sports failed - check logs above")
            return 1
        
    except Exception as e:
        print(f"❌ Critical error in multi-sport data collection: {e}")
        return 1

if __name__ == "__main__":
    exit(main())

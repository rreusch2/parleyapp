#!/usr/bin/env python3
"""
Real Sports Data Integration for ParleyApp
Connects to actual sports APIs for live data instead of mock data
"""

import os
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
from dataclasses import dataclass

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

@dataclass
class GameInfo:
    """Real game information from APIs"""
    game_id: str
    home_team: str
    away_team: str
    game_time: datetime
    sport: str
    season: str
    week: Optional[int] = None
    status: str = "scheduled"

@dataclass
class PlayerInfo:
    """Real player information"""
    player_id: str
    name: str
    team: str
    position: str
    injury_status: str = "healthy"
    stats: Dict = None

class TheSportsDBIntegration:
    """Integration with TheSportsDB API"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.base_url = "https://www.thesportsdb.com/api/v1/json"
        # Try multiple possible environment variable names
        self.api_key = api_key or os.getenv('THESPORTSDB_API_KEY') or os.getenv('API_SPORTS_KEY')
        
        # Free tier endpoints (no key needed for basic data)
        self.free_endpoints = {
            'leagues': f"{self.base_url}/1/all_leagues.php",
            'teams': f"{self.base_url}/1/search_all_teams.php",
            'players': f"{self.base_url}/1/searchplayers.php",
            'events': f"{self.base_url}/1/eventsround.php",
            'next_events': f"{self.base_url}/1/eventsnext.php",
            'player_stats': f"{self.base_url}/1/lookupplayer.php"
        }
        
        # Paid tier endpoints (require API key)
        if self.api_key:
            self.paid_endpoints = {
                'live_scores': f"{self.base_url}/{self.api_key}/livescore.php",
                'fixtures': f"{self.base_url}/{self.api_key}/eventsnextleague.php",
                'results': f"{self.base_url}/{self.api_key}/eventsround.php"
            }
    
    def get_league_id(self, sport: str) -> Optional[str]:
        """Get league ID for sport"""
        league_mapping = {
            'NBA': '4387',
            'NFL': '4391', 
            'MLB': '4424',
            'NHL': '4380',
            'EPL': '4328',  # English Premier League
            'UEFA': '4480'  # UEFA Champions League
        }
        return league_mapping.get(sport.upper())
    
    def get_today_games(self, sport: str) -> List[GameInfo]:
        """Get today's games for a sport"""
        league_id = self.get_league_id(sport)
        if not league_id:
            return []
        
        try:
            # Get next events for the league
            url = f"{self.base_url}/1/eventsnextleague.php"
            params = {'id': league_id}
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            games = []
            if data.get('events'):
                for event in data['events']:
                    # Parse date/time
                    event_date = event.get('dateEvent')
                    event_time = event.get('strTime', '00:00:00')
                    
                    if event_date:
                        try:
                            game_time = datetime.strptime(f"{event_date} {event_time}", "%Y-%m-%d %H:%M:%S")
                            
                            game = GameInfo(
                                game_id=event.get('idEvent'),
                                home_team=event.get('strHomeTeam'),
                                away_team=event.get('strAwayTeam'),
                                game_time=game_time,
                                sport=sport,
                                season=event.get('intRound', '2024'),
                                status=event.get('strStatus', 'scheduled')
                            )
                            games.append(game)
                        except ValueError:
                            continue
            
            return games
            
        except requests.RequestException as e:
            print(f"Error fetching games from TheSportsDB: {e}")
            return []
    
    def get_player_info(self, player_name: str) -> Optional[PlayerInfo]:
        """Get player information by name"""
        try:
            url = f"{self.base_url}/1/searchplayers.php"
            params = {'p': player_name}
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get('player') and len(data['player']) > 0:
                player_data = data['player'][0]
                
                return PlayerInfo(
                    player_id=player_data.get('idPlayer'),
                    name=player_data.get('strPlayer'),
                    team=player_data.get('strTeam'),
                    position=player_data.get('strPosition'),
                    injury_status="healthy"  # TheSportsDB doesn't provide injury status
                )
                
        except requests.RequestException as e:
            print(f"Error fetching player from TheSportsDB: {e}")
            
        return None
    
    def get_team_players(self, team_name: str) -> List[PlayerInfo]:
        """Get all players for a team"""
        try:
            url = f"{self.base_url}/1/searchplayers.php"
            params = {'t': team_name}
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            players = []
            if data.get('player'):
                for player_data in data['player']:
                    player = PlayerInfo(
                        player_id=player_data.get('idPlayer'),
                        name=player_data.get('strPlayer'),
                        team=player_data.get('strTeam'),
                        position=player_data.get('strPosition'),
                        injury_status="healthy"
                    )
                    players.append(player)
            
            return players
            
        except requests.RequestException as e:
            print(f"Error fetching team players from TheSportsDB: {e}")
            return []

class SportsRadarIntegration:
    """Integration with SportsRadar API"""
    
    def __init__(self, api_key: str):
        # Use the correct environment variable name from Reid's .env
        self.api_key = api_key or os.getenv('SPORTRADAR_API_KEY')
        self.base_url = "https://api.sportradar.us"
        
        # Sport-specific endpoints
        self.endpoints = {
            'NBA': {
                'games': f"{self.base_url}/nba/trial/v8/en/games/{{date}}/schedule.json",
                'player_profile': f"{self.base_url}/nba/trial/v8/en/players/{{player_id}}/profile.json",
                'team_roster': f"{self.base_url}/nba/trial/v8/en/teams/{{team_id}}/profile.json",
                'player_stats': f"{self.base_url}/nba/trial/v8/en/seasons/2023/REG/players/{{player_id}}/statistics.json"
            },
            'NFL': {
                'games': f"{self.base_url}/nfl/official/trial/v7/en/games/{{date}}/schedule.json",
                'player_profile': f"{self.base_url}/nfl/official/trial/v7/en/players/{{player_id}}/profile.json",
                'team_roster': f"{self.base_url}/nfl/official/trial/v7/en/teams/{{team_id}}/roster.json"
            },
            'MLB': {
                'games': f"{self.base_url}/mlb/trial/v7/en/games/{{date}}/schedule.json",
                'player_profile': f"{self.base_url}/mlb/trial/v7/en/players/{{player_id}}/profile.json"
            },
            'NHL': {
                'games': f"{self.base_url}/nhl/trial/v7/en/games/{{date}}/schedule.json",
                'player_profile': f"{self.base_url}/nhl/trial/v7/en/players/{{player_id}}/profile.json"
            }
        }
    
    def get_today_games(self, sport: str) -> List[GameInfo]:
        """Get today's games from SportsRadar"""
        if not self.api_key:
            print("SportsRadar API key required")
            return []
            
        today = datetime.now().strftime("%Y-%m-%d")
        
        try:
            endpoint = self.endpoints.get(sport.upper(), {}).get('games')
            if not endpoint:
                return []
                
            url = endpoint.format(date=today)
            params = {'api_key': self.api_key}
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            games = []
            games_data = data.get('games', [])
            
            for game in games_data:
                # Parse scheduled time
                scheduled = game.get('scheduled')
                game_time = datetime.fromisoformat(scheduled.replace('Z', '+00:00')) if scheduled else datetime.now()
                
                game_info = GameInfo(
                    game_id=game.get('id'),
                    home_team=game.get('home', {}).get('name'),
                    away_team=game.get('away', {}).get('name'),
                    game_time=game_time,
                    sport=sport,
                    season=str(datetime.now().year),
                    status=game.get('status', 'scheduled')
                )
                games.append(game_info)
            
            return games
            
        except requests.RequestException as e:
            print(f"Error fetching games from SportsRadar: {e}")
            return []
    
    def get_player_stats(self, sport: str, player_id: str, season: str = "2023") -> Dict:
        """Get detailed player statistics"""
        if not self.api_key:
            return {}
            
        try:
            endpoint = self.endpoints.get(sport.upper(), {}).get('player_stats')
            if not endpoint:
                return {}
                
            url = endpoint.format(player_id=player_id)
            params = {'api_key': self.api_key}
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            return data
            
        except requests.RequestException as e:
            print(f"Error fetching player stats from SportsRadar: {e}")
            return {}
    
    def get_injury_report(self, sport: str) -> Dict[str, str]:
        """Get injury report for all players"""
        # Note: SportsRadar injury reports require specific endpoints
        # This is a placeholder - you'd need the injury report endpoint
        return {}

class OddsAPIIntegration:
    """Integration with The Odds API for betting lines"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key or os.getenv('ODDS_API_KEY')
        self.base_url = "https://api.the-odds-api.com/v4"
    
    def get_betting_lines(self, sport: str) -> Dict[str, Any]:
        """Get current betting lines and odds"""
        if not self.api_key:
            return {}
        
        sport_mapping = {
            'NBA': 'basketball_nba',
            'NFL': 'americanfootball_nfl',
            'MLB': 'baseball_mlb',
            'NHL': 'icehockey_nhl'
        }
        
        odds_sport = sport_mapping.get(sport.upper())
        if not odds_sport:
            return {}
        
        try:
            url = f"{self.base_url}/sports/{odds_sport}/odds"
            params = {
                'api_key': self.api_key,
                'regions': 'us',
                'markets': 'h2h,spreads,totals',
                'oddsFormat': 'american',
                'dateFormat': 'iso'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            return response.json()
            
        except requests.RequestException as e:
            print(f"Error fetching odds from Odds API: {e}")
            return {}

class RealDataManager:
    """Manages real data integration from multiple sources"""
    
    def __init__(self, sportsradar_key: Optional[str] = None, thesportsdb_key: Optional[str] = None, odds_key: Optional[str] = None):
        self.sportsradar = SportsRadarIntegration(sportsradar_key) if sportsradar_key or os.getenv('SPORTRADAR_API_KEY') else None
        self.thesportsdb = TheSportsDBIntegration(thesportsdb_key)
        self.odds_api = OddsAPIIntegration(odds_key) if odds_key or os.getenv('ODDS_API_KEY') else None
    
    def get_live_games(self, sport: str) -> List[GameInfo]:
        """Get live games from available sources"""
        games = []
        
        # Try SportsRadar first (more detailed)
        if self.sportsradar:
            try:
                games.extend(self.sportsradar.get_today_games(sport))
            except Exception as e:
                print(f"SportsRadar API error: {e}")
        
        # Fall back to TheSportsDB if no SportsRadar data
        if not games:
            try:
                games.extend(self.thesportsdb.get_today_games(sport))
            except Exception as e:
                print(f"TheSportsDB API error: {e}")
        
        return games
    
    def get_player_data(self, player_name: str, sport: str) -> Optional[PlayerInfo]:
        """Get comprehensive player data"""
        # Try TheSportsDB for basic info
        player = self.thesportsdb.get_player_info(player_name)
        
        # Enhance with SportsRadar stats if available
        if player and self.sportsradar and player.player_id:
            stats = self.sportsradar.get_player_stats(sport, player.player_id)
            if stats:
                player.stats = stats
        
        return player
    
    def get_betting_odds(self, sport: str) -> Dict[str, Any]:
        """Get current betting odds and lines"""
        if self.odds_api:
            return self.odds_api.get_betting_lines(sport)
        return {}
    
    def validate_game_data(self, games: List[GameInfo]) -> List[GameInfo]:
        """Validate and filter game data"""
        valid_games = []
        now = datetime.now()
        
        for game in games:
            # Only include games within 24 hours
            if abs((game.game_time - now).total_seconds()) <= 86400:  # 24 hours
                # Ensure required fields are present
                if game.game_id and game.home_team and game.away_team:
                    valid_games.append(game)
        
        return valid_games

# Usage example
def setup_real_data_integration():
    """Set up real data integration with Reid's API keys"""
    
    # Get API keys from environment variables (now loaded from .env)
    sportsradar_key = os.getenv('SPORTRADAR_API_KEY')
    thesportsdb_key = os.getenv('API_SPORTS_KEY')  # Using API_SPORTS_KEY for TheSportsDB
    odds_key = os.getenv('ODDS_API_KEY')
    
    print(f"🔑 API Keys Status:")
    print(f"   SportsRadar: {'✅ Found' if sportsradar_key else '❌ Missing'}")
    print(f"   TheSportsDB: {'✅ Found' if thesportsdb_key else '❌ Missing'}")
    print(f"   Odds API: {'✅ Found' if odds_key else '❌ Missing'}")
    
    # Initialize data manager
    data_manager = RealDataManager(sportsradar_key, thesportsdb_key, odds_key)
    
    return data_manager

def test_real_data():
    """Test real data integration with Reid's APIs"""
    print("🏀 Testing Real Sports Data Integration with your API keys...")
    
    data_manager = setup_real_data_integration()
    
    # Test getting games for different sports
    sports = ['NBA', 'NFL', 'MLB', 'NHL']
    
    for sport in sports:
        print(f"\n=== {sport} Games ===")
        games = data_manager.get_live_games(sport)
        
        if games:
            for game in games[:3]:  # Show first 3 games
                print(f"{game.away_team} @ {game.home_team}")
                print(f"Time: {game.game_time}")
                print(f"Status: {game.status}")
                print("---")
            
            # Test betting odds for this sport
            odds = data_manager.get_betting_odds(sport)
            if odds:
                print(f"📊 Found betting lines for {len(odds)} games")
            else:
                print("📊 No betting lines found")
                
        else:
            print(f"No games found for {sport}")
    
    # Test player data
    print("\n=== Player Data Test ===")
    test_players = [
        ("Stephen Curry", "NBA"),
        ("Lamar Jackson", "NFL"),
        ("Aaron Judge", "MLB"),
        ("Connor McDavid", "NHL")
    ]
    
    for player_name, sport in test_players:
        player = data_manager.get_player_data(player_name, sport)
        if player:
            print(f"{player.name} - {player.team} ({player.position})")
        else:
            print(f"Player not found: {player_name}")

if __name__ == "__main__":
    test_real_data() 
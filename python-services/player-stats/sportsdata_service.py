#!/usr/bin/env python3
"""
SportsData.io API Service for Player Game Stats
Fetches MLB and WNBA player game data from SportsData.io API
"""

import os
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import time

class SportsDataService:
    def __init__(self):
        self.api_key = os.getenv('SPORTSDATA_API_KEY')
        if not self.api_key:
            raise ValueError("SPORTSDATA_API_KEY environment variable is required")
        
        self.base_urls = {
            'mlb': 'https://api.sportsdata.io/v3/mlb',
            'wnba': 'https://api.sportsdata.io/v3/wnba'
        }
        
        # Rate limiting: 1000 calls per month, be conservative
        self.rate_limit_delay = 1.0  # 1 second between calls
        
    def _make_request(self, url: str, params: Dict[str, Any] = None) -> Optional[Dict]:
        """Make API request with rate limiting and error handling"""
        if params is None:
            params = {}
        
        params['key'] = self.api_key
        
        try:
            time.sleep(self.rate_limit_delay)  # Rate limiting
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"API request failed: {e}")
            print(f"URL: {url}")
            print(f"Status Code: {getattr(e.response, 'status_code', 'N/A')}")
            return None
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            return None

    def get_mlb_player_season_stats(self, season: str = "2025") -> List[Dict]:
        """Get all MLB player season stats"""
        url = f"{self.base_urls['mlb']}/stats/json/PlayerSeasonStats/{season}"
        
        print(f"🏟️ Fetching MLB player season stats for {season}...")
        data = self._make_request(url)
        
        if data:
            print(f"✅ Retrieved {len(data)} MLB player season records")
            return data
        
        return []

    def get_mlb_player_game_logs(self, player_id: int, season: str = "2025", num_games: str = "10") -> List[Dict]:
        """Get recent game logs for specific MLB player"""
        url = f"{self.base_urls['mlb']}/stats/json/PlayerGameStatsBySeason/{season}/{player_id}/{num_games}"
        
        data = self._make_request(url)
        
        if data:
            print(f"✅ Retrieved {len(data)} game logs for MLB player {player_id}")
            return data
        
        return []

    def get_mlb_box_scores_by_date(self, date: str) -> List[Dict]:
        """Get MLB box scores for a specific date (format: 2025-AUG-27)"""
        url = f"{self.base_urls['mlb']}/stats/json/BoxScoresFinal/{date}"
        
        print(f"📊 Fetching MLB box scores for {date}...")
        data = self._make_request(url)
        
        if data:
            print(f"✅ Retrieved {len(data)} MLB box scores for {date}")
            return data
        
        return []

    def get_wnba_player_season_stats(self, season: str = "2025") -> List[Dict]:
        """Get all WNBA player season stats"""
        url = f"{self.base_urls['wnba']}/stats/json/PlayerSeasonStats/{season}"
        
        print(f"🏀 Fetching WNBA player season stats for {season}...")
        data = self._make_request(url)
        
        if data:
            print(f"✅ Retrieved {len(data)} WNBA player season records")
            return data
        
        return []

    def get_wnba_player_game_logs(self, player_id: int, season: str = "2025", num_games: str = "10") -> List[Dict]:
        """Get recent game logs for specific WNBA player"""
        url = f"{self.base_urls['wnba']}/stats/json/PlayerGameStatsBySeason/{season}/{player_id}/{num_games}"
        
        data = self._make_request(url)
        
        if data:
            print(f"✅ Retrieved {len(data)} game logs for WNBA player {player_id}")
            return data
        
        return []

    def get_wnba_box_scores_by_date(self, date: str) -> List[Dict]:
        """Get WNBA box scores for a specific date (format: 2025-AUG-27)"""
        url = f"{self.base_urls['wnba']}/stats/json/BoxScoresFinal/{date}"
        
        print(f"📊 Fetching WNBA box scores for {date}...")
        data = self._make_request(url)
        
        if data:
            print(f"✅ Retrieved {len(data)} WNBA box scores for {date}")
            return data
        
        return []

    def get_recent_dates(self, days: int = 10) -> List[str]:
        """Get list of recent dates in SportsData.io format (YYYY-MMM-DD)"""
        dates = []
        current_date = datetime.now()
        
        for i in range(days):
            date = current_date - timedelta(days=i)
            formatted_date = date.strftime("%Y-%b-%d").upper()  # 2025-AUG-27
            dates.append(formatted_date)
        
        return dates

    def get_date_range(self, start_date: str, end_date: str) -> List[str]:
        """Get date range in SportsData.io format"""
        dates = []
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        
        current = start
        while current <= end:
            formatted_date = current.strftime("%Y-%b-%d").upper()
            dates.append(formatted_date)
            current += timedelta(days=1)
        
        return dates

    def normalize_mlb_player_stats(self, player_data: Dict) -> Dict:
        """Normalize MLB player data to match our database structure"""
        return {
            'external_player_id': str(player_data.get('PlayerID', '')),
            'name': f"{player_data.get('Name', '')}",
            'team': player_data.get('Team', ''),
            'position': player_data.get('Position', ''),
            'sport': 'MLB',
            'active': player_data.get('Active', True)
        }

    def normalize_wnba_player_stats(self, player_data: Dict) -> Dict:
        """Normalize WNBA player data to match our database structure"""
        return {
            'external_player_id': str(player_data.get('PlayerID', '')),
            'name': f"{player_data.get('Name', '')}",
            'team': player_data.get('Team', ''),
            'position': player_data.get('Position', ''),
            'sport': 'WNBA',
            'active': player_data.get('Active', True)
        }

    def normalize_mlb_game_stats(self, game_data: Dict) -> Dict:
        """Normalize MLB game stats to match player_game_stats structure"""
        batting_stats = {
            'hits': int(game_data.get('Hits', 0) or 0),
            'home_runs': int(game_data.get('HomeRuns', 0) or 0),
            'rbis': int(game_data.get('RunsBattedIn', 0) or 0),
            'runs_scored': int(game_data.get('Runs', 0) or 0),
            'total_bases': int(game_data.get('TotalBases', 0) or 0),
            'stolen_bases': int(game_data.get('StolenBases', 0) or 0),
            'walks': int(game_data.get('Walks', 0) or 0),
            'strikeouts': int(game_data.get('Strikeouts', 0) or 0),
            'at_bats': int(game_data.get('AtBats', 0) or 0),
            'batting_average': float(game_data.get('BattingAverage', 0) or 0),
            'game_date': game_data.get('Day', ''),
            'opponent': game_data.get('Opponent', ''),
            'is_home': game_data.get('HomeOrAway') == 'HOME',
            'type': 'batting'
        }

        pitching_stats = {
            'strikeouts_pitched': int(game_data.get('PitchingStrikeouts', 0) or 0),
            'hits_allowed': int(game_data.get('PitchingHits', 0) or 0),
            'walks_allowed': int(game_data.get('PitchingWalks', 0) or 0),
            'earned_runs': int(game_data.get('EarnedRunAverage', 0) or 0),
            'innings_pitched': float(game_data.get('InningsPitchedDecimal', 0) or 0),
            'game_date': game_data.get('Day', ''),
            'opponent': game_data.get('Opponent', ''),
            'is_home': game_data.get('HomeOrAway') == 'HOME',
            'type': 'pitching'
        }

        # Return batting stats by default, pitching if no batting data
        if game_data.get('AtBats', 0) > 0:
            return batting_stats
        else:
            return pitching_stats

    def normalize_wnba_game_stats(self, game_data: Dict) -> Dict:
        """Normalize WNBA game stats to match player_game_stats structure"""
        return {
            'points': game_data.get('Points', 0),
            'rebounds': game_data.get('Rebounds', 0),
            'assists': game_data.get('Assists', 0),
            'steals': game_data.get('Steals', 0),
            'blocks': game_data.get('BlockedShots', 0),
            'turnovers': game_data.get('Turnovers', 0),
            'three_pointers': game_data.get('ThreePointersMade', 0),
            'minutes': game_data.get('Minutes', 0),
            'field_goal_percentage': game_data.get('FieldGoalsPercentage', 0),
            'three_point_percentage': game_data.get('ThreePointersPercentage', 0),
            'free_throw_percentage': game_data.get('FreeThrowsPercentage', 0),
            'game_date': game_data.get('Day', ''),
            'opponent': game_data.get('Opponent', ''),
            'is_home': game_data.get('HomeOrAway') == 'HOME',
            'type': 'basketball'
        }


if __name__ == "__main__":
    # Test the service
    service = SportsDataService()
    
    # Test recent dates
    recent_dates = service.get_recent_dates(5)
    print(f"Recent dates: {recent_dates}")
    
    # Test MLB box scores for yesterday
    if recent_dates:
        yesterday = recent_dates[1]  # Skip today, get yesterday
        box_scores = service.get_mlb_box_scores_by_date(yesterday)
        print(f"Box scores for {yesterday}: {len(box_scores) if box_scores else 0}")

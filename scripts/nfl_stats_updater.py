#!/usr/bin/env python3
"""
NFL Player Stats Updater using ESPN API
Focuses on offensive players + kickers for last 10 games
"""

import requests
import json
import time
from datetime import datetime, timedelta
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NFLStatsUpdater:
    def __init__(self):
        self.base_url = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl"
        self.core_url = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
        
    def get_player_gamelog(self, espn_player_id, limit=10):
        """Get player's recent game log from ESPN"""
        # Try multiple ESPN endpoint formats
        endpoints = [
            f"{self.base_url}/athletes/{espn_player_id}/gamelog",
            f"{self.base_url}/athletes/{espn_player_id}/stats",
            f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/{espn_player_id}/gamelog",
            f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/{espn_player_id}"
        ]
        
        for url in endpoints:
            try:
                logger.info(f"Trying endpoint: {url}")
                response = requests.get(url, headers=self.headers, timeout=10)
                response.raise_for_status()
                logger.info(f"✅ Success with endpoint: {url}")
                return response.json()
            except requests.exceptions.RequestException as e:
                logger.warning(f"Failed endpoint {url}: {e}")
                continue
        
        logger.error(f"All endpoints failed for player {espn_player_id}")
        return None
    
    def get_player_stats_for_season(self, espn_player_id, season=2025, season_type=2):
        """Get player stats for specific season (2=regular season)"""
        url = f"{self.core_url}/seasons/{season}/types/{season_type}/athletes/{espn_player_id}/statistics"
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get season stats for player {espn_player_id}: {e}")
            return None
    
    def get_week2_games(self):
        """Get all Week 2 games to find missing player stats"""
        url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=2"
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get Week 2 games: {e}")
            return None
    
    def extract_game_stats(self, gamelog_data):
        """Extract individual game stats from ESPN gamelog response"""
        if not gamelog_data or 'events' not in gamelog_data:
            return []
        
        game_stats = []
        
        for event in gamelog_data['events']:
            if not event.get('competitions') or not event['competitions'][0].get('competitors'):
                continue
                
            competition = event['competitions'][0]
            game_date = event.get('date', '')
            week = event.get('week', {}).get('number', 0)
            season = event.get('season', {}).get('year', 0)
            
            # Find player's team stats
            for competitor in competition['competitors']:
                if 'roster' in competitor:
                    for player in competitor['roster']:
                        if 'statistics' in player:
                            stats = self.parse_player_statistics(player['statistics'])
                            if stats:
                                stats.update({
                                    'game_date': game_date,
                                    'week': week,
                                    'season': season,
                                    'opponent_team': self.get_opponent_team(competition, competitor),
                                    'is_home': competitor.get('homeAway') == 'home'
                                })
                                game_stats.append(stats)
        
        return game_stats
    
    def parse_player_statistics(self, stats_list):
        """Parse ESPN player statistics into our format"""
        stats = {}
        
        for stat_group in stats_list:
            if 'stats' not in stat_group:
                continue
                
            for stat in stat_group['stats']:
                stat_name = stat.get('name', '').lower().replace(' ', '_')
                stat_value = stat.get('value', 0)
                
                # Map ESPN stat names to our format
                stat_mapping = {
                    'passing_yards': 'passing_yards',
                    'passing_touchdowns': 'passing_touchdowns', 
                    'interceptions': 'passing_interceptions',
                    'passing_attempts': 'passing_attempts',
                    'completions': 'passing_completions',
                    'rushing_yards': 'rushing_yards',
                    'rushing_touchdowns': 'rushing_touchdowns',
                    'rushing_attempts': 'rushing_attempts',
                    'receptions': 'receptions',
                    'receiving_yards': 'receiving_yards',
                    'receiving_touchdowns': 'receiving_touchdowns',
                    'targets': 'targets',
                    'field_goals_made': 'field_goals_made',
                    'field_goals_attempted': 'field_goals_attempted',
                    'extra_points_made': 'extra_points_made'
                }
                
                if stat_name in stat_mapping:
                    stats[stat_mapping[stat_name]] = stat_value
        
        return stats if stats else None
    
    def get_opponent_team(self, competition, player_team):
        """Get opponent team abbreviation"""
        for competitor in competition['competitors']:
            if competitor['id'] != player_team['id']:
                return competitor.get('team', {}).get('abbreviation', '')
        return ''
    
    def find_player_ids_from_games(self, week2_data):
        """Extract player IDs from Week 2 games to understand ESPN ID format"""
        logger.info("🔍 Analyzing Week 2 games to find player ID format...")
        
        player_count = 0
        sample_players = []
        
        for event in week2_data.get('events', []):
            if 'competitions' not in event:
                continue
                
            for competition in event['competitions']:
                for competitor in competition.get('competitors', []):
                    team_name = competitor.get('team', {}).get('displayName', '')
                    
                    # Look for Bengals to find Joe Burrow
                    if 'bengal' in team_name.lower() or 'cin' in competitor.get('team', {}).get('abbreviation', '').lower():
                        logger.info(f"Found Bengals team: {team_name}")
                        
                        # Try to get roster or stats for this team
                        team_id = competitor.get('team', {}).get('id', '')
                        if team_id:
                            self.explore_team_roster(team_id)
    
    def explore_team_roster(self, team_id):
        """Try to get team roster to find player ID format"""
        roster_urls = [
            f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{team_id}/roster",
            f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams/{team_id}/athletes",
            f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{team_id}"
        ]
        
        for url in roster_urls:
            try:
                logger.info(f"Trying roster endpoint: {url}")
                response = requests.get(url, headers=self.headers, timeout=10)
                response.raise_for_status()
                roster_data = response.json()
                
                logger.info("✅ Got roster data!")
                
                # Look for Joe Burrow in the roster
                if 'athletes' in roster_data:
                    for athlete in roster_data['athletes'][:5]:  # Check first 5 players
                        name = athlete.get('displayName', '')
                        player_id = athlete.get('id', '')
                        position = athlete.get('position', {}).get('abbreviation', '')
                        
                        logger.info(f"Player: {name} (ID: {player_id}, Pos: {position})")
                        
                        if 'burrow' in name.lower():
                            logger.info(f"🎯 FOUND JOE BURROW! ESPN ID: {player_id}")
                            # Test this ID with our gamelog function
                            self.test_burrow_id(player_id)
                            return
                
                break  # If we got roster data, stop trying other endpoints
                
            except Exception as e:
                logger.warning(f"Roster endpoint failed {url}: {e}")
                continue
    
    def test_burrow_id(self, player_id):
        """Test Joe Burrow's correct ESPN ID"""
        logger.info(f"🧪 Testing Joe Burrow's gamelog with ID: {player_id}")
        gamelog = self.get_player_gamelog(player_id)
        if gamelog:
            logger.info("🎉 SUCCESS! Found the correct ESPN player ID format!")
            logger.info(f"Burrow's ESPN ID: {player_id}")
        else:
            logger.error(f"Still failed with ID: {player_id}")

def analyze_burrow_data():
    """Analyze Joe Burrow's data structure"""
    updater = NFLStatsUpdater()
    
    logger.info("📊 Analyzing Joe Burrow's gamelog structure...")
    gamelog = updater.get_player_gamelog("4040715")  # Correct ESPN ID
    
    if gamelog:
        # Save the response for debugging
        with open('/Users/rreusch2/parleyapp/scripts/burrow_response.json', 'w') as f:
            json.dump(gamelog, f, indent=2)
        logger.info("💾 Saved ESPN response to burrow_response.json")
        
        logger.info("📋 Gamelog response structure:")
        logger.info(f"Top-level keys: {list(gamelog.keys())}")
        
        if 'events' in gamelog:
            events = gamelog['events']
            logger.info(f"Events type: {type(events)}")
            logger.info(f"Events length: {len(events) if hasattr(events, '__len__') else 'N/A'}")
            
            # Check if events is a list or dict
            if isinstance(events, list):
                logger.info("Events is a list")
                if len(events) > 0:
                    first_game = events[0]
                    logger.info(f"First game keys: {list(first_game.keys())}")
                else:
                    logger.warning("Events list is empty")
            elif isinstance(events, dict):
                logger.info("Events is a dictionary")
                logger.info(f"Events dict keys: {list(events.keys())}")
                # If it's a dict, maybe the games are under a specific key
                for key, value in events.items():
                    logger.info(f"Key '{key}': type={type(value)}, length={len(value) if hasattr(value, '__len__') else 'N/A'}")
                    if isinstance(value, list) and len(value) > 0:
                        logger.info(f"Sample item from '{key}': {list(value[0].keys()) if isinstance(value[0], dict) else type(value[0])}")
                        break
            else:
                logger.warning(f"Events is unexpected type: {type(events)}")
        else:
            logger.warning("No 'events' key in response")
        
        return True
    else:
        logger.error("Failed to get Burrow's gamelog data")
        return False

def test_espn_api():
    """Test ESPN API and analyze data structure"""
    # First analyze the data structure
    if analyze_burrow_data():
        logger.info("✅ ESPN API working and data structure understood!")
        return True
    else:
        logger.error("❌ ESPN API analysis failed")
        return False

if __name__ == "__main__":
    logger.info("🏈 Starting NFL Stats Updater")
    
    # Test ESPN API first
    if test_espn_api():
        logger.info("✅ ESPN API tests passed! Ready to update player stats.")
    else:
        logger.error("❌ ESPN API tests failed. Check network connection.")
#!/usr/bin/env python3
"""
Multi-Sport Player Stats Population Script
==========================================
Fetches individual game stats for all sports using appropriate SportsData.io APIs:
- MLB: PlayerGameStatsByDateFinal 
- NBA: PlayerGameStatsByDate
- NFL: PlayerGameStatsByWeek
- WNBA: PlayerGameStatsByDate
"""

import os
import sys
import logging
import requests
import time
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from supabase import create_client, Client

# Configuration
SPORTSDATA_API_KEY = "03d3518bdc1d468cba7855b6e1fcdfa6"
API_RATE_LIMIT = 1.0
MAX_CONCURRENT_REQUESTS = 3

# Sport-specific API configurations
SPORT_CONFIGS = {
    'MLB': {
        'base_url': 'https://api.sportsdata.io/v3/mlb/stats/json',
        'endpoint': 'PlayerGameStatsByDateFinal',
        'date_format': '%Y-%b-%d',
        'uses_dates': True,
        'sport_keys': ['MLB', 'BASEBALL_MLB']
    },
    'NBA': {
        'base_url': 'https://api.sportsdata.io/v3/nba/stats/json', 
        'endpoint': 'PlayerGameStatsByDate',
        'date_format': '%Y-%b-%d',
        'uses_dates': True,
        'sport_keys': ['NBA']
    },
    'NFL': {
        'base_url': 'https://api.sportsdata.io/v3/nfl/stats/json',
        'endpoint': 'PlayerGameStatsByWeek', 
        'date_format': None,
        'uses_dates': False,
        'sport_keys': ['NFL']
    },
    'WNBA': {
        'base_url': 'https://api.sportsdata.io/v3/wnba/stats/json',
        'endpoint': 'PlayerGameStatsByDate',
        'date_format': '%Y-%b-%d', 
        'uses_dates': True,
        'sport_keys': ['WNBA']
    }
}

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.error("Missing Supabase environment variables")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Rate limiting
LAST_REQUEST_TIME = {"time": 0}

def rate_limited_request(url: str, timeout: int = 30) -> Optional[List[Dict]]:
    """Make rate-limited API request"""
    current_time = time.time()
    time_since_last = current_time - LAST_REQUEST_TIME["time"]
    if time_since_last < API_RATE_LIMIT:
        time.sleep(API_RATE_LIMIT - time_since_last)
    
    try:
        response = requests.get(url, timeout=timeout)
        LAST_REQUEST_TIME["time"] = time.time()
        
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            logger.warning(f"Rate limit hit, waiting 60 seconds...")
            time.sleep(60)
            return rate_limited_request(url, timeout)
        else:
            logger.error(f"API request failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"Request error: {str(e)}")
        return None

def get_recent_dates_for_sport(sport: str, num_dates: int = 15) -> List[str]:
    """Get recent dates formatted for the sport's API"""
    config = SPORT_CONFIGS[sport]
    if not config['uses_dates']:
        return []
        
    dates = []
    current_date = datetime.now()
    
    for i in range(30):
        date = current_date - timedelta(days=i)
        date_str = date.strftime(config['date_format']).upper()
        dates.append(date_str)
        if len(dates) >= num_dates:
            break
    
    return dates

def get_nfl_recent_weeks(season: str = "2024", num_weeks: int = 5) -> List[Tuple[str, str]]:
    """Get recent NFL weeks"""
    weeks = []
    current_week = 15
    
    for week in range(max(1, current_week - num_weeks + 1), current_week + 1):
        weeks.append((season, str(week)))
    
    return weeks

def fetch_games_for_sport_date(sport: str, date_or_week: str, season: str = "2024") -> Optional[List[Dict]]:
    """Fetch games for a specific sport and date/week"""
    config = SPORT_CONFIGS[sport]
    base_url = config['base_url']
    endpoint = config['endpoint']
    
    if sport == 'NFL':
        url = f"{base_url}/{endpoint}/{season}/{date_or_week}?key={SPORTSDATA_API_KEY}"
    else:
        url = f"{base_url}/{endpoint}/{date_or_week}?key={SPORTSDATA_API_KEY}"
    
    logger.debug(f"Fetching {sport} games: {url}")
    return rate_limited_request(url)

def get_player_games_for_sport(sport: str, player_id: str, max_games: int = 10) -> List[Dict]:
    """Get individual game stats for a player in a specific sport"""
    player_games = []
    
    if sport == 'NFL':
        weeks = get_nfl_recent_weeks(num_weeks=8)
        for season, week in weeks:
            if len(player_games) >= max_games:
                break
                
            games_data = fetch_games_for_sport_date(sport, week, season)
            if not games_data:
                continue
                
            player_week_games = [
                game for game in games_data 
                if str(game.get('PlayerID', '')) == str(player_id)
            ]
            
            player_games.extend(player_week_games)
    else:
        dates = get_recent_dates_for_sport(sport, 15)
        for date_str in dates:
            if len(player_games) >= max_games:
                break
                
            games_data = fetch_games_for_sport_date(sport, date_str)
            if not games_data:
                continue
                
            player_date_games = [
                game for game in games_data 
                if str(game.get('PlayerID', '')) == str(player_id)
            ]
            
            player_games.extend(player_date_games)
    
    return player_games[:max_games]

def transform_sport_stats(sport: str, games_data: List[Dict], player_uuid: str) -> List[Dict]:
    """Transform sport-specific game data to our schema"""
    transformed_games = []
    
    for game in games_data:
        try:
            base_stats = {
                'external_game_id': str(game.get('GameID', '')),
                'game_date': game.get('Day', ''),
                'opponent_team': game.get('Opponent', ''),
                'is_home': game.get('HomeOrAway', '').lower() == 'home',
                'started': game.get('Started', 0) == 1,
                'position': game.get('Position', ''),
                'team': game.get('Team', ''),
                'is_game_over': game.get('IsGameOver', False),
                'injury_status': game.get('InjuryStatus', ''),
                'fantasy_points_yahoo': float(game.get('FantasyPointsYahoo', 0.0)),
                'fantasy_points_fanduel': float(game.get('FantasyPointsFanDuel', 0.0)),
                'fantasy_points_draftkings': float(game.get('FantasyPointsDraftKings', 0.0)),
            }
            
            if sport == 'MLB':
                sport_stats = {
                    'at_bats': int(game.get('AtBats', 0)),
                    'hits': int(game.get('Hits', 0)),
                    'home_runs': int(game.get('HomeRuns', 0)),
                    'rbis': int(game.get('RunsBattedIn', 0)),
                    'runs': int(game.get('Runs', 0)),
                    'walks': int(game.get('Walks', 0)),
                    'strikeouts': int(game.get('Strikeouts', 0)),
                    'stolen_bases': int(game.get('StolenBases', 0)),
                    'batting_average': float(game.get('BattingAverage', 0.0)),
                    'total_bases': int(game.get('TotalBases', 0)),
                }
            elif sport in ['NBA', 'WNBA']:
                sport_stats = {
                    'points': int(game.get('Points', 0)),
                    'rebounds': int(game.get('Rebounds', 0)),
                    'assists': int(game.get('Assists', 0)),
                    'steals': int(game.get('Steals', 0)),
                    'blocks': int(game.get('BlockedShots', 0)),
                    'turnovers': int(game.get('Turnovers', 0)),
                    'field_goals_made': int(game.get('FieldGoalsMade', 0)),
                    'field_goals_attempted': int(game.get('FieldGoalsAttempted', 0)),
                    'three_pointers_made': int(game.get('ThreePointersMade', 0)),
                    'minutes': float(game.get('Minutes', 0.0)),
                }
            elif sport == 'NFL':
                sport_stats = {
                    'passing_yards': int(game.get('PassingYards', 0)),
                    'passing_touchdowns': int(game.get('PassingTouchdowns', 0)),
                    'rushing_yards': int(game.get('RushingYards', 0)),
                    'rushing_touchdowns': int(game.get('RushingTouchdowns', 0)),
                    'receiving_yards': int(game.get('ReceivingYards', 0)),
                    'receiving_touchdowns': int(game.get('ReceivingTouchdowns', 0)),
                    'receptions': int(game.get('Receptions', 0)),
                    'targets': int(game.get('Targets', 0)),
                }
            else:
                sport_stats = {}
            
            stats_data = {**base_stats, **sport_stats, 'sport': sport}
            
            game_stat = {
                'player_id': player_uuid,
                'event_id': None,
                'stats': stats_data,
                'fantasy_points': float(game.get('FantasyPoints', 0.0)),
                'minutes_played': sport_stats.get('minutes', None),
                'betting_results': {},
                'created_at': datetime.now().isoformat()
            }
            
            transformed_games.append(game_stat)
            
        except Exception as e:
            logger.error(f"Error transforming {sport} game data: {str(e)}")
            continue
    
    return transformed_games

def get_players_for_sport(sport: str, limit: int = None) -> List[Dict]:
    """Get players for a specific sport"""
    try:
        config = SPORT_CONFIGS[sport]
        query = supabase.table('players_with_headshots') \
            .select('id, name, sport, external_player_id, team, position') \
            .in_('sport', config['sport_keys']) \
            .eq('active', True)
        
        if limit:
            query = query.limit(limit)
            
        result = query.execute()
        
        if result.data:
            valid_players = []
            for player in result.data:
                external_id = player.get('external_player_id', '')
                if external_id and external_id.isdigit():
                    valid_players.append(player)
            
            logger.info(f"Found {len(valid_players)} {sport} players with valid IDs")
            return valid_players
        else:
            return []
            
    except Exception as e:
        logger.error(f"Error fetching {sport} players: {str(e)}")
        return []

def store_player_game_stats(game_stats: List[Dict]) -> bool:
    """Store game stats in database"""
    if not game_stats:
        return True
    
    try:
        result = supabase.table('player_game_stats').insert(game_stats).execute()
        return bool(result.data)
    except Exception as e:
        logger.error(f"Error storing game stats: {str(e)}")
        return False

async def process_sport_player(semaphore: asyncio.Semaphore, sport: str, player: Dict) -> bool:
    """Process a single player for a specific sport"""
    async with semaphore:
        try:
            player_name = player['name']
            player_uuid = player['id']
            external_id = player.get('external_player_id', '')
            
            if not external_id or not external_id.isdigit():
                return False
            
            logger.info(f"Processing {sport} player: {player_name}")
            
            games_data = get_player_games_for_sport(sport, external_id, max_games=10)
            if not games_data:
                return False
            
            game_stats = transform_sport_stats(sport, games_data, player_uuid)
            success = store_player_game_stats(game_stats)
            
            if success:
                logger.info(f"Successfully processed {sport} player {player_name}: {len(game_stats)} games")
                return True
            else:
                return False
                
        except Exception as e:
            logger.error(f"Error processing {sport} player: {str(e)}")
            return False

async def process_sport(sport: str, limit: int = None):
    """Process all players for a specific sport"""
    logger.info(f"Starting {sport} player stats population...")
    
    players = get_players_for_sport(sport, limit)
    if not players:
        logger.warning(f"No {sport} players found")
        return
    
    logger.info(f"Processing {len(players)} {sport} players...")
    
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    tasks = [process_sport_player(semaphore, sport, player) for player in players]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    successful = sum(1 for r in results if r is True)
    failed = len(results) - successful
    success_rate = (successful / len(results)) * 100 if results else 0
    
    logger.info(f"{sport} completed: {successful}/{len(players)} success ({success_rate:.1f}%)")

async def main():
    """Main execution function"""
    logger.info("Starting multi-sport player stats population...")
    
    # Get command line arguments
    limit = None
    test_mode = False
    if len(sys.argv) > 1:
        if sys.argv[1] == "test":
            test_mode = True
            limit = 2
            logger.info("Running in test mode with 2 players per sport")
        else:
            try:
                limit = int(sys.argv[1])
                logger.info(f"Processing limited to {limit} players per sport")
            except ValueError:
                logger.error("Invalid limit argument. Using all players.")
    
    # Process each sport
    sports_to_process = ['NBA', 'NFL', 'WNBA']  # Skip MLB since it's already running
    
    for sport in sports_to_process:
        try:
            await process_sport(sport, limit=limit)
        except Exception as e:
            logger.error(f"Error processing {sport}: {str(e)}")
    
    logger.info("Multi-sport population completed!")

if __name__ == "__main__":
    asyncio.run(main())

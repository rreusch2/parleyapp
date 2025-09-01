#!/usr/bin/env python3
"""
Multi-Sport Player Stats Population Script
Comprehensive solution for MLB, NFL, NBA, WNBA player stats using SportsData.io
"""

import os
import sys
import logging
import requests
import time
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from supabase import create_client, Client
import threading

# Configuration
SPORTSDATA_API_KEY = "03d3518bdc1d468cba7855b6e1fcdfa6"

# Sport-specific API endpoints
SPORT_ENDPOINTS = {
    'MLB': "https://api.sportsdata.io/v3/mlb/stats/json",
    'NFL': "https://api.sportsdata.io/v3/nfl/stats/json", 
    'NBA': "https://api.sportsdata.io/v3/nba/stats/json",
    'WNBA': "https://api.sportsdata.io/v3/wnba/stats/json"
}

# Rate limiting configuration
API_RATE_LIMIT = 1.0  # 1 second between requests
MAX_CONCURRENT_REQUESTS = 3
REQUEST_LOCK = threading.Lock()
LAST_REQUEST_TIME = {"time": 0}

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://iriaegoipkjtktitpary.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyaWFlZ29pcGtqdGt0aXRwYXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODkxMTQzMiwiZXhwIjoyMDY0NDg3NDMyfQ.7gTP9UGDkNfIL2jatdP5xSLADJ29KZ1cRb2RGh20kE0")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/multi-sport-stats.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def rate_limited_request(url: str, timeout: int = 30) -> Optional[Dict]:
    """Make rate-limited API request to SportsData.io"""
    with REQUEST_LOCK:
        current_time = time.time()
        time_since_last = current_time - LAST_REQUEST_TIME["time"]
        if time_since_last < API_RATE_LIMIT:
            sleep_time = API_RATE_LIMIT - time_since_last
            time.sleep(sleep_time)
        
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
                
        except requests.exceptions.Timeout:
            logger.error(f"Request timeout for URL: {url}")
            return None
        except Exception as e:
            logger.error(f"Request error: {str(e)}")
            return None

def get_players_by_sport(sport: str, limit: int = None) -> List[Dict]:
    """Get players for a specific sport"""
    try:
        # Map sport names to database values
        sport_mapping = {
            'MLB': ['MLB', 'BASEBALL_MLB'],
            'NFL': ['NFL', 'FOOTBALL_NFL'],
            'NBA': ['NBA', 'BASKETBALL_NBA'],
            'WNBA': ['WNBA', 'BASKETBALL_WNBA']
        }
        
        sport_values = sport_mapping.get(sport, [sport])
        
        query = supabase.table('players').select('id, name, sport, external_player_id, team, position').in_('sport', sport_values).eq('active', True)
        
        if limit:
            query = query.limit(limit)
            
        result = query.execute()
        
        if result.data:
            # Filter for players with valid external IDs
            valid_players = []
            for player in result.data:
                external_id = player.get('external_player_id', '')
                if external_id and (external_id.isdigit() or 'sportsdata' in external_id.lower()):
                    valid_players.append(player)
            
            logger.info(f"Found {len(valid_players)} {sport} players with valid IDs out of {len(result.data)} total")
            return valid_players
        else:
            logger.error(f"No {sport} players found")
            return []
            
    except Exception as e:
        logger.error(f"Error fetching {sport} players: {str(e)}")
        return []

def fetch_recent_game_dates(sport: str, num_dates: int = 15) -> List[str]:
    """Get recent game dates for specific sport"""
    dates = []
    current_date = datetime.now()
    
    # Sport-specific date formatting
    if sport == 'MLB':
        # MLB uses YYYY-MMM-DD format (e.g., 2025-SEP-01)
        for i in range(30):
            date = current_date - timedelta(days=i)
            date_str = date.strftime("%Y-%b-%d").upper()
            dates.append(date_str)
            if len(dates) >= num_dates:
                break
    elif sport in ['NFL', 'NBA', 'WNBA']:
        # NFL/NBA/WNBA use YYYY-MMM-DD or YYYY-MM-DD format
        for i in range(30):
            date = current_date - timedelta(days=i)
            date_str = date.strftime("%Y-%m-%d")
            dates.append(date_str)
            if len(dates) >= num_dates:
                break
    
    return dates

def fetch_player_games_by_sport(sport: str, player_id: str, dates: List[str], max_games: int = 10) -> List[Dict]:
    """Fetch player games for specific sport"""
    base_url = SPORT_ENDPOINTS.get(sport)
    if not base_url:
        logger.error(f"No API endpoint configured for sport: {sport}")
        return []
    
    player_games = []
    
    for date_str in dates:
        if len(player_games) >= max_games:
            break
            
        # Sport-specific API endpoints
        if sport == 'MLB':
            url = f"{base_url}/PlayerGameStatsByDateFinal/{date_str}?key={SPORTSDATA_API_KEY}"
        elif sport == 'NFL':
            # NFL uses different endpoint structure
            url = f"{base_url}/PlayerGameStatsByWeek/{date_str}?key={SPORTSDATA_API_KEY}"
            continue  # Skip for now, NFL needs week-based logic
        elif sport in ['NBA', 'WNBA']:
            url = f"{base_url}/PlayerGameStatsByDate/{date_str}?key={SPORTSDATA_API_KEY}"
        else:
            continue
            
        logger.debug(f"Fetching {sport} games for date {date_str}")
        games_data = rate_limited_request(url)
        
        if not games_data:
            continue
            
        # Filter for this specific player
        player_date_games = [
            game for game in games_data 
            if str(game.get('PlayerID', '')) == str(player_id)
        ]
        
        player_games.extend(player_date_games)
        
        if len(player_games) >= max_games:
            player_games = player_games[:max_games]
            break
    
    return player_games

def transform_game_stats_by_sport(sport: str, games_data: List[Dict], player_uuid: str) -> List[Dict]:
    """Transform sport-specific game data to unified schema"""
    transformed_games = []
    
    for game in games_data:
        try:
            # Base stats structure
            stats_data = {
                'external_game_id': str(game.get('GameID', '')),
                'game_date': game.get('Day', ''),
                'opponent_team': game.get('Opponent', ''),
                'is_home': game.get('HomeOrAway', '').lower() == 'home',
                'started': game.get('Started', 0) == 1,
                'team': game.get('Team', ''),
                'position': game.get('Position', ''),
            }
            
            # Sport-specific stats
            if sport == 'MLB':
                stats_data.update({
                    'at_bats': int(game.get('AtBats', 0)),
                    'hits': int(game.get('Hits', 0)),
                    'doubles': int(game.get('Doubles', 0)),
                    'triples': int(game.get('Triples', 0)),
                    'home_runs': int(game.get('HomeRuns', 0)),
                    'rbis': int(game.get('RunsBattedIn', 0)),
                    'runs': int(game.get('Runs', 0)),
                    'walks': int(game.get('Walks', 0)),
                    'strikeouts': int(game.get('Strikeouts', 0)),
                    'stolen_bases': int(game.get('StolenBases', 0)),
                    'batting_average': float(game.get('BattingAverage', 0.0)),
                    'slugging_percentage': float(game.get('SluggingPercentage', 0.0)),
                    'on_base_percentage': float(game.get('OnBasePercentage', 0.0)),
                    'innings_pitched': float(game.get('InningsPitchedDecimal', 0.0)),
                    'earned_runs': int(game.get('PitchingEarnedRuns', 0)),
                    'strikeouts_pitched': int(game.get('PitchingStrikeouts', 0)),
                    'era': float(game.get('EarnedRunAverage', 0.0))
                })
            elif sport in ['NBA', 'WNBA']:
                stats_data.update({
                    'minutes': int(game.get('Minutes', 0)),
                    'points': int(game.get('Points', 0)),
                    'rebounds': int(game.get('Rebounds', 0)),
                    'assists': int(game.get('Assists', 0)),
                    'steals': int(game.get('Steals', 0)),
                    'blocks': int(game.get('BlockedShots', 0)),
                    'turnovers': int(game.get('Turnovers', 0)),
                    'field_goals_made': int(game.get('FieldGoalsMade', 0)),
                    'field_goals_attempted': int(game.get('FieldGoalsAttempted', 0)),
                    'three_pointers_made': int(game.get('ThreePointersMade', 0)),
                    'three_pointers_attempted': int(game.get('ThreePointersAttempted', 0)),
                    'free_throws_made': int(game.get('FreeThrowsMade', 0)),
                    'free_throws_attempted': int(game.get('FreeThrowsAttempted', 0)),
                    'field_goal_percentage': float(game.get('FieldGoalPercentage', 0.0)),
                    'three_point_percentage': float(game.get('ThreePointPercentage', 0.0)),
                    'free_throw_percentage': float(game.get('FreeThrowPercentage', 0.0))
                })
            elif sport == 'NFL':
                stats_data.update({
                    'passing_yards': int(game.get('PassingYards', 0)),
                    'passing_touchdowns': int(game.get('PassingTouchdowns', 0)),
                    'interceptions': int(game.get('PassingInterceptions', 0)),
                    'rushing_yards': int(game.get('RushingYards', 0)),
                    'rushing_touchdowns': int(game.get('RushingTouchdowns', 0)),
                    'receiving_yards': int(game.get('ReceivingYards', 0)),
                    'receiving_touchdowns': int(game.get('ReceivingTouchdowns', 0)),
                    'receptions': int(game.get('Receptions', 0)),
                    'targets': int(game.get('Targets', 0)),
                    'tackles': int(game.get('Tackles', 0)),
                    'sacks': float(game.get('Sacks', 0.0)),
                    'interceptions_defense': int(game.get('InterceptionDefense', 0))
                })
            
            # Add fantasy points
            fantasy_points = float(game.get('FantasyPoints', 0.0))
            if not fantasy_points:
                fantasy_points = float(game.get('FantasyPointsDraftKings', 0.0))
            
            # Create game stat record
            game_stat = {
                'player_id': player_uuid,
                'event_id': None,
                'stats': stats_data,
                'fantasy_points': fantasy_points,
                'minutes_played': stats_data.get('minutes') if sport in ['NBA', 'WNBA'] else None,
                'betting_results': {},
                'created_at': datetime.now().isoformat()
            }
            
            transformed_games.append(game_stat)
            
        except Exception as e:
            logger.error(f"Error transforming {sport} game data: {str(e)}")
            continue
    
    return transformed_games

def store_player_game_stats(game_stats: List[Dict]) -> bool:
    """Store player game stats in database"""
    try:
        if not game_stats:
            return True
            
        batch_size = 100
        for i in range(0, len(game_stats), batch_size):
            batch = game_stats[i:i + batch_size]
            result = supabase.table('player_game_stats').insert(batch).execute()
            
            if result.data:
                logger.debug(f"Successfully inserted batch of {len(batch)} game stats")
            else:
                logger.error(f"Failed to insert game stats batch: {result}")
                return False
        
        return True
        
    except Exception as e:
        logger.error(f"Error storing game stats: {str(e)}")
        return False

def calculate_sport_trends(sport: str, player_uuid: str, player_name: str) -> Dict:
    """Calculate sport-specific trend data"""
    try:
        result = supabase.table('player_game_stats') \
            .select('*') \
            .eq('player_id', player_uuid) \
            .order('created_at', desc=True) \
            .limit(10) \
            .execute()
        
        games = result.data
        if not games:
            return {}
        
        game_stats = [game.get('stats', {}) for game in games if game.get('stats')]
        if not game_stats:
            return {}
        
        recent_count = len(game_stats)
        
        # Calculate sport-specific trends
        if sport == 'MLB':
            trends = calculate_mlb_trends(game_stats, player_uuid, player_name, recent_count)
        elif sport in ['NBA', 'WNBA']:
            trends = calculate_basketball_trends(game_stats, player_uuid, player_name, recent_count, sport)
        elif sport == 'NFL':
            trends = calculate_nfl_trends(game_stats, player_uuid, player_name, recent_count)
        else:
            return {}
        
        return trends
        
    except Exception as e:
        logger.error(f"Error calculating {sport} trends for player {player_uuid}: {str(e)}")
        return {}

def calculate_mlb_trends(game_stats: List[Dict], player_uuid: str, player_name: str, recent_count: int) -> Dict:
    """Calculate MLB-specific trends"""
    def get_stat_avg(stat_key):
        values = [g.get(stat_key, 0) for g in game_stats if g.get(stat_key) is not None]
        return round(sum(values) / max(len(values), 1), 2) if values else 0
    
    return {
        'player_id': player_uuid,
        'player_name': player_name,
        'sport_key': 'MLB',
        'games_played': recent_count,
        'avg_hits': get_stat_avg('hits'),
        'avg_home_runs': get_stat_avg('home_runs'),
        'avg_rbis': get_stat_avg('rbis'),
        'avg_runs': get_stat_avg('runs'),
        'avg_strikeouts': get_stat_avg('strikeouts'),
        'batting_average': get_stat_avg('batting_average'),
        'slugging_percentage': get_stat_avg('slugging_percentage'),
        'on_base_percentage': get_stat_avg('on_base_percentage'),
        'trend_direction': 'stable',
        'confidence_score': min(recent_count * 10, 100),
        'last_updated': datetime.now().isoformat()
    }

def calculate_basketball_trends(game_stats: List[Dict], player_uuid: str, player_name: str, recent_count: int, sport: str) -> Dict:
    """Calculate NBA/WNBA trends"""
    def get_stat_avg(stat_key):
        values = [g.get(stat_key, 0) for g in game_stats if g.get(stat_key) is not None]
        return round(sum(values) / max(len(values), 1), 2) if values else 0
    
    return {
        'player_id': player_uuid,
        'player_name': player_name,
        'sport_key': sport,
        'games_played': recent_count,
        'avg_points': get_stat_avg('points'),
        'avg_rebounds': get_stat_avg('rebounds'),
        'avg_assists': get_stat_avg('assists'),
        'avg_steals': get_stat_avg('steals'),
        'avg_blocks': get_stat_avg('blocks'),
        'field_goal_percentage': get_stat_avg('field_goal_percentage'),
        'three_point_percentage': get_stat_avg('three_point_percentage'),
        'free_throw_percentage': get_stat_avg('free_throw_percentage'),
        'trend_direction': 'stable',
        'confidence_score': min(recent_count * 10, 100),
        'last_updated': datetime.now().isoformat()
    }

def calculate_nfl_trends(game_stats: List[Dict], player_uuid: str, player_name: str, recent_count: int) -> Dict:
    """Calculate NFL trends"""
    def get_stat_avg(stat_key):
        values = [g.get(stat_key, 0) for g in game_stats if g.get(stat_key) is not None]
        return round(sum(values) / max(len(values), 1), 2) if values else 0
    
    return {
        'player_id': player_uuid,
        'player_name': player_name,
        'sport_key': 'NFL',
        'games_played': recent_count,
        'avg_passing_yards': get_stat_avg('passing_yards'),
        'avg_rushing_yards': get_stat_avg('rushing_yards'),
        'avg_receiving_yards': get_stat_avg('receiving_yards'),
        'avg_receptions': get_stat_avg('receptions'),
        'avg_touchdowns': get_stat_avg('passing_touchdowns') + get_stat_avg('rushing_touchdowns') + get_stat_avg('receiving_touchdowns'),
        'trend_direction': 'stable',
        'confidence_score': min(recent_count * 10, 100),
        'last_updated': datetime.now().isoformat()
    }

def store_player_trends(trend_data: Dict) -> bool:
    """Store player trend data"""
    try:
        if not trend_data:
            return True
            
        result = supabase.table('player_trends_data').upsert(trend_data).execute()
        
        if result.data:
            logger.debug(f"Successfully stored trends for player {trend_data.get('player_name')}")
            return True
        else:
            logger.error(f"Failed to store trends: {result}")
            return False
            
    except Exception as e:
        logger.error(f"Error storing trends: {str(e)}")
        return False

async def process_sport_player(semaphore: asyncio.Semaphore, sport: str, player: Dict, recent_dates: List[str]) -> bool:
    """Process a single player for specific sport"""
    async with semaphore:
        try:
            player_name = player['name']
            player_uuid = player['id']
            external_id = player.get('external_player_id', '')
            
            if not external_id or not external_id.isdigit():
                logger.warning(f"No valid external ID for {sport} player: {player_name}")
                return False
            
            logger.info(f"Processing {sport} player: {player_name} - ID: {external_id}")
            
            # Get player's recent games
            games_data = fetch_player_games_by_sport(sport, external_id, recent_dates, max_games=10)
            if not games_data:
                logger.warning(f"No games data found for {sport} player: {player_name}")
                return False
            
            logger.info(f"Found {len(games_data)} games for {sport} player {player_name}")
            
            # Transform and store game stats
            game_stats = transform_game_stats_by_sport(sport, games_data, player_uuid)
            success = store_player_game_stats(game_stats)
            
            if not success:
                logger.error(f"Failed to store game stats for {sport} player {player_name}")
                return False
            
            # Calculate and store trends
            trends_data = calculate_sport_trends(sport, player_uuid, player_name)
            if trends_data:
                trends_success = store_player_trends(trends_data)
                if not trends_success:
                    logger.warning(f"Failed to store trends for {sport} player {player_name}")
            
            logger.info(f"Successfully processed {sport} player {player_name}: {len(game_stats)} games")
            return True
            
        except Exception as e:
            logger.error(f"Error processing {sport} player {player.get('name', 'unknown')}: {str(e)}")
            return False

async def process_sport(sport: str, limit: int = None):
    """Process all players for a specific sport"""
    logger.info(f"Starting {sport} player stats population...")
    
    # Get players for this sport
    players = get_players_by_sport(sport, limit)
    if not players:
        logger.error(f"No {sport} players found to process")
        return
    
    logger.info(f"Processing {len(players)} {sport} players...")
    
    # Get recent dates for this sport
    recent_dates = fetch_recent_game_dates(sport, 15)
    logger.info(f"Using {len(recent_dates)} recent dates for {sport}")
    
    # Process players with concurrency control
    semaphore = asyncio.Semaphore(2)  # Limit concurrent API calls per sport
    tasks = [process_sport_player(semaphore, sport, player, recent_dates) for player in players]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Calculate statistics
    successful = sum(1 for r in results if r is True)
    failed = len(results) - successful
    success_rate = (successful / len(results)) * 100 if results else 0
    
    logger.info(f"{sport} Results: {successful}/{len(players)} successful ({success_rate:.1f}%)")

async def main():
    """Main execution function"""
    logger.info("Starting multi-sport player stats population...")
    
    # Parse command line arguments
    sports_to_process = ['MLB']  # Default to MLB only
    limit = None
    
    if len(sys.argv) > 1:
        if sys.argv[1].lower() == 'all':
            sports_to_process = ['MLB', 'NBA', 'WNBA']  # Skip NFL for now due to complexity
        else:
            sports_to_process = [arg.upper() for arg in sys.argv[1:] if arg.upper() in SPORT_ENDPOINTS]
        
        # Check for limit argument
        for arg in sys.argv[1:]:
            if arg.isdigit():
                limit = int(arg)
                break
    
    logger.info(f"Processing sports: {sports_to_process}")
    if limit:
        logger.info(f"Limited to {limit} players per sport")
    
    # Process each sport
    for sport in sports_to_process:
        await process_sport(sport, limit)
        logger.info(f"Completed {sport} processing\n")
    
    logger.info("Multi-sport player stats population completed!")

if __name__ == "__main__":
    asyncio.run(main())

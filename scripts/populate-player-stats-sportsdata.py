#!/usr/bin/env python3
"""
Optimal SportsData.io Player Stats Population Script
==================================================
Efficiently fetches last 10 games for all players using SportsData.io API
and populates player_game_stats and player_trends_data tables.
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
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/mlb/stats/json"

# Rate limiting configuration
API_RATE_LIMIT = 1.0  # 1 second between requests to respect API limits
MAX_CONCURRENT_REQUESTS = 3  # Conservative concurrent requests
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
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/player-stats-population.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def rate_limited_request(url: str, timeout: int = 30) -> Optional[Dict]:
    """Make rate-limited API request to SportsData.io"""
    with REQUEST_LOCK:
        # Ensure minimum time between requests
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

def get_sportsdata_player_id(player: Dict) -> Optional[str]:
    """Extract SportsData.io player ID from player record"""
    # Check various ID formats
    external_id = player.get('external_player_id', '')
    
    # If it's already a SportsData.io format (numeric), use it
    if external_id and external_id.isdigit():
        return external_id
        
    # For MLB players, we might need to use name-based lookup
    # This is a simplified approach - in production you'd want a proper mapping table
    return None

def fetch_recent_game_dates(num_dates: int = 15) -> List[str]:
    """Get recent MLB game dates"""
    dates = []
    current_date = datetime.now()
    
    # Go back up to 30 days to find game dates
    for i in range(30):
        date = current_date - timedelta(days=i)
        date_str = date.strftime("%Y-%b-%d").upper()
        dates.append(date_str)
        
        if len(dates) >= num_dates:
            break
    
    return dates

def fetch_games_by_date(date_str: str) -> Optional[List[Dict]]:
    """Fetch all player game stats for a specific date"""
    url = f"{SPORTSDATA_BASE_URL}/PlayerGameStatsByDateFinal/{date_str}?key={SPORTSDATA_API_KEY}"
    
    logger.debug(f"Fetching games for date {date_str}: {url}")
    return rate_limited_request(url)

def get_player_games_from_dates(player_id: str, dates: List[str], max_games: int = 10) -> List[Dict]:
    """Get individual game stats for a player from recent dates"""
    player_games = []
    
    for date_str in dates:
        if len(player_games) >= max_games:
            break
            
        games_data = fetch_games_by_date(date_str)
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

def transform_sportsdata_to_player_game_stats(games_data: List[Dict], player_uuid: str) -> List[Dict]:
    """Transform SportsData.io game data to our player_game_stats schema"""
    transformed_games = []
    
    for game in games_data:
        try:
            # Create comprehensive stats JSON object from SportsData.io PlayerGame object
            stats_data = {
                # Game metadata
                'external_game_id': str(game.get('GameID', '')),
                'game_date': game.get('Day', ''),
                'opponent_team': game.get('Opponent', ''),
                'is_home': game.get('HomeOrAway', '').lower() == 'home',
                'started': game.get('Started', 0) == 1,
                'batting_order': game.get('BattingOrder'),
                'position': game.get('Position', ''),
                'team': game.get('Team', ''),
                
                # Batting stats (integers for individual games)
                'at_bats': int(game.get('AtBats', 0)),
                'hits': int(game.get('Hits', 0)),
                'singles': int(game.get('Singles', 0)),
                'doubles': int(game.get('Doubles', 0)),
                'triples': int(game.get('Triples', 0)),
                'home_runs': int(game.get('HomeRuns', 0)),
                'rbis': int(game.get('RunsBattedIn', 0)),
                'runs': int(game.get('Runs', 0)),
                'walks': int(game.get('Walks', 0)),
                'strikeouts': int(game.get('Strikeouts', 0)),
                'hit_by_pitch': int(game.get('HitByPitch', 0)),
                'stolen_bases': int(game.get('StolenBases', 0)),
                'caught_stealing': int(game.get('CaughtStealing', 0)),
                'sacrifice_flies': int(game.get('SacrificeFlies', 0)),
                'ground_into_double_play': int(game.get('GroundIntoDoublePlay', 0)),
                'total_bases': int(game.get('TotalBases', 0)),
                
                # Calculated stats (preserve decimals for averages)
                'batting_average': float(game.get('BattingAverage', 0.0)),
                'on_base_percentage': float(game.get('OnBasePercentage', 0.0)),
                'slugging_percentage': float(game.get('SluggingPercentage', 0.0)),
                'ops': float(game.get('OnBasePlusSlugging', 0.0)),
                
                # Pitching stats
                'wins': int(game.get('Wins', 0)),
                'losses': int(game.get('Losses', 0)),
                'saves': int(game.get('Saves', 0)),
                'innings_pitched': float(game.get('InningsPitchedDecimal', 0.0)),
                'hits_allowed': int(game.get('PitchingHits', 0)),
                'runs_allowed': int(game.get('PitchingRuns', 0)),
                'earned_runs': int(game.get('PitchingEarnedRuns', 0)),
                'walks_allowed': int(game.get('PitchingWalks', 0)),
                'strikeouts_pitched': int(game.get('PitchingStrikeouts', 0)),
                'home_runs_allowed': int(game.get('PitchingHomeRuns', 0)),
                'era': float(game.get('EarnedRunAverage', 0.0)),
                
                # Fantasy points
                'fantasy_points_yahoo': float(game.get('FantasyPointsYahoo', 0.0)),
                'fantasy_points_fanduel': float(game.get('FantasyPointsFanDuel', 0.0)),
                'fantasy_points_draftkings': float(game.get('FantasyPointsDraftKings', 0.0)),
                
                # Salary information
                'salary_yahoo': game.get('YahooSalary'),
                'salary_fanduel': game.get('FanDuelSalary'),
                'salary_draftkings': game.get('DraftKingsSalary'),
                
                # Game status
                'is_game_over': game.get('IsGameOver', False),
                'injury_status': game.get('InjuryStatus', ''),
                'weather': game.get('Weather'),
                'game_time': game.get('DateTime', ''),
            }
            
            # Map to actual schema
            game_stat = {
                'player_id': player_uuid,
                'event_id': None,  # We don't have event mapping yet
                'stats': stats_data,
                'fantasy_points': float(game.get('FantasyPoints', 0.0)),
                'minutes_played': None,  # Not applicable for baseball
                'betting_results': {},  # Empty for now
                'created_at': datetime.now().isoformat()
            }
            
            transformed_games.append(game_stat)
            
        except Exception as e:
            logger.error(f"Error transforming game data: {str(e)}")
            continue
    
    return transformed_games

def store_player_game_stats(game_stats: List[Dict]) -> bool:
    """Store player game stats in Supabase"""
    try:
        if not game_stats:
            return True
            
        # Insert in batches of 100 to avoid payload limits
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

def calculate_player_trends(player_uuid: str, player_name: str, sport: str) -> Dict:
    """Calculate trend data for a player based on their recent games"""
    try:
        # Fetch recent games for the player
        result = supabase.table('player_game_stats') \
            .select('*') \
            .eq('player_id', player_uuid) \
            .order('created_at', desc=True) \
            .limit(10) \
            .execute()
        
        games = result.data
        if not games:
            return {}
        
        # Extract stats from JSON fields
        game_stats = []
        for game in games:
            stats = game.get('stats', {})
            if stats:
                game_stats.append(stats)
        
        if not game_stats:
            return {}
        
        # Calculate averages and trends
        recent_count = len(game_stats)
        
        # Helper function to safely get numeric values
        def get_stat_value(games_list, stat_key, default=0):
            return [g.get(stat_key, default) for g in games_list if g.get(stat_key) is not None]
        
        # Batting averages
        hits_values = get_stat_value(game_stats, 'hits')
        home_runs_values = get_stat_value(game_stats, 'home_runs')
        rbis_values = get_stat_value(game_stats, 'rbis')
        runs_values = get_stat_value(game_stats, 'runs')
        strikeouts_values = get_stat_value(game_stats, 'strikeouts')
        walks_values = get_stat_value(game_stats, 'walks')
        total_bases_values = get_stat_value(game_stats, 'total_bases')
        stolen_bases_values = get_stat_value(game_stats, 'stolen_bases')
        at_bats_values = get_stat_value(game_stats, 'at_bats', 1)
        
        avg_hits = round(sum(hits_values) / max(len(hits_values), 1), 2) if hits_values else 0
        avg_home_runs = round(sum(home_runs_values) / max(len(home_runs_values), 1), 2) if home_runs_values else 0
        avg_rbis = round(sum(rbis_values) / max(len(rbis_values), 1), 2) if rbis_values else 0
        avg_runs = round(sum(runs_values) / max(len(runs_values), 1), 2) if runs_values else 0
        avg_strikeouts = round(sum(strikeouts_values) / max(len(strikeouts_values), 1), 2) if strikeouts_values else 0
        avg_walks = round(sum(walks_values) / max(len(walks_values), 1), 2) if walks_values else 0
        avg_total_bases = round(sum(total_bases_values) / max(len(total_bases_values), 1), 2) if total_bases_values else 0
        avg_stolen_bases = round(sum(stolen_bases_values) / max(len(stolen_bases_values), 1), 2) if stolen_bases_values else 0
        
        # Calculate batting average
        total_hits = sum(hits_values) if hits_values else 0
        total_at_bats = sum(at_bats_values) if at_bats_values else 1
        batting_avg = round(total_hits / max(total_at_bats, 1), 3)
        
        # Calculate trend direction based on recent vs previous performance
        first_half = game_stats[:5]  # Most recent 5 games
        second_half = game_stats[5:] # Previous 5 games
        
        trend_direction = "insufficient_data"
        if len(first_half) >= 3 and len(second_half) >= 3:
            first_hits = [g.get('hits', 0) for g in first_half]
            second_hits = [g.get('hits', 0) for g in second_half]
            
            if first_hits and second_hits:
                first_avg_hits = sum(first_hits) / len(first_hits)
                second_avg_hits = sum(second_hits) / len(second_hits)
                
                if first_avg_hits > second_avg_hits * 1.1:
                    trend_direction = "up"
                elif first_avg_hits < second_avg_hits * 0.9:
                    trend_direction = "down"
                else:
                    trend_direction = "stable"
        
        # Get player team information
        player_team = game_stats[0].get('team', '') if game_stats else ''
        last_game_date = game_stats[0].get('game_date', '') if game_stats else ''
        
        # Create trend data
        trend_data = {
            'player_id': player_uuid,
            'player_name': player_name,
            'team_name': player_team,
            'sport_key': sport.upper(),
            'games_played': recent_count,
            'recent_games_count': recent_count,
            'last_game_date': last_game_date,
            'avg_hits': avg_hits,
            'avg_home_runs': avg_home_runs,
            'avg_rbis': avg_rbis,
            'avg_runs': avg_runs,
            'avg_strikeouts': avg_strikeouts,
            'avg_walks': avg_walks,
            'avg_total_bases': avg_total_bases,
            'avg_stolen_bases': avg_stolen_bases,
            'batting_average': batting_avg,
            'trend_direction': trend_direction,
            'confidence_score': min(recent_count * 10, 100),  # Higher confidence with more games
            'form_trend': trend_direction,
            'betting_value_score': min(batting_avg * 100 + avg_hits * 10, 100),  # Simple value calculation
            'last_updated': datetime.now().isoformat(),
            'created_at': datetime.now().isoformat()
        }
        
        return trend_data
        
    except Exception as e:
        logger.error(f"Error calculating trends for player {player_uuid}: {str(e)}")
        return {}

def store_player_trends(trend_data: Dict) -> bool:
    """Store or update player trend data in Supabase"""
    try:
        if not trend_data:
            return True
            
        # Use upsert to update existing records or insert new ones
        result = supabase.table('player_trends_data').upsert(trend_data).execute()
        
        if result.data:
            logger.debug(f"Successfully stored trends for player {trend_data.get('player_name')}")
            return True
        else:
            logger.error(f"Failed to store trends: {result}")
            return False
            
    except Exception as e:
        logger.error(f"Error storing trends: {str(e)}")
        return {}

async def process_player(semaphore: asyncio.Semaphore, player: Dict, recent_dates: List[str]) -> bool:
    """Process a single player - fetch games and store in database"""
    async with semaphore:
        try:
            player_name = player['name']
            player_uuid = player['id']
            sport = player['sport']
            sportsdata_id = get_sportsdata_player_id(player)
            
            if not sportsdata_id:
                logger.warning(f"No SportsData.io ID found for player: {player_name}")
                return False
            
            logger.info(f"Processing player: {player_name} ({sport}) - ID: {sportsdata_id}")
            
            # Get player's last 10 games from recent dates
            games_data = get_player_games_from_dates(sportsdata_id, recent_dates, max_games=10)
            if not games_data:
                logger.warning(f"No games data found for player: {player_name}")
                return False
            
            logger.info(f"Found {len(games_data)} games for {player_name}")
            
            # Transform and store game stats
            game_stats = transform_sportsdata_to_player_game_stats(games_data, player_uuid)
            success = store_player_game_stats(game_stats)
            
            if not success:
                logger.error(f"Failed to store game stats for {player_name}")
                return False
            
            # Calculate and store trends
            trends_data = calculate_player_trends(player_uuid, player_name, sport)
            if trends_data:
                trends_success = store_player_trends(trends_data)
                if not trends_success:
                    logger.warning(f"Failed to store trends for {player_name}")
            
            logger.info(f"Successfully processed {player_name}: {len(game_stats)} games, trends calculated")
            return True
            
        except Exception as e:
            logger.error(f"Error processing player {player.get('name', 'unknown')}: {str(e)}")
            return False

def get_mlb_players_for_processing(limit: int = None) -> List[Dict]:
    """Get MLB players that need stats populated"""
    try:
        # Focus on MLB players first, prioritize those with SportsData.io IDs
        query = supabase.table('players_with_headshots') \
            .select('id, name, sport, external_player_id, team, position') \
            .in_('sport', ['MLB', 'BASEBALL_MLB']) \
            .eq('active', True)
        
        if limit:
            query = query.limit(limit)
            
        result = query.execute()
        
        if result.data:
            # Filter for players with valid external IDs
            valid_players = []
            for player in result.data:
                external_id = player.get('external_player_id', '')
                # Check if it looks like a SportsData.io ID (numeric)
                if external_id and (external_id.isdigit() or 'sportsdata' in external_id.lower()):
                    valid_players.append(player)
            
            logger.info(f"Found {len(valid_players)} MLB players with valid IDs out of {len(result.data)} total")
            return valid_players
        else:
            logger.error("No MLB players found")
            return []
            
    except Exception as e:
        logger.error(f"Error fetching MLB players: {str(e)}")
        return []

async def main():
    """Main execution function"""
    logger.info("Starting SportsData.io player stats population...")
    
    # Get command line arguments
    limit = None
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
            logger.info(f"Processing limited to {limit} players")
        except ValueError:
            logger.error("Invalid limit argument. Using all players.")
    
    # Get players to process
    players = get_mlb_players_for_processing(limit)
    if not players:
        logger.error("No players found to process")
        return
    
    logger.info(f"Processing {len(players)} MLB players...")
    
    # Get recent game dates for fetching individual games
    logger.info("Fetching recent MLB game dates...")
    recent_dates = fetch_recent_game_dates(15)  # Get 15 recent dates to find games
    
    # Concurrency control
    semaphore = asyncio.Semaphore(3)  # Limit concurrent API calls
    
    # Process all players
    tasks = [process_player(semaphore, player, recent_dates) for player in players]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Calculate statistics
    successful = sum(1 for r in results if r is True)
    failed = len(results) - successful
    success_rate = (successful / len(results)) * 100 if results else 0
    
    logger.info(f"""
    Population completed:
    - Total players: {len(players)}
    - Successful: {successful}
    - Failed: {failed}
    - Success rate: {success_rate:.1f}%""")

if __name__ == "__main__":
    asyncio.run(main())

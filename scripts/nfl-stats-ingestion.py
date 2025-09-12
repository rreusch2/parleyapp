#!/usr/bin/env python3
"""
NFL Player Stats Ingestion System
================================
Fetches comprehensive NFL player stats from SportsData.io
and populates player_game_stats table for trends UI charting.
"""

import os
import sys
import logging
import requests
import time
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from supabase import create_client, Client
import threading
from dotenv import load_dotenv

# Load environment variables
load_dotenv("backend/.env")

# Configuration
SPORTSDATA_API_KEY = "03d3518bdc1d468cba7855b6e1fcdfa6"
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/nfl"

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
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/nfl-stats-ingestion.log'),
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

def get_current_nfl_season() -> str:
    """Get current NFL season year"""
    now = datetime.now()
    # NFL season runs Sep-Feb, so if it's Mar-Aug, use previous year
    if now.month <= 8:
        return str(now.year - 1)
    else:
        return str(now.year)

def get_recent_nfl_weeks(num_weeks: int = 4) -> List[int]:
    """Get recent NFL weeks for current season"""
    current_date = datetime.now()
    
    # NFL season: Weeks 1-18 regular season + playoffs (weeks 19-22)
    if current_date.month >= 9:  # September onwards - current season
        # Estimate current week based on date (rough calculation)
        season_start = datetime(current_date.year, 9, 1)  # Approx season start
        weeks_elapsed = ((current_date - season_start).days // 7) + 1
        current_week = min(weeks_elapsed, 18)  # Cap at week 18
        weeks = list(range(max(1, current_week - num_weeks + 1), current_week + 1))
    elif current_date.month <= 2:  # January-February - playoffs
        weeks = list(range(15, 19))  # End of regular season
    else:  # March-August - off-season, use end of previous season
        weeks = list(range(15, 19))  # Weeks 15-18
    
    return weeks

def fetch_nfl_player_stats_by_week(season: str, week: int) -> List[Dict]:
    """Fetch NFL player game stats for a specific week"""
    url = f"{SPORTSDATA_BASE_URL}/stats/json/PlayerGameStatsByWeek/{season}/{week}?key={SPORTSDATA_API_KEY}"
    
    logger.info(f"Fetching NFL player stats for season {season}, week {week}")
    data = rate_limited_request(url)
    
    if data:
        logger.info(f"Retrieved {len(data)} player game records for week {week}")
        return data
    else:
        logger.error(f"Failed to fetch NFL player stats for week {week}")
        return []

def create_or_update_nfl_player(player_data: Dict) -> Optional[str]:
    """Create or update NFL player in database"""
    try:
        player_name = f"{player_data.get('FirstName', '')} {player_data.get('LastName', '')}".strip()
        team = player_data.get('Team', '')
        position = player_data.get('Position', '')
        sportsdata_player_id = str(player_data.get('PlayerID', ''))
        
        if not player_name or player_name == " ":
            logger.warning(f"Skipping player with empty name: {player_data}")
            return None
        
        # FIRST: Try to match by SportsData PlayerID (most reliable)
        if sportsdata_player_id:
            existing_player = supabase.table('players').select('id').eq('external_player_id', sportsdata_player_id).eq('sport', 'NFL').execute()
            if existing_player.data:
                logger.info(f"Found player by PlayerID {sportsdata_player_id}: {player_name}")
                return existing_player.data[0]['id']
        
        # SECOND: Try to match by name, team, AND position (more specific)
        existing_player = supabase.table('players').select('id').eq('name', player_name).eq('sport', 'NFL').eq('team', team).eq('position', position).execute()
        
        if existing_player.data:
            # Update the external_player_id if it was missing
            if sportsdata_player_id:
                supabase.table('players').update({'external_player_id': sportsdata_player_id}).eq('id', existing_player.data[0]['id']).execute()
                logger.info(f"Updated PlayerID for existing player: {player_name}")
            return existing_player.data[0]['id']
        
        # Create new player
        new_player = {
            'name': player_name,
            'team': team,
            'sport': 'NFL',
            'position': position,
            'active': True,
            'external_player_id': str(player_data.get('PlayerID', '')),
            'player_key': f"nfl_{player_name.lower().replace(' ', '_')}_{team.lower()}",
            'metadata': {
                'sportsdata_id': player_data.get('PlayerID'),
                'jersey_number': player_data.get('Number'),
                'height': player_data.get('Height'),
                'weight': player_data.get('Weight'),
                'birth_date': player_data.get('BirthDate'),
                'college': player_data.get('College')
            }
        }
        
        result = supabase.table('players').insert(new_player).execute()
        
        if result.data:
            logger.info(f"Created NFL player: {player_name} ({team})")
            return result.data[0]['id']
        else:
            logger.error(f"Failed to create NFL player: {player_name}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating NFL player: {str(e)}")
        return None

def map_nfl_stats_to_standard_format(player_stats: Dict) -> Dict[str, Any]:
    """Map NFL player stats to standardized format for player_game_stats table"""
    
    # Extract game information
    game_date = player_stats.get('GameDate', '')
    if game_date:
        try:
            game_date = datetime.fromisoformat(game_date.replace('Z', '+00:00')).date().isoformat()
        except:
            game_date = datetime.now().date().isoformat()
    
    # Map NFL stats to standardized format
    mapped_stats = {
        'game_date': game_date,
        'team': player_stats.get('Team', ''),
        'opponent_team': player_stats.get('Opponent', ''),
        'position': player_stats.get('Position', ''),
        'started': player_stats.get('Started', False),
        'is_home': player_stats.get('HomeOrAway') == 'HOME',
        'is_game_over': True,  # Historical data
        'jersey_number': player_stats.get('Number'),
        
        # Passing stats
        'passing_attempts': player_stats.get('PassingAttempts', 0),
        'passing_completions': player_stats.get('PassingCompletions', 0),
        'passing_yards': player_stats.get('PassingYards', 0),
        'passing_touchdowns': player_stats.get('PassingTouchdowns', 0),
        'passing_interceptions': player_stats.get('PassingInterceptions', 0),
        'passing_rating': player_stats.get('PassingRating', 0),
        'passing_completion_percentage': player_stats.get('PassingCompletionPercentage', 0),
        'passing_yards_per_attempt': player_stats.get('PassingYardsPerAttempt', 0),
        'passing_sacks': player_stats.get('PassingSacks', 0),
        'passing_sack_yards': player_stats.get('PassingSackYards', 0),
        
        # Rushing stats
        'rushing_attempts': player_stats.get('RushingAttempts', 0),
        'rushing_yards': player_stats.get('RushingYards', 0),
        'rushing_touchdowns': player_stats.get('RushingTouchdowns', 0),
        'rushing_average': player_stats.get('RushingYardsPerAttempt', 0),
        'rushing_long': player_stats.get('RushingLong', 0),
        
        # Receiving stats
        'receptions': player_stats.get('Receptions', 0),
        'receiving_yards': player_stats.get('ReceivingYards', 0),
        'receiving_touchdowns': player_stats.get('ReceivingTouchdowns', 0),
        'receiving_targets': player_stats.get('ReceivingTargets', 0),
        'receiving_average': player_stats.get('ReceivingYardsPerReception', 0),
        'receiving_long': player_stats.get('ReceivingLong', 0),
        
        # Defense stats
        'tackles': player_stats.get('Tackles', 0),
        'solo_tackles': player_stats.get('SoloTackles', 0),
        'assisted_tackles': player_stats.get('AssistedTackles', 0),
        'tackles_for_loss': player_stats.get('TacklesForLoss', 0),
        'sacks': player_stats.get('Sacks', 0),
        'quarterback_hits': player_stats.get('QuarterbackHits', 0),
        'interceptions': player_stats.get('Interceptions', 0),
        'interception_return_yards': player_stats.get('InterceptionReturnYards', 0),
        'fumbles_recovered': player_stats.get('FumblesRecovered', 0),
        'fumble_return_yards': player_stats.get('FumbleReturnYards', 0),
        'passes_defended': player_stats.get('PassesDefended', 0),
        'safeties': player_stats.get('Safeties', 0),
        
        # Kicking stats
        'field_goals_made': player_stats.get('FieldGoalsMade', 0),
        'field_goals_attempted': player_stats.get('FieldGoalsAttempted', 0),
        'field_goal_percentage': player_stats.get('FieldGoalPercentage', 0),
        'extra_points_made': player_stats.get('ExtraPointsMade', 0),
        'extra_points_attempted': player_stats.get('ExtraPointsAttempted', 0),
        'longest_field_goal': player_stats.get('FieldGoalsLongestMade', 0),
        
        # Punting stats
        'punts': player_stats.get('Punts', 0),
        'punt_yards': player_stats.get('PuntYards', 0),
        'punt_average': player_stats.get('PuntAverage', 0),
        'punt_longest': player_stats.get('PuntLong', 0),
        'punts_inside_20': player_stats.get('PuntsInside20', 0),
        
        # Return stats
        'punt_returns': player_stats.get('PuntReturns', 0),
        'punt_return_yards': player_stats.get('PuntReturnYards', 0),
        'punt_return_touchdowns': player_stats.get('PuntReturnTouchdowns', 0),
        'kickoff_returns': player_stats.get('KickoffReturns', 0),
        'kickoff_return_yards': player_stats.get('KickoffReturnYards', 0),
        'kickoff_return_touchdowns': player_stats.get('KickoffReturnTouchdowns', 0),
        
        # Fantasy stats
        'fantasy_points_fanduel': player_stats.get('FantasyPointsFanDuel', 0),
        'fantasy_points_draftkings': player_stats.get('FantasyPointsDraftKings', 0),
        'fantasy_points_yahoo': player_stats.get('FantasyPointsYahoo', 0),
        'fantasy_points_superdraft': player_stats.get('FantasyPointsSuperDraft', 0),
        
        # Game context
        'external_game_id': str(player_stats.get('GameID', '')),
        'season': player_stats.get('Season', ''),
        'week': player_stats.get('Week', 0),
        'season_type': player_stats.get('SeasonType', 1),  # 1=Regular, 2=Postseason
        'temperature': player_stats.get('Temperature'),
        'humidity': player_stats.get('Humidity'),
        'wind_speed': player_stats.get('WindSpeed'),
        
        # CRITICAL: Preserve SportsData PlayerID for proper linkage
        'PlayerID': player_stats.get('PlayerID', ''),
        'sportsdata_player_id': player_stats.get('PlayerID', ''),
        
        # Snap counts
        'offensive_snaps_played': player_stats.get('OffensiveSnapsPlayed', 0),
        'defensive_snaps_played': player_stats.get('DefensiveSnapsPlayed', 0),
        'special_teams_snaps_played': player_stats.get('SpecialTeamsSnapsPlayed', 0),
        
        # Turnovers
        'fumbles': player_stats.get('Fumbles', 0),
        'fumbles_lost': player_stats.get('FumblesLost', 0),
        
        # Two point conversions
        'two_point_conversion_passes': player_stats.get('TwoPointConversionPasses', 0),
        'two_point_conversion_runs': player_stats.get('TwoPointConversionRuns', 0),
        'two_point_conversion_receptions': player_stats.get('TwoPointConversionReceptions', 0)
    }
    
    return mapped_stats

def store_nfl_player_game_stats(player_id: str, stats: Dict[str, Any]) -> bool:
    """Store NFL player game stats in database"""
    try:
        # Calculate fantasy points average if multiple sources
        fantasy_points = max(
            stats.get('fantasy_points_fanduel', 0),
            stats.get('fantasy_points_draftkings', 0),
            stats.get('fantasy_points_yahoo', 0),
            stats.get('fantasy_points_superdraft', 0)
        )
        
        game_stat_record = {
            'player_id': player_id,
            'event_id': None,  # NFL doesn't use event_id from sports_events
            'stats': stats,
            'fantasy_points': str(fantasy_points),
            'minutes_played': None,  # Not applicable for NFL
            'betting_results': {}
        }
        
        # Check if this game stat already exists
        existing = supabase.table('player_game_stats').select('id').eq('player_id', player_id).filter('stats->>external_game_id', 'eq', stats.get('external_game_id', '')).execute()
        
        if existing.data:
            # Update existing record
            result = supabase.table('player_game_stats').update(game_stat_record).eq('id', existing.data[0]['id']).execute()
            logger.info(f"Updated NFL game stats for player {player_id}")
        else:
            # Insert new record
            result = supabase.table('player_game_stats').insert(game_stat_record).execute()
            logger.info(f"Inserted new NFL game stats for player {player_id}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error storing NFL player game stats: {str(e)}")
        return False

def process_nfl_player_stats_batch(player_stats_batch: List[Dict]) -> int:
    """Process a batch of NFL player stats"""
    processed_count = 0
    
    for player_stat in player_stats_batch:
        try:
            # Create or get player
            player_id = create_or_update_nfl_player(player_stat)
            
            if not player_id:
                logger.warning(f"Skipping stats for player without ID: {player_stat.get('FirstName', '')} {player_stat.get('LastName', '')}")
                continue
            
            # Map stats to standard format
            mapped_stats = map_nfl_stats_to_standard_format(player_stat)
            
            # Store stats
            if store_nfl_player_game_stats(player_id, mapped_stats):
                processed_count += 1
            
        except Exception as e:
            logger.error(f"Error processing NFL player stat: {str(e)}")
            continue
    
    return processed_count

def populate_nfl_player_stats(num_weeks: int = 4):
    """Main function to populate NFL player stats"""
    logger.info("Starting NFL player stats population")
    
    season = get_current_nfl_season()
    weeks = get_recent_nfl_weeks(num_weeks)
    
    logger.info(f"Processing NFL season {season}, weeks: {weeks}")
    
    total_processed = 0
    
    for week in weeks:
        logger.info(f"Processing NFL week {week}")
        
        # Fetch player stats for this week
        player_stats = fetch_nfl_player_stats_by_week(season, week)
        
        if not player_stats:
            logger.warning(f"No NFL player stats found for week {week}")
            continue
        
        # Process in batches to avoid overwhelming the database
        batch_size = 50
        for i in range(0, len(player_stats), batch_size):
            batch = player_stats[i:i + batch_size]
            processed_count = process_nfl_player_stats_batch(batch)
            total_processed += processed_count
            
            logger.info(f"Processed batch {i//batch_size + 1} for week {week}: {processed_count}/{len(batch)} records")
            
            # Small delay between batches
            time.sleep(0.5)
    
    logger.info(f"NFL player stats population completed. Total processed: {total_processed}")
    return total_processed

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Populate NFL player stats")
    parser.add_argument("--weeks", type=int, default=4, help="Number of recent weeks to process")
    
    args = parser.parse_args()
    
    try:
        result = populate_nfl_player_stats(args.weeks)
        logger.info(f"Script completed successfully. Processed {result} player game records.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        sys.exit(1)

#!/usr/bin/env python3
"""
College Football Player Stats Ingestion System
============================================
Fetches comprehensive College Football player stats from SportsData.io
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
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/cfb"

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
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/cfb-stats-ingestion.log'),
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

def get_current_cfb_season() -> str:
    """Get current CFB season year"""
    now = datetime.now()
    # CFB season runs Aug-Jan, so if it's Jan-July, use previous year
    if now.month <= 7:
        return str(now.year - 1)
    else:
        return str(now.year)

def get_recent_cfb_weeks(num_weeks: int = 4) -> List[int]:
    """Get recent CFB weeks for current season"""
    current_date = datetime.now()
    
    # CFB season typically runs weeks 1-15 (August through January)
    # For simplicity, get last 4 weeks of current season
    if current_date.month >= 8:  # August onwards
        # Current season, weeks 1-15
        current_week = min(((current_date - datetime(current_date.year, 8, 1)).days // 7) + 1, 15)
        weeks = list(range(max(1, current_week - num_weeks + 1), current_week + 1))
    else:  # January-July (bowl season/off-season)
        # Use last few weeks of previous season
        weeks = list(range(12, 16))  # Weeks 12-15 (end of season)
    
    return weeks

def fetch_cfb_player_stats_by_week(season: str, week: int) -> List[Dict]:
    """Fetch CFB player game stats for a specific week"""
    url = f"{SPORTSDATA_BASE_URL}/stats/json/PlayerGameStatsByWeek/{season}/{week}?key={SPORTSDATA_API_KEY}"
    
    logger.info(f"Fetching CFB player stats for season {season}, week {week}")
    data = rate_limited_request(url)
    
    if data:
        logger.info(f"Retrieved {len(data)} player game records for week {week}")
        return data
    else:
        logger.error(f"Failed to fetch CFB player stats for week {week}")
        return []

def create_or_update_cfb_player(player_data: Dict) -> Optional[str]:
    """Create or update CFB player in database"""
    try:
        player_name = f"{player_data.get('FirstName', '')} {player_data.get('LastName', '')}".strip()
        team = player_data.get('Team', '')
        position = player_data.get('Position', '')
        
        if not player_name or player_name == " ":
            logger.warning(f"Skipping player with empty name: {player_data}")
            return None
        
        # Check if player exists
        existing_player = supabase.table('players').select('id').eq('name', player_name).eq('sport', 'CFB').eq('team', team).execute()
        
        if existing_player.data:
            return existing_player.data[0]['id']
        
        # Create new player
        new_player = {
            'name': player_name,
            'team': team,
            'sport': 'CFB',
            'position': position,
            'active': True,
            'external_player_id': str(player_data.get('PlayerID', '')),
            'player_key': f"cfb_{player_name.lower().replace(' ', '_')}_{team.lower()}",
            'metadata': {
                'sportsdata_id': player_data.get('PlayerID'),
                'jersey_number': player_data.get('Number'),
                'class': player_data.get('Class'),
                'height': player_data.get('Height'),
                'weight': player_data.get('Weight')
            }
        }
        
        result = supabase.table('players').insert(new_player).execute()
        
        if result.data:
            logger.info(f"Created CFB player: {player_name} ({team})")
            return result.data[0]['id']
        else:
            logger.error(f"Failed to create CFB player: {player_name}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating CFB player: {str(e)}")
        return None

def map_cfb_stats_to_standard_format(player_stats: Dict) -> Dict[str, Any]:
    """Map CFB player stats to standardized format for player_game_stats table"""
    
    # Extract game information
    game_date = player_stats.get('GameDate', '')
    if game_date:
        try:
            game_date = datetime.fromisoformat(game_date.replace('Z', '+00:00')).date().isoformat()
        except:
            game_date = datetime.now().date().isoformat()
    
    # Map CFB stats to standardized format
    mapped_stats = {
        'game_date': game_date,
        'team': player_stats.get('Team', ''),
        'opponent_team': player_stats.get('Opponent', ''),
        'position': player_stats.get('Position', ''),
        'started': player_stats.get('Started', False),
        'is_home': player_stats.get('HomeOrAway') == 'HOME',
        'is_game_over': True,  # Historical data
        
        # Passing stats
        'passing_attempts': player_stats.get('PassingAttempts', 0),
        'passing_completions': player_stats.get('PassingCompletions', 0),
        'passing_yards': player_stats.get('PassingYards', 0),
        'passing_touchdowns': player_stats.get('PassingTouchdowns', 0),
        'passing_interceptions': player_stats.get('PassingInterceptions', 0),
        'passing_rating': player_stats.get('PassingRating', 0),
        'passing_completion_percentage': player_stats.get('PassingCompletionPercentage', 0),
        
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
        'interceptions': player_stats.get('Interceptions', 0),
        'fumbles_recovered': player_stats.get('FumblesRecovered', 0),
        
        # Kicking stats
        'field_goals_made': player_stats.get('FieldGoalsMade', 0),
        'field_goals_attempted': player_stats.get('FieldGoalsAttempted', 0),
        'extra_points_made': player_stats.get('ExtraPointsMade', 0),
        'extra_points_attempted': player_stats.get('ExtraPointsAttempted', 0),
        
        # Fantasy stats
        'fantasy_points_fanduel': player_stats.get('FantasyPointsFanDuel', 0),
        'fantasy_points_draftkings': player_stats.get('FantasyPointsDraftKings', 0),
        'fantasy_points_yahoo': player_stats.get('FantasyPointsYahoo', 0),
        
        # Game context
        'external_game_id': str(player_stats.get('GameID', '')),
        'season': player_stats.get('Season', ''),
        'week': player_stats.get('Week', 0),
        'season_type': player_stats.get('SeasonType', 1),  # 1=Regular, 2=Postseason
        
        # Player metadata
        'jersey_number': player_stats.get('Number'),
        'player_class': player_stats.get('Class')
    }
    
    return mapped_stats

def store_cfb_player_game_stats(player_id: str, stats: Dict[str, Any]) -> bool:
    """Store CFB player game stats in database"""
    try:
        # Calculate fantasy points average if multiple sources
        fantasy_points = max(
            stats.get('fantasy_points_fanduel', 0),
            stats.get('fantasy_points_draftkings', 0),
            stats.get('fantasy_points_yahoo', 0)
        )
        
        game_stat_record = {
            'player_id': player_id,
            'event_id': None,  # CFB doesn't use event_id from sports_events
            'stats': stats,
            'fantasy_points': str(fantasy_points),
            'minutes_played': None,  # Not applicable for CFB
            'betting_results': {}
        }
        
        # Check if this game stat already exists
        existing = supabase.table('player_game_stats').select('id').eq('player_id', player_id).filter('stats->>external_game_id', 'eq', stats.get('external_game_id', '')).execute()
        
        if existing.data:
            # Update existing record
            result = supabase.table('player_game_stats').update(game_stat_record).eq('id', existing.data[0]['id']).execute()
            logger.info(f"Updated CFB game stats for player {player_id}")
        else:
            # Insert new record
            result = supabase.table('player_game_stats').insert(game_stat_record).execute()
            logger.info(f"Inserted new CFB game stats for player {player_id}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error storing CFB player game stats: {str(e)}")
        return False

def process_cfb_player_stats_batch(player_stats_batch: List[Dict]) -> int:
    """Process a batch of CFB player stats"""
    processed_count = 0
    
    for player_stat in player_stats_batch:
        try:
            # Create or get player
            player_id = create_or_update_cfb_player(player_stat)
            
            if not player_id:
                logger.warning(f"Skipping stats for player without ID: {player_stat.get('FirstName', '')} {player_stat.get('LastName', '')}")
                continue
            
            # Map stats to standard format
            mapped_stats = map_cfb_stats_to_standard_format(player_stat)
            
            # Store stats
            if store_cfb_player_game_stats(player_id, mapped_stats):
                processed_count += 1
            
        except Exception as e:
            logger.error(f"Error processing CFB player stat: {str(e)}")
            continue
    
    return processed_count

def populate_cfb_player_stats(num_weeks: int = 4):
    """Main function to populate CFB player stats"""
    logger.info("Starting CFB player stats population")
    
    season = get_current_cfb_season()
    weeks = get_recent_cfb_weeks(num_weeks)
    
    logger.info(f"Processing CFB season {season}, weeks: {weeks}")
    
    total_processed = 0
    
    for week in weeks:
        logger.info(f"Processing CFB week {week}")
        
        # Fetch player stats for this week
        player_stats = fetch_cfb_player_stats_by_week(season, week)
        
        if not player_stats:
            logger.warning(f"No CFB player stats found for week {week}")
            continue
        
        # Process in batches to avoid overwhelming the database
        batch_size = 50
        for i in range(0, len(player_stats), batch_size):
            batch = player_stats[i:i + batch_size]
            processed_count = process_cfb_player_stats_batch(batch)
            total_processed += processed_count
            
            logger.info(f"Processed batch {i//batch_size + 1} for week {week}: {processed_count}/{len(batch)} records")
            
            # Small delay between batches
            time.sleep(0.5)
    
    logger.info(f"CFB player stats population completed. Total processed: {total_processed}")
    return total_processed

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Populate CFB player stats")
    parser.add_argument("--weeks", type=int, default=4, help="Number of recent weeks to process")
    
    args = parser.parse_args()
    
    try:
        result = populate_cfb_player_stats(args.weeks)
        logger.info(f"Script completed successfully. Processed {result} player game records.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        sys.exit(1)

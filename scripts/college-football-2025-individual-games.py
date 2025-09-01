#!/usr/bin/env python3
"""
College Football 2025 Individual Game Stats Ingestion
====================================================
Fetches CFB individual game stats for 2025 season from SportsData.io
and populates player_game_stats table for trends UI charting.
"""

import os
import sys
import logging
import requests
import time
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from supabase import create_client, Client
import threading
from dotenv import load_dotenv

# Load environment variables
load_dotenv("backend/.env")

# Configuration
SPORTSDATA_API_KEY = "03d3518bdc1d468cba7855b6e1fcdfa6"
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/cfb"

# Rate limiting configuration
API_RATE_LIMIT = 1.2  # 1.2 seconds between requests
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
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/cfb-2025-individual-games.log'),
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

def get_cfb_weeks_to_process(weeks_back: int = 4) -> List[int]:
    """Get CFB weeks to process for 2025 season"""
    current_date = datetime.now()
    
    # CFB season runs August-January, weeks 1-15+ 
    # For now, get recent weeks that have data
    if current_date.month >= 8:  # August onwards - season started
        # Estimate current week (rough calculation from late August start)
        season_start = datetime(2025, 8, 24)  # Approximate CFB season start
        days_since_start = (current_date - season_start).days
        current_week = max(1, min(15, (days_since_start // 7) + 1))
        
        # Get last N weeks up to current week
        weeks = list(range(max(1, current_week - weeks_back + 1), current_week + 1))
    else:
        # Off-season, get last few weeks of previous completed season
        weeks = list(range(12, 16))  # Weeks 12-15 from bowl season
    
    return weeks

def fetch_cfb_player_game_stats(season: int, week: int) -> List[Dict]:
    """Fetch CFB individual player game stats for a specific week"""
    url = f"{SPORTSDATA_BASE_URL}/stats/json/PlayerGameStatsByWeek/{season}/{week}?key={SPORTSDATA_API_KEY}"
    
    logger.info(f"Fetching CFB player game stats for season {season}, week {week}")
    data = rate_limited_request(url)
    
    if data:
        logger.info(f"Retrieved {len(data)} individual player game records for week {week}")
        return data
    else:
        logger.error(f"Failed to fetch CFB player game stats for week {week}")
        return []

def create_or_update_cfb_player(player_data: Dict) -> Optional[str]:
    """Create or update CFB player in database"""
    try:
        player_name = player_data.get('Name', '').strip()
        team = player_data.get('Team', '')
        position = player_data.get('Position', '')
        
        if not player_name:
            logger.warning(f"Skipping player with empty name: {player_data}")
            return None
        
        # Check if player exists
        existing_player = supabase.table('players').select('id').eq('name', player_name).eq('sport', 'College Football').eq('team', team).execute()
        
        if existing_player.data:
            return existing_player.data[0]['id']
        
        # Create new player
        new_player = {
            'name': player_name,
            'player_name': player_name,  # Both name and player_name are required
            'team': team,
            'sport': 'College Football',
            'position': position,
            'active': True,
            'external_player_id': str(player_data.get('PlayerID', '')),
            'player_key': f"cfb_{player_name.lower().replace(' ', '_')}_{team.lower()}",
            'metadata': {
                'sportsdata_id': player_data.get('PlayerID'),
                'global_team_id': player_data.get('GlobalTeamID'),
                'position_category': player_data.get('PositionCategory'),
                'draftkings_position': player_data.get('DraftKingsPosition'),
                'injury_status': player_data.get('InjuryStatus'),
                'injury_body_part': player_data.get('InjuryBodyPart')
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

def map_cfb_game_stats_to_standard_format(game_stats: Dict) -> Dict[str, Any]:
    """Map CFB individual game stats to standardized format"""
    
    # Extract game date
    game_date = game_stats.get('DateTime', '')
    if game_date:
        try:
            game_date = datetime.fromisoformat(game_date.replace('Z', '+00:00')).date().isoformat()
        except:
            game_date = datetime.now().date().isoformat()
    
    mapped_stats = {
        'game_date': game_date,
        'team': game_stats.get('Team', ''),
        'opponent_team': game_stats.get('Opponent', ''),
        'position': game_stats.get('Position', ''),
        'position_category': game_stats.get('PositionCategory', ''),
        'is_home': game_stats.get('HomeOrAway') == 'HOME',
        'is_game_over': game_stats.get('IsGameOver', False),
        
        # Passing stats
        'passing_attempts': game_stats.get('PassingAttempts', 0),
        'passing_completions': game_stats.get('PassingCompletions', 0),
        'passing_yards': game_stats.get('PassingYards', 0),
        'passing_touchdowns': game_stats.get('PassingTouchdowns', 0),
        'passing_interceptions': game_stats.get('PassingInterceptions', 0),
        'passing_rating': game_stats.get('PassingRating', 0),
        'passing_completion_percentage': game_stats.get('PassingCompletionPercentage', 0),
        'passing_yards_per_attempt': game_stats.get('PassingYardsPerAttempt', 0),
        'passing_yards_per_completion': game_stats.get('PassingYardsPerCompletion', 0),
        
        # Rushing stats
        'rushing_attempts': game_stats.get('RushingAttempts', 0),
        'rushing_yards': game_stats.get('RushingYards', 0),
        'rushing_touchdowns': game_stats.get('RushingTouchdowns', 0),
        'rushing_yards_per_attempt': game_stats.get('RushingYardsPerAttempt', 0),
        'rushing_long': game_stats.get('RushingLong', 0),
        
        # Receiving stats
        'receptions': game_stats.get('Receptions', 0),
        'receiving_yards': game_stats.get('ReceivingYards', 0),
        'receiving_touchdowns': game_stats.get('ReceivingTouchdowns', 0),
        'receiving_yards_per_reception': game_stats.get('ReceivingYardsPerReception', 0),
        'receiving_long': game_stats.get('ReceivingLong', 0),
        
        # Defense stats
        'interceptions': game_stats.get('Interceptions', 0),
        'interception_return_yards': game_stats.get('InterceptionReturnYards', 0),
        'interception_return_touchdowns': game_stats.get('InterceptionReturnTouchdowns', 0),
        'solo_tackles': game_stats.get('SoloTackles', 0),
        'assisted_tackles': game_stats.get('AssistedTackles', 0),
        'tackles_for_loss': game_stats.get('TacklesForLoss', 0),
        'sacks': game_stats.get('Sacks', 0),
        'passes_defended': game_stats.get('PassesDefended', 0),
        'fumbles_recovered': game_stats.get('FumblesRecovered', 0),
        'fumble_return_touchdowns': game_stats.get('FumbleReturnTouchdowns', 0),
        'quarterback_hurries': game_stats.get('QuarterbackHurries', 0),
        
        # Special teams stats
        'punt_returns': game_stats.get('PuntReturns', 0),
        'punt_return_yards': game_stats.get('PuntReturnYards', 0),
        'punt_return_yards_per_attempt': game_stats.get('PuntReturnYardsPerAttempt', 0),
        'punt_return_touchdowns': game_stats.get('PuntReturnTouchdowns', 0),
        'punt_return_long': game_stats.get('PuntReturnLong', 0),
        'kick_returns': game_stats.get('KickReturns', 0),
        'kick_return_yards': game_stats.get('KickReturnYards', 0),
        'kick_return_yards_per_attempt': game_stats.get('KickReturnYardsPerAttempt', 0),
        'kick_return_touchdowns': game_stats.get('KickReturnTouchdowns', 0),
        'kick_return_long': game_stats.get('KickReturnLong', 0),
        
        # Kicking stats
        'punts': game_stats.get('Punts', 0),
        'punt_yards': game_stats.get('PuntYards', 0),
        'punt_average': game_stats.get('PuntAverage', 0),
        'punt_long': game_stats.get('PuntLong', 0),
        'field_goals_attempted': game_stats.get('FieldGoalsAttempted', 0),
        'field_goals_made': game_stats.get('FieldGoalsMade', 0),
        'field_goal_percentage': game_stats.get('FieldGoalPercentage', 0),
        'field_goals_longest_made': game_stats.get('FieldGoalsLongestMade', 0),
        'extra_points_attempted': game_stats.get('ExtraPointsAttempted', 0),
        'extra_points_made': game_stats.get('ExtraPointsMade', 0),
        
        # Fumble stats
        'fumbles': game_stats.get('Fumbles', 0),
        'fumbles_lost': game_stats.get('FumblesLost', 0),
        
        # Fantasy stats
        'fantasy_points': game_stats.get('FantasyPoints', 0),
        'draftkings_salary': game_stats.get('DraftKingsSalary'),
        
        # Game context
        'external_game_id': str(game_stats.get('GameID', '')),
        'global_game_id': game_stats.get('GlobalGameID'),
        'season': game_stats.get('Season', 2025),
        'week': game_stats.get('Week', 0),
        'season_type': game_stats.get('SeasonType', 1),
        'games_played': game_stats.get('Games', 1),
        
        # Injury information
        'injury_status': game_stats.get('InjuryStatus'),
        'injury_body_part': game_stats.get('InjuryBodyPart'),
        'injury_start_date': game_stats.get('InjuryStartDate'),
        'injury_notes': game_stats.get('InjuryNotes'),
        
        # Timestamps
        'stat_updated': game_stats.get('Updated'),
        'stat_created': game_stats.get('Created')
    }
    
    return mapped_stats

def store_cfb_player_game_stats(player_id: str, stats: Dict[str, Any]) -> bool:
    """Store CFB individual game stats in player_game_stats table"""
    try:
        fantasy_points = stats.get('fantasy_points', 0)
        
        game_stat_record = {
            'player_id': player_id,
            'event_id': None,  # CFB doesn't use event_id from sports_events
            'stats': stats,
            'fantasy_points': str(fantasy_points),
            'minutes_played': None,  # CFB doesn't track minutes like basketball
            'betting_results': {}
        }
        
        # Check if this game stat already exists
        existing = supabase.table('player_game_stats').select('id').eq('player_id', player_id).filter('stats->>external_game_id', 'eq', stats.get('external_game_id', '')).execute()
        
        if existing.data:
            # Update existing record
            result = supabase.table('player_game_stats').update(game_stat_record).eq('id', existing.data[0]['id']).execute()
            logger.debug(f"Updated CFB game stats for player {player_id}")
        else:
            # Insert new record
            result = supabase.table('player_game_stats').insert(game_stat_record).execute()
            logger.debug(f"Inserted new CFB game stats for player {player_id}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error storing CFB player game stats: {str(e)}")
        return False

def process_cfb_game_stats_batch(game_stats_batch: List[Dict]) -> int:
    """Process a batch of CFB individual game stats"""
    processed_count = 0
    
    for game_stat in game_stats_batch:
        try:
            # Create or get player
            player_id = create_or_update_cfb_player(game_stat)
            
            if not player_id:
                logger.warning(f"Skipping stats for player without ID: {game_stat.get('Name', '')}")
                continue
            
            # Map stats to standard format
            mapped_stats = map_cfb_game_stats_to_standard_format(game_stat)
            
            # Store individual game stats
            if store_cfb_player_game_stats(player_id, mapped_stats):
                processed_count += 1
            
        except Exception as e:
            logger.error(f"Error processing CFB game stat: {str(e)}")
            continue
    
    return processed_count

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Populate CFB 2025 individual game stats')
    parser.add_argument('--weeks', type=int, default=4, help='Number of recent weeks to process (default: 4)')
    parser.add_argument('--season', type=int, default=2025, help='CFB season year (default: 2025)')
    
    args = parser.parse_args()
    
    logger.info("Starting CFB 2025 individual game stats population")
    
    try:
        # Get weeks to process
        weeks_to_process = get_cfb_weeks_to_process(args.weeks)
        
        logger.info(f"Processing CFB season {args.season}, weeks: {weeks_to_process}")
        
        total_processed = 0
        
        for week in weeks_to_process:
            logger.info(f"Processing CFB week {week}")
            
            # Fetch individual game stats for this week
            game_stats = fetch_cfb_player_game_stats(args.season, week)
            
            if not game_stats:
                logger.warning(f"No CFB game stats found for week {week}")
                continue
            
            # Process in batches to avoid overwhelming the database
            batch_size = 50
            for i in range(0, len(game_stats), batch_size):
                batch = game_stats[i:i + batch_size]
                processed_count = process_cfb_game_stats_batch(batch)
                total_processed += processed_count
                
                logger.info(f"Processed batch {i//batch_size + 1} for week {week}: {processed_count}/{len(batch)} records")
                
                # Small delay between batches
                time.sleep(0.5)
        
        logger.info(f"CFB 2025 individual game stats population completed. Total processed: {total_processed}")
        
    except Exception as e:
        logger.error(f"Script failed with error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()

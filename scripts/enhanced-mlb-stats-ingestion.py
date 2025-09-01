#!/usr/bin/env python3
"""
Enhanced MLB Player Stats Ingestion System
==========================================
Comprehensive MLB player stats fetching using SportsData.io to ensure 
ALL MLB players are covered for trends UI charting.
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
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/mlb"

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
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/enhanced-mlb-stats-ingestion.log'),
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
                
        except Exception as e:
            logger.error(f"Request error: {str(e)}")
            return None

def get_current_mlb_season() -> str:
    """Get current MLB season year"""
    now = datetime.now()
    # MLB season runs Feb-Oct, so if it's Nov-Jan, use previous year
    if now.month <= 1:
        return str(now.year - 1)
    else:
        return str(now.year)

def fetch_all_mlb_teams(season: str) -> List[Dict]:
    """Fetch all MLB teams for comprehensive coverage"""
    url = f"{SPORTSDATA_BASE_URL}/scores/json/Teams?key={SPORTSDATA_API_KEY}"
    
    logger.info(f"Fetching all MLB teams for season {season}")
    data = rate_limited_request(url)
    
    if data:
        logger.info(f"Retrieved {len(data)} MLB teams")
        return data
    else:
        logger.error(f"Failed to fetch MLB teams")
        return []

def fetch_team_season_stats(season: str, team_key: str) -> List[Dict]:
    """Fetch season stats for all players on a specific team"""
    url = f"{SPORTSDATA_BASE_URL}/stats/json/PlayerSeasonStatsByTeam/{season}/{team_key}?key={SPORTSDATA_API_KEY}"
    
    logger.info(f"Fetching season stats for team {team_key}")
    data = rate_limited_request(url)
    
    if data:
        logger.info(f"Retrieved {len(data)} player season records for {team_key}")
        return data
    else:
        logger.error(f"Failed to fetch season stats for team {team_key}")
        return []

def fetch_player_game_logs(season: str, player_id: str, num_games: str = "10") -> List[Dict]:
    """Fetch recent game logs for a specific player"""
    url = f"{SPORTSDATA_BASE_URL}/stats/json/PlayerGameStatsBySeason/{season}/{player_id}/{num_games}?key={SPORTSDATA_API_KEY}"
    
    logger.info(f"Fetching game logs for player {player_id}")
    data = rate_limited_request(url)
    
    if data:
        logger.info(f"Retrieved {len(data)} game logs for player {player_id}")
        return data
    else:
        logger.warning(f"No game logs found for player {player_id}")
        return []

def create_or_update_mlb_player_comprehensive(player_data: Dict) -> Optional[str]:
    """Create or update MLB player in database with comprehensive data"""
    try:
        first_name = player_data.get('FirstName', '').strip()
        last_name = player_data.get('LastName', '').strip()
        player_name = f"{first_name} {last_name}".strip()
        team = player_data.get('Team', '')
        position = player_data.get('Position', '')
        
        if not player_name or player_name == " ":
            logger.warning(f"Skipping player with empty name: {player_data}")
            return None
        
        # Check if player exists
        existing_player = supabase.table('players').select('id').eq('name', player_name).eq('sport', 'MLB').execute()
        
        if existing_player.data:
            # Update existing player with latest team/position info
            player_id = existing_player.data[0]['id']
            update_data = {
                'team': team,
                'position': position,
                'active': player_data.get('Status') == 'Active',
                'updated_at': datetime.now().isoformat()
            }
            supabase.table('players').update(update_data).eq('id', player_id).execute()
            return player_id
        
        # Create new player with comprehensive metadata
        new_player = {
            'name': player_name,
            'team': team,
            'sport': 'MLB',
            'position': position,
            'active': player_data.get('Status') == 'Active',
            'external_player_id': str(player_data.get('PlayerID', '')),
            'player_key': f"mlb_{player_name.lower().replace(' ', '_')}_{team.lower()}",
            'metadata': {
                'sportsdata_id': player_data.get('PlayerID'),
                'jersey_number': player_data.get('Jersey'),
                'bats': player_data.get('BatHand'),
                'throws': player_data.get('ThrowHand'),
                'height': player_data.get('Height'),
                'weight': player_data.get('Weight'),
                'birth_date': player_data.get('BirthDate'),
                'birth_city': player_data.get('BirthCity'),
                'birth_state': player_data.get('BirthState'),
                'birth_country': player_data.get('BirthCountry'),
                'college': player_data.get('College'),
                'salary': player_data.get('Salary'),
                'photo_url': player_data.get('PhotoUrl'),
                'experience': player_data.get('Experience'),
                'position_category': player_data.get('PositionCategory')
            }
        }
        
        result = supabase.table('players').insert(new_player).execute()
        
        if result.data:
            logger.info(f"Created comprehensive MLB player: {player_name} ({team})")
            return result.data[0]['id']
        else:
            logger.error(f"Failed to create MLB player: {player_name}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating MLB player: {str(e)}")
        return None

def map_enhanced_mlb_stats_to_standard_format(game_stats: Dict) -> Dict[str, Any]:
    """Enhanced mapping of MLB game stats to standardized format"""
    
    # Extract game information
    game_date = game_stats.get('Day', '')
    if game_date:
        try:
            game_date = datetime.fromisoformat(game_date.replace('Z', '+00:00')).date().isoformat()
        except:
            game_date = datetime.now().date().isoformat()
    
    # Comprehensive MLB stats mapping
    mapped_stats = {
        'game_date': game_date,
        'team': game_stats.get('Team', ''),
        'opponent_team': game_stats.get('Opponent', ''),
        'position': game_stats.get('Position', ''),
        'started': game_stats.get('Started', False),
        'is_home': game_stats.get('HomeOrAway') == 'HOME',
        'is_game_over': True,  # Historical data
        'jersey_number': game_stats.get('Jersey'),
        
        # Batting stats (comprehensive)
        'at_bats': game_stats.get('AtBats', 0),
        'hits': game_stats.get('Hits', 0),
        'runs': game_stats.get('Runs', 0),
        'rbis': game_stats.get('RunsBattedIn', 0),
        'home_runs': game_stats.get('HomeRuns', 0),
        'doubles': game_stats.get('Doubles', 0),
        'triples': game_stats.get('Triples', 0),
        'singles': game_stats.get('Singles', 0),
        'total_bases': game_stats.get('TotalBases', 0),
        'walks': game_stats.get('Walks', 0),
        'strikeouts': game_stats.get('Strikeouts', 0),
        'hit_by_pitch': game_stats.get('HitByPitch', 0),
        'sacrifice_flies': game_stats.get('SacrificeFlies', 0),
        'sacrifice_bunts': game_stats.get('SacrificeBunts', 0),
        'stolen_bases': game_stats.get('StolenBases', 0),
        'caught_stealing': game_stats.get('CaughtStealing', 0),
        'ground_into_double_plays': game_stats.get('GroundIntoDoublePlay', 0),
        'left_on_base': game_stats.get('LeftOnBase', 0),
        
        # Advanced batting metrics
        'batting_average': game_stats.get('BattingAverage', 0),
        'on_base_percentage': game_stats.get('OnBasePercentage', 0),
        'slugging_percentage': game_stats.get('SluggingPercentage', 0),
        'ops': game_stats.get('OnBasePlusSlugging', 0),
        'batting_order_confirmed': game_stats.get('BattingOrderConfirmed'),
        'batting_order': game_stats.get('BattingOrder'),
        
        # Pitching stats (comprehensive)
        'innings_pitched': game_stats.get('InningsPitchedDecimal', 0),
        'hits_allowed': game_stats.get('HitsAllowed', 0),
        'runs_allowed': game_stats.get('RunsAllowed', 0),
        'earned_runs': game_stats.get('EarnedRunsAllowed', 0),
        'walks_allowed': game_stats.get('WalksAllowed', 0),
        'strikeouts_pitched': game_stats.get('Strikeouts', 0),  # For pitchers
        'home_runs_allowed': game_stats.get('HomeRunsAllowed', 0),
        'pitch_count': game_stats.get('PitchCount', 0),
        'strikes': game_stats.get('Strikes', 0),
        'pitching_balls': game_stats.get('PitchingBalls', 0),
        'ground_balls': game_stats.get('GroundBalls', 0),
        'fly_balls': game_stats.get('FlyBalls', 0),
        'line_drives': game_stats.get('LineDrives', 0),
        'pop_flies': game_stats.get('PopFlies', 0),
        
        # Pitching decisions and advanced metrics
        'wins': game_stats.get('Wins', 0),
        'losses': game_stats.get('Losses', 0),
        'saves': game_stats.get('Saves', 0),
        'blown_saves': game_stats.get('BlownSaves', 0),
        'holds': game_stats.get('Holds', 0),
        'era': game_stats.get('EarnedRunAverage', 0),
        'whip': game_stats.get('WalksHitsPerInningsPitched', 0),
        
        # Fielding stats
        'fielding_errors': game_stats.get('Errors', 0),
        'assists': game_stats.get('Assists', 0),
        'putouts': game_stats.get('PutOuts', 0),
        'chances': game_stats.get('Chances', 0),
        'fielding_percentage': game_stats.get('FieldingPercentage', 0),
        
        # Fantasy stats (multiple platforms)
        'fantasy_points_fanduel': game_stats.get('FantasyPointsFanDuel', 0),
        'fantasy_points_draftkings': game_stats.get('FantasyPointsDraftKings', 0),
        'fantasy_points_yahoo': game_stats.get('FantasyPointsYahoo', 0),
        'fantasy_points_superdraft': game_stats.get('FantasyPointsSuperDraft', 0),
        
        # Salary information
        'salary_fanduel': game_stats.get('FanDuelSalary'),
        'salary_draftkings': game_stats.get('DraftKingsSalary'),
        'salary_yahoo': game_stats.get('YahooSalary'),
        
        # Game context and metadata
        'external_game_id': str(game_stats.get('GameID', '')),
        'season': game_stats.get('Season', ''),
        'day': game_stats.get('DateTime', ''),
        'global_game_id': game_stats.get('GlobalGameID'),
        'game_ended': game_stats.get('GameEnded', False),
        'started_bench': game_stats.get('StartedBench'),
        
        # Weather and game conditions
        'temperature': game_stats.get('Temperature'),
        'humidity': game_stats.get('Humidity'),
        'wind_speed': game_stats.get('WindSpeed'),
        'wind_direction': game_stats.get('WindDirection'),
        
        # Performance indicators
        'is_injury': game_stats.get('InjuryStatus') not in ['Healthy', None, ''],
        'injury_status': game_stats.get('InjuryStatus'),
        'injury_body_part': game_stats.get('InjuryBodyPart'),
        'injury_notes': game_stats.get('InjuryNotes')
    }
    
    return mapped_stats

def store_enhanced_mlb_player_game_stats(player_id: str, stats: Dict[str, Any]) -> bool:
    """Store enhanced MLB player game stats in database"""
    try:
        # Calculate best fantasy points from available platforms
        fantasy_points = max(
            stats.get('fantasy_points_fanduel', 0),
            stats.get('fantasy_points_draftkings', 0),
            stats.get('fantasy_points_yahoo', 0),
            stats.get('fantasy_points_superdraft', 0)
        )
        
        game_stat_record = {
            'player_id': player_id,
            'event_id': None,  # MLB uses external_game_id instead
            'stats': stats,
            'fantasy_points': str(fantasy_points),
            'minutes_played': None,  # Not applicable for MLB
            'betting_results': {}
        }
        
        # Check if this game stat already exists
        existing = supabase.table('player_game_stats').select('id').eq('player_id', player_id).filter('stats->>external_game_id', 'eq', stats.get('external_game_id', '')).execute()
        
        if existing.data:
            # Update existing record
            result = supabase.table('player_game_stats').update(game_stat_record).eq('id', existing.data[0]['id']).execute()
            logger.debug(f"Updated enhanced MLB game stats for player {player_id}")
        else:
            # Insert new record
            result = supabase.table('player_game_stats').insert(game_stat_record).execute()
            logger.debug(f"Inserted new enhanced MLB game stats for player {player_id}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error storing enhanced MLB player game stats: {str(e)}")
        return False

def populate_comprehensive_mlb_player_stats(num_games: int = 10):
    """Main function to populate comprehensive MLB player stats"""
    logger.info("Starting comprehensive MLB player stats population")
    
    season = get_current_mlb_season()
    logger.info(f"Processing MLB season {season}")
    
    # Step 1: Fetch all MLB teams
    teams = fetch_all_mlb_teams(season)
    
    if not teams:
        logger.error("No MLB teams found. Exiting.")
        return 0
    
    total_processed = 0
    
    # Step 2: Process each team comprehensively
    for team in teams:
        team_key = team.get('Key', '')
        team_name = team.get('Name', '')
        
        logger.info(f"Processing comprehensive stats for {team_name} ({team_key})")
        
        # Get all players on this team
        season_stats = fetch_team_season_stats(season, team_key)
        
        if not season_stats:
            logger.warning(f"No season stats found for {team_name}")
            continue
        
        logger.info(f"Found {len(season_stats)} players for {team_name}")
        
        # Process each player
        for player_season_data in season_stats:
            try:
                # Create or update player
                player_id = create_or_update_mlb_player_comprehensive(player_season_data)
                
                if not player_id:
                    logger.warning(f"Skipping player without ID: {player_season_data.get('Name', '')}")
                    continue
                
                # Get recent game logs for this player
                sportsdata_player_id = str(player_season_data.get('PlayerID', ''))
                if sportsdata_player_id:
                    game_logs = fetch_player_game_logs(season, sportsdata_player_id, str(num_games))
                    
                    # Process each game
                    for game_log in game_logs:
                        # Map stats to standard format
                        mapped_stats = map_enhanced_mlb_stats_to_standard_format(game_log)
                        
                        # Store stats
                        if store_enhanced_mlb_player_game_stats(player_id, mapped_stats):
                            total_processed += 1
                
                # Small delay between players
                time.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Error processing MLB player {player_season_data.get('Name', '')}: {str(e)}")
                continue
        
        # Delay between teams
        logger.info(f"Completed {team_name}. Moving to next team...")
        time.sleep(1)
    
    logger.info(f"Comprehensive MLB player stats population completed. Total processed: {total_processed}")
    return total_processed

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Comprehensive MLB player stats population")
    parser.add_argument("--games", type=int, default=10, help="Number of recent games to fetch per player")
    
    args = parser.parse_args()
    
    try:
        result = populate_comprehensive_mlb_player_stats(args.games)
        logger.info(f"Script completed successfully. Processed {result} player game records.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        sys.exit(1)

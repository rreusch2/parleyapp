#!/usr/bin/env python3
"""
NFL Historical Player Stats Ingestion System
============================================
Fetches NFL players' last 10 games across multiple seasons from SportsData.io
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
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/nfl"

# Rate limiting configuration
API_RATE_LIMIT = 1.2  # 1.2 seconds between requests for SportsData.io
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
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/nfl-historical-stats.log'),
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

def get_historical_seasons() -> List[int]:
    """Get list of historical NFL seasons to process"""
    current_year = datetime.now().year
    current_month = datetime.now().month
    
    # NFL season runs Sept-Feb, so season year is when it starts
    if current_month >= 9:  # NFL season has started
        return [current_year - 2, current_year - 1, current_year]
    else:  # Off-season
        return [current_year - 3, current_year - 2, current_year - 1]

def fetch_nfl_teams() -> List[Dict]:
    """Fetch all NFL teams"""
    url = f"{SPORTSDATA_BASE_URL}/scores/json/Teams?key={SPORTSDATA_API_KEY}"
    
    logger.info("Fetching NFL teams")
    data = rate_limited_request(url)
    
    if data:
        logger.info(f"Retrieved {len(data)} NFL teams")
        return data
    else:
        logger.error("Failed to fetch NFL teams")
        return []

def fetch_nfl_team_players(team_key: str) -> List[Dict]:
    """Fetch active players for a specific NFL team"""
    url = f"{SPORTSDATA_BASE_URL}/scores/json/Players/{team_key}?key={SPORTSDATA_API_KEY}"
    
    logger.info(f"Fetching players for team {team_key}")
    data = rate_limited_request(url)
    
    if data:
        # Filter to active players only
        active_players = [p for p in data if p.get('Status') == 'Active']
        logger.info(f"Retrieved {len(active_players)} active players for team {team_key}")
        return active_players
    else:
        logger.warning(f"No players found for team {team_key}")
        return []

def fetch_player_game_logs_for_season(player_id: int, season: int) -> List[Dict]:
    """Fetch NFL player game logs for a specific season"""
    url = f"{SPORTSDATA_BASE_URL}/stats/json/PlayerGameStatsByPlayerID/{season}REG/{player_id}?key={SPORTSDATA_API_KEY}"
    
    logger.debug(f"Fetching game logs for player {player_id}, season {season}")
    data = rate_limited_request(url)
    
    if data and isinstance(data, list):
        logger.debug(f"Retrieved {len(data)} game logs for player {player_id}, season {season}")
        return data
    else:
        return []

def get_last_n_games_for_player(player_id: int, seasons: List[int], target_games: int = 10) -> List[Dict]:
    """Get last N games for an NFL player across multiple seasons"""
    all_games = []
    
    # Process seasons in reverse order (most recent first)
    for season in reversed(seasons):
        if len(all_games) >= target_games:
            break
            
        game_logs = fetch_player_game_logs_for_season(player_id, season)
        
        # Add season info and sort by date
        for game in game_logs:
            game['ProcessedSeason'] = season
            if game.get('Date'):
                try:
                    game_date = datetime.fromisoformat(game['Date'].replace('Z', '+00:00'))
                    game['SortDate'] = game_date
                except:
                    game['SortDate'] = datetime(season, 1, 1)
            else:
                game['SortDate'] = datetime(season, 1, 1)
        
        # Sort by date descending (most recent first)
        game_logs.sort(key=lambda x: x.get('SortDate', datetime(1900, 1, 1)), reverse=True)
        all_games.extend(game_logs)
        
        # Rate limiting between seasons
        time.sleep(0.5)
    
    # Sort all games by date descending and return top N
    all_games.sort(key=lambda x: x.get('SortDate', datetime(1900, 1, 1)), reverse=True)
    return all_games[:target_games]

def create_or_update_nfl_player(player_data: Dict, team_info: Dict) -> Optional[str]:
    """Create or update NFL player in database"""
    try:
        player_name = f"{player_data.get('FirstName', '')} {player_data.get('LastName', '')}".strip()
        team_name = team_info.get('FullName', team_info.get('Name', ''))
        position = player_data.get('Position', '')
        
        if not player_name or player_name == " ":
            return None
        
        # Check if player exists
        existing_player = supabase.table('players').select('id').eq('name', player_name).eq('sport', 'National Football League').eq('team', team_name).execute()
        
        if existing_player.data:
            return existing_player.data[0]['id']
        
        # Create new player
        new_player = {
            'name': player_name,
            'team': team_name,
            'sport': 'National Football League',
            'position': position,
            'active': player_data.get('Status') == 'Active',
            'external_player_id': str(player_data.get('PlayerID', '')),
            'player_key': f"nfl_{player_name.lower().replace(' ', '_')}_{team_name.lower().replace(' ', '_')}",
            'metadata': {
                'sportsdata_id': player_data.get('PlayerID'),
                'jersey_number': player_data.get('Number'),
                'height': player_data.get('Height'),
                'weight': player_data.get('Weight'),
                'birth_date': player_data.get('BirthDate'),
                'college': player_data.get('College'),
                'team_key': team_info.get('Key', ''),
                'experience': player_data.get('Experience'),
                'status': player_data.get('Status')
            }
        }
        
        result = supabase.table('players').insert(new_player).execute()
        
        if result.data:
            logger.info(f"Created NFL player: {player_name} ({team_name})")
            return result.data[0]['id']
        else:
            logger.error(f"Failed to create NFL player: {player_name}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating NFL player: {str(e)}")
        return None

def map_nfl_stats_to_standard_format(game_stats: Dict) -> Dict[str, Any]:
    """Map NFL game stats to standardized format"""
    
    # Extract game date
    game_date = game_stats.get('Date', '')
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
        'started': game_stats.get('Started', False),
        'is_home': game_stats.get('HomeOrAway') == 'HOME',
        'is_game_over': True,
        
        # Passing stats
        'passing_attempts': game_stats.get('PassingAttempts', 0),
        'passing_completions': game_stats.get('PassingCompletions', 0),
        'passing_yards': game_stats.get('PassingYards', 0),
        'passing_touchdowns': game_stats.get('PassingTouchdowns', 0),
        'passing_interceptions': game_stats.get('PassingInterceptions', 0),
        'passing_rating': game_stats.get('PassingRating', 0),
        'passing_completion_percentage': game_stats.get('PassingCompletionPercentage', 0),
        
        # Rushing stats
        'rushing_attempts': game_stats.get('RushingAttempts', 0),
        'rushing_yards': game_stats.get('RushingYards', 0),
        'rushing_touchdowns': game_stats.get('RushingTouchdowns', 0),
        'rushing_average': game_stats.get('RushingYardsPerAttempt', 0),
        'rushing_long': game_stats.get('RushingLong', 0),
        
        # Receiving stats
        'receptions': game_stats.get('Receptions', 0),
        'receiving_yards': game_stats.get('ReceivingYards', 0),
        'receiving_touchdowns': game_stats.get('ReceivingTouchdowns', 0),
        'receiving_targets': game_stats.get('ReceivingTargets', 0),
        'receiving_average': game_stats.get('ReceivingYardsPerReception', 0),
        'receiving_long': game_stats.get('ReceivingLong', 0),
        
        # Defense stats
        'tackles': game_stats.get('Tackles', 0),
        'solo_tackles': game_stats.get('SoloTackles', 0),
        'assisted_tackles': game_stats.get('AssistedTackles', 0),
        'tackles_for_loss': game_stats.get('TacklesForLoss', 0),
        'sacks': game_stats.get('Sacks', 0),
        'interceptions': game_stats.get('Interceptions', 0),
        'fumbles_recovered': game_stats.get('FumblesRecovered', 0),
        'passes_defended': game_stats.get('PassesDefended', 0),
        
        # Kicking stats
        'field_goals_made': game_stats.get('FieldGoalsMade', 0),
        'field_goals_attempted': game_stats.get('FieldGoalsAttempted', 0),
        'extra_points_made': game_stats.get('ExtraPointsMade', 0),
        'extra_points_attempted': game_stats.get('ExtraPointsAttempted', 0),
        'field_goal_percentage': game_stats.get('FieldGoalPercentage', 0),
        
        # Fantasy stats
        'fantasy_points_fanduel': game_stats.get('FantasyPointsFanDuel', 0),
        'fantasy_points_draftkings': game_stats.get('FantasyPointsDraftKings', 0),
        'fantasy_points_yahoo': game_stats.get('FantasyPointsYahoo', 0),
        'fantasy_points_superdraft': game_stats.get('FantasyPointsSuperDraft', 0),
        
        # Special teams
        'punt_returns': game_stats.get('PuntReturns', 0),
        'punt_return_yards': game_stats.get('PuntReturnYards', 0),
        'kick_returns': game_stats.get('KickReturns', 0),
        'kick_return_yards': game_stats.get('KickReturnYards', 0),
        
        # Game context
        'external_game_id': str(game_stats.get('GameID', '')),
        'season': game_stats.get('ProcessedSeason', game_stats.get('Season', '')),
        'week': game_stats.get('Week', 0),
        'season_type': game_stats.get('SeasonType', 1),
        'score_team': game_stats.get('Score', 0),
        'score_opponent': game_stats.get('OpponentScore', 0),
        
        # Player usage
        'offensive_snaps': game_stats.get('OffensiveSnapsPlayed', 0),
        'defensive_snaps': game_stats.get('DefensiveSnapsPlayed', 0),
        'special_teams_snaps': game_stats.get('SpecialTeamsSnapsPlayed', 0),
        'offensive_snap_percentage': game_stats.get('OffensiveSnapPercentage', 0),
        'defensive_snap_percentage': game_stats.get('DefensiveSnapPercentage', 0)
    }
    
    return mapped_stats

def store_player_game_stats(player_id: str, stats: Dict[str, Any]) -> bool:
    """Store NFL player game stats in database"""
    try:
        fantasy_points = max(
            stats.get('fantasy_points_fanduel', 0),
            stats.get('fantasy_points_draftkings', 0),
            stats.get('fantasy_points_yahoo', 0),
            stats.get('fantasy_points_superdraft', 0)
        )
        
        game_stat_record = {
            'player_id': player_id,
            'event_id': None,
            'stats': stats,
            'fantasy_points': str(fantasy_points),
            'minutes_played': None,  # NFL uses snap counts instead
            'betting_results': {}
        }
        
        # Check if record exists
        existing = supabase.table('player_game_stats').select('id').eq('player_id', player_id).filter('stats->>external_game_id', 'eq', stats.get('external_game_id', '')).execute()
        
        if existing.data:
            # Update existing
            result = supabase.table('player_game_stats').update(game_stat_record).eq('id', existing.data[0]['id']).execute()
        else:
            # Insert new
            result = supabase.table('player_game_stats').insert(game_stat_record).execute()
        
        return True
        
    except Exception as e:
        logger.error(f"Error storing NFL game stats: {str(e)}")
        return False

def process_team_players(team: Dict, target_games: int = 10) -> int:
    """Process all players for an NFL team"""
    team_key = team.get('Key', '')
    team_name = team.get('FullName', team.get('Name', ''))
    
    if not team_key:
        return 0
    
    logger.info(f"Processing team: {team_name} ({team_key})")
    
    # Get team players
    players = fetch_nfl_team_players(team_key)
    
    if not players:
        return 0
    
    seasons = get_historical_seasons()
    processed_count = 0
    
    for player in players:
        player_id_ext = player.get('PlayerID')
        player_name = f"{player.get('FirstName', '')} {player.get('LastName', '')}".strip()
        
        if not player_id_ext or not player_name:
            continue
        
        # Create/update player record
        player_id = create_or_update_nfl_player(player, team)
        
        if not player_id:
            continue
        
        # Get last N games for this player
        recent_games = get_last_n_games_for_player(player_id_ext, seasons, target_games)
        
        if recent_games:
            for game_stats in recent_games:
                # Map stats to standard format
                mapped_stats = map_nfl_stats_to_standard_format(game_stats)
                
                # Store in database
                if store_player_game_stats(player_id, mapped_stats):
                    processed_count += 1
            
            logger.info(f"Processed {len(recent_games)} games for {player_name}")
        
        # Rate limiting between players
        time.sleep(0.3)
    
    return processed_count

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Populate NFL player historical stats')
    parser.add_argument('--games', type=int, default=10, help='Number of recent games per player (default: 10)')
    parser.add_argument('--teams', type=str, nargs='*', help='Specific team keys to process (default: all teams)')
    parser.add_argument('--limit', type=int, help='Limit number of teams to process for testing')
    
    args = parser.parse_args()
    
    logger.info("Starting NFL historical player stats ingestion")
    
    try:
        # Get all NFL teams
        teams = fetch_nfl_teams()
        
        if not teams:
            logger.error("No NFL teams found")
            return
        
        # Filter teams if specified
        if args.teams:
            teams = [team for team in teams if team.get('Key', '').upper() in [t.upper() for t in args.teams]]
            logger.info(f"Filtering to {len(teams)} specified teams")
        
        # Limit teams for testing
        if args.limit:
            teams = teams[:args.limit]
            logger.info(f"Limited to first {args.limit} teams for testing")
        
        total_processed = 0
        
        # Process each team
        for i, team in enumerate(teams):
            logger.info(f"Processing team {i+1}/{len(teams)}")
            
            team_processed = process_team_players(team, args.games)
            total_processed += team_processed
            
            logger.info(f"Team completed. Processed {team_processed} game records.")
            
            # Rate limiting between teams
            time.sleep(2)
        
        logger.info(f"NFL historical stats ingestion completed. Total processed: {total_processed}")
        
    except Exception as e:
        logger.error(f"Script failed with error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()

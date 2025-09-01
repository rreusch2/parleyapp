#!/usr/bin/env python3
"""
WNBA Player Stats Ingestion System
=================================
Fetches comprehensive WNBA player stats and populates player_game_stats table 
for trends UI charting using existing StatMuse integration and web scraping.
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
import re

# Load environment variables
load_dotenv("backend/.env")

# Configuration - WNBA doesn't have SportsData.io, use StatMuse + web scraping
STATMUSE_BASE_URL = "http://127.0.0.1:5001"  # Your existing StatMuse server
ESPN_WNBA_API = "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba"

# Rate limiting configuration
API_RATE_LIMIT = 0.5  # Faster for StatMuse
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
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/wnba-stats-ingestion.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class StatMuseClient:
    def __init__(self, base_url: str = "http://127.0.0.1:5001"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def query(self, query_text: str) -> Optional[Dict]:
        """Query StatMuse for WNBA data"""
        try:
            url = f"{self.base_url}/query"
            response = self.session.post(
                url,
                json={"query": query_text},
                timeout=30
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"StatMuse query failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"StatMuse query error: {str(e)}")
            return None

def rate_limited_request(url: str, timeout: int = 30) -> Optional[Dict]:
    """Make rate-limited API request"""
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
            else:
                logger.error(f"API request failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Request error: {str(e)}")
            return None

def fetch_wnba_teams() -> List[Dict]:
    """Fetch current WNBA teams from ESPN API"""
    url = f"{ESPN_WNBA_API}/teams"
    data = rate_limited_request(url)
    
    if data and 'sports' in data:
        teams = []
        for sport in data['sports']:
            if 'leagues' in sport:
                for league in sport['leagues']:
                    if 'teams' in league:
                        teams.extend(league['teams'])
        return teams
    
    return []

def get_wnba_players_from_statmuse(team_name: str) -> List[Dict]:
    """Get WNBA players for a team using StatMuse"""
    statmuse = StatMuseClient()
    
    query = f"Who are the current players on the {team_name} in the WNBA?"
    result = statmuse.query(query)
    
    if result and 'data' in result:
        # Parse StatMuse response for player names
        # This is a simplified parser - you may need to adjust based on actual StatMuse responses
        players = []
        text = result.get('data', {}).get('text', '')
        
        # Extract player names from response (basic regex approach)
        player_pattern = r'([A-Z][a-z]+ [A-Z][a-z]+)'
        matches = re.findall(player_pattern, text)
        
        for match in matches:
            players.append({
                'name': match,
                'team': team_name,
                'sport': 'WNBA'
            })
        
        return players
    
    return []

def get_player_recent_games_from_statmuse(player_name: str, team: str, num_games: int = 10) -> List[Dict]:
    """Get recent game stats for a WNBA player using StatMuse"""
    statmuse = StatMuseClient()
    
    query = f"What are {player_name}'s last {num_games} game stats in the WNBA this season?"
    result = statmuse.query(query)
    
    if result and 'data' in result:
        # Parse StatMuse response for game stats
        # This is a simplified parser - adjust based on actual StatMuse responses
        games = []
        data = result.get('data', {})
        
        # Try to extract structured data if available
        if 'structured_data' in data:
            structured = data['structured_data']
            # Process structured data
            # This would depend on StatMuse's actual response format
            
        # Fallback to text parsing
        text = data.get('text', '')
        
        # Basic parsing for game stats (points, rebounds, assists)
        # This is a simplified approach - you'd want more robust parsing
        game_lines = text.split('\n')
        
        for line in game_lines:
            if any(keyword in line.lower() for keyword in ['points', 'rebounds', 'assists', 'vs', 'at']):
                # Extract basic stats from text
                points_match = re.search(r'(\d+) points?', line)
                rebounds_match = re.search(r'(\d+) rebounds?', line)
                assists_match = re.search(r'(\d+) assists?', line)
                
                if points_match or rebounds_match or assists_match:
                    game_stats = {
                        'player_name': player_name,
                        'team': team,
                        'points': int(points_match.group(1)) if points_match else 0,
                        'rebounds': int(rebounds_match.group(1)) if rebounds_match else 0,
                        'assists': int(assists_match.group(1)) if assists_match else 0,
                        'game_date': (datetime.now() - timedelta(days=len(games))).date().isoformat()
                    }
                    games.append(game_stats)
        
        return games[:num_games]  # Limit to requested number
    
    return []

def create_or_update_wnba_player(player_data: Dict) -> Optional[str]:
    """Create or update WNBA player in database"""
    try:
        player_name = player_data.get('name', '').strip()
        team = player_data.get('team', '')
        position = player_data.get('position', '')
        
        if not player_name:
            logger.warning(f"Skipping player with empty name: {player_data}")
            return None
        
        # Check if player exists
        existing_player = supabase.table('players').select('id').eq('name', player_name).eq('sport', 'WNBA').eq('team', team).execute()
        
        if existing_player.data:
            return existing_player.data[0]['id']
        
        # Create new player
        new_player = {
            'name': player_name,
            'team': team,
            'sport': 'WNBA',
            'position': position,
            'active': True,
            'external_player_id': f"wnba_{player_name.lower().replace(' ', '_')}",
            'player_key': f"wnba_{player_name.lower().replace(' ', '_')}_{team.lower().replace(' ', '_')}",
            'metadata': {
                'source': 'statmuse',
                'team_full_name': team
            }
        }
        
        result = supabase.table('players').insert(new_player).execute()
        
        if result.data:
            logger.info(f"Created WNBA player: {player_name} ({team})")
            return result.data[0]['id']
        else:
            logger.error(f"Failed to create WNBA player: {player_name}")
            return None
            
    except Exception as e:
        logger.error(f"Error creating WNBA player: {str(e)}")
        return None

def map_wnba_stats_to_standard_format(game_stats: Dict) -> Dict[str, Any]:
    """Map WNBA game stats to standardized format for player_game_stats table"""
    
    # Extract game information
    game_date = game_stats.get('game_date', datetime.now().date().isoformat())
    
    # Map WNBA stats to standardized format
    mapped_stats = {
        'game_date': game_date,
        'team': game_stats.get('team', ''),
        'opponent_team': game_stats.get('opponent', ''),
        'position': game_stats.get('position', ''),
        'started': game_stats.get('started', True),
        'is_home': game_stats.get('is_home', False),
        'is_game_over': True,  # Historical data
        
        # Basketball stats
        'points': game_stats.get('points', 0),
        'rebounds': game_stats.get('rebounds', 0),
        'assists': game_stats.get('assists', 0),
        'steals': game_stats.get('steals', 0),
        'blocks': game_stats.get('blocks', 0),
        'turnovers': game_stats.get('turnovers', 0),
        'field_goals_made': game_stats.get('field_goals_made', 0),
        'field_goals_attempted': game_stats.get('field_goals_attempted', 0),
        'field_goal_percentage': game_stats.get('field_goal_percentage', 0),
        'three_pointers_made': game_stats.get('three_pointers_made', 0),
        'three_pointers_attempted': game_stats.get('three_pointers_attempted', 0),
        'three_point_percentage': game_stats.get('three_point_percentage', 0),
        'free_throws_made': game_stats.get('free_throws_made', 0),
        'free_throws_attempted': game_stats.get('free_throws_attempted', 0),
        'free_throw_percentage': game_stats.get('free_throw_percentage', 0),
        'offensive_rebounds': game_stats.get('offensive_rebounds', 0),
        'defensive_rebounds': game_stats.get('defensive_rebounds', 0),
        'personal_fouls': game_stats.get('personal_fouls', 0),
        'minutes_played': game_stats.get('minutes_played', 0),
        
        # Game context
        'external_game_id': game_stats.get('external_game_id', ''),
        'season': str(datetime.now().year),
        'source': 'statmuse'
    }
    
    # Calculate fantasy points (simplified WNBA scoring)
    fantasy_points = (
        mapped_stats['points'] +
        mapped_stats['rebounds'] * 1.2 +
        mapped_stats['assists'] * 1.5 +
        mapped_stats['steals'] * 3 +
        mapped_stats['blocks'] * 3 -
        mapped_stats['turnovers']
    )
    
    mapped_stats['fantasy_points'] = max(0, fantasy_points)
    
    return mapped_stats

def store_wnba_player_game_stats(player_id: str, stats: Dict[str, Any]) -> bool:
    """Store WNBA player game stats in database"""
    try:
        fantasy_points = stats.get('fantasy_points', 0)
        
        game_stat_record = {
            'player_id': player_id,
            'event_id': None,  # WNBA doesn't use event_id from sports_events
            'stats': stats,
            'fantasy_points': str(fantasy_points),
            'minutes_played': stats.get('minutes_played'),
            'betting_results': {}
        }
        
        # Check if this game stat already exists (by date and player)
        existing = supabase.table('player_game_stats').select('id').eq('player_id', player_id).filter('stats->>game_date', 'eq', stats.get('game_date', '')).execute()
        
        if existing.data:
            # Update existing record
            result = supabase.table('player_game_stats').update(game_stat_record).eq('id', existing.data[0]['id']).execute()
            logger.info(f"Updated WNBA game stats for player {player_id}")
        else:
            # Insert new record
            result = supabase.table('player_game_stats').insert(game_stat_record).execute()
            logger.info(f"Inserted new WNBA game stats for player {player_id}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error storing WNBA player game stats: {str(e)}")
        return False

def populate_wnba_player_stats(num_games: int = 10):
    """Main function to populate WNBA player stats"""
    logger.info("Starting WNBA player stats population using StatMuse")
    
    # WNBA team names (2024 season)
    wnba_teams = [
        "Las Vegas Aces", "New York Liberty", "Connecticut Sun", "Seattle Storm",
        "Minnesota Lynx", "Indiana Fever", "Phoenix Mercury", "Chicago Sky",
        "Atlanta Dream", "Washington Mystics", "Dallas Wings", "Los Angeles Sparks"
    ]
    
    total_processed = 0
    
    for team in wnba_teams:
        logger.info(f"Processing WNBA team: {team}")
        
        # Get players for this team
        players = get_wnba_players_from_statmuse(team)
        
        if not players:
            logger.warning(f"No players found for {team}")
            continue
        
        logger.info(f"Found {len(players)} players for {team}")
        
        for player_data in players:
            try:
                # Create or get player
                player_id = create_or_update_wnba_player(player_data)
                
                if not player_id:
                    logger.warning(f"Skipping stats for player without ID: {player_data.get('name', '')}")
                    continue
                
                # Get recent game stats for this player
                recent_games = get_player_recent_games_from_statmuse(
                    player_data['name'], 
                    player_data['team'], 
                    num_games
                )
                
                if not recent_games:
                    logger.warning(f"No recent games found for {player_data['name']}")
                    continue
                
                # Process each game
                for game_stats in recent_games:
                    # Map stats to standard format
                    mapped_stats = map_wnba_stats_to_standard_format(game_stats)
                    
                    # Store stats
                    if store_wnba_player_game_stats(player_id, mapped_stats):
                        total_processed += 1
                
                # Small delay between players
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"Error processing WNBA player {player_data.get('name', '')}: {str(e)}")
                continue
        
        # Delay between teams
        time.sleep(2)
    
    logger.info(f"WNBA player stats population completed. Total processed: {total_processed}")
    return total_processed

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Populate WNBA player stats using StatMuse")
    parser.add_argument("--games", type=int, default=10, help="Number of recent games to fetch per player")
    
    args = parser.parse_args()
    
    try:
        result = populate_wnba_player_stats(args.games)
        logger.info(f"Script completed successfully. Processed {result} player game records.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        sys.exit(1)

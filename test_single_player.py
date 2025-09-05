#!/usr/bin/env python3
import os
import sys
import requests
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# SportsData.io API configuration
SPORTSDATA_API_KEY = "d174f0ac08504e45806435851b5ab630"
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/nfl/stats/json"

# Database configuration
def get_database_url():
    """Construct Supabase database URL from environment variables"""
    db_host = os.getenv('DB_HOST', 'db.iriaegoipkjtktitpary.supabase.co')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'postgres')
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', 'Rekajarekaja20')
    
    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?sslmode=require"

DATABASE_URL = get_database_url()

def get_database_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        sys.exit(1)

def fetch_player_game_logs(player_id: str, season: str = "2024", num_games: str = "3"):
    """Fetch player game logs from SportsData.io API"""
    url = f"{SPORTSDATA_BASE_URL}/PlayerGameStatsBySeason/{season}/{player_id}/{num_games}"
    params = {"key": SPORTSDATA_API_KEY}
    
    try:
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data and isinstance(data, list):
                return data
            else:
                logger.warning(f"No game data returned for player {player_id}")
                return []
        else:
            logger.error(f"API request failed for player {player_id}: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"Request exception for player {player_id}: {e}")
        return None

def convert_sportsdata_to_our_format(game_data: dict, player_info: dict) -> dict:
    """Convert SportsData.io game format to our database format"""
    
    # Extract game date properly - SportsData.io uses "GameDate" field
    game_date = None
    date_field = game_data.get('GameDate')
    
    if date_field:
        try:
            date_str = str(date_field)
            if 'T' in date_str:
                game_date = date_str.split('T')[0]  # "2025-01-05"
            else:
                game_date = datetime.strptime(date_str[:10], '%Y-%m-%d').date().isoformat()
        except (ValueError, TypeError) as e:
            logger.warning(f"Could not parse GameDate '{date_field}': {e}")
            game_date = None
    
    # Determine opponent
    opponent = game_data.get('Opponent', '')
    home_or_away = 'home' if game_data.get('HomeOrAway') == 'HOME' else 'away'
    
    # Build stats object with proper NFL structure
    stats = {
        "sport": "NFL",
        "game_date": game_date,
        "opponent": opponent,
        "home_or_away": home_or_away,
        "fantasy_points": float(game_data.get('FantasyPoints', 0.0)),
    }
    
    # Add position-specific stats with INTEGER VALUES
    position = player_info.get('position', '').upper()
    
    if position in ['QB', 'QUARTERBACK']:
        stats.update({
            "passing_yards": int(game_data.get('PassingYards', 0)),
            "passing_tds": int(game_data.get('PassingTouchdowns', 0)),
            "interceptions": int(game_data.get('Interceptions', 0)),
            "rushing_yards": int(game_data.get('RushingYards', 0)),
            "rushing_tds": int(game_data.get('RushingTouchdowns', 0)),
        })
    elif position in ['RB', 'RUNNING BACK', 'RUNNINGBACK']:
        stats.update({
            "rushing_yards": int(game_data.get('RushingYards', 0)),
            "rushing_tds": int(game_data.get('RushingTouchdowns', 0)),
            "receptions": int(game_data.get('Receptions', 0)),
            "receiving_yards": int(game_data.get('ReceivingYards', 0)),
            "receiving_tds": int(game_data.get('ReceivingTouchdowns', 0)),
        })
    elif position in ['WR', 'WIDE RECEIVER', 'WIDERECEIVER', 'TE', 'TIGHT END', 'TIGHTEND']:
        stats.update({
            "receptions": int(game_data.get('Receptions', 0)),
            "receiving_yards": int(game_data.get('ReceivingYards', 0)),
            "receiving_tds": int(game_data.get('ReceivingTouchdowns', 0)),
            "rushing_yards": int(game_data.get('RushingYards', 0)),
            "rushing_tds": int(game_data.get('RushingTouchdowns', 0)),
        })
    
    return stats

def test_single_player():
    """Test with a single player"""
    conn = get_database_connection()
    
    # Test with a known active player (e.g., someone who should have recent games)
    test_player_id = "21543"  # Anthony Richardson or similar
    
    # Get player info
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("""
            SELECT id, player_name, team, position, external_player_id
            FROM players 
            WHERE external_player_id = %s
        """, (test_player_id,))
        player_info = cursor.fetchone()
        
        if not player_info:
            logger.error(f"Player {test_player_id} not found")
            return
    
    logger.info(f"Testing player: {player_info['player_name']} ({player_info['position']})")
    
    # Fetch their game logs
    games = fetch_player_game_logs(test_player_id, "2024", "3")
    
    if not games:
        logger.error("No games found")
        return
    
    logger.info(f"Found {len(games)} games")
    
    # Convert and display the first game
    game = games[0]
    stats = convert_sportsdata_to_our_format(game, player_info)
    
    print("\n=== RAW API DATA ===")
    print(f"GameDate: {game.get('GameDate')}")
    print(f"Opponent: {game.get('Opponent')}")
    print(f"Receptions: {game.get('Receptions')} (type: {type(game.get('Receptions'))})")
    print(f"ReceivingYards: {game.get('ReceivingYards')} (type: {type(game.get('ReceivingYards'))})")
    print(f"RushingYards: {game.get('RushingYards')} (type: {type(game.get('RushingYards'))})")
    print(f"FantasyPoints: {game.get('FantasyPoints')} (type: {type(game.get('FantasyPoints'))})")
    
    print("\n=== CONVERTED STATS ===")
    for key, value in stats.items():
        print(f"{key}: {value} (type: {type(value)})")
    
    print("\n=== VALIDATION ===")
    if 'receptions' in stats:
        print(f"✅ Receptions is INTEGER: {stats['receptions']} = {type(stats['receptions'])}")
    if 'receiving_yards' in stats:
        print(f"✅ Receiving yards is INTEGER: {stats['receiving_yards']} = {type(stats['receiving_yards'])}")
    if 'fantasy_points' in stats:
        print(f"✅ Fantasy points is FLOAT: {stats['fantasy_points']} = {type(stats['fantasy_points'])}")

if __name__ == "__main__":
    test_single_player()

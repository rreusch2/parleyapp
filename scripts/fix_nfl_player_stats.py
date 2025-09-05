#!/usr/bin/env python3
"""
Fix NFL Player Stats - Get Accurate Last 10 Games Data
Clears existing NFL game stats and repopulates with accurate SportsData.io data
"""

import os
import sys
import requests
import json
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from datetime import datetime, timezone
import time
from typing import Dict, List, Optional, Any
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# SportsData.io API configuration
SPORTSDATA_API_KEY = "d174f0ac08504e45806435851b5ab630"
SPORTSDATA_BASE_URL = "https://api.sportsdata.io/v3/nfl/stats/json"

# Database configuration from environment
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

def clear_existing_nfl_game_stats(conn):
    """Clear existing NFL player game stats, including recent records with NULL game_date"""
    try:
        with conn.cursor() as cursor:
            # First clear any recent records with NULL game_date from previous failed run
            cursor.execute("""
                DELETE FROM player_game_stats 
                WHERE player_id IN (
                    SELECT id FROM players WHERE sport = 'NFL'
                )
                AND created_at > NOW() - INTERVAL '30 minutes'
                AND (stats->>'game_date' IS NULL OR stats->>'game_date' = '')
            """)
            recent_deleted = cursor.rowcount
            logger.info(f"✅ Cleared {recent_deleted} recent records with NULL game_date")
            
            # Then clear all remaining NFL game stats  
            cursor.execute("""
                DELETE FROM player_game_stats 
                WHERE player_id IN (
                    SELECT id FROM players WHERE sport = 'NFL'
                )
            """)
            total_deleted = cursor.rowcount
            logger.info(f"✅ Cleared {total_deleted} total existing NFL game stats")
            
    except Exception as e:
        logger.error(f"❌ Failed to clear existing NFL game stats: {e}")
        return False
    
    return True

def get_nfl_players_with_sportsdata_ids(conn) -> List[Dict]:
    """Get all NFL players with SportsData.io external player IDs"""
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("""
            SELECT id, player_name, team, position, external_player_id, player_key
            FROM players 
            WHERE sport = 'NFL' 
            AND external_player_id IS NOT NULL
            ORDER BY player_name
        """)
        return cursor.fetchall()

def fetch_player_game_logs(player_id: str, season: str = "2024", num_games: str = "10") -> Optional[List[Dict]]:
    """Fetch player game logs from SportsData.io API"""
    url = f"{SPORTSDATA_BASE_URL}/PlayerGameStatsBySeason/{season}/{player_id}/{num_games}"
    params = {"key": SPORTSDATA_API_KEY}
    
    try:
        logger.debug(f"Fetching game logs for player {player_id}: {url}")
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data and isinstance(data, list):
                logger.debug(f"✅ Found {len(data)} games for player {player_id}")
                return data
            else:
                logger.warning(f"⚠️  No game data returned for player {player_id}")
                return []
        else:
            logger.error(f"❌ API request failed for player {player_id}: {response.status_code} - {response.text}")
            return None
            
    except requests.RequestException as e:
        logger.error(f"❌ Request exception for player {player_id}: {e}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON decode error for player {player_id}: {e}")
        return None

def convert_sportsdata_to_our_format(game_data: Dict, player_info: Dict) -> Dict:
    """Convert SportsData.io game format to our database format"""
    
    # Debug: Log the actual API response structure
    logger.debug(f"Raw API game data keys: {list(game_data.keys())}")
    logger.debug(f"Date field value: {game_data.get('Date')} | GameDate field: {game_data.get('GameDate')} | DateTime: {game_data.get('DateTime')}")
    
    # Extract game date properly - SportsData.io uses "GameDate" field
    game_date = None
    date_field = game_data.get('GameDate')
    
    if date_field:
        try:
            # Parse the GameDate string: "2025-01-05T13:00:00"
            date_str = str(date_field)
            if 'T' in date_str:
                # ISO format with time - extract just the date part
                game_date = date_str.split('T')[0]  # "2025-01-05"
            else:
                # Fallback for other formats
                game_date = datetime.strptime(date_str[:10], '%Y-%m-%d').date().isoformat()
                
        except (ValueError, TypeError) as e:
            logger.warning(f"Could not parse GameDate '{date_field}': {e}")
            game_date = None
    else:
        logger.warning(f"No GameDate field found in API response")
    
    # Determine opponent
    opponent = None
    home_or_away = None
    
    if game_data.get('Opponent'):
        opponent = game_data['Opponent']
        home_or_away = 'home' if game_data.get('HomeOrAway') == 'HOME' else 'away'
    elif game_data.get('HomeTeam') and game_data.get('AwayTeam'):
        # Determine opponent based on player's team
        player_team = player_info.get('team', '')
        if game_data['HomeTeam'] == player_team:
            opponent = game_data['AwayTeam']
            home_or_away = 'home'
        else:
            opponent = game_data['HomeTeam']
            home_or_away = 'away'
    
    # Build stats object with proper NFL structure
    stats = {
        "sport": "NFL",
        "game_date": game_date,
        "opponent": opponent,
        "home_or_away": home_or_away,
        "fantasy_points": float(game_data.get('FantasyPoints', 0.0)),
    }
    
    # Add position-specific stats
    position = player_info.get('position', '').upper()
    
    if position in ['QB', 'QUARTERBACK']:
        # Quarterback stats
        stats.update({
            "passing_yards": int(game_data.get('PassingYards', 0)),
            "passing_tds": int(game_data.get('PassingTouchdowns', 0)),
            "interceptions": int(game_data.get('Interceptions', 0)),
            "rushing_yards": int(game_data.get('RushingYards', 0)),
            "rushing_tds": int(game_data.get('RushingTouchdowns', 0)),
            "fumbles": int(game_data.get('Fumbles', 0)),
        })
    elif position in ['RB', 'RUNNING BACK', 'RUNNINGBACK']:
        # Running back stats
        stats.update({
            "rushing_yards": int(game_data.get('RushingYards', 0)),
            "rushing_tds": int(game_data.get('RushingTouchdowns', 0)),
            "receptions": int(game_data.get('Receptions', 0)),
            "receiving_yards": int(game_data.get('ReceivingYards', 0)),
            "receiving_tds": int(game_data.get('ReceivingTouchdowns', 0)),
            "fumbles": int(game_data.get('Fumbles', 0)),
        })
    elif position in ['WR', 'WIDE RECEIVER', 'WIDERECEIVER', 'TE', 'TIGHT END', 'TIGHTEND']:
        # Receiver stats
        stats.update({
            "receptions": int(game_data.get('Receptions', 0)),
            "receiving_yards": int(game_data.get('ReceivingYards', 0)),
            "receiving_tds": int(game_data.get('ReceivingTouchdowns', 0)),
            "rushing_yards": int(game_data.get('RushingYards', 0)),
            "rushing_tds": int(game_data.get('RushingTouchdowns', 0)),
            "fumbles": int(game_data.get('Fumbles', 0)),
        })
    elif position in ['K', 'KICKER']:
        # Kicker stats
        stats.update({
            "field_goals_made": int(game_data.get('FieldGoalsMade', 0)),
            "field_goals_attempted": int(game_data.get('FieldGoalsAttempted', 0)),
            "extra_points_made": int(game_data.get('ExtraPointsMade', 0)),
            "extra_points_attempted": int(game_data.get('ExtraPointsAttempted', 0)),
        })
    elif position in ['DEF', 'DEFENSE', 'DST']:
        # Defense/Special Teams stats
        stats.update({
            "sacks": int(game_data.get('Sacks', 0)),
            "interceptions": int(game_data.get('Interceptions', 0)),
            "fumbles_recovered": int(game_data.get('FumblesRecovered', 0)),
            "defensive_touchdowns": int(game_data.get('DefensiveTouchdowns', 0)),
            "safeties": int(game_data.get('Safeties', 0)),
        })
    else:
        # Default stats for other positions  
        stats.update({
            "rushing_yards": int(game_data.get('RushingYards', 0)),
            "rushing_tds": int(game_data.get('RushingTouchdowns', 0)),
            "receptions": int(game_data.get('Receptions', 0)),
            "receiving_yards": int(game_data.get('ReceivingYards', 0)),
            "receiving_tds": int(game_data.get('ReceivingTouchdowns', 0)),
            "fumbles": int(game_data.get('Fumbles', 0)),
        })
    
    return stats

def insert_player_game_stat(conn, player_id: str, stats: Dict, fantasy_points: float):
    """Insert a single game stat record"""
    with conn.cursor() as cursor:
        cursor.execute("""
            INSERT INTO player_game_stats (player_id, stats, fantasy_points, created_at)
            VALUES (%s, %s, %s, %s)
        """, (
            player_id,
            Json(stats),
            fantasy_points,
            datetime.now(timezone.utc)
        ))

def process_nfl_players(conn):
    """Process all NFL players and fetch their last 10 games"""
    players = get_nfl_players_with_sportsdata_ids(conn)
    logger.info(f"🏈 Processing {len(players)} NFL players...")
    
    success_count = 0
    error_count = 0
    total_games_added = 0
    
    for i, player in enumerate(players, 1):
        player_id = player['id']
        player_name = player['player_name']
        external_id = player['external_player_id']
        
        logger.info(f"[{i}/{len(players)}] Processing {player_name} (ID: {external_id})...")
        
        try:
            # Fetch game logs from SportsData.io
            game_logs = fetch_player_game_logs(external_id, "2024", "10")
            
            if game_logs is None:
                logger.error(f"❌ Failed to fetch data for {player_name}")
                error_count += 1
                continue
                
            if not game_logs:
                logger.warning(f"⚠️  No games found for {player_name}")
                continue
            
            # Process each game
            games_added = 0
            for game in game_logs:
                try:
                    stats = convert_sportsdata_to_our_format(game, player)
                    fantasy_points = float(game.get('FantasyPoints', 0.0))
                    
                    insert_player_game_stat(conn, player_id, stats, fantasy_points)
                    games_added += 1
                    total_games_added += 1
                    
                except Exception as e:
                    logger.error(f"❌ Error processing game for {player_name}: {e}")
                    continue
            
            logger.info(f"✅ Added {games_added} games for {player_name}")
            success_count += 1
            
            # Rate limiting
            if i % 10 == 0:
                logger.info(f"Progress: {i}/{len(players)} players processed")
                time.sleep(1)  # Brief pause every 10 players
                
        except Exception as e:
            logger.error(f"❌ Error processing {player_name}: {e}")
            error_count += 1
            continue
    
    logger.info(f"🎉 COMPLETED: {success_count} players processed successfully, {error_count} errors")
    logger.info(f"📊 Total games added: {total_games_added}")
    return success_count, error_count, total_games_added

def main():
    """Main execution function"""
    logger.info("🚀 Starting NFL Player Stats Fix...")
    
    # Get database connection
    conn = get_database_connection()
    
    try:
        # Step 1: Clear existing NFL game stats
        clear_existing_nfl_game_stats(conn)
        
        # Step 2: Process all NFL players
        success_count, error_count, total_games = process_nfl_players(conn)
        
        # Step 3: Final verification
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) as count 
                FROM player_game_stats pgs 
                JOIN players p ON pgs.player_id = p.id 
                WHERE p.sport = 'NFL'
            """)
            final_count = cursor.fetchone()[0]
        
        logger.info("="*60)
        logger.info(f"✅ FINAL RESULTS:")
        logger.info(f"   Players processed successfully: {success_count}")
        logger.info(f"   Players with errors: {error_count}")
        logger.info(f"   Total games added: {total_games}")
        logger.info(f"   Final NFL game stats count: {final_count}")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()

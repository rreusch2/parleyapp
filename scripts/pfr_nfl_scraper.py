#!/usr/bin/env python3
"""
Pro Football Reference NFL Player Game Stats Scraper
Scrapes individual game logs for NFL players from pro-football-reference.com
"""
import os
import sys
import requests
import pandas as pd
from bs4 import BeautifulSoup
import time
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime
import re

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

def scrape_pfr_player_gamelog(pfr_url: str, player_info: dict, season: str = "2024", max_games: int = 10):
    """
    Scrape Pro Football Reference player game log
    
    Args:
        pfr_url: Full PFR URL like https://www.pro-football-reference.com/players/B/BurrJo01/gamelog/2024/
        player_info: Dict with player details from our database
        season: Season year (default 2024)
        max_games: Maximum games to return (default 10)
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
    }
    
    session = requests.Session()
    session.headers.update(headers)
    
    try:
        logger.info(f"Scraping PFR for {player_info.get('player_name', 'Unknown')}: {pfr_url}")
        
        # Add delay to avoid rate limiting
        time.sleep(2)
        
        response = session.get(pfr_url, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find the game log table - usually has id "stats"
        table = soup.find('table', {'id': 'stats'})
        if not table:
            # Try alternative table IDs
            table = soup.find('table', class_='stats_table')
            if not table:
                logger.warning(f"No stats table found for {player_info.get('player_name')}")
                return []
        
        # Parse table headers
        headers_row = table.find('thead')
        if not headers_row:
            logger.warning(f"No table headers found for {player_info.get('player_name')}")
            return []
        
        # Get column names
        header_cells = headers_row.find_all('th')
        columns = []
        for th in header_cells:
            col_name = th.get('data-stat', th.text.strip())
            columns.append(col_name)
        
        logger.debug(f"Found columns: {columns}")
        
        # Parse table body
        tbody = table.find('tbody')
        if not tbody:
            logger.warning(f"No table body found for {player_info.get('player_name')}")
            return []
        
        games = []
        rows = tbody.find_all('tr')
        
        for row in rows:
            # Skip header rows and summary rows
            if 'thead' in row.get('class', []) or not row.find('td'):
                continue
                
            cells = row.find_all(['td', 'th'])
            if len(cells) < len(columns):
                continue
                
            game_data = {}
            for i, cell in enumerate(cells):
                if i < len(columns):
                    col_name = columns[i]
                    
                    # Get cell value
                    if cell.find('a'):
                        # If cell contains a link, get the text
                        value = cell.find('a').text.strip()
                    else:
                        value = cell.text.strip()
                    
                    # Clean and convert value
                    if value == '' or value == '--':
                        value = 0
                    elif col_name in ['pass_cmp', 'pass_att', 'pass_yds', 'pass_td', 'pass_int',
                                    'rush_att', 'rush_yds', 'rush_td', 'rec', 'rec_yds', 'rec_td',
                                    'fumbles', 'fumbles_lost']:
                        try:
                            value = int(float(value))
                        except (ValueError, TypeError):
                            value = 0
                    elif col_name in ['pass_rating', 'game_result']:
                        # Keep as string
                        pass
                    
                    game_data[col_name] = value
            
            # Only include regular season games (skip playoff indicator)
            if game_data.get('week', '') and not str(game_data.get('week', '')).startswith('WC'):
                games.append(game_data)
                
                # Stop if we have enough games
                if len(games) >= max_games:
                    break
        
        logger.info(f"✅ Scraped {len(games)} games for {player_info.get('player_name')}")
        return games[:max_games]
        
    except requests.RequestException as e:
        logger.error(f"❌ Request failed for {player_info.get('player_name')}: {e}")
        return []
    except Exception as e:
        logger.error(f"❌ Scraping error for {player_info.get('player_name')}: {e}")
        return []

def convert_pfr_to_our_format(game_data: dict, player_info: dict) -> dict:
    """Convert Pro Football Reference game data to our database format"""
    
    # Parse game date from PFR format
    game_date = None
    if game_data.get('game_date'):
        try:
            # PFR uses format like "2024-09-08" 
            date_str = str(game_data['game_date'])
            if len(date_str) >= 10:
                game_date = date_str[:10]  # Take first 10 chars (YYYY-MM-DD)
        except:
            pass
    
    # Extract opponent
    opponent = game_data.get('opp', '').replace('@', '').strip()
    
    # Determine home/away
    home_or_away = 'away' if '@' in str(game_data.get('opp', '')) else 'home'
    
    # Build base stats object
    stats = {
        "sport": "NFL",
        "game_date": game_date,
        "opponent": opponent,
        "home_or_away": home_or_away,
        "week": game_data.get('week', ''),
        "game_result": game_data.get('game_result', ''),
    }
    
    # Add position-specific stats
    position = player_info.get('position', '').upper()
    
    if position in ['QB', 'QUARTERBACK']:
        # Quarterback stats
        stats.update({
            "passing_completions": int(game_data.get('pass_cmp', 0)),
            "passing_attempts": int(game_data.get('pass_att', 0)),
            "passing_yards": int(game_data.get('pass_yds', 0)),
            "passing_tds": int(game_data.get('pass_td', 0)),
            "interceptions": int(game_data.get('pass_int', 0)),
            "passing_rating": game_data.get('pass_rating', '0'),
            "rushing_attempts": int(game_data.get('rush_att', 0)),
            "rushing_yards": int(game_data.get('rush_yds', 0)),
            "rushing_tds": int(game_data.get('rush_td', 0)),
            "fumbles": int(game_data.get('fumbles', 0)),
        })
    elif position in ['RB', 'RUNNING BACK', 'RUNNINGBACK']:
        # Running back stats
        stats.update({
            "rushing_attempts": int(game_data.get('rush_att', 0)),
            "rushing_yards": int(game_data.get('rush_yds', 0)),
            "rushing_tds": int(game_data.get('rush_td', 0)),
            "receptions": int(game_data.get('rec', 0)),
            "receiving_yards": int(game_data.get('rec_yds', 0)),
            "receiving_tds": int(game_data.get('rec_td', 0)),
            "fumbles": int(game_data.get('fumbles', 0)),
        })
    elif position in ['WR', 'WIDE RECEIVER', 'WIDERECEIVER', 'TE', 'TIGHT END', 'TIGHTEND']:
        # Receiver stats
        stats.update({
            "receptions": int(game_data.get('rec', 0)),
            "receiving_yards": int(game_data.get('rec_yds', 0)),
            "receiving_tds": int(game_data.get('rec_td', 0)),
            "rushing_attempts": int(game_data.get('rush_att', 0)),
            "rushing_yards": int(game_data.get('rush_yds', 0)),
            "rushing_tds": int(game_data.get('rush_td', 0)),
            "fumbles": int(game_data.get('fumbles', 0)),
        })
    
    return stats

def insert_player_game_stat(conn, player_id: str, stats: dict):
    """Insert a single game stat record"""
    with conn.cursor() as cursor:
        cursor.execute("""
            INSERT INTO player_game_stats (player_id, stats, created_at)
            VALUES (%s, %s, %s)
        """, (player_id, json.dumps(stats), datetime.now()))

def test_burrow_scrape():
    """Test scraper with Joe Burrow's URL"""
    logger.info("🧪 Testing scraper with Joe Burrow...")
    
    # Mock player info for Joe Burrow
    player_info = {
        'player_name': 'Joe Burrow',
        'position': 'QB',
        'team': 'CIN'
    }
    
    burrow_url = "https://www.pro-football-reference.com/players/B/BurrJo01/gamelog/2024/"
    
    games = scrape_pfr_player_gamelog(burrow_url, player_info, max_games=3)
    
    if games:
        logger.info(f"✅ Successfully scraped {len(games)} games")
        
        # Convert first game to our format
        first_game = games[0]
        converted_stats = convert_pfr_to_our_format(first_game, player_info)
        
        print("\n=== RAW PFR DATA (First Game) ===")
        for key, value in first_game.items():
            print(f"{key}: {value}")
            
        print("\n=== CONVERTED STATS ===")
        for key, value in converted_stats.items():
            print(f"{key}: {value}")
            
        print(f"\n✅ Test successful! Found proper integer stats:")
        if 'passing_yards' in converted_stats:
            print(f"   - Passing yards: {converted_stats['passing_yards']} (type: {type(converted_stats['passing_yards'])})")
        if 'passing_tds' in converted_stats:
            print(f"   - Passing TDs: {converted_stats['passing_tds']} (type: {type(converted_stats['passing_tds'])})")
    else:
        logger.error("❌ Test failed - no games scraped")

if __name__ == "__main__":
    test_burrow_scrape()

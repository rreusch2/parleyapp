#!/usr/bin/env python3
"""
Update Game Dates Script for Predictive Play

This script updates the start_time of existing games in the sports_events table 
to create tomorrow's games for your Live tab in Predictive Play.
"""

import psycopg2
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import socket
import json
import random
import uuid
import logging

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_db_connection():
    """Get database connection with retry logic and better error handling"""
    max_retries = 3
    retry_delay = 2
    
    # Try different connection methods
    connection_methods = [
        # Method 1: Use DATABASE_URL with pooler mode (port 6543)
        {
            'method': 'pooler',
            'conn_string': os.getenv('DATABASE_URL', '').replace(':5432', ':6543') + '?sslmode=require'
        },
        # Method 2: Regular connection string
        {
            'method': 'direct',
            'conn_string': os.getenv('DATABASE_URL') + '?sslmode=require' if os.getenv('DATABASE_URL') else None
        },
        # Method 3: Individual parameters
        {
            'method': 'params',
            'params': {
                'host': os.getenv('DB_HOST'),
                'database': os.getenv('DB_NAME'),
                'user': os.getenv('DB_USER'),
                'password': os.getenv('DB_PASSWORD'),
                'port': int(os.getenv('DB_PORT', 5432)),
                'sslmode': 'require'
            }
        }
    ]
    
    for conn_method in connection_methods:
        logger.info(f"Trying connection method: {conn_method['method']}")
        
        for attempt in range(max_retries):
            try:
                if conn_method['method'] in ['pooler', 'direct'] and conn_method.get('conn_string'):
                    # Mask password in logging
                    masked_string = conn_method['conn_string']
                    if os.getenv('DB_PASSWORD'):
                        masked_string = masked_string.replace(os.getenv('DB_PASSWORD'), '***')
                    logger.info(f"  Attempt {attempt + 1}: Connecting with: {masked_string}")
                    conn = psycopg2.connect(conn_method['conn_string'])
                else:
                    logger.info(f"  Attempt {attempt + 1}: Connecting with individual parameters")
                    conn = psycopg2.connect(**conn_method['params'])
                
                logger.info(f"  ✅ Successfully connected using {conn_method['method']} method!")
                return conn
                
            except psycopg2.OperationalError as e:
                logger.error(f"  ❌ Connection failed: {e}")
                if "Connection refused" in str(e) and "IPv6" in str(e):
                    logger.info("  💡 IPv6 connection issue detected. Try using connection pooler on port 6543.")
                if attempt < max_retries - 1:
                    logger.info(f"  Retrying in {retry_delay} seconds...")
                    import time
                    time.sleep(retry_delay)
            except Exception as e:
                logger.error(f"  ❌ Unexpected error: {e}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(retry_delay)
    
    # If all methods fail, provide helpful information
    logger.error("\n" + "=" * 50)
    logger.error("TROUBLESHOOTING TIPS:")
    logger.error("1. Check if your Supabase project is active at: https://app.supabase.com")
    logger.error("2. Try using the connection pooler (port 6543) instead of direct connection (port 5432)")
    logger.error("3. In Supabase dashboard, go to Settings > Database and copy the 'Connection pooling' string")
    logger.error("4. Update your .env file with: DATABASE_URL=<pooler_connection_string>")
    logger.error("=" * 50)
    
    raise Exception("Could not establish database connection after all attempts")

def update_game_dates(sport_key=None, num_games=10):
    """
    Update game dates to populate Live tab with upcoming games
    
    Args:
        sport_key: Filter by specific sport (e.g., 'NBA', 'NFL', 'MLB', 'NHL')
        num_games: How many games to update per sport
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        logger.info("✅ Connected to database")
        
        # Get current date and tomorrow's date
        current_date = datetime.now()
        tomorrow = current_date + timedelta(days=1)
        tomorrow_str = tomorrow.strftime('%Y-%m-%d')
        
        # Calculate date range for start times (12pm to 9pm tomorrow)
        start_hour = 12  # 12pm
        end_hour = 21    # 9pm
        
        # Get list of games that can be updated
        if sport_key:
            logger.info(f"Updating games for sport: {sport_key}")
            cursor.execute("""
                SELECT id, home_team, away_team, league
                FROM sports_events
                WHERE sport_key = %s
                ORDER BY RANDOM()
                LIMIT %s
            """, (sport_key, num_games))
        else:
            logger.info(f"Updating games for all sports")
            # Get list of sports we want to include
            cursor.execute("SELECT DISTINCT sport_key FROM sports_events")
            sports = [row[0] for row in cursor.fetchall()]
            
            # Process each sport
            games_updated = 0
            for sport in sports:
                logger.info(f"Processing sport: {sport}")
                # Get random games for this sport
                cursor.execute("""
                    SELECT id, home_team, away_team, league
                    FROM sports_events
                    WHERE sport_key = %s
                    ORDER BY RANDOM()
                    LIMIT %s
                """, (sport, num_games))
                
                games = cursor.fetchall()
                if not games:
                    logger.info(f"⚠️ No games found for {sport}")
                    continue
                
                logger.info(f"Found {len(games)} {sport} games to update")
                
                # Update each game's date to tomorrow with random time
                for game in games:
                    game_id, home_team, away_team, league = game
                    
                    # Random hour between start_hour and end_hour
                    hour = random.randint(start_hour, end_hour)
                    minute = random.choice([0, 15, 30, 45])
                    
                    game_time = tomorrow.replace(hour=hour, minute=minute, second=0, microsecond=0)
                    
                    # Update the game
                    cursor.execute("""
                        UPDATE sports_events
                        SET start_time = %s, status = 'scheduled'
                        WHERE id = %s
                    """, (game_time, game_id))
                    
                    games_updated += 1
                    logger.info(f"✅ Updated game: {home_team} vs {away_team} ({league}) to {game_time}")
            
            conn.commit()
            logger.info(f"🎮 Successfully updated {games_updated} games to appear in Live tab!")
            
            return games_updated
                
    except Exception as e:
        logger.error(f"❌ Error updating game dates: {e}")
        if conn:
            conn.rollback()
        return 0
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def create_sample_games():
    """Create sample games if none exist"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if we have games
        cursor.execute("SELECT COUNT(*) FROM sports_events")
        count = cursor.fetchone()[0]
        
        if count > 20:
            logger.info(f"✅ Found {count} existing games, no need to create samples")
            return
            
        logger.info(f"⚠️ Only found {count} games, creating sample games...")
        
        # Define sample teams for each sport
        sample_teams = {
            "NBA": [
                ("Los Angeles Lakers", "LA Lakers"),
                ("Boston Celtics", "Celtics"),
                ("Golden State Warriors", "Warriors"),
                ("Miami Heat", "Heat"),
                ("Chicago Bulls", "Bulls"),
                ("Brooklyn Nets", "Nets"),
                ("Dallas Mavericks", "Mavs"),
                ("Phoenix Suns", "Suns"),
            ],
            "NFL": [
                ("Kansas City Chiefs", "Chiefs"),
                ("San Francisco 49ers", "49ers"),
                ("Dallas Cowboys", "Cowboys"),
                ("Green Bay Packers", "Packers"),
                ("Buffalo Bills", "Bills"),
                ("Philadelphia Eagles", "Eagles"),
                ("Pittsburgh Steelers", "Steelers"),
                ("Baltimore Ravens", "Ravens"),
            ],
            "MLB": [
                ("New York Yankees", "Yankees"),
                ("Los Angeles Dodgers", "Dodgers"),
                ("Boston Red Sox", "Red Sox"),
                ("Chicago Cubs", "Cubs"),
                ("Atlanta Braves", "Braves"),
                ("Houston Astros", "Astros"),
                ("San Francisco Giants", "Giants"),
                ("St. Louis Cardinals", "Cardinals"),
            ],
            "NHL": [
                ("Toronto Maple Leafs", "Leafs"),
                ("Boston Bruins", "Bruins"),
                ("Montreal Canadiens", "Canadiens"),
                ("Tampa Bay Lightning", "Lightning"),
                ("Vegas Golden Knights", "Knights"),
                ("Colorado Avalanche", "Avalanche"),
                ("New York Rangers", "Rangers"),
                ("Pittsburgh Penguins", "Penguins"),
            ]
        }
        
        # Current date
        current_date = datetime.now()
        tomorrow = current_date + timedelta(days=1)
        
        total_created = 0
        
        # Create sample games for each sport
        for sport, teams in sample_teams.items():
            logger.info(f"Creating sample games for {sport}...")
            
            # Create team matchups
            num_teams = len(teams)
            for i in range(0, num_teams, 2):
                if i + 1 >= num_teams:
                    break
                    
                home_team, home_abbr = teams[i]
                away_team, away_abbr = teams[i+1]
                
                # Random hour (afternoon/evening games)
                hour = random.randint(12, 21)
                minute = random.choice([0, 15, 30, 45])
                game_time = tomorrow.replace(hour=hour, minute=minute, second=0, microsecond=0)
                
                # Create unique external ID
                external_id = f"{sport.lower()}_2025_{home_abbr.lower()}_{away_abbr.lower()}_{tomorrow.strftime('%Y%m%d')}"
                
                # Generate venue
                venue = f"{home_team.split()[0]} Arena" if sport == "NBA" else (
                    f"{home_team.split()[0]} Stadium" if sport in ["NFL", "MLB"] else f"{home_team.split()[0]} Center"
                )
                
                # Check if this external ID already exists
                cursor.execute("SELECT id FROM sports_events WHERE external_event_id = %s", (external_id,))
                if cursor.fetchone():
                    logger.info(f"⚠️ Event {external_id} already exists, skipping")
                    continue
                
                # Create game
                cursor.execute("""
                    INSERT INTO sports_events 
                    (id, external_event_id, sport_key, league, home_team, away_team, home_team_id, away_team_id, 
                     start_time, venue, status, stats)
                    VALUES (%s, %s, %s, %s, %s, %s, NULL, NULL, %s, %s, %s, %s)
                    ON CONFLICT (external_event_id) DO NOTHING
                """, (
                    str(uuid.uuid4()), 
                    external_id,
                    sport, 
                    sport, 
                    home_team, 
                    away_team,
                    game_time,
                    venue,
                    'scheduled',
                    json.dumps({
                        "home_score": None,
                        "away_score": None,
                        "venue": venue,
                        "coverage": "full",
                    })
                ))
                
                total_created += 1
                logger.info(f"✅ Created: {away_team} @ {home_team} ({sport}) on {game_time}")
        
        conn.commit()
        logger.info(f"🎮 Successfully created {total_created} sample games!")
        
    except Exception as e:
        logger.error(f"❌ Error creating sample games: {e}")
        if conn:
            conn.rollback()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def main():
    """Main function"""
    try:
        logger.info("🏆 Predictive Play Game Dates Updater")
        logger.info("=" * 50)
        
        # Check if we need to create sample games first
        create_sample_games()
        
        # Update dates for games
        num_games_per_sport = 5  # Set how many games per sport you want
        updated = update_game_dates(num_games=num_games_per_sport)
        
        if updated > 0:
            logger.info(f"✅ SUCCESS: Updated {updated} games for tomorrow!")
            logger.info(f"🏀 Your Live tab should now show upcoming games for tomorrow")
        else:
            logger.warning("⚠️ No games were updated. Check for errors.")
            
    except Exception as e:
        logger.error(f"❌ An error occurred: {e}")

if __name__ == "__main__":
    main() 
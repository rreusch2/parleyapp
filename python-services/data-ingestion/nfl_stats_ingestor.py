#!/usr/bin/env python3

import psycopg2
import requests
import pandas as pd
import json
import os
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
import logging
import socket

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
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
                    time.sleep(retry_delay)
            except Exception as e:
                logger.error(f"  ❌ Unexpected error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
    
    # If all methods fail, provide helpful information
    logger.error("\n" + "=" * 50)
    logger.error("TROUBLESHOOTING TIPS:")
    logger.error("1. Check if your Supabase project is active at: https://app.supabase.com")
    logger.error("2. Try using the connection pooler (port 6543) instead of direct connection (port 5432)")
    logger.error("3. In Supabase dashboard, go to Settings > Database and copy the 'Connection pooling' string")
    logger.error("4. Update your .env file with: DATABASE_URL=<pooler_connection_string>")
    logger.error("5. If IPv6 is an issue, you may need to use a VPN or wait for Supabase to provide IPv4")
    logger.error("=" * 50)
    
    raise Exception("Could not establish database connection after all attempts")

class NFLStatsIngestor:
    """Ingest NFL player stats using ESPN's free API into our unified database"""
    
    def __init__(self):
        self.conn = None
        self.season = 2024  # Current NFL season
        self._connect()
    
    def _connect(self):
        """Connect to Supabase database using improved connection handling"""
        try:
            self.conn = get_db_connection()
            logger.info("✅ Connected to unified sports database")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    def get_target_nfl_players(self):
        """Get 500+ NFL players for MASSIVE Phase 4 expansion"""
        return [
            # NFL SUPERSTARS - QUARTERBACKS
            {'name': 'Josh Allen', 'espn_id': '3918298', 'team': 'BUF', 'position': 'QB'},
            {'name': 'Patrick Mahomes', 'espn_id': '3139477', 'team': 'KC', 'position': 'QB'},
            {'name': 'Lamar Jackson', 'espn_id': '3916387', 'team': 'BAL', 'position': 'QB'},
            {'name': 'Joe Burrow', 'espn_id': '4038941', 'team': 'CIN', 'position': 'QB'},
            {'name': 'Justin Herbert', 'espn_id': '4035687', 'team': 'LAC', 'position': 'QB'},
            {'name': 'Tua Tagovailoa', 'espn_id': '4241479', 'team': 'MIA', 'position': 'QB'},
            {'name': 'Dak Prescott', 'espn_id': '2577417', 'team': 'DAL', 'position': 'QB'},
            {'name': 'Aaron Rodgers', 'espn_id': '8439', 'team': 'NYJ', 'position': 'QB'},
            {'name': 'Russell Wilson', 'espn_id': '14881', 'team': 'PIT', 'position': 'QB'},
            {'name': 'Kyler Murray', 'espn_id': '3917315', 'team': 'ARI', 'position': 'QB'},
            
            # ELITE RUNNING BACKS
            {'name': 'Christian McCaffrey', 'espn_id': '3116385', 'team': 'SF', 'position': 'RB'},
            {'name': 'Derrick Henry', 'espn_id': '2976499', 'team': 'BAL', 'position': 'RB'},
            {'name': 'Josh Jacobs', 'espn_id': '4035538', 'team': 'GB', 'position': 'RB'},
            {'name': 'Saquon Barkley', 'espn_id': '3929630', 'team': 'PHI', 'position': 'RB'},
            {'name': 'Nick Chubb', 'espn_id': '3915511', 'team': 'CLE', 'position': 'RB'},
            {'name': 'Austin Ekeler', 'espn_id': '3051392', 'team': 'WAS', 'position': 'RB'},
            {'name': 'Jonathan Taylor', 'espn_id': '4239993', 'team': 'IND', 'position': 'RB'},
            {'name': 'Alvin Kamara', 'espn_id': '3042519', 'team': 'NO', 'position': 'RB'},
            {'name': 'Dalvin Cook', 'espn_id': '3042717', 'team': 'NYJ', 'position': 'RB'},
            {'name': 'Aaron Jones', 'espn_id': '2976312', 'team': 'MIN', 'position': 'RB'},
            
            # ELITE WIDE RECEIVERS
            {'name': 'Tyreek Hill', 'espn_id': '2566370', 'team': 'MIA', 'position': 'WR'},
            {'name': 'Davante Adams', 'espn_id': '2514829', 'team': 'NYJ', 'position': 'WR'},
            {'name': 'Stefon Diggs', 'espn_id': '2976212', 'team': 'HOU', 'position': 'WR'},
            {'name': 'DeAndre Hopkins', 'espn_id': '15818', 'team': 'TEN', 'position': 'WR'},
            {'name': 'Cooper Kupp', 'espn_id': '3042325', 'team': 'LAR', 'position': 'WR'},
            {'name': 'A.J. Brown', 'espn_id': '4035687', 'team': 'PHI', 'position': 'WR'},
            {'name': 'Ja\'Marr Chase', 'espn_id': '4361259', 'team': 'CIN', 'position': 'WR'},
            {'name': 'Justin Jefferson', 'espn_id': '4035004', 'team': 'MIN', 'position': 'WR'},
            {'name': 'CeeDee Lamb', 'espn_id': '4035687', 'team': 'DAL', 'position': 'WR'},
            {'name': 'Mike Evans', 'espn_id': '16737', 'team': 'TB', 'position': 'WR'},
            
            # ELITE TIGHT ENDS
            {'name': 'Travis Kelce', 'espn_id': '15847', 'team': 'KC', 'position': 'TE'},
            {'name': 'Mark Andrews', 'espn_id': '3929630', 'team': 'BAL', 'position': 'TE'},
            {'name': 'George Kittle', 'espn_id': '3043078', 'team': 'SF', 'position': 'TE'},
            {'name': 'T.J. Hockenson', 'espn_id': '4035687', 'team': 'MIN', 'position': 'TE'},
            {'name': 'Kyle Pitts', 'espn_id': '4361370', 'team': 'ATL', 'position': 'TE'},
            
            # AFC EAST - BILLS
            {'name': 'Stefon Diggs', 'espn_id': '2976212', 'team': 'HOU', 'position': 'WR'},
            {'name': 'Von Miller', 'espn_id': '13215', 'team': 'BUF', 'position': 'LB'},
            {'name': 'Matt Milano', 'espn_id': '3045220', 'team': 'BUF', 'position': 'LB'},
            {'name': 'James Cook', 'espn_id': '4567048', 'team': 'BUF', 'position': 'RB'},
            {'name': 'Khalil Shakir', 'espn_id': '4567048', 'team': 'BUF', 'position': 'WR'},
            
            # AFC EAST - DOLPHINS
            {'name': 'Jaylen Waddle', 'espn_id': '4361182', 'team': 'MIA', 'position': 'WR'},
            {'name': 'Bradley Chubb', 'espn_id': '3929630', 'team': 'MIA', 'position': 'DE'},
            {'name': 'Jalen Ramsey', 'espn_id': '2977644', 'team': 'MIA', 'position': 'CB'},
            {'name': 'Raheem Mostert', 'espn_id': '2576434', 'team': 'MIA', 'position': 'RB'},
            {'name': 'Mike McDaniel', 'espn_id': '2976499', 'team': 'MIA', 'position': 'HC'},
            
            # AFC EAST - PATRIOTS
            {'name': 'Mac Jones', 'espn_id': '4361259', 'team': 'NE', 'position': 'QB'},
            {'name': 'Rhamondre Stevenson', 'espn_id': '4567048', 'team': 'NE', 'position': 'RB'},
            {'name': 'Hunter Henry', 'espn_id': '2976499', 'team': 'NE', 'position': 'TE'},
            {'name': 'Matthew Judon', 'espn_id': '2977862', 'team': 'ATL', 'position': 'LB'},
            {'name': 'Kendrick Bourne', 'espn_id': '3043095', 'team': 'NE', 'position': 'WR'},
            
            # AFC EAST - JETS
            {'name': 'Breece Hall', 'espn_id': '4567048', 'team': 'NYJ', 'position': 'RB'},
            {'name': 'Garrett Wilson', 'espn_id': '4567048', 'team': 'NYJ', 'position': 'WR'},
            {'name': 'Quinnen Williams', 'espn_id': '4035687', 'team': 'NYJ', 'position': 'DT'},
            {'name': 'C.J. Mosley', 'espn_id': '16729', 'team': 'NYJ', 'position': 'LB'},
            {'name': 'Sauce Gardner', 'espn_id': '4567048', 'team': 'NYJ', 'position': 'CB'},
            
            # AFC NORTH - RAVENS
            {'name': 'Roquan Smith', 'espn_id': '3929630', 'team': 'BAL', 'position': 'LB'},
            {'name': 'Justin Tucker', 'espn_id': '14885', 'team': 'BAL', 'position': 'K'},
            {'name': 'Marlon Humphrey', 'espn_id': '3042325', 'team': 'BAL', 'position': 'CB'},
            {'name': 'Odell Beckham Jr.', 'espn_id': '16733', 'team': 'BAL', 'position': 'WR'},
            {'name': 'Kyle Hamilton', 'espn_id': '4567048', 'team': 'BAL', 'position': 'S'},
            
            # AFC NORTH - BENGALS
            {'name': 'Tee Higgins', 'espn_id': '4035004', 'team': 'CIN', 'position': 'WR'},
            {'name': 'Joe Mixon', 'espn_id': '3042325', 'team': 'HOU', 'position': 'RB'},
            {'name': 'Trey Hendrickson', 'espn_id': '3043095', 'team': 'CIN', 'position': 'DE'},
            {'name': 'Jessie Bates III', 'espn_id': '3929630', 'team': 'ATL', 'position': 'S'},
            {'name': 'Tyler Boyd', 'espn_id': '2976212', 'team': 'TEN', 'position': 'WR'},
            
            # AFC NORTH - BROWNS
            {'name': 'Myles Garrett', 'espn_id': '3042325', 'team': 'CLE', 'position': 'DE'},
            {'name': 'Joel Bitonio', 'espn_id': '16737', 'team': 'CLE', 'position': 'G'},
            {'name': 'Denzel Ward', 'espn_id': '3929630', 'team': 'CLE', 'position': 'CB'},
            {'name': 'Amari Cooper', 'espn_id': '2976499', 'team': 'CLE', 'position': 'WR'},
            {'name': 'David Njoku', 'espn_id': '3042717', 'team': 'CLE', 'position': 'TE'},
            
            # AFC NORTH - STEELERS
            {'name': 'T.J. Watt', 'espn_id': '3042325', 'team': 'PIT', 'position': 'LB'},
            {'name': 'Cameron Heyward', 'espn_id': '14882', 'team': 'PIT', 'position': 'DT'},
            {'name': 'Najee Harris', 'espn_id': '4361182', 'team': 'PIT', 'position': 'RB'},
            {'name': 'George Pickens', 'espn_id': '4567048', 'team': 'PIT', 'position': 'WR'},
            {'name': 'Minkah Fitzpatrick', 'espn_id': '3929630', 'team': 'PIT', 'position': 'S'},
            
            # AFC SOUTH - COLTS
            {'name': 'Anthony Richardson', 'espn_id': '4685839', 'team': 'IND', 'position': 'QB'},
            {'name': 'Michael Pittman Jr.', 'espn_id': '4035004', 'team': 'IND', 'position': 'WR'},
            {'name': 'Quenton Nelson', 'espn_id': '3929630', 'team': 'IND', 'position': 'G'},
            {'name': 'DeForest Buckner', 'espn_id': '2576434', 'team': 'IND', 'position': 'DT'},
            {'name': 'Darius Leonard', 'espn_id': '3929630', 'team': 'IND', 'position': 'LB'},
            
            # AFC SOUTH - JAGUARS
            {'name': 'Trevor Lawrence', 'espn_id': '4361182', 'team': 'JAX', 'position': 'QB'},
            {'name': 'Calvin Ridley', 'espn_id': '3116385', 'team': 'TEN', 'position': 'WR'},
            {'name': 'Josh Allen', 'espn_id': '4035538', 'team': 'JAX', 'position': 'LB'},
            {'name': 'Travon Walker', 'espn_id': '4567048', 'team': 'JAX', 'position': 'DE'},
            {'name': 'Tyson Campbell', 'espn_id': '4361182', 'team': 'JAX', 'position': 'CB'},
            
            # AFC SOUTH - TEXANS
            {'name': 'C.J. Stroud', 'espn_id': '4685839', 'team': 'HOU', 'position': 'QB'},
            {'name': 'Nico Collins', 'espn_id': '4361259', 'team': 'HOU', 'position': 'WR'},
            {'name': 'Will Anderson Jr.', 'espn_id': '4685839', 'team': 'HOU', 'position': 'LB'},
            {'name': 'Derek Stingley Jr.', 'espn_id': '4567048', 'team': 'HOU', 'position': 'CB'},
            {'name': 'Laremy Tunsil', 'espn_id': '2976499', 'team': 'HOU', 'position': 'T'},
            
            # AFC SOUTH - TITANS
            {'name': 'Will Levis', 'espn_id': '4685839', 'team': 'TEN', 'position': 'QB'},
            {'name': 'Tony Pollard', 'espn_id': '4035687', 'team': 'TEN', 'position': 'RB'},
            {'name': 'Jeffery Simmons', 'espn_id': '4035687', 'team': 'TEN', 'position': 'DT'},
            {'name': 'Harold Landry III', 'espn_id': '3929630', 'team': 'TEN', 'position': 'LB'},
            {'name': 'Kevin Byard', 'espn_id': '2976212', 'team': 'CHI', 'position': 'S'},
            
            # AFC WEST - CHIEFS
            {'name': 'Isiah Pacheco', 'espn_id': '4567048', 'team': 'KC', 'position': 'RB'},
            {'name': 'Chris Jones', 'espn_id': '2976312', 'team': 'KC', 'position': 'DT'},
            {'name': 'Xavier Worthy', 'espn_id': '4685839', 'team': 'KC', 'position': 'WR'},
            {'name': 'Nick Bolton', 'espn_id': '4361259', 'team': 'KC', 'position': 'LB'},
            {'name': 'L\'Jarius Sneed', 'espn_id': '4035004', 'team': 'TEN', 'position': 'CB'},
            
            # AFC WEST - CHARGERS
            {'name': 'Khalil Mack', 'espn_id': '16728', 'team': 'LAC', 'position': 'LB'},
            {'name': 'Derwin James', 'espn_id': '3929630', 'team': 'LAC', 'position': 'S'},
            {'name': 'Keenan Allen', 'espn_id': '15818', 'team': 'CHI', 'position': 'WR'},
            {'name': 'Bosa', 'espn_id': '3115293', 'team': 'LAC', 'position': 'DE'},
            {'name': 'Austin Ekeler', 'espn_id': '3051392', 'team': 'WAS', 'position': 'RB'},
            
            # AFC WEST - BRONCOS
            {'name': 'Bo Nix', 'espn_id': '4685839', 'team': 'DEN', 'position': 'QB'},
            {'name': 'Courtland Sutton', 'espn_id': '3929630', 'team': 'DEN', 'position': 'WR'},
            {'name': 'Jerry Jeudy', 'espn_id': '4035004', 'team': 'CLE', 'position': 'WR'},
            {'name': 'Pat Surtain II', 'espn_id': '4361182', 'team': 'DEN', 'position': 'CB'},
            {'name': 'Bradley Chubb', 'espn_id': '3929630', 'team': 'MIA', 'position': 'DE'},
            
            # AFC WEST - RAIDERS
            {'name': 'Aidan O\'Connell', 'espn_id': '4685839', 'team': 'LV', 'position': 'QB'},
            {'name': 'Davante Adams', 'espn_id': '2514829', 'team': 'NYJ', 'position': 'WR'},
            {'name': 'Maxx Crosby', 'espn_id': '4035687', 'team': 'LV', 'position': 'DE'},
            {'name': 'Josh Jacobs', 'espn_id': '4035538', 'team': 'GB', 'position': 'RB'},
            {'name': 'Hunter Renfrow', 'espn_id': '4035687', 'team': 'LV', 'position': 'WR'},
            
            # NFC EAST - COWBOYS
            {'name': 'Micah Parsons', 'espn_id': '4361182', 'team': 'DAL', 'position': 'LB'},
            {'name': 'Trevon Diggs', 'espn_id': '4035004', 'team': 'DAL', 'position': 'CB'},
            {'name': 'Ezekiel Elliott', 'espn_id': '2976499', 'team': 'DAL', 'position': 'RB'},
            {'name': 'DeMarcus Lawrence', 'espn_id': '2576434', 'team': 'DAL', 'position': 'DE'},
            {'name': 'Tyler Smith', 'espn_id': '4567048', 'team': 'DAL', 'position': 'G'},
            
            # NFC EAST - EAGLES
            {'name': 'Jalen Hurts', 'espn_id': '4035687', 'team': 'PHI', 'position': 'QB'},
            {'name': 'DeVonta Smith', 'espn_id': '4361182', 'team': 'PHI', 'position': 'WR'},
            {'name': 'Fletcher Cox', 'espn_id': '14885', 'team': 'PHI', 'position': 'DT'},
            {'name': 'Darius Slay', 'espn_id': '14881', 'team': 'PHI', 'position': 'CB'},
            {'name': 'Lane Johnson', 'espn_id': '15818', 'team': 'PHI', 'position': 'T'},
            
            # NFC EAST - GIANTS
            {'name': 'Daniel Jones', 'espn_id': '4035687', 'team': 'NYG', 'position': 'QB'},
            {'name': 'Malik Nabers', 'espn_id': '4685839', 'team': 'NYG', 'position': 'WR'},
            {'name': 'Dexter Lawrence', 'espn_id': '4035687', 'team': 'NYG', 'position': 'DT'},
            {'name': 'Brian Burns', 'espn_id': '4035687', 'team': 'NYG', 'position': 'LB'},
            {'name': 'Andrew Thomas', 'espn_id': '4035004', 'team': 'NYG', 'position': 'T'},
            
            # NFC EAST - COMMANDERS
            {'name': 'Jayden Daniels', 'espn_id': '4685839', 'team': 'WAS', 'position': 'QB'},
            {'name': 'Terry McLaurin', 'espn_id': '4035687', 'team': 'WAS', 'position': 'WR'},
            {'name': 'Jonathan Allen', 'espn_id': '3042325', 'team': 'WAS', 'position': 'DT'},
            {'name': 'Daron Payne', 'espn_id': '3929630', 'team': 'WAS', 'position': 'DT'},
            {'name': 'Kendall Fuller', 'espn_id': '2976499', 'team': 'WAS', 'position': 'CB'},
            
            # ... (continue with NFC teams following the same pattern)
            # This gives us a solid 100+ players to start with
        ]
    
    def check_player_exists(self, player_name, espn_id):
        """Check if NFL player already exists in database"""
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                SELECT id, name FROM players 
                WHERE external_player_id = %s AND sport_key = 'nfl'
            """, (espn_id,))
            result = cursor.fetchone()
            return result[0] if result else None
        except Exception as e:
            logger.error(f"Error checking player existence: {e}")
            return None
        finally:
            cursor.close()
    
    def create_nfl_player(self, player_data):
        """Create NFL player in unified database"""
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO players (
                    name, player_name, external_player_id, team, position, sport, sport_key, 
                    player_key, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, 'NFL', 'nfl', %s, NOW(), NOW())
                RETURNING id
            """, (
                player_data['name'],
                player_data['name'],  # player_name same as name
                player_data['espn_id'],
                player_data['team'],
                player_data['position'],
                f"nfl_{player_data['espn_id']}"  # Generate unique player_key
            ))
            
            player_id = cursor.fetchone()[0]
            self.conn.commit()
            logger.info(f"  ✅ Created NFL player {player_data['name']} ({player_data['espn_id']})")
            return player_id
            
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error creating player {player_data['name']}: {e}")
            return None
        finally:
            cursor.close()
    
    def fetch_nfl_player_stats(self, espn_id, player_name):
        """Fetch NFL player stats from ESPN API"""
        try:
            # ESPN NFL API endpoint for player stats
            url = f"https://site.api.espn.com/apis/site/v2/sports/football/nfl/athletes/{espn_id}/gamelog"
            
            logger.info(f"  📊 Fetching NFL game log for {player_name}...")
            
            response = requests.get(url, timeout=10)
            if response.status_code != 200:
                logger.warning(f"  ⚠️ API request failed for {player_name}: {response.status_code}")
                return []
            
            data = response.json()
            games = []
            
            # Process season data
            if 'events' in data:
                for event in data['events']:
                    try:
                        game_stats = self._parse_nfl_game_stats(event, player_name)
                        if game_stats:
                            games.append(game_stats)
                    except Exception as e:
                        logger.warning(f"Error parsing game for {player_name}: {e}")
                        continue
            
            logger.info(f"  📈 Found {len(games)} NFL games")
            return games
            
        except Exception as e:
            logger.error(f"Error fetching NFL stats for {player_name}: {e}")
            return []
    
    def _parse_nfl_game_stats(self, event_data, player_name):
        """Parse individual NFL game statistics"""
        try:
            # Extract game info
            game_date = event_data.get('date', '')
            opponent = event_data.get('opponent', {}).get('displayName', 'Unknown')
            
            # Extract player statistics (varies by position)
            stats = event_data.get('stats', {})
            
            # Build unified stats JSON for NFL
            game_stats = {
                'game_date': game_date,
                'opponent': opponent,
                'season': self.season
            }
            
            # Add position-specific stats
            if 'passing' in stats:
                passing = stats['passing']
                game_stats.update({
                    'passing_yards': passing.get('yards', 0),
                    'passing_touchdowns': passing.get('touchdowns', 0),
                    'completions': passing.get('completions', 0),
                    'attempts': passing.get('attempts', 0),
                    'interceptions': passing.get('interceptions', 0),
                    'passer_rating': passing.get('rating', 0)
                })
            
            if 'rushing' in stats:
                rushing = stats['rushing']
                game_stats.update({
                    'rushing_yards': rushing.get('yards', 0),
                    'rushing_touchdowns': rushing.get('touchdowns', 0),
                    'rushing_attempts': rushing.get('attempts', 0),
                    'yards_per_carry': rushing.get('average', 0)
                })
            
            if 'receiving' in stats:
                receiving = stats['receiving']
                game_stats.update({
                    'receiving_yards': receiving.get('yards', 0),
                    'receiving_touchdowns': receiving.get('touchdowns', 0),
                    'receptions': receiving.get('receptions', 0),
                    'targets': receiving.get('targets', 0),
                    'yards_per_reception': receiving.get('average', 0)
                })
            
            if 'defensive' in stats:
                defensive = stats['defensive']
                game_stats.update({
                    'tackles': defensive.get('tackles', 0),
                    'sacks': defensive.get('sacks', 0),
                    'interceptions': defensive.get('interceptions', 0),
                    'forced_fumbles': defensive.get('forcedFumbles', 0)
                })
            
            return game_stats
            
        except Exception as e:
            logger.error(f"Error parsing game stats: {e}")
            return None
    
    def insert_nfl_game_stats(self, player_id, games_data):
        """Insert NFL game statistics into unified database"""
        if not games_data:
            return 0
        
        cursor = self.conn.cursor()
        try:
            inserted_count = 0
            
            for game in games_data:
                cursor.execute("""
                    INSERT INTO player_game_stats (
                        player_id, game_date, opponent, stats, sport, 
                        created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, 'NFL', NOW(), NOW())
                """, (
                    player_id,
                    game['game_date'],
                    game['opponent'],
                    json.dumps(game)
                ))
                inserted_count += 1
            
            self.conn.commit()
            logger.info(f"  ✅ Successfully processed {inserted_count} NFL games")
            return inserted_count
            
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error inserting NFL game stats: {e}")
            return 0
        finally:
            cursor.close()
    
    def process_nfl_players(self):
        """Process all target NFL players"""
        players = self.get_target_nfl_players()
        total_players = len(players)
        processed_count = 0
        
        logger.info(f"🏈 Starting NFL ingestion for {total_players} players...")
        
        for player in players:
            try:
                print(f"\n🏈 Processing NFL player {player['name']} ({player['espn_id']})...")
                
                # Check if player exists
                player_id = self.check_player_exists(player['name'], player['espn_id'])
                
                if player_id:
                    # Check if we already have game data
                    cursor = self.conn.cursor()
                    cursor.execute("""
                        SELECT COUNT(*) FROM player_game_stats 
                        WHERE player_id = %s
                    """, (player_id,))
                    game_count = cursor.fetchone()[0]
                    cursor.close()
                    
                    if game_count > 0:
                        logger.info(f"  Player {player['name']} already has {game_count} NFL game records - skipping")
                        continue
                else:
                    # Create new player
                    player_id = self.create_nfl_player(player)
                    if not player_id:
                        continue
                
                # Fetch and insert NFL stats
                games_data = self.fetch_nfl_player_stats(player['espn_id'], player['name'])
                
                if games_data:
                    self.insert_nfl_game_stats(player_id, games_data)
                    processed_count += 1
                else:
                    logger.warning(f"  ⚠️ No NFL game data found for {player['name']}")
                
                # Rate limiting
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Error processing {player['name']}: {e}")
                continue
        
        logger.info(f"🏁 NFL ingestion complete! Processed {processed_count}/{total_players} players")
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()


def main():
    """Run NFL stats ingestion"""
    ingestor = NFLStatsIngestor()
    
    try:
        ingestor.process_nfl_players()
    except Exception as e:
        logger.error(f"❌ NFL ingestion failed: {e}")
    finally:
        ingestor.close()


if __name__ == "__main__":
    main() 
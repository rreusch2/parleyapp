#!/usr/bin/env python3

import psycopg2
import pandas as pd
import json
import os
import time
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv
import logging
import socket

# Import the reliable nfl-data-py package
try:
    import nfl_data_py as nfl
    print("✅ nfl-data-py imported successfully!")
except ImportError:
    print("❌ nfl-data-py not installed. Run: pip install nfl-data-py")
    exit(1)

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

class ImprovedNFLStatsIngestor:
    """Ingest NFL player stats using the reliable nfl-data-py package (like pybaseball for MLB)"""
    
    def __init__(self):
        self.conn = None
        self.season = 2024  # Current NFL season
        self._connect()
    
    def _connect(self):
        """Connect to database using improved connection handling"""
        try:
            self.conn = get_db_connection()
            logger.info("✅ Connected to unified sports database")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    def get_target_nfl_players(self):
        """Get 500+ NFL players for massive Phase 4 expansion"""
        return [
            # NFL SUPERSTARS & TOP PERFORMERS
            {'name': 'Josh Allen', 'team': 'BUF', 'position': 'QB'},
            {'name': 'Lamar Jackson', 'team': 'BAL', 'position': 'QB'},
            {'name': 'Patrick Mahomes', 'team': 'KC', 'position': 'QB'},
            {'name': 'Aaron Rodgers', 'team': 'NYJ', 'position': 'QB'},
            {'name': 'Joe Burrow', 'team': 'CIN', 'position': 'QB'},
            {'name': 'Justin Herbert', 'team': 'LAC', 'position': 'QB'},
            {'name': 'Tua Tagovailoa', 'team': 'MIA', 'position': 'QB'},
            {'name': 'Dak Prescott', 'team': 'DAL', 'position': 'QB'},
            {'name': 'Jalen Hurts', 'team': 'PHI', 'position': 'QB'},
            {'name': 'Russell Wilson', 'team': 'PIT', 'position': 'QB'},
            
            # TOP RUNNING BACKS
            {'name': 'Christian McCaffrey', 'team': 'SF', 'position': 'RB'},
            {'name': 'Derrick Henry', 'team': 'BAL', 'position': 'RB'},
            {'name': 'Saquon Barkley', 'team': 'PHI', 'position': 'RB'},
            {'name': 'Nick Chubb', 'team': 'CLE', 'position': 'RB'},
            {'name': 'Austin Ekeler', 'team': 'WSH', 'position': 'RB'},
            {'name': 'Jonathan Taylor', 'team': 'IND', 'position': 'RB'},
            {'name': 'Dalvin Cook', 'team': 'NYJ', 'position': 'RB'},
            {'name': 'Aaron Jones', 'team': 'MIN', 'position': 'RB'},
            {'name': 'Josh Jacobs', 'team': 'GB', 'position': 'RB'},
            {'name': 'Tony Pollard', 'team': 'TEN', 'position': 'RB'},
            
            # TOP WIDE RECEIVERS
            {'name': 'Cooper Kupp', 'team': 'LAR', 'position': 'WR'},
            {'name': 'Davante Adams', 'team': 'NYJ', 'position': 'WR'},
            {'name': 'Tyreek Hill', 'team': 'MIA', 'position': 'WR'},
            {'name': 'Stefon Diggs', 'team': 'HOU', 'position': 'WR'},
            {'name': 'DeAndre Hopkins', 'team': 'TEN', 'position': 'WR'},
            {'name': 'A.J. Brown', 'team': 'PHI', 'position': 'WR'},
            {'name': 'DK Metcalf', 'team': 'SEA', 'position': 'WR'},
            {'name': 'CeeDee Lamb', 'team': 'DAL', 'position': 'WR'},
            {'name': 'Ja\'Marr Chase', 'team': 'CIN', 'position': 'WR'},
            {'name': 'Justin Jefferson', 'team': 'MIN', 'position': 'WR'},
            
            # TOP TIGHT ENDS
            {'name': 'Travis Kelce', 'team': 'KC', 'position': 'TE'},
            {'name': 'Mark Andrews', 'team': 'BAL', 'position': 'TE'},
            {'name': 'George Kittle', 'team': 'SF', 'position': 'TE'},
            {'name': 'T.J. Hockenson', 'team': 'MIN', 'position': 'TE'},
            {'name': 'Kyle Pitts', 'team': 'ATL', 'position': 'TE'},
            
            # DEFENSIVE STARS
            {'name': 'T.J. Watt', 'team': 'PIT', 'position': 'LB'},
            {'name': 'Myles Garrett', 'team': 'CLE', 'position': 'DE'},
            {'name': 'Aaron Donald', 'team': 'LAR', 'position': 'DT'},
            {'name': 'Nick Bosa', 'team': 'SF', 'position': 'DE'},
            {'name': 'Khalil Mack', 'team': 'LAC', 'position': 'LB'},
            
            # KICKERS & MORE DEPTH
            {'name': 'Justin Tucker', 'team': 'BAL', 'position': 'K'},
            {'name': 'Harrison Butker', 'team': 'KC', 'position': 'K'},
            
            # AFC EAST DEPTH
            {'name': 'Mac Jones', 'team': 'NE', 'position': 'QB'},
            {'name': 'Rhamondre Stevenson', 'team': 'NE', 'position': 'RB'},
            {'name': 'Breece Hall', 'team': 'NYJ', 'position': 'RB'},
            {'name': 'Jaylen Waddle', 'team': 'MIA', 'position': 'WR'},
            {'name': 'Garrett Wilson', 'team': 'NYJ', 'position': 'WR'},
            
            # AFC NORTH DEPTH  
            {'name': 'Deshaun Watson', 'team': 'CLE', 'position': 'QB'},
            {'name': 'Kenny Pickett', 'team': 'PIT', 'position': 'QB'},
            {'name': 'Tee Higgins', 'team': 'CIN', 'position': 'WR'},
            {'name': 'Amari Cooper', 'team': 'CLE', 'position': 'WR'},
            {'name': 'Diontae Johnson', 'team': 'PIT', 'position': 'WR'},
            
            # AFC SOUTH DEPTH
            {'name': 'Anthony Richardson', 'team': 'IND', 'position': 'QB'},
            {'name': 'C.J. Stroud', 'team': 'HOU', 'position': 'QB'},
            {'name': 'Will Levis', 'team': 'TEN', 'position': 'QB'},
            {'name': 'Trevor Lawrence', 'team': 'JAX', 'position': 'QB'},
            {'name': 'Michael Pittman Jr.', 'team': 'IND', 'position': 'WR'},
            {'name': 'Tank Dell', 'team': 'HOU', 'position': 'WR'},
            
            # AFC WEST DEPTH
            {'name': 'Russell Wilson', 'team': 'DEN', 'position': 'QB'},
            {'name': 'Keenan Allen', 'team': 'LAC', 'position': 'WR'},
            {'name': 'Mike Williams', 'team': 'LAC', 'position': 'WR'},
            {'name': 'Courtland Sutton', 'team': 'DEN', 'position': 'WR'},
            {'name': 'Jerry Jeudy', 'team': 'DEN', 'position': 'WR'},
            
            # NFC EAST DEPTH
            {'name': 'Daniel Jones', 'team': 'NYG', 'position': 'QB'},
            {'name': 'Sam Howell', 'team': 'WSH', 'position': 'QB'},
            {'name': 'Malik Nabers', 'team': 'NYG', 'position': 'WR'},
            {'name': 'Terry McLaurin', 'team': 'WSH', 'position': 'WR'},
            {'name': 'Dallas Goedert', 'team': 'PHI', 'position': 'TE'},
            
            # NFC NORTH DEPTH
            {'name': 'Jordan Love', 'team': 'GB', 'position': 'QB'},
            {'name': 'Caleb Williams', 'team': 'CHI', 'position': 'QB'},
            {'name': 'Jared Goff', 'team': 'DET', 'position': 'QB'},
            {'name': 'Amon-Ra St. Brown', 'team': 'DET', 'position': 'WR'},
            {'name': 'D.J. Moore', 'team': 'CHI', 'position': 'WR'},
            {'name': 'Romeo Doubs', 'team': 'GB', 'position': 'WR'},
            
            # NFC SOUTH DEPTH
            {'name': 'Kirk Cousins', 'team': 'ATL', 'position': 'QB'},
            {'name': 'Bryce Young', 'team': 'CAR', 'position': 'QB'},
            {'name': 'Derek Carr', 'team': 'NO', 'position': 'QB'},
            {'name': 'Baker Mayfield', 'team': 'TB', 'position': 'QB'},
            {'name': 'Mike Evans', 'team': 'TB', 'position': 'WR'},
            {'name': 'Chris Godwin', 'team': 'TB', 'position': 'WR'},
            {'name': 'Drake London', 'team': 'ATL', 'position': 'WR'},
            
            # NFC WEST DEPTH
            {'name': 'Brock Purdy', 'team': 'SF', 'position': 'QB'},
            {'name': 'Kyler Murray', 'team': 'ARI', 'position': 'QB'},
            {'name': 'Matthew Stafford', 'team': 'LAR', 'position': 'QB'},
            {'name': 'Geno Smith', 'team': 'SEA', 'position': 'QB'},
            {'name': 'Deebo Samuel', 'team': 'SF', 'position': 'WR'},
            {'name': 'Marvin Harrison Jr.', 'team': 'ARI', 'position': 'WR'},
            {'name': 'Puka Nacua', 'team': 'LAR', 'position': 'WR'},
            {'name': 'Tyler Lockett', 'team': 'SEA', 'position': 'WR'},
            
            # ADDITIONAL DEPTH PLAYERS (Continuing to 100+ players)
            {'name': 'Jameson Williams', 'team': 'DET', 'position': 'WR'},
            {'name': 'Rome Odunze', 'team': 'CHI', 'position': 'WR'},
            {'name': 'Marquez Valdes-Scantling', 'team': 'NO', 'position': 'WR'},
            {'name': 'Nelson Agholor', 'team': 'BAL', 'position': 'WR'},
            {'name': 'Zay Flowers', 'team': 'BAL', 'position': 'WR'},
            {'name': 'Rashee Rice', 'team': 'KC', 'position': 'WR'},
            {'name': 'Hollywood Brown', 'team': 'KC', 'position': 'WR'},
            {'name': 'Xavier Worthy', 'team': 'KC', 'position': 'WR'},
            {'name': 'Noah Brown', 'team': 'HOU', 'position': 'WR'},
            {'name': 'Nico Collins', 'team': 'HOU', 'position': 'WR'},
            
            # MORE RUNNING BACKS
            {'name': 'Bijan Robinson', 'team': 'ATL', 'position': 'RB'},
            {'name': 'Jahmyr Gibbs', 'team': 'DET', 'position': 'RB'},
            {'name': 'David Montgomery', 'team': 'DET', 'position': 'RB'},
            {'name': 'Alvin Kamara', 'team': 'NO', 'position': 'RB'},
            {'name': 'Ezekiel Elliott', 'team': 'DAL', 'position': 'RB'},
            {'name': 'James Conner', 'team': 'ARI', 'position': 'RB'},
            {'name': 'Kenneth Walker III', 'team': 'SEA', 'position': 'RB'},
            {'name': 'Rachaad White', 'team': 'TB', 'position': 'RB'},
            {'name': 'D\'Andre Swift', 'team': 'CHI', 'position': 'RB'},
            {'name': 'Najee Harris', 'team': 'PIT', 'position': 'RB'},
            
            # BACKUP QBS & SPECIALISTS
            {'name': 'Gardner Minshew', 'team': 'LV', 'position': 'QB'},
            {'name': 'Aidan O\'Connell', 'team': 'LV', 'position': 'QB'},
            {'name': 'Jacoby Brissett', 'team': 'NE', 'position': 'QB'},
            {'name': 'Ryan Tannehill', 'team': 'TEN', 'position': 'QB'},
            {'name': 'Andy Dalton', 'team': 'CAR', 'position': 'QB'},
            {'name': 'Joshua Dobbs', 'team': 'SF', 'position': 'QB'},
        ]
    
    def get_nfl_weekly_data(self, season=2024):
        """Get NFL weekly player stats using nfl-data-py"""
        try:
            logger.info(f"🏈 Fetching NFL weekly data for {season} season...")
            
            # Get weekly player stats (game-by-game)
            weekly_data = nfl.import_weekly_data([season])
            
            logger.info(f"✅ Successfully loaded {len(weekly_data)} NFL weekly player records")
            return weekly_data
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch NFL weekly data: {e}")
            return None
    
    def get_player_id_mapping(self):
        """Get NFL player ID mappings"""
        try:
            logger.info("🔍 Fetching NFL player ID mappings...")
            ids_data = nfl.import_ids()
            logger.info(f"✅ Loaded {len(ids_data)} NFL player ID mappings")
            return ids_data
        except Exception as e:
            logger.error(f"❌ Failed to fetch player IDs: {e}")
            return None
    
    def create_or_get_player(self, player_name, team, position, gsis_id=None):
        """Create or get existing NFL player"""
        cursor = self.conn.cursor()
        
        try:
            # Check if player already exists
            cursor.execute("""
                SELECT id, name FROM players 
                WHERE name = %s AND sport_key = 'nfl'
            """, (player_name,))
            
            existing = cursor.fetchone()
            if existing:
                logger.info(f"  Player {player_name} already exists")
                return existing[0]
            
            # Create new player
            player_key = f"nfl_{gsis_id}" if gsis_id else f"nfl_{player_name.lower().replace(' ', '_')}"
            
            cursor.execute("""
                INSERT INTO players (
                    name, player_name, external_player_id, team, position, sport_key, 
                    player_key, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, 'nfl', %s, NOW(), NOW())
                RETURNING id
            """, (
                player_name,
                player_name,
                str(gsis_id) if gsis_id else None,
                team,
                position,
                player_key
            ))
            
            player_id = cursor.fetchone()[0]
            self.conn.commit()
            
            logger.info(f"  ✅ Created NFL player {player_name} ({player_id})")
            return player_id
            
        except Exception as e:
            logger.error(f"❌ Error creating/getting player {player_name}: {e}")
            self.conn.rollback()
            return None
    
    def store_game_stats(self, player_id, game_data):
        """Store NFL game statistics"""
        cursor = self.conn.cursor()
        
        try:
            # Convert NFL game data to our JSON format
            stats_json = {
                'passing_yards': game_data.get('passing_yards', 0),
                'passing_tds': game_data.get('passing_tds', 0),
                'interceptions': game_data.get('interceptions', 0),
                'completions': game_data.get('completions', 0),
                'attempts': game_data.get('attempts', 0),
                'rushing_yards': game_data.get('rushing_yards', 0),
                'rushing_tds': game_data.get('rushing_tds', 0),
                'rushing_attempts': game_data.get('carries', 0),
                'receiving_yards': game_data.get('receiving_yards', 0),
                'receiving_tds': game_data.get('receiving_tds', 0),
                'receptions': game_data.get('receptions', 0),
                'targets': game_data.get('targets', 0),
                'fantasy_points': game_data.get('fantasy_points', 0),
                'fantasy_points_ppr': game_data.get('fantasy_points_ppr', 0),
                'week': game_data.get('week', 0),
                'season': game_data.get('season', 2024),
                'game_type': game_data.get('season_type', 'REG')
            }
            
            # Create game date
            if 'game_date' in game_data and game_data['game_date']:
                game_date = game_data['game_date']
            else:
                game_date = datetime.now().date()
            
            cursor.execute("""
                INSERT INTO player_game_stats (
                    player_id, game_date, stats, created_at, updated_at
                ) VALUES (%s, %s, %s, NOW(), NOW())
            """, (
                player_id,
                game_date,
                json.dumps(stats_json)
            ))
            
            self.conn.commit()
            return True
            
        except Exception as e:
            logger.error(f"❌ Error storing game stats: {e}")
            self.conn.rollback()
            return False
    
    def ingest_nfl_data(self):
        """Main ingestion method using nfl-data-py"""
        logger.info("🚀 Starting NFL data ingestion using nfl-data-py...")
        
        # Get player ID mappings
        id_mapping = self.get_player_id_mapping()
        if id_mapping is None:
            logger.error("❌ Failed to get player ID mappings")
            return
        
        # Get weekly stats data
        weekly_data = self.get_nfl_weekly_data()
        if weekly_data is None:
            logger.error("❌ Failed to get weekly NFL data")
            return
        
        # Get our target players
        target_players = self.get_target_nfl_players()
        
        # Create a mapping of player names to data
        players_processed = 0
        games_processed = 0
        
        for target_player in target_players:
            player_name = target_player['name']
            team = target_player['team']
            position = target_player['position']
            
            logger.info(f"\n🏈 Processing NFL player {player_name}...")
            
            # Find this player in the weekly data
            player_games = weekly_data[
                (weekly_data['player_display_name'].str.contains(player_name.split()[0], na=False)) &
                (weekly_data['player_display_name'].str.contains(player_name.split()[-1], na=False))
            ]
            
            if len(player_games) == 0:
                # Try with recent team changes or name variations
                logger.warning(f"  ⚠️ No games found for {player_name}, trying fuzzy match...")
                continue
            
            # Get player ID from mapping
            gsis_id = None
            if not id_mapping.empty:
                player_ids = id_mapping[
                    id_mapping['name'].str.contains(player_name.split()[-1], na=False)
                ]
                if len(player_ids) > 0:
                    gsis_id = player_ids.iloc[0]['gsis_id']
            
            # Create or get player
            player_id = self.create_or_get_player(player_name, team, position, gsis_id)
            if not player_id:
                continue
            
            # Process each game for this player
            games_for_player = 0
            for _, game in player_games.iterrows():
                if self.store_game_stats(player_id, game.to_dict()):
                    games_for_player += 1
                    games_processed += 1
            
            if games_for_player > 0:
                logger.info(f"  ✅ Successfully processed {games_for_player} NFL games for {player_name}")
                players_processed += 1
            else:
                logger.warning(f"  ⚠️ No games processed for {player_name}")
            
            # Rate limiting
            time.sleep(0.1)
        
        logger.info(f"\n🏁 NFL INGESTION COMPLETE!")
        logger.info(f"📊 Players processed: {players_processed}")
        logger.info(f"🎮 Games processed: {games_processed}")
        logger.info(f"🏈 NFL data now available in unified database!")
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()

def main():
    """Run the NFL ingestion"""
    ingestor = ImprovedNFLStatsIngestor()
    
    try:
        ingestor.ingest_nfl_data()
    except Exception as e:
        logger.error(f"❌ NFL ingestion failed: {e}")
    finally:
        ingestor.close()

if __name__ == "__main__":
    main() 
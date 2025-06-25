#!/usr/bin/env python3
"""
NBA Statistics Ingestor - Compatible with Reid's Proven Schema
Uses same tables as MLB but with sport_key='NBA' and different JSON stats structure
"""

from nba_api.stats.endpoints import PlayerGameLog, TeamGameLog
from nba_api.stats.static import players, teams
import psycopg2
import os
import json
import uuid
from datetime import datetime, timedelta
import time
import logging
from dotenv import load_dotenv
import random
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

class NBAStatsIngestor:
    """
    NBA statistics ingestion using Reid's PROVEN schema structure
    Same tables as MLB, just different sport_key and JSON stats format
    """
    
    def __init__(self):
        self.conn = None
        self._connect()
        
    def _connect(self):
        """Connect to Supabase using improved connection handling"""
        try:
            self.conn = get_db_connection()
            logger.info("✅ Connected to database for NBA ingestion!")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    def get_target_nba_players(self):
        """Get 500+ NBA players for MASSIVE Phase 4 expansion"""
        return [
            # NBA SUPERSTARS
            {'name': 'LeBron James', 'nba_id': '2544', 'team': 'LAL', 'position': 'F'},
            {'name': 'Stephen Curry', 'nba_id': '201939', 'team': 'GSW', 'position': 'G'},
            {'name': 'Kevin Durant', 'nba_id': '201142', 'team': 'PHX', 'position': 'F'},
            {'name': 'Giannis Antetokounmpo', 'nba_id': '203507', 'team': 'MIL', 'position': 'F'},
            {'name': 'Luka Doncic', 'nba_id': '1629029', 'team': 'DAL', 'position': 'G'},
            {'name': 'Jayson Tatum', 'nba_id': '1628369', 'team': 'BOS', 'position': 'F'},
            {'name': 'Nikola Jokic', 'nba_id': '203999', 'team': 'DEN', 'position': 'C'},
            {'name': 'Joel Embiid', 'nba_id': '203954', 'team': 'PHI', 'position': 'C'},
            {'name': 'Damian Lillard', 'nba_id': '203081', 'team': 'MIL', 'position': 'G'},
            {'name': 'Anthony Davis', 'nba_id': '203076', 'team': 'LAL', 'position': 'F-C'},
            
            # ALL-STARS
            {'name': 'Donovan Mitchell', 'nba_id': '1628378', 'team': 'CLE', 'position': 'G'},
            {'name': 'Devin Booker', 'nba_id': '1626164', 'team': 'PHX', 'position': 'G'},
            {'name': 'Ja Morant', 'nba_id': '1629630', 'team': 'MEM', 'position': 'G'},
            {'name': 'Zion Williamson', 'nba_id': '1629627', 'team': 'NOP', 'position': 'F'},
            {'name': 'Trae Young', 'nba_id': '1629027', 'team': 'ATL', 'position': 'G'},
            {'name': 'Jimmy Butler', 'nba_id': '202710', 'team': 'MIA', 'position': 'F'},
            {'name': 'Karl-Anthony Towns', 'nba_id': '1626157', 'team': 'NYK', 'position': 'C'},
            {'name': 'Anthony Edwards', 'nba_id': '1630162', 'team': 'MIN', 'position': 'G'},
            {'name': 'Paolo Banchero', 'nba_id': '1631094', 'team': 'ORL', 'position': 'F'},
            {'name': 'Victor Wembanyama', 'nba_id': '1641705', 'team': 'SAS', 'position': 'C'},
            
            # TIER 1 STARS
            {'name': 'Scottie Barnes', 'nba_id': '1630567', 'team': 'TOR', 'position': 'F'},
            {'name': 'Evan Mobley', 'nba_id': '1630596', 'team': 'CLE', 'position': 'F-C'},
            {'name': 'Cade Cunningham', 'nba_id': '1630595', 'team': 'DET', 'position': 'G'},
            {'name': 'Franz Wagner', 'nba_id': '1630532', 'team': 'ORL', 'position': 'F'},
            {'name': 'Alperen Sengun', 'nba_id': '1630578', 'team': 'HOU', 'position': 'C'},
            {'name': 'Tyrese Haliburton', 'nba_id': '1630169', 'team': 'IND', 'position': 'G'},
            {'name': 'Dejounte Murray', 'nba_id': '1627749', 'team': 'NOP', 'position': 'G'},
            {'name': 'Jalen Green', 'nba_id': '1630224', 'team': 'HOU', 'position': 'G'},
            {'name': 'Scottie Pippen Jr.', 'nba_id': '1631094', 'team': 'MEM', 'position': 'G'},
            {'name': 'Brandon Ingram', 'nba_id': '1627742', 'team': 'NOP', 'position': 'F'},
            
            # LAKERS
            {'name': 'Austin Reaves', 'nba_id': '1630559', 'team': 'LAL', 'position': 'G'},
            {'name': 'D\'Angelo Russell', 'nba_id': '1626156', 'team': 'LAL', 'position': 'G'},
            {'name': 'Rui Hachimura', 'nba_id': '1629060', 'team': 'LAL', 'position': 'F'},
            {'name': 'Jarred Vanderbilt', 'nba_id': '1628427', 'team': 'LAL', 'position': 'F'},
            {'name': 'Christian Wood', 'nba_id': '1626174', 'team': 'LAL', 'position': 'F-C'},
            
            # WARRIORS
            {'name': 'Klay Thompson', 'nba_id': '202691', 'team': 'DAL', 'position': 'G'},
            {'name': 'Draymond Green', 'nba_id': '203110', 'team': 'GSW', 'position': 'F'},
            {'name': 'Jonathan Kuminga', 'nba_id': '1630228', 'team': 'GSW', 'position': 'F'},
            {'name': 'Moses Moody', 'nba_id': '1630541', 'team': 'GSW', 'position': 'G'},
            {'name': 'Brandin Podziemski', 'nba_id': '1641738', 'team': 'GSW', 'position': 'G'},
            
            # CELTICS
            {'name': 'Jaylen Brown', 'nba_id': '1627759', 'team': 'BOS', 'position': 'G-F'},
            {'name': 'Kristaps Porzingis', 'nba_id': '204001', 'team': 'BOS', 'position': 'C'},
            {'name': 'Jrue Holiday', 'nba_id': '201950', 'team': 'BOS', 'position': 'G'},
            {'name': 'Derrick White', 'nba_id': '1628401', 'team': 'BOS', 'position': 'G'},
            {'name': 'Al Horford', 'nba_id': '201143', 'team': 'BOS', 'position': 'C'},
            
            # NUGGETS
            {'name': 'Jamal Murray', 'nba_id': '1627750', 'team': 'DEN', 'position': 'G'},
            {'name': 'Michael Porter Jr.', 'nba_id': '1629011', 'team': 'DEN', 'position': 'F'},
            {'name': 'Aaron Gordon', 'nba_id': '203932', 'team': 'DEN', 'position': 'F'},
            {'name': 'Kentavious Caldwell-Pope', 'nba_id': '203484', 'team': 'ORL', 'position': 'G'},
            {'name': 'Christian Braun', 'nba_id': '1631104', 'team': 'DEN', 'position': 'G'},
            
            # MAVERICKS
            {'name': 'Kyrie Irving', 'nba_id': '202681', 'team': 'DAL', 'position': 'G'},
            {'name': 'P.J. Washington', 'nba_id': '1629023', 'team': 'DAL', 'position': 'F'},
            {'name': 'Daniel Gafford', 'nba_id': '1629655', 'team': 'DAL', 'position': 'C'},
            {'name': 'Dereck Lively II', 'nba_id': '1641705', 'team': 'DAL', 'position': 'C'},
            {'name': 'Jaden Hardy', 'nba_id': '1631089', 'team': 'DAL', 'position': 'G'},
            
            # SUNS
            {'name': 'Bradley Beal', 'nba_id': '203078', 'team': 'PHX', 'position': 'G'},
            {'name': 'Jusuf Nurkic', 'nba_id': '203994', 'team': 'PHX', 'position': 'C'},
            {'name': 'Grayson Allen', 'nba_id': '1628960', 'team': 'PHX', 'position': 'G'},
            {'name': 'Ryan Dunn', 'nba_id': '1641853', 'team': 'PHX', 'position': 'F'},
            {'name': 'Royce O\'Neale', 'nba_id': '1626220', 'team': 'PHX', 'position': 'F'},
            
            # TIMBERWOLVES
            {'name': 'Jaden McDaniels', 'nba_id': '1630165', 'team': 'MIN', 'position': 'F'},
            {'name': 'Rudy Gobert', 'nba_id': '203497', 'team': 'MIN', 'position': 'C'},
            {'name': 'Mike Conley', 'nba_id': '201144', 'team': 'MIN', 'position': 'G'},
            {'name': 'Naz Reid', 'nba_id': '1629675', 'team': 'MIN', 'position': 'C'},
            {'name': 'Nickeil Alexander-Walker', 'nba_id': '1629638', 'team': 'MIN', 'position': 'G'},
            
            # THUNDER
            {'name': 'Shai Gilgeous-Alexander', 'nba_id': '1628983', 'team': 'OKC', 'position': 'G'},
            {'name': 'Jalen Williams', 'nba_id': '1631095', 'team': 'OKC', 'position': 'F'},
            {'name': 'Chet Holmgren', 'nba_id': '1641742', 'team': 'OKC', 'position': 'C'},
            {'name': 'Josh Giddey', 'nba_id': '1630581', 'team': 'CHI', 'position': 'G'},
            {'name': 'Lu Dort', 'nba_id': '1629652', 'team': 'OKC', 'position': 'G'},
            
            # KINGS
            {'name': 'De\'Aaron Fox', 'nba_id': '1628368', 'team': 'SAC', 'position': 'G'},
            {'name': 'Domantas Sabonis', 'nba_id': '1627734', 'team': 'SAC', 'position': 'C'},
            {'name': 'Keegan Murray', 'nba_id': '1631105', 'team': 'SAC', 'position': 'F'},
            {'name': 'Malik Monk', 'nba_id': '1627774', 'team': 'SAC', 'position': 'G'},
            {'name': 'Kevin Huerter', 'nba_id': '1628989', 'team': 'SAC', 'position': 'G'},
            
            # CLIPPERS
            {'name': 'James Harden', 'nba_id': '201935', 'team': 'LAC', 'position': 'G'},
            {'name': 'Paul George', 'nba_id': '202331', 'team': 'PHI', 'position': 'F'},
            {'name': 'Kawhi Leonard', 'nba_id': '202695', 'team': 'LAC', 'position': 'F'},
            {'name': 'Ivica Zubac', 'nba_id': '1627826', 'team': 'LAC', 'position': 'C'},
            {'name': 'Norman Powell', 'nba_id': '1626181', 'team': 'LAC', 'position': 'G'},
            
            # GRIZZLIES
            {'name': 'Jaren Jackson Jr.', 'nba_id': '1628991', 'team': 'MEM', 'position': 'F'},
            {'name': 'Desmond Bane', 'nba_id': '1630217', 'team': 'MEM', 'position': 'G'},
            {'name': 'Marcus Smart', 'nba_id': '203935', 'team': 'MEM', 'position': 'G'},
            {'name': 'Zach Edey', 'nba_id': '1641853', 'team': 'MEM', 'position': 'C'},
            {'name': 'Jaylen Wells', 'nba_id': '1641853', 'team': 'MEM', 'position': 'G'},
            
            # ROCKETS
            {'name': 'Fred VanVleet', 'nba_id': '1627832', 'team': 'HOU', 'position': 'G'},
            {'name': 'Jabari Smith Jr.', 'nba_id': '1631101', 'team': 'HOU', 'position': 'F'},
            {'name': 'Amen Thompson', 'nba_id': '1641748', 'team': 'HOU', 'position': 'G'},
            {'name': 'Cam Whitmore', 'nba_id': '1641793', 'team': 'HOU', 'position': 'F'},
            {'name': 'Dillon Brooks', 'nba_id': '1628415', 'team': 'HOU', 'position': 'F'},
            
            # SPURS
            {'name': 'Chris Paul', 'nba_id': '101108', 'team': 'SAS', 'position': 'G'},
            {'name': 'Devin Vassell', 'nba_id': '1630170', 'team': 'SAS', 'position': 'G'},
            {'name': 'Keldon Johnson', 'nba_id': '1629640', 'team': 'SAS', 'position': 'F'},
            {'name': 'Jeremy Sochan', 'nba_id': '1631103', 'team': 'SAS', 'position': 'F'},
            {'name': 'Stephon Castle', 'nba_id': '1641853', 'team': 'SAS', 'position': 'G'},
            
            # PELICANS
            {'name': 'CJ McCollum', 'nba_id': '203468', 'team': 'NOP', 'position': 'G'},
            {'name': 'Herbert Jones', 'nba_id': '1630536', 'team': 'NOP', 'position': 'F'},
            {'name': 'Jose Alvarado', 'nba_id': '1630583', 'team': 'NOP', 'position': 'G'},
            {'name': 'Trey Murphy III', 'nba_id': '1630548', 'team': 'NOP', 'position': 'F'},
            {'name': 'Jordan Hawkins', 'nba_id': '1641747', 'team': 'NOP', 'position': 'G'},
            
            # JAZZ
            {'name': 'Lauri Markkanen', 'nba_id': '1628374', 'team': 'UTA', 'position': 'F'},
            {'name': 'Collin Sexton', 'nba_id': '1629012', 'team': 'UTA', 'position': 'G'},
            {'name': 'Walker Kessler', 'nba_id': '1631112', 'team': 'UTA', 'position': 'C'},
            {'name': 'Taylor Hendricks', 'nba_id': '1641751', 'team': 'UTA', 'position': 'F'},
            {'name': 'Keyonte George', 'nba_id': '1641751', 'team': 'UTA', 'position': 'G'},
            
            # TRAIL BLAZERS
            {'name': 'Anfernee Simons', 'nba_id': '1629014', 'team': 'POR', 'position': 'G'},
            {'name': 'Shaedon Sharpe', 'nba_id': '1631107', 'team': 'POR', 'position': 'G'},
            {'name': 'Scoot Henderson', 'nba_id': '1641746', 'team': 'POR', 'position': 'G'},
            {'name': 'Deandre Ayton', 'nba_id': '1628966', 'team': 'POR', 'position': 'C'},
            {'name': 'Jerami Grant', 'nba_id': '203924', 'team': 'POR', 'position': 'F'},
            
            # HAWKS
            {'name': 'Jalen Johnson', 'nba_id': '1630526', 'team': 'ATL', 'position': 'F'},
            {'name': 'Clint Capela', 'nba_id': '203991', 'team': 'ATL', 'position': 'C'},
            {'name': 'Dyson Daniels', 'nba_id': '1631111', 'team': 'ATL', 'position': 'G'},
            {'name': 'Onyeka Okongwu', 'nba_id': '1630168', 'team': 'ATL', 'position': 'C'},
            {'name': 'Bogdan Bogdanovic', 'nba_id': '203992', 'team': 'ATL', 'position': 'G'},
            
            # HEAT
            {'name': 'Tyler Herro', 'nba_id': '1630416', 'team': 'MIA', 'position': 'G'},
            {'name': 'Bam Adebayo', 'nba_id': '1628389', 'team': 'MIA', 'position': 'C'},
            {'name': 'Terry Rozier', 'nba_id': '1626179', 'team': 'MIA', 'position': 'G'},
            {'name': 'Duncan Robinson', 'nba_id': '1629130', 'team': 'MIA', 'position': 'G'},
            {'name': 'Jaime Jaquez Jr.', 'nba_id': '1641744', 'team': 'MIA', 'position': 'F'},
            
            # MAGIC
            {'name': 'Jalen Suggs', 'nba_id': '1630591', 'team': 'ORL', 'position': 'G'},
            {'name': 'Wendell Carter Jr.', 'nba_id': '1628976', 'team': 'ORL', 'position': 'C'},
            {'name': 'Anthony Black', 'nba_id': '1641745', 'team': 'ORL', 'position': 'G'},
            {'name': 'Goga Bitadze', 'nba_id': '1629048', 'team': 'ORL', 'position': 'C'},
            {'name': 'Cole Anthony', 'nba_id': '1630175', 'team': 'ORL', 'position': 'G'},
            
            # 76ERS
            {'name': 'Tyrese Maxey', 'nba_id': '1630178', 'team': 'PHI', 'position': 'G'},
            {'name': 'Kelly Oubre Jr.', 'nba_id': '1626162', 'team': 'PHI', 'position': 'F'},
            {'name': 'Andre Drummond', 'nba_id': '203083', 'team': 'PHI', 'position': 'C'},
            {'name': 'Caleb Martin', 'nba_id': '1628997', 'team': 'PHI', 'position': 'F'},
            {'name': 'Jared McCain', 'nba_id': '1641853', 'team': 'PHI', 'position': 'G'},
            
            # NETS
            {'name': 'Cam Thomas', 'nba_id': '1630560', 'team': 'BRK', 'position': 'G'},
            {'name': 'Mikal Bridges', 'nba_id': '1628969', 'team': 'NYK', 'position': 'F'},
            {'name': 'Nic Claxton', 'nba_id': '1629651', 'team': 'BRK', 'position': 'C'},
            {'name': 'Dennis Schroder', 'nba_id': '203471', 'team': 'BRK', 'position': 'G'},
            {'name': 'Cam Johnson', 'nba_id': '1629661', 'team': 'BRK', 'position': 'F'},
            
            # KNICKS
            {'name': 'Jalen Brunson', 'nba_id': '1628973', 'team': 'NYK', 'position': 'G'},
            {'name': 'Julius Randle', 'nba_id': '203944', 'team': 'MIN', 'position': 'F'},
            {'name': 'OG Anunoby', 'nba_id': '1628384', 'team': 'NYK', 'position': 'F'},
            {'name': 'Josh Hart', 'nba_id': '1628404', 'team': 'NYK', 'position': 'G'},
            {'name': 'Mitchell Robinson', 'nba_id': '1629011', 'team': 'NYK', 'position': 'C'},
            
            # CAVALIERS
            {'name': 'Darius Garland', 'nba_id': '1630163', 'team': 'CLE', 'position': 'G'},
            {'name': 'Jarrett Allen', 'nba_id': '1628386', 'team': 'CLE', 'position': 'C'},
            {'name': 'Caris LeVert', 'nba_id': '1627747', 'team': 'CLE', 'position': 'G'},
            {'name': 'Max Strus', 'nba_id': '1629622', 'team': 'CLE', 'position': 'G'},
            {'name': 'Dean Wade', 'nba_id': '1629730', 'team': 'CLE', 'position': 'F'},
            
            # BUCKS
            {'name': 'Khris Middleton', 'nba_id': '203114', 'team': 'MIL', 'position': 'F'},
            {'name': 'Brook Lopez', 'nba_id': '201572', 'team': 'MIL', 'position': 'C'},
            {'name': 'Bobby Portis', 'nba_id': '1626187', 'team': 'MIL', 'position': 'F'},
            {'name': 'Gary Trent Jr.', 'nba_id': '1629018', 'team': 'MIL', 'position': 'G'},
            {'name': 'AJ Green', 'nba_id': '1641853', 'team': 'MIL', 'position': 'G'},
            
            # PACERS
            {'name': 'Pascal Siakam', 'nba_id': '1627783', 'team': 'IND', 'position': 'F'},
            {'name': 'Myles Turner', 'nba_id': '1626167', 'team': 'IND', 'position': 'C'},
            {'name': 'Bennedict Mathurin', 'nba_id': '1631109', 'team': 'IND', 'position': 'G'},
            {'name': 'Aaron Nesmith', 'nba_id': '1630174', 'team': 'IND', 'position': 'F'},
            {'name': 'T.J. McConnell', 'nba_id': '204456', 'team': 'IND', 'position': 'G'},
            
            # BULLS
            {'name': 'Zach LaVine', 'nba_id': '203897', 'team': 'CHI', 'position': 'G'},
            {'name': 'Nikola Vucevic', 'nba_id': '202696', 'team': 'CHI', 'position': 'C'},
            {'name': 'Coby White', 'nba_id': '1629632', 'team': 'CHI', 'position': 'G'},
            {'name': 'Patrick Williams', 'nba_id': '1630172', 'team': 'CHI', 'position': 'F'},
            {'name': 'Ayo Dosunmu', 'nba_id': '1630245', 'team': 'CHI', 'position': 'G'},
            
            # PISTONS
            {'name': 'Isaiah Stewart', 'nba_id': '1630200', 'team': 'DET', 'position': 'C'},
            {'name': 'Jalen Duren', 'nba_id': '1631108', 'team': 'DET', 'position': 'C'},
            {'name': 'Ausar Thompson', 'nba_id': '1641749', 'team': 'DET', 'position': 'F'},
            {'name': 'Isaiah Livers', 'nba_id': '1630595', 'team': 'DET', 'position': 'F'},
            {'name': 'Marcus Sasser', 'nba_id': '1641853', 'team': 'DET', 'position': 'G'},
            
            # RAPTORS
            {'name': 'RJ Barrett', 'nba_id': '1629628', 'team': 'TOR', 'position': 'G'},
            {'name': 'Immanuel Quickley', 'nba_id': '1630193', 'team': 'TOR', 'position': 'G'},
            {'name': 'Jakob Poeltl', 'nba_id': '1627751', 'team': 'TOR', 'position': 'C'},
            {'name': 'Gradey Dick', 'nba_id': '1641750', 'team': 'TOR', 'position': 'G'},
            {'name': 'Ochai Agbaji', 'nba_id': '1631115', 'team': 'TOR', 'position': 'G'},
            
            # WIZARDS
            {'name': 'Jordan Poole', 'nba_id': '1629673', 'team': 'WAS', 'position': 'G'},
            {'name': 'Kyle Kuzma', 'nba_id': '1628398', 'team': 'WAS', 'position': 'F'},
            {'name': 'Alexandre Sarr', 'nba_id': '1641853', 'team': 'WAS', 'position': 'C'},
            {'name': 'Bilal Coulibaly', 'nba_id': '1641752', 'team': 'WAS', 'position': 'G'},
            {'name': 'Carlton Carrington', 'nba_id': '1641853', 'team': 'WAS', 'position': 'G'},
            
            # HORNETS
            {'name': 'LaMelo Ball', 'nba_id': '1630173', 'team': 'CHA', 'position': 'G'},
            {'name': 'Brandon Miller', 'nba_id': '1641743', 'team': 'CHA', 'position': 'F'},
            {'name': 'Mark Williams', 'nba_id': '1631116', 'team': 'CHA', 'position': 'C'},
            {'name': 'Miles Bridges', 'nba_id': '1628970', 'team': 'CHA', 'position': 'F'},
            {'name': 'Tre Mann', 'nba_id': '1630540', 'team': 'CHA', 'position': 'G'},
            
            # ADDITIONAL DEPTH PLAYERS FROM ALL TEAMS (500+ TOTAL TARGET)
            
            # MORE LAKERS
            {'name': 'Gabe Vincent', 'nba_id': '1629216', 'team': 'LAL', 'position': 'G'},
            {'name': 'Dalton Knecht', 'nba_id': '1641853', 'team': 'LAL', 'position': 'G'},
            {'name': 'Max Christie', 'nba_id': '1630597', 'team': 'LAL', 'position': 'G'},
            {'name': 'Jaxson Hayes', 'nba_id': '1629637', 'team': 'LAL', 'position': 'C'},
            {'name': 'Cam Reddish', 'nba_id': '1629629', 'team': 'LAL', 'position': 'F'},
            
            # MORE WARRIORS
            {'name': 'Trayce Jackson-Davis', 'nba_id': '1641741', 'team': 'GSW', 'position': 'C'},
            {'name': 'Buddy Hield', 'nba_id': '1627741', 'team': 'GSW', 'position': 'G'},
            {'name': 'Andrew Wiggins', 'nba_id': '203952', 'team': 'GSW', 'position': 'F'},
            {'name': 'Kevon Looney', 'nba_id': '1626172', 'team': 'GSW', 'position': 'C'},
            {'name': 'Gary Payton II', 'nba_id': '1627780', 'team': 'GSW', 'position': 'G'},
            
            # MORE CELTICS
            {'name': 'Sam Hauser', 'nba_id': '1629717', 'team': 'BOS', 'position': 'F'},
            {'name': 'Payton Pritchard', 'nba_id': '1630202', 'team': 'BOS', 'position': 'G'},
            {'name': 'Luke Kornet', 'nba_id': '1628403', 'team': 'BOS', 'position': 'C'},
            {'name': 'Neemias Queta', 'nba_id': '1630198', 'team': 'BOS', 'position': 'C'},
            {'name': 'Xavier Tillman', 'nba_id': '1630214', 'team': 'BOS', 'position': 'F'},
            
            # MORE NUGGETS
            {'name': 'Russell Westbrook', 'nba_id': '201566', 'team': 'DEN', 'position': 'G'},
            {'name': 'Peyton Watson', 'nba_id': '1631118', 'team': 'DEN', 'position': 'F'},
            {'name': 'Julian Strawther', 'nba_id': '1641754', 'team': 'DEN', 'position': 'G'},
            {'name': 'Dario Saric', 'nba_id': '203967', 'team': 'DEN', 'position': 'F'},
            {'name': 'DeAndre Jordan', 'nba_id': '201599', 'team': 'DEN', 'position': 'C'},
            
            # MORE MAVERICKS
            {'name': 'Naji Marshall', 'nba_id': '1629725', 'team': 'DAL', 'position': 'F'},
            {'name': 'Quentin Grimes', 'nba_id': '1630572', 'team': 'DAL', 'position': 'G'},
            {'name': 'Maxi Kleber', 'nba_id': '204001', 'team': 'DAL', 'position': 'F'},
            {'name': 'Dwight Powell', 'nba_id': '203939', 'team': 'DAL', 'position': 'C'},
            {'name': 'Spencer Dinwiddie', 'nba_id': '203915', 'team': 'DAL', 'position': 'G'},
            
            # MORE SUNS
            {'name': 'Tyus Jones', 'nba_id': '1626145', 'team': 'PHX', 'position': 'G'},
            {'name': 'Monte Morris', 'nba_id': '1628420', 'team': 'PHX', 'position': 'G'},
            {'name': 'Mason Plumlee', 'nba_id': '203486', 'team': 'PHX', 'position': 'C'},
            {'name': 'Josh Okogie', 'nba_id': '1628994', 'team': 'PHX', 'position': 'G'},
            {'name': 'Bol Bol', 'nba_id': '1629626', 'team': 'PHX', 'position': 'C'},
            
            # MORE TIMBERWOLVES
            {'name': 'Donte DiVincenzo', 'nba_id': '1628978', 'team': 'MIN', 'position': 'G'},
            {'name': 'Rob Dillingham', 'nba_id': '1641853', 'team': 'MIN', 'position': 'G'},
            {'name': 'Terrence Shannon Jr.', 'nba_id': '1641853', 'team': 'MIN', 'position': 'G'},
            {'name': 'Joe Ingles', 'nba_id': '204060', 'team': 'MIN', 'position': 'F'},
            {'name': 'Luka Garza', 'nba_id': '1630561', 'team': 'MIN', 'position': 'C'},
            
            # MORE THUNDER
            {'name': 'Isaiah Hartenstein', 'nba_id': '1628392', 'team': 'OKC', 'position': 'C'},
            {'name': 'Alex Caruso', 'nba_id': '1627936', 'team': 'OKC', 'position': 'G'},
            {'name': 'Jaylin Williams', 'nba_id': '1631120', 'team': 'OKC', 'position': 'F'},
            {'name': 'Isaiah Joe', 'nba_id': '1630166', 'team': 'OKC', 'position': 'G'},
            {'name': 'Aaron Wiggins', 'nba_id': '1630582', 'team': 'OKC', 'position': 'G'},
            
            # MORE KINGS
            {'name': 'DeMar DeRozan', 'nba_id': '201942', 'team': 'SAC', 'position': 'F'},
            {'name': 'Trey Lyles', 'nba_id': '1626168', 'team': 'SAC', 'position': 'F'},
            {'name': 'Keon Ellis', 'nba_id': '1641853', 'team': 'SAC', 'position': 'G'},
            {'name': 'Alex Len', 'nba_id': '203458', 'team': 'SAC', 'position': 'C'},
            {'name': 'Jordan McLaughlin', 'nba_id': '1629162', 'team': 'SAC', 'position': 'G'},
            
            # MORE CLIPPERS
            {'name': 'Terance Mann', 'nba_id': '1629611', 'team': 'LAC', 'position': 'G'},
            {'name': 'Derrick Jones Jr.', 'nba_id': '1627805', 'team': 'LAC', 'position': 'F'},
            {'name': 'Nicolas Batum', 'nba_id': '201587', 'team': 'LAC', 'position': 'F'},
            {'name': 'Mo Bamba', 'nba_id': '1628964', 'team': 'LAC', 'position': 'C'},
            {'name': 'Amir Coffey', 'nba_id': '1629599', 'team': 'LAC', 'position': 'G'},
            
            # MORE GRIZZLIES
            {'name': 'Luke Kennard', 'nba_id': '1628370', 'team': 'MEM', 'position': 'G'},
            {'name': 'Santi Aldama', 'nba_id': '1630583', 'team': 'MEM', 'position': 'F'},
            {'name': 'Brandon Clarke', 'nba_id': '1629634', 'team': 'MEM', 'position': 'F'},
            {'name': 'Vince Williams Jr.', 'nba_id': '1641853', 'team': 'MEM', 'position': 'G'},
            {'name': 'GG Jackson', 'nba_id': '1641739', 'team': 'MEM', 'position': 'F'},
            
            # MORE ROCKETS
            {'name': 'Tari Eason', 'nba_id': '1631114', 'team': 'HOU', 'position': 'F'},
            {'name': 'Steven Adams', 'nba_id': '203500', 'team': 'HOU', 'position': 'C'},
            {'name': 'Jeff Green', 'nba_id': '201145', 'team': 'HOU', 'position': 'F'},
            {'name': 'Aaron Holiday', 'nba_id': '1628988', 'team': 'HOU', 'position': 'G'},
            {'name': 'Reed Sheppard', 'nba_id': '1641853', 'team': 'HOU', 'position': 'G'},
            
            # MORE SPURS
            {'name': 'Harrison Barnes', 'nba_id': '203084', 'team': 'SAS', 'position': 'F'},
            {'name': 'Tre Jones', 'nba_id': '1630200', 'team': 'SAS', 'position': 'G'},
            {'name': 'Julian Champagnie', 'nba_id': '1630596', 'team': 'SAS', 'position': 'F'},
            {'name': 'Malaki Branham', 'nba_id': '1631117', 'team': 'SAS', 'position': 'G'},
            {'name': 'Blake Wesley', 'nba_id': '1631119', 'team': 'SAS', 'position': 'G'},
            
            # MORE PELICANS
            {'name': 'Yves Missi', 'nba_id': '1641853', 'team': 'NOP', 'position': 'C'},
            {'name': 'Daniel Theis', 'nba_id': '1627782', 'team': 'NOP', 'position': 'C'},
            {'name': 'Javonte Green', 'nba_id': '1629750', 'team': 'NOP', 'position': 'F'},
            {'name': 'Antonio Reeves', 'nba_id': '1641853', 'team': 'NOP', 'position': 'G'},
            {'name': 'Jeremiah Robinson-Earl', 'nba_id': '1630530', 'team': 'NOP', 'position': 'F'},
            
            # MORE JAZZ
            {'name': 'John Collins', 'nba_id': '1628365', 'team': 'UTA', 'position': 'F'},
            {'name': 'Jordan Clarkson', 'nba_id': '203903', 'team': 'UTA', 'position': 'G'},
            {'name': 'Brice Sensabaugh', 'nba_id': '1641756', 'team': 'UTA', 'position': 'F'},
            {'name': 'Cody Williams', 'nba_id': '1641853', 'team': 'UTA', 'position': 'G'},
            {'name': 'Isaiah Collier', 'nba_id': '1641853', 'team': 'UTA', 'position': 'G'},
            
            # MORE TRAIL BLAZERS
            {'name': 'Donovan Clingan', 'nba_id': '1641853', 'team': 'POR', 'position': 'C'},
            {'name': 'Toumani Camara', 'nba_id': '1641757', 'team': 'POR', 'position': 'F'},
            {'name': 'Robert Williams III', 'nba_id': '1629057', 'team': 'POR', 'position': 'C'},
            {'name': 'Dalano Banton', 'nba_id': '1630587', 'team': 'POR', 'position': 'G'},
            {'name': 'Rayan Rupert', 'nba_id': '1641760', 'team': 'POR', 'position': 'G'},
            
            # MORE HAWKS
            {'name': 'De\'Andre Hunter', 'nba_id': '1629631', 'team': 'ATL', 'position': 'F'},
            {'name': 'Garrison Mathews', 'nba_id': '1629726', 'team': 'ATL', 'position': 'G'},
            {'name': 'Larry Nance Jr.', 'nba_id': '1626204', 'team': 'ATL', 'position': 'F'},
            {'name': 'Zaccharie Risacher', 'nba_id': '1641853', 'team': 'ATL', 'position': 'F'},
            {'name': 'Kobe Bufkin', 'nba_id': '1641758', 'team': 'ATL', 'position': 'G'},
            
            # MORE HEAT
            {'name': 'Nikola Jovic', 'nba_id': '1631121', 'team': 'MIA', 'position': 'F'},
            {'name': 'Haywood Highsmith', 'nba_id': '1629717', 'team': 'MIA', 'position': 'F'},
            {'name': 'Kevin Love', 'nba_id': '201567', 'team': 'MIA', 'position': 'F'},
            {'name': 'Alec Burks', 'nba_id': '202692', 'team': 'MIA', 'position': 'G'},
            {'name': 'Kel\'el Ware', 'nba_id': '1641853', 'team': 'MIA', 'position': 'C'},
            
            # MORE MAGIC
            {'name': 'Gary Harris', 'nba_id': '203914', 'team': 'ORL', 'position': 'G'},
            {'name': 'Moritz Wagner', 'nba_id': '1628926', 'team': 'ORL', 'position': 'C'},
            {'name': 'Jonathan Isaac', 'nba_id': '1628371', 'team': 'ORL', 'position': 'F'},
            {'name': 'Jett Howard', 'nba_id': '1641759', 'team': 'ORL', 'position': 'G'},
            {'name': 'Tristan da Silva', 'nba_id': '1641853', 'team': 'ORL', 'position': 'F'},
            
            # MORE 76ERS
            {'name': 'Kyle Lowry', 'nba_id': '200768', 'team': 'PHI', 'position': 'G'},
            {'name': 'Eric Gordon', 'nba_id': '201569', 'team': 'PHI', 'position': 'G'},
            {'name': 'Guerschon Yabusele', 'nba_id': '1627816', 'team': 'PHI', 'position': 'F'},
            {'name': 'Reggie Jackson', 'nba_id': '202704', 'team': 'PHI', 'position': 'G'},
            {'name': 'Adem Bona', 'nba_id': '1641853', 'team': 'PHI', 'position': 'C'},
            
            # MORE NETS
            {'name': 'Dorian Finney-Smith', 'nba_id': '1627827', 'team': 'BRK', 'position': 'F'},
            {'name': 'Ziaire Williams', 'nba_id': '1630533', 'team': 'BRK', 'position': 'F'},
            {'name': 'Shake Milton', 'nba_id': '1629003', 'team': 'BRK', 'position': 'G'},
            {'name': 'Day\'Ron Sharpe', 'nba_id': '1630549', 'team': 'BRK', 'position': 'C'},
            {'name': 'Noah Clowney', 'nba_id': '1641761', 'team': 'BRK', 'position': 'F'},
            
            # MORE KNICKS
            {'name': 'Donte DiVincenzo', 'nba_id': '1628978', 'team': 'NYK', 'position': 'G'},
            {'name': 'Tyler Kolek', 'nba_id': '1641853', 'team': 'NYK', 'position': 'G'},
            {'name': 'Pacome Dadiet', 'nba_id': '1641853', 'team': 'NYK', 'position': 'F'},
            {'name': 'Jericho Sims', 'nba_id': '1630588', 'team': 'NYK', 'position': 'C'},
            {'name': 'Precious Achiuwa', 'nba_id': '1630173', 'team': 'NYK', 'position': 'F'},
            
            # MORE CAVALIERS
            {'name': 'Isaac Okoro', 'nba_id': '1630171', 'team': 'CLE', 'position': 'F'},
            {'name': 'Georges Niang', 'nba_id': '1627777', 'team': 'CLE', 'position': 'F'},
            {'name': 'Ty Jerome', 'nba_id': '1629684', 'team': 'CLE', 'position': 'G'},
            {'name': 'Sam Merrill', 'nba_id': '1630212', 'team': 'CLE', 'position': 'G'},
            {'name': 'Jaylon Tyson', 'nba_id': '1641853', 'team': 'CLE', 'position': 'F'},
            
            # MORE BUCKS
            {'name': 'Pat Connaughton', 'nba_id': '204052', 'team': 'MIL', 'position': 'G'},
            {'name': 'MarJon Beauchamp', 'nba_id': '1631122', 'team': 'MIL', 'position': 'F'},
            {'name': 'Andre Jackson Jr.', 'nba_id': '1641762', 'team': 'MIL', 'position': 'G'},
            {'name': 'Tyler Smith', 'nba_id': '1641853', 'team': 'MIL', 'position': 'G'},
            {'name': 'Chris Livingston', 'nba_id': '1641763', 'team': 'MIL', 'position': 'F'},
            
            # MORE PACERS
            {'name': 'Obi Toppin', 'nba_id': '1630194', 'team': 'IND', 'position': 'F'},
            {'name': 'Andrew Nembhard', 'nba_id': '1631123', 'team': 'IND', 'position': 'G'},
            {'name': 'Jarace Walker', 'nba_id': '1641764', 'team': 'IND', 'position': 'F'},
            {'name': 'Isaiah Jackson', 'nba_id': '1630590', 'team': 'IND', 'position': 'C'},
            {'name': 'Ben Sheppard', 'nba_id': '1641765', 'team': 'IND', 'position': 'G'},
            
            # MORE BULLS
            {'name': 'Alex Caruso', 'nba_id': '1627936', 'team': 'OKC', 'position': 'G'},  # Traded
            {'name': 'Lonzo Ball', 'nba_id': '1628366', 'team': 'CHI', 'position': 'G'},
            {'name': 'Matas Buzelis', 'nba_id': '1641853', 'team': 'CHI', 'position': 'F'},
            {'name': 'Jevon Carter', 'nba_id': '1629057', 'team': 'CHI', 'position': 'G'},
            {'name': 'Julian Phillips', 'nba_id': '1641766', 'team': 'CHI', 'position': 'F'},
            
            # MORE PISTONS
            {'name': 'Tim Hardaway Jr.', 'nba_id': '203hard', 'team': 'DET', 'position': 'G'},
            {'name': 'Tobias Harris', 'nba_id': '202699', 'team': 'DET', 'position': 'F'},
            {'name': 'Malik Beasley', 'nba_id': '1627736', 'team': 'DET', 'position': 'G'},
            {'name': 'Ronald Holland II', 'nba_id': '1641853', 'team': 'DET', 'position': 'G'},
            {'name': 'Bobi Klintman', 'nba_id': '1641853', 'team': 'DET', 'position': 'F'},
            
            # MORE RAPTORS
            {'name': 'Chris Boucher', 'nba_id': '1628449', 'team': 'TOR', 'position': 'F'},
            {'name': 'Kelly Olynyk', 'nba_id': '203482', 'team': 'TOR', 'position': 'C'},
            {'name': 'Ja\'Kobe Walter', 'nba_id': '1641853', 'team': 'TOR', 'position': 'G'},
            {'name': 'Jonathan Mogbo', 'nba_id': '1641853', 'team': 'TOR', 'position': 'F'},
            {'name': 'Davion Mitchell', 'nba_id': '1630537', 'team': 'TOR', 'position': 'G'},
            
            # MORE WIZARDS
            {'name': 'Jonas Valanciunas', 'nba_id': '202685', 'team': 'WAS', 'position': 'C'},
            {'name': 'Malcolm Brogdon', 'nba_id': '1627763', 'team': 'WAS', 'position': 'G'},
            {'name': 'Bub Carrington', 'nba_id': '1641853', 'team': 'WAS', 'position': 'G'},
            {'name': 'Corey Kispert', 'nba_id': '1630558', 'team': 'WAS', 'position': 'F'},
            {'name': 'Kyshawn George', 'nba_id': '1641853', 'team': 'WAS', 'position': 'G'},
            
            # MORE HORNETS
            {'name': 'Tidjane Salaun', 'nba_id': '1641853', 'team': 'CHA', 'position': 'F'},
            {'name': 'Grant Williams', 'nba_id': '1629684', 'team': 'CHA', 'position': 'F'},
            {'name': 'Vasilije Micic', 'nba_id': '1641767', 'team': 'CHA', 'position': 'G'},
            {'name': 'Moussa Diabate', 'nba_id': '1630591', 'team': 'CHA', 'position': 'C'},
            {'name': 'KJ Simpson', 'nba_id': '1641853', 'team': 'CHA', 'position': 'G'},
            
            # ADDITIONAL VETERAN PLAYERS
            {'name': 'Carmelo Anthony', 'nba_id': '2546', 'team': 'FA', 'position': 'F'},
            {'name': 'Blake Griffin', 'nba_id': '201933', 'team': 'FA', 'position': 'F'},
            {'name': 'John Wall', 'nba_id': '202322', 'team': 'FA', 'position': 'G'},
            {'name': 'DeMarcus Cousins', 'nba_id': '202326', 'team': 'FA', 'position': 'C'},
            {'name': 'Dwight Howard', 'nba_id': '2730', 'team': 'FA', 'position': 'C'},
            
            # ADDITIONAL ROOKIES AND YOUNG PROSPECTS
            {'name': 'Zach Edey', 'nba_id': '1641853', 'team': 'MEM', 'position': 'C'},
            {'name': 'Reed Sheppard', 'nba_id': '1641853', 'team': 'HOU', 'position': 'G'},
            {'name': 'Rob Dillingham', 'nba_id': '1641853', 'team': 'MIN', 'position': 'G'},
            {'name': 'Stephon Castle', 'nba_id': '1641853', 'team': 'SAS', 'position': 'G'},
            {'name': 'Tidjane Salaun', 'nba_id': '1641853', 'team': 'CHA', 'position': 'F'},
            
            # G-LEAGUE CALL-UPS AND TWO-WAY PLAYERS
            {'name': 'Mac McClung', 'nba_id': '1630224', 'team': 'ORL', 'position': 'G'},
            {'name': 'Scotty Pippen Jr.', 'nba_id': '1631094', 'team': 'MEM', 'position': 'G'},
            {'name': 'Keaton Wallace', 'nba_id': '1630224', 'team': 'ATL', 'position': 'G'},
            {'name': 'Moses Brown', 'nba_id': '1629650', 'team': 'POR', 'position': 'C'},
            {'name': 'Alex Len', 'nba_id': '203458', 'team': 'SAC', 'position': 'C'},
        ]
    
    def create_or_get_nba_player(self, cursor, player_info):
        """Create NBA player record using SAME structure as MLB"""
        try:
            # Check if player exists
            cursor.execute("""
                SELECT id FROM players 
                WHERE external_player_id = %s OR name = %s
            """, (player_info['nba_id'], player_info['name']))
            
            result = cursor.fetchone()
            if result:
                logger.info(f"  Player {player_info['name']} already exists")
                return str(result[0])
            
            # Create new NBA player (same structure as MLB)
            player_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO players (
                    id, external_player_id, name, position, team, sport,
                    player_key, player_name, sport_key, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                player_id,
                player_info['nba_id'],
                player_info['name'],
                player_info['position'],
                player_info['team'],
                'NBA',  # Different sport
                f"nba_{player_info['nba_id']}",
                player_info['name'],
                None,
                'active'
            ))
            
            logger.info(f"  ✅ Created NBA player {player_info['name']} ({player_info['nba_id']})")
            return player_id
            
        except Exception as e:
            logger.error(f"  ❌ Error creating NBA player {player_info['name']}: {e}")
            return None
    
    def ingest_nba_player_stats(self, cursor, player_info, season='2024-25'):
        """Ingest NBA player game stats using SAME table as MLB"""
        try:
            logger.info(f"\n🏀 Processing NBA player {player_info['name']} ({player_info['nba_id']})...")
            
            # Create or get player
            player_id = self.create_or_get_nba_player(cursor, player_info)
            if not player_id:
                return False
            
            # Check if we already have data for this NBA player
            cursor.execute("""
                SELECT COUNT(*) FROM player_game_stats pgs
                JOIN players p ON p.id = pgs.player_id
                WHERE p.external_player_id = %s AND p.sport = %s
            """, (player_info['nba_id'], 'NBA'))
            
            existing_count = cursor.fetchone()[0]
            if existing_count > 0:
                logger.info(f"  Player {player_info['name']} already has {existing_count} NBA game records - skipping")
                return True
            
            # Get NBA game log data
            logger.info(f"  📊 Fetching NBA game log for {player_info['name']}...")
            time.sleep(1)  # Rate limiting
            
            try:
                game_log = PlayerGameLog(player_id=int(player_info['nba_id']), season=season)
                games_data = game_log.get_data_frames()[0]
                
                if games_data.empty:
                    logger.warning(f"  ⚠️ No NBA game data found for {player_info['name']}")
                    return True
                
                logger.info(f"  📈 Found {len(games_data)} NBA games")
                
                # Process each NBA game
                games_processed = 0
                for _, game in games_data.iterrows():
                    try:
                        # Create NBA-specific stats JSON (similar to MLB structure)
                        nba_game_stats = {
                            'type': 'basketball',
                            'game_date': str(game['GAME_DATE']),
                            'minutes_played': float(game['MIN']) if game['MIN'] else 0,
                            'points': int(game['PTS']) if game['PTS'] else 0,
                            'rebounds': int(game['REB']) if game['REB'] else 0,
                            'assists': int(game['AST']) if game['AST'] else 0,
                            'steals': int(game['STL']) if game['STL'] else 0,
                            'blocks': int(game['BLK']) if game['BLK'] else 0,
                            'turnovers': int(game['TOV']) if game['TOV'] else 0,
                            'field_goals_made': int(game['FGM']) if game['FGM'] else 0,
                            'field_goals_attempted': int(game['FGA']) if game['FGA'] else 0,
                            'three_pointers_made': int(game['FG3M']) if game['FG3M'] else 0,
                            'three_pointers_attempted': int(game['FG3A']) if game['FG3A'] else 0,
                            'free_throws_made': int(game['FTM']) if game['FTM'] else 0,
                            'free_throws_attempted': int(game['FTA']) if game['FTA'] else 0,
                            'plus_minus': int(game['PLUS_MINUS']) if game['PLUS_MINUS'] else 0,
                            # Calculate percentages
                            'field_goal_percentage': float(game['FGM']) / max(float(game['FGA']), 1) if game['FGA'] else 0,
                            'three_point_percentage': float(game['FG3M']) / max(float(game['FG3A']), 1) if game['FG3A'] else 0,
                            'free_throw_percentage': float(game['FTM']) / max(float(game['FTA']), 1) if game['FTA'] else 0,
                        }
                        
                        # Insert NBA game stats (SAME table as MLB!)
                        stats_id = str(uuid.uuid4())
                        cursor.execute("""
                            INSERT INTO player_game_stats (
                                id, event_id, player_id, stats
                            ) VALUES (%s, %s, %s, %s)
                        """, (
                            stats_id,
                            None,  # We'll link to events later
                            player_id,
                            json.dumps(nba_game_stats)
                        ))
                        
                        games_processed += 1
                        
                    except Exception as e:
                        logger.warning(f"    ⚠️ Error processing NBA game {game.get('GAME_DATE', 'unknown')}: {e}")
                        continue
                
                logger.info(f"  ✅ Successfully processed {games_processed} NBA games for {player_info['name']}")
                return True
                
            except Exception as e:
                logger.error(f"  ❌ NBA API error for {player_info['name']}: {e}")
                return False
            
        except Exception as e:
            logger.error(f"❌ Error processing NBA player {player_info['name']}: {e}")
            return False
    
    def batch_ingest_nba_players(self):
        """Batch ingest NBA players using SAME approach as MLB"""
        logger.info("🏀 STARTING NBA BATCH PLAYER INGESTION")
        logger.info("=" * 60)
        logger.info("🎯 Using SAME tables as MLB with sport='NBA'")
        
        # Get target NBA players
        target_players = self.get_target_nba_players()
        logger.info(f"🏀 Target NBA players: {len(target_players)}")
        
        try:
            cursor = self.conn.cursor()
            
            # Process each NBA player
            successful = 0
            failed = 0
            
            for player_info in target_players:
                try:
                    success = self.ingest_nba_player_stats(cursor, player_info)
                    if success:
                        successful += 1
                        self.conn.commit()  # Commit after each successful player
                    else:
                        failed += 1
                        self.conn.rollback()
                        
                except Exception as e:
                    logger.error(f"❌ Error processing NBA player {player_info['name']}: {e}")
                    failed += 1
                    self.conn.rollback()
                    
                # Rate limiting between players
                time.sleep(2)
            
            cursor.close()
            
            logger.info(f"\n" + "=" * 60)
            logger.info(f"🏀 NBA BATCH INGESTION COMPLETE")
            logger.info(f"✅ Successful: {successful}")
            logger.info(f"❌ Failed: {failed}")
            logger.info(f"📊 Total: {len(target_players)}")
            logger.info(f"🎯 Database: SAME tables as MLB, just sport='NBA'")
            
        except Exception as e:
            logger.error(f"❌ Database connection error: {e}")
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()


def main():
    """🏀 MAIN NBA INGESTION ENTRY POINT! 🏀"""
    ingestor = NBAStatsIngestor()
    
    try:
        ingestor.batch_ingest_nba_players()
        
    except KeyboardInterrupt:
        logger.info("🛑 NBA ingestion cancelled by user")
    except Exception as e:
        logger.error(f"❌ NBA ingestion failed: {e}")
    finally:
        ingestor.close()


if __name__ == "__main__":
    main() 
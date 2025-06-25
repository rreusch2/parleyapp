#!/usr/bin/env python3

import psycopg2
import pandas as pd
import json
import os
import time
import uuid
from datetime import datetime
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

class NFLDataIngestor:
    """NFL data ingestion using the free nfl-data-py package"""
    
    def __init__(self):
        self.conn = None
        self.season = 2024
        self._connect()
    
    def _connect(self):
        """Connect to database using improved connection handling"""
        try:
            self.conn = get_db_connection()
            logger.info("✅ Connected to database for NFL ingestion")
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            raise
    
    def get_nfl_data(self):
        """Get NFL weekly data using nfl-data-py (FREE!)"""
        try:
            logger.info("🏈 Fetching FREE NFL data with nfl-data-py...")
            
            # Get weekly player stats (like our successful MLB approach)
            weekly_data = nfl.import_weekly_data([self.season])
            logger.info(f"✅ Loaded {len(weekly_data)} NFL player game records!")
            
            return weekly_data
            
        except Exception as e:
            logger.error(f"❌ Error fetching NFL data: {e}")
            return None

    def create_nfl_player(self, player_name, external_id, team, position):
        """Create NFL player in database using correct schema"""
        cursor = self.conn.cursor()
        
        try:
            # Check if exists by external_player_id or name
            cursor.execute("""
                SELECT id FROM players 
                WHERE external_player_id = %s 
                OR player_name = %s 
                AND sport_key = 'NFL'
            """, (str(external_id), player_name))
            existing = cursor.fetchone()
            if existing:
                return str(existing[0])
            
            # Create new player using the correct schema
            player_uuid = uuid.uuid4()
            metadata = {
                'team': team,
                'position': position,
                'source': 'nfl_data_py'
            }
            
            cursor.execute("""
                INSERT INTO players (
                    id, external_player_id, player_key, player_name, name, 
                    sport, sport_key, metadata
                ) VALUES (%s, %s, %s, %s, %s, 'NFL', 'NFL', %s)
                ON CONFLICT (player_key) DO UPDATE SET
                    player_name = EXCLUDED.player_name,
                    name = EXCLUDED.name,
                    metadata = EXCLUDED.metadata
                RETURNING id
            """, (
                str(player_uuid), str(external_id), f"nfl_{external_id}",
                player_name, player_name, json.dumps(metadata)
            ))
            
            result = cursor.fetchone()
            self.conn.commit()
            logger.info(f"  ✅ Created NFL player {player_name}")
            return str(result[0]) if result else str(player_uuid)
            
        except Exception as e:
            logger.error(f"❌ Error creating player {player_name}: {e}")
            self.conn.rollback()
            return None
        finally:
            cursor.close()
    
    def create_or_get_event(self, game_data, player_name):
        """Create or get sports event using correct schema"""
        cursor = self.conn.cursor()
        
        try:
            # Create a unique event ID from game data
            week = game_data.get('week', 1)
            season = game_data.get('season', 2024)
            opponent = game_data.get('opponent_team', 'UNK')
            player_team = game_data.get('recent_team', 'UNK')
            
            external_event_id = f"nfl_{season}_week_{week}_{player_team}_{opponent}"
            
            # Check if event exists
            cursor.execute("SELECT id FROM sports_events WHERE external_event_id = %s", (external_event_id,))
            existing = cursor.fetchone()
            if existing:
                return str(existing[0])
            
            # Create new event using the schema that matches MLB script
            event_uuid = uuid.uuid4()
            
            # Use a default date based on week (approximation)
            import datetime
            start_date = datetime.datetime(2024, 9, 1) + datetime.timedelta(weeks=week-1)
            
            # For NFL, we'll use the player's team as home team and opponent as away team
            # In a real implementation, you'd determine actual home/away from the data
            home_team = player_team
            away_team = opponent
            
            # Create or get team IDs (we need to create teams table entries)
            home_team_id = self.create_or_get_team(home_team)
            away_team_id = self.create_or_get_team(away_team)
            
            cursor.execute("""
                INSERT INTO sports_events (
                    id, external_event_id, sport, league, sport_key,
                    home_team, away_team, home_team_id, away_team_id,
                    start_time, odds
                ) VALUES (%s, %s, 'NFL', 'NFL', 'NFL', %s, %s, %s, %s, %s, %s)
                ON CONFLICT (external_event_id) DO UPDATE SET
                    home_team = EXCLUDED.home_team,
                    away_team = EXCLUDED.away_team,
                    home_team_id = EXCLUDED.home_team_id,
                    away_team_id = EXCLUDED.away_team_id,
                    start_time = EXCLUDED.start_time
                RETURNING id
            """, (str(event_uuid), external_event_id, home_team, away_team, 
                  str(home_team_id), str(away_team_id), start_date, '{}'))
            
            result = cursor.fetchone()
            self.conn.commit()
            return str(result[0]) if result else str(event_uuid)
            
        except Exception as e:
            logger.error(f"❌ Error creating event: {e}")
            self.conn.rollback()
            return None
        finally:
            cursor.close()

    def create_or_get_team(self, team_abbr):
        """Create or get team from database using correct schema"""
        cursor = self.conn.cursor()
        
        try:
            # Check if team exists
            cursor.execute("""
                SELECT id FROM teams 
                WHERE team_abbreviation = %s OR team_key = %s
            """, (team_abbr, team_abbr))
            existing = cursor.fetchone()
            if existing:
                return str(existing[0])
            
            # Create new team record
            team_uuid = uuid.uuid4()
            
            cursor.execute("""
                INSERT INTO teams (id, team_key, team_name, team_abbreviation, sport_key)
                VALUES (%s, %s, %s, %s, 'NFL')
                ON CONFLICT (team_key) DO UPDATE SET
                    team_name = EXCLUDED.team_name,
                    team_abbreviation = EXCLUDED.team_abbreviation
                RETURNING id
            """, (str(team_uuid), team_abbr, team_abbr, team_abbr))
            
            result = cursor.fetchone()
            self.conn.commit()
            return str(result[0]) if result else str(team_uuid)
            
        except Exception as e:
            logger.error(f"❌ Error creating team {team_abbr}: {e}")
            self.conn.rollback()
            return None
        finally:
            cursor.close()

    def store_nfl_game(self, player_id, game_data):
        """Store NFL game stats using correct schema"""
        cursor = self.conn.cursor()
        
        try:
            # Create or get the event
            event_id = self.create_or_get_event(game_data, game_data.get('player_display_name', 'unknown'))
            if not event_id:
                return False
            
            # Check if this player-event combination already exists
            cursor.execute("""
                SELECT id FROM player_game_stats 
                WHERE player_id = %s AND event_id = %s
            """, (player_id, event_id))
            
            if cursor.fetchone():
                # Already exists, skip
                return True
            
            # Convert to our unified JSON format
            nfl_stats = {
                'type': 'nfl_weekly',
                'passing_yards': int(game_data.get('passing_yards', 0) or 0),
                'passing_tds': int(game_data.get('passing_tds', 0) or 0),
                'rushing_yards': int(game_data.get('rushing_yards', 0) or 0),
                'rushing_tds': int(game_data.get('rushing_tds', 0) or 0),
                'receiving_yards': int(game_data.get('receiving_yards', 0) or 0),
                'receiving_tds': int(game_data.get('receiving_tds', 0) or 0),
                'receptions': int(game_data.get('receptions', 0) or 0),
                'fantasy_points': float(game_data.get('fantasy_points', 0) or 0),
                'week': int(game_data.get('week', 0) or 0),
                'season': int(game_data.get('season', 2024) or 2024),
                'opponent': str(game_data.get('opponent_team', 'UNK')),
                'recent_team': str(game_data.get('recent_team', 'UNK'))
            }
            
            cursor.execute("""
                INSERT INTO player_game_stats (
                    event_id, player_id, stats
                ) VALUES (%s, %s, %s)
                ON CONFLICT (event_id, player_id) 
                DO UPDATE SET stats = EXCLUDED.stats
            """, (event_id, player_id, json.dumps(nfl_stats)))
            
            self.conn.commit()
            return True
            
        except Exception as e:
            logger.error(f"❌ Error storing NFL game: {e}")
            self.conn.rollback()
            return False
        finally:
            cursor.close()
    
    def get_existing_nfl_players_with_stats(self):
        """Get list of NFL players that already have game stats in database"""
        cursor = self.conn.cursor()
        try:
            # Get players that have at least one game stat record
            cursor.execute("""
                SELECT DISTINCT p.external_player_id, p.player_name 
                FROM players p
                INNER JOIN player_game_stats pgs ON p.id = pgs.player_id
                WHERE p.sport_key = 'NFL'
            """)
            existing = cursor.fetchall()
            existing_ids = set(str(row[0]) for row in existing)
            existing_names = set(row[1] for row in existing)
            logger.info(f"📋 Found {len(existing)} NFL players with existing game stats")
            return existing_ids, existing_names
        except Exception as e:
            logger.error(f"❌ Error getting existing players with stats: {e}")
            return set(), set()
        finally:
            cursor.close()
    
    def get_existing_nfl_players(self):
        """Get list of NFL players already in database"""
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                SELECT DISTINCT external_player_id, player_name 
                FROM players 
                WHERE sport_key = 'NFL'
            """)
            existing = cursor.fetchall()
            existing_ids = set(str(row[0]) for row in existing)
            existing_names = set(row[1] for row in existing)
            logger.info(f"📋 Found {len(existing)} existing NFL players in database")
            return existing_ids, existing_names
        except Exception as e:
            logger.error(f"❌ Error getting existing players: {e}")
            return set(), set()
        finally:
            cursor.close()

    def discover_all_offensive_players(self, nfl_data):
        """Discover all offensive players in the dataset"""
        try:
            # Filter for offensive positions only (fantasy relevant)
            offensive_positions = ['QB', 'RB', 'WR', 'TE', 'FB']  # Added FB (fullback)
            
            # Get unique players with offensive positions
            offensive_players = nfl_data[
                nfl_data['position'].isin(offensive_positions)
            ].copy()
            
            # Get unique player info
            unique_players = offensive_players.groupby('player_display_name').agg({
                'player_id': 'first',
                'recent_team': 'first', 
                'position': 'first',
                'season': 'max'  # Get most recent season
            }).reset_index()
            
            logger.info(f"🔍 Discovered {len(unique_players)} unique offensive players:")
            for pos in offensive_positions:
                pos_count = len(unique_players[unique_players['position'] == pos])
                logger.info(f"  - {pos}: {pos_count} players")
            
            return unique_players
            
        except Exception as e:
            logger.error(f"❌ Error discovering players: {e}")
            return None

    def run_ingestion(self):
        """Main NFL ingestion process - ALL offensive players"""
        logger.info("🚀 STARTING COMPREHENSIVE NFL OFFENSIVE PLAYER INGESTION!")
        
        # Get all NFL data
        nfl_data = self.get_nfl_data()
        if nfl_data is None:
            return
        
        # Get existing players that have game stats (not just exist in DB)
        existing_with_stats_ids, existing_with_stats_names = self.get_existing_nfl_players_with_stats()
        
        # Also get all existing players to handle player creation properly
        all_existing_ids, all_existing_names = self.get_existing_nfl_players()
        
        # Discover all offensive players in the dataset
        all_offensive_players = self.discover_all_offensive_players(nfl_data)
        if all_offensive_players is None:
            return
        
        # Filter out players that already have game stats
        players_to_process = []
        existing_count = 0
        
        for _, player in all_offensive_players.iterrows():
            player_name = player['player_display_name']
            player_id_from_data = str(player['player_id'])
            
            # Skip if player already has game stats
            if player_id_from_data in existing_with_stats_ids or player_name in existing_with_stats_names:
                existing_count += 1
            else:
                # Add to processing list (even if player exists but has no stats)
                players_to_process.append(player)
        
        logger.info(f"📈 Found {len(players_to_process)} offensive players to process (new or missing stats)")
        logger.info(f"⏭️  Skipping {existing_count} players with existing game stats")
        
        if len(players_to_process) == 0:
            logger.info("✅ All offensive players already have game stats!")
            return
        
        # Process players in batches
        batch_size = 50  # Process 50 players at a time
        total_players_processed = 0
        total_games_processed = 0
        
        for i in range(0, len(players_to_process), batch_size):
            batch = players_to_process[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (len(players_to_process) + batch_size - 1) // batch_size
            
            logger.info(f"\n🏈 PROCESSING BATCH {batch_num}/{total_batches} ({len(batch)} players)...")
            
            batch_players_processed = 0
            batch_games_processed = 0
            
            for player in batch:
                player_name = player['player_display_name']
                player_id_from_data = str(player['player_id'])
                team = player['recent_team']
                position = player['position']
                
                logger.info(f"\n🏈 Processing {position} {player_name} ({team})...")
                
                # Get all games for this player
                player_games = nfl_data[
                    nfl_data['player_display_name'] == player_name
                ]
                
                if len(player_games) == 0:
                    logger.warning(f"  ⚠️ No game data found for {player_name}")
                    continue
                
                # Check if player exists already
                if player_id_from_data in all_existing_ids or player_name in all_existing_names:
                    # Player exists, just get their ID
                    cursor = self.conn.cursor()
                    cursor.execute("""
                        SELECT id FROM players 
                        WHERE external_player_id = %s OR player_name = %s
                        AND sport_key = 'NFL'
                        LIMIT 1
                    """, (player_id_from_data, player_name))
                    result = cursor.fetchone()
                    cursor.close()
                    
                    if result:
                        player_uuid = str(result[0])
                        logger.info(f"  ℹ️ Player {player_name} already exists, using existing ID")
                    else:
                        # Create player if somehow not found
                        player_uuid = self.create_nfl_player(player_name, player_id_from_data, team, position)
                else:
                    # Create new player
                    player_uuid = self.create_nfl_player(player_name, player_id_from_data, team, position)
                
                if not player_uuid:
                    logger.error(f"  ❌ Failed to create/get player {player_name}")
                    continue
                
                # Store all games for this player
                games_for_player = 0
                for _, game in player_games.iterrows():
                    if self.store_nfl_game(player_uuid, game.to_dict()):
                        games_for_player += 1
                        batch_games_processed += 1
                
                if games_for_player > 0:
                    logger.info(f"  ✅ Processed {games_for_player} games for {player_name}")
                    batch_players_processed += 1
                else:
                    logger.warning(f"  ⚠️ No games stored for {player_name}")
            
            total_players_processed += batch_players_processed
            total_games_processed += batch_games_processed
            
            logger.info(f"\n📊 BATCH {batch_num} COMPLETE:")
            logger.info(f"  - Players: {batch_players_processed}/{len(batch)}")
            logger.info(f"  - Games: {batch_games_processed}")
            logger.info(f"  - Running Total: {total_players_processed} players, {total_games_processed} games")
        
        logger.info(f"\n🏁 NFL COMPREHENSIVE INGESTION COMPLETE!")
        logger.info(f"📊 Players Processed: {total_players_processed}")
        logger.info(f"🎮 Total Games Stored: {total_games_processed}")
        logger.info(f"🏈 NFL offensive player database is now comprehensive!")
        
        # Summary by position
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                SELECT 
                    metadata->>'position' as position,
                    COUNT(*) as player_count
                FROM players 
                WHERE sport_key = 'NFL'
                GROUP BY metadata->>'position'
                ORDER BY player_count DESC
            """)
            position_summary = cursor.fetchall()
            
            logger.info(f"\n📈 FINAL NFL DATABASE SUMMARY:")
            for pos, count in position_summary:
                logger.info(f"  - {pos}: {count} players")
                
        except Exception as e:
            logger.error(f"Error getting summary: {e}")
        finally:
            cursor.close()
    
    def close(self):
        if self.conn:
            self.conn.close()

def main():
    ingestor = NFLDataIngestor()
    try:
        ingestor.run_ingestion()
    finally:
        ingestor.close()

if __name__ == "__main__":
    main() 
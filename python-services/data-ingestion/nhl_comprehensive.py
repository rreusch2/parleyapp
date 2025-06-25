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

# Import the reliable nhl-api-py package
try:
    from nhlpy import NHLClient
    print("✅ nhl-api-py imported successfully!")
except ImportError:
    print("❌ nhl-api-py not installed. Run: pip install nhl-api-py")
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

class NHLDataIngestor:
    """NHL data ingestion using the free nhl-api-py package"""
    
    def __init__(self):
        self.conn = None
        self.client = NHLClient()
        # Use completed 2023-2024 season for reliable data
        self.season = "20232024"
        self.season_id = 20232024
        
    def connect_to_database(self):
        """Connect to PostgreSQL database using improved connection handling"""
        try:
            self.conn = get_db_connection()
            self.conn.autocommit = True
            logger.info("✅ Connected to database for NHL ingestion")
            return True
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            return False

    def get_existing_nhl_players_with_stats(self):
        """Get list of NHL players that already have game stats in database"""
        cursor = self.conn.cursor()
        try:
            # Get players that have at least one game stat record
            cursor.execute("""
                SELECT DISTINCT p.external_player_id, p.player_name 
                FROM players p
                INNER JOIN player_game_stats pgs ON p.id = pgs.player_id
                WHERE p.sport_key = 'NHL'
            """)
            existing = cursor.fetchall()
            existing_ids = set(str(row[0]) for row in existing)
            existing_names = set(row[1] for row in existing)
            logger.info(f"📋 Found {len(existing)} NHL players with existing game stats")
            return existing_ids, existing_names
        except Exception as e:
            logger.error(f"❌ Error getting existing players: {e}")
            return set(), set()
        finally:
            cursor.close()

    def get_existing_nhl_players(self):
        """Get list of NHL players already in database"""
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                SELECT DISTINCT external_player_id, player_name 
                FROM players 
                WHERE sport_key = 'NHL'
            """)
            existing = cursor.fetchall()
            existing_ids = set(str(row[0]) for row in existing)
            existing_names = set(row[1] for row in existing)
            logger.info(f"📋 Found {len(existing)} existing NHL players in database")
            return existing_ids, existing_names
        except Exception as e:
            logger.error(f"❌ Error getting existing players: {e}")
            return set(), set()
        finally:
            cursor.close()

    def get_nhl_data(self):
        """Get NHL player and game data using nhl-api-py (FREE!) - COMPREHENSIVE VERSION"""
        try:
            logger.info("🏒 Fetching FREE NHL data with nhl-api-py...")
            
            # Get ALL skaters (not just top 25) - increase limit to get full roster
            skater_data = self.client.stats.skater_stats_summary_simple(
                start_season=self.season, 
                end_season=self.season,
                limit=1000,  # Get up to 1000 skaters!
                start=0
            )
            
            # Get ALL goalies (not just top 25)
            goalie_data = self.client.stats.goalie_stats_summary_simple(
                start_season=self.season,
                stats_type="summary",
                limit=200,  # Get up to 200 goalies!
                start=0
            )
            
            logger.info(f"✅ Loaded NHL player data!")
            
            # NHL API returns lists directly
            if not isinstance(skater_data, list):
                skater_data = skater_data.get('data', []) if skater_data else []
            if not isinstance(goalie_data, list):
                goalie_data = goalie_data.get('data', []) if goalie_data else []
                
            logger.info(f"📊 Skaters: {len(skater_data)}")
            logger.info(f"🥅 Goalies: {len(goalie_data)}")
            
            # Combine all players
            all_players = []
            
            # Process skaters
            for player in skater_data:
                try:
                    player_info = {
                        'id': player.get('playerId'),
                        'name': player.get('skaterFullName', ''),
                        'position': player.get('positionCode', ''),
                        'team': player.get('teamAbbrevs', ''),
                        'type': 'skater',
                        'games_played': player.get('gamesPlayed', 0),
                        'points': player.get('points', 0)
                    }
                    
                    # Only include players who actually played games
                    if player_info['games_played'] > 0 and player_info['id']:
                        all_players.append(player_info)
                        
                except Exception as e:
                    logger.warning(f"   ⚠️ Error processing skater: {e}")
                    continue
            
            # Process goalies  
            for player in goalie_data:
                try:
                    player_info = {
                        'id': player.get('playerId'),
                        'name': player.get('goalieFullName', ''),
                        'position': 'G',
                        'team': player.get('teamAbbrevs', ''),
                        'type': 'goalie', 
                        'games_played': player.get('gamesPlayed', 0),
                        'wins': player.get('wins', 0)
                    }
                    
                    # Only include goalies who actually played
                    if player_info['games_played'] > 0 and player_info['id']:
                        all_players.append(player_info)
                        
                except Exception as e:
                    logger.warning(f"   ⚠️ Error processing goalie: {e}")
                    continue
                    
            logger.info(f"🏆 TOTAL NHL PLAYERS DISCOVERED: {len(all_players)}")
            return all_players
            
        except Exception as e:
            logger.error(f"❌ Error fetching NHL data: {e}")
            return []

    def get_player_game_log(self, player_id, player_name):
        """Get player game log with better error handling"""
        try:
            # Add delay to avoid rate limiting
            time.sleep(0.3)
            
            # Get game log for completed season - fix parameter format
            game_log = self.client.stats.player_game_log(
                player_id=str(player_id),  # Ensure string format
                season_id=self.season,     # "20232024" format  
                game_type="2"              # String "2" for regular season
            )
            
            # NHL API returns a LIST directly, not a dict with 'gameLog' key!
            if game_log and isinstance(game_log, list) and len(game_log) > 0:
                logger.info(f"   📈 Found {len(game_log)} games for {player_name}")
                return game_log
            else:
                logger.warning(f"   ⚠️ No game data found for {player_name}")
                return []
                
        except Exception as e:
            logger.warning(f"   ⚠️ Error getting game log for {player_name}: {e}")
            return []

    def create_or_get_team(self, team_abbrev, team_name=None):
        """Create or get team using correct schema"""
        cursor = self.conn.cursor()
        
        try:
            # Check if team exists
            cursor.execute("SELECT id FROM teams WHERE team_abbreviation = %s AND sport_key = %s", 
                         (team_abbrev, 'NHL'))
            existing = cursor.fetchone()
            
            if existing:
                return existing[0]
            
            # Create new team with correct schema
            team_id = str(uuid.uuid4())
            team_key = f"nhl_{team_abbrev.lower()}"
            
            cursor.execute("""
                INSERT INTO teams (
                    id, sport_key, team_key, team_name, team_abbreviation,
                    metadata, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
            """, (
                team_id,
                'NHL',
                team_key,
                team_name or team_abbrev,
                team_abbrev,
                json.dumps({"source": "nhl-api-py"})
            ))
            
            self.conn.commit()
            logger.info(f"   ✅ Created NHL team {team_abbrev}")
            return team_id
            
        except Exception as e:
            logger.error(f"❌ Error creating team {team_abbrev}: {e}")
            self.conn.rollback()
            return None

    def create_or_get_event(self, game_data, player_name):
        """Create or get sports event using correct schema"""
        cursor = self.conn.cursor()
        
        try:
            # Extract game info
            game_id = game_data.get('gameId', '')
            game_date = game_data.get('gameDate', '')
            team_abbrev = game_data.get('teamAbbrev', 'UNK')
            opponent_abbrev = game_data.get('opponentAbbrev', 'UNK')
            home_road = game_data.get('homeRoadFlag', 'H')
            
            # Create external event ID
            external_event_id = f"nhl_game_{game_id}"
            
            # Check if event exists
            cursor.execute("SELECT id FROM sports_events WHERE external_event_id = %s", (external_event_id,))
            existing = cursor.fetchone()
            
            if existing:
                return existing[0]
            
            # Determine home/away teams
            if home_road == 'H':
                home_team = team_abbrev
                away_team = opponent_abbrev
            else:
                home_team = opponent_abbrev
                away_team = team_abbrev
            
            # Get team IDs
            home_team_id = self.create_or_get_team(home_team)
            away_team_id = self.create_or_get_team(away_team)
            
            if not home_team_id or not away_team_id:
                logger.warning(f"   ⚠️ Could not create teams for game {game_id}")
                return None
            
            # Create event with correct schema
            event_id = str(uuid.uuid4())
            
            cursor.execute("""
                INSERT INTO sports_events (
                    id, external_event_id, sport, sport_key, league,
                    home_team, away_team, home_team_id, away_team_id,
                    start_time, status, metadata, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            """, (
                event_id,
                external_event_id,
                'Hockey',
                'NHL', 
                'NHL',
                home_team,
                away_team,
                home_team_id,
                away_team_id,
                game_date + 'T19:00:00Z',  # Default game time
                'completed',
                json.dumps({
                    "source": "nhl-api-py",
                    "game_id": game_id,
                    "season": "2023-2024"
                })
            ))
            
            self.conn.commit()
            return event_id
            
        except Exception as e:
            logger.error(f"❌ Error creating event: {e}")
            self.conn.rollback()
            return None

    def create_player(self, player_data):
        """Create a new NHL player or return existing player ID"""
        cursor = self.conn.cursor()
        try:
            external_player_id = str(player_data['id'])
            player_name = player_data['name']
            
            # Check if player already exists and return their ID
            cursor.execute("SELECT id FROM players WHERE external_player_id = %s", (external_player_id,))
            existing = cursor.fetchone()
            if existing:
                logger.info(f"   ℹ️ Player {player_name} already exists, using existing ID")
                return str(existing[0])
            
            # Create new player if doesn't exist
            player_id = str(uuid.uuid4())
            
            cursor.execute("""
                INSERT INTO players (id, external_player_id, player_key, player_name, name, sport, sport_key, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                player_id,
                external_player_id,
                f"nhl_{external_player_id}",
                player_name,
                player_name,
                "Hockey",
                "NHL",
                json.dumps({
                    "position": player_data['position'],
                    "team": player_data['team'],
                    "player_type": player_data['type']  # Fixed: use 'type' not 'player_type'
                })
            ))
            
            logger.info(f"   ✅ Created NHL {player_data['type']} {player_name}")
            return player_id
            
        except Exception as e:
            logger.error(f"❌ Error creating player {player_data['name']}: {e}")
            return None
        finally:
            cursor.close()

    def store_player_stats(self, player_id, event_id, game_data):
        """Store player game statistics"""
        cursor = self.conn.cursor()
        try:
            # Create comprehensive stats JSON
            stats = {
                "goals": game_data.get('goals', 0),
                "assists": game_data.get('assists', 0),
                "points": game_data.get('points', 0),
                "shots": game_data.get('shots', 0),
                "hits": game_data.get('hits', 0),
                "blocked": game_data.get('blockedShots', 0),
                "pim": game_data.get('pim', 0),
                "toi": game_data.get('toi', '0:00'),
                "plus_minus": game_data.get('plusMinus', 0)
            }
            
            # Add goalie specific stats if available
            if 'saves' in game_data:
                stats.update({
                    "saves": game_data.get('saves', 0),
                    "shots_against": game_data.get('shotsAgainst', 0),
                    "goals_against": game_data.get('goalsAgainst', 0),
                    "save_percentage": game_data.get('savePct', 0.0)
                })
            
            cursor.execute("""
                INSERT INTO player_game_stats (player_id, event_id, stats, created_at)
                VALUES (%s, %s, %s, %s)
            """, (
                player_id,
                event_id,
                json.dumps(stats),
                datetime.now()
            ))
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error storing player stats: {e}")
            return False
        finally:
            cursor.close()

    def process_player_games(self, player_id, game_log, player_data):
        """Process all games for a player"""
        games_stored = 0
        for game in game_log:
            try:
                event_id = self.create_or_get_event(game, player_data['name'])
                if event_id:
                    if self.store_player_stats(player_id, event_id, game):
                        games_stored += 1
            except Exception as e:
                logger.warning(f"   ⚠️ Error processing game for {player_data['name']}: {e}")
                continue
        
        if games_stored > 0:
            logger.info(f"   ✅ Processed {games_stored} games for {player_data['name']}")
        else:
            logger.warning(f"   ⚠️ No games stored for {player_data['name']}")
        
        return games_stored

    def run_ingestion(self):
        """Run the comprehensive NHL ingestion with optimized batching"""
        try:
            # Get all NHL player data
            players_data = self.get_nhl_data()
            
            if not players_data:
                logger.error("❌ No NHL player data found!")
                return
                
            # Get existing players that have game stats (not just exist in DB)
            existing_ids, existing_names = self.get_existing_nhl_players_with_stats()
            
            # Also get all existing players to handle player creation properly
            all_existing_ids, all_existing_names = self.get_existing_nhl_players()
            
            # Filter out players that already have game stats
            players_to_process = []
            existing_count = 0
            
            for player in players_data:
                player_id = str(player.get('id', ''))
                player_name = player.get('name', '').strip()
                
                # Skip if player already has game stats
                if player_id in existing_ids or player_name in existing_names:
                    existing_count += 1
                else:
                    # Add to processing list (even if player exists but has no stats)
                    players_to_process.append(player)
            
            # Show player breakdown by position
            position_counts = {}
            for player in players_data:
                pos = player.get('position', 'Unknown')
                position_counts[pos] = position_counts.get(pos, 0) + 1
            
            logger.info(f"🔍 Discovered {len(players_data)} NHL players:")
            for pos, count in sorted(position_counts.items()):
                logger.info(f"   - {pos}: {count} players")
            
            logger.info(f"📈 Found {len(players_to_process)} NHL players to process (new or missing stats)")
            logger.info(f"⏭️  Skipping {existing_count} players with existing game stats")
            
            if not players_to_process:
                logger.info("✅ All NHL players already have game stats!")
                return
                
            # Process in optimized batches for large dataset
            batch_size = 25  # Smaller batches for stability
            total_batches = (len(players_to_process) + batch_size - 1) // batch_size
            total_games_processed = 0
            
            for batch_num in range(total_batches):
                start_idx = batch_num * batch_size
                end_idx = min(start_idx + batch_size, len(players_to_process))
                batch_players = players_to_process[start_idx:end_idx]
                
                logger.info(f"")
                logger.info(f"🏒 PROCESSING BATCH {batch_num + 1}/{total_batches} ({len(batch_players)} players)...")
                
                batch_games = 0
                for player_data in batch_players:
                    try:
                        player_name = player_data.get('name', '').strip()
                        player_id = player_data.get('id')
                        player_type = player_data.get('type', 'skater')
                        position = player_data.get('position', '')
                        team = player_data.get('team', '')
                        
                        logger.info(f"")
                        logger.info(f"🏒 Processing {player_type} {player_name} ({position} - {team})...")
                        
                        # Create player in database
                        db_player_id = self.create_player(player_data)
                        if not db_player_id:
                            logger.warning(f"   ⚠️ Failed to create/get player {player_name}")
                            continue
                            
                        # Get and process game log
                        game_log = self.get_player_game_log(player_id, player_name)
                        if not game_log:
                            logger.warning(f"   ⚠️ No games stored for {player_name}")
                            continue
                            
                        # Store all games for this player
                        games_stored = self.process_player_games(db_player_id, game_log, player_data)
                        batch_games += games_stored
                        total_games_processed += games_stored
                        
                        logger.info(f"   ✅ Processed {games_stored} games for {player_name}")
                        
                    except Exception as e:
                        logger.error(f"   ❌ Error processing player {player_data.get('name', 'Unknown')}: {e}")
                        continue
                
                logger.info(f"📊 Batch {batch_num + 1} complete: {batch_games} games processed")
                logger.info(f"🏆 RUNNING TOTAL: {total_games_processed} games across {(batch_num + 1) * batch_size} players")
                
            logger.info(f"")
            logger.info(f"🎉 NHL INGESTION COMPLETE!")
            logger.info(f"📊 FINAL TOTALS:")
            logger.info(f"   - Players processed: {len(players_to_process)}")
            logger.info(f"   - Total games ingested: {total_games_processed}")
            logger.info(f"   - Average games per player: {total_games_processed / len(players_to_process) if players_to_process else 0:.1f}")
            
        except Exception as e:
            logger.error(f"❌ Error in NHL ingestion: {e}")
            raise

def main():
    logger.info("🚀 STARTING COMPREHENSIVE NHL PLAYER INGESTION!")
    
    ingestor = NHLDataIngestor()
    
    if not ingestor.connect_to_database():
        return
    
    ingestor.run_ingestion()

if __name__ == "__main__":
    main() 
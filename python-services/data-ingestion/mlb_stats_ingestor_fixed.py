"""
MLB Statistics Ingestor - Fixed for Existing Schema
Works with your existing UUID-based database schema
"""

import pybaseball as pyb
from pybaseball import playerid_lookup, batting_stats, pitching_stats
from pybaseball import statcast, statcast_batter, statcast_pitcher
from pybaseball import schedule_and_record, standings
import psycopg2
import pandas as pd
import os
import json
import uuid
from datetime import datetime, timedelta
import time
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

class MLBStatsIngestor:
    """
    Free MLB statistics ingestion using pybaseball
    Fixed to work with existing UUID-based schema
    """
    
    def __init__(self):
        self.db_connection = self._get_db_connection()
        # Enable caching for better performance
        pyb.cache.enable()
        
    def _get_db_connection(self):
        """Get database connection using environment variables"""
        # Check if DATABASE_URL is available (Supabase connection string)
        database_url = os.getenv('DATABASE_URL')
        if database_url:
            return psycopg2.connect(database_url)
        
        # Otherwise use individual environment variables
        connection_params = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'postgres'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD')
        }
        
        # Add SSL mode if specified (required for Supabase)
        ssl_mode = os.getenv('DB_SSL_MODE')
        if ssl_mode:
            connection_params['sslmode'] = ssl_mode
        
        return psycopg2.connect(**connection_params)
    
    def _get_or_create_player(self, player_mlbam_id, player_name, team_abbrev=None):
        """
        Get existing player UUID or create new player record
        """
        try:
            cursor = self.db_connection.cursor()
            
            # Try to find existing player by MLBAM ID
            cursor.execute("""
                SELECT id FROM players 
                WHERE external_player_id = %s
                OR (metadata->>'mlbam_id' = %s)
                OR player_name = %s
            """, (str(player_mlbam_id), str(player_mlbam_id), player_name))
            
            result = cursor.fetchone()
            if result:
                cursor.close()
                return str(result[0])
            
            # Create new player record
            player_uuid = uuid.uuid4()
            metadata = {
                'mlbam_id': str(player_mlbam_id),
                'source': 'pybaseball'
            }
            
            cursor.execute("""
                INSERT INTO players (id, external_player_id, player_key, player_name, name, sport, sport_key, metadata)
                VALUES (%s, %s, %s, %s, %s, 'MLB', 'MLB', %s)
                ON CONFLICT (player_key) DO UPDATE SET
                    player_name = EXCLUDED.player_name,
                    name = EXCLUDED.name,
                    metadata = EXCLUDED.metadata
                RETURNING id
            """, (str(player_uuid), str(player_mlbam_id), f"mlb_{player_mlbam_id}", player_name, player_name, json.dumps(metadata)))
            
            result = cursor.fetchone()
            self.db_connection.commit()
            cursor.close()
            
            return str(result[0]) if result else str(player_uuid)
            
        except Exception as e:
            logger.error(f"Error getting/creating player {player_name}: {e}")
            self.db_connection.rollback()
            return None
    
    def _get_or_create_team(self, team_abbrev, team_name=None):
        """
        Get existing team UUID or create new team record
        """
        try:
            cursor = self.db_connection.cursor()
            
            # Try to find existing team
            cursor.execute("""
                SELECT id FROM teams 
                WHERE team_abbreviation = %s OR team_key = %s
            """, (team_abbrev, team_abbrev))
            
            result = cursor.fetchone()
            if result:
                cursor.close()
                return str(result[0])
            
            # Create new team record
            team_uuid = uuid.uuid4()
            
            cursor.execute("""
                INSERT INTO teams (id, team_key, team_name, team_abbreviation, sport_key)
                VALUES (%s, %s, %s, %s, 'MLB')
                ON CONFLICT (team_key) DO UPDATE SET
                    team_name = EXCLUDED.team_name,
                    team_abbreviation = EXCLUDED.team_abbreviation
                RETURNING id
            """, (str(team_uuid), team_abbrev, team_name or team_abbrev, team_abbrev))
            
            result = cursor.fetchone()
            self.db_connection.commit()
            cursor.close()
            
            return str(result[0]) if result else str(team_uuid)
            
        except Exception as e:
            logger.error(f"Error getting/creating team {team_abbrev}: {e}")
            self.db_connection.rollback()
            return None
    
    def _get_or_create_event(self, game_date, home_team, away_team):
        """
        Get existing sports_event UUID or create new event record
        """
        try:
            cursor = self.db_connection.cursor()
            
            # Get team UUIDs
            home_team_id = self._get_or_create_team(home_team)
            away_team_id = self._get_or_create_team(away_team)
            
            if not home_team_id or not away_team_id:
                return None
            
            # Create external event ID
            external_event_id = f"mlb_{game_date}_{home_team}_{away_team}"
            
            # Try to find existing event
            cursor.execute("""
                SELECT id FROM sports_events 
                WHERE external_event_id = %s
            """, (external_event_id,))
            
            result = cursor.fetchone()
            if result:
                cursor.close()
                return str(result[0])
            
            # Create new event record
            event_uuid = uuid.uuid4()
            
            # Convert game_date string to datetime
            if isinstance(game_date, str):
                start_time = datetime.strptime(game_date, '%Y-%m-%d')
            else:
                start_time = game_date
            
            cursor.execute("""
                INSERT INTO sports_events (
                    id, external_event_id, sport, league, sport_key,
                    home_team, away_team, home_team_id, away_team_id, 
                    start_time, odds
                ) VALUES (%s, %s, 'MLB', 'MLB', 'MLB', %s, %s, %s, %s, %s, %s)
                ON CONFLICT (external_event_id) DO UPDATE SET
                    home_team = EXCLUDED.home_team,
                    away_team = EXCLUDED.away_team,
                    home_team_id = EXCLUDED.home_team_id,
                    away_team_id = EXCLUDED.away_team_id,
                    start_time = EXCLUDED.start_time
                RETURNING id
            """, (str(event_uuid), external_event_id, home_team, away_team, str(home_team_id), str(away_team_id), start_time, '{}'))
            
            result = cursor.fetchone()
            self.db_connection.commit()
            cursor.close()
            
            return str(result[0]) if result else str(event_uuid)
            
        except Exception as e:
            logger.error(f"Error getting/creating event for {game_date} {home_team} vs {away_team}: {e}")
            self.db_connection.rollback()
            return None
    
    def ingest_player_batting_stats(self, player_name_last, player_name_first, season=2024):
        """
        Ingest comprehensive batting statistics for a player
        """
        try:
            # Get player ID
            player_id_df = playerid_lookup(player_name_last, player_name_first)
            if player_id_df.empty:
                logger.warning(f"No player found: {player_name_first} {player_name_last}")
                return
                
            player_mlbam_id = player_id_df.iloc[0]['key_mlbam']
            player_full_name = f"{player_name_first} {player_name_last}"
            
            # Get player UUID
            player_uuid = self._get_or_create_player(player_mlbam_id, player_full_name)
            if not player_uuid:
                logger.error(f"Could not get/create player UUID for {player_full_name}")
                return
            
            # Get recent Statcast data (last 30 days)
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            
            statcast_data = statcast_batter(start_date, end_date, player_mlbam_id)
            
            if not statcast_data.empty:
                # Group by game_date to avoid duplicates
                for game_date, game_group in statcast_data.groupby('game_date'):
                    # Get representative row for team info
                    sample_row = game_group.iloc[0]
                    
                    # Get or create event
                    event_uuid = self._get_or_create_event(
                        game_date, 
                        sample_row.get('home_team', 'UNK'),
                        sample_row.get('away_team', 'UNK')
                    )
                    
                    if event_uuid:
                        # Aggregate stats for this game
                        game_stats = self._aggregate_batting_game_stats(game_group)
                        
                        self._store_player_game_stats(
                            player_uuid, 
                            event_uuid, 
                            game_date, 
                            game_stats
                        )
                    
            logger.info(f"Successfully ingested batting stats for {player_full_name}")
            
        except Exception as e:
            logger.error(f"Error ingesting batting stats for {player_name_first} {player_name_last}: {e}")
    
    def _aggregate_batting_game_stats(self, game_group):
        """
        Aggregate Statcast data for a single game
        """
        # Helper function to handle NaN values
        def safe_value(value):
            if pd.isna(value) or value != value or str(value).lower() == 'nan':  # NaN check
                return None
            return float(value) if isinstance(value, (int, float)) else value
        
        # Helper function to clean event lists
        def clean_events(events_series):
            return [event for event in events_series.tolist() if pd.notna(event)]
        
        stats = {
            'type': 'batting',
            'at_bats': len(game_group),
            'events': clean_events(game_group['events']),
            'avg_launch_speed': safe_value(game_group['launch_speed'].mean()) if 'launch_speed' in game_group.columns else None,
            'avg_launch_angle': safe_value(game_group['launch_angle'].mean()) if 'launch_angle' in game_group.columns else None,
            'max_hit_distance': safe_value(game_group['hit_distance_sc'].max()) if 'hit_distance_sc' in game_group.columns else None,
            'estimated_ba': safe_value(game_group['estimated_ba_using_speedangle'].mean()) if 'estimated_ba_using_speedangle' in game_group.columns else None,
            'estimated_woba': safe_value(game_group['estimated_woba_using_speedangle'].mean()) if 'estimated_woba_using_speedangle' in game_group.columns else None,
            'pitch_count': len(game_group),
            'game_date': str(game_group['game_date'].iloc[0])
        }
        
        # Count specific outcomes
        events = game_group['events'].dropna()
        stats['hits'] = len(events[events.isin(['single', 'double', 'triple', 'home_run'])])
        stats['home_runs'] = len(events[events == 'home_run'])
        stats['strikeouts'] = len(events[events == 'strikeout'])
        stats['walks'] = len(events[events == 'walk'])
        
        return stats
    
    def ingest_team_season_stats(self, season=2024):
        """
        Ingest season-level team statistics for all MLB teams
        """
        try:
            # Get batting stats for all teams
            team_batting = batting_stats(season, qual=0, ind=1)  # ind=1 for individual teams
            
            # Get pitching stats for all teams  
            team_pitching = pitching_stats(season, qual=0, ind=1)
            
            # Process team batting stats
            for _, team_stats in team_batting.iterrows():
                team_abbrev = team_stats['Team']
                
                batting_stats_data = {
                    'type': 'batting',
                    'games': team_stats.get('G'),
                    'at_bats': team_stats.get('AB'),
                    'runs': team_stats.get('R'),
                    'hits': team_stats.get('H'),
                    'doubles': team_stats.get('2B'),
                    'triples': team_stats.get('3B'),
                    'home_runs': team_stats.get('HR'),
                    'rbi': team_stats.get('RBI'),
                    'walks': team_stats.get('BB'),
                    'strikeouts': team_stats.get('SO'),
                    'stolen_bases': team_stats.get('SB'),
                    'batting_avg': float(team_stats.get('AVG', 0)),
                    'on_base_pct': float(team_stats.get('OBP', 0)),
                    'slugging_pct': float(team_stats.get('SLG', 0)),
                    'ops': float(team_stats.get('OPS', 0)),
                    'ops_plus': team_stats.get('OPS+'),
                    'war': float(team_stats.get('WAR', 0))
                }
                
                self._store_team_season_stats(team_abbrev, season, batting_stats_data)
            
            # Process team pitching stats
            for _, team_stats in team_pitching.iterrows():
                team_abbrev = team_stats['Team']
                
                pitching_stats_data = {
                    'pitching': {
                        'wins': team_stats.get('W'),
                        'losses': team_stats.get('L'),
                        'era': float(team_stats.get('ERA', 0)),
                        'games': team_stats.get('G'),
                        'games_started': team_stats.get('GS'),
                        'complete_games': team_stats.get('CG'),
                        'shutouts': team_stats.get('SHO'),
                        'saves': team_stats.get('SV'),
                        'innings_pitched': float(team_stats.get('IP', 0)),
                        'hits_allowed': team_stats.get('H'),
                        'runs_allowed': team_stats.get('R'),
                        'earned_runs': team_stats.get('ER'),
                        'home_runs_allowed': team_stats.get('HR'),
                        'walks_allowed': team_stats.get('BB'),
                        'strikeouts': team_stats.get('SO'),
                        'whip': float(team_stats.get('WHIP', 0)),
                        'war': float(team_stats.get('WAR', 0))
                    }
                }
                
                self._update_team_pitching_stats(team_abbrev, season, pitching_stats_data)
                
            logger.info(f"Successfully ingested team stats for {season} season")
            
        except Exception as e:
            logger.error(f"Error ingesting team season stats: {e}")
    
    def _store_player_game_stats(self, player_uuid, event_uuid, game_date, stats):
        """Store player game statistics using correct schema"""
        try:
            cursor = self.db_connection.cursor()
            
            cursor.execute("""
                INSERT INTO player_game_stats (
                    event_id, player_id, stats, created_at
                ) VALUES (%s, %s, %s, NOW())
                ON CONFLICT (event_id, player_id) 
                DO UPDATE SET 
                    stats = EXCLUDED.stats,
                    created_at = NOW()
            """, (str(event_uuid), str(player_uuid), json.dumps(stats)))
            
            self.db_connection.commit()
            cursor.close()
            
        except Exception as e:
            logger.error(f"Error storing player game stats: {e}")
    
    def _store_team_season_stats(self, team_abbrev, season, stats):
        """Store team season statistics"""
        try:
            cursor = self.db_connection.cursor()
            
            cursor.execute("""
                INSERT INTO team_season_stats (
                    team_id, season, stats_avg, updated_at
                ) VALUES (%s, %s, %s, NOW())
                ON CONFLICT (team_id, season)
                DO UPDATE SET
                    stats_avg = EXCLUDED.stats_avg,
                    updated_at = NOW()
            """, (team_abbrev, str(season), json.dumps(stats)))
            
            self.db_connection.commit()
            cursor.close()
            
        except Exception as e:
            logger.error(f"Error storing team season stats for {team_abbrev}: {e}")
    
    def _update_team_pitching_stats(self, team_abbrev, season, pitching_stats):
        """Update team season stats with pitching data"""
        try:
            cursor = self.db_connection.cursor()
            
            # Get existing stats and merge with pitching stats
            cursor.execute("""
                SELECT stats_avg FROM team_season_stats 
                WHERE team_id = %s AND season = %s
            """, (team_abbrev, str(season)))
            
            result = cursor.fetchone()
            if result:
                existing_stats = result[0]
                existing_stats.update(pitching_stats)
                
                cursor.execute("""
                    UPDATE team_season_stats 
                    SET stats_avg = %s, updated_at = NOW()
                    WHERE team_id = %s AND season = %s
                """, (json.dumps(existing_stats), team_abbrev, str(season)))
            else:
                cursor.execute("""
                    INSERT INTO team_season_stats (team_id, season, stats_avg)
                    VALUES (%s, %s, %s)
                """, (team_abbrev, str(season), json.dumps(pitching_stats)))
            
            self.db_connection.commit()
            cursor.close()
            
        except Exception as e:
            logger.error(f"Error updating team pitching stats for {team_abbrev}: {e}")
    
    def test_connection(self):
        """Test database connection and basic functionality"""
        try:
            cursor = self.db_connection.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            cursor.close()
            
            if result:
                logger.info("✅ Database connection successful")
                return True
            else:
                logger.error("❌ Database connection failed")
                return False
                
        except Exception as e:
            logger.error(f"❌ Database connection error: {e}")
            return False
    
    def daily_mlb_update(self):
        """
        Daily update of MLB statistics - focused approach
        """
        logger.info("Starting daily MLB statistics update...")
        
        # Test connection first
        if not self.test_connection():
            logger.error("Database connection failed - aborting update")
            return
        
        # Focus on a few key players initially
        key_players = [
            ('Judge', 'Aaron'),
            ('Ohtani', 'Shohei'), 
            ('Betts', 'Mookie')
        ]
        
        # Update batting stats for key players
        for last_name, first_name in key_players:
            try:
                self.ingest_player_batting_stats(last_name, first_name)
                time.sleep(2)  # Rate limiting
            except Exception as e:
                logger.error(f"Error updating {first_name} {last_name}: {e}")
        
        # Update current season team stats
        try:
            self.ingest_team_season_stats(2024)
        except Exception as e:
            logger.error(f"Error updating team stats: {e}")
            
        logger.info("Daily MLB statistics update completed")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # Example usage
    ingestor = MLBStatsIngestor()
    
    # Test connection
    if ingestor.test_connection():
        print("✅ Database connection successful!")
        
        # Test with a specific player
        print("Testing with Aaron Judge...")
        ingestor.ingest_player_batting_stats('Judge', 'Aaron')
        
        print("✅ MLB Statistics ingestor is ready!")
    else:
        print("❌ Database connection failed - check your environment variables") 
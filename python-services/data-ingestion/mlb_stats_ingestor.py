"""
MLB Statistics Ingestor - Free Pybaseball Integration
Complements The Odds API with comprehensive player/team statistics for MLB
"""

import pybaseball as pyb
from pybaseball import playerid_lookup, batting_stats, pitching_stats
from pybaseball import statcast, statcast_batter, statcast_pitcher
from pybaseball import schedule_and_record, standings
import psycopg2
import pandas as pd
import os
import json
from datetime import datetime, timedelta
import time
import logging

logger = logging.getLogger(__name__)

class MLBStatsIngestor:
    """
    Free MLB statistics ingestion using pybaseball
    Provides comprehensive player/team performance data for AI model training
    """
    
    def __init__(self):
        self.db_connection = self._get_db_connection()
        # Enable caching for better performance
        pyb.cache.enable()
        
    def _get_db_connection(self):
        """Get database connection using environment variables"""
        return psycopg2.connect(
            host=os.getenv('DB_HOST'),
            port=os.getenv('DB_PORT', '5432'),
            database=os.getenv('DB_NAME', 'postgres'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD')
        )
    
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
                
            player_id = player_id_df.iloc[0]['key_mlbam']
            
            # Get recent Statcast data (last 30 days)
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            
            statcast_data = statcast_batter(start_date, end_date, player_id)
            
            if not statcast_data.empty:
                # Store recent performance data
                for _, game in statcast_data.iterrows():
                    self._store_player_batting_game({
                        'player_id': player_id,
                        'player_name': f"{player_name_first} {player_name_last}",
                        'game_date': game['game_date'],
                        'at_bat_number': game.get('at_bat_number'),
                        'pitch_number': game.get('pitch_number'),
                        'events': game.get('events'),  # Hit outcome
                        'description': game.get('description'),  # Pitch outcome
                        'release_speed': game.get('release_speed'),
                        'release_spin_rate': game.get('release_spin_rate'),
                        'hit_distance_sc': game.get('hit_distance_sc'),
                        'launch_speed': game.get('launch_speed'),
                        'launch_angle': game.get('launch_angle'),
                        'estimated_ba_using_speedangle': game.get('estimated_ba_using_speedangle'),
                        'estimated_woba_using_speedangle': game.get('estimated_woba_using_speedangle'),
                        'woba_value': game.get('woba_value'),
                        'babip_value': game.get('babip_value'),
                        'home_team': game.get('home_team'),
                        'away_team': game.get('away_team')
                    })
                    
            logger.info(f"Successfully ingested batting stats for {player_name_first} {player_name_last}")
            
        except Exception as e:
            logger.error(f"Error ingesting batting stats for {player_name_first} {player_name_last}: {e}")
    
    def ingest_player_pitching_stats(self, player_name_last, player_name_first, season=2024):
        """
        Ingest comprehensive pitching statistics for a player
        """
        try:
            # Get player ID
            player_id_df = playerid_lookup(player_name_last, player_name_first)
            if player_id_df.empty:
                logger.warning(f"No pitcher found: {player_name_first} {player_name_last}")
                return
                
            player_id = player_id_df.iloc[0]['key_mlbam']
            
            # Get recent Statcast data (last 30 days)
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            
            statcast_data = statcast_pitcher(start_date, end_date, player_id)
            
            if not statcast_data.empty:
                # Store pitching performance data
                for _, pitch in statcast_data.iterrows():
                    self._store_player_pitching_game({
                        'player_id': player_id,
                        'player_name': f"{player_name_first} {player_name_last}",
                        'game_date': pitch['game_date'],
                        'pitch_type': pitch.get('pitch_type'),
                        'release_speed': pitch.get('release_speed'),
                        'release_pos_x': pitch.get('release_pos_x'),
                        'release_pos_z': pitch.get('release_pos_z'),
                        'release_spin_rate': pitch.get('release_spin_rate'),
                        'release_extension': pitch.get('release_extension'),
                        'pfx_x': pitch.get('pfx_x'),  # Horizontal movement
                        'pfx_z': pitch.get('pfx_z'),  # Vertical movement
                        'plate_x': pitch.get('plate_x'),
                        'plate_z': pitch.get('plate_z'),
                        'sz_top': pitch.get('sz_top'),  # Strike zone top
                        'sz_bot': pitch.get('sz_bot'),  # Strike zone bottom
                        'events': pitch.get('events'),  # Outcome
                        'description': pitch.get('description'),  # Pitch result
                        'zone': pitch.get('zone'),
                        'balls': pitch.get('balls'),
                        'strikes': pitch.get('strikes'),
                        'home_team': pitch.get('home_team'),
                        'away_team': pitch.get('away_team')
                    })
                    
            logger.info(f"Successfully ingested pitching stats for {player_name_first} {player_name_last}")
            
        except Exception as e:
            logger.error(f"Error ingesting pitching stats for {player_name_first} {player_name_last}: {e}")
    
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
                self._store_team_batting_stats({
                    'team': team_stats['Team'],
                    'season': season,
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
                    'batting_avg': team_stats.get('AVG'),
                    'on_base_pct': team_stats.get('OBP'),
                    'slugging_pct': team_stats.get('SLG'),
                    'ops': team_stats.get('OPS'),
                    'ops_plus': team_stats.get('OPS+'),
                    'war': team_stats.get('WAR')
                })
            
            # Process team pitching stats
            for _, team_stats in team_pitching.iterrows():
                self._store_team_pitching_stats({
                    'team': team_stats['Team'],
                    'season': season,
                    'wins': team_stats.get('W'),
                    'losses': team_stats.get('L'),
                    'era': team_stats.get('ERA'),
                    'games': team_stats.get('G'),
                    'games_started': team_stats.get('GS'),
                    'complete_games': team_stats.get('CG'),
                    'shutouts': team_stats.get('SHO'),
                    'saves': team_stats.get('SV'),
                    'innings_pitched': team_stats.get('IP'),
                    'hits_allowed': team_stats.get('H'),
                    'runs_allowed': team_stats.get('R'),
                    'earned_runs': team_stats.get('ER'),
                    'home_runs_allowed': team_stats.get('HR'),
                    'walks_allowed': team_stats.get('BB'),
                    'strikeouts': team_stats.get('SO'),
                    'whip': team_stats.get('WHIP'),
                    'war': team_stats.get('WAR')
                })
                
            logger.info(f"Successfully ingested team stats for {season} season")
            
        except Exception as e:
            logger.error(f"Error ingesting team season stats: {e}")
    
    def ingest_team_schedule(self, team_abbrev, season=2024):
        """
        Ingest team schedule and game results
        """
        try:
            schedule_data = schedule_and_record(season, team_abbrev)
            
            for _, game in schedule_data.iterrows():
                self._store_team_game_result({
                    'team': team_abbrev,
                    'season': season,
                    'date': game.get('Date'),
                    'home_away': game.get('Home_Away'),
                    'opponent': game.get('Opp'),
                    'result': game.get('W/L'),
                    'runs_scored': game.get('R'),
                    'runs_allowed': game.get('RA'),
                    'innings': game.get('Inn'),
                    'record': game.get('W-L'),
                    'rank': game.get('Rank'),
                    'games_back': game.get('GB'),
                    'winning_pitcher': game.get('Win'),
                    'losing_pitcher': game.get('Loss'),
                    'save_pitcher': game.get('Save'),
                    'attendance': game.get('Attendance'),
                    'game_time': game.get('Time')
                })
                
            logger.info(f"Successfully ingested schedule for {team_abbrev} {season}")
            
        except Exception as e:
            logger.error(f"Error ingesting schedule for {team_abbrev}: {e}")
    
    def _store_player_batting_game(self, batting_data):
        """Store player batting game data"""
        try:
            cursor = self.db_connection.cursor()
            
            # Adapt based on your enhanced_schema.sql
            query = """
            INSERT INTO player_game_stats (
                player_id, external_game_id, game_date, stats, created_at
            ) VALUES (%s, %s, %s, %s, NOW())
            ON CONFLICT (external_game_id, player_id) 
            DO UPDATE SET 
                stats = EXCLUDED.stats,
                updated_at = NOW()
            """
            
            # Create unique game_id from date + teams
            game_id = f"{batting_data['game_date']}_{batting_data['home_team']}_{batting_data['away_team']}"
            
            # Convert batting stats to JSON
            stats_json = json.dumps({
                'type': 'batting',
                'events': batting_data['events'],
                'description': batting_data['description'],
                'at_bat_number': batting_data['at_bat_number'],
                'pitch_number': batting_data['pitch_number'],
                'release_speed': batting_data['release_speed'],
                'hit_distance': batting_data['hit_distance_sc'],
                'launch_speed': batting_data['launch_speed'],
                'launch_angle': batting_data['launch_angle'],
                'estimated_ba': batting_data['estimated_ba_using_speedangle'],
                'estimated_woba': batting_data['estimated_woba_using_speedangle'],
                'woba_value': batting_data['woba_value'],
                'babip_value': batting_data['babip_value']
            })
            
            cursor.execute(query, (
                batting_data['player_id'],
                game_id,
                batting_data['game_date'],
                stats_json
            ))
            
            self.db_connection.commit()
            cursor.close()
            
        except Exception as e:
            logger.error(f"Error storing batting game stats: {e}")
    
    def _store_player_pitching_game(self, pitching_data):
        """Store player pitching game data"""
        try:
            cursor = self.db_connection.cursor()
            
            query = """
            INSERT INTO player_game_stats (
                player_id, external_game_id, game_date, stats, created_at
            ) VALUES (%s, %s, %s, %s, NOW())
            ON CONFLICT (external_game_id, player_id) 
            DO UPDATE SET 
                stats = EXCLUDED.stats,
                updated_at = NOW()
            """
            
            # Create unique game_id
            game_id = f"{pitching_data['game_date']}_{pitching_data['home_team']}_{pitching_data['away_team']}"
            
            # Convert pitching stats to JSON
            stats_json = json.dumps({
                'type': 'pitching',
                'pitch_type': pitching_data['pitch_type'],
                'release_speed': pitching_data['release_speed'],
                'release_spin_rate': pitching_data['release_spin_rate'],
                'release_extension': pitching_data['release_extension'],
                'horizontal_movement': pitching_data['pfx_x'],
                'vertical_movement': pitching_data['pfx_z'],
                'plate_location_x': pitching_data['plate_x'],
                'plate_location_z': pitching_data['plate_z'],
                'strike_zone_top': pitching_data['sz_top'],
                'strike_zone_bottom': pitching_data['sz_bot'],
                'events': pitching_data['events'],
                'description': pitching_data['description'],
                'zone': pitching_data['zone'],
                'balls': pitching_data['balls'],
                'strikes': pitching_data['strikes']
            })
            
            cursor.execute(query, (
                pitching_data['player_id'],
                game_id,
                pitching_data['game_date'],
                stats_json
            ))
            
            self.db_connection.commit()
            cursor.close()
            
        except Exception as e:
            logger.error(f"Error storing pitching game stats: {e}")
    
    def _store_team_batting_stats(self, team_data):
        """Store team season batting statistics"""
        try:
            cursor = self.db_connection.cursor()
            
            query = """
            INSERT INTO team_season_stats (
                team_id, season, stats_avg, updated_at
            ) VALUES (%s, %s, %s, NOW())
            ON CONFLICT (team_id, season)
            DO UPDATE SET
                stats_avg = EXCLUDED.stats_avg,
                updated_at = NOW()
            """
            
            stats_json = json.dumps({
                'type': 'batting',
                'games': team_data['games'],
                'at_bats': team_data['at_bats'],
                'runs': team_data['runs'],
                'hits': team_data['hits'],
                'doubles': team_data['doubles'],
                'triples': team_data['triples'],
                'home_runs': team_data['home_runs'],
                'rbi': team_data['rbi'],
                'walks': team_data['walks'],
                'strikeouts': team_data['strikeouts'],
                'stolen_bases': team_data['stolen_bases'],
                'batting_avg': team_data['batting_avg'],
                'on_base_pct': team_data['on_base_pct'],
                'slugging_pct': team_data['slugging_pct'],
                'ops': team_data['ops'],
                'ops_plus': team_data['ops_plus'],
                'war': team_data['war']
            })
            
            cursor.execute(query, (
                team_data['team'],  # Using team abbreviation as ID
                team_data['season'],
                stats_json
            ))
            
            self.db_connection.commit()
            cursor.close()
            
        except Exception as e:
            logger.error(f"Error storing team batting stats: {e}")
    
    def _store_team_pitching_stats(self, team_data):
        """Store team season pitching statistics"""
        try:
            cursor = self.db_connection.cursor()
            
            # Insert or update pitching stats in same table with different type
            query = """
            INSERT INTO team_season_stats (
                team_id, season, stats_avg, updated_at
            ) VALUES (%s, %s, %s, NOW())
            ON CONFLICT (team_id, season)
            DO UPDATE SET
                stats_avg = jsonb_set(team_season_stats.stats_avg, '{pitching}', EXCLUDED.stats_avg->'pitching'),
                updated_at = NOW()
            """
            
            stats_json = json.dumps({
                'pitching': {
                    'wins': team_data['wins'],
                    'losses': team_data['losses'],
                    'era': team_data['era'],
                    'games': team_data['games'],
                    'games_started': team_data['games_started'],
                    'complete_games': team_data['complete_games'],
                    'shutouts': team_data['shutouts'],
                    'saves': team_data['saves'],
                    'innings_pitched': team_data['innings_pitched'],
                    'hits_allowed': team_data['hits_allowed'],
                    'runs_allowed': team_data['runs_allowed'],
                    'earned_runs': team_data['earned_runs'],
                    'home_runs_allowed': team_data['home_runs_allowed'],
                    'walks_allowed': team_data['walks_allowed'],
                    'strikeouts': team_data['strikeouts'],
                    'whip': team_data['whip'],
                    'war': team_data['war']
                }
            })
            
            cursor.execute(query, (
                team_data['team'],
                team_data['season'],
                stats_json
            ))
            
            self.db_connection.commit()
            cursor.close()
            
        except Exception as e:
            logger.error(f"Error storing team pitching stats: {e}")
    
    def _store_team_game_result(self, game_data):
        """Store individual game results"""
        try:
            cursor = self.db_connection.cursor()
            
            # This could go in a separate team_games table
            query = """
            INSERT INTO team_game_results (
                team, season, game_date, opponent, result, runs_scored, 
                runs_allowed, record, winning_pitcher, losing_pitcher, 
                save_pitcher, attendance, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (team, game_date, opponent)
            DO UPDATE SET
                result = EXCLUDED.result,
                runs_scored = EXCLUDED.runs_scored,
                runs_allowed = EXCLUDED.runs_allowed,
                record = EXCLUDED.record
            """
            
            cursor.execute(query, (
                game_data['team'],
                game_data['season'],
                game_data['date'],
                game_data['opponent'],
                game_data['result'],
                game_data['runs_scored'],
                game_data['runs_allowed'],
                game_data['record'],
                game_data['winning_pitcher'],
                game_data['losing_pitcher'],
                game_data['save_pitcher'],
                game_data['attendance']
            ))
            
            self.db_connection.commit()
            cursor.close()
            
        except Exception as e:
            logger.error(f"Error storing team game result: {e}")
    
    def daily_mlb_update(self):
        """
        Daily update of MLB statistics
        Run this daily to keep stats current
        """
        logger.info("Starting daily MLB statistics update...")
        
        # List of some top MLB players for daily updates (adjust as needed)
        top_players = [
            ('Judge', 'Aaron'),
            ('Ohtani', 'Shohei'), 
            ('Betts', 'Mookie'),
            ('Freeman', 'Freddie'),
            ('Soto', 'Juan'),
            ('Acuna Jr.', 'Ronald'),
            ('Guerrero Jr.', 'Vladimir'),
            ('Trout', 'Mike')
        ]
        
        # Update batting stats for top players
        for last_name, first_name in top_players:
            self.ingest_player_batting_stats(last_name, first_name)
            time.sleep(2)  # Rate limiting
        
        # Update team season stats
        self.ingest_team_season_stats()
        
        # Update schedules for major teams (sample)
        major_teams = ['NYY', 'LAD', 'BOS', 'HOU', 'ATL']
        for team in major_teams:
            self.ingest_team_schedule(team)
            time.sleep(1)
            
        logger.info("Daily MLB statistics update completed")

if __name__ == "__main__":
    # Example usage
    ingestor = MLBStatsIngestor()
    
    # Test with a specific player
    ingestor.ingest_player_batting_stats('Judge', 'Aaron')
    
    # Or run daily update
    # ingestor.daily_mlb_update() 
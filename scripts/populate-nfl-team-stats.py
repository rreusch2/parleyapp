#!/usr/bin/env python3
"""
NFL Team Stats Population Script
Uses nfl-data-py to populate team_recent_stats with real 2024 NFL game results
"""

import os
import sys
import logging
from datetime import datetime
from typing import Dict, List, Optional
import pandas as pd
import nfl_data_py as nfl
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/nfl_team_stats.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class NFLTeamStatsPopulator:
    def __init__(self):
        """Initialize the NFL team stats populator"""
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables")
        
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        self.team_mapping = {}
        
    def load_team_mapping(self) -> Dict[str, str]:
        """Load NFL team mapping from database"""
        try:
            # Get NFL teams from database
            response = self.supabase.table('teams').select('*').eq('sport_key', 'americanfootball_nfl').execute()
            
            teams = response.data
            logger.info(f"Found {len(teams)} NFL teams in database")
            
            # Create mapping from team abbreviations to database teams
            team_mapping = {}
            for team in teams:
                # Map common NFL abbreviations to database teams
                abbrev = team.get('team_abbreviation', '').upper()
                if abbrev:
                    team_mapping[abbrev] = {
                        'id': team['id'],
                        'name': team['team_name'],
                        'city': team.get('city', '')
                    }
            
            # Add special mappings for nfl-data-py inconsistencies
            # nfl-data-py uses "LA" for both Rams and Chargers, need to handle this
            if 'LAR' in team_mapping:
                team_mapping['LA'] = team_mapping['LAR']  # Default LA to Rams for now
            
            logger.info(f"Created mapping for {len(team_mapping)} teams")
            return team_mapping
            
        except Exception as e:
            logger.error(f"Error loading team mapping: {e}")
            return {}
    
    def get_2024_nfl_schedule_results(self) -> pd.DataFrame:
        """Get 2024 NFL schedule with results"""
        try:
            logger.info("Fetching 2024 NFL schedule and results...")
            
            # Get schedule data for 2024
            schedule_df = nfl.import_schedules([2024])
            
            # Debug: Check what columns are available
            logger.info(f"Available columns: {list(schedule_df.columns)}")
            
            # Filter for completed games only - check different possible column names
            if 'result' in schedule_df.columns:
                completed_games = schedule_df[schedule_df['result'].notna()].copy()
            elif 'home_score' in schedule_df.columns and 'away_score' in schedule_df.columns:
                # Filter where both scores exist (game completed)
                completed_games = schedule_df[
                    (schedule_df['home_score'].notna()) & 
                    (schedule_df['away_score'].notna())
                ].copy()
            else:
                # Just use all data if we can't determine completion
                completed_games = schedule_df.copy()
            
            logger.info(f"Found {len(completed_games)} completed 2024 NFL games")
            
            return completed_games
            
        except Exception as e:
            logger.error(f"Error fetching NFL schedule: {e}")
            return pd.DataFrame()
    
    def convert_nfl_data_to_team_stats(self, schedule_df: pd.DataFrame) -> List[Dict]:
        """Convert NFL schedule data to team_recent_stats format"""
        team_stats = []
        
        for _, game in schedule_df.iterrows():
            try:
                # Parse game data
                home_team = game.get('home_team', '')
                away_team = game.get('away_team', '')
                home_score = int(game.get('home_score', 0))
                away_score = int(game.get('away_score', 0))
                game_date = pd.to_datetime(game.get('gameday')).date().strftime('%Y-%m-%d')
                week = game.get('week', 0)
                season_type = game.get('season_type', 'REG')
                
                # Skip if missing essential data
                if not home_team or not away_team:
                    continue
                
                # Get team IDs from mapping
                home_team_info = self.team_mapping.get(home_team.upper())
                away_team_info = self.team_mapping.get(away_team.upper())
                
                if not home_team_info or not away_team_info:
                    logger.warning(f"Missing team mapping for {home_team} vs {away_team}")
                    continue
                
                # Determine results
                home_margin = home_score - away_score
                away_margin = away_score - home_score
                home_result = 'W' if home_score > away_score else 'L' if home_score < away_score else 'T'
                away_result = 'W' if away_score > home_score else 'L' if away_score < home_score else 'T'
                
                # Get spread and total if available
                spread_line = game.get('spread_line')
                total_line = game.get('total_line')
                
                # Calculate spread results if spread_line exists
                home_spread_result = None
                away_spread_result = None
                if spread_line is not None:
                    # Spread is typically from home team perspective
                    home_ats_margin = home_margin + float(spread_line)
                    home_spread_result = 'W' if home_ats_margin > 0 else 'L' if home_ats_margin < 0 else 'P'
                    away_spread_result = 'W' if home_ats_margin < 0 else 'L' if home_ats_margin > 0 else 'P'
                
                # Calculate total results if total_line exists
                total_result = None
                if total_line is not None:
                    total_points = home_score + away_score
                    total_result = 'O' if total_points > float(total_line) else 'U'
                
                # Create external game ID
                external_game_id = f"nfl_2024_{game.get('game_id', f'{away_team}_{home_team}_{game_date}')}"
                
                # Home team record
                home_record = {
                    'team_id': home_team_info['id'],
                    'team_name': home_team_info['name'],
                    'sport': 'NFL',
                    'sport_key': 'americanfootball_nfl',
                    'game_date': game_date,
                    'opponent_team': away_team_info['name'],
                    'opponent_team_id': away_team_info['id'],
                    'is_home': True,
                    'team_score': home_score,
                    'opponent_score': away_score,
                    'game_result': home_result,
                    'margin': home_margin,
                    'spread_line': spread_line,
                    'spread_result': home_spread_result,
                    'total_line': total_line,
                    'total_result': total_result,
                    'external_game_id': external_game_id,
                    'venue': game.get('location'),
                    'weather_conditions': None,  # NFL data doesn't include weather
                    'offensive_performance': None,  # Could calculate later
                    'defensive_performance': None   # Could calculate later
                }
                
                # Away team record
                away_record = {
                    'team_id': away_team_info['id'],
                    'team_name': away_team_info['name'],
                    'sport': 'NFL',
                    'sport_key': 'americanfootball_nfl',
                    'game_date': game_date,
                    'opponent_team': home_team_info['name'],
                    'opponent_team_id': home_team_info['id'],
                    'is_home': False,
                    'team_score': away_score,
                    'opponent_score': home_score,
                    'game_result': away_result,
                    'margin': away_margin,
                    'spread_line': -spread_line if spread_line is not None else None,  # Flip spread for away team
                    'spread_result': away_spread_result,
                    'total_line': total_line,
                    'total_result': total_result,
                    'external_game_id': external_game_id,
                    'venue': game.get('location'),
                    'weather_conditions': None,
                    'offensive_performance': None,
                    'defensive_performance': None
                }
                
                team_stats.extend([home_record, away_record])
                
            except Exception as e:
                logger.error(f"Error processing game {game}: {e}")
                continue
        
        logger.info(f"Converted {len(team_stats)} team game records")
        return team_stats
    
    def insert_team_stats(self, team_stats: List[Dict]) -> bool:
        """Insert team stats into database"""
        try:
            logger.info(f"Inserting {len(team_stats)} team game records...")
            
            # Insert in batches of 100
            batch_size = 100
            total_inserted = 0
            
            for i in range(0, len(team_stats), batch_size):
                batch = team_stats[i:i + batch_size]
                
                response = self.supabase.table('team_recent_stats').insert(batch).execute()
                
                if response.data:
                    total_inserted += len(response.data)
                    logger.info(f"Inserted batch {i//batch_size + 1}: {len(response.data)} records")
                else:
                    logger.error(f"Failed to insert batch {i//batch_size + 1}")
                    return False
            
            logger.info(f"Successfully inserted {total_inserted} total team game records")
            return True
            
        except Exception as e:
            logger.error(f"Error inserting team stats: {e}")
            return False
    
    def run(self):
        """Main execution function"""
        try:
            logger.info("Starting NFL team stats population for 2024 season...")
            
            # Load team mapping
            self.team_mapping = self.load_team_mapping()
            if not self.team_mapping:
                logger.error("No team mapping available - cannot proceed")
                return False
            
            # Get 2024 NFL schedule and results
            schedule_df = self.get_2024_nfl_schedule_results()
            if schedule_df.empty:
                logger.error("No NFL game data available")
                return False
            
            # Convert to team stats format
            team_stats = self.convert_nfl_data_to_team_stats(schedule_df)
            if not team_stats:
                logger.error("No team stats generated")
                return False
            
            # Insert into database
            success = self.insert_team_stats(team_stats)
            
            if success:
                logger.info("NFL team stats population completed successfully!")
                
                # Log summary stats
                total_games = len(team_stats) // 2  # Each game creates 2 records
                unique_teams = len(set(stat['team_id'] for stat in team_stats))
                logger.info(f"Summary: {total_games} games, {unique_teams} teams, {len(team_stats)} total records")
                
                return True
            else:
                logger.error("Failed to insert team stats")
                return False
                
        except Exception as e:
            logger.error(f"Error in main execution: {e}")
            return False

def main():
    """Main entry point"""
    try:
        populator = NFLTeamStatsPopulator()
        populator.run()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

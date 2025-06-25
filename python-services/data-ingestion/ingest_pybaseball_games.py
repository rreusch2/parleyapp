#!/usr/bin/env python3
"""
PyBaseball Historical Games Ingestion
Fetches comprehensive MLB game data for ML model training
"""

import os
import sys
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from pybaseball import schedule_and_record, team_game_logs, standings
import time
import uuid

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MLB team abbreviations
MLB_TEAMS = [
    'ARI', 'ATL', 'BAL', 'BOS', 'CHC', 'CHW', 'CIN', 'CLE', 'COL', 'DET',
    'HOU', 'KCR', 'LAA', 'LAD', 'MIA', 'MIL', 'MIN', 'NYM', 'NYY', 'OAK',
    'PHI', 'PIT', 'SDP', 'SFG', 'SEA', 'STL', 'TBR', 'TEX', 'TOR', 'WSN'
]

# Historical team mappings (for relocated/renamed teams)
TEAM_HISTORY = {
    'WSN': ['MON'],  # Nationals were Expos
    'LAA': ['ANA', 'CAL'],  # Angels name changes
    'MIA': ['FLA'],  # Marlins were Florida
    'TBR': ['TBD'],  # Rays were Devil Rays
}

class PyBaseballIngester:
    """Ingest MLB game data using pybaseball"""
    
    def __init__(self):
        self.conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=int(os.getenv('DB_PORT', 5432)),
            sslmode='require'
        )
        logger.info("✅ Connected to database")
    
    def ingest_season(self, season: int):
        """Ingest all games for a specific season"""
        logger.info(f"⚾ Processing {season} MLB season...")
        
        cursor = self.conn.cursor()
        games_ingested = 0
        
        for team in MLB_TEAMS:
            try:
                # Try current abbreviation first
                team_abbrs = [team]
                
                # Add historical abbreviations if they exist
                if team in TEAM_HISTORY:
                    team_abbrs.extend(TEAM_HISTORY[team])
                
                data_found = False
                for abbr in team_abbrs:
                    try:
                        logger.info(f"  Fetching {abbr} games...")
                        
                        # Get schedule and record
                        df = schedule_and_record(season, abbr)
                        
                        if df is not None and not df.empty:
                            data_found = True
                            games_ingested += self.process_team_games(df, abbr, season, cursor)
                            break
                            
                    except Exception as e:
                        if "could not find" not in str(e).lower():
                            logger.warning(f"    Error with {abbr}: {e}")
                        continue
                
                if not data_found:
                    logger.warning(f"  ⚠️ No data found for {team} in {season}")
                
                # Be nice to Baseball Reference
                time.sleep(1)
                
            except Exception as e:
                logger.error(f"  ❌ Error processing {team}: {e}")
                continue
        
        self.conn.commit()
        logger.info(f"✅ Ingested {games_ingested} games for {season} season")
        
        return games_ingested
    
    def process_team_games(self, df: pd.DataFrame, team: str, season: int, cursor):
        """Process games for a specific team"""
        games_processed = 0
        
        for _, game in df.iterrows():
            try:
                # Skip future games or games without scores
                if pd.isna(game.get('R')) or pd.isna(game.get('RA')):
                    continue
                
                # Determine home/away
                is_home = str(game.get('Home_Away', '')).strip() != '@'
                
                if is_home:
                    home_team = team
                    away_team = game['Opp']
                    home_score = int(game['R'])
                    away_score = int(game['RA'])
                else:
                    home_team = game['Opp']
                    away_team = team
                    home_score = int(game['RA'])
                    away_score = int(game['R'])
                
                # Parse game date
                game_date = pd.to_datetime(game['Date'])
                
                # Generate unique game ID
                game_id = f"{game_date.strftime('%Y%m%d')}_{away_team}_{home_team}"
                
                # Extract additional info
                attendance = None
                if 'Attendance' in game and pd.notna(game['Attendance']):
                    try:
                        # Remove commas and convert to int
                        attendance = int(str(game['Attendance']).replace(',', ''))
                    except:
                        pass
                
                # Check if game already exists
                cursor.execute("""
                    SELECT id FROM historical_games 
                    WHERE external_game_id = %s
                """, (game_id,))
                
                if cursor.fetchone():
                    continue
                
                # Insert game
                cursor.execute("""
                    INSERT INTO historical_games (
                        external_game_id, sport, league, season,
                        home_team, away_team, game_date,
                        home_score, away_score, attendance,
                        source
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                """, (
                    game_id, 'MLB', 'MLB', str(season),
                    home_team, away_team, game_date,
                    home_score, away_score, attendance,
                    'pybaseball'
                ))
                
                games_processed += 1
                
            except Exception as e:
                logger.error(f"    ❌ Error processing game: {e}")
                continue
        
        if games_processed > 0:
            logger.info(f"    ✅ Processed {games_processed} games for {team}")
        
        return games_processed
    
    def ingest_multiple_seasons(self, start_year: int, end_year: int):
        """Ingest multiple seasons of data"""
        total_games = 0
        
        for year in range(start_year, end_year + 1):
            games = self.ingest_season(year)
            total_games += games
            
            # Commit after each season
            self.conn.commit()
        
        logger.info(f"🎉 Total games ingested: {total_games}")
        return total_games
    
    def show_summary(self):
        """Show summary of ingested data"""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        
        # Overall summary
        cursor.execute("""
            SELECT 
                COUNT(*) as total_games,
                COUNT(DISTINCT season) as seasons,
                MIN(game_date) as earliest_game,
                MAX(game_date) as latest_game,
                COUNT(DISTINCT home_team) as teams
            FROM historical_games
            WHERE sport = 'MLB'
        """)
        
        summary = cursor.fetchone()
        
        print("\n" + "="*80)
        print("MLB HISTORICAL GAMES SUMMARY")
        print("="*80)
        print(f"Total games: {summary['total_games']:,}")
        print(f"Seasons: {summary['seasons']}")
        print(f"Teams: {summary['teams']}")
        print(f"Date range: {summary['earliest_game']} to {summary['latest_game']}")
        
        # Games by season
        cursor.execute("""
            SELECT 
                season,
                COUNT(*) as games,
                COUNT(DISTINCT home_team) as teams
            FROM historical_games
            WHERE sport = 'MLB'
            GROUP BY season
            ORDER BY season DESC
            LIMIT 10
        """)
        
        print("\nGames by Season (last 10):")
        print("-" * 40)
        for row in cursor.fetchall():
            print(f"{row['season']}: {row['games']:,} games, {row['teams']} teams")
        
        cursor.close()
    
    def __del__(self):
        """Clean up database connection"""
        if hasattr(self, 'conn') and self.conn:
            self.conn.close()

if __name__ == "__main__":
    ingester = PyBaseballIngester()
    
    if len(sys.argv) > 1:
        # Single season mode
        try:
            season = int(sys.argv[1])
            logger.info(f"Ingesting {season} season...")
            ingester.ingest_season(season)
        except ValueError:
            print(f"Invalid season: {sys.argv[1]}")
            print("Usage: python3 ingest_pybaseball_games.py [season]")
            print("   or: python3 ingest_pybaseball_games.py [start_year] [end_year]")
    elif len(sys.argv) == 3:
        # Multiple seasons mode
        try:
            start = int(sys.argv[1])
            end = int(sys.argv[2])
            logger.info(f"Ingesting seasons {start} to {end}...")
            ingester.ingest_multiple_seasons(start, end)
        except ValueError:
            print("Invalid years")
    else:
        # Default: Last 3 complete seasons
        current_year = datetime.now().year
        # If we're past April, include current season
        if datetime.now().month > 4:
            end_year = current_year
        else:
            end_year = current_year - 1
        
        start_year = end_year - 2
        
        logger.info(f"Ingesting default seasons {start_year} to {end_year}...")
        ingester.ingest_multiple_seasons(start_year, end_year)
    
    # Show summary
    ingester.show_summary() 
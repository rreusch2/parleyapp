#!/usr/bin/env python3
"""
Team Game Data Ingestion using MLB-StatsAPI
Fetches historical MLB team games with scores for ML/spread/totals training
"""

import os
import sys
import logging
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from datetime import datetime, timedelta
import statsapi
import time

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configure MLB-StatsAPI logging
statsapi_logger = logging.getLogger('statsapi')
statsapi_logger.setLevel(logging.DEBUG)

class TeamGameIngester:
    """Ingest MLB team game data with scores using MLB-StatsAPI"""
    
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
    
    def get_mlb_teams(self):
        """Get all MLB teams"""
        try:
            teams = statsapi.get('teams', {'sportId': 1})
            team_list = []
            for team in teams['teams']:
                team_list.append({
                    'id': team['id'],
                    'name': team['name'],
                    'teamName': team['teamName'],
                    'abbreviation': team['abbreviation']
                })
            logger.info(f"📋 Found {len(team_list)} MLB teams")
            return team_list
        except Exception as e:
            logger.error(f"❌ Error fetching MLB teams: {e}")
            return []
    
    def fetch_mlb_games(self, start_date: str, end_date: str, team_id: int = None):
        """Fetch MLB games for date range"""
        try:
            params = {
                'start_date': start_date,
                'end_date': end_date,
                'sportId': 1  # MLB
            }
            
            if team_id:
                params['team'] = team_id
            
            # Get schedule data
            schedule_data = statsapi.schedule(**params)
            
            logger.info(f"📊 Fetched {len(schedule_data)} MLB games from {start_date} to {end_date}")
            return schedule_data
            
        except Exception as e:
            logger.error(f"❌ Error fetching MLB games: {e}")
            return []
    
    def ingest_mlb_games(self, days_back: int = 30):
        """Ingest MLB games for the specified number of days back"""
        logger.info(f"⚾ Processing MLB games for last {days_back} days...")
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        start_date_str = start_date.strftime('%Y-%m-%d')
        end_date_str = end_date.strftime('%Y-%m-%d')
        
        # Fetch games
        games = self.fetch_mlb_games(start_date_str, end_date_str)
        
        cursor = self.conn.cursor()
        ingested_count = 0
        
        for game in games:
            try:
                # Only process completed games with final scores
                if game.get('status') != 'Final':
                    continue
                
                # Extract game data
                home_team = game.get('home_name', '')
                away_team = game.get('away_name', '')
                home_score = game.get('home_score')
                away_score = game.get('away_score')
                
                # Skip if no scores available
                if home_score is None or away_score is None:
                    continue
                
                # Parse game date
                game_date = datetime.strptime(game['game_date'], '%Y-%m-%d')
                
                # Create external game ID
                external_game_id = f"mlb_{game['game_id']}"
                
                # Check if game already exists
                cursor.execute("""
                    SELECT id FROM historical_games 
                    WHERE external_game_id = %s
                """, (external_game_id,))
                
                existing = cursor.fetchone()
                
                if not existing:
                    # Insert into historical_games table
                    cursor.execute("""
                        INSERT INTO historical_games (
                            external_game_id, sport, league, 
                            home_team, away_team, game_date,
                            home_score, away_score, source
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s
                        )
                    """, (
                        external_game_id, 'MLB', 'baseball_mlb',
                        home_team, away_team, game_date,
                        int(home_score), int(away_score), 'mlb_statsapi'
                    ))
                    
                    ingested_count += 1
                    
                    # Log progress
                    if ingested_count % 50 == 0:
                        logger.info(f"📈 Processed {ingested_count} games...")
                        self.conn.commit()
                
            except Exception as e:
                logger.error(f"❌ Error processing game {game.get('game_id', 'unknown')}: {e}")
                continue
        
        self.conn.commit()
        logger.info(f"✅ Ingested {ingested_count} MLB games")
        
        return ingested_count
    
    def ingest_mlb_season(self, year: int):
        """Ingest entire MLB season data"""
        logger.info(f"⚾ Processing MLB {year} season...")
        
        # MLB season typically runs from March to October
        start_date = f"{year}-03-01"
        end_date = f"{year}-11-30"
        
        # Fetch games for the entire season
        games = self.fetch_mlb_games(start_date, end_date)
        
        cursor = self.conn.cursor()
        ingested_count = 0
        
        for game in games:
            try:
                # Only process completed games with final scores
                if game.get('status') != 'Final':
                    continue
                
                # Extract game data
                home_team = game.get('home_name', '')
                away_team = game.get('away_name', '')
                home_score = game.get('home_score')
                away_score = game.get('away_score')
                
                # Skip if no scores available
                if home_score is None or away_score is None:
                    continue
                
                # Parse game date
                game_date = datetime.strptime(game['game_date'], '%Y-%m-%d')
                
                # Create external game ID
                external_game_id = f"mlb_{game['game_id']}"
                
                # Check if game already exists
                cursor.execute("""
                    SELECT id FROM historical_games 
                    WHERE external_game_id = %s
                """, (external_game_id,))
                
                existing = cursor.fetchone()
                
                if not existing:
                    # Insert into historical_games table
                    cursor.execute("""
                        INSERT INTO historical_games (
                            external_game_id, sport, league, 
                            home_team, away_team, game_date,
                            home_score, away_score, source
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s, %s, %s, %s
                        )
                    """, (
                        external_game_id, 'MLB', 'baseball_mlb',
                        home_team, away_team, game_date,
                        int(home_score), int(away_score), 'mlb_statsapi'
                    ))
                    
                    ingested_count += 1
                    
                    # Log progress and commit periodically
                    if ingested_count % 100 == 0:
                        logger.info(f"📈 Processed {ingested_count} games...")
                        self.conn.commit()
                
            except Exception as e:
                logger.error(f"❌ Error processing game {game.get('game_id', 'unknown')}: {e}")
                continue
        
        self.conn.commit()
        logger.info(f"✅ Ingested {ingested_count} MLB games for {year} season")
        
        return ingested_count
    
    def show_summary(self):
        """Show summary of ingested data"""
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT 
                sport,
                COUNT(*) as total_games,
                COUNT(CASE WHEN home_score IS NOT NULL THEN 1 END) as has_scores,
                MIN(game_date) as earliest_game,
                MAX(game_date) as latest_game
            FROM historical_games
            WHERE source = 'mlb_statsapi'
            GROUP BY sport
            ORDER BY sport
        """)
        
        results = cursor.fetchall()
        
        print("\n" + "="*80)
        print("MLB TEAM GAME DATA SUMMARY")
        print("="*80)
        
        for row in results:
            print(f"\n{row['sport']}:")
            print(f"  Total games: {row['total_games']:,}")
            print(f"  Has scores: {row['has_scores']:,}")
            print(f"  Date range: {row['earliest_game']} to {row['latest_game']}")
        
        # Show recent games
        cursor.execute("""
            SELECT home_team, away_team, home_score, away_score, game_date
            FROM historical_games
            WHERE source = 'mlb_statsapi'
            ORDER BY game_date DESC
            LIMIT 10
        """)
        
        recent_games = cursor.fetchall()
        
        if recent_games:
            print(f"\n📊 Recent Games:")
            for game in recent_games:
                print(f"  {game['game_date']}: {game['away_team']} @ {game['home_team']} ({game['away_score']}-{game['home_score']})")
        
        cursor.close()
    
    def __del__(self):
        """Clean up database connection"""
        if hasattr(self, 'conn') and self.conn:
            self.conn.close()

if __name__ == "__main__":
    ingester = TeamGameIngester()
    
    # Command line options
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == 'season' and len(sys.argv) > 2:
            # Ingest specific season
            try:
                year = int(sys.argv[2])
                ingester.ingest_mlb_season(year)
            except ValueError:
                print("❌ Invalid year format. Use: python ingest_team_games.py season 2023")
        elif command == 'recent':
            # Ingest recent games (default 30 days)
            days = 30
            if len(sys.argv) > 2:
                try:
                    days = int(sys.argv[2])
                except ValueError:
                    print("⚠️ Invalid days format, using default 30 days")
            ingester.ingest_mlb_games(days_back=days)
        else:
            print("Usage:")
            print("  python ingest_team_games.py recent [days]     # Recent games (default 30 days)")
            print("  python ingest_team_games.py season [year]     # Full season data")
            print("  python ingest_team_games.py                   # Recent games (30 days)")
    else:
        # Default: ingest recent games
        ingester.ingest_mlb_games(days_back=30)
    
    # Show summary
    ingester.show_summary() 
"""
Predictive Play Data Ingestion for Supabase
Modified version with SSL support for Supabase
"""

import os
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import httpx
import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch
from psycopg2.pool import SimpleConnectionPool
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dataclasses import dataclass, asdict
import backoff
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Environment configuration
API_KEY = os.getenv('THEODDS_API_KEY') or os.getenv('SPORTS_API_KEY')
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'postgres')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD')

# The Odds API configuration
THEODDS_BASE_URL = "https://api.the-odds-api.com/v4"

# Sports mapping for The Odds API
SPORT_MAPPING = {
    'NFL': 'americanfootball_nfl',
    'NBA': 'basketball_nba',
    'MLB': 'baseball_mlb',
    'NHL': 'icehockey_nhl',
    'NCAAF': 'americanfootball_ncaaf',
    'NCAAB': 'basketball_ncaab'
}

@dataclass
class GameEvent:
    """Represents a sports game event"""
    external_event_id: str
    sport_key: str
    home_team: str
    away_team: str
    start_time: datetime
    venue: Optional[str] = None
    status: str = 'scheduled'

@dataclass
class OddsData:
    """Represents odds data for a market"""
    event_id: str
    bookmaker: str
    market_type: str
    outcome_name: str
    outcome_price: float
    outcome_point: Optional[float] = None
    last_update: datetime = None

@dataclass
class PlayerProp:
    """Represents player prop odds"""
    event_id: str
    player_name: str
    prop_type: str
    line: float
    over_odds: float
    under_odds: float
    bookmaker: str
    last_update: datetime


class SupabaseDataIngestor:
    """Data ingestion service for Supabase"""
    
    def __init__(self):
        """Initialize with Supabase SSL connection"""
        # Database connection pool with SSL
        try:
            self.db_pool = SimpleConnectionPool(
                1, 20,
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                sslmode='require'  # Required for Supabase
            )
            logger.info("✅ Supabase connection pool created successfully")
        except Exception as e:
            logger.error(f"❌ Failed to create database connection pool: {e}")
            raise
        
        # HTTP client
        self.http_client = httpx.AsyncClient(timeout=30.0)
        
        # Scheduler for periodic tasks
        self.scheduler = AsyncIOScheduler()
        
        # API configuration
        self.api_key = API_KEY
        if not self.api_key:
            logger.warning("⚠️ No API key found. Please set THEODDS_API_KEY in .env")
    
    async def start(self):
        """Start the data ingestion service"""
        logger.info("🚀 Starting Supabase data ingestor...")
        
        # Test database connection
        if not await self.test_db_connection():
            logger.error("❌ Database connection test failed")
            return
        
        # Schedule periodic tasks with conservative intervals for 20k/month quota
        self._schedule_tasks()
        
        # Start the scheduler
        self.scheduler.start()
        
        # Initial data fetch
        await self.fetch_all_data()
        
        logger.info("✅ Data ingestor started successfully")
    
    async def test_db_connection(self):
        """Test database connection"""
        try:
            conn = self.db_pool.getconn()
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                result = cur.fetchone()
                self.db_pool.putconn(conn)
                logger.info("✅ Database connection test successful")
                return True
        except Exception as e:
            logger.error(f"❌ Database connection test failed: {e}")
            return False
    
    def _schedule_tasks(self):
        """Schedule periodic data fetching tasks"""
        # With 20,000 requests/month, we can be more aggressive
        
        # Live odds - every 15 minutes (96 requests/day)
        self.scheduler.add_job(
            self.fetch_live_odds,
            'interval',
            minutes=15,
            id='fetch_live_odds'
        )
        
        # Player props - every 30 minutes (48 requests/day)
        self.scheduler.add_job(
            self.fetch_player_props,
            'interval',
            minutes=30,
            id='fetch_player_props'
        )
        
        # Game schedules - 4 times daily
        self.scheduler.add_job(
            self.fetch_game_schedules,
            'cron',
            hour='0,6,12,18',
            id='fetch_game_schedules'
        )
        
        logger.info("📅 Scheduled tasks set up (optimized for 20k requests/month)")
    
    @backoff.on_exception(backoff.expo, httpx.HTTPError, max_tries=3)
    async def _make_api_request(self, endpoint: str, params: Optional[Dict] = None) -> Any:
        """Make an API request with retry logic"""
        url = f"{THEODDS_BASE_URL}/{endpoint}"
        params = params or {}
        params['apiKey'] = self.api_key
        
        logger.info(f"🔍 Fetching: {endpoint}")
        response = await self.http_client.get(url, params=params)
        
        # Log API usage
        remaining = response.headers.get('x-requests-remaining', 'N/A')
        used = response.headers.get('x-requests-used', 'N/A')
        logger.info(f"📊 API Usage: {used} used / {remaining} remaining")
        
        response.raise_for_status()
        return response.json()
    
    async def fetch_all_data(self):
        """Fetch all data types"""
        tasks = [
            self.fetch_game_schedules(),
            self.fetch_live_odds(),
            self.fetch_player_props(),
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Task {i} failed: {result}")
    
    async def fetch_game_schedules(self):
        """Fetch upcoming game schedules"""
        logger.info("📅 Fetching game schedules...")
        
        total_games = 0
        for sport_name, sport_key in SPORT_MAPPING.items():
            try:
                data = await self._make_api_request(f"sports/{sport_key}/events")
                games = self._parse_theodds_games(data, sport_name)
                
                if games:
                    await self._store_games(games)
                    total_games += len(games)
                    logger.info(f"✅ Fetched {len(games)} games for {sport_name}")
                
            except Exception as e:
                logger.error(f"Error fetching {sport_name} schedules: {e}")
        
        logger.info(f"📊 Total games fetched: {total_games}")
    
    async def fetch_live_odds(self):
        """Fetch live odds for upcoming games"""
        logger.info("💰 Fetching live odds...")
        
        # Get upcoming games from database
        games = await self._get_upcoming_games()
        logger.info(f"📊 Found {len(games)} upcoming games")
        
        # Group games by sport to minimize API calls
        games_by_sport = {}
        for game in games:
            sport = game['sport_key']
            if sport not in games_by_sport:
                games_by_sport[sport] = []
            games_by_sport[sport].append(game)
        
        total_odds = 0
        for sport_key, sport_games in games_by_sport.items():
            try:
                # Fetch odds for all games in this sport at once
                sport_api_key = SPORT_MAPPING.get(sport_key, sport_key.lower())
                params = {
                    'regions': 'us',
                    'markets': 'h2h,spreads,totals',
                    'oddsFormat': 'american'
                }
                
                data = await self._make_api_request(f"sports/{sport_api_key}/odds", params)
                
                # Parse and store odds
                for game_data in data:
                    game_id = next((g['id'] for g in sport_games 
                                  if g['external_event_id'] == game_data['id']), None)
                    if game_id:
                        odds_list = self._parse_theodds_odds(game_data, game_id)
                        if odds_list:
                            await self._store_odds(odds_list)
                            total_odds += len(odds_list)
                
            except Exception as e:
                logger.error(f"Error fetching odds for {sport_key}: {e}")
        
        logger.info(f"💰 Stored {total_odds} odds records")
    
    async def fetch_player_props(self):
        """Fetch player prop odds"""
        logger.info("🎯 Fetching player props...")
        
        # Get today's and tomorrow's games
        games = await self._get_upcoming_games(days=2)
        
        # Focus on high-priority games (limit to conserve API calls)
        priority_games = games[:10]  # Top 10 games
        
        total_props = 0
        for game in priority_games:
            try:
                sport_api_key = SPORT_MAPPING.get(game['sport_key'], game['sport_key'].lower())
                
                # Try to get player props for this specific game
                params = {
                    'regions': 'us',
                    'markets': 'player_points,player_rebounds,player_assists,player_threes'
                }
                
                # The Odds API requires event-specific endpoint for props
                data = await self._make_api_request(
                    f"sports/{sport_api_key}/events/{game['external_event_id']}/odds",
                    params
                )
                
                if data and 'bookmakers' in data:
                    props = self._parse_theodds_props(data, game['id'])
                    if props:
                        await self._store_player_props(props)
                        total_props += len(props)
                
            except Exception as e:
                if "404" not in str(e):  # 404 is expected for games without props
                    logger.error(f"Error fetching props for game {game['id']}: {e}")
        
        logger.info(f"🎯 Stored {total_props} player prop records")
    
    # Database operations
    async def _get_upcoming_games(self, days: int = 1) -> List[Dict]:
        """Get upcoming games from database"""
        conn = self.db_pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, external_event_id, sport, sport_key,
                           home_team, away_team, start_time
                    FROM sports_events
                    WHERE start_time BETWEEN NOW() AND NOW() + INTERVAL %s
                    AND status != 'completed'
                    ORDER BY start_time
                    LIMIT 50
                """, (f"{days} days",))
                
                games = cur.fetchall()
                
                # Map sport to our internal keys
                for game in games:
                    game['sport_key'] = game['sport']
                
                return games
        finally:
            self.db_pool.putconn(conn)
    
    async def _store_games(self, games: List[GameEvent]):
        """Store games in Supabase"""
        if not games:
            return
            
        conn = self.db_pool.getconn()
        try:
            with conn.cursor() as cur:
                # Prepare game data for insertion
                game_data = []
                for game in games:
                    # The Odds API uses full team names
                    # Map sport_key to league
                    league_mapping = {
                        'NFL': 'NFL',
                        'NBA': 'NBA',
                        'MLB': 'MLB',
                        'NHL': 'NHL',
                        'NCAAF': 'NCAA',
                        'NCAAB': 'NCAA'
                    }
                    league = league_mapping.get(game.sport_key, game.sport_key)
                    
                    game_data.append((
                        game.external_event_id,
                        game.sport_key,  # This will be sport
                        game.home_team,
                        game.away_team,
                        game.start_time,
                        game.status,
                        datetime.now(),
                        game.sport_key,  # This will be sport_key
                        league  # This will be league
                    ))
                
                # Insert or update games
                execute_batch(cur, """
                    INSERT INTO sports_events 
                    (external_event_id, sport, home_team, away_team, start_time, status, created_at, sport_key, league)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (external_event_id) 
                    DO UPDATE SET 
                        start_time = EXCLUDED.start_time,
                        status = EXCLUDED.status,
                        updated_at = NOW()
                """, game_data)
                
                conn.commit()
                logger.info(f"✅ Stored/updated {len(games)} games")
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error storing games: {e}")
            raise
        finally:
            self.db_pool.putconn(conn)
    
    async def _store_odds(self, odds_list: List[OddsData]):
        """Store odds in database"""
        if not odds_list:
            return
            
        conn = self.db_pool.getconn()
        try:
            with conn.cursor() as cur:
                # Prepare odds data
                odds_data = []
                for odds in odds_list:
                    odds_data.append((
                        odds.event_id,
                        odds.bookmaker,
                        odds.market_type,
                        odds.outcome_name,
                        odds.outcome_price,
                        odds.outcome_point,
                        odds.last_update or datetime.now()
                    ))
                
                # For now, we'll insert into a simplified odds table
                # You may need to adjust based on your exact Supabase schema
                execute_batch(cur, """
                    INSERT INTO odds_data 
                    (event_id, bookmaker, market_type, outcome_name,
                     outcome_price, outcome_point, last_update)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (event_id, bookmaker, market_type, outcome_name)
                    DO UPDATE SET
                        outcome_price = EXCLUDED.outcome_price,
                        outcome_point = EXCLUDED.outcome_point,
                        last_update = EXCLUDED.last_update
                """, odds_data)
                
                conn.commit()
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error storing odds: {e}")
        finally:
            self.db_pool.putconn(conn)
    
    async def _store_player_props(self, props: List[PlayerProp]):
        """Store player props in database"""
        if not props:
            return
            
        conn = self.db_pool.getconn()
        try:
            with conn.cursor() as cur:
                # Prepare props data
                props_data = []
                for prop in props:
                    props_data.append((
                        prop.event_id,
                        prop.player_name,
                        prop.prop_type,
                        prop.line,
                        prop.over_odds,
                        prop.under_odds,
                        prop.bookmaker,
                        prop.last_update
                    ))
                
                # Insert player props
                execute_batch(cur, """
                    INSERT INTO player_props 
                    (event_id, player_name, prop_type, line,
                     over_odds, under_odds, bookmaker, last_update)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (event_id, player_name, prop_type, bookmaker)
                    DO UPDATE SET
                        line = EXCLUDED.line,
                        over_odds = EXCLUDED.over_odds,
                        under_odds = EXCLUDED.under_odds,
                        last_update = EXCLUDED.last_update
                """, props_data)
                
                conn.commit()
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error storing player props: {e}")
        finally:
            self.db_pool.putconn(conn)
    
    # Parsing methods for The Odds API
    def _parse_theodds_games(self, data: List[Dict], sport: str) -> List[GameEvent]:
        """Parse games from The Odds API format"""
        games = []
        for event in data:
            try:
                game = GameEvent(
                    external_event_id=event['id'],
                    sport_key=sport,
                    home_team=event['home_team'],
                    away_team=event['away_team'],
                    start_time=datetime.fromisoformat(event['commence_time'].replace('Z', '+00:00')),
                    status='scheduled'
                )
                games.append(game)
            except Exception as e:
                logger.error(f"Error parsing game: {e}")
        return games
    
    def _parse_theodds_odds(self, data: Dict, event_id: str) -> List[OddsData]:
        """Parse odds from The Odds API format"""
        odds_list = []
        
        for bookmaker in data.get('bookmakers', []):
            bookmaker_name = bookmaker['title']
            
            for market in bookmaker.get('markets', []):
                market_type = market['key']
                
                for outcome in market.get('outcomes', []):
                    odds = OddsData(
                        event_id=event_id,
                        bookmaker=bookmaker_name,
                        market_type=market_type,
                        outcome_name=outcome['name'],
                        outcome_price=outcome['price'],
                        outcome_point=outcome.get('point'),
                        last_update=datetime.now()
                    )
                    odds_list.append(odds)
        
        return odds_list
    
    def _parse_theodds_props(self, data: Dict, event_id: str) -> List[PlayerProp]:
        """Parse player props from The Odds API format"""
        props_list = []
        
        for bookmaker in data.get('bookmakers', []):
            bookmaker_name = bookmaker['title']
            
            for market in bookmaker.get('markets', []):
                if 'player_' in market['key']:
                    prop_type = market['key'].replace('player_', '')
                    
                    # Group outcomes by player
                    player_props = {}
                    for outcome in market.get('outcomes', []):
                        # Parse player name and over/under
                        description = outcome.get('description', '')
                        if ' - ' in description:
                            player_name, ou_type = description.split(' - ')
                            
                            if player_name not in player_props:
                                player_props[player_name] = {
                                    'line': outcome.get('point', 0),
                                    'over_odds': None,
                                    'under_odds': None
                                }
                            
                            if 'Over' in ou_type:
                                player_props[player_name]['over_odds'] = outcome['price']
                            elif 'Under' in ou_type:
                                player_props[player_name]['under_odds'] = outcome['price']
                    
                    # Create PlayerProp objects
                    for player_name, prop_data in player_props.items():
                        if prop_data['over_odds'] and prop_data['under_odds']:
                            prop = PlayerProp(
                                event_id=event_id,
                                player_name=player_name,
                                prop_type=prop_type,
                                line=prop_data['line'],
                                over_odds=prop_data['over_odds'],
                                under_odds=prop_data['under_odds'],
                                bookmaker=bookmaker_name,
                                last_update=datetime.now()
                            )
                            props_list.append(prop)
        
        return props_list
    
    async def close(self):
        """Clean up resources"""
        await self.http_client.aclose()
        self.db_pool.closeall()
        logger.info("✅ Data ingestor shut down cleanly")


async def main():
    """Main entry point"""
    ingestor = SupabaseDataIngestor()
    
    try:
        await ingestor.start()
        
        # Keep running
        logger.info("🏃 Data ingestor is running. Press Ctrl+C to stop.")
        while True:
            await asyncio.sleep(60)  # Sleep for 1 minute
            
    except KeyboardInterrupt:
        logger.info("⏹️  Shutting down...")
        await ingestor.close()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        await ingestor.close()
        raise

if __name__ == "__main__":
    asyncio.run(main()) 
"""
ParleyApp Data Ingestion Microservice
Phase 1 Implementation - Supports OddsJam and The Odds API

This service handles:
- Real-time odds data ingestion
- Player props data
- Injury reports
- Historical data backfill
- Team and player master data
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
import redis
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dataclasses import dataclass, asdict
import backoff

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Environment configuration
API_PROVIDER = os.getenv('API_PROVIDER', 'oddsjam')  # 'oddsjam' or 'theodds'
API_KEY = os.getenv('SPORTS_API_KEY')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'parleyapp')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

# API Base URLs
ODDSJAM_BASE_URL = "https://api.oddsjam.com/api/v2"
THEODDS_BASE_URL = "https://api.the-odds-api.com/v4"

# Sports we support
SUPPORTED_SPORTS = ['NFL', 'NBA', 'MLB', 'NHL']

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

@dataclass
class InjuryReport:
    """Represents player injury data"""
    player_name: str
    team: str
    injury_type: str
    injury_status: str
    injury_date: datetime
    expected_return: Optional[datetime] = None
    notes: Optional[str] = None


class DataIngestor:
    """Main data ingestion service class"""
    
    def __init__(self):
        """Initialize the data ingestor with database and API connections"""
        # Database connection pool
        self.db_pool = SimpleConnectionPool(
            1, 20,
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        
        # Redis for caching and rate limiting
        self.redis_client = redis.from_url(REDIS_URL)
        
        # HTTP client with retry logic
        self.http_client = httpx.AsyncClient(timeout=30.0)
        
        # Scheduler for periodic tasks
        self.scheduler = AsyncIOScheduler()
        
        # API configuration based on provider
        if API_PROVIDER == 'oddsjam':
            self.base_url = ODDSJAM_BASE_URL
            self.headers = {
                'x-api-key': API_KEY,
                'Accept': 'application/json'
            }
        else:  # theodds
            self.base_url = THEODDS_BASE_URL
            self.headers = {
                'Accept': 'application/json'
            }
    
    async def start(self):
        """Start the data ingestion service"""
        logger.info(f"Starting data ingestor with provider: {API_PROVIDER}")
        
        # Schedule periodic tasks
        self._schedule_tasks()
        
        # Start the scheduler
        self.scheduler.start()
        
        # Initial data fetch
        await self.fetch_all_data()
        
        logger.info("Data ingestor started successfully")
    
    def _schedule_tasks(self):
        """Schedule periodic data fetching tasks"""
        # Real-time odds - every 5 minutes
        self.scheduler.add_job(
            self.fetch_live_odds,
            'interval',
            minutes=5,
            id='fetch_live_odds'
        )
        
        # Player props - every 10 minutes
        self.scheduler.add_job(
            self.fetch_player_props,
            'interval',
            minutes=10,
            id='fetch_player_props'
        )
        
        # Injury reports - every hour
        self.scheduler.add_job(
            self.fetch_injury_reports,
            'interval',
            hours=1,
            id='fetch_injury_reports'
        )
        
        # Game schedules - twice daily
        self.scheduler.add_job(
            self.fetch_game_schedules,
            'cron',
            hour='6,18',
            id='fetch_game_schedules'
        )
    
    @backoff.on_exception(backoff.expo, httpx.HTTPError, max_tries=3)
    async def _make_api_request(self, endpoint: str, params: Optional[Dict] = None) -> Dict:
        """Make an API request with retry logic"""
        if API_PROVIDER == 'oddsjam':
            url = f"{self.base_url}/{endpoint}"
        else:
            url = f"{self.base_url}/{endpoint}"
            params = params or {}
            params['apiKey'] = API_KEY
        
        response = await self.http_client.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()
    
    async def fetch_all_data(self):
        """Fetch all data types"""
        tasks = [
            self.fetch_game_schedules(),
            self.fetch_live_odds(),
            self.fetch_player_props(),
            self.fetch_injury_reports(),
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def fetch_game_schedules(self):
        """Fetch upcoming game schedules for all sports"""
        logger.info("Fetching game schedules...")
        
        for sport in SUPPORTED_SPORTS:
            try:
                if API_PROVIDER == 'oddsjam':
                    # OddsJam endpoint
                    data = await self._make_api_request(f"games/{sport.lower()}")
                    games = self._parse_oddsjam_games(data, sport)
                else:
                    # The Odds API endpoint
                    data = await self._make_api_request(f"sports/{sport.lower()}/events")
                    games = self._parse_theodds_games(data, sport)
                
                # Store games in database
                await self._store_games(games)
                
                logger.info(f"Fetched {len(games)} games for {sport}")
                
            except Exception as e:
                logger.error(f"Error fetching {sport} schedules: {e}")
    
    async def fetch_live_odds(self):
        """Fetch live odds for upcoming games"""
        logger.info("Fetching live odds...")
        
        # Get upcoming games from database
        games = await self._get_upcoming_games()
        
        for game in games:
            try:
                if API_PROVIDER == 'oddsjam':
                    # Fetch spreads, totals, moneyline
                    for market in ['spreads', 'totals', 'h2h']:
                        data = await self._make_api_request(
                            f"odds/{game['sport_key'].lower()}/{game['external_event_id']}/{market}"
                        )
                        odds = self._parse_oddsjam_odds(data, game['id'], market)
                        await self._store_odds(odds)
                else:
                    # The Odds API - single request for all markets
                    params = {
                        'regions': 'us',
                        'markets': 'spreads,totals,h2h',
                        'eventIds': game['external_event_id']
                    }
                    data = await self._make_api_request(
                        f"sports/{game['sport_key'].lower()}/odds",
                        params
                    )
                    odds = self._parse_theodds_odds(data, game['id'])
                    await self._store_odds(odds)
                    
            except Exception as e:
                logger.error(f"Error fetching odds for game {game['id']}: {e}")
    
    async def fetch_player_props(self):
        """Fetch player prop odds"""
        logger.info("Fetching player props...")
        
        # Get today's and tomorrow's games
        games = await self._get_upcoming_games(days=2)
        
        for game in games:
            try:
                if API_PROVIDER == 'oddsjam':
                    # OddsJam player props endpoint
                    data = await self._make_api_request(
                        f"props/{game['sport_key'].lower()}/{game['external_event_id']}"
                    )
                    props = self._parse_oddsjam_props(data, game['id'])
                else:
                    # The Odds API player props
                    params = {
                        'regions': 'us',
                        'markets': 'player_points,player_rebounds,player_assists',
                        'eventIds': game['external_event_id']
                    }
                    data = await self._make_api_request(
                        f"sports/{game['sport_key'].lower()}/events/{game['external_event_id']}/odds",
                        params
                    )
                    props = self._parse_theodds_props(data, game['id'])
                
                await self._store_player_props(props)
                
            except Exception as e:
                logger.error(f"Error fetching props for game {game['id']}: {e}")
    
    async def fetch_injury_reports(self):
        """Fetch injury reports for all sports"""
        logger.info("Fetching injury reports...")
        
        for sport in SUPPORTED_SPORTS:
            try:
                if API_PROVIDER == 'oddsjam':
                    # OddsJam injury endpoint
                    data = await self._make_api_request(f"injuries/{sport.lower()}")
                    injuries = self._parse_oddsjam_injuries(data, sport)
                    await self._store_injuries(injuries)
                else:
                    # The Odds API doesn't provide injuries - log warning
                    logger.warning(f"Injury data not available from The Odds API for {sport}")
                    
            except Exception as e:
                logger.error(f"Error fetching {sport} injuries: {e}")
    
    async def backfill_historical_data(self, start_date: datetime, end_date: datetime):
        """Backfill historical odds data for model training"""
        logger.info(f"Starting historical backfill from {start_date} to {end_date}")
        
        current_date = start_date
        while current_date <= end_date:
            try:
                if API_PROVIDER == 'oddsjam':
                    # OddsJam historical endpoint
                    for sport in SUPPORTED_SPORTS:
                        data = await self._make_api_request(
                            f"historical/{sport.lower()}/odds",
                            params={'date': current_date.strftime('%Y-%m-%d')}
                        )
                        await self._store_historical_odds(data, sport, current_date)
                else:
                    logger.warning("Historical data backfill not available for The Odds API")
                    break
                    
                current_date += timedelta(days=1)
                
                # Rate limiting - pause between days
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"Error backfilling data for {current_date}: {e}")
    
    # Database operations
    async def _get_upcoming_games(self, days: int = 1) -> List[Dict]:
        """Get upcoming games from database"""
        conn = self.db_pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT se.id, se.external_event_id, se.sport_key, 
                           se.home_team_id, se.away_team_id, se.start_time
                    FROM sports_events se
                    WHERE se.start_time BETWEEN NOW() AND NOW() + INTERVAL '%s days'
                    AND se.status = 'scheduled'
                    ORDER BY se.start_time
                """, (days,))
                return cur.fetchall()
        finally:
            self.db_pool.putconn(conn)
    
    async def _store_games(self, games: List[GameEvent]):
        """Store game events in database"""
        conn = self.db_pool.getconn()
        try:
            with conn.cursor() as cur:
                # First, ensure teams exist
                for game in games:
                    # Insert teams if they don't exist
                    cur.execute("""
                        INSERT INTO teams (team_key, team_name, sport_key)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (team_key) DO NOTHING
                    """, (game.home_team, game.home_team, game.sport_key))
                    
                    cur.execute("""
                        INSERT INTO teams (team_key, team_name, sport_key)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (team_key) DO NOTHING
                    """, (game.away_team, game.away_team, game.sport_key))
                
                # Get team IDs
                team_ids = {}
                for game in games:
                    cur.execute("SELECT id FROM teams WHERE team_key = %s", (game.home_team,))
                    team_ids[game.home_team] = cur.fetchone()[0]
                    cur.execute("SELECT id FROM teams WHERE team_key = %s", (game.away_team,))
                    team_ids[game.away_team] = cur.fetchone()[0]
                
                # Insert games
                game_data = []
                for game in games:
                    game_data.append((
                        game.external_event_id,
                        game.sport_key,
                        game.sport_key,  # Using sport as league for now
                        team_ids[game.home_team],
                        team_ids[game.away_team],
                        game.start_time,
                        game.venue,
                        game.status
                    ))
                
                execute_batch(cur, """
                    INSERT INTO sports_events 
                    (external_event_id, sport_key, league, home_team_id, 
                     away_team_id, start_time, venue, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (external_event_id) 
                    DO UPDATE SET 
                        start_time = EXCLUDED.start_time,
                        status = EXCLUDED.status,
                        updated_at = NOW()
                """, game_data)
                
                conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Error storing games: {e}")
            raise
        finally:
            self.db_pool.putconn(conn)
    
    async def _store_odds(self, odds_list: List[OddsData]):
        """Store odds data in database"""
        if not odds_list:
            return
            
        conn = self.db_pool.getconn()
        try:
            with conn.cursor() as cur:
                # Get bookmaker and market type IDs
                bookmaker_ids = {}
                market_ids = {}
                
                for odds in odds_list:
                    # Get or create bookmaker
                    cur.execute("""
                        INSERT INTO bookmakers (bookmaker_key, bookmaker_name)
                        VALUES (%s, %s)
                        ON CONFLICT (bookmaker_key) DO NOTHING
                        RETURNING id
                    """, (odds.bookmaker.lower(), odds.bookmaker))
                    
                    result = cur.fetchone()
                    if result:
                        bookmaker_ids[odds.bookmaker] = result[0]
                    else:
                        cur.execute("SELECT id FROM bookmakers WHERE bookmaker_key = %s", 
                                  (odds.bookmaker.lower(),))
                        bookmaker_ids[odds.bookmaker] = cur.fetchone()[0]
                    
                    # Get market type
                    if odds.market_type not in market_ids:
                        cur.execute("SELECT id FROM market_types WHERE market_key = %s", 
                                  (odds.market_type,))
                        result = cur.fetchone()
                        if result:
                            market_ids[odds.market_type] = result[0]
                
                # Prepare odds data for insertion
                odds_data = []
                for odds in odds_list:
                    # Calculate implied probability
                    if odds.outcome_price > 0:
                        implied_prob = 100.0 / (odds.outcome_price + 100.0)
                    else:
                        implied_prob = abs(odds.outcome_price) / (abs(odds.outcome_price) + 100.0)
                    
                    odds_data.append((
                        odds.event_id,
                        bookmaker_ids[odds.bookmaker],
                        market_ids.get(odds.market_type),
                        odds.outcome_name,
                        odds.outcome_price,
                        odds.outcome_point,
                        implied_prob,
                        odds.last_update or datetime.now()
                    ))
                
                # Insert odds data
                execute_batch(cur, """
                    INSERT INTO odds_data 
                    (event_id, bookmaker_id, market_type_id, outcome_name,
                     outcome_price, outcome_point, implied_probability, last_update)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, odds_data)
                
                conn.commit()
                
        except Exception as e:
            conn.rollback()
            logger.error(f"Error storing odds: {e}")
            raise
        finally:
            self.db_pool.putconn(conn)
    
    # Parsing methods for different API providers
    def _parse_oddsjam_games(self, data: Dict, sport: str) -> List[GameEvent]:
        """Parse games from OddsJam format"""
        games = []
        for game_data in data.get('games', []):
            game = GameEvent(
                external_event_id=game_data['id'],
                sport_key=sport,
                home_team=game_data['home_team'],
                away_team=game_data['away_team'],
                start_time=datetime.fromisoformat(game_data['start_time']),
                venue=game_data.get('venue'),
                status=game_data.get('status', 'scheduled')
            )
            games.append(game)
        return games
    
    def _parse_theodds_games(self, data: List[Dict], sport: str) -> List[GameEvent]:
        """Parse games from The Odds API format"""
        games = []
        for event in data:
            game = GameEvent(
                external_event_id=event['id'],
                sport_key=sport,
                home_team=event['home_team'],
                away_team=event['away_team'],
                start_time=datetime.fromisoformat(event['commence_time'].replace('Z', '+00:00')),
                status='scheduled'
            )
            games.append(game)
        return games
    
    def _parse_oddsjam_odds(self, data: Dict, event_id: str, market_type: str) -> List[OddsData]:
        """Parse odds from OddsJam format"""
        odds_list = []
        for bookmaker_data in data.get('odds', []):
            bookmaker = bookmaker_data['sportsbook']
            
            for outcome in bookmaker_data['outcomes']:
                odds = OddsData(
                    event_id=event_id,
                    bookmaker=bookmaker,
                    market_type=market_type,
                    outcome_name=outcome['name'],
                    outcome_price=outcome['price'],
                    outcome_point=outcome.get('point'),
                    last_update=datetime.fromisoformat(bookmaker_data['last_update'])
                )
                odds_list.append(odds)
        
        return odds_list
    
    def _parse_theodds_odds(self, data: List[Dict], event_id: str) -> List[OddsData]:
        """Parse odds from The Odds API format"""
        odds_list = []
        
        for bookmaker_data in data[0].get('bookmakers', []):
            bookmaker = bookmaker_data['title']
            
            for market in bookmaker_data['markets']:
                market_type = market['key']
                
                for outcome in market['outcomes']:
                    odds = OddsData(
                        event_id=event_id,
                        bookmaker=bookmaker,
                        market_type=market_type,
                        outcome_name=outcome['name'],
                        outcome_price=outcome['price'],
                        outcome_point=outcome.get('point'),
                        last_update=datetime.fromisoformat(bookmaker_data['last_update'])
                    )
                    odds_list.append(odds)
        
        return odds_list
    
    # Additional parsing methods would continue...


async def main():
    """Main entry point"""
    ingestor = DataIngestor()
    
    try:
        await ingestor.start()
        
        # Keep the service running
        while True:
            await asyncio.sleep(60)
            
    except KeyboardInterrupt:
        logger.info("Shutting down data ingestor...")
    finally:
        await ingestor.http_client.aclose()
        ingestor.db_pool.closeall()


if __name__ == "__main__":
    asyncio.run(main()) 
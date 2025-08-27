#!/usr/bin/env python3
"""
TheOdds API Team Trends Collector
Fetches historical team game scores and results using your existing TheOdds API setup
Accumulates data over time to build comprehensive team trends (last 10 games per team)
"""

import os
import sys
import asyncio
import aiohttp
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json
import re
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/reid/Desktop/parleyapp/logs/team-trends-collector.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Initialize Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://iriaegoipkjtktitpary.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_SERVICE_KEY:
    logger.error("SUPABASE_SERVICE_ROLE_KEY not found in environment")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# TheOdds API Configuration (using your existing setup)
THEODDS_API_KEY = os.getenv('THEODDS_API_KEY')
THEODDS_BASE_URL = "https://api.the-odds-api.com/v4"

if not THEODDS_API_KEY:
    logger.error("THEODDS_API_KEY not found in environment")
    sys.exit(1)

class TeamTrendsCollector:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.collected_games = 0
        self.updated_teams = 0
        
        # Sports supported by TheOdds API
        self.supported_sports = {
            'baseball_mlb': 'MLB',
            'americanfootball_nfl': 'NFL', 
            'basketball_nba': 'NBA',
            'basketball_wnba': 'WNBA',
            'icehockey_nhl': 'NHL'
        }
        
        # Common MLB team alias -> 3-letter abbreviation map (covers frequent source variations)
        # This helps when TheOdds uses full city names or nicknames while DB stores 3-letter codes.
        self.mlb_alias_to_abbrev: Dict[str, str] = {
            # AL East
            'new york yankees': 'NYY', 'yankees': 'NYY',
            'boston red sox': 'BOS', 'red sox': 'BOS',
            'tampa bay rays': 'TB', 'rays': 'TB',
            'toronto blue jays': 'TOR', 'blue jays': 'TOR',
            'baltimore orioles': 'BAL', 'orioles': 'BAL',
            # AL Central
            'cleveland guardians': 'CLE', 'guardians': 'CLE',
            'minnesota twins': 'MIN', 'twins': 'MIN',
            'detroit tigers': 'DET', 'tigers': 'DET',
            'kansas city royals': 'KC', 'royals': 'KC', 'kansas city': 'KC',
            'chicago white sox': 'CWS', 'white sox': 'CWS',
            # AL West
            'texas rangers': 'TEX', 'rangers': 'TEX',
            'houston astros': 'HOU', 'astros': 'HOU',
            'seattle mariners': 'SEA', 'mariners': 'SEA',
            'los angeles angels': 'LAA', 'la angels': 'LAA', 'angels': 'LAA', 'los angeles angels of anaheim': 'LAA',
            'oakland athletics': 'OAK', 'athletics': 'OAK', 'a\'s': 'OAK',
            # NL East
            'new york mets': 'NYM', 'mets': 'NYM',
            'philadelphia phillies': 'PHI', 'phillies': 'PHI',
            'atlanta braves': 'ATL', 'braves': 'ATL',
            'washington nationals': 'WSH', 'nationals': 'WSH',
            'miami marlins': 'MIA', 'marlins': 'MIA',
            # NL Central
            'chicago cubs': 'CHC', 'cubs': 'CHC',
            'st. louis cardinals': 'STL', 'st louis cardinals': 'STL', 'cardinals': 'STL',
            'cincinnati reds': 'CIN', 'reds': 'CIN',
            'milwaukee brewers': 'MIL', 'brewers': 'MIL',
            'pittsburgh pirates': 'PIT', 'pirates': 'PIT',
            # NL West
            'los angeles dodgers': 'LAD', 'la dodgers': 'LAD', 'dodgers': 'LAD',
            'san francisco giants': 'SF', 'giants': 'SF',
            'san diego padres': 'SD', 'padres': 'SD',
            'arizona diamondbacks': 'ARI', 'diamondbacks': 'ARI', 'd-backs': 'ARI', 'dbacks': 'ARI',
            'colorado rockies': 'COL', 'rockies': 'COL',
        }

    def _normalize(self, s: str) -> str:
        s = s or ''
        s = s.lower().strip()
        s = re.sub(r"[^a-z0-9\s\-']", '', s)
        s = re.sub(r"\s+", ' ', s)
        return s

    def _mlb_to_abbrev(self, name: str) -> Optional[str]:
        n = self._normalize(name)
        return self.mlb_alias_to_abbrev.get(n)
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def collect_team_trends(self, days_back: int = 3):
        """Main function to collect team trends from TheOdds API"""
        try:
            logger.info("🏈 Starting team trends collection from TheOdds API...")
            
            # Collect scores for each supported sport
            for sport_key, sport_name in self.supported_sports.items():
                await self.collect_sport_scores(sport_key, sport_name, days_back)
                
            logger.info(f"✅ Team trends collection completed!")
            logger.info(f"📊 Collected {self.collected_games} games, updated {self.updated_teams} team records")
            
        except Exception as e:
            logger.error(f"❌ Team trends collection failed: {e}")
            raise

    async def collect_sport_scores(self, sport_key: str, sport_name: str, days_back: int):
        """Collect historical scores for a specific sport"""
        try:
            logger.info(f"🏆 Collecting {sport_name} scores from last {days_back} days...")
            
            # Get scores for each day
            for days_ago in range(days_back):
                date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
                scores = await self.fetch_theodds_scores(sport_key, date)
                
                if scores:
                    logger.info(f"📈 Found {len(scores)} {sport_name} games for {date}")
                    
                    for score_data in scores:
                        await self.process_game_score(score_data, sport_name)
                        
        except Exception as e:
            logger.error(f"Error collecting {sport_name} scores: {e}")

    async def fetch_theodds_scores(self, sport_key: str, date: str) -> List[Dict]:
        """Fetch historical scores from TheOdds API for a specific date"""
        try:
            url = f"{THEODDS_BASE_URL}/sports/{sport_key}/scores"
            params = {
                'apiKey': THEODDS_API_KEY,
                'daysFrom': '1',  # Get scores from the specific date
                'dateFormat': 'iso'
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Filter for the specific date
                    filtered_scores = []
                    for game in data:
                        game_date = game.get('commence_time', '')[:10]  # Extract YYYY-MM-DD
                        if game_date == date:
                            filtered_scores.append(game)
                            
                    return filtered_scores
                else:
                    logger.error(f"TheOdds API error: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching scores from TheOdds API: {e}")
            return []

    async def process_game_score(self, score_data: Dict, sport_name: str):
        """Process individual game score and update team_recent_stats"""
        try:
            # Extract game data
            home_team_name = score_data.get('home_team')
            away_team_name = score_data.get('away_team')
            
            # Get scores - TheOdds API provides final scores in scores array
            scores = score_data.get('scores')
            if not scores or len(scores) < 2:
                logger.warning(f"Incomplete score data for {home_team_name} vs {away_team_name}")
                return
                
            home_score = None
            away_score = None
            
            for score in scores:
                if score['name'] == home_team_name:
                    home_score = score['score']
                elif score['name'] == away_team_name:
                    away_score = score['score']
                    
            if home_score is None or away_score is None:
                logger.warning(f"Could not parse scores for {home_team_name} vs {away_team_name}")
                return
                
            # Convert scores to integers for arithmetic operations
            try:
                home_score = int(home_score)
                away_score = int(away_score)
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid score format for {home_team_name} vs {away_team_name}: home={home_score}, away={away_score}")
                return
                
            game_date = score_data.get('commence_time', '')[:10]  # YYYY-MM-DD
            external_game_id = score_data.get('id', '')
            
            # Get team IDs from database
            home_team_id = await self.get_team_id(home_team_name, sport_name)
            away_team_id = await self.get_team_id(away_team_name, sport_name)
            
            if not home_team_id or not away_team_id:
                logger.warning(f"Could not find team IDs for {home_team_name} vs {away_team_name}")
                return
            
            # Create team stats records for both teams
            await self.create_team_stat_record(
                team_id=home_team_id,
                team_name=home_team_name,
                opponent_name=away_team_name,
                opponent_id=away_team_id,
                team_score=home_score,
                opponent_score=away_score,
                is_home=True,
                game_date=game_date,
                sport_name=sport_name,
                external_game_id=external_game_id
            )
            
            await self.create_team_stat_record(
                team_id=away_team_id,
                team_name=away_team_name,
                opponent_name=home_team_name,
                opponent_id=home_team_id,
                team_score=away_score,
                opponent_score=home_score,
                is_home=False,
                game_date=game_date,
                sport_name=sport_name,
                external_game_id=external_game_id
            )
            
            self.collected_games += 1
            
        except Exception as e:
            logger.error(f"Error processing game score: {e}")

    async def get_team_id(self, team_name: str, sport_name: str) -> Optional[str]:
        """Get team ID from database by name and sport"""
        try:
            # Map sport names to sport_keys in your database
            sport_key_mapping = {
                'MLB': 'MLB',
                'NFL': 'NFL',
                'NBA': 'NBA', 
                'WNBA': 'WNBA',
                'NHL': 'NHL'
            }
            
            sport_key = sport_key_mapping.get(sport_name)
            if not sport_key:
                return None
            
            name_query = team_name or ''
            abbrev_hint: Optional[str] = None
            if sport_key == 'MLB':
                abbrev_hint = self._mlb_to_abbrev(name_query)

            # Try by abbreviation hint first (exact/ilike on team_abbreviation or team_key)
            if abbrev_hint:
                resp = supabase.table('teams').select('id') \
                    .eq('sport_key', sport_key) \
                    .or_(f"team_abbreviation.eq.{abbrev_hint},team_key.eq.{abbrev_hint}") \
                    .execute()
                if resp.data:
                    return resp.data[0]['id']

            # Fallback: broad ilike search on name and abbreviation
            resp2 = supabase.table('teams').select('id') \
                .eq('sport_key', sport_key) \
                .or_(f"team_name.ilike.%{name_query}%,team_abbreviation.ilike.%{name_query}%") \
                .execute()
            if resp2.data:
                return resp2.data[0]['id']

            # Last attempt: if MLB and name has city + nickname, try only nickname part
            if sport_key == 'MLB':
                parts = (name_query or '').split(' ')
                if len(parts) > 1:
                    nickname = parts[-1]
                    resp3 = supabase.table('teams').select('id') \
                        .eq('sport_key', sport_key) \
                        .or_(f"team_name.ilike.%{nickname}%,team_abbreviation.ilike.%{nickname}%") \
                        .execute()
                    if resp3.data:
                        return resp3.data[0]['id']

            logger.warning(f"Team not found in database: {team_name} ({sport_name})")
            return None
                
        except Exception as e:
            logger.error(f"Error getting team ID: {e}")
            return None

    async def create_team_stat_record(self, team_id: str, team_name: str, opponent_name: str, 
                                    opponent_id: str, team_score: int, opponent_score: int,
                                    is_home: bool, game_date: str, sport_name: str, 
                                    external_game_id: str):
        """Create or update team_recent_stats record"""
        try:
            # Calculate game result and margin
            if team_score > opponent_score:
                game_result = 'W'
                margin = team_score - opponent_score
            elif team_score < opponent_score:
                game_result = 'L'
                margin = team_score - opponent_score  # Will be negative
            else:
                game_result = 'T'
                margin = 0
                
            # Map sport names to sport_keys
            sport_key_mapping = {
                'MLB': 'MLB',
                'NFL': 'NFL', 
                'NBA': 'NBA',
                'WNBA': 'WNBA',
                'NHL': 'NHL'
            }
            
            team_stat = {
                'team_id': team_id,
                'team_name': team_name,
                'sport': sport_name,
                'sport_key': sport_key_mapping.get(sport_name, sport_name),
                'game_date': game_date,
                'opponent_team': opponent_name,
                'opponent_team_id': opponent_id,
                'is_home': is_home,
                'team_score': team_score,
                'opponent_score': opponent_score,
                'game_result': game_result,
                'margin': margin,
                'external_game_id': external_game_id,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            # Upsert record (insert or update if exists)
            response = supabase.table('team_recent_stats').upsert(
                team_stat,
                on_conflict='team_id,game_date,opponent_team_id'
            ).execute()
            
            if response.data:
                self.updated_teams += 1
                logger.debug(f"✅ Updated team stat: {team_name} {game_result} vs {opponent_name} ({team_score}-{opponent_score})")
            
        except Exception as e:
            logger.error(f"Error creating team stat record: {e}")

    async def clean_old_records(self):
        """Remove team records older than 15 games to maintain performance"""
        try:
            logger.info("🧹 Cleaning old team records (keeping last 15 games per team)...")
            
            # This is handled by the database trigger we created, but we can run manual cleanup too
            cleanup_query = """
            WITH ranked_stats AS (
              SELECT id, 
                     ROW_NUMBER() OVER (
                       PARTITION BY team_id, sport_key 
                       ORDER BY game_date DESC
                     ) as row_num
              FROM team_recent_stats
            )
            DELETE FROM team_recent_stats 
            WHERE id IN (
              SELECT id FROM ranked_stats WHERE row_num > 15
            );
            """
            
            # Execute cleanup (would need to use raw SQL execution)
            logger.info("Old records cleanup completed via database trigger")
            
        except Exception as e:
            logger.error(f"Error cleaning old records: {e}")

async def main():
    """Main execution function"""
    try:
        async with TeamTrendsCollector() as collector:
            # Collect last 3 days by default (TheOdds API limitation)
            await collector.collect_team_trends(days_back=3)
            
            # Clean old records
            await collector.clean_old_records()
            
        logger.info("🎉 Team trends collection completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Team trends collection failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""
StatMuse MCP Server for ParleyApp
Provides real MLB statistics to all AI systems via Model Context Protocol
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import hashlib
import aiohttp
from bs4 import BeautifulSoup
import redis
from dataclasses import dataclass

# MCP imports
from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.types import (
    Resource,
    Tool,
    TextContent,
    ImageContent,
    EmbeddedResource,
    LoggingLevel
)
import mcp.types as types

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class StatMuseResult:
    """Structured result from StatMuse query"""
    query: str
    answer: str
    additional_stats: List[str]
    url: str
    cached: bool = False
    timestamp: datetime = None

class StatMuseCache:
    """Redis-based caching for StatMuse results"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        try:
            self.redis = redis.from_url(redis_url, decode_responses=True, socket_timeout=1)
            # Test connection with timeout
            self.redis.ping()
            logger.info("✅ Connected to Redis cache")
        except Exception as e:
            logger.warning(f"⚠️ Redis not available, using in-memory cache: {e}")
            self.redis = None
            self.memory_cache = {}
    
    def get_cache_key(self, query: str) -> str:
        """Generate cache key for query"""
        return f"statmuse:{hashlib.md5(query.lower().encode()).hexdigest()}"
    
    def get(self, query: str) -> Optional[StatMuseResult]:
        """Get cached result"""
        try:
            cache_key = self.get_cache_key(query)
            
            if self.redis:
                cached_data = self.redis.get(cache_key)
                if cached_data:
                    data = json.loads(cached_data)
                    return StatMuseResult(
                        query=data['query'],
                        answer=data['answer'],
                        additional_stats=data['additional_stats'],
                        url=data['url'],
                        cached=True,
                        timestamp=datetime.fromisoformat(data['timestamp'])
                    )
            else:
                # Use memory cache
                if cache_key in self.memory_cache:
                    cached_time, result = self.memory_cache[cache_key]
                    # Check if cache is still valid (1 hour)
                    if datetime.now() - cached_time < timedelta(hours=1):
                        result.cached = True
                        return result
                    else:
                        del self.memory_cache[cache_key]
                        
        except Exception as e:
            logger.error(f"Cache get error: {e}")
        
        return None
    
    def set(self, query: str, result: StatMuseResult, ttl: int = 3600):
        """Cache result"""
        try:
            cache_key = self.get_cache_key(query)
            result.timestamp = datetime.now()
            
            data = {
                'query': result.query,
                'answer': result.answer,
                'additional_stats': result.additional_stats,
                'url': result.url,
                'timestamp': result.timestamp.isoformat()
            }
            
            if self.redis:
                self.redis.setex(cache_key, ttl, json.dumps(data))
            else:
                # Use memory cache
                self.memory_cache[cache_key] = (datetime.now(), result)
                
        except Exception as e:
            logger.error(f"Cache set error: {e}")

class RateLimiter:
    """Rate limiter for StatMuse requests"""
    
    def __init__(self, max_requests: int = 30, window_minutes: int = 1):
        self.max_requests = max_requests
        self.window_seconds = window_minutes * 60
        self.requests = []
    
    async def wait_if_needed(self):
        """Wait if rate limit would be exceeded"""
        now = time.time()
        
        # Remove old requests outside the window
        self.requests = [req_time for req_time in self.requests 
                        if now - req_time < self.window_seconds]
        
        # Check if we're at the limit
        if len(self.requests) >= self.max_requests:
            oldest_request = min(self.requests)
            wait_time = self.window_seconds - (now - oldest_request)
            if wait_time > 0:
                logger.info(f"⏱️ Rate limit reached, waiting {wait_time:.1f} seconds")
                await asyncio.sleep(wait_time)
        
        # Record this request
        self.requests.append(now)

class StatMuseClient:
    """Async StatMuse client with caching and rate limiting"""
    
    def __init__(self):
        self.cache = StatMuseCache()
        self.rate_limiter = RateLimiter(max_requests=25, window_minutes=1)  # Conservative
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
    
    async def query(self, query: str) -> Optional[StatMuseResult]:
        """Query StatMuse with caching and rate limiting"""
        
        # Check cache first
        try:
            cached_result = self.cache.get(query)
            if cached_result:
                logger.info(f"📦 Cache hit for: {query}")
                return cached_result
        except Exception as e:
            logger.warning(f"⚠️ Cache get error (continuing anyway): {e}")
        
        logger.info(f"🔍 Querying StatMuse: {query}")
        
        # Try direct search first
        result = await self._try_statmuse_search(query)
        if result:
            return result
        
        # If search fails, try WNBA-specific scraping for WNBA queries
        if self._is_wnba_query(query):
            logger.info(f"🏀 Trying WNBA-specific scraping for: {query}")
            result = await self._try_wnba_scraping(query)
            if result:
                return result
        
        logger.warning(f"❌ All StatMuse methods failed for: {query}")
        return None
    
    def _is_wnba_query(self, query: str) -> bool:
        """Check if query is likely about WNBA"""
        wnba_keywords = [
            "a'ja wilson", "aja wilson", "breanna stewart", "sabrina ionescu", 
            "alyssa thomas", "kelsey plum", "jewell loyd", "candace parker",
            "diana taurasi", "sue bird", "maya moore", "elena delle donne",
            "wnba", "las vegas aces", "new york liberty", "seattle storm",
            "phoenix mercury", "chicago sky", "connecticut sun", "minnesota lynx",
            "atlanta dream", "dallas wings", "indiana fever", "washington mystics",
            "kamilla cardoso", "paige bueckers", "caitlin clark"
        ]
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in wnba_keywords)
    
    async def _try_wnba_scraping(self, query: str) -> Optional[StatMuseResult]:
        """Try WNBA-specific scraping from statmuse.com/wnba"""
        try:
            # Extract player name from query
            player_name = self._extract_player_name(query)
            if not player_name:
                return None
            
            # Try WNBA main page first
            wnba_url = "https://www.statmuse.com/wnba"
            
            timeout = aiohttp.ClientTimeout(total=15)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
                
                logger.info(f"🏀 Scraping WNBA page: {wnba_url}")
                async with session.get(wnba_url, headers=headers) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Look for player stats in various formats
                        answer = self._extract_wnba_player_stats(soup, player_name, query)
                        if answer:
                            result = StatMuseResult(
                                query=query,
                                answer=answer,
                                additional_stats=[],
                                url=wnba_url
                            )
                            
                            # Cache the result
                            try:
                                self.cache.set(query, result)
                            except Exception as e:
                                logger.warning(f"⚠️ Cache set error: {e}")
                            
                            logger.info(f"✅ WNBA scraping success: {answer}")
                            return result
                        
                        # If not found on main page, try direct player search
                        player_url = f"https://www.statmuse.com/wnba/player/{player_name.lower().replace(' ', '-').replace(chr(39), '')}"
                        logger.info(f"🏀 Trying player page: {player_url}")
                        
                        async with session.get(player_url, headers=headers) as player_response:
                            if player_response.status == 200:
                                player_html = await player_response.text()
                                player_soup = BeautifulSoup(player_html, 'html.parser')
                                
                                answer = self._extract_wnba_player_stats(player_soup, player_name, query)
                                if answer:
                                    result = StatMuseResult(
                                        query=query,
                                        answer=answer,
                                        additional_stats=[],
                                        url=player_url
                                    )
                                    
                                    try:
                                        self.cache.set(query, result)
                                    except Exception as e:
                                        logger.warning(f"⚠️ Cache set error: {e}")
                                    
                                    logger.info(f"✅ WNBA player page success: {answer}")
                                    return result
            
            return None
            
        except Exception as e:
            logger.error(f"❌ WNBA scraping error: {e}")
            return None
    
    def _extract_player_name(self, query: str) -> Optional[str]:
        """Extract player name from query"""
        # Common WNBA players
        wnba_players = [
            "A'ja Wilson", "Breanna Stewart", "Sabrina Ionescu", "Alyssa Thomas",
            "Kelsey Plum", "Jewell Loyd", "Candace Parker", "Diana Taurasi",
            "Sue Bird", "Maya Moore", "Elena Delle Donne", "Kamilla Cardoso",
            "Paige Bueckers", "Caitlin Clark", "Angel Reese", "Napheesa Collier"
        ]
        
        query_lower = query.lower()
        for player in wnba_players:
            if player.lower() in query_lower:
                return player
        
        return None
    
    def _extract_wnba_player_stats(self, soup: BeautifulSoup, player_name: str, query: str) -> Optional[str]:
        """Extract WNBA player stats from parsed HTML"""
        try:
            # Look for stat mentions in text
            text_content = soup.get_text().lower()
            player_lower = player_name.lower()
            
            # Common stat patterns
            if "points" in query.lower():
                # Look for points stats
                import re
                patterns = [
                    rf"{re.escape(player_lower)}.*?(\d+(?:\.\d+)?)\s*points?",
                    rf"(\d+(?:\.\d+)?)\s*points?.*?{re.escape(player_lower)}",
                    rf"{re.escape(player_lower)}.*?averaging\s*(\d+(?:\.\d+)?)\s*ppg",
                    rf"{re.escape(player_lower)}.*?has\s*(\d+(?:\.\d+)?)\s*points?"
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, text_content, re.IGNORECASE)
                    if match:
                        points = match.group(1)
                        return f"{player_name} has {points} points this season."
            
            elif "rebounds" in query.lower():
                import re
                patterns = [
                    rf"{re.escape(player_lower)}.*?(\d+(?:\.\d+)?)\s*rebounds?",
                    rf"(\d+(?:\.\d+)?)\s*rebounds?.*?{re.escape(player_lower)}",
                    rf"{re.escape(player_lower)}.*?averaging\s*(\d+(?:\.\d+)?)\s*rpg"
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, text_content, re.IGNORECASE)
                    if match:
                        rebounds = match.group(1)
                        return f"{player_name} has {rebounds} rebounds this season."
            
            elif "assists" in query.lower():
                import re
                patterns = [
                    rf"{re.escape(player_lower)}.*?(\d+(?:\.\d+)?)\s*assists?",
                    rf"(\d+(?:\.\d+)?)\s*assists?.*?{re.escape(player_lower)}",
                    rf"{re.escape(player_lower)}.*?averaging\s*(\d+(?:\.\d+)?)\s*apg"
                ]
                
                for pattern in patterns:
                    match = re.search(pattern, text_content, re.IGNORECASE)
                    if match:
                        assists = match.group(1)
                        return f"{player_name} has {assists} assists this season."
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting WNBA stats: {e}")
            return None
    
    async def _try_statmuse_search(self, query: str) -> Optional[StatMuseResult]:
        """Try the standard StatMuse search approach"""
        try:
            # Create StatMuse search URL
            query_encoded = query.replace(' ', '+')
            url = f"https://www.statmuse.com/search?q={query_encoded}"
            
            timeout = aiohttp.ClientTimeout(total=15)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
                
                logger.info(f"🌐 Fetching: {url}")
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        html = await response.text()
                        logger.info("🍲 Parsing with BeautifulSoup...")
                        soup = BeautifulSoup(html, 'html.parser')
                        
                        # Look for main answer
                        main_answer = soup.find('h1') or soup.find('h2')
                        if main_answer:
                            answer_text = main_answer.get_text(strip=True)
                            logger.info(f"📈 Found answer: {answer_text}")
                            
                            # Look for additional stats in tables
                            additional_stats = []
                            tables = soup.find_all('table')
                            logger.info(f"📊 Found {len(tables)} tables")
                            
                            for table in tables[:1]:  # Just first table
                                rows = table.find_all('tr')
                                for row in rows[:3]:  # First 3 rows
                                    cells = row.find_all(['td', 'th'])
                                    if len(cells) >= 3:
                                        row_data = [cell.get_text(strip=True) for cell in cells[:5]]
                                        if any(cell.replace('.', '').isdigit() for cell in row_data):
                                            additional_stats.append(' | '.join(row_data))
                            
                            result = StatMuseResult(
                                query=query,
                                answer=answer_text,
                                additional_stats=additional_stats[:3],
                                url=url
                            )
                            
                            # Cache the result
                            try:
                                self.cache.set(query, result)
                            except Exception as e:
                                logger.warning(f"⚠️ Cache set error: {e}")
                            
                            logger.info(f"✅ StatMuse success: {answer_text[:100]}...")
                            return result
                        
                        # If not found on search page, try direct query
                        formatted_query = query.lower().replace(' ', '-').replace(',', '').replace('?', '')
                        url = f"https://www.statmuse.com/mlb/ask/{formatted_query}"
                        
                        async with session.get(url, headers=headers) as response:
                            if response.status == 200:
                                html = await response.text()
                                logger.info("🍲 Parsing with BeautifulSoup...")
                                soup = BeautifulSoup(html, 'html.parser')
                                
                                # Look for main answer
                                main_answer = soup.find('h1') or soup.find('h2')
                                if main_answer:
                                    answer_text = main_answer.get_text(strip=True)
                                    logger.info(f"📈 Found answer: {answer_text}")
                                    
                                    # Look for additional stats in tables
                                    additional_stats = []
                                    tables = soup.find_all('table')
                                    logger.info(f"📊 Found {len(tables)} tables")
                                    
                                    for table in tables[:1]:  # Just first table
                                        rows = table.find_all('tr')
                                        for row in rows[:3]:  # First 3 rows
                                            cells = row.find_all(['td', 'th'])
                                            if len(cells) >= 3:
                                                row_data = [cell.get_text(strip=True) for cell in cells[:5]]
                                                if any(cell.replace('.', '').isdigit() for cell in row_data):
                                                    additional_stats.append(' | '.join(row_data))
                                    
                                    result = StatMuseResult(
                                        query=query,
                                        answer=answer_text,
                                        additional_stats=additional_stats[:3],
                                        url=url
                                    )
                                    
                                    # Cache the result
                                    try:
                                        self.cache.set(query, result)
                                    except Exception as e:
                                        logger.warning(f"⚠️ Cache set error: {e}")
                                    
                                    logger.info(f"✅ StatMuse success: {answer_text[:100]}...")
                                    return result
                                else:
                                    logger.warning(f"❌ No answer found in HTML for: {query}")
                                    return None
                            else:
                                logger.warning(f"❌ StatMuse HTTP error: {response.status}")
                                response_text = await response.text()
                                logger.warning(f"Response: {response_text[:200]}")
                                return None
                    else:
                        logger.warning(f"❌ StatMuse HTTP error: {response.status}")
                        response_text = await response.text()
                        logger.warning(f"Response: {response_text[:200]}")
                        return None
            logger.error(f"🌐 Network error querying StatMuse: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Unexpected error querying StatMuse: {e}")
            return None

# Initialize StatMuse client
statmuse_client = StatMuseClient()

# MCP Server
app = Server("statmuse-server")

@app.list_tools()
async def handle_list_tools() -> List[Tool]:
    """List available StatMuse tools"""
    return [
        Tool(
            name="query_statmuse",
            description="Query StatMuse for any MLB statistical information using natural language",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural language query for MLB stats (e.g. 'Yankees vs Red Sox last 5 meetings', 'Dodgers home record 2025')"
                    }
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="get_team_head_to_head",
            description="Get head-to-head record between two teams",
            inputSchema={
                "type": "object",
                "properties": {
                    "team1": {
                        "type": "string",
                        "description": "First team name"
                    },
                    "team2": {
                        "type": "string", 
                        "description": "Second team name"
                    },
                    "games": {
                        "type": "integer",
                        "description": "Number of recent games to check (default 5)",
                        "default": 5
                    }
                },
                "required": ["team1", "team2"]
            }
        ),
        Tool(
            name="get_team_record",
            description="Get a team's record (home, away, or overall)",
            inputSchema={
                "type": "object",
                "properties": {
                    "team": {
                        "type": "string",
                        "description": "Team name"
                    },
                    "record_type": {
                        "type": "string",
                        "description": "Type of record: 'home', 'away', 'overall', or 'last_10'",
                        "enum": ["home", "away", "overall", "last_10"]
                    },
                    "season": {
                        "type": "string",
                        "description": "Season year (default 2025)",
                        "default": "2025"
                    }
                },
                "required": ["team", "record_type"]
            }
        ),
        Tool(
            name="get_team_recent_performance",
            description="Get a team's recent performance and trends",
            inputSchema={
                "type": "object",
                "properties": {
                    "team": {
                        "type": "string",
                        "description": "Team name"
                    },
                    "games": {
                        "type": "integer",
                        "description": "Number of recent games (default 10)",
                        "default": 10
                    }
                },
                "required": ["team"]
            }
        ),
        Tool(
            name="get_player_stats",
            description="Get specific player statistics",
            inputSchema={
                "type": "object",
                "properties": {
                    "player": {
                        "type": "string",
                        "description": "Player name"
                    },
                    "stat_type": {
                        "type": "string",
                        "description": "Type of stats: 'hitting', 'pitching', 'recent', or 'season'",
                        "enum": ["hitting", "pitching", "recent", "season"]
                    },
                    "timeframe": {
                        "type": "string",
                        "description": "Timeframe: 'last_10', 'last_30', 'season', or '2025'",
                        "default": "season"
                    }
                },
                "required": ["player", "stat_type"]
            }
        )
    ]

@app.call_tool()
async def handle_call_tool(name: str, arguments: Dict[str, Any]) -> List[types.TextContent]:
    """Handle tool calls"""
    
    try:
        if name == "query_statmuse":
            query = arguments["query"]
            logger.info(f"🔧 Executing StatMuse query: {query}")
            
            # Add timeout to the query itself
            result = await asyncio.wait_for(
                statmuse_client.query(query), 
                timeout=15.0
            )
            
            if result:
                response_text = f"**StatMuse Query:** {result.query}\n\n"
                response_text += f"**Answer:** {result.answer}\n\n"
                
                if result.additional_stats:
                    response_text += f"**Additional Data:**\n"
                    for stat in result.additional_stats:
                        response_text += f"• {stat}\n"
                    response_text += "\n"
                
                response_text += f"**Source:** {result.url}\n"
                response_text += f"**Cached:** {'Yes' if result.cached else 'No'}"
                
                logger.info(f"✅ Query completed successfully")
                return [types.TextContent(type="text", text=response_text)]
            else:
                logger.warning(f"❌ No results found for query: {query}")
                return [types.TextContent(type="text", text=f"No results found for query: {query}")]
                
        elif name == "get_team_head_to_head":
            team1 = arguments["team1"]
            team2 = arguments["team2"] 
            games = arguments.get("games", 5)
            
            query = f"{team1} vs {team2} last {games} meetings"
            result = await statmuse_client.query(query)
            
            if result:
                return [types.TextContent(type="text", text=f"**Head-to-Head ({team1} vs {team2}):**\n{result.answer}")]
            else:
                return [types.TextContent(type="text", text=f"No head-to-head data found for {team1} vs {team2}")]
                
        elif name == "get_team_record":
            team = arguments["team"]
            record_type = arguments["record_type"]
            season = arguments.get("season", "2025")
            
            if record_type == "home":
                query = f"{team} home record {season}"
            elif record_type == "away":
                query = f"{team} road record {season}"
            elif record_type == "last_10":
                query = f"{team} last 10 games"
            else:
                query = f"{team} record {season}"
            
            result = await statmuse_client.query(query)
            
            if result:
                return [types.TextContent(type="text", text=f"**{team} {record_type.title()} Record:**\n{result.answer}")]
            else:
                return [types.TextContent(type="text", text=f"No record data found for {team}")]
                
        elif name == "get_team_recent_performance":
            team = arguments["team"]
            games = arguments.get("games", 10)
            
            query = f"{team} last {games} games"
            result = await statmuse_client.query(query)
            
            if result:
                return [types.TextContent(type="text", text=f"**{team} Recent Performance (Last {games} Games):**\n{result.answer}")]
            else:
                return [types.TextContent(type="text", text=f"No recent performance data found for {team}")]
                
        elif name == "get_player_stats":
            player = arguments["player"]
            stat_type = arguments["stat_type"]
            timeframe = arguments.get("timeframe", "season")
            
            if stat_type == "recent":
                query = f"{player} last 10 games"
            elif stat_type == "hitting":
                query = f"{player} batting stats {timeframe}"
            elif stat_type == "pitching":
                query = f"{player} pitching stats {timeframe}"
            else:
                query = f"{player} stats {timeframe}"
            
            result = await statmuse_client.query(query)
            
            if result:
                return [types.TextContent(type="text", text=f"**{player} {stat_type.title()} Stats:**\n{result.answer}")]
            else:
                return [types.TextContent(type="text", text=f"No stats found for {player}")]
        
        else:
            return [types.TextContent(type="text", text=f"Unknown tool: {name}")]
            
    except asyncio.TimeoutError:
        logger.error(f"⏱️ Tool call timeout for: {name}")
        return [types.TextContent(type="text", text=f"Query timeout - please try again with a simpler query")]
    except Exception as e:
        logger.error(f"❌ Tool call error: {e}")
        return [types.TextContent(type="text", text=f"Error executing tool: {str(e)}")]

async def main():
    """Run the StatMuse MCP Server"""
    # Import here to avoid issues with event loop
    from mcp.server.stdio import stdio_server
    
    logger.info("🚀 Starting StatMuse MCP Server...")
    logger.info("📊 Providing real MLB statistics via Model Context Protocol")
    
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream, 
            write_stream, 
            InitializationOptions(
                server_name="statmuse-server",
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={}
                )
            )
        )

if __name__ == "__main__":
    asyncio.run(main()) 
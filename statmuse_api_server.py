#!/usr/bin/env python3
"""
StatMuse API Server
Simple HTTP API that all AI systems can query for real StatMuse data
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import time
import re

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class StatMuseAPI:
    """Simple StatMuse API - same logic as working insights"""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        # Simple in-memory cache
        self.cache = {}
        self.cache_ttl = 3600  # 1 hour
    
    def clean_statmuse_text(self, text: str) -> str:
        """Clean up StatMuse text to fix spacing and grammar issues"""
        
        # Fix missing spaces between words
        # "TheNew York Yankees" -> "The New York Yankees"  
        text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
        
        # Fix team names followed by verbs (be more specific to avoid breaking "this")
        # "Yankeeshave" -> "Yankees have", but not "this" -> "th is"
        text = re.sub(r'([A-Za-z]{3,}s)(have|has|are|were)(?=\s|$)', r'\1 \2', text)
        
        # Fix names followed by verbs (be more specific)
        # "Judgeis" -> "Judge is", but avoid breaking existing words
        text = re.sub(r'([A-Z][a-z]{3,})(is|are|has|have|was|were)(?=\s|$)', r'\1 \2', text)
        
        # Fix specific common patterns
        text = re.sub(r'([A-Z][a-z]+)([A-Z][a-z]+)', r'\1 \2', text)  # "RedSox" -> "Red Sox"
        
        # Fix common word breaks (repair what we might have broken)
        text = re.sub(r'\bth is\b', 'this', text)
        text = re.sub(r'\bthere cord\b', 'record', text)
        text = re.sub(r'\bsea son\b', 'season', text)
        
        # Fix specific team name issues
        text = re.sub(r'Red Sox(have|has|are)', r'Red Sox \1', text)
        text = re.sub(r'Blue Jays(have|has|are)', r'Blue Jays \1', text)
        text = re.sub(r'White Sox(have|has|are)', r'White Sox \1', text)
        
        # Clean up multiple spaces
        text = re.sub(r'\s+', ' ', text)
        
        # Trim whitespace
        text = text.strip()
        
        return text
    
    def is_wnba_query(self, query: str) -> bool:
        """Check if query is likely about WNBA"""
        wnba_keywords = [
            "a'ja wilson", "aja wilson", "breanna stewart", "sabrina ionescu", 
            "alyssa thomas", "kelsey plum", "jewell loyd", "candace parker",
            "diana taurasi", "sue bird", "maya moore", "elena delle donne",
            "wnba", "las vegas aces", "new york liberty", "seattle storm",
            "phoenix mercury", "chicago sky", "connecticut sun", "minnesota lynx",
            "atlanta dream", "dallas wings", "indiana fever", "washington mystics",
            "kamilla cardoso", "paige bueckers", "caitlin clark", "angel reese"
        ]
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in wnba_keywords)
    
    def is_nfl_query(self, query: str) -> bool:
        """Check if query is likely about NFL"""
        nfl_keywords = [
            # NFL players
            "joe burrow", "josh allen", "patrick mahomes", "lamar jackson",
            "aaron rodgers", "tom brady", "dak prescott", "russell wilson",
            "justin herbert", "tua tagovailoa", "kyler murray", "jalen hurts",
            "derrick henry", "jonathan taylor", "nick chubb", "dalvin cook",
            "christian mccaffrey", "alvin kamara", "ezekiel elliott", "saquon barkley",
            "davante adams", "tyreek hill", "stefon diggs", "deandre hopkins",
            "calvin ridley", "mike evans", "chris godwin", "keenan allen",
            "travis kelce", "george kittle", "mark andrews", "darren waller",
            
            # NFL league and season terms
            "nfl", "national football league", "week 1", "week 2", "week 18",
            "playoff", "super bowl", "rushing yards", "passing yards", "touchdowns",
            "interceptions", "receptions", "receiving yards", "sacks", "fumbles",
            
            # NFL teams with full names to avoid conflicts
            "arizona cardinals", "atlanta falcons", "baltimore ravens", "buffalo bills",
            "carolina panthers", "chicago bears", "cincinnati bengals", "cleveland browns",
            "dallas cowboys", "denver broncos", "detroit lions", "green bay packers",
            "houston texans", "indianapolis colts", "jacksonville jaguars", "kansas city chiefs",
            "las vegas raiders", "los angeles chargers", "los angeles rams", "miami dolphins",
            "minnesota vikings", "new england patriots", "new orleans saints", "new york giants",
            "new york jets", "philadelphia eagles", "pittsburgh steelers", "san francisco 49ers",
            "seattle seahawks", "tampa bay buccaneers", "tennessee titans", "washington commanders",
            
            # Common NFL team nicknames that don't conflict with MLB
            "steelers", "patriots", "cowboys", "packers", "49ers", "chiefs", "bills", 
            "ravens", "bengals", "broncos", "colts", "titans", "texans", "jaguars", 
            "chargers", "raiders", "dolphins", "jets", "browns", "eagles", "lions",
            "vikings", "bears", "saints", "falcons", "panthers", "buccaneers", "seahawks"
        ]
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in nfl_keywords)
    
    def is_cfb_query(self, query: str) -> bool:
        """Check if query is likely about College Football (CFB)"""
        cfb_keywords = [
            # General identifiers
            'cfb', 'college football', 'ncaaf', 'ncaa football',
            # Common CFB stat terms
            'passing yards', 'rushing yards', 'receiving yards', 'passing tds', 'rushing tds', 'receiving tds',
            # Conferences
            'sec', 'big 12', 'big ten', 'acc', 'pac-12', 'pac 12', 'mountain west', 'aac', 'sun belt', 'conference usa', 'cusa',
            # Team identifiers (expanded)
            'texas a&m', 'aggies', 'kansas state', 'wildcats', 'arizona wildcats', 'ucla bruins', 'usc trojans',
            'georgia bulldogs', 'alabama crimson tide', 'ohio state buckeyes', 'michigan wolverines',
            'florida state seminoles', 'notre dame fighting irish', 'lsu tigers', 'tennessee volunteers',
            'clemson tigers', 'oklahoma sooners', 'oregon ducks', 'washington huskies', 'iowa hawkeyes',
            'penn state nittany lions', 'miami hurricanes', 'louisville cardinals', 'north carolina tar heels',
            'new mexico lobos', 'ucla', 'k-state', 'kansas st', 'houston cougars',
            # New teams from logs
            'kennesaw state owls', 'kennesaw state', 'louisiana tech bulldogs', 'louisiana tech',
            'tulane green wave', 'tulane', 'east carolina pirates', 'east carolina', 'ecu',
            # More common CFB teams
            'boise state broncos', 'san diego state aztecs', 'fresno state bulldogs', 'memphis tigers',
            'south florida bulls', 'usf', 'ucf knights', 'temple owls', 'smu mustangs',
            'navy midshipmen', 'army black knights', 'air force falcons'
        ]
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in cfb_keywords)
    
    def is_nhl_query(self, query: str) -> bool:
        """Check if query is likely about NHL"""
        nhl_keywords = [
            # NHL league terms
            'nhl', 'national hockey league', 'stanley cup', 'hockey',
            # NHL stats terms
            'goals', 'assists', 'points', 'plus minus', 'shots on goal', 'saves', 'save percentage',
            'goals against average', 'gaa', 'shutout', 'hat trick', 'power play',
            # NHL teams
            'anaheim ducks', 'arizona coyotes', 'boston bruins', 'buffalo sabres', 'calgary flames',
            'carolina hurricanes', 'chicago blackhawks', 'colorado avalanche', 'columbus blue jackets',
            'dallas stars', 'detroit red wings', 'edmonton oilers', 'florida panthers',
            'los angeles kings', 'minnesota wild', 'montreal canadiens', 'nashville predators',
            'new jersey devils', 'new york islanders', 'new york rangers', 'ottawa senators',
            'philadelphia flyers', 'pittsburgh penguins', 'san jose sharks', 'seattle kraken',
            'st louis blues', 'tampa bay lightning', 'toronto maple leafs', 'vancouver canucks',
            'vegas golden knights', 'washington capitals', 'winnipeg jets',
            # Common NHL player names
            'connor mcdavid', 'auston matthews', 'nathan mackinnon', 'leon draisaitl',
            'david pastrnak', 'nikita kucherov', 'cale makar', 'roman josi',
            'igor shesterkin', 'andrei vasilevskiy', 'sidney crosby', 'alex ovechkin'
        ]
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in nhl_keywords)
    
    def is_nba_query(self, query: str) -> bool:
        """Check if query is likely about NBA"""
        nba_keywords = [
            # NBA league terms
            'nba', 'national basketball association', 'playoffs', 'finals',
            # NBA stats terms
            'points', 'rebounds', 'assists', 'blocks', 'steals', 'three pointers', 'threes',
            'field goal percentage', 'free throw percentage', 'double double', 'triple double',
            # NBA teams
            'atlanta hawks', 'boston celtics', 'brooklyn nets', 'charlotte hornets', 'chicago bulls',
            'cleveland cavaliers', 'dallas mavericks', 'denver nuggets', 'detroit pistons',
            'golden state warriors', 'houston rockets', 'indiana pacers', 'la clippers',
            'los angeles lakers', 'memphis grizzlies', 'miami heat', 'milwaukee bucks',
            'minnesota timberwolves', 'new orleans pelicans', 'new york knicks', 'oklahoma city thunder',
            'orlando magic', 'philadelphia 76ers', 'phoenix suns', 'portland trail blazers',
            'sacramento kings', 'san antonio spurs', 'toronto raptors', 'utah jazz', 'washington wizards',
            # Common NBA player names
            'lebron james', 'stephen curry', 'kevin durant', 'giannis antetokounmpo',
            'luka doncic', 'nikola jokic', 'joel embiid', 'jayson tatum', 'damian lillard',
            'anthony davis', 'kawhi leonard', 'jimmy butler', 'devin booker', 'donovan mitchell'
        ]
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in nba_keywords)
    
    def scrape_main_sports_pages(self) -> dict:
        """Scrape main StatMuse sports pages to gather current context and insights"""
        logger.info("🔍 Scraping main StatMuse sports pages for current context...")
        
        context = {
            'mlb': {},
            'nhl': {},
            'nba': {},
            'nfl': {},
            'wnba': {},
            'cfb': {},
            'trending_players': [],
            'recent_performances': [],
            'league_leaders': {},
            'betting_trends': {}
        }
        
        # Define sports to scrape
        sports_to_scrape = [
            ('mlb', 'https://www.statmuse.com/mlb', 'MLB'),
            ('nhl', 'https://www.statmuse.com/nhl', 'NHL'),
            ('nba', 'https://www.statmuse.com/nba', 'NBA'),
            ('nfl', 'https://www.statmuse.com/nfl', 'NFL'),
            ('wnba', 'https://www.statmuse.com/wnba', 'WNBA'),
            ('cfb', 'https://www.statmuse.com/cfb', 'CFB')
        ]
        
        # Scrape each sport
        for sport_key, sport_url, sport_name in sports_to_scrape:
            try:
                response = requests.get(sport_url, headers=self.headers, timeout=15)
                if response.status_code == 200:
                    soup = BeautifulSoup(response.content, 'html.parser')
                    context[sport_key] = self._extract_sports_page_insights(soup, sport_name)
                    logger.info(f"✅ {sport_name} main page scraped successfully")
            except Exception as e:
                logger.warning(f"⚠️ {sport_name} main page scraping failed: {e}")
        
        return context
    
    def _extract_sports_page_insights(self, soup: BeautifulSoup, sport: str) -> dict:
        """Extract key insights from a StatMuse sports main page"""
        insights = {
            'trending_players': [],
            'recent_performances': [],
            'league_leaders': {},
            'betting_trends': {},
            'trending_searches': [],
            'standings': {},
            'player_stats': []
        }
        
        try:
            # Get all text content and parse it intelligently
            full_text = soup.get_text()
            lines = [line.strip() for line in full_text.split('\n') if line.strip()]
            
            # Clean up lines - remove extra whitespace and merge broken lines
            cleaned_lines = []
            i = 0
            while i < len(lines):
                line = lines[i]
                # If line ends with incomplete info, try to merge with next line
                if i + 1 < len(lines) and len(line) < 50 and not line.endswith(':') and not line.endswith('.'):
                    next_line = lines[i + 1]
                    if len(next_line) < 100:  # Avoid merging with very long lines
                        merged = f"{line} {next_line}"
                        cleaned_lines.append(merged)
                        i += 2
                        continue
                cleaned_lines.append(line)
                i += 1
            
            lines = cleaned_lines
            
            # Extract player performance data (e.g., "A'ja Wilson vs Golden State:")
            current_player = None
            current_stats = []
            
            for i, line in enumerate(lines):
                # Look for player vs team patterns
                if ' vs ' in line and ':' in line:
                    # Save previous player if exists
                    if current_player and current_stats:
                        insights['recent_performances'].append({
                            'player': current_player,
                            'matchup': current_player,
                            'stats': current_stats[:],
                            'text': f"{current_player}: {', '.join(current_stats)}"
                        })
                    
                    # Start new player
                    current_player = line
                    current_stats = []
                    
                    # Look ahead for stats (PTS, REB, AST, etc.)
                    for j in range(i+1, min(i+10, len(lines))):
                        next_line = lines[j]
                        if any(stat in next_line.upper() for stat in ['PTS', 'REB', 'AST', 'BLK', 'STL', 'FG', 'HR', 'RBI', 'HITS']):
                            current_stats.append(next_line)
                        elif next_line and not any(stat in next_line.upper() for stat in ['PTS', 'REB', 'AST', 'BLK', 'STL', 'FG', 'HR', 'RBI', 'HITS']) and len(next_line) > 20:
                            # Stop if we hit a description line
                            break
                
                # Look for season stats (e.g., "Brittney Sykes this season:")
                elif 'this season:' in line.lower():
                    if current_player and current_stats:
                        insights['recent_performances'].append({
                            'player': current_player,
                            'matchup': current_player,
                            'stats': current_stats[:],
                            'text': f"{current_player}: {', '.join(current_stats)}"
                        })
                    
                    current_player = line
                    current_stats = []
                    
                    # Look ahead for season stats
                    for j in range(i+1, min(i+8, len(lines))):
                        next_line = lines[j]
                        if any(stat in next_line.upper() for stat in ['PPG', 'RPG', 'APG', 'SPG', 'BPG', 'AVG', 'ERA']):
                            current_stats.append(next_line)
                        elif next_line and len(next_line) > 20:
                            break
            
            # Don't forget the last player
            if current_player and current_stats:
                insights['recent_performances'].append({
                    'player': current_player,
                    'matchup': current_player,
                    'stats': current_stats[:],
                    'text': f"{current_player}: {', '.join(current_stats)}"
                })
            
            # Extract League Leaders section
            league_leaders_start = -1
            for i, line in enumerate(lines):
                if 'League Leaders' in line:
                    league_leaders_start = i
                    break
            
            if league_leaders_start >= 0:
                # Look for stat categories and leaders
                for i in range(league_leaders_start, min(league_leaders_start + 30, len(lines))):
                    line = lines[i]
                    # Look for stat categories (PPG, RPG, APG, etc.)
                    if any(stat in line.upper() for stat in ['PPG', 'RPG', 'APG', '3PM', 'TS%', 'AVG', 'HR', 'RBI', 'ERA']):
                        stat_category = line
                        # Get the next few lines for leaders
                        leaders = []
                        for j in range(i+1, min(i+4, len(lines))):
                            if lines[j] and not any(stat in lines[j].upper() for stat in ['PPG', 'RPG', 'APG', '3PM', 'TS%', 'AVG', 'HR', 'RBI', 'ERA']):
                                # Try to extract number and player name
                                leader_line = lines[j]
                                if any(char.isdigit() for char in leader_line):
                                    leaders.append(leader_line)
                            else:
                                break
                        
                        if leaders:
                            insights['league_leaders'][stat_category] = leaders
            
            # Extract Trending Players section
            trending_players_start = -1
            for i, line in enumerate(lines):
                if 'Trending' in line and ('Players' in line or 'WNBA Players' in line or 'MLB Players' in line):
                    trending_players_start = i
                    break
            
            if trending_players_start >= 0:
                for i in range(trending_players_start, min(trending_players_start + 20, len(lines))):
                    line = lines[i]
                    # Look for numbered lists (1, 2, 3, etc.) followed by player names
                    if line.isdigit() and int(line) <= 10 and i+1 < len(lines):
                        player_name = lines[i+1]
                        # Clean up player name and validate
                        if len(player_name) > 2 and len(player_name) < 50:
                            # Remove common non-player text
                            if not any(word in player_name.lower() for word in ['trending', 'players', 'teams', 'searches', 'home', 'money']):
                                if player_name not in insights['trending_players']:
                                    insights['trending_players'].append(player_name)
            
            # Extract Trending Searches section
            trending_searches_start = -1
            for i, line in enumerate(lines):
                if 'Trending' in line and 'Searches' in line:
                    trending_searches_start = i
                    break
            
            if trending_searches_start >= 0:
                for i in range(trending_searches_start, min(trending_searches_start + 15, len(lines))):
                    line = lines[i]
                    if line.isdigit() and i+1 < len(lines):
                        search_query = lines[i+1]
                        if len(search_query) > 5 and search_query not in insights['trending_searches']:
                            insights['trending_searches'].append(search_query)
            
            logger.info(f"📊 Extracted {len(insights['trending_players'])} trending players, {len(insights['recent_performances'])} performances, {len(insights['league_leaders'])} leader categories for {sport}")
            
        except Exception as e:
            logger.warning(f"⚠️ Error extracting insights from {sport} page: {e}")
        
        return insights
    
    def query_statmuse(self, query: str, sport: str = None) -> dict:
        """Query StatMuse with explicit sport parameter (NO keyword detection)"""
        cache_key = f"{sport}:{query.lower()}" if sport else query.lower()
        current_time = time.time()
        
        # Check cache
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if current_time - timestamp < self.cache_ttl:
                logger.info(f"💾 Cache hit for: {query} ({sport})")
                cached_data['cached'] = True
                return cached_data
        
        # Execute the query using standard approach with explicit sport
        result = self._try_standard_query(query, current_time, cache_key, sport=sport)
        return result
    
    def _try_standard_query(self, query: str, current_time: float, cache_key: str, sport: str = None) -> dict:
        """Try the standard StatMuse query approach with explicit sport (NO DETECTION)"""
        try:
            logger.info(f"🔍 StatMuse Query: {query} [Sport: {sport}]")
            
            # Format query for URL to match working StatMuse format
            # Examples: "LJ Martin rushing yards last 5 games" -> "lj-martin-rushing-yards-last-5-games"
            formatted_query = query.lower()
            # Remove apostrophes and special characters
            formatted_query = formatted_query.replace("'", "").replace("'", "")
            # Replace spaces with hyphens and clean up
            formatted_query = formatted_query.replace(' ', '-').replace(',', '').replace('?', '').replace('!', '')
            # Remove multiple consecutive hyphens
            formatted_query = re.sub(r'-+', '-', formatted_query)
            # Remove leading/trailing hyphens
            formatted_query = formatted_query.strip('-')
            
            # Map sport to StatMuse URL - NO DETECTION, USE EXPLICIT PARAMETER
            sport_url_map = {
                'CFB': 'https://www.statmuse.com/cfb/ask',
                'NCAAF': 'https://www.statmuse.com/cfb/ask',
                'NFL': 'https://www.statmuse.com/nfl/ask',
                'MLB': 'https://www.statmuse.com/mlb/ask',
                'NBA': 'https://www.statmuse.com/nba/ask',
                'NHL': 'https://www.statmuse.com/nhl/ask',
                'WNBA': 'https://www.statmuse.com/wnba/ask'
            }
            
            # Get the correct URL for this sport
            if sport and sport.upper() in sport_url_map:
                base_url = sport_url_map[sport.upper()]
                candidate_bases = [base_url]  # ONLY try the correct sport URL
            else:
                # Fallback to all sports if no sport specified (backward compatibility)
                logger.warning(f"⚠️ No sport specified, falling back to all URLs")
                candidate_bases = list(sport_url_map.values())
            
            # Try candidates in order until one returns 200
            response = None
            chosen_url = None
            for base in candidate_bases:
                url = f"{base}/{formatted_query}"
                logger.info(f"🎯 Trying endpoint: {url}")
                try:
                    resp = requests.get(url, headers=self.headers, timeout=15)
                    if resp.status_code == 200:
                        response = resp
                        chosen_url = url
                        logger.info(f"✅ Endpoint succeeded: {url}")
                        break
                    else:
                        logger.warning(f"⚠️ Endpoint returned {resp.status_code}: {url}")
                except Exception as req_e:
                    logger.warning(f"⚠️ Request error on {url}: {req_e}")
            
            if response is None:
                # All candidates failed
                logger.warning(f"StatMuse query failed for all endpoints: {candidate_bases}")
                return {
                    'success': False,
                    'error': 'All endpoints failed',
                    'query': query
                }
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Look for main answer (same as working insights)
                main_answer = soup.find('h1') or soup.find('h2')
                if main_answer:
                    answer_text = main_answer.get_text(strip=True)
                    
                    # Fix common spacing issues from StatMuse HTML
                    answer_text = self.clean_statmuse_text(answer_text)
                    
                    logger.info(f"✅ StatMuse Result: {answer_text}")
                    
                    result = {
                        'success': True,
                        'query': query,
                        'answer': answer_text,
                        'url': chosen_url or url,
                        'cached': False,
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    # Cache the result
                    self.cache[cache_key] = (result.copy(), current_time)
                    
                    return result
                else:
                    logger.warning(f"No answer found for: {query}")
                    return {
                        'success': False,
                        'error': 'No answer found',
                        'query': query
                    }
            else:
                logger.warning(f"StatMuse query failed: {response.status_code}")
                return {
                    'success': False,
                    'error': f'HTTP {response.status_code}',
                    'query': query
                }
                
        except Exception as e:
            logger.error(f"Error querying StatMuse: {e}")
            return {
                'success': False,
                'error': str(e),
                'query': query
            }

# Initialize the StatMuse API
statmuse_api = StatMuseAPI()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'StatMuse API Server',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/query', methods=['POST'])
def query_statmuse():
    """Main StatMuse query endpoint - REQUIRES sport parameter"""
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing query parameter'
            }), 400
        
        if 'sport' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing sport parameter. Must specify: MLB, NHL, NBA, NFL, CFB, or WNBA'
            }), 400
        
        query = data['query']
        sport = data['sport'].upper()
        
        # Validate sport
        valid_sports = ['MLB', 'NHL', 'NBA', 'NFL', 'CFB', 'NCAAF', 'WNBA']
        if sport not in valid_sports:
            return jsonify({
                'success': False,
                'error': f'Invalid sport: {sport}. Must be one of: {", ".join(valid_sports)}'
            }), 400
        
        result = statmuse_api.query_statmuse(query, sport=sport)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"API error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/scrape-context', methods=['GET'])
def scrape_sports_context():
    """Scrape main StatMuse sports pages for current context and insights"""
    try:
        context = statmuse_api.scrape_main_sports_pages()
        
        return jsonify({
            'success': True,
            'context': context,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Context scraping error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/head-to-head', methods=['POST'])
def head_to_head():
    """Head-to-head matchup endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'team1' not in data or 'team2' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing team1 and team2 parameters'
            }), 400
        
        team1 = data['team1']
        team2 = data['team2']
        games = data.get('games', 5)
        
        query = f"{team1} vs {team2} last {games} meetings"
        result = statmuse_api.query_statmuse(query)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Head-to-head API error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/team-record', methods=['POST'])
def team_record():
    """Team record endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'team' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing team parameter'
            }), 400
        
        team = data['team']
        record_type = data.get('record_type', 'overall')
        season = data.get('season', '2025')
        
        if record_type == 'home':
            query = f"{team} home record {season}"
        elif record_type == 'away':
            query = f"{team} road record {season}"
        else:
            query = f"{team} record {season}"
        
        result = statmuse_api.query_statmuse(query)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Team record API error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/player-stats', methods=['POST'])
def player_stats():
    """Player stats endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'player' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing player parameter'
            }), 400
        
        player = data['player']
        stat_type = data.get('stat_type', 'season')
        timeframe = data.get('timeframe', '2025')
        
        query = f"{player} {stat_type} stats {timeframe}"
        result = statmuse_api.query_statmuse(query)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Player stats API error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/cache-stats', methods=['GET'])
def cache_stats():
    """Get cache statistics"""
    return jsonify({
        'cached_queries': len(statmuse_api.cache),
        'cache_ttl_hours': statmuse_api.cache_ttl / 3600,
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    logger.info("🚀 Starting StatMuse API Server...")
    logger.info("📊 Centralized StatMuse service for all AI systems")
    logger.info("🌐 Available endpoints:")
    logger.info("  POST /query - General StatMuse queries")
    logger.info("  POST /head-to-head - Team matchup data")
    logger.info("  POST /team-record - Team record queries")
    logger.info("  POST /player-stats - Player statistics")
    logger.info("  GET /health - Health check")
    logger.info("  GET /cache-stats - Cache statistics")
    
    app.run(host='0.0.0.0', port=5001, debug=False) 
#!/usr/bin/env python3
"""
Intelligent Trends Generator
Uses AI to determine which players/teams to analyze based on upcoming games and available props,
then scrapes Baseball Reference and uses StatMuse strategically to generate targeted trends.

Workflow:
1. Analyze upcoming games and available props
2. AI selects most valuable players/teams to research  
3. Scrape Baseball Reference for selected players
4. Run targeted StatMuse queries
5. AI synthesizes data into 9 player prop + 6 team trends
"""

import os
import sys
import requests
import json
import asyncio
import httpx
import re
from datetime import datetime, timedelta, date
from supabase import create_client, Client
import logging
from dotenv import load_dotenv
from openai import AsyncOpenAI
from bs4 import BeautifulSoup
from urllib.parse import urljoin, quote
import time
from typing import Dict, List, Optional, Tuple, Any

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class IntelligentTrendsGenerator:
    def __init__(self):
        # Initialize Supabase
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY')
        self.supabase = create_client(self.supabase_url, self.supabase_key)
        
        # Initialize OpenAI (Grok)
        self.grok_client = AsyncOpenAI(
            api_key=os.getenv('XAI_API_KEY'),
            base_url="https://api.x.ai/v1"
        )
        
        # Initialize Apify client
        self.apify_api_token = os.getenv('APIFY_API_TOKEN')
        if not self.apify_api_token:
            logger.warning("APIFY_API_TOKEN not found in environment variables")
        
        logger.info(f"Connecting to Supabase at: {self.supabase_url[:50]}...")
        
        # Load player mappings
        self.player_mappings = self.load_player_mappings()
        
        # Simple PlayerProp class for compatibility
        class PlayerProp:
            def __init__(self, player_name, prop_type, line, over_odds, under_odds, event_id, team, bookmaker):
                self.player_name = player_name
                self.prop_type = prop_type
                self.line = line
                self.over_odds = over_odds
                self.under_odds = under_odds
                self.event_id = event_id
                self.team = team
                self.bookmaker = bookmaker
        
        self.PlayerProp = PlayerProp
        
    def load_player_mappings(self) -> Dict[str, Dict]:
        """Load player mappings from database for name resolution"""
        try:
            response = self.supabase.table('players')\
                .select('id, name, player_name, team')\
                .eq('sport', 'MLB')\
                .execute()
            
            mappings = {}
            for player in response.data:
                # Create multiple mapping keys for flexible matching
                names_to_try = []
                if player.get('name'):
                    names_to_try.append(player['name'])
                if player.get('player_name'):
                    names_to_try.append(player['player_name'])
                
                for name in names_to_try:
                    if name:
                        # Full name
                        mappings[name.lower()] = player
                        # Create abbreviated version (F. Freeman from Freddie Freeman)
                        parts = name.split()
                        if len(parts) >= 2:
                            abbreviated = f"{parts[0][0]}. {parts[-1]}"
                            mappings[abbreviated.lower()] = player
            
            logger.info(f"Loaded {len(mappings)} player name mappings")
            return mappings
        except Exception as e:
            logger.error(f"Error loading player mappings: {e}")
            return {}

    async def analyze_upcoming_games_and_props(self) -> Dict:
        """Step 1: Analyze upcoming games and available props using working patterns from props_enhanced.py"""
        try:
            # Use working database patterns from props_enhanced.py
            target_date = datetime.now().date()
            
            # Get games using the working method from props_enhanced.py
            games_data = self.get_games_for_date(target_date)
            
            # Get recent AI predictions for context 
            predictions_response = self.supabase.table('ai_predictions')\
                .select('*')\
                .eq('sport', 'MLB')\
                .gte('created_at', (datetime.now() - timedelta(days=7)).isoformat())\
                .limit(50)\
                .execute()
            
            # Get props using working method
            props_data = []
            if games_data:
                game_ids = [game["id"] for game in games_data]
                props_raw = self.get_player_props_for_games(game_ids)
                # Convert PlayerProp objects to dictionaries for JSON serialization
                props_data = []
                for prop in props_raw:
                    props_data.append({
                        'player_name': prop.player_name,
                        'prop_type': prop.prop_type,
                        'line': prop.line,
                        'over_odds': prop.over_odds,
                        'under_odds': prop.under_odds,
                        'event_id': prop.event_id,
                        'team': prop.team,
                        'bookmaker': prop.bookmaker
                    })
            
            analysis_data = {
                'upcoming_games': games_data,
                'recent_predictions': predictions_response.data,
                'available_props': props_data,
                'analysis_timestamp': datetime.now().isoformat()
            }
            
            logger.info(f"Found {len(games_data)} upcoming games, {len(predictions_response.data)} recent predictions, {len(props_data)} prop bets")
            
            # If no upcoming games (offseason), add some context
            if len(games_data) == 0:
                analysis_data['offseason_mode'] = True
                logger.info("No upcoming games found - running in offseason mode")
            
            return analysis_data
            
        except Exception as e:
            logger.error(f"Error analyzing games and props: {e}")
            return {'upcoming_games': [], 'recent_predictions': [], 'available_props': []}

    def get_games_for_date(self, target_date: datetime.date) -> List[Dict[str, Any]]:
        """Get games for date using working patterns from props_enhanced.py"""
        try:
            # Use the exact same approach as props_enhanced.py
            now = datetime.now()
            current_date = now.date()
            
            if target_date == current_date:
                # Today - start from now
                start_time = now
                # End of day in EST, converted to UTC (EST games can run until ~3 AM UTC next day)
                end_time_local = datetime.combine(current_date, datetime.min.time().replace(hour=23, minute=59, second=59))
                end_time = end_time_local + timedelta(hours=8)  # EST to UTC conversion (worst case)
            else:
                # Tomorrow or specified date - use full day with timezone padding
                # Start of day in EST converted to UTC (EST midnight = 5 AM UTC typically)
                start_time_local = datetime.combine(target_date, datetime.min.time())
                start_time = start_time_local - timedelta(hours=8)  # Pad for timezone differences
                
                # End of day in EST converted to UTC (EST 11:59 PM can be up to 8 AM UTC next day)
                end_time_local = datetime.combine(target_date, datetime.min.time().replace(hour=23, minute=59, second=59))
                end_time = end_time_local + timedelta(hours=8)  # Pad for timezone differences
            
            start_iso = start_time.isoformat()
            end_iso = end_time.isoformat()
            
            logger.info(f"Fetching games from UTC range ({start_iso}) to ({end_iso}) and filtering for local date {target_date}")
            
            # Fetch games from MLB only - as per requirements (focus on MLB)
            all_games = []
            sports = ["Major League Baseball"]  # Use correct full sport name
            
            for sport in sports:
                response = self.supabase.table("sports_events").select(
                    "id, home_team, away_team, start_time, sport, metadata"
                ).gte("start_time", start_iso).lte("start_time", end_iso).eq("sport", sport).order("start_time").execute()
                
                if response.data:
                    # Filter games to only include those that happen on the target local date
                    filtered_games = []
                    for game in response.data:
                        # Parse the UTC timestamp and convert to EST to check local date
                        game_utc = datetime.fromisoformat(game['start_time'].replace('Z', '+00:00'))
                        # Convert to EST (UTC-5, but we'll use a simple approximation)
                        game_est = game_utc - timedelta(hours=5)  # EST offset
                        game_local_date = game_est.date()
                        
                        # Only include if it falls on our target date in local time
                        if game_local_date == target_date:
                            filtered_games.append(game)
                    
                    logger.info(f"Found {len(filtered_games)} {sport} games for local date {target_date}")
                    all_games.extend(filtered_games)
            
            # Sort all games by start time
            all_games.sort(key=lambda x: x['start_time'])
            logger.info(f"Total games found for time window: {len(all_games)}")
            return all_games
        except Exception as e:
            logger.error(f"Failed to fetch games for {target_date}: {e}")
            return []

    def _safe_int_convert(self, value) -> Optional[int]:
        """Safely convert a value to int, handling strings and None"""
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            logger.warning(f"Could not convert odds value to int: {value}")
            return None
    
    def get_player_props_for_games(self, game_ids: List[str]) -> List:
        """Get player props using working patterns from props_enhanced.py"""
        if not game_ids:
            return []
        
        try:
            response = self.supabase.table("player_props_odds").select(
                "line, over_odds, under_odds, event_id, "
                "players(name, team), "
                "player_prop_types(prop_name)"
            ).in_("event_id", game_ids).execute()
            
            props = []
            for row in response.data:
                if (row.get("players") and 
                    row.get("player_prop_types") and 
                    row["players"].get("name") and 
                    row["player_prop_types"].get("prop_name")):
                    
                    props.append(self.PlayerProp(
                        player_name=row["players"]["name"],
                        prop_type=row["player_prop_types"]["prop_name"],
                        line=float(row["line"]),
                        over_odds=self._safe_int_convert(row["over_odds"]),
                        under_odds=self._safe_int_convert(row["under_odds"]),
                        event_id=row["event_id"],
                        team=row["players"]["team"] if row["players"]["team"] else "Unknown",
                        bookmaker="fanduel"
                    ))
            
            logger.info(f"Found {len(props)} player props from {len(game_ids)} games")
            return props
        except Exception as e:
            logger.error(f"Failed to fetch player props: {e}")
            return []

    async def ai_select_focus_players_and_queries(self, analysis_data: Dict) -> Dict:
        """Step 2: Use AI to intelligently select which players to scrape and StatMuse queries to run"""
        
        offseason_mode = analysis_data.get('offseason_mode', False)
        
        if offseason_mode:
            prompt = f"""
You are an expert sports betting analyst. Since we're in the MLB offseason with no upcoming games, select the most popular and valuable MLB star players to analyze for historical prop betting trends that will be useful when the season resumes.

RECENT PREDICTIONS: {json.dumps(analysis_data['recent_predictions'][:5], indent=2)}

Focus on:
1. TOP 10 STAR PLAYERS to scrape from Baseball Reference (focus on popular betting targets, consistent performers, major market players)
2. TOP 8 STATMUSE QUERIES for general team and league trends

Select players like:
- Top sluggers (Judge, Ohtani, Freeman, etc.)
- Popular prop betting targets
- Consistent performers across seasons
- Players from major market teams

For each selected player, provide:
- Full name (e.g., "Aaron Judge") 
- Team abbreviation (e.g., "NYY")
- Why they're valuable (star power, popular props, consistent performance)
- Key props to focus on (RBIs, Hits, Total Bases, Home Runs, etc.)

For StatMuse queries, focus on:
- Historical team performance patterns
- Player consistency trends
- League-wide statistical trends
- Seasonal performance patterns

Return JSON format:
{{
  "selected_players": [
    {{
      "name": "Aaron Judge",
      "team": "NYY", 
      "reason": "Star slugger, popular HR and RBI props, consistent performer",
      "focus_props": ["Home Runs", "RBIs", "Total Bases", "Hits"]
    }}
  ],
  "statmuse_queries": [
    {{
      "query": "Which MLB teams have the most consistent offensive production across seasons?",
      "purpose": "Historical team trend analysis"  
    }}
  ]
}}
"""
        else:
            prompt = f"""
You are an expert sports betting analyst. Based on the upcoming MLB games and available data, select the most valuable players to analyze for prop betting trends.

UPCOMING GAMES: {json.dumps(analysis_data['upcoming_games'][:10], indent=2)}
RECENT PREDICTIONS: {json.dumps(analysis_data['recent_predictions'][:10], indent=2)}  
AVAILABLE PROPS: {json.dumps(analysis_data['available_props'][:10], indent=2)}

Your task is to identify:
1. TOP 15 PLAYERS to scrape from Baseball Reference (focus on upcoming games, popular props, star players)
2. TOP 10 STATMUSE QUERIES for team trends and additional context

For each selected player, provide:
- Full name (e.g., "Freddie Freeman") 
- Team
- Why they're valuable to analyze (upcoming games, prop availability, recent performance)
- Key props to focus on (RBIs, Hits, Total Bases, etc.)

For StatMuse queries, focus on:
- Team performance trends
- Pitching matchup insights  
- Recent team form
- Weather/venue impacts

Return JSON format:
{{
  "selected_players": [
    {{
      "name": "Freddie Freeman",
      "team": "LAD", 
      "reason": "Playing tomorrow, popular RBI props, strong recent form",
      "focus_props": ["RBIs", "Hits", "Total Bases"]
    }}
  ],
  "statmuse_queries": [
    {{
      "query": "How have teams performed in their last 10 games at home vs road?",
      "purpose": "Team trend analysis"  
    }}
  ]
}}
"""

        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-2-1212",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            
            content = response.choices[0].message.content.strip()
            
            # Try to extract JSON from the response
            if content.startswith('```json'):
                content = content[7:-3].strip()
            elif content.startswith('```'):
                content = content[3:-3].strip()
            
            result = json.loads(content)
            logger.info(f"AI selected {len(result.get('selected_players', []))} players and {len(result.get('statmuse_queries', []))} StatMuse queries")
            return result
            
        except Exception as e:
            logger.error(f"Error in AI selection: {e}")
            # Enhanced fallback selection with popular star players
            fallback_players = [
                {"name": "Aaron Judge", "team": "NYY", "reason": "Star slugger, popular props", "focus_props": ["Home Runs", "RBIs", "Total Bases"]},
                {"name": "Freddie Freeman", "team": "LAD", "reason": "Consistent performer", "focus_props": ["RBIs", "Hits", "Total Bases"]},
                {"name": "Mookie Betts", "team": "LAD", "reason": "Star player, versatile props", "focus_props": ["Hits", "Runs", "Total Bases"]},
                {"name": "Ronald Acuna Jr.", "team": "ATL", "reason": "Dynamic player", "focus_props": ["Hits", "Runs", "Stolen Bases"]},
                {"name": "Jose Altuve", "team": "HOU", "reason": "Consistent hitter", "focus_props": ["Hits", "Runs"]},
                {"name": "Juan Soto", "team": "NYY", "reason": "Elite hitter", "focus_props": ["Hits", "RBIs", "Home Runs"]},
                {"name": "Shohei Ohtani", "team": "LAD", "reason": "Unique two-way star", "focus_props": ["Home Runs", "RBIs", "Total Bases"]},
                {"name": "Vladimir Guerrero Jr.", "team": "TOR", "reason": "Power hitter", "focus_props": ["Home Runs", "RBIs", "Total Bases"]},
            ]
            
            fallback_queries = [
                {"query": "Which MLB teams have the most consistent offensive production?", "purpose": "Team offensive trends"},
                {"query": "How do MLB teams perform in high-pressure situations?", "purpose": "Clutch performance analysis"},
                {"query": "What are the most reliable betting trends in MLB?", "purpose": "Historical betting patterns"},
                {"query": "Which players are most consistent in their statistical categories?", "purpose": "Player consistency analysis"},
            ]
            
            return {
                "selected_players": fallback_players,
                "statmuse_queries": fallback_queries
            }

    def get_baseball_reference_id(self, player_name: str) -> str:
        """Generate Baseball Reference player ID using the correct format with known mappings"""
        try:
            # Known player ID mappings for common players
            known_ids = {
                "pete alonso": "alonspe01",
                "aaron judge": "judgeaa01", 
                "shohei ohtani": "ohtansh01",
                "mookie betts": "bettsmo01",
                "freddie freeman": "freemfr01",
                "ronald acuna jr.": "acunaro01",
                "ronald acuña jr.": "acunaro01",  # Handle accent
                "juan soto": "sotoju01",
                "jose altuve": "altuvjo01",
                "vladimir guerrero jr.": "guerrvl02",
                "trea turner": "turnetr01",
                "bryce harper": "harpebr03",
                "manny machado": "machama01",
                "francisco lindor": "lindofr01",
                "fernando tatis jr.": "tatisfe02",
                "kyle tucker": "tuckeke01",
                "yordan alvarez": "alvaryo01",
                "jose ramirez": "ramirjo01",
                "bo bichette": "bichebo01",
                "george springer": "springg01",
                "marcus semien": "semiema01",
                "corey seager": "seageco01",
                "max muncy": "muncyma01",
                "christian walker": "walkech01",
                "gleyber torres": "torregl01",
                "yordan alvarez": "alvaryo01",
                "kyle schwarber": "schwaky01",
                "nick castellanos": "casteni02",
                "j.t. realmuto": "realmj.01",
                "alec bohm": "bohmal01",
                "brandon marsh": "marshbr01",
                "trea turner": "turnetr01"
            }
            
            # Normalize the name for matching
            normalized_name = player_name.lower().strip()
            # Remove periods and handle common abbreviations
            normalized_name = normalized_name.replace(".", "")
            
            # Debug logging
            logger.info(f"Looking up Baseball Reference ID for: '{player_name}' (normalized: '{normalized_name}')")
            
            # Check for known mapping first
            if normalized_name in known_ids:
                logger.info(f"Found known ID for {player_name}: {known_ids[normalized_name]}")
                return known_ids[normalized_name]
            
            # Fallback to standard generation logic
            parts = normalized_name.split()
            if len(parts) < 2:
                logger.warning(f"Cannot generate ID for single name: {player_name}")
                return None
                
            last_name = parts[-1]
            first_name = parts[0]
            
            # Handle common name variations
            if "jr" in normalized_name:
                # Remove Jr from parts to get clean last name
                parts = [p for p in parts if p not in ["jr", "jr."]]
                if len(parts) >= 2:
                    last_name = parts[-1]
                    first_name = parts[0]
            
            # Standard format: first 5 chars of last_name + first 2 chars of first_name + 01
            last_name_part = last_name[:5] if len(last_name) > 5 else last_name
            first_name_part = first_name[:2]
            
            player_id = f"{last_name_part}{first_name_part}01"
            
            logger.info(f"Generated ID for {player_name}: {player_id}")
            return player_id
            
        except Exception as e:
            logger.error(f"Error generating Baseball Reference ID for {player_name}: {e}")
            return None

    async def scrape_baseball_reference_player(self, player_info: Dict) -> Dict:
        """Scrape Baseball Reference using Apify API with fallback strategies"""
        player_name = player_info['name']
        player_id = self.get_baseball_reference_id(player_name)
        
        if not player_id:
            logger.warning(f"Could not generate Baseball Reference ID for {player_name}")
            return {'success': False, 'player': player_name, 'error': 'Invalid player ID'}
            
        if not self.apify_api_token:
            logger.error("No Apify API token available")
            return {'success': False, 'player': player_name, 'error': 'No Apify token'}
            
        # Try multiple URL variations for better success rate
        urls_to_try = [
            f"https://www.baseball-reference.com/players/{player_id[0]}/{player_id}.shtml",
        ]
        
        # Add alternative URL formats for common issues
        parts = player_name.lower().split()
        if len(parts) >= 2:
            # Try alternative numbering (02, 03) for common names
            base_id = player_id[:-2]  # Remove the "01"
            urls_to_try.extend([
                f"https://www.baseball-reference.com/players/{player_id[0]}/{base_id}02.shtml",
                f"https://www.baseball-reference.com/players/{player_id[0]}/{base_id}03.shtml",
            ])
        
        last_error = None
        for attempt, url in enumerate(urls_to_try):
            try:
                logger.info(f"Scraping {player_name} via Apify (attempt {attempt+1}/{len(urls_to_try)}): {url}")
                result = await self._try_apify_scrape(url, player_name, player_info)
                
                if result.get('success'):
                    return result
                else:
                    last_error = result.get('error', 'Unknown error')
                    # If we get a 404-like error, try next URL
                    if '404' in str(last_error).lower() or 'not found' in str(last_error).lower():
                        continue
                    else:
                        # For other errors (network, parsing, etc.), return immediately
                        return result
                        
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Attempt {attempt+1} failed for {player_name}: {e}")
                continue
        
        # If all attempts failed
        logger.error(f"All scraping attempts failed for {player_name}. Last error: {last_error}")
        return {'success': False, 'player': player_name, 'error': f'All URLs failed: {last_error}'}

    async def _try_apify_scrape(self, url: str, player_name: str, player_info: Dict) -> Dict:
        """Try scraping a single URL via Apify"""
        try:
            # Apify API call
            apify_url = "https://api.apify.com/v2/acts/apify~website-content-crawler/runs"
            
            payload = {
                "startUrls": [{"url": url}],
                "maxRequestsPerCrawl": 1,
                "maxRequestRetries": 3
            }
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.apify_api_token}"
            }
            
            # Start the crawl
            async with httpx.AsyncClient() as client:
                response = await client.post(apify_url, json=payload, headers=headers, timeout=60)
                response.raise_for_status()
                
                run_data = response.json()
                run_id = run_data["data"]["id"]
                
                logger.info(f"Started Apify crawl {run_id} for {player_name}")
                
                # Poll for completion
                status_url = f"https://api.apify.com/v2/acts/apify~website-content-crawler/runs/{run_id}"
                
                for attempt in range(30):  # Wait up to 5 minutes
                    await asyncio.sleep(10)
                    
                    status_response = await client.get(status_url, headers=headers)
                    status_data = status_response.json()
                    status = status_data["data"]["status"]
                    
                    if status == "SUCCEEDED":
                        break
                    elif status in ["FAILED", "ABORTED", "TIMED-OUT"]:
                        logger.error(f"Apify crawl failed for {player_name}: {status}")
                        return {'success': False, 'player': player_name, 'error': f'Apify crawl {status}'}
                        
                    logger.info(f"Waiting for {player_name} crawl to complete... ({status}) - attempt {attempt+1}/30")
                
                if status != "SUCCEEDED":
                    logger.error(f"Apify crawl timed out for {player_name}")
                    return {'success': False, 'player': player_name, 'error': 'Apify crawl timeout'}
                
                # Get the results
                dataset_id = run_data['data']['defaultDatasetId']
                results_url = f"https://api.apify.com/v2/datasets/{dataset_id}/items"
                results_response = await client.get(results_url, headers=headers)
                results_data = results_response.json()
                
                if not results_data:
                    logger.warning(f"No results from Apify for {player_name}")
                    return {'success': False, 'player': player_name, 'error': 'No Apify results'}
                
                # Parse the scraped content
                scraped_text = results_data[0].get("text", "")
                
                # Check for 404 or other error pages
                if ("page not found" in scraped_text.lower() or "404 error" in scraped_text.lower() or
                    "we apologize, but we could not find the page" in scraped_text.lower()):
                    logger.warning(f"404 error detected for {player_name} at {url}")
                    return {'success': False, 'player': player_name, 'error': '404 page not found'}
                
                # Check if we got a player info page instead of game logs
                if (any(phrase in scraped_text for phrase in ["How old is", "was born", "Stats, Height, Weight"]) and
                    "Last 5 Games" not in scraped_text):
                    logger.warning(f"Got player info page instead of game logs for {player_name} at {url}")
                    return {'success': False, 'player': player_name, 'error': 'player info page instead of game logs'}
                
                games = self.parse_baseball_reference_text(scraped_text, player_name)
                
                if not games:
                    logger.error(f"No games parsed for {player_name} - PARSING FAILED")
                    return {'success': False, 'player': player_name, 'error': 'No games parsed'}
                    
                # Calculate prop performance statistics
                prop_stats = self.calculate_prop_performance(games, player_info.get('focus_props', []))
                
                # Extract player_id from URL for result
                player_id = url.split('/')[-1].replace('.shtml', '')
                
                result = {
                    'success': True,
                    'player': player_name,
                    'team': player_info.get('team', ''),
                    'player_id': player_id,
                    'games_scraped': len(games),
                    'recent_games': games[:10],  # Store recent 10 games
                    'prop_performance': prop_stats,
                    'scrape_timestamp': datetime.now().isoformat(),
                    'source': 'apify',
                    'url_used': url
                }
                
                logger.info(f"✅ Successfully scraped {len(games)} games for {player_name} via Apify")
                return result
                
        except Exception as e:
            logger.error(f"Error scraping {player_name} with Apify: {e}")
            return {'success': False, 'player': player_name, 'error': str(e)}

    def parse_baseball_reference_text(self, scraped_text: str, player_name: str) -> List[Dict]:
        """Parse Baseball Reference scraped text to extract game data"""
        games = []
        
        try:
            # Debug: Save the scraped text to see what we're working with
            logger.info(f"Raw scraped text sample for {player_name}: {scraped_text[:500]}...")
            
            # Save full text to file for debugging
            with open(f"debug_{player_name.replace(' ', '_')}_scraped.txt", "w") as f:
                f.write(scraped_text)
            logger.info(f"Saved full scraped text to debug_{player_name.replace(' ', '_')}_scraped.txt")
            
            # Check if this looks like a player stats page (has game logs)
            if ("Last 5 Games" in scraped_text or "Date Tm Opp Result" in scraped_text or 
                "Last 5 Games Table" in scraped_text):
                
                logger.info(f"Found game log section for {player_name}")
                
                # Split into lines for easier parsing
                lines = scraped_text.split('\n')
                
                # Look for game data lines with the pattern: Date Tm Opp Result Pos AB R H 2B 3B HR RBI ...
                # Example: "2025-08-03PHI DET W, 2-0 SS 4 0 0 0 0 0 0 0 2 0 0 0 0 0 0 0 1"
                for line in lines:
                    # Skip header lines
                    if any(header in line for header in ["Date Tm Opp", "Last 5 Games", "POWERED BY", "Share & Export"]):
                        continue
                    
                    # Look for lines that start with a date pattern and have stats
                    if re.match(r'2025-\d{2}-\d{2}', line.strip()):
                        logger.debug(f"Processing game line: {line[:100]}...")
                        
                        # Split the line by tabs or multiple spaces
                        parts = re.split(r'\s{2,}|\t', line.strip())
                        
                        # Alternative: Extract all numbers from the line
                        numbers = re.findall(r'\b\d+\b', line)
                        
                        if len(numbers) >= 7:  # Need at least AB, R, H, 2B, 3B, HR, RBI
                            try:
                                # The first few numbers after the date are usually: AB, R, H, 2B, 3B, HR, RBI
                                # Look for the position where AB should be (usually 3-6)
                                stat_indices = []
                                for i, num_str in enumerate(numbers):
                                    num = int(num_str)
                                    # AB is usually 3-6, look for reasonable AB values
                                    if 1 <= num <= 6 and i >= 3:  # Skip date components
                                        stat_indices.append(i)
                                
                                # Try the most likely starting position
                                for start_idx in stat_indices:
                                    if start_idx + 6 < len(numbers):
                                        try:
                                            at_bats = int(numbers[start_idx])
                                            runs = int(numbers[start_idx + 1])
                                            hits = int(numbers[start_idx + 2])
                                            doubles = int(numbers[start_idx + 3])
                                            triples = int(numbers[start_idx + 4])
                                            home_runs = int(numbers[start_idx + 5])
                                            rbis = int(numbers[start_idx + 6])
                                            
                                            # Sanity check: hits shouldn't exceed at_bats
                                            if hits <= at_bats and at_bats <= 6:
                                                # Extract date if possible
                                                date_match = re.search(r'2025-\d{2}-\d{2}', line)
                                                game_date = date_match.group() if date_match else '2025-08-01'
                                                
                                                game_data = {
                                                    'date': game_date,
                                                    'at_bats': at_bats,
                                                    'runs': runs,
                                                    'hits': hits,
                                                    'doubles': doubles,
                                                    'triples': triples,
                                                    'home_runs': home_runs,
                                                    'rbis': rbis,
                                                    'walks': 0,  # Could extract if more numbers available
                                                    'strikeouts': 0,  # Could extract if more numbers available
                                                }
                                                
                                                # Calculate total bases
                                                game_data['total_bases'] = (hits + doubles + (2 * triples) + (3 * home_runs))
                                                
                                                games.append(game_data)
                                                logger.debug(f"Parsed game: {game_date} - {hits}H, {rbis}RBI, {home_runs}HR")
                                                break  # Found valid stats for this line
                                                
                                        except (ValueError, IndexError):
                                            continue  # Try next starting position
                                            
                            except Exception as e:
                                logger.debug(f"Error parsing numbers from line: {e}")
                                continue
                
                logger.info(f"Successfully parsed {len(games)} games for {player_name}")
                
            else:
                # Check if this looks like a basic player info page instead of game logs
                if any(phrase in scraped_text for phrase in ["How old is", "was born", "Stats, Height, Weight"]):
                    logger.warning(f"Got player info page instead of game logs for {player_name}")
                    logger.warning("This suggests the URL might be pointing to a summary page rather than the main player page")
                else:
                    logger.warning(f"No game log section found for {player_name}")
            
            # Final validation
            if not games:
                logger.error(f"FAILED TO PARSE ANY GAMES FOR {player_name}")
                logger.error(f"Text length: {len(scraped_text)} characters")
                logger.error("Check the debug file to see what Apify actually returned")
            
            return games[:10]  # Return last 10 games
            
        except Exception as e:
            logger.error(f"Error parsing Baseball Reference text for {player_name}: {e}")
            return []

    def calculate_prop_performance(self, games: List[Dict], focus_props: List[str]) -> Dict:
        """Calculate prop betting performance from game logs"""
        if not games:
            return {}
        
        prop_thresholds = {
            'RBIs': [0.5, 1.5],
            'Hits': [0.5, 1.5, 2.5], 
            'Runs': [0.5, 1.5],
            'Total Bases': [0.5, 1.5, 2.5],
            'Home Runs': [0.5],
            'Walks': [0.5, 1.5],
            'Strikeouts': [0.5, 1.5]
        }
        
        performance = {}
        
        for prop in focus_props:
            if prop not in prop_thresholds:
                continue
                
            prop_key = prop.lower().replace(' ', '_')
            performance[prop] = {}
            
            for threshold in prop_thresholds[prop]:
                successes = 0
                for game in games:
                    if game.get(prop_key, 0) > threshold:
                        successes += 1
                
                success_rate = (successes / len(games)) * 100 if games else 0
                performance[prop][f"over_{threshold}"] = {
                    'success_count': successes,
                    'total_games': len(games),
                    'success_rate': round(success_rate, 1),
                    'trend': f"{successes}/{len(games)} games"
                }
        
        return performance

    async def run_statmuse_queries(self, queries: List[Dict]) -> List[Dict]:
        """Execute StatMuse queries for team trends and additional insights"""
        # Placeholder for StatMuse integration
        # This would integrate with your existing StatMuse tool
        results = []
        
        for query_info in queries:
            try:
                # Simulate StatMuse query result
                result = {
                    'query': query_info['query'],
                    'purpose': query_info['purpose'],
                    'data': f"StatMuse analysis for: {query_info['query']}",
                    'timestamp': datetime.now().isoformat()
                }
                results.append(result)
                logger.info(f"Executed StatMuse query: {query_info['query'][:50]}...")
                
                # Add small delay to avoid rate limiting
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Error executing StatMuse query: {e}")
                continue
        
        return results

    async def ai_generate_final_trends(self, scraped_data: List[Dict], statmuse_data: List[Dict]) -> Dict:
        """Step 5: AI synthesizes all data to generate final 9 player prop + 6 team trends"""
        
        prompt = f"""
You are an expert sports betting analyst. Based on the scraped Baseball Reference data and StatMuse insights, generate exactly 9 player prop trends and 6 team trends for MLB betting.

SCRAPED PLAYER DATA:
{json.dumps(scraped_data, indent=2, default=str)}

STATMUSE INSIGHTS:
{json.dumps(statmuse_data, indent=2, default=str)}

Generate trends that are:
1. Actionable for bettors
2. Based on strong statistical evidence  
3. Focused on upcoming games
4. Clear and specific

Return JSON format:
{{
  "player_prop_trends": [
    {{
      "title": "Freddie Freeman RBI Hot Streak",
      "description": "Freeman has recorded RBIs in 8 of his last 10 games (80% success rate) with upcoming favorable matchups.",
      "insight": "Consider Over 0.5 RBIs props for Freeman",
      "supporting_data": "8/10 games over 0.5 RBIs, facing weak bullpens next 2 games",
      "confidence": 85,
      "player_name": "Freddie Freeman",
      "prop_type": "RBIs",
      "trend_type": "player_prop"
    }}
  ],
  "team_trends": [
    {{
      "title": "Dodgers Home Run Surge",
      "description": "LAD averaging 2.1 HRs per game over last 10, well above season average",
      "insight": "Team totals and run lines trending over at home",
      "supporting_data": "21 HRs in last 10 games, 12-game home HR streak",
      "confidence": 78,
      "team": "LAD",
      "trend_type": "team"
    }}
  ]
}}
"""

        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-2-1212",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4
            )
            
            # Clean the response content to extract JSON
            content = response.choices[0].message.content.strip()
            
            # Remove markdown code blocks if present
            if content.startswith('```json'):
                content = content[7:]
            if content.startswith('```'):
                content = content[3:]
            if content.endswith('```'):
                content = content[:-3]
            
            # Clean up any extra text before/after JSON
            start = content.find('{')
            end = content.rfind('}') + 1
            if start >= 0 and end > start:
                content = content[start:end]
            
            result = json.loads(content)
            
            # Validate we have the right number of trends
            player_trends = result.get('player_prop_trends', [])
            team_trends = result.get('team_trends', [])
            
            logger.info(f"AI generated {len(player_trends)} player prop trends and {len(team_trends)} team trends")
            return result
            
        except Exception as e:
            logger.error(f"Error generating final trends: {e}")
            return {'player_prop_trends': [], 'team_trends': []}

    async def store_trends_in_database(self, trends_data: Dict, scraped_data: List[Dict]) -> bool:
        """Store generated trends in ai_trends table with enhanced metadata"""
        try:
            # Clear existing global trends
            self.supabase.table('ai_trends').delete().eq('is_global', True).execute()
            logger.info("Cleared existing global trends")
            
            trends_to_store = []
            
            # Store player prop trends
            for trend in trends_data.get('player_prop_trends', []):
                # Find matching scraped data for this player
                player_data = None
                for data in scraped_data:
                    if data.get('success') and data.get('player', '').lower() == trend.get('player_name', '').lower():
                        player_data = data
                        break
                
                # Try to resolve player from database
                player_id = None
                full_name = trend.get('player_name', '')
                if full_name.lower() in self.player_mappings:
                    player_info = self.player_mappings[full_name.lower()]
                    player_id = player_info.get('id')
                    full_name = player_info.get('name', full_name)
                
                trend_entry = {
                    'user_id': "00000000-0000-0000-0000-000000000000",  # System user for global trends
                    'trend_type': 'player_prop',
                    'title': trend.get('title', ''),
                    'description': trend.get('description', ''),
                    'insight': trend.get('insight', ''),
                    'supporting_data': trend.get('supporting_data', ''),
                    'confidence_score': trend.get('confidence', 50),
                    'trend_text': trend.get('description', ''),  # Use description as trend_text
                    'sport': 'MLB',
                    'is_global': True,
                    'player_id': player_id,
                    'full_player_name': full_name,
                    'scraped_prop_data': player_data.get('prop_performance', {}) if player_data else {},
                    'prop_performance_stats': player_data.get('recent_games', []) if player_data else [],
                    'data_sources': ['baseball_reference', 'ai_analysis'],
                    'metadata': {
                        'prop_type': trend.get('prop_type', ''),
                        'games_analyzed': player_data.get('games_scraped', 0) if player_data else 0,
                        'scrape_timestamp': player_data.get('scrape_timestamp') if player_data else None
                    }
                }
                trends_to_store.append(trend_entry)
            
            # Store team trends
            for trend in trends_data.get('team_trends', []):
                trend_entry = {
                    'user_id': "00000000-0000-0000-0000-000000000000",  # System user for global trends
                    'trend_type': 'team',
                    'title': trend.get('title', ''),
                    'description': trend.get('description', ''),
                    'insight': trend.get('insight', ''),
                    'supporting_data': trend.get('supporting_data', ''),
                    'confidence_score': trend.get('confidence', 50),
                    'trend_text': trend.get('description', ''),  # Use description as trend_text
                    'sport': 'MLB',
                    'is_global': True,
                    'data_sources': ['statmuse', 'ai_analysis'],
                    'metadata': {
                        'team': trend.get('team', ''),
                        'analysis_type': 'team_performance'
                    }
                }
                trends_to_store.append(trend_entry)
            
            # Batch insert trends
            if trends_to_store:
                for trend in trends_to_store:
                    self.supabase.table('ai_trends').insert(trend).execute()
                    await asyncio.sleep(0.1)  # Small delay between inserts
                
                logger.info(f"Successfully stored {len(trends_to_store)} trends in database")
                return True
            else:
                logger.warning("No trends to store")
                return False
                
        except Exception as e:
            logger.error(f"Error storing trends in database: {e}")
            return False

    async def run_intelligent_analysis(self):
        """Main workflow: Intelligent analysis and trend generation"""
        try:
            logger.info("Starting intelligent trends analysis...")
            
            # Step 1: Analyze upcoming games and props
            logger.info("Step 1: Analyzing upcoming games and available props...")
            analysis_data = await self.analyze_upcoming_games_and_props()
            
            # Step 2: AI selects focus players and queries
            logger.info("Step 2: AI selecting focus players and StatMuse queries...")
            selection_data = await self.ai_select_focus_players_and_queries(analysis_data)
            
            # Step 3: Scrape Baseball Reference using Apify
            logger.info("Step 3: Scraping Baseball Reference for selected players using Apify...")
            successful_scrapes = []
            
            if selection_data.get('selected_players'):
                for player_info in selection_data['selected_players'][:5]:  # Limit to 5 players for testing
                    scrape_result = await self.scrape_baseball_reference_player(player_info)
                    if scrape_result.get('success'):
                        successful_scrapes.append(scrape_result)
                        logger.info(f"✅ Successfully scraped {scrape_result['player']} - {scrape_result['games_scraped']} games")
                    else:
                        logger.warning(f"❌ Failed to scrape {scrape_result['player']}: {scrape_result.get('error')}")
            
            logger.info(f"Successfully scraped {len(successful_scrapes)} of {len(selection_data.get('selected_players', []))} players via Apify")
            
            # Step 4: Run StatMuse queries
            logger.info("Step 4: Running StatMuse queries...")
            statmuse_data = await self.run_statmuse_queries(selection_data.get('statmuse_queries', []))
            
            # Step 5: AI generates final trends
            logger.info("Step 5: AI generating final trends...")
            final_trends = await self.ai_generate_final_trends(successful_scrapes, statmuse_data)
            
            # Step 6: Store trends in database
            logger.info("Step 6: Storing trends in database...")
            success = await self.store_trends_in_database(final_trends, successful_scrapes)
            
            if success:
                logger.info("✅ Intelligent trends analysis completed successfully!")
                return {
                    'success': True,
                    'players_analyzed': len(successful_scrapes),
                    'statmuse_queries': len(statmuse_data),
                    'player_prop_trends': len(final_trends.get('player_prop_trends', [])),
                    'team_trends': len(final_trends.get('team_trends', []))
                }
            else:
                logger.error("❌ Failed to store trends in database")
                return {'success': False, 'error': 'Database storage failed'}
                
        except Exception as e:
            logger.error(f"Error in intelligent analysis: {e}")
            return {'success': False, 'error': str(e)}


async def main():
    """Main entry point"""
    generator = IntelligentTrendsGenerator()
    result = await generator.run_intelligent_analysis()
    
    if result.get('success'):
        print(f"\n✅ Analysis Complete!")
        print(f"Players Analyzed: {result.get('players_analyzed', 0)}")
        print(f"StatMuse Queries: {result.get('statmuse_queries', 0)}")
        print(f"Player Prop Trends: {result.get('player_prop_trends', 0)}")
        print(f"Team Trends: {result.get('team_trends', 0)}")
    else:
        print(f"\n❌ Analysis Failed: {result.get('error', 'Unknown error')}")

if __name__ == "__main__":
    asyncio.run(main())
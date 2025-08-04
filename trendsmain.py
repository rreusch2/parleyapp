#!/usr/bin/env python3
"""
Enhanced Daily Trends Generator
Combines StatMuse queries with SportsChatPlace player prop scraping
to generate comprehensive betting trends.

Features:
- Scrapes player prop performance from SportsChatPlace
- Matches abbreviated names to full names using players table
- Generates 9 Player Prop trends + 6 Team trends
- Stores enhanced data with source tracking
"""

import os
import sys
import requests
import json
import argparse
import random
import asyncio
import re
from datetime import datetime, timedelta, date
from supabase import create_client, Client
import logging
from dotenv import load_dotenv
from openai import AsyncOpenAI
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EnhancedDailyTrendsGenerator:
    def __init__(self, sport_filter=None, dry_run=False):
        self.sport_filter = sport_filter or 'MLB'
        self.dry_run = dry_run
        
        # Initialize Supabase client
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')

        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")

        logger.info(f"Connecting to Supabase at: {self.supabase_url[:50]}...")
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # StatMuse API server URL
        self.statmuse_api_url = os.getenv('STATMUSE_API_URL', 'http://localhost:5001')
        
        # Initialize Grok client
        self.grok_client = AsyncOpenAI(
            api_key=os.getenv("XAI_API_KEY"),
            base_url="https://api.x.ai/v1"
        )
        
        if not os.getenv("XAI_API_KEY"):
            raise ValueError("Please set XAI_API_KEY environment variable for Grok-3")
            
        # Cache for player name resolution
        self.player_name_cache = {}
        self.load_player_cache()

    def load_player_cache(self):
        """Load all players from database for name matching"""
        try:
            players = self.supabase.table('players').select('id, name, player_name, team').eq('sport', 'MLB').execute().data
            
            for player in players:
                # Store both full names for matching
                full_name = player.get('name') or player.get('player_name', '')
                self.player_name_cache[full_name.lower()] = {
                    'id': player['id'],
                    'full_name': full_name,
                    'team': player.get('team', '')
                }
                
                # Also store first initial + last name format for matching
                if ' ' in full_name:
                    parts = full_name.split(' ')
                    if len(parts) >= 2:
                        abbreviated = f"{parts[0][0]}. {parts[-1]}"
                        self.player_name_cache[abbreviated.lower()] = {
                            'id': player['id'],
                            'full_name': full_name,
                            'team': player.get('team', '')
                        }
            
            logger.info(f"Loaded {len(self.player_name_cache)} player name mappings")
            
        except Exception as e:
            logger.error(f"Error loading player cache: {e}")

    def resolve_player_name(self, abbreviated_name):
        """Resolve abbreviated name like 'F. Freeman' to full name and player ID"""
        # Clean the name
        clean_name = abbreviated_name.strip().lower()
        
        # Direct match
        if clean_name in self.player_name_cache:
            return self.player_name_cache[clean_name]
        
        # Try fuzzy matching for common variations
        for cached_name, player_info in self.player_name_cache.items():
            if self.names_match(clean_name, cached_name):
                return player_info
        
        logger.warning(f"Could not resolve player name: {abbreviated_name}")
        return None

    def names_match(self, name1, name2):
        """Check if two names are likely the same player"""
        # Remove punctuation and normalize
        name1_clean = re.sub(r'[^\w\s]', '', name1.lower())
        name2_clean = re.sub(r'[^\w\s]', '', name2.lower())
        
        # Split into parts
        parts1 = name1_clean.split()
        parts2 = name2_clean.split()
        
        if len(parts1) >= 2 and len(parts2) >= 2:
            # Check if first initial and last name match
            return (parts1[0][0] == parts2[0][0] and parts1[-1] == parts2[-1])
        
        return False

    async def scrape_sportschatplace_props(self):
        """Scrape player prop performance data from SportsChatPlace"""
        url = "https://stats.sportschatplace.com/player-props/baseball/mlb/last-10-matches"
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            prop_data = []
            
            # Look for player prop cards/elements
            # This is a generic parser - may need adjustment based on actual HTML structure
            player_elements = soup.find_all(['div', 'td', 'span'], string=re.compile(r'[A-Z]\.\s+[A-Z][a-z]+'))
            
            for element in player_elements:
                try:
                    text = element.get_text(strip=True)
                    
                    # Look for pattern like "F. FREEMAN 70.0% (7/10)"
                    pattern = r'([A-Z]\.\s+[A-Z]+)\s+(\d+\.?\d*)%\s*\((\d+)/(\d+)\)'
                    match = re.search(pattern, text)
                    
                    if match:
                        player_name = match.group(1)
                        percentage = float(match.group(2))
                        success_count = int(match.group(3))
                        total_games = int(match.group(4))
                        
                        # Try to find prop type from surrounding context
                        prop_type = self.extract_prop_type_from_context(element)
                        
                        # Resolve full player name
                        player_info = self.resolve_player_name(player_name)
                        
                        prop_entry = {
                            'abbreviated_name': player_name,
                            'percentage': percentage,
                            'success_count': success_count,
                            'total_games': total_games,
                            'prop_type': prop_type or 'hits',  # Default to hits
                            'player_info': player_info,
                            'scraped_at': datetime.now().isoformat()
                        }
                        
                        prop_data.append(prop_entry)
                        
                except Exception as e:
                    logger.warning(f"Error parsing element: {e}")
                    continue
            
            logger.info(f"Scraped {len(prop_data)} player prop entries from SportsChatPlace")
            return prop_data
            
        except Exception as e:
            logger.error(f"Error scraping SportsChatPlace: {e}")
            return []

    def extract_prop_type_from_context(self, element):
        """Extract prop type from surrounding HTML context"""
        # Look for prop type indicators in parent elements
        current = element
        for _ in range(5):  # Check up to 5 parent levels
            if current.parent:
                current = current.parent
                text = current.get_text().lower()
                
                # Common prop type keywords
                if 'rbi' in text:
                    return 'rbis'
                elif 'hit' in text:
                    return 'hits'
                elif 'home run' in text or 'hr' in text:
                    return 'home_runs'
                elif 'strikeout' in text or 'so' in text:
                    return 'strikeouts'
                elif 'run' in text and 'rbi' not in text:
                    return 'runs'
            else:
                break
        
        return 'hits'  # Default

    def fetch_upcoming_games_and_odds(self):
        """Fetch upcoming games and odds for the next 48 hours"""
        try:
            now = datetime.now()
            two_days_later = now + timedelta(hours=48)
            
            # Fetch games
            games_query = self.supabase.table('sports_events').select('*')
            if self.sport_filter:
                games_query = games_query.eq('sport', self.sport_filter)
            games_query = games_query.gte('start_time', now.isoformat()).lte('start_time', two_days_later.isoformat())
            games = games_query.execute().data

            if not games:
                logger.warning("No games found for the next 48 hours")
                return [], []

            # Fetch player props with actual player names
            player_props_query = self.supabase.table('player_props_odds').select(
                '*', 
                'players(name, team)'
            ).gte('created_at', (now - timedelta(days=1)).isoformat())
            player_props = player_props_query.execute().data

            logger.info(f"Fetched {len(games)} games and {len(player_props)} player props")
            return games, player_props

        except Exception as e:
            logger.error(f"Error fetching games and odds: {e}")
            return [], []

    async def grok_analyze_combined_data(self, games, player_props, scraped_props):
        """Use Grok to analyze both StatMuse and scraped data for trend generation"""
        try:
            # Prepare context for Grok
            games_context = []
            for game in games[:20]:
                games_context.append({
                    'home_team': game.get('home_team', ''),
                    'away_team': game.get('away_team', ''),
                    'start_time': game.get('start_time', ''),
                    'sport': game.get('sport', 'MLB')
                })
            
            props_context = []
            for prop in player_props[:20]:
                if prop.get('players'):
                    props_context.append({
                        'player': prop['players'].get('name', ''),
                        'team': prop['players'].get('team', ''),
                        'prop_type': prop.get('prop_type', ''),
                        'line': prop.get('line', '')
                    })
            
            # Format scraped prop data for Grok
            scraped_context = []
            for prop in scraped_props[:30]:
                if prop.get('player_info'):
                    scraped_context.append({
                        'player': prop['player_info']['full_name'],
                        'team': prop['player_info']['team'],
                        'prop_type': prop['prop_type'],
                        'success_rate': f"{prop['percentage']}% ({prop['success_count']}/{prop['total_games']})",
                        'recent_performance': prop['success_count'],
                        'total_games': prop['total_games']
                    })
            
            grok_prompt = f"""You are Grok, an expert sports betting analyst. I have REAL player prop performance data scraped from SportsChatPlace plus upcoming games data. Generate EXACTLY 9 player prop trends and 6 team trends.

UPCOMING GAMES (next 48 hours):
{json.dumps(games_context, indent=2)}

CURRENT PLAYER PROPS WITH LINES:
{json.dumps(props_context, indent=2)}

REAL SCRAPED PLAYER PROP PERFORMANCE DATA (Last 10 Games):
{json.dumps(scraped_context, indent=2)}

CRITICAL: Generate EXACTLY this mix:
- EXACTLY 9 trends about INDIVIDUAL PLAYERS (classify as "player_prop") 
- EXACTLY 6 trends about TEAMS (classify as "team")

PRIORITIZE the scraped data for player prop trends since it shows ACTUAL recent performance:
- Focus on players with strong success rates (70%+ or very low rates for fade plays)
- Look for players with 7+ successes in 10 games or 2 or fewer successes
- Consider prop types that have betting value

PLAYER PROP TREND EXAMPLES (use real data):
- "Mike Trout has gone over 1.5 hits in 8 of his last 10 games (80% success rate)"
- "Aaron Judge has hit under 0.5 home runs in 7 of his last 10 games"

TEAM TREND EXAMPLES:
- "The Yankees have won 8 of their last 10 games"
- "The Dodgers have scored 5+ runs in 7 straight games"

Return EXACTLY this JSON format with 15 trends (9 player_prop + 6 team):
{{
  "trends": [
    {{
      "trend_text": "Clean, grammatically perfect insight with specific numbers",
      "trend_type": "player_prop",
      "confidence_score": 0.85,
      "betting_value": "High",
      "data_source": "scraped_sportschatplace"
    }},
    {{
      "trend_text": "Another team insight", 
      "trend_type": "team",
      "confidence_score": 0.75,
      "betting_value": "Medium",
      "data_source": "statmuse"
    }}
  ]
}}

MANDATORY: Must return EXACTLY 9 player_prop trends and EXACTLY 6 team trends for a total of 15."""

            response = await self.grok_client.chat.completions.create(
                model="grok-2-1212",
                messages=[{"role": "user", "content": grok_prompt}],
                temperature=0.4
            )
            
            grok_response = response.choices[0].message.content.strip()
            
            # Parse JSON response from Grok
            if '{' in grok_response and 'trends' in grok_response:
                result = json.loads(grok_response)
                trends = result.get('trends', [])
                
                # Validate counts
                player_prop_count = len([t for t in trends if t.get('trend_type') == 'player_prop'])
                team_count = len([t for t in trends if t.get('trend_type') == 'team'])
                
                logger.info(f"Grok generated {player_prop_count} player prop trends and {team_count} team trends")
                
                if player_prop_count != 9 or team_count != 6:
                    logger.warning(f"Trend count mismatch. Expected 9 player_prop + 6 team, got {player_prop_count} + {team_count}")
                
                return trends[:15]  # Return exactly 15
            else:
                logger.warning("Grok didn't return proper JSON format")
                return self.fallback_trend_generation(scraped_props)
                    
        except Exception as e:
            logger.error(f"Error in Grok trend analysis: {e}")
            return self.fallback_trend_generation(scraped_props)

    def fallback_trend_generation(self, scraped_props):
        """Generate fallback trends from scraped data"""
        trends = []
        
        # Generate player prop trends from scraped data
        player_trends = []
        for prop in scraped_props[:12]:  # Get more than we need
            if prop.get('player_info') and len(player_trends) < 9:
                full_name = prop['player_info']['full_name']
                prop_type = prop['prop_type']
                success_rate = prop['percentage']
                success_count = prop['success_count']
                total_games = prop['total_games']
                
                # Determine if it's a strong trend
                betting_value = "High" if success_rate >= 75 or success_rate <= 25 else "Medium"
                confidence = success_rate / 100 if success_rate >= 50 else (100 - success_rate) / 100
                
                trend_text = f"{full_name} has gone over 0.5 {prop_type} in {success_count} of his last {total_games} games ({success_rate}% success rate)"
                
                player_trends.append({
                    'trend_text': trend_text,
                    'trend_type': 'player_prop',
                    'confidence_score': confidence,
                    'betting_value': betting_value,
                    'data_source': 'scraped_sportschatplace'
                })
        
        # Fill remaining player prop slots with generic trends
        while len(player_trends) < 9:
            player_trends.append({
                'trend_text': f"Strong player prop opportunity identified in recent games",
                'trend_type': 'player_prop',
                'confidence_score': 0.7,
                'betting_value': 'Medium',
                'data_source': 'fallback'
            })
        
        # Generate basic team trends
        team_trends = []
        for i in range(6):
            team_trends.append({
                'trend_text': f"Team performance trend #{i+1} based on recent analysis",
                'trend_type': 'team',
                'confidence_score': 0.7,
                'betting_value': 'Medium',
                'data_source': 'fallback'
            })
        
        return player_trends + team_trends

    def call_statmuse_api(self, queries):
        """Call the StatMuse API server with caching"""
        try:
            results = []
            for query in queries:
                try:
                    response = requests.post(
                        f"{self.statmuse_api_url}/query",
                        json={'query': query},
                        headers={'Content-Type': 'application/json'},
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        if result.get('success'):
                            results.append(result)
                        else:
                            logger.warning(f"StatMuse query failed: {query}")
                    else:
                        logger.warning(f"StatMuse API returned {response.status_code} for query: {query}")
                        
                except Exception as query_error:
                    logger.warning(f"Error with individual query '{query}': {query_error}")
                    continue
                    
            logger.info(f"Received {len(results)} successful results from StatMuse API")
            return results
            
        except Exception as e:
            logger.error(f"Error calling StatMuse API: {e}")
            return []

    def enhance_trends_with_scraped_data(self, trends, scraped_props):
        """Enhance trends with additional scraped prop data"""
        enhanced_trends = []
        
        for trend in trends:
            enhanced_trend = trend.copy()
            
            # If it's a player prop trend, try to match with scraped data
            if trend.get('trend_type') == 'player_prop':
                trend_text = trend.get('trend_text', '').lower()
                
                # Find matching scraped data
                for prop in scraped_props:
                    if prop.get('player_info'):
                        player_name = prop['player_info']['full_name'].lower()
                        if any(name_part in trend_text for name_part in player_name.split()):
                            # Add scraped performance data
                            enhanced_trend['scraped_prop_data'] = {
                                'success_rate': prop['percentage'],
                                'success_count': prop['success_count'],
                                'total_games': prop['total_games'],
                                'prop_type': prop['prop_type']
                            }
                            enhanced_trend['player_id'] = prop['player_info']['id']
                            enhanced_trend['full_player_name'] = prop['player_info']['full_name']
                            enhanced_trend['data_sources'] = enhanced_trend.get('data_sources', []) + ['sportschatplace_scrape']
                            break
            
            enhanced_trends.append(enhanced_trend)
        
        return enhanced_trends

    def store_trends(self, trends):
        """Store the enhanced trends into the ai_trends table with global scope"""
        try:
            if self.dry_run:
                logger.info(f"DRY RUN: Would store {len(trends)} trends")
                for i, trend in enumerate(trends):
                    logger.info(f"Trend {i+1}: {trend['trend_text'][:100]}...")
                return
            
            # Clear existing global trends for today
            today = date.today().isoformat()
            
            # Delete existing global trends (is_global=true)
            try:
                self.supabase.table('ai_trends').delete().eq('is_global', True).execute()
                logger.info("Cleared existing global trends")
            except Exception as delete_error:
                logger.warning(f"Could not clear existing trends: {delete_error}")
            
            # Use a global admin user ID
            global_user_id = '00000000-0000-0000-0000-000000000000'
            
            stored_count = 0
            for i, trend in enumerate(trends):
                try:
                    record = {
                        'user_id': global_user_id,
                        'trend_text': trend['trend_text'][:500],
                        'trend_type': trend.get('trend_type', 'general'),
                        'sport': self.sport_filter or 'MLB',
                        'confidence_score': float(trend.get('confidence_score', 0.7)),
                        'data': {
                            'query': trend.get('query', ''),
                            'generated_at': datetime.now().isoformat(),
                            'order': i + 1,
                            'betting_value': trend.get('betting_value', 'Medium'),
                            'data_source': trend.get('data_source', 'combined')
                        },
                        'is_global': True,
                        'expires_at': (datetime.now() + timedelta(days=2)).isoformat()
                    }
                    
                    # Add enhanced fields if available
                    if 'scraped_prop_data' in trend:
                        record['scraped_prop_data'] = trend['scraped_prop_data']
                    if 'player_id' in trend:
                        record['player_id'] = trend['player_id']
                    if 'full_player_name' in trend:
                        record['full_player_name'] = trend['full_player_name']
                    if 'data_sources' in trend:
                        record['data_sources'] = trend['data_sources']
                    
                    result = self.supabase.table('ai_trends').insert(record).execute()
                    stored_count += 1
                    
                except Exception as insert_error:
                    logger.warning(f"Failed to store trend {i+1}: {insert_error}")
                    continue

            logger.info(f"Successfully stored {stored_count} out of {len(trends)} enhanced trends")
    
        except Exception as e:
            logger.error(f"Error storing trends: {e}")

async def main():
    parser = argparse.ArgumentParser(description='Generate enhanced daily sports trends with scraping')
    parser.add_argument('--sport', type=str, default='MLB', help='Filter by sport')
    parser.add_argument('--dry-run', action='store_true', help='Execute script without storing results')
    args = parser.parse_args()

    generator = EnhancedDailyTrendsGenerator(sport_filter=args.sport, dry_run=args.dry_run)
    
    # Step 1: Scrape SportsChatPlace for real prop performance data
    logger.info("Scraping SportsChatPlace for player prop performance...")
    scraped_props = await generator.scrape_sportschatplace_props()
    
    # Step 2: Get upcoming games and existing prop data
    games, player_props = generator.fetch_upcoming_games_and_odds()
    
    # Step 3: Use Grok to analyze all data and generate trends
    logger.info("Analyzing data with Grok-3...")
    trends = await generator.grok_analyze_combined_data(games, player_props, scraped_props)
    
    # Step 4: Enhance trends with scraped data
    enhanced_trends = generator.enhance_trends_with_scraped_data(trends, scraped_props)
    
    # Step 5: Store trends
    generator.store_trends(enhanced_trends)
    
    logger.info(f"Generated {len(enhanced_trends)} enhanced trends:")
    player_prop_count = len([t for t in enhanced_trends if t.get('trend_type') == 'player_prop'])
    team_count = len([t for t in enhanced_trends if t.get('trend_type') == 'team'])
    logger.info(f"- {player_prop_count} Player Prop trends")
    logger.info(f"- {team_count} Team trends")

if __name__ == "__main__":
    asyncio.run(main())
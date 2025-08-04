#!/usr/bin/env python3
"""
Daily Trends Generator
Fetches upcoming games & odds for next 48h, builds StatMuse query list,
calls StatMuse API with caching, parses answers to structured trend objects,
and stores 15 trends into ai_trends table (is_global=true).

Pattern after daily_insights_generator.py
"""

import os
import sys
import requests
import json
import argparse
import random
from datetime import datetime, timedelta, date
from supabase import create_client, Client
import logging
from dotenv import load_dotenv
# from statmuse_api_server import StatMuseAPI  # Not needed - using HTTP API

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DailyTrendsGenerator:
    def __init__(self, sport_filter=None, dry_run=False):
        self.sport_filter = sport_filter
        self.dry_run = dry_run
        # Initialize Supabase client with service key for admin operations
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')

        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")

        logger.info(f"Connecting to Supabase at: {self.supabase_url[:50]}...")
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # StatMuse API server URL
        self.statmuse_api_url = os.getenv('STATMUSE_API_URL', 'http://localhost:5001')

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

    def build_statmuse_queries(self, games, player_props):
        """Build a comprehensive list of StatMuse queries from games and player props"""
        queries = []
        try:
            # Shuffle for randomness
            random.shuffle(games)
            random.shuffle(player_props)
            
            # Team-related queries (ensure mix: 7 team queries)
            team_query_templates = [
                "{team} record in last 10 games",
                "{team} home record this season",  
                "{team} runs scored per game last 10",
                "{team} ERA last 10 games",
                "{team} record vs {opponent} this season",
                "{team} batting average last 15 games",
                "{team} bullpen ERA this season"
            ]
            
            for i, game in enumerate(games[:10]):  # Use first 10 games
                if len([q for q in queries if 'vs' not in q]) < 7:  # Ensure 7 team queries
                    template = team_query_templates[i % len(team_query_templates)]
                    if '{opponent}' in template:
                        query = template.format(team=game['home_team'], opponent=game['away_team'])
                    else:
                        query = template.format(team=game['home_team'])
                    queries.append(query)
            
            # Head-to-head matchup queries
            for game in games[:20]:
                query = f"{game['home_team']} vs {game['away_team']} performance last 5 games"
                queries.append(query)
            
            # Player-related queries (ensure mix: 8 player queries)
            player_query_templates = [
                "{player} batting average last 10 games",
                "{player} home runs this season",
                "{player} RBI last 15 games", 
                "{player} hits last 7 games",
                "{player} strikeouts this season",
                "{player} on base percentage last 10",
                "{player} slugging percentage this season",
                "{player} stolen bases this season"
            ]
            
            for i, prop in enumerate(player_props[:20]):  # Use first 20 props
                if prop.get('players') and len([q for q in queries if any(t in q for t in ['batting', 'hits', 'RBI', 'home runs'])]) < 8:
                    player_name = prop['players']['name']
                    template = player_query_templates[i % len(player_query_templates)]
                    query = template.format(player=player_name)
                    queries.append(query)
            
            # Remove duplicates while preserving order
            seen = set()
            unique_queries = []
            for query in queries:
                if query not in seen:
                    seen.add(query)
                    unique_queries.append(query)
            
            # Limit to reasonable number for processing
            if len(unique_queries) > 50:
                unique_queries = unique_queries[:50]
            
            logger.info(f"Generated {len(unique_queries)} unique StatMuse queries")
            return unique_queries
            
        except Exception as e:
            logger.error(f"Error building StatMuse queries: {e}")
            return []

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
                            logger.warning(f"StatMuse query failed: {query} - {result.get('error')}")
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

    def parse_answers_to_trends(self, responses):
        """Parse API responses into structured trend objects with confidence heuristics"""
        trends = []
        
        for response in responses:
            if not response.get('success'):
                continue
                
            trend_text = response.get('answer', '')
            query = response.get('query', '')
            
            if not trend_text or len(trend_text.strip()) < 10:
                continue
                
            # Calculate confidence based on heuristics
            confidence = self.calculate_confidence_heuristic(trend_text, query)
            
            # Determine trend type based on query
            trend_type = 'team' if any(word in query.lower() for word in ['team', 'record', 'vs', 'era']) else 'player'
            
            trend_object = {
                'trend_text': trend_text.strip(),
                'confidence_score': confidence,
                'query': query,
                'trend_type': trend_type
            }
            trends.append(trend_object)
        
        # Sort by confidence and ensure we have a good mix
        trends.sort(key=lambda x: x['confidence_score'], reverse=True)
        
        # Select top 15 with balanced mix (8 player, 7 team as requested)
        player_trends = [t for t in trends if t['trend_type'] == 'player'][:8]
        team_trends = [t for t in trends if t['trend_type'] == 'team'][:7]
        
        best_trends = player_trends + team_trends
        
        # If we don't have enough, fill with remaining highest confidence
        if len(best_trends) < 15:
            remaining = [t for t in trends if t not in best_trends][:15-len(best_trends)]
            best_trends.extend(remaining)
        
        logger.info(f"Selected {len(best_trends)} trends ({len(player_trends)} player, {len(team_trends)} team)")
        return best_trends[:15]

    def calculate_confidence_heuristic(self, trend_text, query):
        """Calculate confidence score based on text content heuristics"""
        confidence = 0.5  # Base confidence
        
        # Higher confidence for specific statistics
        if any(pattern in trend_text.lower() for pattern in ['.', 'avg', 'era', '%', 'record']):
            confidence += 0.2
            
        # Higher confidence for recent data
        if any(timeframe in trend_text.lower() for timeframe in ['last', 'this season', 'recent']):
            confidence += 0.1
            
        # Higher confidence for longer, more detailed responses
        if len(trend_text) > 100:
            confidence += 0.1
        elif len(trend_text) < 50:
            confidence -= 0.1
            
        # Ensure confidence is between 0 and 1
        return max(0.1, min(1.0, confidence))
    
    def store_trends(self, trends):
        """Store the trends into the ai_trends table with global scope"""
        try:
            # Clear existing global trends for today
            today = date.today().isoformat()
            
            # Delete existing global trends (is_global=true)
            try:
                self.supabase.table('ai_trends').delete().eq('is_global', True).execute()
                logger.info("Cleared existing global trends")
            except Exception as delete_error:
                logger.warning(f"Could not clear existing trends: {delete_error}")
            
            # Use a global admin user ID or make user_id nullable
            global_user_id = '00000000-0000-0000-0000-000000000000'  # Global trends user
            
            stored_count = 0
            for i, trend in enumerate(trends):
                try:
                    record = {
                        'user_id': global_user_id,
                        'trend_text': trend['trend_text'][:500],  # Truncate if too long
                        'trend_type': trend.get('trend_type', 'general'),
                        'sport': self.sport_filter or 'MLB',
                        'confidence_score': float(trend['confidence_score']),
                        'data': {
                            'query': trend.get('query', ''),
                            'generated_at': datetime.now().isoformat(),
                            'order': i + 1
                        },
                        'is_global': True,
                        'expires_at': (datetime.now() + timedelta(days=2)).isoformat()
                    }
                    
                    result = self.supabase.table('ai_trends').insert(record).execute()
                    stored_count += 1
                    
                except Exception as insert_error:
                    logger.warning(f"Failed to store trend {i+1}: {insert_error}")
                    continue

            logger.info(f"Successfully stored {stored_count} out of {len(trends)} trends")
    
        except Exception as e:
            logger.error(f"Error storing trends: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generate daily sports trends')
    parser.add_argument('--sport', type=str, help='Filter by sport')
    parser.add_argument('--dry-run', action='store_true', help='Execute script without storing results')
    args = parser.parse_args()

    generator = DailyTrendsGenerator(sport_filter=args.sport, dry_run=args.dry_run)
    games, player_props = generator.fetch_upcoming_games_and_odds()
    queries = generator.build_statmuse_queries(games, player_props)
    responses = generator.call_statmuse_api(queries)
    trends = generator.parse_answers_to_trends(responses)
    if not generator.dry_run:
        generator.store_trends(trends)


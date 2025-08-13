#!/usr/bin/env python3
"""
Fixed Intelligent Trends Generator
Uses StatMuse API and web search to generate accurate MLB trends based on real data.
No fake data generation - all trends based on actual StatMuse queries and web research.
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

class FixedTrendsGenerator:
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
        
        # StatMuse API URL (use local server)
        self.statmuse_api_url = 'http://localhost:5001'
        
        logger.info(f"Connecting to Supabase at: {self.supabase_url[:50]}...")
        logger.info(f"StatMuse API URL: {self.statmuse_api_url}")
        
    def get_upcoming_games(self, target_date: date = None) -> List[Dict]:
        """Get upcoming MLB games"""
        if target_date is None:
            target_date = date.today()
        
        try:
            # Query for games on the target date
            start_iso = target_date.isoformat() + "T00:00:00Z"
            end_iso = target_date.isoformat() + "T23:59:59Z"
            
            response = self.supabase.table("games").select(
                "id, home_team, away_team, start_time, sport, metadata"
            ).gte("start_time", start_iso).lte("start_time", end_iso).eq("sport", "Major League Baseball").order("start_time").execute()
            
            logger.info(f"Found {len(response.data)} MLB games for {target_date}")
            return response.data
        except Exception as e:
            logger.error(f"Failed to fetch games for {target_date}: {e}")
            return []

    def get_recent_predictions(self, limit: int = 20) -> List[Dict]:
        """Get recent AI predictions for context"""
        try:
            response = self.supabase.table("ai_predictions").select(
                "player_name, prop_type, prediction, confidence, supporting_data"
            ).order("created_at", desc=True).limit(limit).execute()
            
            logger.info(f"Found {len(response.data)} recent predictions")
            return response.data
        except Exception as e:
            logger.error(f"Failed to fetch recent predictions: {e}")
            return []

    def get_available_props(self, game_ids: List[str]) -> List[Dict]:
        """Get available player props for games"""
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
                    
                    props.append({
                        'player_name': row["players"]["name"],
                        'prop_type': row["player_prop_types"]["prop_name"],
                        'line': float(row["line"]),
                        'team': row["players"]["team"] or "Unknown"
                    })
            
            logger.info(f"Found {len(props)} player props from {len(game_ids)} games")
            return props
        except Exception as e:
            logger.error(f"Failed to fetch player props: {e}")
            return []

    async def run_statmuse_query(self, query: str) -> Dict:
        """Execute a single StatMuse query"""
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
                    logger.info(f"✅ StatMuse query successful: {query[:50]}...")
                    return result
                else:
                    logger.warning(f"StatMuse query failed: {query} - {result.get('error')}")
                    return {'success': False, 'error': result.get('error')}
            else:
                logger.warning(f"StatMuse API returned {response.status_code} for query: {query}")
                return {'success': False, 'error': f'HTTP {response.status_code}'}
        except Exception as e:
            logger.error(f"Error executing StatMuse query '{query}': {e}")
            return {'success': False, 'error': str(e)}

    async def run_web_search(self, query: str) -> str:
        """Run a web search query for additional context"""
        try:
            # Simple web search using httpx
            async with httpx.AsyncClient() as client:
                search_url = f"https://www.google.com/search?q={quote(query)}"
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
                response = await client.get(search_url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    # Simple text extraction
                    soup = BeautifulSoup(response.text, 'html.parser')
                    text_content = soup.get_text()[:1000]  # First 1000 chars
                    logger.info(f"✅ Web search successful: {query[:50]}...")
                    return text_content
                else:
                    logger.warning(f"Web search failed with status {response.status_code}")
                    return ""
        except Exception as e:
            logger.error(f"Error in web search '{query}': {e}")
            return ""

    async def generate_intelligent_queries(self, games: List[Dict], props: List[Dict], predictions: List[Dict]) -> Dict:
        """Generate intelligent StatMuse queries and web searches based on real data"""
        
        # Extract key players and teams from available data
        players = list(set([prop['player_name'] for prop in props[:20]]))  # Top 20 players with props
        teams = list(set([game['home_team'] for game in games] + [game['away_team'] for game in games]))
        
        prompt = f"""
Based on the following REAL data, generate specific StatMuse queries and web search queries to research actual MLB trends:

UPCOMING GAMES: {json.dumps(games[:10], indent=2)}
AVAILABLE PROPS: {json.dumps(props[:15], indent=2)}
RECENT PREDICTIONS: {json.dumps(predictions[:10], indent=2)}

Generate exactly 8 StatMuse queries and 6 web search queries that will provide REAL data for trend analysis.

Focus on:
1. Specific players who have props available today
2. Team performance trends for teams playing today
3. Recent statistical trends that are measurable
4. Pitching matchups and offensive trends

Return JSON format:
{{
  "statmuse_queries": [
    {{
      "query": "How many RBIs has [specific player] had in his last 5 games?",
      "purpose": "Player prop trend analysis"
    }}
  ],
  "web_search_queries": [
    {{
      "query": "MLB injury report today [specific team]",
      "purpose": "Injury impact analysis"
    }}
  ]
}}

Make queries specific to the actual players and teams in the data above.
"""

        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-2-1212",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=2000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Extract JSON
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_content = content[json_start:json_end]
                result = json.loads(json_content)
                
                if result.get('statmuse_queries') and result.get('web_search_queries'):
                    logger.info(f"Generated {len(result['statmuse_queries'])} StatMuse queries and {len(result['web_search_queries'])} web searches")
                    return result
                else:
                    raise ValueError("Invalid query structure")
            else:
                raise ValueError("No valid JSON found in response")
                
        except Exception as e:
            logger.error(f"Error generating queries: {e}")
            # Fallback queries
            return {
                "statmuse_queries": [
                    {"query": f"How many hits has {players[0]} had in his last 5 games?", "purpose": "Player analysis"} if players else {"query": "Which MLB teams have scored the most runs in their last 5 games?", "purpose": "Team analysis"},
                    {"query": "Which MLB teams have the best home run rates in their last 10 games?", "purpose": "Team power analysis"},
                    {"query": "Who are the top RBI leaders in MLB this week?", "purpose": "RBI trend analysis"},
                    {"query": f"How has {teams[0]} performed at home this season?", "purpose": "Home performance"} if teams else {"query": "Which MLB pitchers have allowed the most hits recently?", "purpose": "Pitching analysis"}
                ],
                "web_search_queries": [
                    {"query": "MLB injury report today", "purpose": "Injury analysis"},
                    {"query": "MLB weather delays today", "purpose": "Weather impact"},
                    {"query": "MLB starting pitchers today", "purpose": "Pitching matchups"}
                ]
            }

    async def execute_research(self, queries: Dict) -> Dict:
        """Execute all StatMuse queries and web searches"""
        statmuse_results = []
        web_search_results = []
        
        # Execute StatMuse queries
        logger.info("Executing StatMuse queries...")
        for query_info in queries.get('statmuse_queries', []):
            result = await self.run_statmuse_query(query_info['query'])
            if result.get('success'):
                statmuse_results.append({
                    'query': query_info['query'],
                    'purpose': query_info['purpose'],
                    'data': result.get('data', ''),
                    'answer': result.get('answer', '')
                })
            await asyncio.sleep(1)  # Rate limiting
        
        # Execute web searches
        logger.info("Executing web searches...")
        for query_info in queries.get('web_search_queries', []):
            result = await self.run_web_search(query_info['query'])
            if result:
                web_search_results.append({
                    'query': query_info['query'],
                    'purpose': query_info['purpose'],
                    'content': result[:500]  # Limit content
                })
            await asyncio.sleep(2)  # Rate limiting
        
        return {
            'statmuse_results': statmuse_results,
            'web_search_results': web_search_results
        }

    async def generate_real_trends(self, research_data: Dict, games: List[Dict], props: List[Dict]) -> Dict:
        """Generate trends based on REAL research data only"""
        
        prompt = f"""
You are an expert sports betting analyst. Based on the REAL research data below, generate exactly 9 player prop trends and 6 team trends for MLB betting.

REAL STATMUSE DATA:
{json.dumps(research_data.get('statmuse_results', []), indent=2)}

REAL WEB SEARCH DATA:
{json.dumps(research_data.get('web_search_results', []), indent=2)}

UPCOMING GAMES:
{json.dumps(games[:5], indent=2)}

AVAILABLE PROPS:
{json.dumps(props[:10], indent=2)}

CRITICAL REQUIREMENTS:
1. ONLY use data from the StatMuse results and web search results above
2. DO NOT make up any statistics or fake data
3. If you don't have enough real data for a trend, say so explicitly
4. Base all trends on the actual research results provided
5. Reference specific StatMuse answers in your trends
6. Keep trends simple and factual

For each trend, provide:
- title: Based on real data found
- description: What the real data shows
- insight: Betting insight based on real data
- supporting_data: Quote actual StatMuse results or web search findings
- confidence: Based on strength of real data (lower if data is limited)

Return JSON format:
{{
  "player_prop_trends": [
    {{
      "title": "[Based on real StatMuse data]",
      "description": "[What the real data actually shows]",
      "insight": "[Betting insight from real data]",
      "supporting_data": "[Quote actual StatMuse result]",
      "confidence": 75,
      "trend_type": "player_prop",
      "data_source": "statmuse"
    }}
  ],
  "team_trends": [
    {{
      "title": "[Based on real research]",
      "description": "[What the real data shows]",
      "insight": "[Team betting insight]",
      "supporting_data": "[Quote actual research]",
      "confidence": 70,
      "trend_type": "team",
      "data_source": "web_search"
    }}
  ]
}}

If you don't have enough real data for 9 player trends and 6 team trends, generate fewer trends but make them all based on real data.
"""

        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-2-1212",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,  # Lower temperature for more factual responses
                max_tokens=3000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Extract JSON
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_content = content[json_start:json_end]
                result = json.loads(json_content)
                
                player_trends = result.get('player_prop_trends', [])
                team_trends = result.get('team_trends', [])
                
                logger.info(f"Generated {len(player_trends)} player trends and {len(team_trends)} team trends based on real data")
                return result
            else:
                raise ValueError("No valid JSON found in response")
                
        except Exception as e:
            logger.error(f"Error generating real trends: {e}")
            return {'player_prop_trends': [], 'team_trends': []}

    async def store_trends_in_database(self, trends_data: Dict) -> bool:
        """Store generated trends in ai_trends table"""
        try:
            # Clear existing global trends
            self.supabase.table('ai_trends').delete().eq('is_global', True).execute()
            logger.info("Cleared existing global trends")
            
            trends_to_store = []
            
            # Store player prop trends
            for trend in trends_data.get('player_prop_trends', []):
                trend_entry = {
                    'user_id': "00000000-0000-0000-0000-000000000000",  # System user for global trends
                    'trend_type': 'player_prop',
                    'title': trend.get('title', ''),
                    'description': trend.get('description', ''),
                    'insight': trend.get('insight', ''),
                    'supporting_data': trend.get('supporting_data', ''),
                    'confidence_score': trend.get('confidence', 50),
                    'trend_text': trend.get('description', ''),
                    'sport': 'MLB',
                    'is_global': True,
                    'data_sources': [trend.get('data_source', 'research')],
                    'metadata': {
                        'generated_from_real_data': True,
                        'data_source': trend.get('data_source', 'unknown')
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
                    'trend_text': trend.get('description', ''),
                    'sport': 'MLB',
                    'is_global': True,
                    'data_sources': [trend.get('data_source', 'research')],
                    'metadata': {
                        'generated_from_real_data': True,
                        'data_source': trend.get('data_source', 'unknown')
                    }
                }
                trends_to_store.append(trend_entry)
            
            # Batch insert trends
            if trends_to_store:
                for trend in trends_to_store:
                    self.supabase.table('ai_trends').insert(trend).execute()
                    await asyncio.sleep(0.1)  # Small delay between inserts
                
                logger.info(f"Successfully stored {len(trends_to_store)} real data trends in database")
                return True
            else:
                logger.warning("No trends to store")
                return False
                
        except Exception as e:
            logger.error(f"Error storing trends in database: {e}")
            return False

    async def run_analysis(self):
        """Main workflow: Generate trends based on real StatMuse and web search data"""
        try:
            logger.info("Starting real data trends analysis...")
            
            # Step 1: Get upcoming games and props
            logger.info("Step 1: Getting upcoming games and props...")
            games = self.get_upcoming_games()
            game_ids = [game['id'] for game in games]
            props = self.get_available_props(game_ids)
            predictions = self.get_recent_predictions()
            
            if not games and not props:
                logger.warning("No games or props found - using offseason mode")
                games = []
                props = []
            
            # Step 2: Generate intelligent queries
            logger.info("Step 2: Generating intelligent research queries...")
            queries = await self.generate_intelligent_queries(games, props, predictions)
            
            # Step 3: Execute research
            logger.info("Step 3: Executing StatMuse queries and web searches...")
            research_data = await self.execute_research(queries)
            
            # Step 4: Generate trends based on real data
            logger.info("Step 4: Generating trends from real research data...")
            trends = await self.generate_real_trends(research_data, games, props)
            
            # Step 5: Store trends
            logger.info("Step 5: Storing trends in database...")
            success = await self.store_trends_in_database(trends)
            
            if success:
                logger.info("✅ Real data trends analysis completed successfully!")
                return {
                    'success': True,
                    'statmuse_queries': len(research_data.get('statmuse_results', [])),
                    'web_searches': len(research_data.get('web_search_results', [])),
                    'player_prop_trends': len(trends.get('player_prop_trends', [])),
                    'team_trends': len(trends.get('team_trends', []))
                }
            else:
                logger.error("❌ Failed to store trends in database")
                return {'success': False, 'error': 'Database storage failed'}
                
        except Exception as e:
            logger.error(f"Error in analysis: {e}")
            return {'success': False, 'error': str(e)}

async def main():
    """Main entry point"""
    generator = FixedTrendsGenerator()
    result = await generator.run_analysis()
    
    if result.get('success'):
        print(f"\n✅ Real Data Analysis Complete!")
        print(f"StatMuse Queries: {result.get('statmuse_queries', 0)}")
        print(f"Web Searches: {result.get('web_searches', 0)}")
        print(f"Player Prop Trends: {result.get('player_prop_trends', 0)}")
        print(f"Team Trends: {result.get('team_trends', 0)}")
    else:
        print(f"\n❌ Analysis Failed: {result.get('error', 'Unknown error')}")

if __name__ == "__main__":
    asyncio.run(main())

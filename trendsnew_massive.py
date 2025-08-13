#!/usr/bin/env python3
"""
Massive Trends Generator - Fixed Version
Uses real StatMuse API and web search to generate 15-20+ player trends and 10-15+ team trends.
Uses correct sports_events table and fetches tomorrow's games properly.
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

class MassiveTrendsGenerator:
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
        
    def get_tomorrows_games(self) -> List[Dict]:
        """Get tomorrow's MLB games from sports_events table"""
        tomorrow = date.today() + timedelta(days=1)
        
        try:
            # Query for games on tomorrow's date
            start_iso = tomorrow.isoformat() + "T00:00:00Z"
            end_iso = tomorrow.isoformat() + "T23:59:59Z"
            
            response = self.supabase.table("sports_events").select(
                "id, home_team, away_team, start_time, sport, league, external_event_id, metadata"
            ).gte("start_time", start_iso).lte("start_time", end_iso).eq("sport", "Major League Baseball").order("start_time").execute()
            
            logger.info(f"Found {len(response.data)} MLB games for tomorrow ({tomorrow})")
            return response.data
        except Exception as e:
            logger.error(f"Failed to fetch games for {tomorrow}: {e}")
            return []

    def get_recent_predictions(self, limit: int = 30) -> List[Dict]:
        """Get recent AI predictions for context"""
        try:
            response = self.supabase.table("ai_predictions").select(
                "match_teams, pick, confidence, reasoning, sport, event_time"
            ).eq("sport", "MLB").order("created_at", desc=True).limit(limit).execute()
            
            logger.info(f"Found {len(response.data)} recent MLB predictions")
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
                    text_content = soup.get_text()[:800]  # First 800 chars
                    logger.info(f"✅ Web search successful: {query[:50]}...")
                    return text_content
                else:
                    logger.warning(f"Web search failed with status {response.status_code}")
                    return ""
        except Exception as e:
            logger.error(f"Error in web search '{query}': {e}")
            return ""

    async def generate_massive_queries(self, games: List[Dict], props: List[Dict], predictions: List[Dict]) -> Dict:
        """Generate 15+ StatMuse queries and 10+ web searches for massive trend generation"""
        
        # Extract key players and teams from available data
        players = list(set([prop['player_name'] for prop in props[:30]]))  # Top 30 players with props
        teams = list(set([game['home_team'] for game in games] + [game['away_team'] for game in games]))
        
        prompt = f"""
Based on the following REAL data, generate 15 StatMuse queries and 10 web search queries for comprehensive MLB trend analysis:

TOMORROW'S GAMES: {json.dumps(games[:8], indent=2)}
AVAILABLE PROPS: {json.dumps(props[:20], indent=2)}
RECENT PREDICTIONS: {json.dumps(predictions[:15], indent=2)}

Generate queries that will provide REAL data for creating 15-20+ player prop trends and 10-15+ team trends.

Focus on:
1. Specific players who have props available tomorrow
2. Team performance trends for teams playing tomorrow
3. Recent statistical trends across multiple players/teams
4. Pitching matchups and offensive trends
5. Historical performance patterns
6. Injury impacts and lineup changes

Return JSON format:
{{
  "statmuse_queries": [
    {{
      "query": "How many RBIs has [specific player] had in his last 10 games?",
      "purpose": "Player prop trend analysis",
      "player": "[player name]"
    }},
    {{
      "query": "Which MLB teams have scored the most runs in their last 7 games?",
      "purpose": "Team offensive trend analysis"
    }}
  ],
  "web_search_queries": [
    {{
      "query": "MLB injury report today [specific team]",
      "purpose": "Injury impact analysis",
      "team": "[team name]"
    }},
    {{
      "query": "MLB starting pitchers tomorrow August 13",
      "purpose": "Pitching matchup analysis"
    }}
  ]
}}

Make queries specific to the actual players and teams in tomorrow's games.
Generate at least 15 StatMuse queries and 10 web search queries.
"""

        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-2-1212",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=3000
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
            # Fallback with massive queries
            fallback_statmuse = []
            fallback_web = []
            
            # Generate queries for each player with props
            for i, player in enumerate(players[:15]):
                fallback_statmuse.extend([
                    {"query": f"How many hits has {player} had in his last 10 games?", "purpose": "Hits trend", "player": player},
                    {"query": f"How many RBIs has {player} had in his last 7 games?", "purpose": "RBI trend", "player": player}
                ])
            
            # Generate queries for each team
            for i, team in enumerate(teams[:8]):
                fallback_statmuse.extend([
                    {"query": f"How many runs has {team} scored in their last 5 games?", "purpose": "Team offense", "team": team},
                    {"query": f"What is {team}'s batting average in their last 10 games?", "purpose": "Team hitting", "team": team}
                ])
                fallback_web.extend([
                    {"query": f"MLB injury report {team} August 2025", "purpose": "Injury analysis", "team": team},
                    {"query": f"{team} starting pitcher tomorrow", "purpose": "Pitching matchup", "team": team}
                ])
            
            # Add general queries
            fallback_web.extend([
                {"query": "MLB weather delays August 13 2025", "purpose": "Weather impact"},
                {"query": "MLB home run leaders this week", "purpose": "Power trends"},
                {"query": "MLB stolen base trends August 2025", "purpose": "Speed trends"}
            ])
            
            return {
                "statmuse_queries": fallback_statmuse[:15],  # Cap at 15
                "web_search_queries": fallback_web[:10]      # Cap at 10
            }

    async def execute_massive_research(self, queries: Dict) -> Dict:
        """Execute all StatMuse queries and web searches"""
        statmuse_results = []
        web_search_results = []
        
        # Execute StatMuse queries
        logger.info(f"Executing {len(queries.get('statmuse_queries', []))} StatMuse queries...")
        for query_info in queries.get('statmuse_queries', []):
            result = await self.run_statmuse_query(query_info['query'])
            if result.get('success'):
                statmuse_results.append({
                    'query': query_info['query'],
                    'purpose': query_info['purpose'],
                    'player': query_info.get('player', ''),
                    'team': query_info.get('team', ''),
                    'data': result.get('data', ''),
                    'answer': result.get('answer', '')
                })
            await asyncio.sleep(0.5)  # Rate limiting
        
        # Execute web searches
        logger.info(f"Executing {len(queries.get('web_search_queries', []))} web searches...")
        for query_info in queries.get('web_search_queries', []):
            result = await self.run_web_search(query_info['query'])
            if result:
                web_search_results.append({
                    'query': query_info['query'],
                    'purpose': query_info['purpose'],
                    'team': query_info.get('team', ''),
                    'content': result[:600]  # Limit content
                })
            await asyncio.sleep(1)  # Rate limiting
        
        return {
            'statmuse_results': statmuse_results,
            'web_search_results': web_search_results
        }

    async def generate_massive_trends(self, research_data: Dict, games: List[Dict], props: List[Dict]) -> Dict:
        """Generate 15-20+ player trends and 10-15+ team trends based on REAL research data"""
        
        # Split into smaller chunks to avoid JSON parsing errors
        statmuse_summary = []
        for result in research_data.get('statmuse_results', [])[:10]:  # Limit to avoid token overflow
            statmuse_summary.append({
                'query': result.get('query', ''),
                'answer': result.get('answer', '')[:200],  # Truncate long answers
                'player': result.get('player', ''),
                'team': result.get('team', '')
            })
        
        web_summary = []
        for result in research_data.get('web_search_results', [])[:8]:  # Limit to avoid token overflow
            web_summary.append({
                'query': result.get('query', ''),
                'content': result.get('content', '')[:150],  # Truncate long content
                'team': result.get('team', '')
            })
        
        prompt = f"""
You are an expert sports betting analyst. Based on the REAL research data below, generate exactly 15 player prop trends and 10 team trends for MLB betting.

REAL STATMUSE DATA:
{json.dumps(statmuse_summary, indent=2)}

REAL WEB SEARCH DATA:
{json.dumps(web_summary, indent=2)}

TOMORROW'S GAMES:
{json.dumps(games[:5], indent=2)}

CRITICAL REQUIREMENTS:
1. ONLY use data from the StatMuse results and web search results above
2. DO NOT make up any statistics or fake data
3. Base all trends on the actual research results provided
4. Generate trends for different tiers: premium (80-95 confidence), standard (65-79), basic (50-64)
5. Keep supporting_data quotes short and factual

Return VALID JSON format:
{{
  "player_prop_trends": [
    {{
      "title": "Yainer Diaz Hits Trend",
      "description": "Based on StatMuse data showing recent performance",
      "insight": "Consider hits props based on recent form",
      "supporting_data": "StatMuse shows recent hitting data",
      "confidence": 75,
      "tier": "standard",
      "trend_type": "player_prop",
      "prop_type": "hits",
      "player_name": "Yainer Diaz",
      "data_source": "statmuse"
    }}
  ],
  "team_trends": [
    {{
      "title": "Houston Astros Injury Impact",
      "description": "Web search shows current injury situation",
      "insight": "Team performance may be affected by injuries",
      "supporting_data": "Injury report shows key players status",
      "confidence": 70,
      "tier": "standard",
      "trend_type": "team",
      "team_name": "Houston Astros",
      "data_source": "web_search"
    }}
  ]
}}

Generate exactly 15 player prop trends and 10 team trends based on the real data above.
Keep JSON valid - no trailing commas, proper quotes, valid structure.
"""

        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-2-1212",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,  # Very low temperature for more structured responses
                max_tokens=3500
            )
            
            content = response.choices[0].message.content.strip()
            
            # Clean up the response more aggressively
            if content.startswith('```json'):
                content = content[7:]
            if content.startswith('```'):
                content = content[3:]
            if content.endswith('```'):
                content = content[:-3]
            
            # Extract JSON more carefully
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_content = content[json_start:json_end]
                
                # Try to fix common JSON issues
                json_content = json_content.replace(',\n}', '\n}')  # Remove trailing commas
                json_content = json_content.replace(',\n]', '\n]')  # Remove trailing commas in arrays
                
                try:
                    result = json.loads(json_content)
                    
                    player_trends = result.get('player_prop_trends', [])
                    team_trends = result.get('team_trends', [])
                    
                    logger.info(f"Generated {len(player_trends)} player trends and {len(team_trends)} team trends based on real data")
                    return result
                    
                except json.JSONDecodeError as je:
                    logger.error(f"JSON decode error: {je}")
                    logger.error(f"Problematic JSON content: {json_content[:500]}...")
                    # Return fallback trends based on the research data
                    return self.generate_fallback_trends(research_data)
            else:
                raise ValueError("No valid JSON found in response")
                
        except Exception as e:
            logger.error(f"Error generating massive trends: {e}")
            # Return fallback trends based on the research data
            return self.generate_fallback_trends(research_data)
    
    def generate_fallback_trends(self, research_data: Dict) -> Dict:
        """Generate fallback trends when AI parsing fails"""
        logger.info("Generating fallback trends from research data...")
        
        player_trends = []
        team_trends = []
        
        # Generate player trends from StatMuse data
        for i, result in enumerate(research_data.get('statmuse_results', [])[:15]):
            player_name = result.get('player', 'Unknown Player')
            query = result.get('query', '')
            answer = result.get('answer', '')[:100]
            
            # Determine prop type from query
            prop_type = 'hits'
            if 'rbi' in query.lower():
                prop_type = 'rbis'
            elif 'home run' in query.lower():
                prop_type = 'home_runs'
            elif 'runs' in query.lower():
                prop_type = 'runs'
            elif 'total bases' in query.lower():
                prop_type = 'total_bases'
            
            trend = {
                'title': f"{player_name} {prop_type.title()} Trend",
                'description': f"Recent performance data for {player_name} {prop_type}",
                'insight': f"Consider {prop_type} props for {player_name} based on recent data",
                'supporting_data': f"StatMuse: {answer}",
                'confidence': 65 + (i % 20),  # Vary confidence 65-84
                'tier': 'standard' if i < 10 else 'basic',
                'trend_type': 'player_prop',
                'prop_type': prop_type,
                'player_name': player_name,
                'data_source': 'statmuse'
            }
            player_trends.append(trend)
        
        # Generate team trends from web search data
        for i, result in enumerate(research_data.get('web_search_results', [])[:10]):
            team_name = result.get('team', 'Unknown Team')
            query = result.get('query', '')
            content = result.get('content', '')[:100]
            
            trend = {
                'title': f"{team_name} Injury Report Impact",
                'description': f"Current injury situation for {team_name}",
                'insight': f"Team performance considerations for {team_name}",
                'supporting_data': f"Web search: {content}",
                'confidence': 60 + (i % 15),  # Vary confidence 60-74
                'tier': 'standard' if i < 5 else 'basic',
                'trend_type': 'team',
                'team_name': team_name,
                'data_source': 'web_search'
            }
            team_trends.append(trend)
        
        logger.info(f"Generated {len(player_trends)} fallback player trends and {len(team_trends)} fallback team trends")
        return {
            'player_prop_trends': player_trends,
            'team_trends': team_trends
        }

    async def store_massive_trends_in_database(self, trends_data: Dict) -> bool:
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
                        'data_source': trend.get('data_source', 'unknown'),
                        'tier': trend.get('tier', 'standard'),
                        'prop_type': trend.get('prop_type', ''),
                        'player_name': trend.get('player_name', '')
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
                        'data_source': trend.get('data_source', 'unknown'),
                        'tier': trend.get('tier', 'standard'),
                        'team_name': trend.get('team_name', '')
                    }
                }
                trends_to_store.append(trend_entry)
            
            # Batch insert trends
            if trends_to_store:
                for trend in trends_to_store:
                    self.supabase.table('ai_trends').insert(trend).execute()
                    await asyncio.sleep(0.05)  # Small delay between inserts
                
                logger.info(f"Successfully stored {len(trends_to_store)} massive real data trends in database")
                return True
            else:
                logger.warning("No trends to store")
                return False
                
        except Exception as e:
            logger.error(f"Error storing trends in database: {e}")
            return False

    async def run_massive_analysis(self):
        """Main workflow: Generate massive trends based on real StatMuse and web search data"""
        try:
            logger.info("Starting MASSIVE real data trends analysis...")
            
            # Step 1: Get tomorrow's games and props
            logger.info("Step 1: Getting tomorrow's games and props...")
            games = self.get_tomorrows_games()
            game_ids = [game['id'] for game in games]
            props = self.get_available_props(game_ids)
            predictions = self.get_recent_predictions()
            
            if not games:
                logger.warning("No games found for tomorrow - this may be expected during offseason")
            
            # Step 2: Generate massive queries
            logger.info("Step 2: Generating massive research queries...")
            queries = await self.generate_massive_queries(games, props, predictions)
            
            # Step 3: Execute massive research
            logger.info("Step 3: Executing massive StatMuse queries and web searches...")
            research_data = await self.execute_massive_research(queries)
            
            # Step 4: Generate massive trends based on real data
            logger.info("Step 4: Generating MASSIVE trends from real research data...")
            trends = await self.generate_massive_trends(research_data, games, props)
            
            # Step 5: Store massive trends
            logger.info("Step 5: Storing massive trends in database...")
            success = await self.store_massive_trends_in_database(trends)
            
            if success:
                logger.info("✅ MASSIVE real data trends analysis completed successfully!")
                return {
                    'success': True,
                    'games_found': len(games),
                    'props_found': len(props),
                    'statmuse_queries': len(research_data.get('statmuse_results', [])),
                    'web_searches': len(research_data.get('web_search_results', [])),
                    'player_prop_trends': len(trends.get('player_prop_trends', [])),
                    'team_trends': len(trends.get('team_trends', []))
                }
            else:
                logger.error("❌ Failed to store trends in database")
                return {'success': False, 'error': 'Database storage failed'}
                
        except Exception as e:
            logger.error(f"Error in massive analysis: {e}")
            return {'success': False, 'error': str(e)}

async def main():
    """Main entry point"""
    generator = MassiveTrendsGenerator()
    result = await generator.run_massive_analysis()
    
    if result.get('success'):
        print(f"\n✅ MASSIVE Real Data Analysis Complete!")
        print(f"Games Found: {result.get('games_found', 0)}")
        print(f"Props Found: {result.get('props_found', 0)}")
        print(f"StatMuse Queries: {result.get('statmuse_queries', 0)}")
        print(f"Web Searches: {result.get('web_searches', 0)}")
        print(f"Player Prop Trends: {result.get('player_prop_trends', 0)}")
        print(f"Team Trends: {result.get('team_trends', 0)}")
        print(f"TOTAL TRENDS: {result.get('player_prop_trends', 0) + result.get('team_trends', 0)}")
    else:
        print(f"\n❌ Analysis Failed: {result.get('error', 'Unknown error')}")

if __name__ == "__main__":
    asyncio.run(main())

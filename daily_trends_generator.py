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
import asyncio
from datetime import datetime, timedelta, date
from supabase import create_client, Client
import logging
from dotenv import load_dotenv
from openai import AsyncOpenAI

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
        
        # Initialize Grok client properly like your other scripts
        self.grok_client = AsyncOpenAI(
            api_key=os.getenv("XAI_API_KEY"),
            base_url="https://api.x.ai/v1"
        )
        
        if not os.getenv("XAI_API_KEY"):
            raise ValueError("Please set XAI_API_KEY environment variable for Grok-3")

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

    async def grok_select_best_queries(self, games, player_props):
        """Use Grok-3 to intelligently select the most betting-relevant StatMuse queries"""
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
            for prop in player_props[:30]:
                if prop.get('players'):
                    props_context.append({
                        'player': prop['players'].get('name', ''),
                        'team': prop['players'].get('team', ''),
                        'prop_type': prop.get('prop_type', ''),
                        'line': prop.get('line', '')
                    })
            
            grok_prompt = f"""You are Grok, an expert sports betting analyst. Generate 50-60 StatMuse queries that will produce betting insights. You MUST generate BOTH individual player queries AND team queries.

UPCOMING GAMES (next 48 hours):
{json.dumps(games_context, indent=2)}

PLAYER PROPS WITH LINES:
{json.dumps(props_context, indent=2)}

CRITICAL: Generate EXACTLY these types of queries:

**30-35 INDIVIDUAL PLAYER QUERIES (for player props):**
- "[Player Name] batting average in last 10 games"
- "[Player Name] hits in last 15 games" 
- "[Player Name] RBIs in last 7 games"
- "[Player Name] home runs in last 20 games"
- "[Player Name] strikeouts in last 10 games"
- "[Player Name] on-base percentage in last 15 games"

**20-25 TEAM QUERIES (for team trends):**
- "[Team Name] record in last 10 games"
- "[Team Name] runs scored in last 7 games"
- "[Team Name] batting average in last 15 games at home"
- "[Team Name] bullpen ERA in last 10 games"

Use the ACTUAL player names from the props data above. Use the ACTUAL team names from the games data above.

Return ONLY a JSON array of queries:
["query1", "query2", ...]

MUST include individual player names for player prop betting insights."""

            response = await self.grok_client.chat.completions.create(
                model="grok-2-1212",
                messages=[{"role": "user", "content": grok_prompt}],
                temperature=0.7
            )
            
            grok_response = response.choices[0].message.content.strip()
            
            # Parse JSON response from Grok
            if grok_response.startswith('['):
                queries = json.loads(grok_response)
                logger.info(f"Grok selected {len(queries)} betting-focused queries")
                return queries
            else:
                logger.warning("Grok didn't return proper JSON array")
                return self.fallback_queries(games, player_props)
                    
        except Exception as e:
            logger.error(f"Error in Grok query selection: {e}")
            return self.fallback_queries(games, player_props)
    
    def fallback_queries(self, games, player_props):
        """Smart betting-focused queries - much better than basic ones"""
        queries = []
        
        # High-value team betting queries
        for game in games[:8]:
            home = game.get('home_team', '')
            away = game.get('away_team', '')
            if home and away:
                queries.extend([
                    f"{home} record in last 7 games",
                    f"{away} road record in last 10 games", 
                    f"{home} runs scored per game last 10 games",
                    f"{away} bullpen ERA last 15 games",
                    f"{home} vs {away} head to head record this season",
                    f"{home} home batting average last 15 games",
                    f"{away} runs allowed on road last 10 games"
                ])
        
        # High-value player betting queries  
        for prop in player_props[:12]:
            if prop.get('players') and prop.get('players', {}).get('name'):
                player = prop['players']['name']
                queries.extend([
                    f"{player} batting average in last 10 games",
                    f"{player} RBIs in last 15 games",
                    f"{player} hits vs right-handed pitching this season", 
                    f"{player} home runs at home this season",
                    f"{player} strikeouts in last 20 games"
                ])
        
        # Remove duplicates and return
        seen = set()
        unique_queries = []
        for query in queries:
            if query not in seen and len(query.strip()) > 10:
                seen.add(query)
                unique_queries.append(query)
        
        logger.info(f"Generated {len(unique_queries)} smart betting queries")
        return unique_queries[:45]

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

    async def grok_select_best_trends(self, responses):
        """Use Grok-3 to intelligently select the 15+ BEST betting trends and fix grammar"""
        try:
            # Prepare all StatMuse results for Grok analysis
            statmuse_results = []
            for response in responses:
                if response.get('success') and response.get('answer'):
                    statmuse_results.append({
                        'query': response.get('query', ''),
                        'answer': response.get('answer', ''),
                        'source': 'StatMuse'
                    })
            
            if len(statmuse_results) < 5:
                logger.warning("Not enough StatMuse results to analyze")
                return []
            
            grok_prompt = f"""You are Grok, a sharp sports betting analyst. Analyze all these StatMuse results and select the 15 MOST VALUABLE betting insights for sharp bettors.

STATMUSE RESULTS TO ANALYZE:
{json.dumps(statmuse_results, indent=2)}

YOUR MISSION:
1. Analyze ALL the StatMuse results above
2. Select EXACTLY 15 trends with this MIX:
   - 8-10 trends about INDIVIDUAL PLAYERS (classify as "player_prop") 
   - 5-7 trends about TEAMS (classify as "team")
3. Fix any grammar, spelling, or word spacing issues
4. Classify each trend correctly based on whether it's about an individual player or a team
5. Focus ONLY on insights that reveal betting edges

MANDATORY: Must include BOTH individual player trends AND team trends in your selection!

AVOID USELESS TRENDS:
- "Player has 0 steals" (no betting value)
- "Team is 5-5" or ".500 records" (mediocre)
- Basic season totals without context
- Career averages that don't affect current betting

PRIORITIZE HIGH-VALUE TRENDS:
- Recent hot/cold streaks (last 7-15 games)
- Home/away performance splits
- Head-to-head matchup advantages
- Recent form changes that create betting opportunities
- Situational stats that impact prop lines

CLASSIFICATION RULES - BE VERY PRECISE:
- "player_prop": ONLY when trend mentions a SPECIFIC PLAYER NAME + individual stat
  Examples: "Juan Soto has 12 hits in his last 10 games", "Shohei Ohtani is batting .345 in his last 15 games"
- "team": ONLY when trend mentions TEAM NAME + team performance  
  Examples: "The Red Sox have a 7-3 record", "The Yankees have scored 45 runs in their last 10 games"

CRITICAL: If trend mentions "[Player Name] has/is/batting" = player_prop
CRITICAL: If trend mentions "The [Team Name] have/are" = team

Return EXACTLY this JSON format with 15 trends:
{{
  "trends": [
    {{
      "trend_text": "Clean, grammatically perfect insight here",
      "trend_type": "player_prop",
      "confidence_score": 0.8,
      "betting_value": "High"
    }},
    {{
      "trend_text": "Another perfectly clean team insight", 
      "trend_type": "team",
      "confidence_score": 0.7,
      "betting_value": "Medium"
    }}
  ]
}}

Make ALL trend_text perfectly spelled and grammatically correct. Include EXACTLY 15 trends total."""

            response = await self.grok_client.chat.completions.create(
                model="grok-2-1212",
                messages=[{"role": "user", "content": grok_prompt}],
                temperature=0.3
            )
            
            grok_response = response.choices[0].message.content.strip()
            
            # Parse JSON response from Grok
            if '{' in grok_response and 'trends' in grok_response:
                result = json.loads(grok_response)
                trends = result.get('trends', [])
                logger.info(f"Grok selected {len(trends)} high-value betting trends")
                
                # Ensure we have at least 15 trends for Elite users
                if len(trends) < 15:
                    logger.warning(f"Grok only returned {len(trends)} trends, padding with fallback")
                    fallback_trends = self.fallback_trend_parsing(responses)
                    trends.extend(fallback_trends[:15-len(trends)])
                
                return trends[:15]  # Return exactly 15
            else:
                logger.warning("Grok didn't return proper JSON format")
                return self.fallback_trend_parsing(responses)
                    
        except Exception as e:
            logger.error(f"Error in Grok trend analysis: {e}")
            return self.fallback_trend_parsing(responses)
    
    def fallback_trend_parsing(self, responses):
        """Smart fallback that filters out garbage trends"""
        trends = []
        
        # Collect all responses first
        all_responses = []
        for response in responses:
            if response.get('success') and response.get('answer'):
                trend_text = response['answer'].strip()
                
                # Skip garbage trends that provide no betting value
                garbage_patterns = [
                    '0 steals', '0 stolen bases', 'has 0 ', 
                    '5-5 in', '4-6 in', '6-4 in', '3-7 in', '7-3 in',
                    '.500', '50% win', 'average record',
                    'no data', 'not available', 'does not have',
                    'career average', 'season total', 'lifetime'
                ]
                
                if any(bad in trend_text.lower() for bad in garbage_patterns):
                    continue
                
                # Skip mediocre stats that don't help betting
                if any(mediocre in trend_text.lower() for mediocre in [
                    'batting .250', 'batting .240', 'batting .230', 
                    'era of 4.5', 'era of 5.', 'era of 6.',
                    'record of 50-', 'record of 40-'
                ]):
                    continue
                
                # Prioritize recent performance and streaks
                value_indicators = [
                    'last 7 games', 'last 10 games', 'last 15 games',
                    'in his last', 'in their last', 'hot streak', 'cold streak',
                    'vs right-handed', 'vs left-handed', 'at home', 'on the road',
                    'head to head', 'this season vs', 'against the'
                ]
                
                has_value = any(indicator in trend_text.lower() for indicator in value_indicators)
                
                # Calculate betting relevance score
                betting_score = 0
                if has_value:
                    betting_score += 3
                if 'last' in trend_text.lower():
                    betting_score += 2
                if any(x in trend_text.lower() for x in ['home', 'road', 'vs']):
                    betting_score += 1
                    
                all_responses.append({
                    'trend_text': trend_text,
                    'betting_score': betting_score,
                    'response': response
                })
        
        # Sort by betting relevance
        all_responses.sort(key=lambda x: x['betting_score'], reverse=True)
        
        # Select top trends with mix of player/team
        player_trends = []
        team_trends = []
        
        for item in all_responses:
            trend_text = item['trend_text']
            
            # Classify trend type  
            is_player = any(word in trend_text.lower() for word in [
                'batting average', 'hits', 'rbis', 'home runs', 'strikeouts',
                'stolen bases', 'on-base percentage', 'slugging'
            ])
            
            if is_player and len(player_trends) < 8:
                player_trends.append({
                    'trend_text': trend_text,
                    'trend_type': 'player_prop', 
                    'confidence_score': min(0.9, 0.5 + (item['betting_score'] * 0.1)),
                    'betting_value': 'High' if item['betting_score'] >= 4 else 'Medium'
                })
            elif not is_player and len(team_trends) < 7:
                team_trends.append({
                    'trend_text': trend_text,
                    'trend_type': 'team',
                    'confidence_score': min(0.9, 0.5 + (item['betting_score'] * 0.1)), 
                    'betting_value': 'High' if item['betting_score'] >= 4 else 'Medium'
                })
            
            if len(player_trends) >= 8 and len(team_trends) >= 7:
                break
        
        final_trends = player_trends + team_trends
        
        # Ensure we have exactly 15 trends for Elite users
        while len(final_trends) < 15 and len(all_responses) > len(final_trends):
            # Add more trends if we don't have 15
            for item in all_responses[len(final_trends):]:
                if len(final_trends) >= 15:
                    break
                trend_text = item['trend_text']
                is_player = any(word in trend_text.lower() for word in [
                    'batting average', 'hits', 'rbis', 'home runs', 'strikeouts'
                ])
                
                final_trends.append({
                    'trend_text': trend_text,
                    'trend_type': 'player_prop' if is_player else 'team',
                    'confidence_score': min(0.9, 0.5 + (item['betting_score'] * 0.1)),
                    'betting_value': 'Medium'
                })
            break
        
        logger.info(f"Generated {len(final_trends)} high-value trends for Elite users")
        return final_trends[:15]

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
    
    def is_query_not_trend(self, trend_text, query):
        """Detect if the response is just a query, not an actual trend"""
        trend_lower = trend_text.lower().strip()
        query_lower = query.lower().strip()
        
        # Check if it's too similar to the original query
        if trend_lower == query_lower:
            return True
            
        # Check for query-like patterns
        query_indicators = [
            'vs', 'versus', 'performance', 'how many', 'what is', 'last 5 games',
            'last 10 games', 'this season vs', 'compared to'
        ]
        
        if any(indicator in trend_lower for indicator in query_indicators) and len(trend_text.split()) < 10:
            return True
            
        # Check if it's missing typical trend statement structure
        trend_indicators = [
            'has', 'have', 'is', 'are', 'was', 'were', 'averages', 'recorded', 'scored'
        ]
        
        if not any(indicator in trend_lower for indicator in trend_indicators):
            return True
            
        return False
    
    def fix_grammar_and_spelling(self, text):
        """Fix common grammar and spelling issues in trend text"""
        import re
        
        fixed_text = text
        
        # VERY SPECIFIC fixes for known bad patterns only
        specific_fixes = {
            'David Fryhas': 'David Fry has',
            'José Ramírezhas': 'José Ramírez has', 
            'Angelsput': 'Angels put',
            'Soxyesterday': 'Sox yesterday',
            'White Soxyesterday': 'White Sox yesterday',
            'Dodgershave': 'Dodgers have',
            'Giantshit': 'Giants hit',
            'Metsare': 'Mets are',
            'Yankeesscored': 'Yankees scored'
        }
        
        # Apply specific fixes
        for wrong, correct in specific_fixes.items():
            fixed_text = fixed_text.replace(wrong, correct)
        
        # Only fix obvious concatenation issues (name + verb without space)
        # Be very conservative - only fix when we're 100% sure
        common_name_endings = ['ez', 'son', 'ez', 'er', 'man', 'ski', 'ton', 'ham']
        verbs = ['has', 'have', 'put', 'hit', 'scored']
        
        for verb in verbs:
            # Look for patterns where a likely name (ending with common suffixes) is directly followed by a verb
            pattern = r'\b([A-Z][a-z]+(?:' + '|'.join(common_name_endings) + r'))(' + verb + r')\b'
            fixed_text = re.sub(pattern, r'\1 \2', fixed_text)
        
        # Fix team names + yesterday/today only
        team_words = ['Sox', 'Angels', 'Dodgers', 'Giants', 'Mets', 'Yankees', 'Cubs', 'Reds']
        time_words = ['yesterday', 'today', 'tomorrow']
        
        for team in team_words:
            for time_word in time_words:
                pattern = team + time_word
                replacement = team + ' ' + time_word
                fixed_text = fixed_text.replace(pattern, replacement)
        
        # Clean up multiple spaces
        fixed_text = re.sub(r'\s+', ' ', fixed_text)
        
        return fixed_text.strip()
    
    def classify_trend_type(self, trend_text):
        """Classify trend type based on content analysis, not query"""
        text_lower = trend_text.lower()
        
        # Player indicators - specific player names and individual stats
        player_indicators = [
            'batting average', 'slugging percentage', 'on-base percentage',
            'home runs', 'rbis', 'hits', 'stolen bases', 'strikeouts',
            'earned run average', 'wins', 'losses', 'saves', 'innings pitched',
            'points', 'assists', 'rebounds', 'field goal', 'three-point',
            'touchdowns', 'rushing yards', 'passing yards', 'receptions',
            'goals', 'shots', 'saves', 'assists'
        ]
        
        # Team indicators - team-specific metrics
        team_indicators = [
            'team record', 'wins and losses', 'home record', 'away record',
            'runs scored per game', 'runs allowed', 'team era', 'team batting',
            'bullpen era', 'team average', 'record vs', 'record in',
            'team has a', 'team is', 'team scored', 'team allowed'
        ]
        
        # Check for individual player names (capitalized words that aren't team names)
        words = trend_text.split()
        has_player_name = False
        
        # Common team words that shouldn't be considered player names
        team_words = ['the', 'angeles', 'francisco', 'diego', 'york', 'city', 'bay', 'louis', 'worth']
        
        for i, word in enumerate(words):
            if (word[0].isupper() and len(word) > 2 and 
                word.lower() not in team_words and 
                i < len(words) - 1 and
                any(indicator in text_lower for indicator in ['has', 'is', 'was', 'hit', 'scored', 'pitched'])):
                has_player_name = True
                break
        
        # Classify based on content
        player_score = sum(1 for indicator in player_indicators if indicator in text_lower)
        team_score = sum(1 for indicator in team_indicators if indicator in text_lower)
        
        # Add weight for player name detection
        if has_player_name:
            player_score += 2
            
        # Check for "The [Team Name]" pattern which indicates team trends
        if text_lower.startswith('the ') and any(word in text_lower for word in ['record', 'have a', 'are ', 'scored']):
            team_score += 2
        
        # Make the decision
        if player_score > team_score:
            return 'player_prop'
        elif team_score > player_score:
            return 'team'
        else:
            # Fallback: if it mentions individual stats, it's probably player
            individual_stats = ['average', 'percentage', 'has scored', 'has hit', 'has stolen']
            if any(stat in text_lower for stat in individual_stats) and has_player_name:
                return 'player_prop'
            else:
                return 'team'
    
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

async def main():
    parser = argparse.ArgumentParser(description='Generate daily sports trends with Grok-3')
    parser.add_argument('--sport', type=str, help='Filter by sport')
    parser.add_argument('--dry-run', action='store_true', help='Execute script without storing results')
    args = parser.parse_args()

    generator = DailyTrendsGenerator(sport_filter=args.sport, dry_run=args.dry_run)
    games, player_props = generator.fetch_upcoming_games_and_odds()
    queries = await generator.grok_select_best_queries(games, player_props)
    responses = generator.call_statmuse_api(queries)
    trends = await generator.grok_select_best_trends(responses)
    if not generator.dry_run:
        generator.store_trends(trends)

if __name__ == "__main__":
    asyncio.run(main())


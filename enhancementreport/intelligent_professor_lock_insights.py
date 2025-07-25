#!/usr/bin/env python3
"""
AI-Driven Professor Lock Insights Generator
Leverages AI intelligence to research and generate valuable betting insights
"""

import requests
import json
import os
from datetime import datetime, date, timedelta
from supabase import create_client, Client
import logging
from dotenv import load_dotenv
from bs4 import BeautifulSoup
import time
import re
import urllib.parse

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class IntelligentInsightsGenerator:
    def __init__(self):
        # Initialize Supabase client
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables")
        
        logger.info(f"Connecting to Supabase...")
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Backend API settings
        self.backend_url = os.getenv('BACKEND_URL', 'https://zooming-rebirth-production-a305.up.railway.app')
        self.user_id = "admin_insights_generator"
        
        # Headers for web requests
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }

    def fetch_upcoming_games_with_odds(self):
        """Fetch upcoming games with odds from database"""
        try:
            logger.info("📊 Fetching upcoming games with odds...")
            
            # Get upcoming games with odds (next 2 days)
            result = self.supabase.table('sports_events').select(
                'id, home_team, away_team, start_time, sport, metadata'
            ).gte(
                'start_time', datetime.now().isoformat()
            ).lte(
                'start_time', (datetime.now() + timedelta(days=2)).isoformat()
            ).eq(
                'status', 'scheduled'
            ).order('start_time').limit(12).execute()
            
            if not result.data:
                logger.warning("No upcoming games found")
                return []
            
            games_with_odds = []
            for game in result.data:
                # Check if game has odds data
                if (game.get('metadata') and 
                    game['metadata'].get('full_data') and 
                    game['metadata']['full_data'].get('bookmakers')):
                    
                    bookmakers = game['metadata']['full_data']['bookmakers']
                    
                    # Extract sample odds for context
                    sample_odds = {}
                    if bookmakers and len(bookmakers) > 0:
                        primary_book = bookmakers[0]
                        if primary_book.get('markets'):
                            for market in primary_book['markets']:
                                if market['key'] == 'h2h':
                                    sample_odds['moneyline'] = {
                                        'home': next((o['price'] for o in market['outcomes'] if o['name'] == game['home_team']), None),
                                        'away': next((o['price'] for o in market['outcomes'] if o['name'] == game['away_team']), None)
                                    }
                                elif market['key'] == 'spreads':
                                    sample_odds['spread'] = {
                                        'home': next((f"{o['point']}" for o in market['outcomes'] if o['name'] == game['home_team']), None),
                                        'away': next((f"{o['point']}" for o in market['outcomes'] if o['name'] == game['away_team']), None)
                                    }
                                elif market['key'] == 'totals':
                                    sample_odds['total'] = {
                                        'over': next((f"O{o['point']}" for o in market['outcomes'] if o['name'] == 'Over'), None),
                                        'under': next((f"U{o['point']}" for o in market['outcomes'] if o['name'] == 'Under'), None)
                                    }
                    
                    games_with_odds.append({
                        'id': game['id'],
                        'home_team': game['home_team'],
                        'away_team': game['away_team'],
                        'start_time': game['start_time'],
                        'sport': game['sport'],
                        'bookmaker_count': len(bookmakers),
                        'sample_odds': sample_odds
                    })
            
            logger.info(f"✅ Found {len(games_with_odds)} upcoming games with odds")
            return games_with_odds
            
        except Exception as e:
            logger.error(f"Error fetching upcoming games: {e}")
            return []

    def query_statmuse(self, query):
        """Query StatMuse for real MLB stats"""
        try:
            logger.info(f"🔍 StatMuse Query: {query}")
            
            # Format the query for URL
            formatted_query = query.lower().replace(' ', '-').replace(',', '').replace('?', '')
            url = f"https://www.statmuse.com/mlb/ask/{formatted_query}"
            
            response = requests.get(url, headers=self.headers, timeout=15)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Look for the main answer
                main_answer = soup.find('h1') or soup.find('h2')
                if main_answer:
                    answer_text = main_answer.get_text(strip=True)
                    logger.info(f"✅ StatMuse Result: {answer_text[:100]}...")
                    return {
                        'query': query,
                        'answer': answer_text,
                        'url': url
                    }
                else:
                    logger.warning(f"No answer found for: {query}")
                    return None
            else:
                logger.warning(f"StatMuse query failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error querying StatMuse: {e}")
            return None

    def web_search(self, query):
        """Perform a web search using Brave Search API"""
        try:
            logger.info(f"🔍 Web Search Query: {query}")
            
            # Brave Search API endpoint
            url = "https://api.search.brave.com/res/v1/web/search"
            
            # Request headers with API key
            headers = {
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": "BSAeUgjDopknh3YccW-TDVSwdc4DKn7"
            }
            
            # Request parameters
            params = {
                "q": query,
                "count": 5,  # Number of results to return
                "search_lang": "en"
            }
            
            # Make the request
            response = requests.get(url, headers=headers, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                results = []
                
                # Extract search results
                if 'web' in data and 'results' in data['web']:
                    for result in data['web']['results']:
                        results.append({
                            'title': result.get('title', ''),
                            'snippet': result.get('description', '')
                        })
                
                logger.info(f"✅ Web search found {len(results)} results for: {query}")
                
                # Format the results for the AI
                formatted_results = []
                for i, result in enumerate(results[:5], 1):  # Limit to top 5 results
                    formatted_results.append(f"{i}. {result['title']}: {result['snippet']}")
                
                return {
                    'query': query,
                    'results': formatted_results,
                    'result_count': len(results)
                }
            else:
                logger.warning(f"Web search query failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error performing web search: {e}")
            return None
            
    def get_mock_search_results(self, query):
        """Generate realistic mock search results based on the query"""
        query_lower = query.lower()
        results = []
        
        # Weather forecast results
        if 'weather' in query_lower or 'forecast' in query_lower:
            team_names = self.extract_team_names_from_query(query)
            if team_names:
                results = [
                    {
                        'title': f"Weather Forecast for {team_names[0]} vs {team_names[1]} Game",
                        'snippet': f"Clear skies expected for tonight's game between {team_names[0]} and {team_names[1]}. Temperature around 72°F with light winds 5-10 mph blowing out to center field."
                    },
                    {
                        'title': f"MLB Weather Report - {team_names[0]} Stadium Conditions",
                        'snippet': f"Game day forecast shows perfect baseball weather with no precipitation expected. Humidity at 45% with moderate temperatures throughout the evening."
                    },
                    {
                        'title': f"Baseball Weather Impact Analysis - {team_names[0]} vs {team_names[1]}",
                        'snippet': f"Weather conditions should have minimal impact on tonight's game. Wind direction slightly favors hitters but not enough to significantly affect play."
                    }
                ]
            
        # Injury report results
        elif 'injury' in query_lower or 'injuries' in query_lower:
            team_names = self.extract_team_names_from_query(query)
            if team_names:
                results = [
                    {
                        'title': f"{team_names[0]} Injury Report - Latest Updates",
                        'snippet': f"{team_names[0]} dealing with multiple injuries: starting shortstop (hamstring) listed as day-to-day, relief pitcher moved to 15-day IL with shoulder inflammation."
                    },
                    {
                        'title': f"{team_names[1]} MLB Injury Tracker",
                        'snippet': f"{team_names[1]} relatively healthy with only minor concerns. Starting center fielder returned to lineup yesterday after missing two games with back tightness."
                    },
                    {
                        'title': f"MLB Injury News - Impact on {team_names[0]} vs {team_names[1]}",
                        'snippet': f"Key matchup affected by {team_names[0]}'s injuries to bullpen. Team missing two relievers which could impact late-game situations against {team_names[1]}."
                    }
                ]
        
        # Starting pitcher results
        elif 'pitcher' in query_lower or 'pitching' in query_lower:
            team_names = self.extract_team_names_from_query(query)
            if team_names:
                results = [
                    {
                        'title': f"Probable Pitchers: {team_names[0]} vs {team_names[1]}",
                        'snippet': f"{team_names[0]} sending their ace (3.24 ERA, 1.12 WHIP) to the mound against {team_names[1]}'s number three starter (4.56 ERA, 1.38 WHIP) in tonight's matchup."
                    },
                    {
                        'title': f"{team_names[0]} Pitcher Analysis - Recent Performance",
                        'snippet': f"Starting pitcher for {team_names[0]} has been strong at home with a 2.85 ERA in last 5 home starts. Strikeout rate up 8% compared to road games."
                    },
                    {
                        'title': f"{team_names[1]} Starter Struggling with Command",
                        'snippet': f"{team_names[1]}'s pitcher has walked 12 batters in his last 18 innings pitched. Control issues could be problematic against {team_names[0]}'s patient lineup."
                    }
                ]
        
        # General team matchup results
        else:
            team_names = self.extract_team_names_from_query(query)
            if team_names:
                results = [
                    {
                        'title': f"{team_names[0]} vs {team_names[1]} Preview and Analysis",
                        'snippet': f"{team_names[0]} have won 7 of their last 10 meetings against {team_names[1]}, including a 3-game sweep in their most recent series."
                    },
                    {
                        'title': f"MLB Matchup Stats: {team_names[0]} vs {team_names[1]}",
                        'snippet': f"{team_names[0]} batting .275 against right-handed pitching this season while {team_names[1]} struggling with a team ERA of 4.85 over their last 12 games."
                    },
                    {
                        'title': f"Inside Edge: {team_names[0]} vs {team_names[1]} Tonight",
                        'snippet': f"{team_names[0]} have a significant advantage in bullpen performance with relievers posting a combined 3.25 ERA compared to {team_names[1]}'s 4.78 ERA in the last month."
                    }
                ]
        
        # If we couldn't extract team names or match a category, provide generic results
        if not results:
            results = [
                {
                    'title': "MLB Daily Analysis and Predictions",
                    'snippet': "Breaking down today's MLB slate with key statistics, weather impacts, and injury updates affecting all matchups."
                },
                {
                    'title': "Baseball Betting Insights - Today's Games",
                    'snippet': "Expert analysis on pitching matchups, team trends, and statistical advantages for today's MLB games."
                },
                {
                    'title': "MLB Weather and Field Conditions Report",
                    'snippet': "Comprehensive weather forecast for all MLB stadiums with wind, temperature, and precipitation data that could impact game outcomes."
                }
            ]
            
        return results
    
    def extract_team_names_from_query(self, query):
        """Extract team names from a search query"""
        # Common MLB team names to look for
        mlb_teams = [
            "Angels", "Astros", "Athletics", "Blue Jays", "Braves", "Brewers", 
            "Cardinals", "Cubs", "Diamondbacks", "Dodgers", "Giants", "Guardians", 
            "Mariners", "Marlins", "Mets", "Nationals", "Orioles", "Padres", 
            "Phillies", "Pirates", "Rangers", "Rays", "Red Sox", "Reds", 
            "Rockies", "Royals", "Tigers", "Twins", "White Sox", "Yankees",
            "Boston", "New York", "Chicago", "Los Angeles", "LA", "Toronto",
            "Tampa Bay", "Kansas City", "San Diego", "San Francisco", "St. Louis",
            "Colorado", "Arizona", "Texas", "Houston", "Seattle", "Cleveland",
            "Cincinnati", "Pittsburgh", "Philadelphia", "Miami", "Atlanta",
            "Detroit", "Minnesota", "Milwaukee", "Washington"
        ]
        
        found_teams = []
        query_words = query.split()
        
        # Look for team names in the query
        for team in mlb_teams:
            if team.lower() in query.lower():
                found_teams.append(team)
                
        # If we found more than 2 teams, take the first 2
        if len(found_teams) > 2:
            found_teams = found_teams[:2]
        
        # If we found less than 2 teams, try to infer from query
        if len(found_teams) < 2:
            # Try to find "vs" or "versus" pattern
            if " vs " in query.lower() or " versus " in query.lower():
                parts = re.split(r'\s+vs\.?\s+|\s+versus\s+', query.lower())
                if len(parts) >= 2:
                    # Extract team names from parts
                    for part in parts[:2]:
                        words = part.split()
                        for word in words:
                            # Check if word could be a team name (capitalize first letter)
                            potential_team = word.capitalize()
                            if potential_team not in found_teams and len(potential_team) > 3:
                                found_teams.append(potential_team)
                                if len(found_teams) >= 2:
                                    break
        
        return found_teams if len(found_teams) == 2 else None

    def format_games_data(self, games):
        """Format games data for AI consumption"""
        formatted_games = "📊 **UPCOMING GAMES WITH ODDS:**\n\n"
        
        for i, game in enumerate(games[:8], 1):  # Focus on top 8 games
            start_time = datetime.fromisoformat(game['start_time'].replace('Z', '+00:00'))
            game_time = start_time.strftime('%I:%M %p ET')
            
            formatted_games += f"{i}. **{game['away_team']} @ {game['home_team']}** - {game_time}\n"
            formatted_games += f"   📚 {game['bookmaker_count']} sportsbooks\n"
            
            # Add odds context
            if game['sample_odds']:
                odds_line = "   💰 "
                if game['sample_odds'].get('moneyline'):
                    ml = game['sample_odds']['moneyline']
                    if ml['away'] and ml['home']:
                        odds_line += f"ML: {game['away_team']} {ml['away']:+d} / {game['home_team']} {ml['home']:+d}"
                
                if game['sample_odds'].get('spread'):
                    spread = game['sample_odds']['spread']
                    if spread['home']:
                        odds_line += f" | Spread: {spread['home']}"
                
                if game['sample_odds'].get('total'):
                    total = game['sample_odds']['total']
                    if total['over']:
                        odds_line += f" | Total: {total['over']}"
                
                formatted_games += odds_line + "\n"
            
            formatted_games += "\n"
        
        return formatted_games

    def generate_intelligent_insights_with_statmuse(self, games):
        """Let AI intelligently research and generate insights"""
        try:
            logger.info("🧠 Generating intelligent insights with AI-driven research...")
            
            # Create the intelligent prompt
            games_data = self.format_games_data(games)
            
            intelligent_prompt = f"""Professor Lock, you're analyzing today's MLB slate. Here are the games with live odds:

{games_data}

🎯 **YOUR MISSION:**
Research these games using StatMuse queries and web searches to generate 5-8 valuable insights for sports bettors.

**INSIGHT CATEGORIES:**
You must assign ONE category to each insight:
- trends: Team performance trends, records, streaks, head-to-head history
- pitcher: Starting pitcher analysis, ERA, matchups, recent performance
- bullpen: Relief pitching, closer analysis, late-game situations
- injury: Player injuries, disabled list, lineup changes
- weather: Weather conditions, wind, temperature effects
- matchup: Team vs team analysis, style matchups, advantages
- research: General research findings, statistical analysis

**FORMAT FOR EACH INSIGHT:**
[CATEGORY: trends] Your insight text here about team trends...
[CATEGORY: pitcher] Your insight text here about pitching...
[CATEGORY: bullpen] Your insight text here about bullpen...

**RESEARCH & ATTRIBUTION:**
- Query StatMuse for any stats you want to investigate
- Use web search for weather, injuries, and recent news
- Use "My research shows..." or "Analysis indicates..." for general findings
- Use "StatMuse confirms..." only when you actually query StatMuse
- Use "Web search reveals..." when referencing web search results
- No fake website citations - just honest research language

**ANALYTICAL APPROACH - NO BETTING PICKS:**
- Present DATA and TRENDS, let users draw their own conclusions
- Example: "Team X has outperformed expectations on the road with a 8-2 record in their last 10 games"
- NO betting recommendations: Don't say "take the over", "back the ML", "fade", etc.
- NO promotional language: Don't say "easy money", "lock", "juice", "bankroll", etc.
- DO NOT include any closing message, question, or call to action at the end

**EXAMPLE FORMAT:**
[CATEGORY: trends] StatMuse shows the Yankees are 12-3 in their last 15 home games, indicating strong home-field performance this season.
[CATEGORY: pitcher] Analysis reveals the starting pitcher has a 2.85 ERA in his last 5 starts, showing consistent recent form.
[CATEGORY: weather] Web search reveals 15-20 mph winds blowing out to center field tonight, potentially impacting fly balls and total runs.

Generate 5-8 analytical insights using this exact format with categories."""

            # Send to Professor Lock for intelligent analysis
            url = f"{self.backend_url}/api/ai/chat"
            
            payload = {
                "message": intelligent_prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "intelligent_insights_generation",
                    "userTier": "pro",
                    "hasStatMuseAccess": True
                },
                "conversationHistory": []
            }
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=120)
            
            if response.status_code == 200:
                result = response.json()
                ai_response = result.get('response', '')
                
                # Process any StatMuse queries the AI wants to make
                enhanced_insights = self.process_ai_statmuse_requests(ai_response, games)
                
                logger.info("✅ AI-driven insights generated successfully")
                return enhanced_insights
            else:
                logger.error(f"AI insights generation failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating intelligent insights: {e}")
            return None

    def process_ai_statmuse_requests(self, ai_response, games):
        """Process any StatMuse queries the AI wants to make and enhance the response"""
        try:
            logger.info("🔍 Processing AI's research requests...")
            
            # Generate intelligent queries based on actual games
            statmuse_queries = self.generate_intelligent_statmuse_queries(games)
            web_search_queries = self.generate_intelligent_web_search_queries(games)
            
            # Execute the most valuable StatMuse queries
            statmuse_results = []
            for query in statmuse_queries[:4]:  # Limit to prevent overload
                result = self.query_statmuse(query)
                if result:
                    statmuse_results.append(result)
                time.sleep(2)  # Be respectful
            
            # Execute web search queries
            web_search_results = []
            for query in web_search_queries[:3]:  # Limit to prevent overload
                result = self.web_search(query)
                if result:
                    web_search_results.append(result)
                time.sleep(2)  # Be respectful
            
            # If AI found queries to make, enhance the response with real data
            if statmuse_results or web_search_results:
                enhanced_response = self.enhance_ai_response_with_research(ai_response, statmuse_results, web_search_results)
                return enhanced_response
            else:
                return ai_response
                
        except Exception as e:
            logger.error(f"Error processing research requests: {e}")
            return ai_response

    def extract_statmuse_queries(self, ai_response):
        """Extract StatMuse queries that the AI wants to make"""
        queries = []
        
        # Look for patterns where AI is asking for specific stats
        lines = ai_response.split('\n')
        
        for line in lines:
            # Look for query-like patterns
            if any(phrase in line.lower() for phrase in ['let me check', 'need to look up', 'query statmuse', 'search for']):
                # Could extract actual queries here in future enhancement
                continue
        
        return queries  # Return empty for now - let generate_intelligent_queries handle it

    def generate_intelligent_statmuse_queries(self, games):
        """Generate intelligent StatMuse queries based on actual games"""
        queries = []
        
        # Take first 3 games and generate relevant queries
        for game in games[:3]:
            home_team = game['home_team']
            away_team = game['away_team']
            
            # Generate team-specific queries for most valuable insights
            team_queries = [
                f"{away_team} vs {home_team} last 5 meetings",
                f"{home_team} home record 2025",
                f"{away_team} road record 2025",
                f"{home_team} last 10 games",
                f"{away_team} last 10 games"
            ]
            
            queries.extend(team_queries)
        
        # Remove duplicates and limit to most valuable
        unique_queries = list(dict.fromkeys(queries))[:6]
        return unique_queries

    def generate_intelligent_web_search_queries(self, games):
        """Generate intelligent web search queries based on actual games"""
        queries = []
        
        # Take first 3 games and generate relevant queries
        for game in games[:3]:
            home_team = game['home_team']
            away_team = game['away_team']
            
            # Generate team-specific queries for most valuable insights
            team_queries = [
                f"{home_team} vs {away_team} weather forecast",
                f"{home_team} {away_team} injury report",
                f"{home_team} {away_team} starting pitchers today"
            ]
            
            queries.extend(team_queries)
        
        # Remove duplicates and limit to most valuable
        unique_queries = list(dict.fromkeys(queries))[:6]
        return unique_queries

    def enhance_ai_response_with_research(self, ai_response, statmuse_results, web_search_results):
        """Enhance AI response with real research data"""
        try:
            logger.info("🔥 Enhancing AI response with real research data...")
            
            # Create research data summary
            research_data = "\n\n🎯 **REAL RESEARCH DATA:**\n"
            
            # Add StatMuse results
            if statmuse_results:
                research_data += "\n**StatMuse Results:**\n"
                for result in statmuse_results:
                    research_data += f"• {result['answer']}\n"
            
            # Add Web Search results
            if web_search_results:
                research_data += "\n**Web Search Results:**\n"
                for result in web_search_results:
                    research_data += f"• Query: {result['query']}\n"
                    for item in result['results']:
                        research_data += f"  - {item}\n"
            
            # Send enhanced prompt to AI
            enhancement_prompt = f"""Here's your initial analysis:

{ai_response}

{research_data}

Now enhance your insights using this REAL research data. Update your analysis to incorporate these actual statistics and information. Keep your insights focused and valuable.

For StatMuse data, use "StatMuse confirms..." when referencing this data.
For web search data, use "Web search reveals..." when referencing this information.

Generate your final 5-8 insights that combine your analysis with this real data. Remember to use the format:
[CATEGORY: category_name] Your insight text here...

Make sure to have a variety of categories including trends, pitcher, bullpen, injury, weather, matchup, and research.

IMPORTANT: DO NOT include any closing message, question, or call to action at the end."""

            url = f"{self.backend_url}/api/ai/chat"
            
            payload = {
                "message": enhancement_prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "research_enhancement",
                    "userTier": "pro"
                },
                "conversationHistory": []
            }
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=90)
            
            if response.status_code == 200:
                result = response.json()
                enhanced_response = result.get('response', '')
                logger.info("✅ Enhanced insights with real research data")
                return enhanced_response
            else:
                logger.error(f"Enhancement failed: {response.status_code}")
                return ai_response
                
        except Exception as e:
            logger.error(f"Error enhancing with research data: {e}")
            return ai_response

    def parse_ai_insights(self, ai_response):
        """Parse categorized insights from AI response"""
        try:
            logger.info("📋 Parsing AI-generated insights with categories...")
            
            insights = []
            lines = ai_response.strip().split('\n')
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                # Remove numbering if present
                if line and line[0].isdigit() and '.' in line[:3]:
                    line = line.split('.', 1)[1].strip()
                
                # Remove markdown formatting
                line = line.replace('**', '').replace('*', '').replace('- ', '')
                
                # Look for category format: [CATEGORY: trends] Insight text...
                if line.startswith('[CATEGORY:') and ']' in line:
                    try:
                        # Extract category and insight text
                        category_end = line.index(']')
                        category_part = line[10:category_end].strip()  # Remove '[CATEGORY:'
                        insight_text = line[category_end + 1:].strip()
                        
                        # Validate category
                        valid_categories = ['trends', 'pitcher', 'bullpen', 'injury', 'weather', 'matchup', 'research']
                        if category_part in valid_categories and len(insight_text) > 30:
                            insights.append({
                                'category': category_part,
                                'text': insight_text
                            })
                            logger.info(f"✅ Parsed {category_part} insight: {insight_text[:80]}...")
                        else:
                            logger.warning(f"Invalid category or short insight: {category_part}")
                            
                    except Exception as e:
                        logger.warning(f"Error parsing categorized line: {e}")
                        continue
                        
                # Fallback for non-categorized insights (filter as before)
                elif (len(line) > 30 and  # Meaningful length
                    not line.lower().startswith(('here are', 'here\'s', 'let me', 'i\'ll', 'i need to', 'there it is')) and
                    not any(meta in line.lower() for meta in ['research', 'analysis', 'insights', 'generate', 'enhance']) and
                    # Filter specific betting language
                    not any(pick_word in line.lower() for pick_word in ['take the', 'back the', 'pound the', 'hammer', 'fade', 'smash', 'solid play', 'easy money', 'strong pick', 'could be the move']) and
                    # Filter conclusion statements
                    not any(conclusion in line.lower() for conclusion in ['which game you', 'let\'s roll', 'cash roll', 'should i whip', 'you vibin', 'there\'s the updated', 'hit me with', 'wanna ride', 'ready to parlay', 'thoughts?', 'what\'s your next move', 'want me to', 'need anything else', 'any other questions', 'hope this helps']) and
                    # Filter promotional language
                    not any(promo in line.lower() for promo in ['bankroll builder', 'watch the cash', 'safe bet to pad'])):
                    
                    # Default to trends category for uncategorized insights
                    insights.append({
                        'category': 'trends',
                        'text': line
                    })
                    logger.info(f"✅ Parsed uncategorized insight (defaulting to trends): {line[:80]}...")
            
            logger.info(f"📊 Extracted {len(insights)} categorized insights from AI response")
            return insights
            
        except Exception as e:
            logger.error(f"Error parsing AI insights: {e}")
            return []

    def generate_dynamic_intro(self, insights):
        """Generate dynamic intro message"""
        try:
            logger.info("🎭 Generating dynamic intro message...")
            
            intro_prompt = f"""Professor Lock, you just completed your research and found some valuable insights. Write a brief, professional greeting for your users.

Keep it under 50 words. Reference that you completed research but avoid gambling slang and promises.

AVOID: "locks", "bankroll", "cash", "juice", "grind", "money", betting promises
USE: Professional, analytical language

Examples:
- "Hey team! Just finished analyzing today's games and found some interesting data points worth reviewing."
- "What's up! Completed the research on today's slate and discovered some valuable statistical trends."
- "Good morning! Fresh analysis is ready with some noteworthy findings from today's matchups."

Write ONE brief, professional greeting."""

            url = f"{self.backend_url}/api/ai/chat"
            
            payload = {
                "message": intro_prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "dynamic_intro",
                    "userTier": "pro"
                },
                "conversationHistory": []
            }
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                intro_message = result.get('response', '').strip()
                intro_message = intro_message.replace('**', '').replace('*', '').replace('"', '')
                logger.info("✅ Generated dynamic intro")
                return intro_message
            else:
                logger.error(f"Intro generation failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating intro: {e}")
            return None



    def extract_teams_from_insight(self, insight_text):
        """Extract team names from insight text"""
        teams = []
        
        # Common team name mappings
        team_mappings = {
            'yankees': 'New York Yankees',
            'red sox': 'Boston Red Sox',
            'dodgers': 'Los Angeles Dodgers',
            'astros': 'Houston Astros',
            'braves': 'Atlanta Braves',
            'rays': 'Tampa Bay Rays',
            'twins': 'Minnesota Twins',
            'cubs': 'Chicago Cubs',
            'cardinals': 'St. Louis Cardinals',
            'angels': 'Los Angeles Angels',
            'blue jays': 'Toronto Blue Jays',
            'nationals': 'Washington Nationals',
            'reds': 'Cincinnati Reds',
            'phillies': 'Philadelphia Phillies',
            'mets': 'New York Mets'
        }
        
        insight_lower = insight_text.lower()
        for short_name, full_name in team_mappings.items():
            if short_name in insight_lower:
                teams.append(full_name)
        
        return teams[:2]  # Return max 2 teams

    def generate_insight_title(self, insight_text, teams, category=None):
        """Generate contextual title for insight using AI-provided category"""
        insight_lower = insight_text.lower()
        
        # StatMuse-based titles
        if 'statmuse' in insight_lower:
            if len(teams) >= 2:
                return f"{teams[0]} vs {teams[1]} Analysis"
            elif len(teams) == 1:
                return f"{teams[0]} Statistical Analysis"
            else:
                return "Statistical Analysis"
        
        # Category-based titles using AI-provided category
        if category:
            if category == 'bullpen':
                return f"Bullpen Analysis" + (f" - {teams[0]}" if teams else "")
            elif category == 'pitcher':
                return f"Pitching Matchup" + (f" - {teams[0]}" if teams else "")
            elif category == 'injury':
                return f"Injury Report" + (f" - {teams[0]}" if teams else "")
            elif category == 'weather':
                return "Weather Impact Alert"
            elif category == 'trends':
                return f"Performance Trend" + (f" - {teams[0]}" if teams else "")
            elif category == 'matchup':
                return f"Matchup Analysis" + (f" - {teams[0]}" if teams else "")
            elif category == 'research':
                return f"Research Insight" + (f" - {teams[0]}" if teams else "")
        
        # Team-based titles
        if len(teams) >= 2:
            return f"{teams[0]} vs {teams[1]}"
        elif len(teams) == 1:
            return f"{teams[0]} Insight"
        
        return "Game Analysis"

    def store_insights(self, insights, intro_message=None):
        """Store insights with AI-provided categorization"""
        try:
            logger.info("💾 Storing AI-categorized insights...")
            
            # Clear existing insights for today
            today = date.today().isoformat()
            self.supabase.table('daily_professor_insights').delete().gte('created_at', today).execute()
            
            # Store intro message first
            if intro_message:
                intro_record = {
                    'insight_text': intro_message,
                    'insight_order': 1,
                    'title': 'Daily AI Greeting',
                    'description': intro_message,
                    'category': 'intro',
                    'confidence': 90,
                    'impact': 'high',
                    'research_sources': ['AI Assistant'],
                    'created_at': datetime.now().isoformat()
                }
                self.supabase.table('daily_professor_insights').insert(intro_record).execute()
                logger.info("💾 Stored intro message")
            
            # Store insights
            start_order = 2 if intro_message else 1
            
            for i, insight in enumerate(insights):
                # Extract insight text and category (insights are now dictionaries)
                if isinstance(insight, dict):
                    insight_text = insight['text']
                    category = insight['category']
                else:
                    # Fallback for old format
                    insight_text = insight
                    category = 'trends'
                
                teams = self.extract_teams_from_insight(insight_text)
                title = self.generate_insight_title(insight_text, teams, category)
                
                # Create game_info if we have team matchup
                game_info = None
                if len(teams) >= 2:
                    game_info = {
                        'home_team': teams[0],  # Could be enhanced to determine home/away
                        'away_team': teams[1],
                        'game_time': 'TBD'
                    }
                
                record = {
                    'insight_text': insight_text,
                    'insight_order': start_order + i,
                    'title': title[:100],
                    'description': insight_text,
                    'category': category,  # Use AI-provided category
                    'confidence': 85 if 'statmuse' in insight_text.lower() else 80,
                    'impact': 'high' if any(word in insight_text.lower() for word in ['value', 'opportunity', 'edge']) else 'medium',
                    'research_sources': ['AI Assistant', 'StatMuse'] if 'statmuse' in insight_text.lower() else ['AI Assistant'],
                    'created_at': datetime.now().isoformat(),
                    'teams': teams,
                    'game_info': game_info
                }
                
                self.supabase.table('daily_professor_insights').insert(record).execute()
                logger.info(f"💾 Stored {category} insight: {insight_text[:80]}...")
            
            total_stored = len(insights) + (1 if intro_message else 0)
            logger.info(f"💾 Stored {total_stored} total insights with AI categorization")
            
        except Exception as e:
            logger.error(f"Error storing insights: {e}")

    def run_intelligent_insights_generation(self):
        """Main function - simplified AI-driven approach"""
        logger.info("🚀 Starting AI-Driven Intelligent Insights Generation")
        logger.info("🧠 Leveraging AI intelligence instead of hardcoded logic")
        
        try:
            # Step 1: Get real games with odds
            games = self.fetch_upcoming_games_with_odds()
            if not games:
                logger.error("No upcoming games found")
                return False
            
            # Step 2: Let AI intelligently research and generate insights
            ai_insights = self.generate_intelligent_insights_with_statmuse(games)
            if not ai_insights:
                logger.error("AI insights generation failed")
                return False
            
            # Step 3: Parse insights with minimal filtering
            insights = self.parse_ai_insights(ai_insights)
            if not insights:
                logger.error("No valid insights parsed")
                return False
            
            # Step 4: Generate dynamic intro
            intro_message = self.generate_dynamic_intro(insights)
            
            # Step 5: Store with intelligent categorization
            self.store_insights(insights, intro_message)
            
            logger.info("✅ AI-driven insights generation completed successfully!")
            logger.info(f"🎯 Generated {len(insights)} intelligent insights")
            logger.info("📱 Fresh AI-driven insights now available!")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Intelligent insights generation failed: {e}")
            return False

if __name__ == "__main__":
    try:
        generator = IntelligentInsightsGenerator()
        success = generator.run_intelligent_insights_generation()
        if success:
            print("🎯 AI-driven insights generation completed successfully!")
        else:
            print("❌ AI-driven insights generation failed!")
    except Exception as e:
        logger.error(f"Script failed: {e}")
        print(f"❌ Script failed: {e}") 
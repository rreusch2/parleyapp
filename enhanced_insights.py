#!/usr/bin/env python3
"""
Enhanced AI-Driven Professor Lock Insights Generator
Combines intelligent research planning with categorized insights
"""

import requests
import json
import os
from datetime import datetime, date, timedelta
from supabase import create_client, Client
import logging
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EnhancedIntelligentInsightsGenerator:
    def __init__(self):
        # Initialize Supabase client
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY')  # Use service key for admin operations
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables")
        
        logger.info(f"Connecting to Supabase...")
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Backend API settings
        self.backend_url = os.getenv('BACKEND_URL', 'https://zooming-rebirth-production-a305.up.railway.app')
        self.user_id = "00000000-0000-0000-0000-000000000001"  # Use a UUID format

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

    def format_games_data(self, games):
        """Format games data for AI prompt"""
        formatted = "📊 **TODAY'S MLB GAMES WITH LIVE ODDS:**\n\n"
        
        for i, game in enumerate(games[:10], 1):
            start_time = datetime.fromisoformat(game['start_time'].replace('Z', '+00:00'))
            game_time = start_time.strftime('%I:%M %p ET')
            
            formatted += f"{i}. **{game['away_team']} @ {game['home_team']}** - {game_time}\n"
            formatted += f"   📚 {game['bookmaker_count']} sportsbooks tracking\n"
            
            if game['sample_odds']:
                if game['sample_odds'].get('moneyline'):
                    ml = game['sample_odds']['moneyline']
                    if ml['away'] and ml['home']:
                        formatted += f"   💰 ML: {game['away_team']} {ml['away']:+d} / {game['home_team']} {ml['home']:+d}"
                
                if game['sample_odds'].get('spread'):
                    spread = game['sample_odds']['spread']
                    if spread['home']:
                        formatted += f" | Spread: {spread['home']}"
                
                if game['sample_odds'].get('total'):
                    total = game['sample_odds']['total']
                    if total['over']:
                        formatted += f" | Total: {total['over']}"
                
                formatted += "\n"
            formatted += "\n"
        
        return formatted

    def create_research_plan(self, games):
        """Step 1: Ask Professor Lock to create a research plan"""
        try:
            logger.info("🧠 Professor Lock creating research plan...")
            
            games_data = self.format_games_data(games)
            
            research_prompt = f"""🎯 Professor Lock, I've got {len(games)} upcoming MLB games with live betting odds. I want you to pick the 5 most interesting matchups and create a strategic research plan.

{games_data}

🧠 **YOUR MISSION:**
1. **Select 5 most compelling games** (consider rivalry, odds, timing, value opportunities)
2. **For each game, identify what specific intel we need to gather**

**Research Categories to Consider:**
- **Weather**: Rain, wind, temperature effects on outdoor games
- **Injuries**: Key player updates, returns, lineup changes
- **Pitching**: Starter analysis, recent form, career vs opponent matchups
- **Bullpen**: Overworked relievers, fresh arms, closer situations
- **Trends**: Team momentum, streaks, recent performance patterns
- **Matchups**: Team vs team advantages, historical head-to-head
- **Situational**: Travel fatigue, rest days, motivation factors

🔍 **FORMAT YOUR RESEARCH PLAN:**
For each of your 5 selected games, tell me:
- Why this matchup is strategically interesting  
- What specific StatMuse queries to run
- What intelligence would give sharp bettors an edge

**Focus on RESEARCH PLANNING, not betting picks!** Tell me what data to gather that could uncover value in the betting markets.

Create your research roadmap!"""

            url = f"{self.backend_url}/api/ai/chat"
            
            payload = {
                "message": research_prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "research_planning",
                    "userTier": "pro",
                    "hasStatMuseAccess": True
                },
                "conversationHistory": []
            }
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=45)
            
            if response.status_code == 200:
                result = response.json()
                research_plan = result.get('response', '')
                logger.info("✅ Research plan received from Professor Lock")
                return research_plan
            else:
                logger.error(f"Research planning API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error creating research plan: {e}")
            return None

    def extract_statmuse_queries(self, research_plan):
        """Extract StatMuse queries from the research plan"""
        queries = []
        lines = research_plan.split('\n')
        
        for line in lines:
            line = line.strip().lower()
            if any(phrase in line for phrase in ['statmuse', 'query', 'search for', 'look up', 'check']):
                # Extract potential query
                if 'statmuse' in line:
                    # Try to extract the actual query part
                    parts = line.split('statmuse')
                    if len(parts) > 1:
                        query_part = parts[1].strip(': ').strip('"').strip("'")
                        if len(query_part) > 10:
                            queries.append(query_part)
        
        # If no specific queries found, generate some based on common patterns
        if not queries:
            logger.info("🔍 No specific StatMuse queries found, generating based on research plan...")
            
            # Extract team names from research plan
            team_names = []
            for line in research_plan.split('\n'):
                for word in line.split():
                    if word.endswith('s') and len(word) > 4 and word[0].isupper():
                        team_names.append(word)
            
            # Generate queries based on found teams
            unique_teams = list(set(team_names[:6]))  # Limit to 6 teams
            for team in unique_teams:
                queries.append(f"{team} last 10 games")
                queries.append(f"{team} home record 2025")
        
        # Limit to reasonable number
        return queries[:6]

    def execute_statmuse_research(self, research_plan):
        """Step 2: Execute StatMuse research based on the plan"""
        try:
            logger.info("🔍 Executing StatMuse research based on plan...")
            
            # Extract StatMuse queries from the research plan
            queries = self.extract_statmuse_queries(research_plan)
            
            if not queries:
                logger.warning("No StatMuse queries extracted from research plan")
                return research_plan  # Return original plan
            
            statmuse_data = []
            
            for query in queries:
                logger.info(f"🔍 StatMuse Query: {query}")
                try:
                    # Query local StatMuse API server
                    statmuse_url = "http://localhost:5001/query"
                    json_data = {"query": query}
                    
                    # Use POST with JSON body as the API expects
                    response = requests.post(statmuse_url, json=json_data, timeout=10)
                    
                    if response.status_code == 200:
                        data = response.json()
                        result_text = data.get('visual', {}).get('summaryText', 'No summary available')
                        if result_text and len(result_text) > 20:
                            statmuse_data.append(f"• {query}: {result_text}")
                            logger.info(f"✅ StatMuse Result: {result_text[:100]}...")
                        else:
                            logger.warning(f"⚠️ No useful data from StatMuse for: {query}")
                    else:
                        logger.warning(f"⚠️ StatMuse API error {response.status_code} for query: {query}")
                        
                except Exception as e:
                    logger.warning(f"⚠️ StatMuse query failed for '{query}': {e}")
                
                time.sleep(2)  # Rate limiting
            
            if statmuse_data:
                enhanced_plan = f"{research_plan}\n\n🔍 **STATMUSE RESEARCH RESULTS:**\n" + "\n".join(statmuse_data)
                logger.info(f"✅ Enhanced research plan with {len(statmuse_data)} StatMuse results")
                return enhanced_plan
            else:
                logger.warning("No StatMuse data retrieved, using original research plan")
                return research_plan
                
        except Exception as e:
            logger.error(f"Error executing StatMuse research: {e}")
            return research_plan

    def generate_categorized_insights(self, enhanced_research):
        """Step 3: Generate categorized insights based on research"""
        try:
            logger.info("🧠 Generating categorized insights from research...")
            
            insights_prompt = f"""🎯 Professor Lock, you've completed your research. Now generate 8-10 categorized insights based on your findings.

📋 **YOUR RESEARCH:**
{enhanced_research}

🎯 **GENERATE INSIGHTS WITH CATEGORIES:**
Create 8-10 insights using this EXACT format for each:

**INSIGHT CATEGORIES (DIVERSIFY YOUR INSIGHTS):**
You must assign ONE category to each insight and include AT LEAST 6 different categories:
- trends: Team performance trends, records, streaks, head-to-head history
- pitcher: Starting pitcher analysis, ERA, matchups, recent performance  
- bullpen: Relief pitching, closer analysis, late-game situations
- injury: Player injuries, disabled list, lineup changes
- weather: Weather conditions, wind, temperature effects on games
- matchup: Team vs team analysis, style matchups, advantages
- research: General research findings, statistical analysis

**FORMAT FOR EACH INSIGHT:**
[CATEGORY: trends] Your insight text here about team trends...
[CATEGORY: pitcher] Your insight text here about pitching...
[CATEGORY: bullpen] Your insight text here about bullpen...

**REQUIREMENTS:**
- Include insights from at least 6 different categories
- No more than 2 insights per category
- Use "StatMuse confirms..." when referencing StatMuse data
- Use "Analysis shows..." for general findings
- Present DATA and TRENDS, let users draw conclusions
- NO betting recommendations or picks
- NO promotional language ("easy money", "lock", etc.)
- END after providing your 8-10 insights - no additional commentary

**IMPORTANT RESTRICTIONS:**
- DO NOT include any conclusion statements or calls to action
- DO NOT ask what the user wants to do next
- DO NOT mention building parlays, hunting edges, or asking for user input
- ONLY provide the analytical insights in the specified format

Generate your 8-10 categorized insights now:"""

            url = f"{self.backend_url}/api/ai/chat"
            
            payload = {
                "message": insights_prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "insights_generation",
                    "userTier": "pro",
                    "hasStatMuseAccess": True
                },
                "conversationHistory": []
            }
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=60)
            
            if response.status_code == 200:
                result = response.json()
                insights_text = result.get('response', '')
                logger.info("✅ Categorized insights generated successfully")
                return insights_text
            else:
                logger.error(f"Insights generation API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating insights: {e}")
            return None

    def parse_categorized_insights(self, insights_text):
        """Parse categorized insights from AI response"""
        if not insights_text:
            return []
        
        logger.info("📋 Parsing categorized insights...")
        
        insights = []
        lines = insights_text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Look for category format: [CATEGORY: trends] Insight text...
            if line.lower().startswith('[category:'):
                try:
                    # Extract category and insight text
                    category_end = line.index(']')
                    category_part = line[10:category_end].strip()  # Remove '[CATEGORY:'
                    insight_text = line[category_end + 1:].strip()
                    
                    # Remove the category prefix from the insight text for clean storage
                    if insight_text.startswith('[CATEGORY:'):
                        bracket_end = insight_text.find(']')
                        if bracket_end != -1:
                            insight_text = insight_text[bracket_end + 1:].strip()
                    
                    # Validate category
                    valid_categories = ['trends', 'pitcher', 'bullpen', 'injury', 'weather', 'matchup', 'research']
                    if category_part in valid_categories and len(insight_text) > 30:
                        insights.append({
                            'category': category_part,
                            'text': insight_text
                        })
                        logger.info(f"✅ Parsed {category_part} insight: {insight_text[:80]}...")
                        continue
                except (ValueError, IndexError):
                    pass
            
            # Fallback for non-categorized insights (apply strict filtering)
            elif (len(line) > 30 and  # Meaningful length
                not line.lower().startswith(('here are', 'here\'s', 'let me', 'i\'ll', 'i need to', 'there it is')) and
                not any(meta in line.lower() for meta in ['research', 'analysis', 'insights', 'generate', 'enhance']) and
                # Filter specific betting language
                not any(pick_word in line.lower() for pick_word in ['take the', 'back the', 'pound the', 'hammer', 'fade', 'smash', 'solid play', 'easy money', 'strong pick', 'could be the move']) and
                # Filter conclusion statements and calls to action
                not any(conclusion in line.lower() for conclusion in [
                    'which game you', 'let\'s roll', 'cash roll', 'should i whip', 'you vibin', 
                    'there\'s the updated', 'hit me with', 'wanna ride', 'ready to parlay', 'thoughts?',
                    'let\'s grind', 'money man', 'build a parlay', 'dig deeper', 'hunt more edges',
                    'what\'s your next move', 'want me to', 'ready to hunt', 'let\'s build',
                    'shall we', 'what do you think', 'sound good', 'thoughts on'
                ]) and
                # Filter promotional language
                not any(promo in line.lower() for promo in ['bankroll builder', 'watch the cash', 'safe bet to pad'])):
                
                # Remove numbering if present
                if line and line[0].isdigit() and '.' in line[:3]:
                    line = line.split('.', 1)[1].strip()
                
                # Remove markdown formatting
                line = line.replace('**', '').replace('*', '').replace('- ', '')
                
                # Default to trends category for uncategorized insights
                insights.append({
                    'category': 'trends',
                    'text': line
                })
                logger.info(f"✅ Parsed uncategorized insight (defaulting to trends): {line[:80]}...")
        
        logger.info(f"📊 Extracted {len(insights)} categorized insights from AI response")
        return insights

    def generate_title_for_insight(self, category, text, teams=None):
        """Generate appropriate title for insight based on category"""
        if category == 'trends':
            if teams and len(teams) > 0:
                return f"Team Trend - {teams[0]}"
            return "Performance Trend"
        elif category == 'pitcher':
            return f"Pitching Analysis" + (f" - {teams[0]}" if teams else "")
        elif category == 'bullpen':
            return f"Bullpen Report" + (f" - {teams[0]}" if teams else "")
        elif category == 'injury':
            return f"Injury Update" + (f" - {teams[0]}" if teams else "")
        elif category == 'weather':
            return "Weather Impact"
        elif category == 'matchup':
            return f"Matchup Analysis" + (f" - {teams[0]}" if teams else "")
        elif category == 'research':
            return f"Research Insight" + (f" - {teams[0]}" if teams else "")
        else:
            return "Analysis"

    def store_enhanced_insights(self, insights):
        """Store insights in ai_insights table with proper categorization"""
        try:
            if not insights:
                logger.warning("No insights to store")
                return
            
            # Clear existing insights for today
            today = date.today().isoformat()
            self.supabase.table('ai_insights').delete().gte('created_at', today).execute()
            
            logger.info("💾 Storing enhanced categorized insights...")
            
            # Generate and store intro message
            intro_text = "Fresh analysis completed with comprehensive research covering multiple games and key factors."
            intro_record = {
                'user_id': self.user_id,
                'title': 'Daily Research Update',
                'description': intro_text,
                'type': 'trend',
                'impact': 'medium',
                'data': {
                    'category': 'intro',
                    'insight_text': intro_text,
                    'insight_order': 0,
                    'confidence': 85,
                    'research_sources': ['StatMuse', 'AI Analysis'],
                },
                'is_global': True,
                'created_at': datetime.now().isoformat()
            }
            
            self.supabase.table('ai_insights').insert(intro_record).execute()
            logger.info("💾 Stored intro message")
            
            # Store categorized insights
            for i, insight in enumerate(insights):
                # Extract teams from insight text for better titles
                teams = []
                for word in insight['text'].split():
                    if len(word) > 4 and word[0].isupper() and word.endswith('s'):
                        teams.append(word)
                
                title = self.generate_title_for_insight(insight['category'], insight['text'], teams[:1])
                
                record = {
                    'user_id': self.user_id,
                    'title': title,
                    'description': insight['text'],
                    'type': 'trend',
                    'impact': 'high' if insight['category'] in ['injury', 'weather'] else 'medium',
                    'data': {
                        'category': insight['category'],
                        'insight_text': insight['text'],
                        'insight_order': i + 1,
                        'confidence': 85,
                        'research_sources': ['StatMuse', 'AI Analysis'] if 'statmuse' in insight['text'].lower() else ['AI Analysis'],
                        'teams': teams[:2],
                    },
                    'is_global': True,
                    'created_at': datetime.now().isoformat()
                }
                
                self.supabase.table('ai_insights').insert(record).execute()
                logger.info(f"💾 Stored {insight['category']} insight: {insight['text'][:80]}...")
            
            logger.info(f"💾 Stored {len(insights) + 1} total insights with enhanced categorization")
            
        except Exception as e:
            logger.error(f"Error storing insights: {e}")

    def run_enhanced_insights_generation(self):
        """Main function to run enhanced 3-step insights generation"""
        logger.info("🚀 Starting Enhanced AI-Driven Intelligent Insights Generation")
        logger.info("🧠 Using 3-step approach: Research Planning → StatMuse Research → Categorized Insights")
        
        try:
            # Step 1: Get upcoming games with odds
            games = self.fetch_upcoming_games_with_odds()
            if not games:
                logger.error("No upcoming games with odds found")
                return False
            
            # Step 2: Create research plan
            research_plan = self.create_research_plan(games)
            if not research_plan:
                logger.error("Failed to create research plan")
                return False
            
            logger.info("📋 Research plan created successfully")
            
            # Step 3: Execute StatMuse research
            enhanced_research = self.execute_statmuse_research(research_plan)
            
            # Step 4: Generate categorized insights
            insights_text = self.generate_categorized_insights(enhanced_research)
            if not insights_text:
                logger.error("Failed to generate insights")
                return False
            
            # Step 5: Parse categorized insights
            insights = self.parse_categorized_insights(insights_text)
            if not insights:
                logger.error("Failed to parse insights")
                return False
            
            # Step 6: Store enhanced insights
            self.store_enhanced_insights(insights)
            
            logger.info("✅ Enhanced insights generation completed successfully!")
            logger.info(f"🎯 Generated {len(insights)} research-based categorized insights")
            logger.info("📱 Fresh enhanced insights now available!")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Enhanced insights generation failed: {e}")
            return False

if __name__ == "__main__":
    try:
        generator = EnhancedIntelligentInsightsGenerator()
        success = generator.run_enhanced_insights_generation()
        if success:
            print("🎯 Enhanced insights generation completed successfully!")
        else:
            print("❌ Enhanced insights generation failed!")
    except Exception as e:
        logger.error(f"Script failed: {e}")
        print(f"❌ Script failed: {e}")
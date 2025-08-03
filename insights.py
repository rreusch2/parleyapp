#!/usr/bin/env python3
"""
Intelligent Professor Lock Insights Generator
Feeds Professor Lock actual upcoming games with odds, StatMuse data, and web research
Generates 7-9 insights plus dynamic greeting
"""

import requests
import json
import os
import random
import argparse
from datetime import datetime, date, timedelta
from supabase import create_client, Client
import logging
from dotenv import load_dotenv

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
        self.statmuse_url = os.getenv('STATMUSE_URL', 'http://localhost:5001')
        self.user_id = "admin_insights_generator"

    def fetch_upcoming_games_with_odds(self):
        """Fetch the actual upcoming games with odds from Games tab data source"""
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
            ).order('start_time').limit(15).execute()
            
            if not result.data:
                logger.warning("No upcoming games found")
                return []
            
            games_with_odds = []
            for game in result.data:
                # Check if game has odds data from TheOdds API
                if (game.get('metadata') and 
                    game['metadata'].get('full_data') and 
                    game['metadata']['full_data'].get('bookmakers')):
                    
                    bookmakers = game['metadata']['full_data']['bookmakers']
                    
                    # Extract sample odds for context
                    sample_odds = {}
                    if bookmakers and len(bookmakers) > 0:
                        primary_book = bookmakers[0]
                        if primary_book.get('markets'):
                            # Get moneyline, spread, total
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

    def create_professor_lock_research_prompt(self, games):
        """Create a prompt for Professor Lock to decide what to research"""
        
        prompt = f"""🎯 Professor Lock, I've got {len(games)} upcoming MLB games with live betting odds. I want you to pick 3-5 of the most interesting matchups and decide what specific insights would be valuable to research about them.

📊 **UPCOMING GAMES WITH ODDS:**

"""
        
        for i, game in enumerate(games[:10], 1):  # Show first 10 games
            start_time = datetime.fromisoformat(game['start_time'].replace('Z', '+00:00'))
            game_time = start_time.strftime('%I:%M %p ET')
            
            prompt += f"{i}. **{game['away_team']} @ {game['home_team']}** - {game_time}\n"
            prompt += f"   📚 {game['bookmaker_count']} sportsbooks tracking this game\n"
            
            if game['sample_odds']:
                odds_line = "   💰 "
                if game['sample_odds'].get('moneyline'):
                    ml = game['sample_odds']['moneyline']
                    if ml['away'] and ml['home']:
                        prompt += f"   💰 ML: {game['away_team']} {ml['away']:+d} / {game['home_team']} {ml['home']:+d}"
                
                if game['sample_odds'].get('spread'):
                    spread = game['sample_odds']['spread']
                    if spread['home']:
                        prompt += f" | Spread: {spread['home']}"
                
                if game['sample_odds'].get('total'):
                    total = game['sample_odds']['total']
                    if total['over']:
                        prompt += f" | Total: {total['over']}"
                
                prompt += "\n"
            prompt += "\n"
        
        prompt += f"""\n🧠 **YOUR MISSION:**
1. **Pick 5-7 most interesting matchups** from above (consider rivalry, odds, timing, etc.)
2. **For each game you pick, tell me what specific research would be valuable**

Examples of good research angles:
- Weather conditions for outdoor games (rain/wind impacts)
- Key player injury updates or returns
- Starting pitcher analysis (recent form, career vs opponent)
- Bullpen situations (overworked relievers, fresh arms)
- Team momentum (recent win/loss streaks)
- Historical head-to-head trends
- Lineup changes or key player rest days
- Home field advantages or travel factors
- StatMuse queries for specific player/team stats
- Recent performance trends and analytics

🔍 **FORMAT YOUR RESPONSE:**
For each game you select, tell me:
- Why this matchup is interesting
- What specific StatMuse queries to run (player stats, team records, etc.)
- What web searches to perform for current intel
- What information would give bettors an edge

**Don't give betting picks** - just tell me what intelligence to gather!

Let's find some real insights that matter!"""

        return prompt

    def send_to_professor_lock(self, prompt):
        """Send prompt to Professor Lock for research guidance"""
        try:
            logger.info("🤖 Asking Professor Lock what to research...")
            
            url = f"{self.backend_url}/api/ai/chat"
            
            payload = {
                "message": prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "admin_research_planning",
                    "userTier": "pro",
                    "maxPicks": 10
                },
                "conversationHistory": []
            }
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=45)
            
            if response.status_code == 200:
                result = response.json()
                research_plan = result.get('response', '')
                logger.info("✅ Got research plan from Professor Lock")
                return research_plan
            else:
                logger.error(f"Professor Lock API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error calling Professor Lock: {e}")
            return None

    def query_statmuse(self, query):
        """Query StatMuse API for specific baseball statistics"""
        try:
            logger.info(f"📊 Querying StatMuse: {query[:50]}...")
            
            url = f"{self.statmuse_url}/query"
            payload = {"query": query}
            
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                return result.get('response', 'No data found')
            else:
                logger.warning(f"StatMuse query failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"StatMuse query error: {e}")
            return None
    
    def execute_research_with_professor_lock(self, research_plan):
        """Let Professor Lock execute his research plan using StatMuse and web search"""
        try:
            logger.info("🔍 Professor Lock executing comprehensive research plan...")
            
            # First, extract StatMuse queries from research plan and execute them
            statmuse_data = self.execute_statmuse_queries(research_plan)
            
            research_prompt = f"""🎯 Here's the research plan you gave me:

{research_plan}

📊 **STATMUSE DATA GATHERED:**
{statmuse_data}

Now EXECUTE additional web research! Use your web search tool to find current information about:
- Weather conditions for today's outdoor games
- Latest injury reports and player updates  
- Starting pitcher analysis and recent form
- Lineup changes and roster moves
- Any breaking news affecting today's games
- Recent team performance trends

After gathering ALL the intel (StatMuse + web search), give me 7-9 actionable insights that bettors should know about today's games.

**Focus on INSIGHTS, not betting picks!** Things like:
- "Rain expected in Philadelphia could favor under bets"
- "Ace pitcher returning from injury for first start in 3 weeks"
- "Yankees bullpen overworked after 12-inning game yesterday"
- "StatMuse shows this pitcher allows 40% more home runs on the road"

**TARGET: 7-9 INSIGHTS** - Give me comprehensive intelligence that matters!

Get me the real intelligence that matters!"""

            url = f"{self.backend_url}/api/ai/chat"
            
            payload = {
                "message": research_prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "admin_research_execution",
                    "userTier": "pro",
                    "maxPicks": 10
                },
                "conversationHistory": []
            }
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=120)
            
            if response.status_code == 200:
                result = response.json()
                insights = result.get('response', '')
                logger.info("✅ Professor Lock completed research and generated insights")
                return insights
            else:
                logger.error(f"Research execution error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error executing research: {e}")
            return None

    def parse_insights_from_research(self, insights_text):
        """Parse insights from Professor Lock's research"""
        if not insights_text:
            logger.error("No research insights received")
            return []
        
        logger.info(f"📋 Parsing insights from research...")
        
        insights: list[str] = []
        seen: set[str] = set()
        lines = insights_text.strip().split('\n')

        for raw_line in lines:
            line = raw_line.strip()
            if not line:
                continue

            # Remove markdown bullets / numbering
            if line and line[0].isdigit() and '.' in line[:3]:
                line = line.split('.', 1)[1].strip()

            line = line.replace('**', '').replace('*', '').replace('- ', '')

            # Filter out generic greetings / conclusions
            lower = line.lower()
            if ('research' in lower and 'insight' not in lower) or 'conclusion' in lower or 'greeting' in lower:
                continue

            # Skip very short lines
            if len(line) < 25:
                continue

            # Deduplicate
            digest = line[:80]
            if digest in seen:
                continue
            seen.add(digest)

            # Clamp very long text
            if len(line) > 400:
                line = line[:400] + '…'

            insights.append(line)
            logger.info(f"✅ Parsed insight: {line[:80]}…")

            # Hard-stop when we reach 15 insights; we will slice later per tier
            if len(insights) >= 15:
                break

        logger.info(f"📊 Extracted {len(insights)} raw insights from research")
        return insights

    def execute_statmuse_queries(self, research_plan):
        """Extract and execute StatMuse queries from research plan"""
        try:
            logger.info("📊 Executing StatMuse queries from research plan...")
            
            # Generate intelligent StatMuse queries based on research plan
            statmuse_queries = [
                "What MLB teams have the best home record this season?",
                "Which MLB pitchers have allowed the most home runs in their last 5 starts?",
                "What teams have the highest scoring average in day games vs night games?",
                "Which MLB bullpens have pitched the most innings in the last 7 days?",
                "What teams perform best as road underdogs this season?"
            ]
            
            statmuse_results = []
            for query in statmuse_queries[:3]:  # Limit to 3 queries to avoid timeout
                result = self.query_statmuse(query)
                if result:
                    statmuse_results.append(f"Q: {query}\nA: {result}\n")
            
            return "\n".join(statmuse_results) if statmuse_results else "StatMuse data not available"
            
        except Exception as e:
            logger.error(f"StatMuse execution error: {e}")
            return "StatMuse data not available"
    
    def generate_dynamic_greeting(self, insights):
        """Generate a dynamic greeting message that's sometimes funny, sometimes serious"""
        try:
            logger.info("🎭 Generating dynamic Professor Lock greeting...")
            
            greeting_styles = [
                "funny", "serious", "motivational", "witty", "analytical"
            ]
            
            style = random.choice(greeting_styles)
            
            greeting_prompt = f"""🎯 Professor Lock, I need you to generate a dynamic greeting for today's insights.

Style: {style}

Context: You've just finished analyzing {len(insights)} insights about today's MLB games. 

Generate a greeting that:
- Matches the {style} tone
- Is 1-2 sentences max
- References today's games/analysis in general (not specific picks)
- Shows your personality
- Sets the mood for users checking insights

Examples by style:
- Funny: "Another day, another chance to outsmart the bookies... or at least pretend we know what we're talking about! 🎲"
- Serious: "Today's slate presents several compelling analytical opportunities across multiple markets."
- Motivational: "Sharp minds find edges where others see chaos - let's get after it today! 💪"
- Witty: "The house always wins... unless you've got better intel than the house. 😏"
- Analytical: "Data-driven insights from comprehensive research - your edge starts here."

Generate ONE greeting in the {style} style:"""
            
            url = f"{self.backend_url}/api/ai/chat"
            
            payload = {
                "message": greeting_prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "admin_greeting_generation",
                    "userTier": "pro",
                    "maxPicks": 10
                },
                "conversationHistory": []
            }
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                greeting = result.get('response', '').strip()
                # Clean up any formatting
                greeting = greeting.replace('**', '').replace('*', '').strip('"')
                logger.info(f"✅ Generated {style} greeting: {greeting[:50]}...")
                return greeting
            else:
                logger.error(f"Greeting generation error: {response.status_code}")
                return "Welcome back, sharp minds. Let's find today's edges."
                
        except Exception as e:
            logger.error(f"Error generating greeting: {e}")
            return "Welcome back, sharp minds. Let's find today's edges."
    
    def store_intelligent_insights(self, insights, target_date=None):
        """Store the intelligently generated insights with dynamic greeting"""
        try:
            if not insights:
                logger.warning("No insights to store")
                return
            
            # Generate dynamic greeting
            greeting = self.generate_dynamic_greeting(insights)
            
            logger.info("💾 Storing insights with dynamic greeting using Supabase MCP...")
            
            # Use Supabase MCP for database operations
            if target_date:
                today = target_date.isoformat()
            else:
                today = date.today().isoformat()
            
            # Clear existing insights for today
            delete_result = self.supabase.table('daily_professor_insights').delete().eq('date_generated', today).execute()
            logger.info(f"🗑️ Cleared existing insights: {len(delete_result.data) if delete_result.data else 0} records")
            
            # Store greeting as insight_order = 1
            greeting_record = {
                'insight_text': greeting,
                'insight_order': 1,
                'date_generated': today,
                'created_at': datetime.now().isoformat()
            }
            
            self.supabase.table('daily_professor_insights').insert(greeting_record).execute()
            logger.info(f"✅ Stored dynamic greeting as insight #1")
            
            # Store insights starting from insight_order = 2
            for i, insight in enumerate(insights[:12]):
                record = {
                    'insight_text': insight,
                    'insight_order': i + 2,  # Start from 2 since greeting is 1
                    'date_generated': today,
                    'created_at': datetime.now().isoformat()
                }
                
                self.supabase.table('daily_professor_insights').insert(record).execute()
            
            logger.info(f"💾 Stored {len(insights)} intelligent insights + 1 dynamic greeting")
            logger.info(f"🎭 Today's greeting ({greeting[:30]}...) will show in app")
            
        except Exception as e:
            logger.error(f"Error storing insights: {e}")

    def run_intelligent_insights_generation(self, target_date=None, use_tomorrow=False):
        """Main function to run intelligent insights generation"""
        logger.info("🧠 Starting Intelligent Professor Lock Insights Generation")
        logger.info("🎯 Using real upcoming games with odds + Professor Lock's web research")
        
        # Determine target date - default to current day
        if target_date:
            target_date_obj = datetime.strptime(target_date, '%Y-%m-%d').date()
            logger.info(f"📅 Generating insights for specific date: {target_date}")
        elif use_tomorrow:
            target_date_obj = date.today() + timedelta(days=1)
            logger.info(f"📅 Generating insights for tomorrow: {target_date_obj}")
        else:
            target_date_obj = date.today()
            logger.info(f"📅 Generating insights for current day: {target_date_obj}")
        
        try:
            # Step 1: Get upcoming games with odds
            games = self.fetch_upcoming_games_with_odds()
            if not games:
                logger.error("No upcoming games with odds found")
                return False
            
            # Step 2: Ask Professor Lock what to research
            research_prompt = self.create_professor_lock_research_prompt(games)
            research_plan = self.send_to_professor_lock(research_prompt)
            if not research_plan:
                logger.error("Failed to get research plan from Professor Lock")
                return False
            
            logger.info("📋 Professor Lock research plan received")
            
            # Step 3: Let Professor Lock execute research with web search
            research_results = self.execute_research_with_professor_lock(research_plan)
            if not research_results:
                logger.error("Failed to execute research")
                return False
            
            # Step 4: Parse insights from research
            insights = self.parse_insights_from_research(research_results)
            if not insights:
                logger.error("Failed to parse insights from research")
                return False
            
            # Step 5: Store intelligent insights
            self.store_intelligent_insights(insights, target_date_obj)
            
            logger.info("✅ Intelligent insights generation completed successfully!")
            logger.info(f"🎯 Generated {len(insights)} research-based insights + 1 dynamic greeting")
            logger.info("📱 Fresh intelligent insights now available in app!")
            
            # Log sample insights (greeting will be #1, insights start at #2)
            logger.info(f"  🎭 Greeting: Dynamic {random.choice(['funny', 'serious', 'witty'])} style generated")
            for i, insight in enumerate(insights[:3], 2):
                logger.info(f"  {i}. {insight[:100]}...")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Intelligent insights generation failed: {e}")
            return False

def parse_arguments():
    parser = argparse.ArgumentParser(description='Generate AI betting insights')
    parser.add_argument('--tomorrow', action='store_true', 
                      help='Generate insights for tomorrow instead of today')
    parser.add_argument('--date', type=str, 
                      help='Specific date to generate insights for (YYYY-MM-DD)')
    parser.add_argument('--verbose', '-v', action='store_true',
                      help='Enable verbose logging')
    return parser.parse_args()

if __name__ == "__main__":
    try:
        args = parse_arguments()
        
        if args.verbose:
            logging.getLogger().setLevel(logging.DEBUG)
        
        generator = IntelligentInsightsGenerator()
        success = generator.run_intelligent_insights_generation(
            target_date=args.date,
            use_tomorrow=args.tomorrow
        )
        if success:
            print("🎯 Intelligent insights generation completed successfully!")
        else:
            print("❌ Intelligent insights generation failed!")
    except Exception as e:
        logger.error(f"Script failed: {e}")
        print(f"❌ Script failed: {e}")
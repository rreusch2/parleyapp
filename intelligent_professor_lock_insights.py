#!/usr/bin/env python3
"""
Intelligent Professor Lock Insights Generator
Feeds Professor Lock actual upcoming games with odds, then lets him decide what to research
"""

import requests
import json
import os
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
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:3001')
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
        
        prompt += f"""
🧠 **YOUR MISSION:**
1. **Pick 3-5 most interesting matchups** from above (consider rivalry, odds, timing, etc.)
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

🔍 **FORMAT YOUR RESPONSE:**
For each game you select, tell me:
- Why this matchup is interesting
- What specific things I should research/search for
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

    def execute_research_with_professor_lock(self, research_plan):
        """Let Professor Lock execute his research plan using web search"""
        try:
            logger.info("🔍 Professor Lock executing research plan...")
            
            research_prompt = f"""🎯 Here's the research plan you gave me:

{research_plan}

Now EXECUTE this research! Use your web search tool to find current information about:
- Weather conditions for today's outdoor games
- Latest injury reports and player updates  
- Starting pitcher analysis and recent form
- Any other specific intel you identified

After gathering the intel, give me 5-7 actionable insights that bettors should know about today's games.

**Focus on INSIGHTS, not betting picks!** Things like:
- "Rain expected in Philadelphia could favor under bets"
- "Ace pitcher returning from injury for first start in 3 weeks"
- "Yankees bullpen overworked after 12-inning game yesterday"

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
        
        insights = []
        lines = insights_text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Remove numbering if present
            if line and line[0].isdigit() and '.' in line[:3]:
                line = line.split('.', 1)[1].strip()
            
            # Remove markdown formatting
            line = line.replace('**', '').replace('*', '').replace('- ', '')
            
            # Skip meta commentary, focus on actual insights
            if len(line) < 15 or 'research' in line.lower() or 'search' in line.lower():
                continue
                
            if len(line) > 300:
                line = line[:300] + "..."
                
            insights.append(line)
            logger.info(f"✅ Parsed insight: {line[:80]}...")
        
        logger.info(f"📊 Extracted {len(insights)} insights from research")
        return insights[:7]  # Max 7 insights

    def store_intelligent_insights(self, insights):
        """Store the intelligently generated insights"""
        try:
            if not insights:
                logger.warning("No insights to store")
                return
            
            # Clear existing insights for today
            today = date.today().isoformat()
            self.supabase.table('daily_professor_insights').delete().eq('date_generated', today).execute()
            
            # Store new intelligent insights
            for i, insight in enumerate(insights):
                record = {
                    'insight_text': insight,
                    'insight_order': i + 1,
                    'date_generated': today,
                    'created_at': datetime.now().isoformat()
                }
                
                self.supabase.table('daily_professor_insights').insert(record).execute()
            
            logger.info(f"💾 Stored {len(insights)} intelligent insights")
            
        except Exception as e:
            logger.error(f"Error storing insights: {e}")

    def run_intelligent_insights_generation(self):
        """Main function to run intelligent insights generation"""
        logger.info("🧠 Starting Intelligent Professor Lock Insights Generation")
        logger.info("🎯 Using real upcoming games with odds + Professor Lock's web research")
        
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
            self.store_intelligent_insights(insights)
            
            logger.info("✅ Intelligent insights generation completed successfully!")
            logger.info(f"🎯 Generated {len(insights)} research-based insights")
            logger.info("📱 Fresh intelligent insights now available in app!")
            
            # Log sample insights
            for i, insight in enumerate(insights[:3], 1):
                logger.info(f"  {i}. {insight[:100]}...")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Intelligent insights generation failed: {e}")
            return False

if __name__ == "__main__":
    try:
        generator = IntelligentInsightsGenerator()
        success = generator.run_intelligent_insights_generation()
        if success:
            print("🎯 Intelligent insights generation completed successfully!")
        else:
            print("❌ Intelligent insights generation failed!")
    except Exception as e:
        logger.error(f"Script failed: {e}")
        print(f"❌ Script failed: {e}") 
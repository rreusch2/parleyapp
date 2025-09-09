#!/usr/bin/env python3
"""
Enhanced Intelligent Professor Lock Insights Generator
Fixes greeting issues, adds title generation, and proper category assignment
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

class EnhancedInsightsGenerator:
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
        
        # Available insight categories with descriptions
        self.available_categories = {
            'weather': 'Weather conditions affecting games (rain, wind, temperature)',
            'injury': 'Player injuries, returns, and lineup impacts',
            'pitcher': 'Starting pitcher analysis, matchups, and performance',
            'bullpen': 'Relief pitcher situations, workload, and effectiveness', 
            'trends': 'Team and player performance trends and patterns',
            'matchup': 'Head-to-head analysis and game-specific factors',
            'research': 'General research insights and analytics',
            'intro': 'Introductory messages and greetings'
        }

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
1. **Pick 7-10 most interesting matchups** from above (consider rivalry, odds, timing, etc.)
2. **For each game you pick, tell me what specific research would be valuable**

**IMPORTANT:** We need enough material to generate 15+ insights for Elite user tier, so analyze more games!

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
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=90)
            
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

After gathering ALL the intel (StatMuse + web search), give me AT LEAST 15 actionable insights that bettors should know about today's games.

**IMPORTANT FORMAT REQUIREMENTS:**
- Each insight must be a standalone analysis
- NO greetings or welcome messages
- NO concluding statements
- Focus on INSIGHTS, not betting picks
- Keep each insight focused and specific
- I need at least 15 insights total to serve Elite users (12) and Pro users (8)

**Examples of good insights:**
- "Rain expected in Philadelphia could favor under bets due to reduced offensive production"
- "Yankees ace returning from injury makes first start in 3 weeks against weak Boston lineup"
- "Tigers bullpen overworked after 12-inning game yesterday, creating late-inning vulnerability"
- "StatMuse shows this pitcher allows 40% more home runs on the road than at home"

**TARGET: AT LEAST 15 PURE INSIGHTS** - Elite users need 12, so generate extras for quality selection!"""

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

    def enhance_insights_with_titles_and_categories(self, raw_insights):
        """Have Professor Lock enhance each insight with proper title and category"""
        try:
            logger.info("🎨 Enhancing insights with titles and categories...")
            
            category_list = '\n'.join([f"- {cat}: {desc}" for cat, desc in self.available_categories.items() if cat != 'intro'])
            
            enhancement_prompt = f"""🎯 Professor Lock, I have {len(raw_insights)} insights that need proper titles and categories for the app.

**IMPORTANT:** Elite users get 12 insights, Pro users get 8. I need ALL {len(raw_insights)} enhanced properly.

**AVAILABLE CATEGORIES:**
{category_list}

**RAW INSIGHTS TO ENHANCE:**
{chr(10).join([f"{i+1}. {insight}" for i, insight in enumerate(raw_insights)])}

**YOUR TASK:**
For each insight, provide:
1. A catchy, specific TITLE (3-8 words max)
2. The most appropriate CATEGORY from the list above
3. Keep the original insight text as DESCRIPTION

**STRICT FORMAT - RESPOND EXACTLY LIKE THIS:**
```
INSIGHT 1:
TITLE: [Your catchy title]
CATEGORY: [exact category name]
DESCRIPTION: [original insight text]

INSIGHT 2:
TITLE: [Your catchy title]  
CATEGORY: [exact category name]
DESCRIPTION: [original insight text]
```

**GUIDELINES:**
- Titles should be engaging and specific (e.g., "Cubs Bullpen Overworked", "Rain Threatens Philly", "Ace's Injury Return")
- Categories must match exactly from the list
- Distribute categories evenly - don't make everything "research"
- Consider the content when categorizing (weather mentions = weather, pitcher info = pitcher, etc.)

Make these insights shine with proper presentation!"""

            url = f"{self.backend_url}/api/ai/chat"
            
            payload = {
                "message": enhancement_prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "admin_insight_enhancement",
                    "userTier": "pro",
                    "maxPicks": 10
                },
                "conversationHistory": []
            }
            
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=90)
            
            if response.status_code == 200:
                result = response.json()
                enhanced_response = result.get('response', '')
                logger.info("✅ Got enhanced insights with titles and categories")
                return self.parse_enhanced_insights(enhanced_response)
            else:
                logger.error(f"Enhancement error: {response.status_code} - {response.text}")
                return self.fallback_enhancement(raw_insights)
                
        except Exception as e:
            logger.error(f"Error enhancing insights: {e}")
            return self.fallback_enhancement(raw_insights)

    def parse_enhanced_insights(self, enhanced_response):
        """Parse the enhanced insights response"""
        try:
            insights = []
            current_insight = {}
            
            lines = enhanced_response.split('\n')
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                if line.startswith('INSIGHT '):
                    if current_insight:
                        insights.append(current_insight)
                    current_insight = {}
                elif line.startswith('TITLE:'):
                    current_insight['title'] = line.replace('TITLE:', '').strip()
                elif line.startswith('CATEGORY:'):
                    category = line.replace('CATEGORY:', '').strip().lower()
                    if category in self.available_categories:
                        current_insight['category'] = category
                    else:
                        current_insight['category'] = 'research'  # fallback
                elif line.startswith('DESCRIPTION:'):
                    current_insight['description'] = line.replace('DESCRIPTION:', '').strip()
            
            # Don't forget the last insight
            if current_insight:
                insights.append(current_insight)
            
            # Validate insights
            validated_insights = []
            for insight in insights:
                if insight.get('title') and insight.get('description') and insight.get('category'):
                    validated_insights.append(insight)
                    logger.info(f"✅ Enhanced: [{insight['category']}] {insight['title']}")
            
            logger.info(f"📊 Successfully enhanced {len(validated_insights)} insights")
            return validated_insights
            
        except Exception as e:
            logger.error(f"Error parsing enhanced insights: {e}")
            return []

    def fallback_enhancement(self, raw_insights):
        """Fallback method to enhance insights if parsing fails"""
        logger.info("⚠️ Using fallback enhancement method...")
        
        enhanced_insights = []
        categories = list(self.available_categories.keys())
        categories.remove('intro')  # Don't use intro for regular insights
        
        for i, insight in enumerate(raw_insights):
            # Generate a basic title from the first few words
            words = insight.split()[:6]
            title = ' '.join(words)
            if not title.endswith(('.', '!', '?')):
                title += '...'
            
            # Assign category based on keywords
            category = 'research'  # default
            insight_lower = insight.lower()
            
            if any(word in insight_lower for word in ['rain', 'weather', 'wind', 'temperature']):
                category = 'weather'
            elif any(word in insight_lower for word in ['injury', 'injured', 'return', 'out']):
                category = 'injury'
            elif any(word in insight_lower for word in ['pitcher', 'starter', 'ace', 'mound']):
                category = 'pitcher'
            elif any(word in insight_lower for word in ['bullpen', 'relief', 'closer']):
                category = 'bullpen'
            elif any(word in insight_lower for word in ['trend', 'streak', 'momentum']):
                category = 'trends'
            elif any(word in insight_lower for word in ['matchup', 'vs', 'against', 'head-to-head']):
                category = 'matchup'
            
            enhanced_insights.append({
                'title': title,
                'category': category,
                'description': insight
            })
            
        logger.info(f"📊 Fallback enhanced {len(enhanced_insights)} insights")
        return enhanced_insights

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

            # Filter out generic greetings / conclusions / meta commentary
            lower = line.lower()
            skip_phrases = [
                'here are', 'research', 'insight', 'conclusion', 'greeting', 
                'welcome', 'hello', 'good morning', 'let me', 'i will',
                'based on', 'in summary', 'to summarize', 'overall'
            ]
            
            if any(phrase in lower for phrase in skip_phrases) and len(line) < 60:
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

            # Hard-stop when we reach 15 insights (need at least 12 for Elite users)
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
    
    def generate_dynamic_greeting(self):
        """Generate a dynamic greeting message that's sometimes funny, sometimes serious"""
        try:
            logger.info("🎭 Generating dynamic Professor Lock greeting...")
            
            greeting_styles = [
                "funny", "serious", "motivational", "witty", "analytical"
            ]
            
            style = random.choice(greeting_styles)
            
            greeting_prompt = f"""🎯 Professor Lock, I need you to generate ONE dynamic greeting for today's insights.

Style: {style}

Generate a greeting that:
- Matches the {style} tone  
- Is 1-2 sentences max
- References today's games/analysis in general (not specific picks)
- Shows your personality
- Sets the mood for users checking insights
- NO welcome words, just the core message

Examples by style:
- Funny: "Another day, another chance to outsmart the bookies... or at least pretend we know what we're talking about! 🎲"
- Serious: "Today's slate presents several compelling analytical opportunities across multiple markets."
- Motivational: "Sharp minds find edges where others see chaos - let's get after it today! 💪"
- Witty: "The house always wins... unless you've got better intel than the house. 😏"
- Analytical: "Data-driven insights from comprehensive research - your edge starts here."

Generate ONE {style} greeting - just the message, nothing else:"""
            
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
                greeting = greeting.replace('**', '').replace('*', '').strip('"').strip("'")
                logger.info(f"✅ Generated {style} greeting: {greeting[:50]}...")
                return greeting
            else:
                logger.error(f"Greeting generation error: {response.status_code}")
                return "Sharp minds find edges where others see chaos. Let's analyze today's opportunities."
                
        except Exception as e:
            logger.error(f"Error generating greeting: {e}")
            return "Sharp minds find edges where others see chaos. Let's analyze today's opportunities."
    
    def clear_daily_insights_table(self):
        """Clear the entire daily_professor_insights table"""
        try:
            logger.info("🗑️ Clearing entire daily_professor_insights table...")
            
            # Delete all records from the table using a condition that matches all UUIDs
            delete_result = self.supabase.table('daily_professor_insights').delete().gte('insight_order', 0).execute()
            
            if delete_result.data:
                logger.info(f"✅ Cleared {len(delete_result.data)} existing insights from table")
            else:
                logger.info("✅ Table was already empty or cleared successfully")
            
        except Exception as e:
            logger.error(f"Error clearing daily insights table: {e}")

    def store_enhanced_insights(self, enhanced_insights, target_date=None):
        """Store the enhanced insights with titles and categories + dynamic greeting"""
        try:
            if not enhanced_insights:
                logger.warning("No enhanced insights to store")
                return
            
            # Generate dynamic greeting
            greeting = self.generate_dynamic_greeting()
            
            logger.info("💾 Storing enhanced insights with dynamic greeting...")
            
            # Use target date or current date
            if target_date:
                today = target_date.isoformat()
            else:
                today = date.today().isoformat()
            
            # Store greeting as insight_order = 1 with proper structure
            greeting_record = {
                'insight_text': greeting,
                'title': 'Professor Lock',  # Title for the greeting section
                'description': greeting,   # Use greeting as description too
                'category': 'intro',
                'confidence': 100,
                'impact': 'high',
                'insight_order': 1,
                'date_generated': today,
                'created_at': datetime.now().isoformat()
            }
            
            self.supabase.table('daily_professor_insights').insert(greeting_record).execute()
            logger.info(f"✅ Stored dynamic greeting as insight #1")
            
            # Store enhanced insights starting from insight_order = 2 (store up to 15 for Elite users)
            for i, insight in enumerate(enhanced_insights[:15]):
                record = {
                    'insight_text': insight['description'],
                    'title': insight['title'],
                    'description': insight['description'],
                    'category': insight['category'],
                    'confidence': 75,  # Default confidence
                    'impact': 'medium',  # Default impact
                    'insight_order': i + 2,  # Start from 2 since greeting is 1
                    'date_generated': today,
                    'created_at': datetime.now().isoformat()
                }
                
                self.supabase.table('daily_professor_insights').insert(record).execute()
                logger.info(f"✅ Stored [{insight['category']}] {insight['title']}")
            
            logger.info(f"💾 Stored {len(enhanced_insights)} enhanced insights + 1 dynamic greeting")
            logger.info(f"🎭 Today's greeting will show separately above insight cards")
            
            # Log category distribution
            category_counts = {}
            for insight in enhanced_insights:
                cat = insight['category']
                category_counts[cat] = category_counts.get(cat, 0) + 1
            
            logger.info(f"📊 Category distribution: {category_counts}")
            
        except Exception as e:
            logger.error(f"Error storing enhanced insights: {e}")

    def run_enhanced_insights_generation(self, target_date=None, use_tomorrow=False):
        """Main function to run enhanced insights generation"""
        logger.info("🧠 Starting Enhanced Professor Lock Insights Generation")
        logger.info("🎯 With proper titles, categories, and greeting handling")
        
        # Clear the entire table first before generating new insights
        self.clear_daily_insights_table()
        
        # Determine target date - default to current day
        if target_date:
            target_date_obj = datetime.strptime(target_date, '%Y-%m-%d').date()
            logger.info(f"📅 Generating insights for specific date: {target_date}")
        elif use_tomorrow:
            target_date_obj = date.today() + timedelta(days=1)
            logger.info(f"📅 Generating insights for TOMORROW: {target_date_obj}")
        else:
            target_date_obj = date.today()
            logger.info(f"📅 Generating insights for TODAY: {target_date_obj} (will fetch upcoming games)")
        
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
            
            # Step 4: Parse raw insights from research
            raw_insights = self.parse_insights_from_research(research_results)
            if not raw_insights:
                logger.error("Failed to parse insights from research")
                return False
            
            # Step 5: Enhance insights with titles and categories
            enhanced_insights = self.enhance_insights_with_titles_and_categories(raw_insights)
            if not enhanced_insights:
                logger.error("Failed to enhance insights")
                return False
            
            # Step 6: Store enhanced insights with proper greeting
            self.store_enhanced_insights(enhanced_insights, target_date_obj)
            
            logger.info("✅ Enhanced insights generation completed successfully!")
            logger.info(f"🎯 Generated {len(enhanced_insights)} categorized insights + 1 dynamic greeting")
            
            # Verify we have enough insights for all user tiers
            if len(enhanced_insights) >= 12:
                logger.info("✅ Elite users (12 insights) and Pro users (8 insights) fully supported")
            elif len(enhanced_insights) >= 8:
                logger.warning("⚠️ Only Pro users (8 insights) supported - Elite users won't get full experience")
            else:
                logger.error("❌ Insufficient insights generated for proper user experience")
            
            logger.info("📱 Fresh enhanced insights now available in app!")
            
            # Log sample insights
            logger.info(f"  🎭 Greeting: Dynamic greeting stored as intro category")
            for insight in enhanced_insights[:3]:
                logger.info(f"  [{insight['category']}] {insight['title']}: {insight['description'][:60]}...")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Enhanced insights generation failed: {e}")
            return False

def parse_arguments():
    parser = argparse.ArgumentParser(description='Generate enhanced AI betting insights')
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
        
        generator = EnhancedInsightsGenerator()
        success = generator.run_enhanced_insights_generation(
            target_date=args.date,
            use_tomorrow=args.tomorrow
        )
        if success:
            print("🎯 Enhanced insights generation completed successfully!")
        else:
            print("❌ Enhanced insights generation failed!")
    except Exception as e:
        logger.error(f"Script failed: {e}")
        print(f"❌ Script failed: {e}")
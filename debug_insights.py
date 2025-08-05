#!/usr/bin/env python3
"""
Debug version of enhanced insights to find the timeout issue
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

class DebugInsightsGenerator:
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
            ).order('start_time').limit(5).execute()  # Limit to 5 games for debugging
            
            if not result.data:
                logger.warning("No upcoming games found")
                return []
            
            games_with_odds = []
            for game in result.data:
                # Simplified game data for debugging
                games_with_odds.append({
                    'id': game['id'],
                    'home_team': game['home_team'],
                    'away_team': game['away_team'],
                    'start_time': game['start_time'],
                    'sport': game['sport']
                })
            
            logger.info(f"✅ Found {len(games_with_odds)} upcoming games with odds")
            return games_with_odds
            
        except Exception as e:
            logger.error(f"Error fetching upcoming games: {e}")
            return []

    def create_simplified_research_prompt(self, games):
        """Create a MUCH simpler research prompt for debugging"""
        
        prompt = f"""🎯 Professor Lock, I've got {len(games)} upcoming MLB games. Pick 3 games and suggest what to research about them.

📊 **GAMES:**
"""
        
        for i, game in enumerate(games[:5], 1):
            start_time = datetime.fromisoformat(game['start_time'].replace('Z', '+00:00'))
            game_time = start_time.strftime('%I:%M %p ET')
            prompt += f"{i}. {game['away_team']} @ {game['home_team']} - {game_time}\n"
        
        prompt += """\n🧠 **YOUR MISSION:**
Pick 3 games and tell me what to research. Keep it under 300 words total.

Examples:
- Check pitcher stats
- Look for injuries  
- Weather conditions

Give me specific research suggestions - don't analyze, just tell me what to look up!"""

        return prompt

    def send_to_professor_lock(self, prompt):
        """Send prompt to Professor Lock for research guidance"""
        try:
            logger.info("🤖 Asking Professor Lock what to research...")
            logger.info(f"📏 Prompt length: {len(prompt)} characters")
            
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
            
            logger.info(f"📦 Payload size: {len(json.dumps(payload))} characters")
            
            # Try with a shorter timeout first
            response = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=20)
            
            if response.status_code == 200:
                result = response.json()
                research_plan = result.get('response', '')
                logger.info(f"✅ Got research plan from Professor Lock ({len(research_plan)} chars)")
                logger.info(f"🔍 Tools used: {result.get('toolsUsed', [])}")
                return research_plan
            else:
                logger.error(f"Professor Lock API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error calling Professor Lock: {e}")
            return None

    def debug_run(self):
        """Debug version of the insights generation"""
        logger.info("🐛 Starting DEBUG Enhanced Insights Generation")
        
        try:
            # Step 1: Get games
            games = self.fetch_upcoming_games_with_odds()
            if not games:
                logger.error("No games found")
                return False
            
            logger.info(f"📋 Found {len(games)} games to analyze")
            
            # Step 2: Create simplified prompt
            prompt = self.create_simplified_research_prompt(games)
            logger.info(f"📝 Created research prompt:")
            logger.info(f"--- PROMPT START ---")
            logger.info(prompt)
            logger.info(f"--- PROMPT END ---")
            
            # Step 3: Test the request
            research_plan = self.send_to_professor_lock(prompt)
            if research_plan:
                logger.info("✅ SUCCESS! Got response from Professor Lock")
                logger.info(f"📄 Response preview: {research_plan[:200]}...")
                return True
            else:
                logger.error("❌ Failed to get response")
                return False
            
        except Exception as e:
            logger.error(f"❌ Debug run failed: {e}")
            return False

if __name__ == "__main__":
    try:
        generator = DebugInsightsGenerator()
        success = generator.debug_run()
        if success:
            print("🎯 Debug test PASSED! The issue was with prompt complexity.")
        else:
            print("❌ Debug test FAILED! Issue persists.")
    except Exception as e:
        logger.error(f"Script failed: {e}")
        print(f"❌ Script failed: {e}")
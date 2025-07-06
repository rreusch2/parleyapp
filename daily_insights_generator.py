#!/usr/bin/env python3
"""
Daily Insights Generator using Professor Lock
Fetches scraped data and generates AI-powered insights for the home tab
"""

import requests
import json
import os
from datetime import datetime, date
from supabase import create_client, Client
import logging
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DailyInsightsGenerator:
    def __init__(self):
        # Initialize Supabase client
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables")
        
        logger.info(f"Connecting to Supabase at: {self.supabase_url[:50]}...")
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Backend API URL
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:3001')
        
        # Sample user ID for Professor Lock context
        self.user_id = 'f08b56d3-d4ec-4815-b502-6647d723d2a6'  # TODO: Use real admin user ID

    def fetch_daily_data(self):
        """Fetch today's scraped data from daily_insights_data table"""
        try:
            today = date.today().isoformat()
            
            result = self.supabase.table('daily_insights_data').select('*').eq('date_collected', today).execute()
            
            if not result.data:
                logger.warning("No daily data found for today")
                return None
            
            # Organize data by type
            organized_data = {
                'team_recent_games': [],
                'player_recent_stats': [],
                'standings': [],
                'league_trends': []
            }
            
            for record in result.data:
                data_type = record['data_type']
                if data_type in organized_data:
                    organized_data[data_type].append({
                        'team_name': record.get('team_name'),
                        'player_name': record.get('player_name'),
                        'data': record['data']
                    })
            
            logger.info(f"Fetched daily data: {len(result.data)} records")
            return organized_data
            
        except Exception as e:
            logger.error(f"Error fetching daily data: {e}")
            return None

    def format_data_for_professor_lock(self, daily_data):
        """Format the daily data into a structured prompt for Professor Lock"""
        if not daily_data:
            return "No daily data available for insights generation."
        
        prompt = """🎯 Professor Lock, generate 5-7 sharp betting insights using ONLY the EXACT data below. DO NOT make up any statistics or numbers that aren't explicitly provided.

Here's today's real MLB intel:

"""
        
        # Add real daily trends data
        if daily_data.get('real_daily_trends'):
            for trend_data in daily_data['real_daily_trends']:
                data = trend_data['data']
                prompt += "📊 **TODAY'S GAMES & BETTING INSIGHTS:**\n"
                
                if 'betting_insights' in data:
                    for insight in data['betting_insights']:
                        prompt += f"• {insight}\n"
                
                prompt += f"• Total games today: {data.get('total_games_today', 0)}\n"
                prompt += f"• Games with high totals: {data.get('games_with_high_totals', 0)}\n"
                prompt += "\n"
        
        # Add real hot streaks data  
        if daily_data.get('real_hot_streaks'):
            for streak_data in daily_data['real_hot_streaks']:
                data = streak_data['data']
                prompt += "🔥 **TEAM MOMENTUM PATTERNS:**\n"
                
                if 'streaks_found' in data:
                    for streak in data['streaks_found']:
                        team = streak.get('team', 'Unknown')
                        pattern = streak.get('streak', 'Unknown')
                        note = streak.get('betting_note', '')
                        prompt += f"• {team}: {pattern} - {note}\n"
                prompt += "\n"

        prompt += """
🚨 **CRITICAL INSTRUCTIONS:**
1. Use ONLY the exact data provided above - NO made-up statistics
2. Generate 5-7 insights based strictly on the teams/trends shown
3. Keep insights short, punchy, and betting-focused
4. Use Professor Lock's style but NO fabricated numbers
5. If data mentions "Dodgers Won 4 of last 5" - use that EXACT phrase
6. DO NOT invent records like "7-3 in last 10" unless explicitly stated

Examples based on PROVIDED data:
- "Dodgers strong recent form, won 4 of last 5"
- "Astros offense heating up, over hit 5 straight"  
- "15 games on tap today, hunting value"

Return ONLY numbered insights (1-7), one per line. No extra text."""

        return prompt

    def generate_insights_with_professor_lock(self, formatted_prompt):
        """Send prompt to Professor Lock and get insights back"""
        try:
            logger.info("Sending data to Professor Lock for insights generation...")
            
            # Use the existing chat API endpoint
            url = f"{self.backend_url}/api/ai/chat"
            
            payload = {
                "message": formatted_prompt,
                "userId": self.user_id,
                "context": {
                    "screen": "admin_insights_generation",
                    "userTier": "pro",
                    "maxPicks": 10
                },
                "conversationHistory": []
            }
            
            headers = {
                "Content-Type": "application/json"
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                insights_text = result.get('response', '')
                logger.info("Successfully generated insights with Professor Lock")
                logger.debug(f"Response received: {insights_text[:200]}...")  # Debug log
                return insights_text
            else:
                logger.error(f"Professor Lock API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error calling Professor Lock API: {e}")
            return None

    def parse_insights_from_response(self, insights_text):
        """Parse Professor Lock's response into individual insights"""
        if not insights_text:
            logger.error("No insights text received from Professor Lock")
            return []
        
        logger.info(f"Professor Lock response: {insights_text[:500]}...")  # Log first 500 chars
        
        insights = []
        lines = insights_text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Remove numbering if present (1., 2., etc.)
            if line and line[0].isdigit() and '.' in line[:3]:
                line = line.split('.', 1)[1].strip()
            
            # Remove markdown formatting if present
            line = line.replace('**', '').replace('*', '')
            
            # Extract the core betting insight (before explanations)
            if ' - ' in line:
                # Take the main bet before the explanation
                core_insight = line.split(' - ')[0].strip()
            elif ':' in line and len(line.split(':')) >= 2:
                # Take the betting recommendation part
                parts = line.split(':')
                if len(parts) >= 2:
                    core_insight = f"{parts[0].strip()}: {parts[1].strip()}"
                else:
                    core_insight = line
            else:
                core_insight = line
            
            # Clean up the insight
            core_insight = core_insight.strip()
            
            # Skip if too short, but allow longer insights for betting recs
            if len(core_insight) < 10:
                logger.debug(f"Skipping short line: {core_insight}")
                continue
            
            # Limit to reasonable length but allow betting format
            if len(core_insight) > 200:
                core_insight = core_insight[:200] + "..."
                
            insights.append(core_insight)
            logger.info(f"Added insight: {core_insight}")
        
        logger.info(f"Parsed {len(insights)} insights from Professor Lock response")
        return insights[:7]  # Max 7 insights

    def store_generated_insights(self, insights):
        """Store the generated insights in the database"""
        try:
            if not insights:
                logger.warning("No insights to store")
                return
            
            # Clear any existing insights for today
            today = date.today().isoformat()
            self.supabase.table('daily_professor_insights').delete().eq('date_generated', today).execute()
            
            # Store new insights
            for i, insight in enumerate(insights):
                record = {
                    'insight_text': insight,
                    'insight_order': i + 1,
                    'date_generated': today,
                    'created_at': datetime.now().isoformat()
                }
                
                self.supabase.table('daily_professor_insights').insert(record).execute()
            
            logger.info(f"Stored {len(insights)} insights in database")
            
        except Exception as e:
            logger.error(f"Error storing insights: {e}")

    def create_insights_table_if_not_exists(self):
        """Create the daily_professor_insights table if it doesn't exist"""
        try:
            # This would typically be done via migration, but for setup:
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS daily_professor_insights (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                insight_text TEXT NOT NULL,
                insight_order INTEGER NOT NULL,
                date_generated DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_daily_insights_date ON daily_professor_insights(date_generated);
            """
            
            # Note: This would need to be run manually in Supabase SQL editor
            logger.info("⚠️  Make sure daily_professor_insights table exists in Supabase")
            
        except Exception as e:
            logger.error(f"Table creation info: {e}")

    def run_daily_insights_generation(self):
        """Main function to generate daily insights"""
        logger.info("🚀 Starting daily insights generation with Professor Lock...")
        
        try:
            # Ensure table exists (info only)
            self.create_insights_table_if_not_exists()
            
            # Step 1: Fetch today's scraped data
            daily_data = self.fetch_daily_data()
            if not daily_data:
                logger.error("No daily data available - cannot generate insights")
                return False
            
            # Step 2: Format data for Professor Lock
            formatted_prompt = self.format_data_for_professor_lock(daily_data)
            logger.info("Formatted data for Professor Lock")
            
            # Step 3: Generate insights with Professor Lock
            insights_response = self.generate_insights_with_professor_lock(formatted_prompt)
            if insights_response is None:
                logger.error("Failed to generate insights with Professor Lock")
                return False
            
            logger.info("Professor Lock response received successfully")
            
            # Step 4: Parse insights from response
            insights = self.parse_insights_from_response(insights_response)
            if not insights:
                logger.error("Failed to parse insights from Professor Lock response")
                logger.error(f"Raw response was: {insights_response}")
                return False
            
            logger.info(f"Successfully parsed {len(insights)} insights")
            
            # Step 5: Store insights in database
            self.store_generated_insights(insights)
            
            logger.info("✅ Daily insights generation completed successfully!")
            logger.info(f"Generated insights: {insights}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Daily insights generation failed: {e}")
            return False

if __name__ == "__main__":
    try:
        generator = DailyInsightsGenerator()
        success = generator.run_daily_insights_generation()
        exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Script failed: {e}")
        exit(1) 
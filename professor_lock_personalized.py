#!/usr/bin/env python3
"""
Enhanced Professor Lock Insights with User Preferences & Tiered Subscriptions
Generates personalized insights and "Play of the Day" based on user preferences
"""

import os
import sys
import json
import logging
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from supabase import create_client, Client
import openai

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('professor_lock_personalized.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class PersonalizedProfessorLock:
    def __init__(self):
        """Initialize the personalized Professor Lock with user preference support"""
        # API Keys
        self.xai_api_key = os.getenv('XAI_API_KEY')
        if not self.xai_api_key:
            raise ValueError("Please set XAI_API_KEY environment variable")
        
        # Supabase connection
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY')
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables")
        
        logger.info(f"Connecting to Supabase...")
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Backend API settings
        self.backend_url = os.getenv('BACKEND_URL', 'https://zooming-rebirth-production-a305.up.railway.app')
        
        # Headers for web requests
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        # StatMuse context scraping
        self.statmuse_base_url = "http://localhost:5001"

    def get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get user preferences from Supabase profiles table"""
        try:
            response = self.supabase.table('profiles').select(
                'sport_preferences, betting_style, pick_distribution, subscription_tier, preferred_sports'
            ).eq('id', user_id).single().execute()
            
            if response.data:
                return response.data
            else:
                logger.warning(f"No preferences found for user {user_id}, using defaults")
                return self.get_default_preferences()
        except Exception as e:
            logger.error(f"Error fetching user preferences: {e}")
            return self.get_default_preferences()

    def get_default_preferences(self) -> Dict[str, Any]:
        """Return default user preferences"""
        return {
            'sport_preferences': {'mlb': True, 'wnba': False, 'ufc': False},
            'betting_style': 'balanced',
            'pick_distribution': {'auto': True},
            'subscription_tier': 'free',
            'preferred_sports': ['mlb']
        }

    def get_user_recent_picks(self, user_id: str, days: int = 7) -> List[Dict[str, Any]]:
        """Get user's recent picks for personalized insights"""
        try:
            cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
            
            response = self.supabase.table('picks').select(
                'sport, pick_type, confidence, status, created_at, reasoning'
            ).eq('user_id', user_id).gte('created_at', cutoff_date).execute()
            
            return response.data if response.data else []
        except Exception as e:
            logger.error(f"Error fetching user picks: {e}")
            return []

    def calculate_insight_allocation(self, user_preferences: Dict[str, Any]) -> int:
        """Calculate how many insights to generate based on subscription tier"""
        tier = user_preferences.get('subscription_tier', 'free')
        
        if tier == 'allstar':
            return 12  # Premium insights
        elif tier == 'pro':
            return 8   # Standard insights
        else:  # free
            return 2   # Basic insights

    def scrape_statmuse_context(self) -> Dict[str, Any]:
        """Scrape StatMuse for current sports context"""
        try:
            logger.info("🔍 Scraping StatMuse for current context...")
            response = requests.get(
                f"{self.statmuse_base_url}/scrape-context",
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                logger.info("✅ StatMuse context scraping successful")
                return result.get('context', {})
            else:
                logger.warning(f"⚠️ StatMuse context scraping failed: {result.get('error')}")
                return {}
        except Exception as e:
            logger.error(f"❌ StatMuse scraping error: {e}")
            return {}

    def generate_personalized_system_prompt(self, user_preferences: Dict[str, Any], insight_count: int, recent_picks: List[Dict[str, Any]]) -> str:
        """Generate a personalized system prompt for insights"""
        betting_style = user_preferences.get('betting_style', 'balanced')
        tier = user_preferences.get('subscription_tier', 'free')
        preferred_sports = user_preferences.get('preferred_sports', ['mlb'])
        
        # Analyze recent performance
        recent_performance = self.analyze_recent_performance(recent_picks)
        
        # Betting style descriptions
        style_descriptions = {
            'conservative': "Focus on safe, high-probability insights. Emphasize bankroll management and proven strategies.",
            'balanced': "Mix of safe and moderate risk insights. Balance between security and growth opportunities.",
            'aggressive': "Target high-value opportunities and contrarian plays. Focus on maximizing profit potential."
        }
        
        # Tier-specific features
        tier_features = {
            'free': "Basic insights focused on fundamental betting concepts",
            'pro': "Advanced insights with market analysis and trend identification",
            'allstar': "Premium insights with advanced analytics, contrarian opportunities, and exclusive strategies"
        }
        
        return f"""You are Professor Lock, the elite sports betting AI providing personalized insights and analysis.

USER PROFILE:
- Subscription Tier: {tier.upper()} - {tier_features[tier]}
- Betting Style: {betting_style.upper()} - {style_descriptions[betting_style]}
- Preferred Sports: {', '.join(preferred_sports).upper()}
- Recent Performance: {recent_performance}

TASK: Generate {insight_count} personalized betting insights tailored to this user's profile and preferences.

INSIGHT CATEGORIES (mix these based on tier):
1. Market Analysis & Line Movement
2. Injury Impact & Roster Changes  
3. Weather & Situational Factors
4. Historical Trends & Patterns
5. Value Betting Opportunities
6. Bankroll Management Tips
7. Contrarian Play Identification (Pro/All-Star only)
8. Advanced Analytics Insights (All-Star only)

PERSONALIZATION REQUIREMENTS:
- Focus primarily on {', '.join(preferred_sports).upper()} sports
- Align risk tolerance with {betting_style} betting style
- Consider user's recent betting patterns and performance
- Provide {tier}-tier quality analysis and depth

INSIGHT STRUCTURE:
Each insight should include:
- Clear, actionable title
- 2-3 sentence explanation
- Specific application to current games/markets
- Risk level indicator (Low/Medium/High)
- Confidence level (60-95%)

FORMAT: Return JSON array with insights in this exact structure:
[
  {{
    "title": "Clear, actionable insight title",
    "category": "Market Analysis/Injury Impact/etc",
    "content": "Detailed 2-3 sentence explanation of the insight...",
    "application": "How to apply this to current betting opportunities",
    "risk_level": "Low/Medium/High",
    "confidence": 85,
    "sports": ["mlb", "wnba"],
    "betting_style_match": true
  }}
]

Focus on delivering {tier}-tier insights that match the user's {betting_style} approach and {', '.join(preferred_sports)} preferences."""

    def analyze_recent_performance(self, recent_picks: List[Dict[str, Any]]) -> str:
        """Analyze user's recent betting performance"""
        if not recent_picks:
            return "No recent betting history available"
        
        total_picks = len(recent_picks)
        won_picks = len([p for p in recent_picks if p.get('status') == 'won'])
        lost_picks = len([p for p in recent_picks if p.get('status') == 'lost'])
        pending_picks = total_picks - won_picks - lost_picks
        
        if won_picks + lost_picks > 0:
            win_rate = (won_picks / (won_picks + lost_picks)) * 100
            return f"{win_rate:.1f}% win rate over {total_picks} recent picks ({won_picks}W-{lost_picks}L-{pending_picks}P)"
        else:
            return f"{total_picks} recent picks (all pending)"

    def generate_play_of_the_day(self, user_preferences: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate personalized 'Play of the Day' for Pro/All-Star users"""
        tier = user_preferences.get('subscription_tier', 'free')
        
        if tier == 'free':
            return None  # Play of the Day is Pro+ feature
        
        try:
            logger.info("🎯 Generating personalized Play of the Day...")
            
            preferred_sports = user_preferences.get('preferred_sports', ['mlb'])
            betting_style = user_preferences.get('betting_style', 'balanced')
            
            system_prompt = f"""You are Professor Lock generating the PLAY OF THE DAY - your highest confidence bet.

USER PROFILE:
- Tier: {tier.upper()}
- Betting Style: {betting_style.upper()}
- Preferred Sports: {', '.join(preferred_sports).upper()}

TASK: Generate ONE premium Play of the Day from the user's preferred sports.

REQUIREMENTS:
1. Must be from user's preferred sports: {', '.join(preferred_sports)}
2. Confidence level must be 80%+ (your best bet of the day)
3. Include detailed analysis and reasoning
4. Consider all available context and current market conditions
5. Align with user's {betting_style} betting style

FORMAT: Return JSON with this exact structure:
{{
  "sport": "mlb/wnba/ufc",
  "title": "Clear, compelling title for the play",
  "bet_type": "Moneyline/Spread/Total/Prop",
  "pick": "Specific bet recommendation",
  "line": "Current line/odds",
  "confidence": 85,
  "reasoning": "Detailed 3-4 sentence explanation of why this is your top play",
  "key_factors": ["Factor 1", "Factor 2", "Factor 3"],
  "risk_assessment": "Why this aligns with {betting_style} betting style",
  "expected_value": "Analysis of the value in this bet"
}}

This should be your absolute best bet of the day - the one you're most confident in."""
            
            # Add context if available
            context_info = ""
            if context:
                relevant_context = {sport: context.get(sport, {}) for sport in preferred_sports if context.get(sport)}
                if relevant_context:
                    context_info = f"\n\nCURRENT CONTEXT:\n{json.dumps(relevant_context, indent=2)}"
            
            client = openai.OpenAI(
                api_key=self.xai_api_key,
                base_url="https://api.x.ai/v1"
            )
            
            response = client.chat.completions.create(
                model="grok-3",
                messages=[
                    {"role": "system", "content": system_prompt + context_info},
                    {"role": "user", "content": f"Generate the Play of the Day for a {betting_style} {tier} tier user who prefers {', '.join(preferred_sports)} sports."}
                ],
                temperature=0.6,
                max_tokens=1000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Extract JSON from response
            if '```json' in content:
                json_start = content.find('```json') + 7
                json_end = content.find('```', json_start)
                json_content = content[json_start:json_end].strip()
            elif '{' in content and '}' in content:
                json_start = content.find('{')
                json_end = content.rfind('}') + 1
                json_content = content[json_start:json_end]
            else:
                json_content = content
            
            play_of_day = json.loads(json_content)
            play_of_day['generated_at'] = datetime.now().isoformat()
            play_of_day['tier'] = tier
            
            logger.info(f"✅ Generated Play of the Day: {play_of_day.get('title', 'Unknown')}")
            return play_of_day
            
        except Exception as e:
            logger.error(f"❌ Error generating Play of the Day: {e}")
            return None

    def generate_personalized_insights(self, user_id: str = None) -> Dict[str, Any]:
        """Generate personalized insights for a specific user or all users"""
        try:
            logger.info("🚀 Starting personalized insights generation...")
            
            if user_id:
                # Generate for specific user
                user_preferences = self.get_user_preferences(user_id)
                recent_picks = self.get_user_recent_picks(user_id)
                insight_count = self.calculate_insight_allocation(user_preferences)
                context = self.scrape_statmuse_context()
                
                # Generate insights
                insights = self.generate_insights_for_user(user_preferences, insight_count, recent_picks, context)
                
                # Generate Play of the Day for Pro+ users
                play_of_day = self.generate_play_of_the_day(user_preferences, context)
                
                result = {
                    'success': True,
                    'user_id': user_id,
                    'insights': insights,
                    'play_of_the_day': play_of_day,
                    'total_insights': len(insights),
                    'preferences': user_preferences
                }
                
                # Save to database
                self.save_insights_to_database(user_id, insights, play_of_day)
                
                return result
            else:
                # Generate for all users (batch processing)
                return self.generate_for_all_users()
                
        except Exception as e:
            logger.error(f"❌ Error in personalized insights generation: {e}")
            return {'success': False, 'error': str(e)}

    def generate_insights_for_user(self, user_preferences: Dict[str, Any], insight_count: int, recent_picks: List[Dict[str, Any]], context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate insights for a specific user"""
        try:
            logger.info(f"🧠 Generating {insight_count} personalized insights...")
            
            system_prompt = self.generate_personalized_system_prompt(user_preferences, insight_count, recent_picks)
            
            # Add context if available
            context_info = ""
            if context:
                preferred_sports = user_preferences.get('preferred_sports', ['mlb'])
                relevant_context = {sport: context.get(sport, {}) for sport in preferred_sports if context.get(sport)}
                if relevant_context:
                    context_info = f"\n\nCURRENT SPORTS CONTEXT:\n{json.dumps(relevant_context, indent=2)}"
            
            client = openai.OpenAI(
                api_key=self.xai_api_key,
                base_url="https://api.x.ai/v1"
            )
            
            response = client.chat.completions.create(
                model="grok-3",
                messages=[
                    {"role": "system", "content": system_prompt + context_info},
                    {"role": "user", "content": f"Generate {insight_count} personalized betting insights for this user profile."}
                ],
                temperature=0.7,
                max_tokens=2500
            )
            
            content = response.choices[0].message.content.strip()
            
            # Extract JSON from response
            if '```json' in content:
                json_start = content.find('```json') + 7
                json_end = content.find('```', json_start)
                json_content = content[json_start:json_end].strip()
            elif '[' in content and ']' in content:
                json_start = content.find('[')
                json_end = content.rfind(']') + 1
                json_content = content[json_start:json_end]
            else:
                json_content = content
            
            insights = json.loads(json_content)
            
            # Validate and enhance insights
            validated_insights = []
            for insight in insights[:insight_count]:
                if all(key in insight for key in ['title', 'category', 'content', 'confidence']):
                    insight['generated_at'] = datetime.now().isoformat()
                    insight['tier'] = user_preferences.get('subscription_tier', 'free')
                    insight['user_betting_style'] = user_preferences.get('betting_style', 'balanced')
                    validated_insights.append(insight)
            
            logger.info(f"✅ Generated {len(validated_insights)} validated insights")
            return validated_insights
            
        except Exception as e:
            logger.error(f"❌ Error generating insights: {e}")
            return []

    def generate_for_all_users(self) -> Dict[str, Any]:
        """Generate personalized insights for all active users"""
        try:
            logger.info("🔄 Generating personalized insights for all users...")
            
            # Get all active users
            response = self.supabase.table('profiles').select(
                'id, sport_preferences, betting_style, pick_distribution, subscription_tier'
            ).execute()
            
            users = response.data if response.data else []
            logger.info(f"Found {len(users)} users to generate insights for")
            
            # Get context once for all users
            context = self.scrape_statmuse_context()
            
            results = []
            for user in users:
                try:
                    user_result = self.generate_personalized_insights(user['id'])
                    if user_result.get('success'):
                        results.append(user_result)
                        
                except Exception as e:
                    logger.error(f"Error generating insights for user {user['id']}: {e}")
                    continue
            
            return {
                'success': True,
                'total_users': len(users),
                'successful_generations': len(results),
                'results': results
            }
            
        except Exception as e:
            logger.error(f"❌ Error in batch generation: {e}")
            return {'success': False, 'error': str(e)}

    def save_insights_to_database(self, user_id: str, insights: List[Dict[str, Any]], play_of_day: Dict[str, Any] = None):
        """Save generated insights to the database"""
        try:
            # Save insights
            for insight in insights:
                insight_data = {
                    'user_id': user_id,
                    'title': insight['title'],
                    'category': insight['category'],
                    'content': insight['content'],
                    'confidence': insight['confidence'],
                    'risk_level': insight.get('risk_level', 'Medium'),
                    'sports': insight.get('sports', []),
                    'tier': insight.get('tier'),
                    'betting_style': insight.get('user_betting_style'),
                    'created_at': datetime.now().isoformat()
                }
                
                self.supabase.table('insights').insert(insight_data).execute()
            
            # Save Play of the Day if available
            if play_of_day:
                potd_data = {
                    'user_id': user_id,
                    'sport': play_of_day['sport'],
                    'title': play_of_day['title'],
                    'bet_type': play_of_day['bet_type'],
                    'pick': play_of_day['pick'],
                    'line': play_of_day['line'],
                    'confidence': play_of_day['confidence'],
                    'reasoning': play_of_day['reasoning'],
                    'key_factors': play_of_day.get('key_factors', []),
                    'tier': play_of_day.get('tier'),
                    'created_at': datetime.now().isoformat()
                }
                
                self.supabase.table('play_of_the_day').insert(potd_data).execute()
            
            logger.info(f"✅ Saved {len(insights)} insights and {'1 POTD' if play_of_day else 'no POTD'} to database for user {user_id}")
            
        except Exception as e:
            logger.error(f"❌ Error saving insights to database: {e}")

def main():
    """Main execution function"""
    try:
        agent = PersonalizedProfessorLock()
        
        # Check if user_id is provided as command line argument
        user_id = sys.argv[1] if len(sys.argv) > 1 else None
        
        if user_id:
            logger.info(f"Generating personalized insights for user: {user_id}")
            result = agent.generate_personalized_insights(user_id)
        else:
            logger.info("Generating personalized insights for all users")
            result = agent.generate_for_all_users()
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        logger.error(f"❌ Main execution error: {e}")
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == "__main__":
    main()

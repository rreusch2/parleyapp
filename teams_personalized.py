#!/usr/bin/env python3
"""
Enhanced Teams AI Generation with User Preferences & Tiered Subscriptions
Generates personalized team picks based on user preferences and subscription tier
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
        logging.FileHandler('teams_personalized.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class PersonalizedTeamsAgent:
    def __init__(self):
        """Initialize the personalized teams agent with user preference support"""
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

    def calculate_pick_allocation(self, user_preferences: Dict[str, Any]) -> Dict[str, int]:
        """Calculate how many team picks to generate per sport based on user preferences and tier"""
        tier = user_preferences.get('subscription_tier', 'free')
        sport_prefs = user_preferences.get('sport_preferences', {'mlb': True, 'wnba': False, 'ufc': False})
        pick_dist = user_preferences.get('pick_distribution', {'auto': True})
        
        # Total team picks based on tier
        if tier == 'allstar':
            total_teams = 15  # 30 total picks, 15 teams + 15 props
        elif tier == 'pro':
            total_teams = 10  # 20 total picks, 10 teams + 10 props
        else:  # free
            total_teams = 1   # 2 total picks, 1 team + 1 prop
        
        # Get active sports
        active_sports = [sport for sport, active in sport_prefs.items() if active]
        
        if not active_sports:
            active_sports = ['mlb']  # Default fallback
        
        allocation = {}
        
        if pick_dist.get('auto', True):
            # Auto-distribute evenly across active sports
            picks_per_sport = max(1, total_teams // len(active_sports))
            remainder = total_teams % len(active_sports)
            
            for i, sport in enumerate(active_sports):
                allocation[sport] = picks_per_sport + (1 if i < remainder else 0)
        else:
            # Use custom distribution
            custom_dist = pick_dist.get('custom', {})
            for sport in active_sports:
                team_key = f"{sport}_team"
                allocation[sport] = custom_dist.get(team_key, 1)
        
        logger.info(f"Team pick allocation for {tier} tier: {allocation}")
        return allocation

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

    def generate_personalized_system_prompt(self, user_preferences: Dict[str, Any], sport: str, allocation: int) -> str:
        """Generate a personalized system prompt based on user preferences"""
        betting_style = user_preferences.get('betting_style', 'balanced')
        tier = user_preferences.get('subscription_tier', 'free')
        
        # Betting style descriptions
        style_descriptions = {
            'conservative': "Focus on favorites and proven teams. Avoid risky underdogs and prefer established franchises.",
            'balanced': "Mix of favorites and value underdogs. Balance between safety and potential upsets.",
            'aggressive': "Target high-value underdogs and contrarian plays. Look for upset potential and line value."
        }
        
        # Tier-specific instructions
        tier_instructions = {
            'free': "Generate the single best team bet with highest confidence.",
            'pro': f"Generate {allocation} high-quality team bets with detailed analysis.",
            'allstar': f"Generate {allocation} premium team bets with advanced insights and contrarian opportunities."
        }
        
        # Sport-specific betting types
        sport_bet_types = {
            'mlb': "Moneyline, Run Line (-1.5/+1.5), Totals (Over/Under)",
            'wnba': "Moneyline, Point Spread, Totals (Over/Under)",
            'ufc': "Moneyline, Method of Victory, Round Totals"
        }
        
        return f"""You are Professor Lock, an elite sports betting AI specializing in {sport.upper()} team/matchup bets.

USER PROFILE:
- Subscription Tier: {tier.upper()}
- Betting Style: {betting_style.upper()} - {style_descriptions[betting_style]}
- Requested Team Bets: {allocation}

TASK: {tier_instructions[tier]}

BETTING STYLE GUIDELINES:
{style_descriptions[betting_style]}

AVAILABLE BET TYPES FOR {sport.upper()}:
{sport_bet_types.get(sport, "Moneyline, Spread, Totals")}

REQUIREMENTS:
1. Generate exactly {allocation} {sport.upper()} team/matchup bets
2. Each pick must include:
   - Teams involved (Team A vs Team B)
   - Bet type (Moneyline/Spread/Total/etc.)
   - Recommended bet and line
   - Confidence level (55-95%)
   - Detailed reasoning (2-3 sentences)
   - Key factors supporting the pick

3. Confidence levels should reflect {betting_style} approach:
   - Conservative: 65-85% range, focus on favorites and proven trends
   - Balanced: 60-90% range, mix of safe picks and value plays  
   - Aggressive: 55-95% range, include high-value underdogs and contrarian bets

4. Consider current form, injuries, head-to-head records, and situational factors
5. Use available statistical context and recent trends

FORMAT: Return JSON array with picks in this exact structure:
[
  {{
    "matchup": "Team A vs Team B",
    "bet_type": "Moneyline/Spread/Total",
    "line": "-150/+3.5/8.5",
    "recommendation": "Team A/-150/Over",
    "confidence": 78,
    "reasoning": "Detailed explanation of why this bet has value...",
    "key_factors": ["Factor 1", "Factor 2", "Factor 3"]
  }}
]

Focus on delivering {tier}-tier quality analysis with {betting_style} risk management."""

    def generate_teams_for_sport(self, sport: str, user_preferences: Dict[str, Any], allocation: int, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate team picks for a specific sport with user personalization"""
        try:
            logger.info(f"🎯 Generating {allocation} personalized {sport.upper()} team picks...")
            
            # Create personalized system prompt
            system_prompt = self.generate_personalized_system_prompt(user_preferences, sport, allocation)
            
            # Add context to the prompt if available
            context_info = ""
            if context:
                sport_context = context.get(sport, {})
                if sport_context:
                    context_info = f"\n\nCURRENT {sport.upper()} CONTEXT:\n{json.dumps(sport_context, indent=2)}"
            
            # Make API call to xAI Grok
            client = openai.OpenAI(
                api_key=self.xai_api_key,
                base_url="https://api.x.ai/v1"
            )
            
            response = client.chat.completions.create(
                model="grok-3",
                messages=[
                    {"role": "system", "content": system_prompt + context_info},
                    {"role": "user", "content": f"Generate {allocation} personalized {sport.upper()} team bets for a {user_preferences.get('betting_style', 'balanced')} bettor with {user_preferences.get('subscription_tier', 'free')} tier access."}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            
            # Parse response
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
            
            picks = json.loads(json_content)
            
            # Validate and enhance picks
            validated_picks = []
            for pick in picks[:allocation]:  # Ensure we don't exceed allocation
                if all(key in pick for key in ['matchup', 'bet_type', 'line', 'recommendation', 'confidence', 'reasoning']):
                    pick['sport'] = sport
                    pick['tier'] = user_preferences.get('subscription_tier', 'free')
                    pick['betting_style'] = user_preferences.get('betting_style', 'balanced')
                    pick['generated_at'] = datetime.now().isoformat()
                    validated_picks.append(pick)
            
            logger.info(f"✅ Generated {len(validated_picks)} validated {sport.upper()} team picks")
            return validated_picks
            
        except Exception as e:
            logger.error(f"❌ Error generating {sport} teams: {e}")
            return []

    def generate_personalized_teams(self, user_id: str = None) -> Dict[str, Any]:
        """Generate personalized team picks for a specific user or all users"""
        try:
            logger.info("🚀 Starting personalized teams generation...")
            
            if user_id:
                # Generate for specific user
                user_preferences = self.get_user_preferences(user_id)
                allocation = self.calculate_pick_allocation(user_preferences)
                context = self.scrape_statmuse_context()
                
                all_picks = []
                for sport, pick_count in allocation.items():
                    if pick_count > 0:
                        sport_picks = self.generate_teams_for_sport(sport, user_preferences, pick_count, context)
                        all_picks.extend(sport_picks)
                
                return {
                    'success': True,
                    'user_id': user_id,
                    'picks': all_picks,
                    'total_picks': len(all_picks),
                    'preferences': user_preferences
                }
            else:
                # Generate for all users (batch processing)
                return self.generate_for_all_users()
                
        except Exception as e:
            logger.error(f"❌ Error in personalized teams generation: {e}")
            return {'success': False, 'error': str(e)}

    def generate_for_all_users(self) -> Dict[str, Any]:
        """Generate personalized picks for all active users"""
        try:
            logger.info("🔄 Generating personalized teams for all users...")
            
            # Get all active users
            response = self.supabase.table('profiles').select(
                'id, sport_preferences, betting_style, pick_distribution, subscription_tier'
            ).execute()
            
            users = response.data if response.data else []
            logger.info(f"Found {len(users)} users to generate picks for")
            
            # Get context once for all users
            context = self.scrape_statmuse_context()
            
            results = []
            for user in users:
                try:
                    user_result = self.generate_personalized_teams(user['id'])
                    if user_result.get('success'):
                        results.append(user_result)
                        
                        # Save picks to database
                        self.save_picks_to_database(user['id'], user_result['picks'])
                        
                except Exception as e:
                    logger.error(f"Error generating picks for user {user['id']}: {e}")
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

    def save_picks_to_database(self, user_id: str, picks: List[Dict[str, Any]]):
        """Save generated picks to the database"""
        try:
            for pick in picks:
                pick_data = {
                    'user_id': user_id,
                    'sport': pick['sport'],
                    'pick_type': 'team',
                    'matchup': pick['matchup'],
                    'bet_type': pick['bet_type'],
                    'line': pick['line'],
                    'recommendation': pick['recommendation'],
                    'confidence': pick['confidence'],
                    'reasoning': pick['reasoning'],
                    'key_factors': pick.get('key_factors', []),
                    'betting_style': pick.get('betting_style'),
                    'tier': pick.get('tier'),
                    'status': 'pending',
                    'created_at': datetime.now().isoformat()
                }
                
                self.supabase.table('picks').insert(pick_data).execute()
            
            logger.info(f"✅ Saved {len(picks)} picks to database for user {user_id}")
            
        except Exception as e:
            logger.error(f"❌ Error saving picks to database: {e}")

def main():
    """Main execution function"""
    try:
        agent = PersonalizedTeamsAgent()
        
        # Check if user_id is provided as command line argument
        user_id = sys.argv[1] if len(sys.argv) > 1 else None
        
        if user_id:
            logger.info(f"Generating personalized teams for user: {user_id}")
            result = agent.generate_personalized_teams(user_id)
        else:
            logger.info("Generating personalized teams for all users")
            result = agent.generate_for_all_users()
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        logger.error(f"❌ Main execution error: {e}")
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Enhanced Trends Generator for ParleyApp
Creates rich, actionable trends with proper chart data for visualization

Features:
- Connects AI predictions with actual player performance 
- Generates chart data with prediction lines and performance bars
- Creates trend strength indicators and confidence metrics
- Populates visual_data for enhanced frontend charts
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime, timedelta, date
from supabase import create_client, Client
from dotenv import load_dotenv
from openai import AsyncOpenAI
from typing import Dict, List, Optional, Any
import uuid
import random

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EnhancedTrendsGenerator:
    def __init__(self):
        # Initialize Supabase with admin client for full access
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.supabase = create_client(self.supabase_url, self.supabase_service_key)
        
        # Initialize Grok AI
        self.grok_client = AsyncOpenAI(
            api_key=os.getenv('XAI_API_KEY'),
            base_url="https://api.x.ai/v1"
        )
        
        logger.info("🚀 Enhanced Trends Generator initialized")

    async def fetch_player_game_performance(self, player_name: str, prop_type: str = 'hits', limit: int = 10) -> List[Dict]:
        """Fetch actual player performance data from player_game_stats via players table"""
        try:
            # First, find the player in the players table
            player_response = self.supabase.table('players').select(
                'id, player_name, team, sport'
            ).ilike('player_name', f'%{player_name}%').eq('sport', 'MLB').limit(1).execute()
            
            if not player_response.data:
                logger.warning(f"❌ Player {player_name} not found in players table")
                return []
                
            player_id = player_response.data[0]['id']
            logger.info(f"✅ Found player {player_name} with ID {player_id}")
            
            # Query player_game_stats using player_id
            stats_response = self.supabase.table('player_game_stats').select(
                'stats, created_at'
            ).eq('player_id', player_id).order('created_at', desc=True).limit(limit).execute()
            
            if stats_response.data:
                # Extract relevant stats from JSONB stats column
                game_performances = []
                for record in stats_response.data:
                    stats = record.get('stats', {})
                    if stats and stats.get('type') == 'batting':
                        game_performances.append({
                            'game_date': stats.get('game_date'),
                            'hits': stats.get('hits', 0),
                            'home_runs': stats.get('home_runs', 0),
                            'at_bats': stats.get('at_bats', 0),
                            'strikeouts': stats.get('strikeouts', 0),
                            'walks': stats.get('walks', 0),
                            'rbis': stats.get('rbis', 0)  # This might not exist, default to 0
                        })
                
                logger.info(f"✅ Found {len(game_performances)} batting performances for {player_name}")
                return game_performances
            else:
                logger.warning(f"❌ No game stats found for player ID {player_id}")
                return []
                
        except Exception as e:
            logger.error(f"Error fetching player performance: {e}")
            return []

    async def fetch_ai_prediction_line(self, player_name: str, prop_type: str = 'hits') -> Optional[Dict]:
        """Fetch most recent AI prediction line for this player/prop combination"""
        try:
            # Map prop types to pick text patterns
            prop_patterns = {
                'hits': ['hits', 'hit'],
                'home_runs': ['home runs', 'hr', 'homers'],
                'rbis': ['rbis', 'rbi'],
                'runs': ['runs scored', 'runs'],
                'strikeouts': ['strikeouts', 'ks']
            }
            
            patterns = prop_patterns.get(prop_type.lower(), ['hits'])
            
            # Search for recent AI predictions containing this player and prop type
            for pattern in patterns:
                response = self.supabase.table('ai_predictions').select(
                    'pick, odds, confidence, reasoning, created_at'
                ).ilike('pick', f'%{player_name}%').ilike('pick', f'%{pattern}%').order('created_at', desc=True).limit(1).execute()
                
                if response.data:
                    prediction = response.data[0]
                    # Extract line from pick text (e.g., "Bryce Harper Over 1.5 Hits" -> 1.5)
                    pick_text = prediction['pick']
                    
                    # Try to extract numeric line from pick text
                    import re
                    line_match = re.search(r'(\d+\.?\d*)', pick_text)
                    if line_match:
                        line_value = float(line_match.group(1))
                        logger.info(f"✅ Found AI prediction line {line_value} for {player_name} {prop_type}")
                        return {
                            'line': line_value,
                            'confidence': prediction['confidence'],
                            'pick_text': pick_text,
                            'reasoning': prediction['reasoning'],
                            'created_at': prediction['created_at']
                        }
            
            logger.warning(f"❌ No AI prediction found for {player_name} {prop_type}")
            return None
            
        except Exception as e:
            logger.error(f"Error fetching AI prediction: {e}")
            return None

    async def generate_enhanced_chart_data(self, player_name: str, prop_type: str = 'hits') -> Dict:
        """Generate rich chart data connecting AI predictions with actual performance"""
        
        # Fetch actual player performance
        game_stats = await self.fetch_player_game_performance(player_name, prop_type, 10)
        
        # Fetch AI prediction line
        ai_prediction = await self.fetch_ai_prediction_line(player_name, prop_type)
        
        if not game_stats:
            return {}
            
        # Process game data for chart
        chart_games = []
        prop_field_map = {
            'hits': 'hits',
            'home_runs': 'home_runs', 
            'rbis': 'rbis',
            'runs': 'runs',
            'strikeouts': 'strikeouts'
        }
        
        prop_field = prop_field_map.get(prop_type.lower(), 'hits')
        ai_line = ai_prediction['line'] if ai_prediction else 1.5
        
        for game in game_stats[:10]:  # Last 10 games
            actual_value = game.get(prop_field, 0) or 0
            
            # Determine if performance was over/under the AI line
            result = 'over' if actual_value > ai_line else 'under'
            margin = actual_value - ai_line
            
            # Extract opponent from game context (simplified)
            game_date = game.get('game_date', '')
            opponent = f"vs {game_date[-5:]}" if game_date else f"Game {len(chart_games)+1}"
            
            chart_games.append({
                'date': game_date,
                'opponent': opponent,
                'actual_value': actual_value,
                'ai_line': ai_line,
                'result': result,
                'margin': margin,
                'hit_rate': 1 if result == 'over' else 0
            })
        
        # Calculate trend statistics
        total_games = len(chart_games)
        over_hits = sum(1 for game in chart_games if game['result'] == 'over')
        hit_rate = (over_hits / total_games) * 100 if total_games > 0 else 0
        
        # Calculate recent form (last 5 games)
        recent_games = chart_games[:5]
        recent_overs = sum(1 for game in recent_games if game['result'] == 'over')
        recent_form = (recent_overs / len(recent_games)) * 100 if recent_games else 0
        
        # Generate trend strength
        if hit_rate >= 70:
            strength = 'Strong'
            strength_color = '#22C55E'
        elif hit_rate >= 50:
            strength = 'Moderate' 
            strength_color = '#F59E0B'
        else:
            strength = 'Weak'
            strength_color = '#EF4444'
            
        return {
            'recent_games': list(reversed(chart_games)),  # Chronological order for chart
            'ai_prediction_line': ai_line,
            'prop_type': prop_type.title(),
            'hit_rate': round(hit_rate, 1),
            'recent_form': round(recent_form, 1),
            'total_games': total_games,
            'trend_strength': strength,
            'strength_color': strength_color,
            'confidence_score': ai_prediction['confidence'] if ai_prediction else 65,
            'last_5_average': round(sum(game['actual_value'] for game in recent_games) / len(recent_games), 2) if recent_games else 0
        }

    async def generate_player_trend_with_ai(self, player_name: str, chart_data: Dict) -> Dict:
        """Use AI to generate insightful trend analysis"""
        
        if not chart_data:
            return {}
            
        prompt = f"""
You are an expert sports betting analyst. Analyze this player's performance trend and create actionable insights.

PLAYER: {player_name}
PROP TYPE: {chart_data.get('prop_type', 'Hits')}
AI PREDICTION LINE: {chart_data.get('ai_prediction_line', 1.5)}

RECENT PERFORMANCE:
- Hit Rate: {chart_data.get('hit_rate', 0)}% (over AI line in {chart_data.get('hit_rate', 0)}% of games)
- Recent Form: {chart_data.get('recent_form', 0)}% (last 5 games)
- Trend Strength: {chart_data.get('trend_strength', 'Moderate')}
- Last 5 Game Average: {chart_data.get('last_5_average', 0)}

GAME-BY-GAME BREAKDOWN:
{json.dumps(chart_data.get('recent_games', [])[:5], indent=2)}

Create a concise, actionable trend analysis including:
1. HEADLINE: One compelling sentence about the trend
2. INSIGHT: Key pattern or finding (2-3 sentences)
3. RECOMMENDATION: Betting strategy recommendation
4. KEY_STAT: Most important statistic
5. CATEGORY: trend category (streak, form, matchup, performance, consistency)

Return JSON format:
{{
  "headline": "Clear, compelling headline about the trend",
  "insight": "2-3 sentence analysis of the key pattern",
  "recommendation": "Specific betting recommendation",
  "key_stat": "Most important statistic to highlight",
  "category": "trend category"
}}
"""
        
        try:
            response = await self.grok_client.chat.completions.create(
                model="grok-2-1212",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=500
            )
            
            content = response.choices[0].message.content.strip()
            
            # Extract JSON from response
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_content = content[json_start:json_end]
                analysis = json.loads(json_content)
                logger.info(f"✅ Generated AI trend analysis for {player_name}")
                return analysis
            else:
                logger.warning(f"Could not extract JSON from AI response for {player_name}")
                return {}
                
        except Exception as e:
            logger.error(f"Error generating AI trend analysis: {e}")
            return {}

    async def create_enhanced_trend(self, player_name: str, prop_type: str = 'hits') -> Optional[Dict]:
        """Create a complete enhanced trend with rich data"""
        
        logger.info(f"🎯 Creating enhanced trend for {player_name} - {prop_type}")
        
        # Generate chart data
        chart_data = await self.generate_enhanced_chart_data(player_name, prop_type)
        
        if not chart_data:
            logger.warning(f"❌ No chart data generated for {player_name}")
            return None
            
        # Generate AI analysis
        ai_analysis = await self.generate_player_trend_with_ai(player_name, chart_data)
        
        # Create trend record
        trend_record = {
            'id': str(uuid.uuid4()),
            'user_id': str(uuid.uuid4()),  # Global trend
            'is_global': True,
            'trend_type': 'player_prop',
            'sport': 'MLB',
            'full_player_name': player_name,
            'trend_text': ai_analysis.get('insight', f"{player_name} {prop_type} performance analysis"),
            'title': ai_analysis.get('headline', f"{player_name} {prop_type.title()} Trend"),
            'description': ai_analysis.get('insight', ''),
            'insight': ai_analysis.get('recommendation', ''),
            'trend_category': ai_analysis.get('category', 'performance'),
            'confidence_score': chart_data.get('confidence_score', 75),
            
            # Enhanced chart data for visualization
            'chart_data': {
                'recent_games': chart_data.get('recent_games', []),
                'ai_prediction_line': chart_data.get('ai_prediction_line', 1.5),
                'prop_type': chart_data.get('prop_type', prop_type.title())
            },
            
            # Visual data for frontend
            'visual_data': {
                'hit_rate': chart_data.get('hit_rate', 0),
                'recent_form': chart_data.get('recent_form', 0),
                'trend_strength': chart_data.get('trend_strength', 'Moderate'),
                'strength_color': chart_data.get('strength_color', '#F59E0B'),
                'last_5_average': chart_data.get('last_5_average', 0),
                'chart_type': 'performance_vs_line'
            },
            
            # Key stats for quick reference
            'key_stats': {
                'hit_rate': f"{chart_data.get('hit_rate', 0)}%",
                'games_analyzed': chart_data.get('total_games', 0),
                'recent_form': f"{chart_data.get('recent_form', 0)}%",
                'trend_direction': 'up' if chart_data.get('hit_rate', 0) >= 60 else 'down',
                'key_metric': ai_analysis.get('key_stat', f"{chart_data.get('hit_rate', 0)}% hit rate")
            },
            
            'created_at': datetime.now().isoformat(),
            'expires_at': (datetime.now() + timedelta(days=1)).isoformat()
        }
        
        logger.info(f"✅ Enhanced trend created for {player_name} - Hit Rate: {chart_data.get('hit_rate', 0)}%")
        return trend_record

    async def generate_sample_enhanced_trends(self, count: int = 8) -> List[Dict]:
        """Generate sample enhanced trends for testing"""
        
        # Sample players and prop types for demonstration
        sample_players = [
            ('Bryce Harper', 'hits'),
            ('Aaron Judge', 'home_runs'), 
            ('Mookie Betts', 'hits'),
            ('Vladimir Guerrero Jr.', 'rbis'),
            ('Juan Soto', 'hits'),
            ('Ronald Acuña Jr.', 'runs'),
            ('Freddie Freeman', 'rbis'),
            ('Mike Trout', 'home_runs')
        ]
        
        trends = []
        
        for i, (player_name, prop_type) in enumerate(sample_players[:count]):
            try:
                trend = await self.create_enhanced_trend(player_name, prop_type)
                if trend:
                    trends.append(trend)
                    logger.info(f"✅ Created trend {i+1}/{count}: {player_name}")
                else:
                    logger.warning(f"❌ Failed to create trend for {player_name}")
                    
                # Small delay to avoid overwhelming APIs
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Error creating trend for {player_name}: {e}")
                continue
                
        logger.info(f"🎯 Generated {len(trends)}/{count} enhanced trends")
        return trends

    async def store_trends_in_database(self, trends: List[Dict]) -> bool:
        """Store enhanced trends in ai_trends table"""
        
        try:
            # Clear existing trends for today
            today = datetime.now().date()
            self.supabase.table('ai_trends').delete().gte('created_at', today.isoformat()).execute()
            logger.info(f"🗑️  Cleared existing trends for {today}")
            
            # Insert new trends
            if trends:
                response = self.supabase.table('ai_trends').insert(trends).execute()
                if response.data:
                    logger.info(f"✅ Stored {len(trends)} enhanced trends in database")
                    return True
                else:
                    logger.error("Failed to store trends in database")
                    return False
            else:
                logger.warning("No trends to store")
                return False
                
        except Exception as e:
            logger.error(f"Error storing trends: {e}")
            return False

    async def run_enhanced_trends_generation(self):
        """Main execution function"""
        logger.info("🚀 Starting Enhanced Trends Generation")
        
        try:
            # Generate enhanced trends
            trends = await self.generate_sample_enhanced_trends(8)
            
            if trends:
                # Store in database
                success = await self.store_trends_in_database(trends)
                
                if success:
                    logger.info("🎉 Enhanced trends generation completed successfully!")
                    print(f"\n🎯 Generated {len(trends)} enhanced trends with rich chart data")
                    print("✅ Ready for frontend visualization")
                else:
                    logger.error("❌ Failed to store trends")
            else:
                logger.error("❌ No trends generated")
                
        except Exception as e:
            logger.error(f"Fatal error in trends generation: {e}")

if __name__ == "__main__":
    generator = EnhancedTrendsGenerator()
    asyncio.run(generator.run_enhanced_trends_generation())
